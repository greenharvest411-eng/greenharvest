// Green Harvest Management System - application logic.
// All data access goes through the Store adapter (js/store.js).
const PH=["Land / lease","Land preparation","Seeds / nursery","Planting","Crop maintenance","Labour / protection","Harvesting","Transport / marketing","Reinvestment / expansion"];
const TABS=[["dash","Dashboard"],["proj","Projects"],["txn","Transactions"],["contrib","Contributions"],["rate","Rates"],["org","Structure"],["buy","Purchases"],["crop","Crops"],["dec","Decisions"],["audit","Audit"]];
let tab="dash",E=[],A=[],aud,S={target:500000,phases:{}},col,sdoc,usr,names={},me="";
const $=s=>document.querySelector(s);
const fmt=n=>"UGX "+Math.round(+n||0).toLocaleString("en-US");
const el=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e};
const of=t=>E.filter(e=>e.type===t).sort((a,b)=>(b.date||"").localeCompare(a.date||""));
const today=()=>new Date().toISOString().slice(0,10);
async function init(){
  renderNav();
  let db=Store.db;usr=Store.user;
  if(!db){$("#app").replaceChildren(el("div","msg","Storage is not available in this browser."));return}
  try{me=await usr.id()}catch(e){}
  col=db.collection("entries");sdoc=db.doc("settings/main");aud=db.collection("audit");aud.onSnapshot(s=>{A=s.docs.map(d=>({id:d.id,...d.data()}));render()},()=>{});
  const t=setTimeout(()=>{if(!E.length)render()},10000);
  col.onSnapshot(async s=>{clearTimeout(t);E=s.docs.map(d=>({id:d.id,...d.data()}));
    try{const ids=[...new Set(E.map(e=>e.by).filter(Boolean))];if(usr&&ids.length)names=await usr.profiles(ids)}catch(e){}
    render()},()=>render());
  sdoc.onSnapshot(s=>{if(s.exists)S={...S,...s.data()};render()},()=>{});
}
function renderNav(){const n=$("#nav");n.replaceChildren();TABS.forEach(([k,l])=>{const b=el("button",k===tab?"on":"",l);b.onclick=()=>{tab=k;renderNav();render()};n.append(b)})}
const nm=e=>{const p=names[e.by];return(p&&p.name)||"Someone"};
function totals(){
  const contrib=of("contrib").reduce((a,e)=>a+e.amount,0);
  const tin=of("txn").filter(e=>e.dir==="in").reduce((a,e)=>a+e.amount,0);
  const tout=of("txn").filter(e=>e.dir==="out").reduce((a,e)=>a+e.amount,0);
  return{added:contrib+tin,spent:tout,held:contrib+tin-tout,contrib};
}
function phaseStats(i){
  const t=of("txn").filter(e=>+e.phase===i);
  const saved=t.filter(e=>e.dir==="in").reduce((a,e)=>a+e.amount,0)+of("contrib").filter(e=>+e.phase===i).reduce((a,e)=>a+e.amount,0);
  const spent=t.filter(e=>e.dir==="out").reduce((a,e)=>a+e.amount,0);
  return{saved,spent,bal:saved-spent,target:+(S.phases||{})[i]||0};
}
function fld(form,label,type,id,opts){
  form.append(el("label","",label));let i;
  if(type==="select"){i=el("select");opts.forEach(([v,t])=>{const o=el("option","",t);o.value=v;i.append(o)})}
  else if(type==="area"){i=el("textarea");i.rows=2}else{i=el("input");i.type=type;if(type==="number"){i.inputMode="decimal";i.step="any"}}
  i.id=id;form.append(i);return i}
