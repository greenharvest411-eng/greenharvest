import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';

const scrypt = promisify(scryptCallback);
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.PG_POOL_SIZE || 5),
  connectionTimeoutMillis: 65_000,
  idleTimeoutMillis: 30_000,
  ssl: process.env.PGSSL === 'disable' ? false : { rejectUnauthorized: process.env.PGSSL !== 'require' },
});
const port = Number(process.env.PORT || 3000);
const secureCookies = process.env.NODE_ENV === 'production';
const SESSION_DAYS = 7;
const distDir = resolve('dist');
const s3 = process.env.AWS_REGION ? new S3Client({ region: process.env.AWS_REGION }) : null;
const imageTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

function json(res, status, body, headers = {}) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...headers });
  res.end(JSON.stringify(body));
}
async function serveStatic(res, pathname) {
  const requestedPath = decodeURIComponent(pathname);
  const candidate = resolve(distDir, `.${requestedPath}`);
  if (candidate !== distDir && !candidate.startsWith(`${distDir}${sep}`)) return json(res,400,{error:'Invalid path'});
  const mime = { '.css':'text/css; charset=utf-8','.html':'text/html; charset=utf-8','.ico':'image/x-icon','.js':'text/javascript; charset=utf-8','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp','.woff2':'font/woff2' };
  try {
    const content = await readFile(candidate);
    res.writeHead(200,{'content-type':mime[extname(candidate)]||'application/octet-stream','cache-control':candidate.endsWith('index.html')?'no-cache':'public, max-age=31536000, immutable','x-content-type-options':'nosniff'});
    return res.end(content);
  } catch {
    if (extname(requestedPath)) return json(res,404,{error:'Not found'});
    try { const content=await readFile(resolve(distDir,'index.html')); res.writeHead(200,{'content-type':mime['.html'],'cache-control':'no-cache','x-content-type-options':'nosniff'}); return res.end(content); }
    catch { return json(res,503,{error:'Frontend is not built yet. Run npm run build.'}); }
  }
}
function cookieHeader(token, maxAge) {
  return `gh_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secureCookies ? '; Secure' : ''}`;
}
function hashToken(token) { return createHash('sha256').update(token).digest('hex'); }
function parseCookies(value = '') {
  return Object.fromEntries(value.split(';').map(x => x.trim().split(/=(.*)/s)).filter(x => x.length > 1));
}
async function body(req) {
  // Vercel's Node.js runtime may parse JSON bodies before invoking a function.
  if (req.body !== undefined) {
    if (typeof req.body === 'string' || Buffer.isBuffer(req.body)) {
      try { return JSON.parse(req.body.toString()); } catch { throw Object.assign(new Error('Invalid JSON'), { status: 400 }); }
    }
    if (req.body && typeof req.body === 'object') return req.body;
  }
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 32_000) throw Object.assign(new Error('Request is too large'), { status: 413 });
  }
  try { return raw ? JSON.parse(raw) : {}; } catch { throw Object.assign(new Error('Invalid JSON'), { status: 400 }); }
}
function requiredString(value, label, max = 200) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw Object.assign(new Error(`${label} is required`), { status: 400 });
  return value.trim();
}
function positiveInteger(value, label) {
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount <= 0) throw Object.assign(new Error(`${label} must be a positive whole number`), { status: 400 });
  return amount;
}
function dateToday() { return new Date().toISOString().slice(0,10); }
function minorUnitScale(currency) {
  if (currency === 'UGX') return 1;
  if (currency === 'AED') return 100;
  throw Object.assign(new Error(`Currency ${currency} is not configured yet`), { status: 400 });
}
function validDate(value, label) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw Object.assign(new Error(`${label} must use YYYY-MM-DD`), { status: 400 });
  }
  return value;
}
async function audit(client, userId, organisationId, action, recordType, recordId, oldValue, newValue, req) {
  await client.query(
    `insert into audit_log (user_id, organisation_id, action, record_type, record_id, old_value, new_value, ip, user_agent)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [userId, organisationId, action, recordType, recordId, oldValue ?? null, newValue ?? null, req.socket.remoteAddress || null, req.headers['user-agent'] || null],
  );
}
async function withAudit(req, res, info, operation) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const result = await operation(client);
    await audit(client, req.user.id, req.user.organisation_id, info.action, info.type, result.id, null, result.auditValue, req);
    await client.query('commit');
    json(res, info.status || 201, result.response);
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally { client.release(); }
}
async function currentUser(req) {
  const token = parseCookies(req.headers.cookie).gh_session;
  if (!token) return null;
  const result = await pool.query(
    `select u.id, u.email, u.full_name, m.organisation_id, o.name as organisation_name,
            array_agg(distinct rp.permission_code) filter (where rp.permission_code is not null) as permissions
       from sessions s join users u on u.id=s.user_id and u.is_active
       join memberships m on m.user_id=u.id and m.is_active
       join organisations o on o.id=m.organisation_id
       left join user_roles ur on ur.user_id=u.id and ur.organisation_id=m.organisation_id
       left join role_permissions rp on rp.role_id=ur.role_id
      where s.token_hash=$1 and s.expires_at>now()
      group by u.id,u.email,u.full_name,m.organisation_id,o.name`, [hashToken(token)],
  );
  return result.rows[0] || null;
}
function requirePermission(user, permission) {
  if (!user) throw Object.assign(new Error('Authentication required'), { status: 401 });
  if (!user.permissions?.includes('*') && !user.permissions?.includes(permission)) throw Object.assign(new Error('Permission denied'), { status: 403 });
}
async function route(req, res) {
  const url = new URL(req.url, 'http://localhost');
  if (req.method === 'GET' && url.pathname === '/api/health') return json(res, 200, { status: 'ok' });
  if (req.method === 'GET' && !url.pathname.startsWith('/api/')) return serveStatic(res,url.pathname);
  if (req.method === 'POST' && url.pathname === '/api/auth/login') {
    const data = await body(req);
    const email = requiredString(data.email, 'Email', 320).toLowerCase();
    if (typeof data.password !== 'string' || data.password.length < 1 || data.password.length > 200) throw Object.assign(new Error('Password is required'), { status: 400 });
    const password = data.password;
    const found = await pool.query(
      `select u.id,u.password_hash,u.full_name,u.email,m.organisation_id
         from users u join memberships m on m.user_id=u.id and m.is_active
        where lower(u.email)=$1 and u.is_active order by m.created_at limit 1`, [email],
    );
    const user = found.rows[0];
    const [salt, expectedHex] = (user?.password_hash || '00:00').split(':');
    const actual = await scrypt(password, salt, 64);
    const expected = Buffer.from(expectedHex, 'hex');
    const valid = !!user && expected.length === actual.length && timingSafeEqual(expected, actual);
    if (!valid) {
      await pool.query(`insert into audit_log (user_id, action, record_type, record_id, ip, user_agent)
        values ($1,'login_failed','user',$2,$3,$4)`, [user?.id || null, email, req.socket.remoteAddress || null, req.headers['user-agent'] || null]);
      return json(res, 401, { error: 'Invalid email or password' });
    }
    const rawToken = randomBytes(32).toString('base64url');
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query('insert into sessions (user_id,token_hash,expires_at) values ($1,$2,now()+$3::interval)', [user.id, hashToken(rawToken), `${SESSION_DAYS} days`]);
      await audit(client, user.id, user.organisation_id, 'login', 'user', user.id, null, { email }, req);
      await client.query('commit');
    } catch (error) { await client.query('rollback'); throw error; } finally { client.release(); }
    return json(res, 200, { id: user.id, email: user.email, name: user.full_name }, { 'set-cookie': cookieHeader(rawToken, SESSION_DAYS * 86400) });
  }

  const user = await currentUser(req);
  req.user = user;
  if (req.method === 'GET' && url.pathname === '/api/auth/me') {
    if (!user) return json(res, 401, { error: 'Authentication required' });
    return json(res, 200, { id: user.id, email: user.email, name: user.full_name, organisation: { id: user.organisation_id, name: user.organisation_name }, permissions: user.permissions || [] });
  }
  if (req.method === 'POST' && url.pathname === '/api/auth/logout') {
    if (!user) { res.writeHead(204, { 'set-cookie': cookieHeader('', 0), 'cache-control': 'no-store' }); return res.end(); }
    const token = parseCookies(req.headers.cookie).gh_session;
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query('delete from sessions where token_hash=$1', [hashToken(token)]);
      await audit(client, user.id, user.organisation_id, 'logout', 'user', user.id, null, null, req);
      await client.query('commit');
    } catch (error) { await client.query('rollback'); throw error; } finally { client.release(); }
    res.writeHead(204, { 'set-cookie': cookieHeader('', 0), 'cache-control': 'no-store' }); return res.end();
  }

  if (req.method === 'GET' && url.pathname === '/api/organisation') {
    requirePermission(user, 'organisation.view');
    const result = await pool.query('select id,name,base_currency,financial_year_start_month from organisations where id=$1', [user.organisation_id]);
    return json(res, 200, result.rows[0]);
  }
  if (req.method === 'GET' && url.pathname === '/api/accounts') {
    requirePermission(user, 'finance.account.view');
    const result = await pool.query('select id,name,kind,currency from accounts where organisation_id=$1 and deleted_at is null order by name', [user.organisation_id]);
    return json(res, 200, result.rows);
  }
  if (req.method === 'POST' && url.pathname === '/api/accounts') {
    requirePermission(user, 'finance.account.create');
    const data = await body(req); const name = requiredString(data.name, 'Account name');
    const kind = requiredString(data.kind, 'Account kind'); const currency = requiredString(data.currency || 'UGX', 'Currency', 3).toUpperCase();
    if (!['Cash','Bank','Mobile money'].includes(kind) || !/^[A-Z]{3}$/.test(currency)) throw Object.assign(new Error('Invalid account kind or currency'), { status: 400 });
    return withAudit(req, res, { action: 'create', type: 'account' }, async client => {
      const result = await client.query('insert into accounts (organisation_id,name,kind,currency,created_by) values ($1,$2,$3,$4,$5) returning id,name,kind,currency', [user.organisation_id,name,kind,currency,user.id]);
      return { id: result.rows[0].id, response: result.rows[0], auditValue: result.rows[0] };
    });
  }
  if (req.method === 'GET' && url.pathname === '/api/exchange-rates') {
    requirePermission(user, 'finance.rate.view');
    const result = await pool.query('select id,from_currency,to_currency,rate,rate_date,source from exchange_rates where organisation_id=$1 order by rate_date desc,created_at desc limit 200', [user.organisation_id]);
    return json(res, 200, result.rows);
  }
  if (req.method === 'POST' && url.pathname === '/api/exchange-rates') {
    requirePermission(user, 'finance.rate.create');
    const data = await body(req); const from = requiredString(data.fromCurrency, 'Source currency', 3).toUpperCase();
    const to = requiredString(data.toCurrency || 'UGX', 'Target currency', 3).toUpperCase(); const rate = Number(data.rate);
    if (!/^[A-Z]{3}$/.test(from) || !/^[A-Z]{3}$/.test(to) || !Number.isFinite(rate) || rate <= 0) throw Object.assign(new Error('Invalid currency or rate'), { status: 400 });
    const rateDate = validDate(data.rateDate, 'Rate date'); const source = data.source == null ? null : requiredString(data.source, 'Rate source', 250);
    return withAudit(req,res,{action:'create',type:'exchange_rate'},async client=>{
      const result=await client.query('insert into exchange_rates (organisation_id,from_currency,to_currency,rate,rate_date,source,entered_by) values ($1,$2,$3,$4,$5,$6,$7) returning id,from_currency,to_currency,rate,rate_date,source',[user.organisation_id,from,to,rate,rateDate,source,user.id]);
      return {id:result.rows[0].id,response:result.rows[0],auditValue:result.rows[0]};
    });
  }
  if (req.method === 'GET' && url.pathname === '/api/transactions') {
    requirePermission(user, 'finance.transaction.view');
    const result = await pool.query(`select t.id,t.txn_date,t.direction,t.description,t.original_minor,t.currency,t.exchange_rate,t.exchange_rate_id,t.amount_ugx,t.account_id,a.name as account_name,t.project_id,p.name as project_name,t.phase,t.evidence
      from transactions t left join accounts a on a.id=t.account_id and a.organisation_id=t.organisation_id
      left join projects p on p.id=t.project_id and p.organisation_id=t.organisation_id
      where t.organisation_id=$1 and t.deleted_at is null order by t.txn_date desc,t.created_at desc limit 500`, [user.organisation_id]);
    return json(res, 200, result.rows);
  }
  if (req.method === 'POST' && url.pathname === '/api/transactions') {
    requirePermission(user, 'finance.transaction.create');
    const data = await body(req); const direction = requiredString(data.direction, 'Direction');
    if (!['in','out'].includes(direction)) throw Object.assign(new Error('Direction must be in or out'), { status: 400 });
    const description = requiredString(data.description, 'Description', 1000); const currency = requiredString(data.currency, 'Currency', 3).toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) throw Object.assign(new Error('Invalid currency'), { status: 400 });
    const originalMinor = positiveInteger(data.originalMinor, 'Original amount'); const txnDate = validDate(data.date, 'Date');
    const accountId = data.accountId ? requiredString(data.accountId, 'Account ID', 50) : null;
    const projectId = data.projectId ? requiredString(data.projectId,'Project ID',50) : null;
    const phase = data.phase == null ? null : Number(data.phase);
    if (phase !== null && (!Number.isInteger(phase) || phase < 1 || phase > 9)) throw Object.assign(new Error('Phase must be between 1 and 9'), { status: 400 });
    const evidence = data.evidence == null ? null : requiredString(data.evidence,'Evidence',1000);
    let rate = 1; let rateId = null;
    if (currency !== 'UGX') {
      rateId = requiredString(data.exchangeRateId, 'Exchange rate');
      const rateResult = await pool.query('select id,rate from exchange_rates where id=$1 and organisation_id=$2 and from_currency=$3 and to_currency=$4', [rateId,user.organisation_id,currency,'UGX']);
      if (!rateResult.rowCount) throw Object.assign(new Error('Exchange rate not found for this organisation and currency'), { status: 400 });
      rate = Number(rateResult.rows[0].rate);
    }
    const amountUgx = currency === 'UGX' ? originalMinor : Math.round((originalMinor / minorUnitScale(currency)) * rate);
    if (!Number.isSafeInteger(amountUgx) || amountUgx <= 0) throw Object.assign(new Error('Converted amount is outside the supported range'), { status: 400 });
    return withAudit(req,res,{action:'create',type:'transaction'},async client=>{
      const result=await client.query(
        `insert into transactions (organisation_id,txn_date,direction,description,original_minor,currency,exchange_rate,exchange_rate_id,amount_ugx,account_id,project_id,phase,evidence,created_by)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         returning id,txn_date,direction,description,original_minor,currency,exchange_rate,exchange_rate_id,amount_ugx,account_id,project_id,phase,evidence`,
        [user.organisation_id,txnDate,direction,description,originalMinor,currency,rate,rateId,amountUgx,accountId,projectId,phase,evidence,user.id],
      );
      return {id:result.rows[0].id,response:result.rows[0],auditValue:result.rows[0]};
    });
  }
  if (req.method === 'GET' && url.pathname === '/api/projects') {
    requirePermission(user, 'project.view');
    const result = await pool.query(`select p.id,p.name,p.status,p.budget_ugx,p.forecast_revenue_ugx,p.main_risk,p.next_milestone,p.milestone_date,p.photo_key,d.name as department_name,l.name as location_name
      from projects p left join departments d on d.id=p.department_id and d.organisation_id=p.organisation_id
      left join locations l on l.id=p.location_id and l.organisation_id=p.organisation_id
      where p.organisation_id=$1 and p.deleted_at is null order by p.created_at desc`, [user.organisation_id]);
    const projects = await Promise.all(result.rows.map(async project => ({ ...project, photo_url: project.photo_key && s3 && process.env.AWS_BUCKET ? await getSignedUrl(s3, new GetObjectCommand({ Bucket: process.env.AWS_BUCKET, Key: project.photo_key }), { expiresIn: 600 }) : null })));
    return json(res, 200, projects);
  }
  if (req.method === 'POST' && url.pathname === '/api/projects') {
    requirePermission(user, 'project.create');
    const data = await body(req); const name = requiredString(data.name, 'Project name');
    const status = data.status || 'Planned';
    if (!['Planned','Active','Completed'].includes(status)) throw Object.assign(new Error('Invalid project status'), { status: 400 });
    const budget = Number(data.budgetUgx || 0); const forecast = Number(data.forecastRevenueUgx || 0);
    if (!Number.isSafeInteger(budget) || budget < 0 || !Number.isSafeInteger(forecast) || forecast < 0) throw Object.assign(new Error('Budget and forecast must be non-negative whole UGX amounts'), { status: 400 });
    const milestoneDate = data.milestoneDate ? validDate(data.milestoneDate, 'Milestone date') : null;
    const risk = data.mainRisk ? requiredString(data.mainRisk,'Main risk',1000) : null;
    const milestone = data.nextMilestone ? requiredString(data.nextMilestone,'Next milestone',200) : null;
    const departmentId = data.departmentId ? requiredString(data.departmentId,'Department ID',50) : null;
    const locationId = data.locationId ? requiredString(data.locationId,'Location ID',50) : null;
    const photoKey = data.photoKey || null;
    if (photoKey && !photoKey.startsWith(`organisations/${user.organisation_id}/`)) throw Object.assign(new Error('Invalid project image'), { status: 400 });
    return withAudit(req,res,{action:'create',type:'project'},async client=>{
      const result=await client.query(`insert into projects (organisation_id,name,status,budget_ugx,forecast_revenue_ugx,main_risk,next_milestone,milestone_date,photo_key,department_id,location_id)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning id,name,status,budget_ugx,forecast_revenue_ugx,main_risk,next_milestone,milestone_date,photo_key,department_id,location_id`,
        [user.organisation_id,name,status,budget,forecast,risk,milestone,milestoneDate,photoKey,departmentId,locationId]);
      return {id:result.rows[0].id,response:result.rows[0],auditValue:result.rows[0]};
    });
  }
  if (req.method === 'GET' && url.pathname === '/api/contributions') {
    requirePermission(user,'finance.contribution.view');
    const result=await pool.query(`select id,txn_date,original_minor,currency,exchange_rate,exchange_rate_id,amount_ugx,planned_ugx,phase,account_id
      from founder_contributions where organisation_id=$1 and deleted_at is null order by txn_date desc,created_at desc limit 500`,[user.organisation_id]);
    return json(res,200,result.rows);
  }
  if (req.method === 'POST' && url.pathname === '/api/contributions') {
    requirePermission(user,'finance.contribution.create');
    const data=await body(req); const currency=requiredString(data.currency,'Currency',3).toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) throw Object.assign(new Error('Invalid currency'),{status:400});
    const originalMinor=positiveInteger(data.originalMinor,'Contribution amount'); const txnDate=validDate(data.date,'Date');
    let rate=1; let rateId=null;
    if(currency!=='UGX'){
      rateId=requiredString(data.exchangeRateId,'Exchange rate');
      const found=await pool.query('select rate from exchange_rates where id=$1 and organisation_id=$2 and from_currency=$3 and to_currency=$4',[rateId,user.organisation_id,currency,'UGX']);
      if(!found.rowCount) throw Object.assign(new Error('Exchange rate not found for this organisation and currency'),{status:400});
      rate=Number(found.rows[0].rate);
    }
    const amountUgx=currency==='UGX'?originalMinor:Math.round(originalMinor/minorUnitScale(currency)*rate);
    const phase=data.phase==null?null:Number(data.phase); const planned=data.plannedUgx==null?null:Number(data.plannedUgx);
    if(!Number.isSafeInteger(amountUgx)||amountUgx<=0|| (phase!==null&&(!Number.isInteger(phase)||phase<0||phase>9)) || (planned!==null&&(!Number.isSafeInteger(planned)||planned<0))) throw Object.assign(new Error('Invalid contribution values'),{status:400});
    return withAudit(req,res,{action:'create',type:'founder_contribution'},async client=>{
      const result=await client.query(`insert into founder_contributions (organisation_id,txn_date,original_minor,currency,exchange_rate,exchange_rate_id,amount_ugx,planned_ugx,phase,account_id,created_by)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning id,txn_date,original_minor,currency,exchange_rate,exchange_rate_id,amount_ugx,planned_ugx,phase,account_id`,
        [user.organisation_id,txnDate,originalMinor,currency,rate,rateId,amountUgx,planned,phase,data.accountId||null,user.id]);
      return {id:result.rows[0].id,response:result.rows[0],auditValue:result.rows[0]};
    });
  }
  if (req.method === 'GET' && url.pathname === '/api/purchases') {
    requirePermission(user,'purchase.view');
    const result=await pool.query('select id,txn_date,name,category,quantity,cost_ugx,expected_benefit,proof from purchases where organisation_id=$1 and deleted_at is null order by txn_date desc,created_at desc limit 500',[user.organisation_id]);
    return json(res,200,result.rows);
  }
  if (req.method === 'POST' && url.pathname === '/api/purchases') {
    requirePermission(user,'purchase.create');
    const data=await body(req); const name=requiredString(data.name,'Item name'); const category=requiredString(data.category,'Category',80);
    const cost=Number(data.costUgx); if(!Number.isSafeInteger(cost)||cost<0) throw Object.assign(new Error('Cost must be a non-negative whole UGX amount'),{status:400});
    const txnDate=validDate(data.date,'Date'); const quantity=data.quantity?requiredString(data.quantity,'Quantity',120):null;
    const benefit=data.expectedBenefit?requiredString(data.expectedBenefit,'Expected benefit',1000):null; const proof=data.proof?requiredString(data.proof,'Proof',1000):null;
    return withAudit(req,res,{action:'create',type:'purchase'},async client=>{
      const result=await client.query(`insert into purchases (organisation_id,txn_date,name,category,quantity,cost_ugx,expected_benefit,proof,created_by)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id,txn_date,name,category,quantity,cost_ugx,expected_benefit,proof`,[user.organisation_id,txnDate,name,category,quantity,cost,benefit,proof,user.id]);
      return {id:result.rows[0].id,response:result.rows[0],auditValue:result.rows[0]};
    });
  }
  if (req.method === 'GET' && url.pathname === '/api/crop-cycles') {
    requirePermission(user,'crop.view');
    const result=await pool.query('select id,name,area,cost_ugx,harvest_quantity,revenue_ugx,started_on,(revenue_ugx-cost_ugx) as profit_ugx from crop_cycles where organisation_id=$1 and deleted_at is null order by started_on desc,created_at desc limit 500',[user.organisation_id]);
    return json(res,200,result.rows);
  }
  if (req.method === 'POST' && url.pathname === '/api/crop-cycles') {
    requirePermission(user,'crop.create');
    const data=await body(req); const name=requiredString(data.name,'Crop or block name'); const cost=Number(data.costUgx||0); const revenue=Number(data.revenueUgx||0);
    if(!Number.isSafeInteger(cost)||cost<0||!Number.isSafeInteger(revenue)||revenue<0) throw Object.assign(new Error('Cost and revenue must be non-negative whole UGX amounts'),{status:400});
    const area=data.area?requiredString(data.area,'Area',120):null; const harvest=data.harvestQuantity?requiredString(data.harvestQuantity,'Harvest quantity',120):null; const startedOn=validDate(data.startedOn||dateToday(),'Start date');
    return withAudit(req,res,{action:'create',type:'crop_cycle'},async client=>{
      const result=await client.query(`insert into crop_cycles (organisation_id,name,area,cost_ugx,harvest_quantity,revenue_ugx,started_on,created_by)
        values ($1,$2,$3,$4,$5,$6,$7,$8) returning id,name,area,cost_ugx,harvest_quantity,revenue_ugx,started_on,(revenue_ugx-cost_ugx) as profit_ugx`,
        [user.organisation_id,name,area,cost,harvest,revenue,startedOn,user.id]);
      return {id:result.rows[0].id,response:result.rows[0],auditValue:result.rows[0]};
    });
  }
  if (req.method === 'GET' && url.pathname === '/api/decisions') {
    requirePermission(user,'decision.view');
    const result=await pool.query('select id,decision_date,name,amount_ugx,reason,approver from investment_decisions where organisation_id=$1 and deleted_at is null order by decision_date desc,created_at desc limit 500',[user.organisation_id]);
    return json(res,200,result.rows);
  }
  if (req.method === 'POST' && url.pathname === '/api/decisions') {
    requirePermission(user,'decision.create');
    const data=await body(req); const name=requiredString(data.name,'Decision'); const amount=Number(data.amountUgx||0);
    if(!Number.isSafeInteger(amount)||amount<0) throw Object.assign(new Error('Amount must be a non-negative whole UGX amount'),{status:400});
    const decisionDate=validDate(data.date||dateToday(),'Date'); const reason=data.reason?requiredString(data.reason,'Reason',2000):null; const approver=data.approver?requiredString(data.approver,'Approver',200):null;
    return withAudit(req,res,{action:'create',type:'investment_decision'},async client=>{
      const result=await client.query(`insert into investment_decisions (organisation_id,decision_date,name,amount_ugx,reason,approver,created_by)
        values ($1,$2,$3,$4,$5,$6,$7) returning id,decision_date,name,amount_ugx,reason,approver`,[user.organisation_id,decisionDate,name,amount,reason,approver,user.id]);
      return {id:result.rows[0].id,response:result.rows[0],auditValue:result.rows[0]};
    });
  }
  if (req.method === 'GET' && url.pathname === '/api/structure') {
    requirePermission(user,'structure.view');
    const [departments,locations]=await Promise.all([
      pool.query('select id,name from departments where organisation_id=$1 order by name',[user.organisation_id]),
      pool.query('select id,name,size_note from locations where organisation_id=$1 order by name',[user.organisation_id]),
    ]);
    return json(res,200,{departments:departments.rows,locations:locations.rows});
  }
  if (req.method === 'POST' && ['/api/departments','/api/locations'].includes(url.pathname)) {
    requirePermission(user,'structure.create');
    const data=await body(req); const name=requiredString(data.name,'Name');
    const isLocation=url.pathname==='/api/locations'; const note=isLocation&&data.sizeNote?requiredString(data.sizeNote,'Location notes',500):null;
    const type=isLocation?'location':'department';
    return withAudit(req,res,{action:'create',type},async client=>{
      const result=await client.query(isLocation
        ? 'insert into locations (organisation_id,name,size_note) values ($1,$2,$3) returning id,name,size_note'
        : 'insert into departments (organisation_id,name) values ($1,$2) returning id,name',
        isLocation?[user.organisation_id,name,note]:[user.organisation_id,name]);
      return {id:result.rows[0].id,response:result.rows[0],auditValue:result.rows[0]};
    });
  }
  if (req.method === 'GET' && url.pathname === '/api/people') {
    requirePermission(user,'people.view');
    const result=await pool.query(`select p.id,p.full_name,p.job_title,p.email,p.phone,p.start_date,p.status,p.notes,p.department_id,d.name as department_name
      from employees p left join departments d on d.id=p.department_id and d.organisation_id=p.organisation_id
      where p.organisation_id=$1 order by p.status='Inactive',p.full_name`,[user.organisation_id]);
    return json(res,200,result.rows);
  }
  if (req.method === 'POST' && url.pathname === '/api/people') {
    requirePermission(user,'people.create');
    const data=await body(req); const name=requiredString(data.fullName,'Full name');
    const title=data.jobTitle?requiredString(data.jobTitle,'Job title',150):null;
    const email=data.email?requiredString(data.email,'Email',320).toLowerCase():null;
    if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Object.assign(new Error('Enter a valid email address'),{status:400});
    const phone=data.phone?requiredString(data.phone,'Phone',50):null;
    const startDate=data.startDate?validDate(data.startDate,'Start date'):null;
    const status=data.status||'Active';
    if(!['Active','On leave','Inactive'].includes(status)) throw Object.assign(new Error('Choose a valid employment status'),{status:400});
    const departmentId=data.departmentId||null;
    const notes=data.notes?requiredString(data.notes,'Notes',1000):null;
    return withAudit(req,res,{action:'create',type:'employee'},async client=>{
      const result=await client.query(`insert into employees (organisation_id,full_name,job_title,email,phone,start_date,status,department_id,notes,created_by)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id,full_name,job_title,email,phone,start_date,status,department_id,notes`,
        [user.organisation_id,name,title,email,phone,startDate,status,departmentId,notes,user.id]);
      const row=result.rows[0];
      if(row.department_id){const department=await client.query('select name from departments where id=$1 and organisation_id=$2',[row.department_id,user.organisation_id]);row.department_name=department.rows[0]?.name||null;}
      return {id:row.id,response:row,auditValue:row};
    });
  }
  if (req.method === 'GET' && url.pathname === '/api/assets') {
    requirePermission(user,'asset.view');
    const result=await pool.query(`select a.id,a.name,a.category,a.asset_tag,a.acquired_on,a.cost_ugx,a.status,a.notes,a.location_id,l.name as location_name,
      a.assigned_to,e.full_name as assigned_to_name from assets a
      left join locations l on l.id=a.location_id and l.organisation_id=a.organisation_id
      left join employees e on e.id=a.assigned_to and e.organisation_id=a.organisation_id
      where a.organisation_id=$1 order by a.status='Retired',a.name`,[user.organisation_id]);
    return json(res,200,result.rows);
  }
  if (req.method === 'POST' && url.pathname === '/api/assets') {
    requirePermission(user,'asset.create');
    const data=await body(req); const name=requiredString(data.name,'Asset name');
    const category=data.category?requiredString(data.category,'Category',100):'Equipment';
    const assetTag=data.assetTag?requiredString(data.assetTag,'Asset tag',100):null;
    const acquiredOn=data.acquiredOn?validDate(data.acquiredOn,'Acquisition date'):null;
    const cost=Number(data.costUgx||0);
    if(!Number.isSafeInteger(cost)||cost<0) throw Object.assign(new Error('Cost must be a non-negative whole UGX amount'),{status:400});
    const status=data.status||'In use';
    if(!['In use','Maintenance','Retired'].includes(status)) throw Object.assign(new Error('Choose a valid asset status'),{status:400});
    const locationId=data.locationId||null; const assignedTo=data.assignedTo||null;
    const notes=data.notes?requiredString(data.notes,'Notes',1000):null;
    return withAudit(req,res,{action:'create',type:'asset'},async client=>{
      const result=await client.query(`insert into assets (organisation_id,name,category,asset_tag,acquired_on,cost_ugx,status,location_id,assigned_to,notes,created_by)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning id,name,category,asset_tag,acquired_on,cost_ugx,status,location_id,assigned_to,notes`,
        [user.organisation_id,name,category,assetTag,acquiredOn,cost,status,locationId,assignedTo,notes,user.id]);
      const row=result.rows[0];
      if(row.location_id){const location=await client.query('select name from locations where id=$1 and organisation_id=$2',[row.location_id,user.organisation_id]);row.location_name=location.rows[0]?.name||null;}
      if(row.assigned_to){const person=await client.query('select full_name from employees where id=$1 and organisation_id=$2',[row.assigned_to,user.organisation_id]);row.assigned_to_name=person.rows[0]?.full_name||null;}
      return {id:row.id,response:row,auditValue:row};
    });
  }
  if (req.method === 'GET' && url.pathname === '/api/audit') {
    requirePermission(user,'audit.view');
    const result=await pool.query(`select a.id,a.at,a.action,a.record_type,a.record_id,a.old_value,a.new_value,a.ip,a.user_agent,u.full_name as actor
      from audit_log a left join users u on u.id=a.user_id where a.organisation_id=$1 order by a.at desc limit 200`,[user.organisation_id]);
    return json(res,200,result.rows);
  }
  if (req.method === 'POST' && url.pathname === '/api/uploads/presign') {
    requirePermission(user, 'documents.upload');
    if (!s3 || !process.env.AWS_BUCKET) throw Object.assign(new Error('Picture storage is not configured'), { status: 503 });
    const data = await body(req);
    if (!imageTypes.has(data.contentType)) throw Object.assign(new Error('Use a JPG, PNG, WebP, or AVIF picture'), { status: 400 });
    if (!Number.isSafeInteger(data.size) || data.size <= 0 || data.size > 8 * 1024 * 1024) throw Object.assign(new Error('Picture must be smaller than 8 MB'), { status: 400 });
    const key = `organisations/${user.organisation_id}/${randomUUID()}`;
    const signed = await createPresignedPost(s3, {
      Bucket: process.env.AWS_BUCKET,
      Key: key,
      Expires: 300,
      Fields: { 'Content-Type': data.contentType },
      Conditions: [['content-length-range',1,8*1024*1024],['eq','$Content-Type',data.contentType]],
    });
    return json(res, 200, { key, uploadUrl: signed.url, fields: signed.fields, method: 'POST', expiresIn: 300 });
  }
  return json(res, 404, { error: 'Not found' });
}

export async function handler(req, res) {
  try {
    initialization ||= initialize();
    await initialization;
    await route(req, res);
  }
  catch (error) {
    if (res.headersSent) return res.destroy(error);
    const status = Number(error.status) || (error.code === '23505' ? 409 : error.code === '23503' ? 400 : 500);
    if (status >= 500) console.error(error);
    json(res, status, { error: status >= 500 ? 'Internal server error' : error.message });
  }
}

let initialization;
async function initialize() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
  await pool.query('select 1');
  await bootstrapOwner();
}

const server = (await import('node:http')).createServer(handler);

async function bootstrapOwner() {
  const email = process.env.OWNER_EMAIL?.trim().toLowerCase(); const password = process.env.OWNER_PASSWORD;
  const name = process.env.OWNER_NAME?.trim() || 'Owner'; const organisation = process.env.ORGANISATION_NAME?.trim() || 'Green Harvest Uganda Ltd';
  if (!email && !password) return;
  if (!email || !password || password.length < 12) throw new Error('Set OWNER_EMAIL and OWNER_PASSWORD (at least 12 characters) together for first-owner setup.');
  const exists = await pool.query('select 1 from users where lower(email)=$1', [email]);
  if (exists.rowCount) return;
  const client=await pool.connect();
  try {
    await client.query('begin');
    const salt=randomBytes(16).toString('hex'); const key=await scrypt(password,salt,64);
    const org=(await client.query('insert into organisations (name) values ($1) returning id',[organisation])).rows[0];
    const user=(await client.query('insert into users (email,full_name,password_hash) values ($1,$2,$3) returning id',[email,name,`${salt}:${key.toString('hex')}`])).rows[0];
    const role=(await client.query("insert into roles (organisation_id,name) values ($1,'Owner') returning id",[org.id])).rows[0];
    await client.query('insert into role_permissions (role_id,permission_code) select $1,code from permissions',[role.id]);
    await client.query('insert into memberships (user_id,organisation_id) values ($1,$2)',[user.id,org.id]);
    await client.query('insert into user_roles (user_id,role_id,organisation_id) values ($1,$2,$3)',[user.id,role.id,org.id]);
    await client.query('insert into audit_log (user_id,organisation_id,action,record_type,record_id,new_value) values ($1,$2,$3,$4,$5,$6)',[user.id,org.id,'owner_bootstrap','organisation',org.id,{name:organisation,email}]);
    await client.query('commit');
    console.log(`Created initial owner ${email} for ${organisation}`);
  } catch(error) { await client.query('rollback'); throw error; } finally { client.release(); }
}

async function start() {
  initialization ||= initialize();
  await initialization;
  server.listen(port, () => console.log(`Green Harvest API listening on port ${port}`));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  start().catch(error => { console.error(error); process.exit(1); });
}