async function save(obj){obj.by=me;try{await col.doc("e"+Date.now()+Math.random().toString(36).slice(2,6)).set(obj);log("added",obj)}catch(e){alert("Could not save: "+(e.message||e.code))}}
async function del(e){if(!confirm("Delete this entry?"))return;try{await col.doc(e.id).delete();log("deleted",e)}catch(x){alert("Only an editor or owner can delete entries.")}}
function list(items,line){
  const c=el("div","card");if(!items.length){c.append(el("small","","Nothing recorded yet."));return c}
  items.forEach(e=>{const r=el("div","row"),l=el("div"),rt=el("div");const [a,b,cls]=line(e);
    l.append(el("div","",a),el("small","",b+" · by "+nm(e)));rt.style.textAlign="right";
    const m=el("div",cls||"",""+(e._r||""));m.textContent=e._r||"";rt.append(m);if(!e._nodel){const x=el("button","x","delete");x.onclick=()=>del(e);rt.append(x)}r.append(l,rt);c.append(r)});return c}
function formCard(title,build,onSave){
  const c=el("div","card");c.append(el("h2","",title));build(c);
  const b=el("button","btn","Save entry");b.onclick=()=>onSave(c);c.append(b);return c}
const v=id=>$("#"+id).value, n=id=>Math.max(0,+v(id)||0);
function render(){
  const a=$("#app");a.replaceChildren();
  if(!col){return}
  if(tab==="dash")dash(a);
  if(tab==="contrib")contrib(a);
  if(tab==="txn")txn(a);
  if(tab==="buy")buy(a);
  if(tab==="crop")crop(a);
  if(tab==="dec")dec(a);
  if(tab==="proj")proj(a);
  if(tab==="org")org(a);
  if(tab==="rate")rate(a);
  if(tab==="audit")audit(a);
}
function dash(a){
  const t=totals(),g=el("div","grid card");
  [["Capital added",fmt(t.added)],["Capital spent",fmt(t.spent)],["Capital held",fmt(t.held)],["Founder contributions",fmt(t.contrib)]].forEach(([k,x])=>{const d=el("div","kpi");d.append(el("small","",k),el("b","",x));g.append(d)});
  a.append(g);
  const c=el("div","card");c.append(el("h2","","Investment phases"));
  PH.forEach((p,i)=>{const s=phaseStats(i+1),pc=s.target?Math.min(100,s.saved/s.target*100):0;
    const r=el("div");r.style.marginBottom="12px";r.append(el("div","",(i+1)+". "+p));
    r.append(el("small","rule","Saved "+fmt(s.saved)+" · Spent "+fmt(s.spent)+" · Balance "+fmt(s.bal)+(s.target?" · Target "+fmt(s.target):"")));
    const b=el("div","bar"),f=el("i");f.style.width=pc+"%";b.append(f);r.append(b);
    const ti=el("input");ti.type="number";ti.inputMode="numeric";ti.placeholder="Set target (UGX)";ti.style.marginTop="6px";
    ti.onchange=()=>{const ph={...(S.phases||{})};ph[i+1]=Math.max(0,+ti.value||0);S.phases=ph;sdoc.set({target:S.target,phases:ph}).catch(()=>alert("Only an editor or owner can set targets."))};
    r.append(ti);c.append(r)});
  a.append(c);
  const rc=el("div","card");rc.append(el("h2","","Founder rules"));
  ["Treat the monthly target as Green Harvest capital.","Accumulate money when the next phase is not yet fully funded.","Every expense needs a purpose, date, amount and evidence.","Keep personal money separate from Green Harvest money.","Expand only when the previous stage is profitable and ready."].forEach(x=>rc.append(el("div","rule","• "+x)));
  a.append(rc);
}
function contrib(a){
  const target=S.target;
  const mons=Array.from({length:12},(_,i)=>[i+1,"Month "+(i+1)]);
  a.append(formCard("Record a monthly contribution",c=>{
    fld(c,"Month","select","c_m",mons);fld(c,"Planned (UGX)","number","c_p").value=target;fld(c,"Currency","select","c_cu",[["AED","AED"],["UGX","UGX"]]);fld(c,"Actual amount","number","c_a");fld(c,"UGX per 1 AED (AED only)","number","c_rt").value=latestRate();
    fld(c,"Phase / purpose","select","c_ph",[["0","Held / unassigned"],...PH.map((p,i)=>[i+1,p])]);fld(c,"Account / location","text","c_l");
  },()=>{if(!n("c_a"))return alert("Enter the actual amount.");const cu=v("c_cu"),rt=cu==="UGX"?1:n("c_rt");if(!rt)return alert("Enter the AED exchange rate.");save({type:"contrib",date:today(),month:+v("c_m"),planned:n("c_p"),amount:Math.round(n("c_a")*rt),orig:n("c_a"),cur:cu,rate:rt,phase:+v("c_ph"),acct:v("c_l")})}));
  const tc=el("div","card");tc.append(el("h2","","Monthly target"));const ti=fld(tc,"Planned monthly contribution (UGX)","number","c_t");ti.value=target;
  ti.onchange=()=>{S.target=Math.max(0,+ti.value||0);sdoc.set({target:S.target,phases:S.phases||{}}).catch(()=>alert("Only an editor or owner can change the target."))};a.append(tc);
  let cum=0;const asc=[...of("contrib")].reverse();asc.forEach(e=>{cum+=e.amount;e._cum=cum});
  of("contrib").forEach(e=>e._r=fmt(e.amount));
  a.append(list(of("contrib"),e=>["Month "+e.month+" · planned "+fmt(e.planned),e.date+" · cumulative "+fmt(e._cum)+(e.acct?" · "+e.acct:"")+(e.phase?" · "+PH[e.phase-1]:""),"in"]));
}
function txn(a){
  const t=totals();a.append(el("div","msg","Current balance: "+fmt(t.held)));
  a.append(formCard("Record a transaction",c=>{
    fld(c,"Date","date","t_d").value=today();fld(c,"Money","select","t_dir",[["out","Money out (spent)"],["in","Money in"]]);
    fld(c,"Description","text","t_s");fld(c,"Currency","select","t_cu",[["UGX","UGX"],["AED","AED"]]);fld(c,"Amount","number","t_a");fld(c,"UGX per 1 AED (AED entries only)","number","t_rt").value=latestRate();fld(c,"Account","select","t_ac",opts("acct"));fld(c,"Project","select","t_pj",opts("proj"));
    fld(c,"Phase","select","t_ph",PH.map((p,i)=>[i+1,p]));fld(c,"Evidence (receipt no. / note)","text","t_e");
  },()=>{const orig=n("t_a"),cu=v("t_cu"),rt=cu==="UGX"?1:n("t_rt"),amt=Math.round(orig*rt),dir=v("t_dir"),ph=+v("t_ph");if(!rt)return alert("Enter the AED exchange rate.");if(!amt||!v("t_s"))return alert("Add a description and an amount.");
    if(!v("t_e")&&!confirm("No evidence recorded. Every expense should have a receipt or payment proof. Save anyway?"))return;
    if(dir==="out"){const s=phaseStats(ph);if(amt>s.bal&&!confirm("Phase "+ph+" only has "+fmt(Math.max(0,s.bal))+" saved. Spending "+fmt(amt)+" goes beyond what is funded. Continue?"))return}
    const pj=v("t_pj"),P=E.find(x=>x.id===pj);if(dir==="out"&&P&&P.budget){const sp=of("txn").filter(x=>x.proj===pj&&x.dir==="out").reduce((s,x)=>s+x.amount,0);if(sp+amt>P.budget&&!confirm("This takes project "+P.name+" over its budget of "+fmt(P.budget)+". Continue?"))return}save({type:"txn",date:v("t_d"),dir,desc:v("t_s"),amount:amt,orig,cur:cu,rate:rt,acct:v("t_ac"),proj:pj,phase:ph,evidence:v("t_e")})}));
  const items=of("txn");items.forEach(e=>e._r=(e.dir==="in"?"+":"−")+fmt(e.amount));
  a.append(list(items,e=>[e.desc,e.date+" · "+PH[e.phase-1]+(e.cur&&e.cur!=="UGX"?" · "+e.orig+" "+e.cur+" @ "+e.rate:"")+(e.proj?" · "+lab(e.proj):"")+(e.evidence?" · "+e.evidence:" · no evidence"),e.dir==="in"?"in":"out"]));
}
function buy(a){
  a.append(formCard("Record an asset / input purchase",c=>{
    fld(c,"Date","date","b_d").value=today();fld(c,"Asset / input","text","b_n");
    fld(c,"Category","select","b_c",[["Land","Land"],["Seeds","Seeds"],["Tools","Tools"],["Fertiliser","Fertiliser"],["Labour","Labour"],["Other","Other"]]);
    fld(c,"Quantity","text","b_q");fld(c,"Cost (UGX)","number","b_a");fld(c,"Expected benefit","text","b_b");fld(c,"Proof (receipt no.)","text","b_p");
  },()=>{if(!v("b_n")||!n("b_a"))return alert("Add the item and its cost.");save({type:"buy",date:v("b_d"),name:v("b_n"),cat:v("b_c"),qty:v("b_q"),amount:n("b_a"),benefit:v("b_b"),proof:v("b_p")})}));
  const items=of("buy");items.forEach(e=>e._r=fmt(e.amount));
  a.append(list(items,e=>[e.name+(e.qty?" × "+e.qty:""),e.date+" · "+e.cat+(e.benefit?" · "+e.benefit:"")+(e.proof?" · proof "+e.proof:""),"out"]));
}
function crop(a){
  a.append(formCard("Record a crop cycle",c=>{
    fld(c,"Crop / block","text","r_n");fld(c,"Area (e.g. 2 acres)","text","r_ar");fld(c,"Total cost (UGX)","number","r_c");
    fld(c,"Harvest quantity","text","r_q");fld(c,"Sales revenue (UGX)","number","r_r");
  },()=>{if(!v("r_n"))return alert("Name the crop or block.");save({type:"crop",date:today(),name:v("r_n"),area:v("r_ar"),cost:n("r_c"),qty:v("r_q"),rev:n("r_r")})}));
  const items=of("crop");items.forEach(e=>{e._p=e.rev-e.cost;e._roi=e.cost?e._p/e.cost*100:0;e._r=(e._p<0?"−":"")+fmt(Math.abs(e._p))});
  a.append(list(items,e=>[e.name+(e.area?" · "+e.area:""),"Cost "+fmt(e.cost)+" · Revenue "+fmt(e.rev)+" · ROI "+e._roi.toFixed(1)+"%"+(e.qty?" · harvest "+e.qty:""),e._p<0?"out":"in"]));
  a.append(el("div","rule","Profit = Sales revenue − Total cost · ROI % = Profit ÷ Total investment × 100"));
}
function dec(a){
  a.append(formCard("Log an investment decision",c=>{
    fld(c,"Date","date","d_d").value=today();fld(c,"Decision / investment","text","d_n");fld(c,"Amount (UGX)","number","d_a");
    fld(c,"Reason / expected return","area","d_r");fld(c,"Approved by","text","d_p");
  },()=>{if(!v("d_n"))return alert("Describe the decision.");save({type:"dec",date:v("d_d"),name:v("d_n"),amount:n("d_a"),reason:v("d_r"),approver:v("d_p")})}));
  const items=of("dec");items.forEach(e=>e._r=fmt(e.amount));
  a.append(list(items,e=>[e.name,e.date+(e.reason?" · "+e.reason:"")+" · approved by "+(e.approver||"—"),""]));
}
const lab=id=>(E.find(x=>x.id===id)||{}).name||"";
const opts=t=>[["","— none —"],...of(t).map(e=>[e.id,e.name])];
const latestRate=()=>{const r=of("rate")[0];return r?r.rate:""};
function log(act,o){aud.doc("a"+Date.now()+Math.random().toString(36).slice(2,6)).set({at:Date.now(),by:me,action:act,type:o.type||"",desc:(o.desc||o.name||o.reason||"")+(o.amount?" · "+fmt(o.amount):"")}).catch(()=>{})}
function quick(a,type,title,fields,line){
  a.append(formCard("Add "+title,c=>fields.forEach(([l,id,t,o])=>fld(c,l,t||"text","q_"+type+id,o)),()=>{
    const o={type,date:today()};fields.forEach(([l,id])=>o[id]=v("q_"+type+id));if(!o.name)return alert("Enter a name.");save(o)}));
  const items=of(type);items.forEach(e=>e._r="");
  a.append(list(items,e=>[e.name,line(e),""]));
}
function org(a){
  quick(a,"dept","department",[["Name","name"]],()=>"Department");
  quick(a,"loc","farm location",[["Name","name"],["Size / notes","note"]],e=>e.note||"Location");
  quick(a,"acct","account (recorded manually)",[["Name","name"],["Kind","kind","select",[["Cash","Cash"],["Bank","Bank"],["Mobile money","Mobile money"]]]],e=>e.kind+" · balance "+fmt(of("txn").filter(x=>x.acct===e.id).reduce((s,x)=>s+(x.dir==="in"?x.amount:-x.amount),0)));
}
function proj(a){
  a.append(formCard("Register a project",c=>{
    fld(c,"Project name","text","p_n");fld(c,"Department","select","p_d",opts("dept"));fld(c,"Location","select","p_l",opts("loc"));
    fld(c,"Budget (UGX)","number","p_b");fld(c,"Expected revenue (UGX)","number","p_r");fld(c,"Status","select","p_s",[["Planned","Planned"],["Active","Active"],["Completed","Completed"]]);
    fld(c,"Main risk","text","p_k");fld(c,"Next milestone","text","p_m");fld(c,"Milestone date","date","p_md");
  },()=>{if(!v("p_n"))return alert("Name the project.");save({type:"proj",date:today(),name:v("p_n"),dept:v("p_d"),loc:v("p_l"),budget:n("p_b"),forecast:n("p_r"),status:v("p_s"),risk:v("p_k"),mile:v("p_m"),miled:v("p_md")})}));
  const items=of("proj");
  items.forEach(e=>{const t=of("txn").filter(x=>x.proj===e.id);e._sp=t.filter(x=>x.dir==="out").reduce((s,x)=>s+x.amount,0);e._in=t.filter(x=>x.dir==="in").reduce((s,x)=>s+x.amount,0);e._r="Left "+fmt(e.budget-e._sp)});
  a.append(list(items,e=>[e.name+" · "+e.status,"Budget "+fmt(e.budget)+" · Spent "+fmt(e._sp)+" · Income "+fmt(e._in)+" · Forecast "+fmt(e.forecast)+(e.risk?" · Risk: "+e.risk:"")+(e.mile?" · Next: "+e.mile+(e.miled?" ("+e.miled+")":""):"")+(e.dept?" · "+lab(e.dept):"")+(e.loc?" · "+lab(e.loc):""),e.budget&&e._sp>e.budget?"out":""]));
}
function rate(a){
  a.append(el("div","msg","Latest: "+(latestRate()?"1 AED = "+latestRate()+" UGX":"no rate recorded yet")+". Every AED entry keeps the rate it used, so past figures never change."));
  a.append(formCard("Record an exchange rate",c=>{fld(c,"Date","date","x_d").value=today();fld(c,"UGX per 1 AED","number","x_r");fld(c,"Source (bank, statement…)","text","x_s")},()=>{if(!n("x_r"))return alert("Enter the rate.");save({type:"rate",date:v("x_d"),rate:n("x_r"),source:v("x_s"),desc:"AED rate "+n("x_r")})}));
  const items=of("rate");items.forEach(e=>e._r="1 AED = "+e.rate);
  a.append(list(items,e=>[e.date,"Source: "+(e.source||"not stated"),""]));
}
function audit(a){
  const items=[...A].sort((x,y)=>y.at-x.at).slice(0,100);items.forEach(e=>{e._nodel=1;e._r=""});
  a.append(el("div","msg","Audit log: every record added or deleted is logged with who and when. Showing the latest 100."));
  a.append(list(items,e=>[e.action+" · "+(e.type||""),new Date(e.at).toLocaleString()+" · "+(e.desc||""),""]));
}
init();
