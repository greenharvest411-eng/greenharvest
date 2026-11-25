import { useCallback, useEffect, useState } from 'react';
import {
  Activity, ArrowDownLeft, ArrowRight, ArrowUpRight, BadgeCheck, Banknote, Building2,
  Check, ChevronDown, ChevronRight, CircleHelp, CloudUpload, Coins, CreditCard, FileText,
  FolderKanban, Globe2, ImagePlus, Leaf, LoaderCircle, LogOut, Menu, MoreHorizontal, Package, Pencil, Plus,
  Settings2, ShieldCheck, Sprout, Tractor, TrendingUp, Users, Wallet, X,
} from 'lucide-react';
import { api } from './api.js';

const navGroups = [
  { label: 'WORKSPACE', items: [
    { id: 'dashboard', title: 'Overview', icon: Activity },
    { id: 'projects', title: 'Projects', icon: FolderKanban },
    { id: 'finance', title: 'Finance', icon: Wallet },
  ] },
  { label: 'OPERATIONS', items: [
    { id: 'farm', title: 'Farm operations', icon: Sprout },
    { id: 'purchases', title: 'Purchases & stock', icon: PackageIcon },
    { id: 'people', title: 'People & assets', icon: Users },
  ] },
  { label: 'MANAGEMENT', items: [
    { id: 'decisions', title: 'Investment decisions', icon: BadgeCheck },
    { id: 'control', title: 'Audit log', icon: ShieldCheck },
    { id: 'settings', title: 'Company settings', icon: Settings2 },
  ] },
];
function PackageIcon(props) { return <CreditCard {...props} />; }
const currency = (value) => `UGX ${Math.round(Number(value) || 0).toLocaleString('en-US')}`;
const compactCurrency = (value) => {
  const amount = Number(value) || 0;
  if (Math.abs(amount) >= 1_000_000) return `UGX ${(amount / 1_000_000).toFixed(1)}m`;
  if (Math.abs(amount) >= 10_000) return `UGX ${(amount / 1_000).toFixed(0)}k`;
  return currency(amount);
};
const dateToday = () => new Date().toISOString().slice(0, 10);
const phaseNames = ['Land / lease', 'Land preparation', 'Seeds / nursery', 'Planting', 'Crop maintenance', 'Labour / protection', 'Harvesting', 'Transport / marketing', 'Reinvestment / expansion'];

export default function App() {
  const [user, setUser] = useState(null);
  const [organisation, setOrganisation] = useState(null);
  const [active, setActive] = useState('dashboard');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState({ accounts: [], rates: [], transactions: [], projects: [], contributions: [], purchases: [], crops: [], decisions: [], structure: { departments: [], locations: [] }, people: [], assets: [], audit: [] });
  const [modal, setModal] = useState('');
  const [editingRecord, setEditingRecord] = useState(null);
  const [saving, setSaving] = useState(false);
  const openModal = kind => { setEditingRecord(null); setModal(kind); };
  const openEdit = (kind, record) => { setEditingRecord({ kind, record }); setModal(kind); };
  const closeModal = () => { setModal(''); setEditingRecord(null); };

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const [org, accounts, rates, transactions, projects, contributions, purchases, crops, decisions, structure, people, assets, audit] = await Promise.all([
        api.organisation(), api.accounts(), api.rates(), api.transactions(), api.projects(), api.contributions(), api.purchases(), api.crops(), api.decisions(), api.structure(), api.people(), api.assets(), api.audit(),
      ]);
      setOrganisation(org);
      setData({ accounts, rates, transactions, projects, contributions, purchases, crops, decisions, structure, people, assets, audit });
      setError('');
    } catch (err) { setError(err.message); }
  }, [user]);

  useEffect(() => {
    api.me().then(setUser).catch(() => setUser(null)).finally(() => setBusy(false));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  async function signIn(email, password) {
    setBusy(true); setError('');
    try { setUser(await api.login(email, password)); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  async function signOut() {
    try { await api.logout(); } catch { /* Clear the local view even if the session expired. */ }
    setUser(null); setOrganisation(null); setData({ accounts: [], rates: [], transactions: [], projects: [], contributions: [], purchases: [], crops: [], decisions: [], structure: { departments: [], locations: [] }, people: [], assets: [], audit: [] });
  }
  async function submit(kind, value) {
    setSaving(true); setError('');
    try {
      if (kind === 'transaction') await api.createTransaction(value);
      if (kind === 'contribution') await api.createContribution(value);
      if (kind === 'account') await api.createAccount(value);
      if (kind === 'rate') await api.createRate(value);
      if (kind === 'project') await api.createProject(value);
      if (kind === 'purchase') await api.createPurchase(value);
      if (kind === 'crop') await api.createCrop(value);
      if (kind === 'decision') await api.createDecision(value);
      if (kind === 'department') await api.createDepartment(value);
      if (kind === 'location') await api.createLocation(value);
      if (kind === 'person') {
        if (editingRecord?.kind === 'person') await api.updatePerson(editingRecord.record.id, value);
        else await api.createPerson(value);
      }
      if (kind === 'asset') {
        if (editingRecord?.kind === 'asset') await api.updateAsset(editingRecord.record.id, value);
        else await api.createAsset(value);
      }
      closeModal(); await refresh();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  if (busy) return <FullLoading />;
  if (!user) return <Login onSubmit={signIn} busy={busy} error={error} />;

  const title = navGroups.flatMap(group => group.items).find(item => item.id === active)?.title || 'Overview';
  return (
    <div className="app-shell flex overflow-x-clip bg-[#f6f8f4] text-[#17291e]">
      <aside className={`${mobileOpen ? 'translate-x-0' : '-translate-x-full'} sidebar fixed inset-y-0 left-0 z-40 flex w-[min(268px,calc(100vw-2rem))] shrink-0 flex-col border-r border-[#e5eae3] bg-white transition-transform duration-200 md:static md:translate-x-0`}>
        <div className="flex h-[76px] items-center gap-3 border-b border-[#edf0eb] px-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-[#e8f3e8] text-[#287540]"><Leaf size={21} strokeWidth={2.1} /></div>
          <div className="min-w-0"><div className="truncate text-[14px] font-bold tracking-[-.02em]">Green Harvest</div><div className="mt-0.5 text-[11px] text-[#859187]">Management workspace</div></div>
          <button onClick={() => setMobileOpen(false)} className="ml-auto rounded-lg p-2 text-[#829085] hover:bg-[#f3f6f1] md:hidden" aria-label="Close menu"><X size={18} /></button>
        </div>
        <div className="border-b border-[#edf0eb] px-4 py-4">
          <button onClick={() => setActive('settings')} className="flex w-full items-center gap-3 rounded-xl border border-[#e9ede7] bg-[#fbfcfa] px-3 py-2.5 text-left">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#eaf2e8] text-[#56804f]"><Building2 size={16} /></div>
            <div className="min-w-0 flex-1"><div className="truncate text-xs font-semibold">{organisation?.name || 'Green Harvest Uganda Ltd'}</div><div className="mt-0.5 text-[10px] text-[#8c978e]">Primary organisation</div></div>
            <ChevronDown size={14} className="text-[#98a198]" />
          </button>
        </div>
        <nav className="scrollbar-hide flex-1 overflow-y-auto px-3 py-4">
          {navGroups.map(group => <div key={group.label} className="mb-6">
            <div className="mb-2 px-3 text-[9px] font-bold tracking-[.14em] text-[#a1aaa1]">{group.label}</div>
            <div className="space-y-1">{group.items.map(item => {
              const Icon = item.icon; const selected = active === item.id;
              return <button key={item.id} onClick={() => { setActive(item.id); setMobileOpen(false); }} className={`group flex w-full items-center gap-3 rounded-[10px] px-3 py-[10px] text-left text-[12px] font-medium transition ${selected ? 'bg-[#edf6ec] text-[#287540]' : 'text-[#68756b] hover:bg-[#f7f9f6] hover:text-[#263b2b]'}`}>
                <Icon size={16} strokeWidth={selected ? 2.2 : 1.8} /><span className="flex-1">{item.title}</span>
                {item.badge && <span className="rounded-full bg-[#f3f4f0] px-2 py-0.5 text-[9px] font-semibold text-[#9aa39a]">{item.badge}</span>}
              </button>;
            })}</div>
          </div>)}
        </nav>
        <div className="border-t border-[#edf0eb] p-3">
          <div className="mb-2 flex items-center gap-3 rounded-xl px-2 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#dcebdd] text-[11px] font-bold text-[#35734a]">{(user.name || user.email || 'O').slice(0, 1).toUpperCase()}</div>
            <div className="min-w-0 flex-1"><div className="truncate text-[11px] font-semibold">{user.name || 'Owner'}</div><div className="truncate text-[10px] text-[#929b92]">{user.email}</div></div>
            <button onClick={signOut} title="Sign out" className="rounded-lg p-2 text-[#99a198] hover:bg-[#f4f6f2] hover:text-[#4c5e50]"><LogOut size={15} /></button>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-[#f7f9f5] px-3 py-2 text-[10px] text-[#8c968b]"><span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#55a469]" /> UGX reporting currency</span><span>AED</span></div>
        </div>
      </aside>

      {mobileOpen && <button className="fixed inset-0 z-30 bg-[#14231a]/30 md:hidden" onClick={() => setMobileOpen(false)} aria-label="Close navigation" />}
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex h-[68px] items-center justify-between border-b border-[#e7ebe5] bg-[#f9faf8]/95 px-4 backdrop-blur md:px-8">
          <div className="flex items-center gap-3"><button onClick={() => setMobileOpen(true)} className="rounded-lg p-2 text-[#617064] hover:bg-white md:hidden" aria-label="Open navigation"><Menu size={19} /></button><div><div className="text-[13px] font-semibold">{title}</div><div className="mt-0.5 hidden text-[10px] text-[#929c92] sm:block">{new Date().toLocaleDateString('en-UG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div></div></div>
          <div className="flex items-center gap-2"><div className="hidden rounded-lg border border-[#e8ece6] bg-white px-3 py-2 text-[10px] text-[#78867a] sm:block">{organisation?.base_currency || 'UGX'} reporting</div><div className="hidden h-8 w-8 items-center justify-center rounded-full border border-[#e2e8df] bg-white text-[10px] font-bold text-[#52805b] sm:flex">{(user.name || 'O').slice(0, 1).toUpperCase()}</div></div>
        </header>
        <main className="content-scroll mx-auto max-w-[1500px] px-3 py-5 sm:px-4 sm:py-6 md:px-8 md:py-8">
          {error && <div className="mb-5 flex items-start gap-2 rounded-xl border border-[#f1d2c9] bg-[#fff7f4] px-4 py-3 text-[12px] text-[#a54c39]"><CircleHelp size={16} className="mt-0.5 shrink-0" /><span className="flex-1">{error}</span><button onClick={() => setError('')} aria-label="Dismiss"><X size={15} /></button></div>}
          {active === 'dashboard' && <Dashboard data={data} onNavigate={setActive} onAdd={() => setModal('transaction')} />}
          {active === 'finance' && <Finance data={data} onAdd={setModal} onRefresh={refresh} />}
          {active === 'projects' && <Projects data={data} onAdd={() => setModal('project')} />}
          {active === 'settings' && <Settings data={data} organisation={organisation} onAdd={setModal} />}
          {active === 'farm' && <Farm data={data} onAdd={() => setModal('crop')} />}
          {active === 'purchases' && <Purchases data={data} onAdd={() => setModal('purchase')} />}
          {active === 'decisions' && <Decisions data={data} onAdd={() => setModal('decision')} />}
          {active === 'control' && <AuditPage data={data} />}
          {active === 'people' && <PeopleAssets data={data} onAdd={openModal} onEdit={openEdit} />}
        </main>
      </div>
      {modal && <Modal title={modalTitle(modal, editingRecord)} onClose={closeModal}>
        {modal === 'transaction' && <TransactionForm accounts={data.accounts} rates={data.rates} projects={data.projects} onSubmit={value => submit('transaction', value)} onCancel={() => setModal('')} saving={saving} />}
        {modal === 'contribution' && <ContributionForm accounts={data.accounts} rates={data.rates} onSubmit={value => submit('contribution', value)} onCancel={() => setModal('')} saving={saving} />}
        {modal === 'account' && <AccountForm onSubmit={value => submit('account', value)} onCancel={() => setModal('')} saving={saving} />}
        {modal === 'rate' && <RateForm onSubmit={value => submit('rate', value)} onCancel={() => setModal('')} saving={saving} />}
        {modal === 'project' && <ProjectForm structure={data.structure} onSubmit={value => submit('project', value)} onCancel={() => setModal('')} saving={saving} />}
        {modal === 'purchase' && <PurchaseForm onSubmit={value => submit('purchase', value)} onCancel={() => setModal('')} saving={saving} />}
        {modal === 'crop' && <CropForm onSubmit={value => submit('crop', value)} onCancel={() => setModal('')} saving={saving} />}
        {modal === 'decision' && <DecisionForm onSubmit={value => submit('decision', value)} onCancel={() => setModal('')} saving={saving} />}
        {modal === 'department' && <NamedForm title="Department name" fieldLabel="Name" onSubmit={value => submit('department', value)} onCancel={() => setModal('')} saving={saving} />}
        {modal === 'location' && <LocationForm onSubmit={value => submit('location', value)} onCancel={() => setModal('')} saving={saving} />}
        {modal === 'person' && <PersonForm key={editingRecord?.record.id || 'new'} initial={editingRecord?.record} departments={data.structure.departments} onSubmit={value => submit('person', value)} onCancel={closeModal} saving={saving} />}
        {modal === 'asset' && <AssetForm key={editingRecord?.record.id || 'new'} initial={editingRecord?.record} people={data.people} locations={data.structure.locations} onSubmit={value => submit('asset', value)} onCancel={closeModal} saving={saving} />}
      </Modal>}
    </div>
  );
}

function FullLoading() { return <div className="flex min-h-screen items-center justify-center bg-[#f6f8f4]"><div className="flex items-center gap-3 text-sm text-[#718073]"><LoaderCircle className="animate-spin text-[#39834d]" size={19} /> Opening your workspace…</div></div>; }

function Login({ onSubmit, busy, error }) {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  return <div className="soft-grid flex min-h-screen min-h-dvh items-center justify-center px-3 py-6 sm:px-4 sm:py-10">
    <div className="grid w-full max-w-[900px] overflow-hidden rounded-[26px] border border-[#e4ebe1] bg-white shadow-[0_22px_70px_-34px_#253e2b40] md:grid-cols-[1fr_0.9fr]">
      <div className="relative hidden min-h-[540px] flex-col justify-between overflow-hidden bg-[#173f2b] p-10 text-white md:flex">
        <div className="absolute -right-24 -top-20 h-72 w-72 rounded-full border border-white/10" /><div className="absolute -right-10 -top-6 h-44 w-44 rounded-full border border-white/10" />
        <div className="relative flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-white/10"><Leaf size={23} /></div><div><div className="text-[15px] font-bold">Green Harvest</div><div className="text-[10px] text-white/55">Uganda Ltd</div></div></div>
        <div className="relative"><div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#b6d9a4]/15 text-[#c9e2b9]"><Sprout size={24} /></div><h1 className="max-w-sm text-[32px] font-semibold leading-[1.15] tracking-[-.04em]">Grow with clarity.<br />Manage with confidence.</h1><p className="mt-4 max-w-sm text-[13px] leading-6 text-white/65">One place to keep your projects, finances, and farm operations moving forward.</p></div>
        <div className="relative flex items-center gap-2 text-[10px] text-white/50"><ShieldCheck size={14} /> Private company workspace</div>
      </div>
      <form className="flex min-h-[540px] flex-col justify-center p-7 sm:p-10" onSubmit={e => { e.preventDefault(); onSubmit(email, password); }}>
        <div className="mb-9 md:hidden"><div className="mb-4 flex h-11 w-11 items-center justify-center rounded-[14px] bg-[#e9f3e7] text-[#39834d]"><Leaf size={22} /></div><div className="text-sm font-bold">Green Harvest Uganda Ltd</div></div>
        <div className="text-[11px] font-semibold uppercase tracking-[.15em] text-[#6a9870]">Welcome back</div><h2 className="mt-2 text-[25px] font-semibold tracking-[-.04em]">Sign in to your workspace</h2><p className="mt-2 text-[12px] text-[#879287]">Use your company account to continue.</p>
        {error && <div className="mt-5 rounded-lg bg-[#fff4f0] px-3 py-2.5 text-[11px] text-[#aa513c]">{error}</div>}
        <label className="mb-1 mt-7 text-[11px] font-medium text-[#536357]">Email address</label><input className="field" type="email" autoComplete="username" required placeholder="you@greenharvest.ug" value={email} onChange={e => setEmail(e.target.value)} />
        <div className="mb-1 mt-5 flex items-center justify-between"><label className="text-[11px] font-medium text-[#536357]">Password</label></div><input className="field" type="password" autoComplete="current-password" required placeholder="Enter your password" value={password} onChange={e => setPassword(e.target.value)} />
        <button disabled={busy} className="mt-7 flex items-center justify-center gap-2 rounded-[10px] bg-[#287540] px-4 py-3 text-[12px] font-semibold text-white shadow-sm transition hover:bg-[#226637] disabled:opacity-60">{busy ? <LoaderCircle size={15} className="animate-spin" /> : null} Sign in <ArrowRight size={14} /></button>
        <p className="mt-6 text-center text-[10px] text-[#99a299]">Access is managed by your company administrator.</p>
      </form>
    </div>
  </div>;
}

function PageHeading({ eyebrow, title, subtitle, action }) { return <div className="mb-7 flex min-w-0 flex-col justify-between gap-4 sm:flex-row sm:items-end"><div className="min-w-0"><div className="mb-2 text-[9px] font-bold tracking-[.16em] text-[#719177]">{eyebrow}</div><h1 className="break-words text-[25px] font-semibold tracking-[-.045em] text-[#1b2d20] md:text-[29px]">{title}</h1><p className="mt-1.5 max-w-2xl text-[11px] leading-relaxed text-[#8a958b]">{subtitle}</p></div>{action}</div>; }
function Button({ children, onClick, variant = 'primary', className = '', type = 'button', disabled = false }) {
  const style = variant === 'primary' ? 'bg-[#287540] text-white hover:bg-[#236838]' : variant === 'plain' ? 'bg-transparent text-[#647268] hover:bg-[#f1f5ef]' : 'border border-[#e1e8df] bg-white text-[#405446] hover:bg-[#f8faf7]';
  return <button type={type} onClick={onClick} disabled={disabled} className={`inline-flex items-center justify-center gap-2 rounded-[9px] px-3.5 py-2.5 text-[11px] font-semibold transition disabled:cursor-wait disabled:opacity-60 ${style} ${className}`}>{children}</button>;
}
function MetricCard({ title, value, detail, icon: Icon, accent, trend }) { return <div className="min-w-0 rounded-[14px] border border-[#e8ede6] bg-white p-3 sm:p-4 md:p-5"><div className="flex items-start justify-between gap-2"><span className="min-w-0 text-[10px] font-medium text-[#829084]">{title}</span><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] ${accent}`}><Icon size={15} /></span></div><div className="metric-value mt-3 min-w-0 font-semibold tracking-[-.04em] text-[#203426]">{value}</div><div className="mt-1 flex items-start gap-1 text-[9px] leading-relaxed text-[#8b978c]">{trend && <TrendingUp size={11} className="mt-0.5 shrink-0 text-[#4d9a60]" />}{detail}</div></div>; }

function Dashboard({ data, onNavigate, onAdd }) {
  const totalIn = data.transactions.filter(t => t.direction === 'in').reduce((sum, t) => sum + Number(t.amount_ugx), 0);
  const totalOut = data.transactions.filter(t => t.direction === 'out').reduce((sum, t) => sum + Number(t.amount_ugx), 0);
  const totalContributions = data.contributions.reduce((sum, item) => sum + Number(item.amount_ugx), 0);
  const cash = totalIn + totalContributions - totalOut;
  const projects = data.projects.filter(p => p.status === 'Active').length;
  const recent = [...data.transactions].slice(0, 5);
  const phases = phaseNames.map((name, index) => {
    const rows = data.transactions.filter(item => Number(item.phase) === index + 1);
    const incoming = rows.filter(item => item.direction === 'in').reduce((sum, item) => sum + Number(item.amount_ugx), 0) + data.contributions.filter(item => Number(item.phase) === index + 1).reduce((sum, item) => sum + Number(item.amount_ugx), 0);
    const outgoing = rows.filter(item => item.direction === 'out').reduce((sum, item) => sum + Number(item.amount_ugx), 0);
    return { name, incoming, outgoing, balance: incoming - outgoing };
  });
  const maxPhase = Math.max(1, ...phases.map(p => p.incoming));
  return <>
    <PageHeading eyebrow="COMPANY OVERVIEW" title="Good morning" subtitle="Here’s what’s happening across Green Harvest today." action={<div className="flex gap-2"><Button variant="secondary" onClick={() => onNavigate('projects')}><FolderKanban size={14} /> View projects</Button><Button onClick={onAdd}><Plus size={15} /> Record transaction</Button></div>} />
    <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3 xl:grid-cols-4">
      <MetricCard title="Cash position" value={compactCurrency(cash)} detail="Income less recorded expenses" icon={Wallet} accent="bg-[#edf6ec] text-[#34804a]" />
      <MetricCard title="Income recorded" value={compactCurrency(totalIn)} detail={`${data.transactions.filter(t => t.direction === 'in').length} income entries`} icon={ArrowDownLeft} accent="bg-[#eff5e8] text-[#719246]" />
      <MetricCard title="Expenses recorded" value={compactCurrency(totalOut)} detail={`${data.transactions.filter(t => t.direction === 'out').length} expense entries`} icon={ArrowUpRight} accent="bg-[#f9f0e9] text-[#b67b43]" />
      <MetricCard title="Active projects" value={String(projects).padStart(2, '0')} detail={`${data.projects.length} projects in register`} icon={FolderKanban} accent="bg-[#eef1f8] text-[#6779aa]" />
    </div>
    <div className="mt-5 grid gap-5 xl:grid-cols-[1.45fr_0.85fr]">
      <section className="rounded-[14px] border border-[#e8ede6] bg-white p-4 md:p-5">
        <div className="flex items-start justify-between"><div><h2 className="text-[13px] font-semibold">Investment phases</h2><p className="mt-1 text-[10px] text-[#909a91]">Recorded funds and spend by phase</p></div><button onClick={() => onNavigate('finance')} className="flex items-center gap-1 text-[10px] font-semibold text-[#438252]">Finance <ChevronRight size={13} /></button></div>
        <div className="mt-5 space-y-[17px]">{phases.map((phase, i) => <div key={phase.name}>
          <div className="mb-1.5 flex items-center justify-between gap-2"><div className="flex min-w-0 items-center gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[#f0f5ee] text-[9px] font-bold text-[#668368]">{String(i + 1).padStart(2, '0')}</span><span className="truncate text-[10px] font-medium text-[#536256]">{phase.name}</span></div><span className="shrink-0 text-[10px] font-semibold text-[#405343]">{compactCurrency(phase.incoming)}</span></div>
          <div className="ml-7 h-[5px] overflow-hidden rounded-full bg-[#eff2ed]"><div className="h-full rounded-full bg-[#74a875]" style={{ width: `${Math.max(2, phase.incoming / maxPhase * 100)}%` }} /></div>
          <div className="ml-7 mt-1 flex justify-between text-[9px] text-[#9aa39a]"><span>Spent {compactCurrency(phase.outgoing)}</span><span>Balance {compactCurrency(phase.balance)}</span></div>
        </div>)}</div>
      </section>
      <section className="rounded-[14px] border border-[#e8ede6] bg-white p-4 md:p-5">
        <div className="flex items-start justify-between"><div><h2 className="text-[13px] font-semibold">Accounts</h2><p className="mt-1 text-[10px] text-[#909a91]">Your recorded cash and payment accounts</p></div><button onClick={() => onNavigate('settings')} className="rounded-md p-1.5 text-[#879389] hover:bg-[#f5f7f3]" aria-label="Account settings"><MoreHorizontal size={17} /></button></div>
        {data.accounts.length ? <div className="mt-4 space-y-2">{data.accounts.map(account => {
          const amount = data.transactions.filter(t => t.account_id === account.id).reduce((sum, t) => sum + (t.direction === 'in' ? 1 : -1) * Number(t.amount_ugx), 0);
          const contributions = data.contributions.filter(item => item.account_id === account.id).reduce((sum, item) => sum + Number(item.amount_ugx), 0);
          return <div key={account.id} className="flex items-center gap-3 rounded-xl border border-[#eff2ed] px-3 py-3"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f0f5ef] text-[#608167]">{account.kind === 'Cash' ? <Banknote size={15} /> : <Building2 size={15} />}</span><div className="min-w-0 flex-1"><div className="truncate text-[10px] font-semibold">{account.name}</div><div className="mt-0.5 text-[9px] text-[#929b92]">{account.kind} · {account.currency}</div></div><div className="text-[10px] font-semibold">{compactCurrency(amount + contributions)}</div></div>;
        })}</div> : <EmptyPanel icon={Wallet} title="No accounts yet" description="Add cash, bank, or mobile money accounts to track balances." button="Add an account" onClick={() => onNavigate('settings')} />}
      </section>
    </div>
    <section className="mt-5 rounded-[14px] border border-[#e8ede6] bg-white p-4 md:p-5">
      <div className="flex items-start justify-between"><div><h2 className="text-[13px] font-semibold">Recent transactions</h2><p className="mt-1 text-[10px] text-[#909a91]">Latest activity recorded in the company books</p></div><Button variant="plain" onClick={() => onNavigate('finance')}>See all <ArrowRight size={13} /></Button></div>
      {recent.length ? <TransactionTable rows={recent} /> : <EmptyPanel icon={Coins} title="No transactions recorded" description="Your latest income and expenses will appear here." button="Record a transaction" onClick={onAdd} />}
    </section>
  </>;
}

function TransactionTable({ rows }) {
  return <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[730px] border-collapse text-left"><thead><tr className="border-b border-[#edf0eb] text-[9px] font-semibold uppercase tracking-[.08em] text-[#99a299]"><th className="pb-2.5 pl-2">Transaction</th><th className="pb-2.5">Date</th><th className="pb-2.5">Account</th><th className="pb-2.5">Project</th><th className="pb-2.5">Phase</th><th className="pb-2.5 pr-2 text-right">Amount</th></tr></thead><tbody>{rows.map(row => <tr key={row.id} className="border-b border-[#f0f2ee] last:border-0"><td className="py-3 pl-2"><div className="flex items-center gap-2.5"><span className={`flex h-7 w-7 items-center justify-center rounded-lg ${row.direction === 'in' ? 'bg-[#edf6ed] text-[#478a50]' : 'bg-[#faf0e9] text-[#b5804e]'}`}>{row.direction === 'in' ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}</span><span className="text-[10px] font-semibold text-[#37483b]">{row.description}</span></div></td><td className="py-3 text-[10px] text-[#7f8b80]">{new Date(`${row.txn_date}T00:00:00`).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })}</td><td className="py-3 text-[10px] text-[#7f8b80]">{row.account_name || '—'}</td><td className="py-3 text-[10px] text-[#7f8b80]">{row.project_name || '—'}</td><td className="py-3 text-[10px] text-[#7f8b80]">{row.phase ? `${String(row.phase).padStart(2, '0')} · ${phaseNames[row.phase - 1]}` : '—'}</td><td className={`py-3 pr-2 text-right text-[10px] font-semibold ${row.direction === 'in' ? 'text-[#38834a]' : 'text-[#ae6e40]'}`}>{row.direction === 'in' ? '+' : '−'}{currency(row.amount_ugx)}</td></tr>)}</tbody></table></div>;
}

function Finance({ data, onAdd, onRefresh }) {
  const [tab, setTab] = useState('transactions');
  const monthly = Object.values(data.transactions.reduce((groups, row) => { const month = String(row.txn_date).slice(0, 7); groups[month] ||= { month, income: 0, expenses: 0 }; groups[month][row.direction === 'in' ? 'income' : 'expenses'] += Number(row.amount_ugx); return groups; }, {})).sort((a, b) => b.month.localeCompare(a.month));
  return <>
    <PageHeading eyebrow="FINANCIAL MANAGEMENT" title="Finance" subtitle="Track company money, accounts, contributions, and exchange rates." action={<Button onClick={() => onAdd(tab === 'rates' ? 'rate' : tab === 'accounts' ? 'account' : tab === 'contributions' ? 'contribution' : 'transaction')}><Plus size={15} /> {tab === 'rates' ? 'Add exchange rate' : tab === 'accounts' ? 'Add account' : tab === 'contributions' ? 'Record contribution' : 'Record transaction'}</Button>} />
    <div className="mb-5 flex gap-1 overflow-x-auto rounded-xl border border-[#e7ece5] bg-white p-1 scrollbar-hide">{[['transactions', 'Transactions'], ['reports', 'Monthly reports'], ['contributions', 'Founder contributions'], ['accounts', 'Accounts'], ['rates', 'Exchange rates']].map(([id, label]) => <button key={id} onClick={() => setTab(id)} className={`shrink-0 rounded-lg px-4 py-2 text-[10px] font-semibold ${tab === id ? 'bg-[#edf5eb] text-[#327648]' : 'text-[#7c897e] hover:bg-[#f8faf7]'}`}>{label}</button>)}</div>
    {tab === 'transactions' && <div className="rounded-[14px] border border-[#e8ede6] bg-white p-4 md:p-5"><div className="flex justify-between"><div><h2 className="text-[13px] font-semibold">All transactions</h2><p className="mt-1 text-[10px] text-[#929b92]">Income and expenses recorded in UGX reporting value</p></div><button onClick={onRefresh} className="rounded-lg p-2 text-[#89958a] hover:bg-[#f5f7f3]" title="Refresh"><Activity size={15} /></button></div>{data.transactions.length ? <TransactionTable rows={data.transactions} /> : <EmptyPanel icon={Coins} title="Nothing recorded yet" description="Create your first transaction to start building the finance register." button="Record transaction" onClick={() => onAdd('transaction')} />}</div>}
    {tab === 'reports' && <div className="rounded-[14px] border border-[#e8ede6] bg-white p-4 md:p-5"><div><h2 className="text-[13px] font-semibold">Monthly income and expenses</h2><p className="mt-1 text-[10px] text-[#929b92]">Totals grouped by transaction date, in UGX reporting value.</p></div>{monthly.length ? <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[520px] text-left"><thead><tr className="border-b border-[#edf0eb] text-[9px] uppercase text-[#99a299]"><th className="pb-2">Month</th><th className="pb-2 text-right">Income</th><th className="pb-2 text-right">Expenses</th><th className="pb-2 text-right">Net</th></tr></thead><tbody>{monthly.map(row => <tr key={row.month} className="border-b border-[#f0f2ee] last:border-0"><td className="py-3 text-[10px] font-semibold">{new Date(`${row.month}-01T00:00:00`).toLocaleDateString('en-UG', { month: 'long', year: 'numeric' })}</td><td className="py-3 text-right text-[10px] text-[#38834a]">{currency(row.income)}</td><td className="py-3 text-right text-[10px] text-[#ae6e40]">{currency(row.expenses)}</td><td className="py-3 text-right text-[10px] font-semibold">{currency(row.income - row.expenses)}</td></tr>)}</tbody></table></div> : <EmptyPanel icon={Coins} title="No monthly data yet" description="Record income and expenses to build monthly reports." />}</div>}
    {tab === 'accounts' && <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{data.accounts.map(account => { const amount = data.transactions.filter(t => t.account_id === account.id).reduce((sum, t) => sum + (t.direction === 'in' ? 1 : -1) * Number(t.amount_ugx), 0) + data.contributions.filter(c => c.account_id === account.id).reduce((sum,c) => sum + Number(c.amount_ugx),0); return <div key={account.id} className="rounded-[14px] border border-[#e8ede6] bg-white p-5"><div className="flex items-center justify-between"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#edf5ec] text-[#54855b]"><Wallet size={17} /></span><span className="rounded-full bg-[#f4f7f2] px-2.5 py-1 text-[9px] text-[#788678]">{account.kind}</span></div><div className="mt-5 text-[11px] font-medium text-[#778478]">{account.name}</div><div className="mt-1 text-[23px] font-semibold tracking-[-.04em]">{currency(amount)}</div><div className="mt-1 text-[9px] text-[#a0a9a0]">{account.currency} account balance</div></div>; })}{!data.accounts.length && <div className="col-span-full rounded-[14px] border border-dashed border-[#dce5da] bg-white"><EmptyPanel icon={Wallet} title="No accounts yet" description="Add the places where Green Harvest holds money." button="Add an account" onClick={() => onAdd('account')} /></div>}</div>}
    {tab === 'contributions' && <div className="rounded-[14px] border border-[#e8ede6] bg-white p-4 md:p-5"><div><h2 className="text-[13px] font-semibold">Founder contributions</h2><p className="mt-1 text-[10px] text-[#929b92]">Capital contributions with the exchange rate kept at entry.</p></div>{data.contributions.length ? <ContributionTable rows={data.contributions} accounts={data.accounts} /> : <EmptyPanel icon={Coins} title="No contributions recorded" description="Record founder funding by date, currency, account, and investment phase." button="Record contribution" onClick={() => onAdd('contribution')} />}</div>}
    {tab === 'rates' && <div className="rounded-[14px] border border-[#e8ede6] bg-white p-4 md:p-5"><div><h2 className="text-[13px] font-semibold">Exchange rate history</h2><p className="mt-1 text-[10px] text-[#929b92]">Transactions keep the rate and UGX value used when they were recorded.</p></div><div className="mt-4 space-y-2">{data.rates.map(rate => <div key={rate.id} className="flex items-center gap-3 rounded-xl border border-[#eef1ec] p-3"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f1f4eb] text-[#728958]"><Globe2 size={15} /></span><div className="flex-1"><div className="text-[10px] font-semibold">1 {rate.from_currency} = {Number(rate.rate).toLocaleString()} {rate.to_currency}</div><div className="mt-0.5 text-[9px] text-[#929c92]">{new Date(`${rate.rate_date}T00:00:00`).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })} · {rate.source || 'Source not stated'}</div></div><BadgeCheck size={15} className="text-[#7baa7e]" /></div>)}{!data.rates.length && <EmptyPanel icon={Globe2} title="No rates recorded" description="Add an exchange rate to record AED transactions." button="Add exchange rate" onClick={() => onAdd('rate')} />}</div></div>}
  </>;
}

function ContributionTable({ rows, accounts }) { return <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[590px] border-collapse text-left"><thead><tr className="border-b border-[#edf0eb] text-[9px] font-semibold uppercase tracking-[.08em] text-[#99a299]"><th className="pb-2.5 pl-2">Contribution</th><th className="pb-2.5">Date</th><th className="pb-2.5">Account</th><th className="pb-2.5">Phase</th><th className="pb-2.5 pr-2 text-right">UGX value</th></tr></thead><tbody>{rows.map(row => <tr key={row.id} className="border-b border-[#f0f2ee] last:border-0"><td className="py-3 pl-2 text-[10px] font-semibold">{row.original_minor / (row.currency === 'AED' ? 100 : 1)} {row.currency}<span className="ml-1 font-normal text-[#879288]">@ {Number(row.exchange_rate).toLocaleString()}</span></td><td className="py-3 text-[10px] text-[#7f8b80]">{row.txn_date}</td><td className="py-3 text-[10px] text-[#7f8b80]">{accounts.find(a => a.id === row.account_id)?.name || '—'}</td><td className="py-3 text-[10px] text-[#7f8b80]">{row.phase ? phaseNames[row.phase - 1] || 'Held / unassigned' : 'Held / unassigned'}</td><td className="py-3 pr-2 text-right text-[10px] font-semibold text-[#38834a]">{currency(row.amount_ugx)}</td></tr>)}</tbody></table></div>; }

function Projects({ data, onAdd }) {
  return <><PageHeading eyebrow="PORTFOLIO" title="Projects" subtitle="Plan and monitor company investments and initiatives." action={<Button onClick={onAdd}><Plus size={15} /> New project</Button>} />
  return <><PageHeading eyebrow="PORTFOLIO" title="Projects" subtitle="Plan and monitor company investments and initiatives." action={<Button onClick={onAdd}><Plus size={15} /> New project</Button>} />
    {data.projects.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{data.projects.map(project => { const actualSpend = data.transactions.filter(t => t.project_id === project.id && t.direction === 'out').reduce((sum, t) => sum + Number(t.amount_ugx), 0); const budget = Number(project.budget_ugx); const usage = budget ? Math.min(100, actualSpend / budget * 100) : 0; return <article key={project.id} className="overflow-hidden rounded-[14px] border border-[#e8ede6] bg-white"><div className="flex h-28 items-center justify-center bg-[#e9f0e5] text-[#81977a]">{project.photo_url ? <img src={project.photo_url} className="h-full w-full object-cover" /> : <div className="soft-grid flex h-full w-full items-center justify-center"><Sprout size={26} strokeWidth={1.4} /></div>}</div><div className="p-4"><div className="flex items-start justify-between"><div><h2 className="text-[13px] font-semibold">{project.name}</h2><p className="mt-1 text-[10px] text-[#919b91]">{project.location_name || 'No location'}{project.department_name ? ` · ${project.department_name}` : ''}</p></div><span className={`rounded-full px-2.5 py-1 text-[9px] font-semibold ${project.status === 'Active' ? 'bg-[#edf6ec] text-[#39804a]' : 'bg-[#f4f5f1] text-[#7e897d]'}`}>{project.status}</span></div><div className="mt-5 grid grid-cols-1 min-[420px]:grid-cols-2 gap-3 border-t border-[#f0f2ee] pt-3"><div><div className="text-[9px] text-[#929c92]">Planned budget</div><div className="mt-1 text-[11px] font-semibold">{currency(project.budget_ugx)}</div></div><div><div className="text-[9px] text-[#929c92]">Actual spending</div><div className="mt-1 text-[11px] font-semibold">{currency(actualSpend)}</div></div></div><div className="mt-3"><div className="mb-1 flex justify-between text-[9px] text-[#89958a]"><span>Budget used</span><span>{budget ? `${usage.toFixed(0)}% · ${currency(budget - actualSpend)} remaining` : 'No budget set'}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-[#eff2ed]"><div className={`h-full rounded-full ${actualSpend > budget && budget ? 'bg-[#c67550]' : 'bg-[#74a875]'}`} style={{ width: `${usage}%` }} /></div></div>{project.main_risk && <p className="mt-3 rounded-lg bg-[#faf8f1] px-3 py-2 text-[9px] text-[#887b53]">Risk · {project.main_risk}</p>}</div></article>; })}</div> : <div className="rounded-[14px] border border-dashed border-[#dce5da] bg-white"><EmptyPanel icon={FolderKanban} title="Start with a project" description="Set a budget, forecast, owner department, and next milestone for each company initiative." button="Create first project" onClick={onAdd} /></div>}
  </>;
}

  </>;
}

function Settings({ data, organisation, onAdd }) {
  return <><PageHeading eyebrow="ORGANISATION" title="Company settings" subtitle="Manage accounts, organisation profile, and the rates used for reporting." />
    <div className="grid gap-4 xl:grid-cols-2"><div className="rounded-[14px] border border-[#e8ede6] bg-white p-5"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#edf5ec] text-[#54855b]"><Building2 size={17} /></span><div><h2 className="text-[12px] font-semibold">Organisation profile</h2><p className="text-[10px] text-[#929c92]">Company reporting defaults</p></div></div><div className="mt-5 divide-y divide-[#f0f2ee]">{[['Company', organisation?.name || 'Green Harvest Uganda Ltd'], ['Reporting currency', organisation?.base_currency || 'UGX'], ['Financial year starts', `Month ${organisation?.financial_year_start_month || 1}`]].map(([label, value]) => <div key={label} className="flex justify-between py-3"><span className="text-[10px] text-[#849085]">{label}</span><span className="text-[10px] font-semibold">{value}</span></div>)}</div></div>
      <div className="rounded-[14px] border border-[#e8ede6] bg-white p-5"><div className="flex items-center justify-between"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f2f4eb] text-[#7d8d5f]"><Wallet size={17} /></span><div><h2 className="text-[12px] font-semibold">Accounts</h2><p className="text-[10px] text-[#929c92]">Cash, bank, and mobile money</p></div></div><Button variant="secondary" onClick={() => onAdd('account')}><Plus size={13} /> Add</Button></div><div className="mt-4 divide-y divide-[#f0f2ee]">{data.accounts.map(a => <div key={a.id} className="flex items-center justify-between py-3"><div><div className="text-[10px] font-semibold">{a.name}</div><div className="mt-0.5 text-[9px] text-[#939d93]">{a.kind} · {a.currency}</div></div><Check size={14} className="text-[#6ca078]" /></div>)}{!data.accounts.length && <div className="py-5 text-center text-[10px] text-[#9aa39a]">No accounts added yet.</div>}</div></div>
      <StructureCard title="Departments" rows={data.structure.departments} onAdd={() => onAdd('department')} />
      <StructureCard title="Farm locations" rows={data.structure.locations} onAdd={() => onAdd('location')} />
    </div>
  </>;
}

function StructureCard({ title, rows, onAdd }) { return <section className="rounded-[14px] border border-[#e8ede6] bg-white p-5"><div className="flex items-center justify-between"><div><h2 className="text-[12px] font-semibold">{title}</h2><p className="mt-1 text-[10px] text-[#929c92]">Company structure</p></div><Button variant="secondary" onClick={onAdd}><Plus size={13} /> Add</Button></div><div className="mt-4 divide-y divide-[#f0f2ee]">{rows.map(row => <div key={row.id} className="flex items-center justify-between py-3 text-[10px]"><span className="font-medium">{row.name}</span><span className="text-[#949d94]">{row.size_note || ''}</span></div>)}{!rows.length && <div className="py-5 text-center text-[10px] text-[#9aa39a]">Nothing added yet.</div>}</div></section>; }

function Farm({ data, onAdd }) { return <><PageHeading eyebrow="FIELD OPERATIONS" title="Farm operations" subtitle="Track crop cycles and measure profitability by harvest." action={<Button onClick={onAdd}><Plus size={15} /> Record crop cycle</Button>} />{data.crops.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{data.crops.map(crop => { const profit = Number(crop.profit_ugx); return <article key={crop.id} className="rounded-[14px] border border-[#e8ede6] bg-white p-5"><div className="flex items-start justify-between"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#edf5ec] text-[#54855b]"><Sprout size={17} /></span><span className={`rounded-full px-2.5 py-1 text-[9px] font-semibold ${profit >= 0 ? 'bg-[#edf6ec] text-[#39804a]' : 'bg-[#faf0e9] text-[#a8663a]'}`}>{profit >= 0 ? 'Profitable' : 'Loss'}</span></div><h2 className="mt-4 text-[13px] font-semibold">{crop.name}</h2><p className="mt-1 text-[10px] text-[#929c92]">{crop.area || 'Area not stated'} · Started {crop.started_on}</p><div className="mt-4 grid grid-cols-1 min-[420px]:grid-cols-2 gap-3 border-t border-[#f0f2ee] pt-3"><div><div className="text-[9px] text-[#929c92]">Total cost</div><div className="mt-1 text-[10px] font-semibold">{currency(crop.cost_ugx)}</div></div><div><div className="text-[9px] text-[#929c92]">Sales revenue</div><div className="mt-1 text-[10px] font-semibold">{currency(crop.revenue_ugx)}</div></div></div><div className="mt-3 rounded-lg bg-[#f6f8f4] px-3 py-2 text-[10px] text-[#627164]">Profit {currency(profit)}{Number(crop.cost_ugx) ? ` · ROI ${((profit / Number(crop.cost_ugx)) * 100).toFixed(1)}%` : ''}</div></article>; })}</div> : <div className="rounded-[14px] border border-dashed border-[#dce5da] bg-white"><EmptyPanel icon={Sprout} title="No crop cycles yet" description="Record a crop or block with its cost and eventual sales revenue." button="Record crop cycle" onClick={onAdd} /></div>}</>; }

function Purchases({ data, onAdd }) { const total = data.purchases.reduce((sum, purchase) => sum + Number(purchase.cost_ugx), 0); return <><PageHeading eyebrow="SUPPLY & ASSETS" title="Purchases" subtitle="Record input and asset purchases with quantities, cost, and proof." action={<Button onClick={onAdd}><Plus size={15} /> Record purchase</Button>} /><div className="mb-4 grid max-w-[430px] grid-cols-1 min-[420px]:grid-cols-2 gap-3"><MetricCard title="Recorded purchases" value={String(data.purchases.length)} detail="Items in register" icon={CreditCard} accent="bg-[#edf5ec] text-[#54855b]" /><MetricCard title="Total recorded cost" value={compactCurrency(total)} detail="UGX purchase costs" icon={Coins} accent="bg-[#f9f0e9] text-[#b67b43]" /></div>{data.purchases.length ? <div className="rounded-[14px] border border-[#e8ede6] bg-white p-4 md:p-5"><div className="divide-y divide-[#f0f2ee]">{data.purchases.map(p => <div key={p.id} className="flex items-center gap-3 py-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#f3f5ed] text-[#76875f]"><CreditCard size={15} /></span><div className="min-w-0 flex-1"><div className="truncate text-[10px] font-semibold">{p.name}{p.quantity ? ` · ${p.quantity}` : ''}</div><div className="mt-0.5 break-words text-[9px] text-[#939d93]">{p.txn_date} · {p.category}{p.proof ? ` · proof ${p.proof}` : ''}</div></div><div className="max-w-[45%] shrink-0 break-words text-right text-[10px] font-semibold">{currency(p.cost_ugx)}<div className="mt-0.5 text-[9px] font-normal text-[#9aa39a]">{p.expected_benefit || ''}</div></div></div>)}</div></div> : <div className="rounded-[14px] border border-dashed border-[#dce5da] bg-white"><EmptyPanel icon={CreditCard} title="No purchases recorded" description="Track seeds, tools, fertiliser, labour, and other business inputs." button="Record a purchase" onClick={onAdd} /></div>}</>; }

function Decisions({ data, onAdd }) { return <><PageHeading eyebrow="GOVERNANCE" title="Investment decisions" subtitle="Keep a record of investment choices, reasoning, and approvals." action={<Button onClick={onAdd}><Plus size={15} /> Log decision</Button>} />{data.decisions.length ? <div className="space-y-3">{data.decisions.map(d => <article key={d.id} className="rounded-[14px] border border-[#e8ede6] bg-white p-4 md:p-5"><div className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#eef2e8] text-[#718654]"><BadgeCheck size={17} /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-[12px] font-semibold">{d.name}</h2><span className="text-[11px] font-semibold">{currency(d.amount_ugx)}</span></div><p className="mt-1 text-[10px] leading-5 text-[#879287]">{d.reason || 'No reason recorded.'}</p><div className="mt-3 flex gap-4 text-[9px] text-[#9aa39a]"><span>{d.decision_date}</span><span>Approved by {d.approver || '—'}</span></div></div></div></article>)}</div> : <div className="rounded-[14px] border border-dashed border-[#dce5da] bg-white"><EmptyPanel icon={BadgeCheck} title="No decisions logged" description="Record the decision, amount, expected return, and approver." button="Log an investment decision" onClick={onAdd} /></div>}</>; }

function AuditPage({ data }) { return <><PageHeading eyebrow="GOVERNANCE" title="Audit log" subtitle="Recent changes recorded by the server for this organisation." /><div className="rounded-[14px] border border-[#e8ede6] bg-white p-4 md:p-5"><div className="flex items-start justify-between"><div><h2 className="text-[13px] font-semibold">Recent activity</h2><p className="mt-1 text-[10px] text-[#929b92]">Latest 200 events · database time</p></div><ShieldCheck size={16} className="text-[#719177]" /></div>{data.audit.length ? <div className="mt-4 divide-y divide-[#f0f2ee]">{data.audit.map(event => <div key={event.id} className="flex gap-3 py-3"><span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#78a77a]" /><div className="min-w-0 flex-1"><div className="text-[10px] font-semibold">{event.actor || 'System'} · {event.action.replaceAll('_', ' ')} {event.record_type?.replaceAll('_', ' ')}</div><div className="mt-1 truncate text-[9px] text-[#929b92]">{event.new_value?.name || event.new_value?.description || event.new_value?.email || event.record_id || ''}</div></div><time className="shrink-0 text-[9px] text-[#99a299]">{new Date(event.at).toLocaleString('en-UG', { dateStyle: 'medium', timeStyle: 'short' })}</time></div>)}</div> : <EmptyPanel icon={ShieldCheck} title="No activity yet" description="Server-recorded creates and sign-ins will appear here." />}</div></>; }

function ComingSoon({ active }) {
  const configs = {
    farm: { eyebrow: 'FIELD OPERATIONS', title: 'Farm operations', desc: 'Land parcels, crop cycles, activity logs, harvest, and livestock records will live here.', icon: Tractor },
    purchases: { eyebrow: 'SUPPLY CHAIN', title: 'Purchases & stock', desc: 'Supplier purchases, item movements, sales, deliveries, and inventory controls.', icon: CreditCard },
    people: { eyebrow: 'COMPANY RESOURCES', title: 'People & assets', desc: 'Employee records, attendance, leave, payroll, asset register, and maintenance.', icon: Users },
    control: { eyebrow: 'GOVERNANCE', title: 'Documents & audit', desc: 'Company documents, approvals, notifications, and the append-only audit trail.', icon: FileText },
  };
  const item = configs[active]; const Icon = item.icon;
  return <div className="flex min-h-[65vh] items-center justify-center"><div className="max-w-[440px] text-center"><div className="soft-grid mx-auto flex h-20 w-20 items-center justify-center rounded-[24px] border border-[#e2eadf] bg-[#f4f8f1] text-[#648563]"><Icon size={30} strokeWidth={1.5} /></div><div className="mt-6 text-[9px] font-bold tracking-[.16em] text-[#6d9472]">{item.eyebrow}</div><h1 className="mt-2 text-[25px] font-semibold tracking-[-.04em]">{item.title}</h1><p className="mt-2 text-[11px] leading-5 text-[#879287]">{item.desc}</p><span className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-[#e8ece5] bg-white px-3 py-1.5 text-[9px] font-semibold text-[#879187]"><Activity size={12} /> Planned for a later build phase</span></div></div>;
}

function PeopleAssets({ data, onAdd, onEdit }) {
  const activePeople = data.people.filter(person => person.status === 'Active').length;
  const workingAssets = data.assets.filter(asset => asset.status === 'In use').length;
  return <>
    <PageHeading eyebrow="COMPANY RESOURCES" title="People & assets" subtitle="Keep staff details, assignments, and company equipment in one register." action={<div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={() => onAdd('person')}><Plus size={14} /> Add person</Button><Button onClick={() => onAdd('asset')}><Plus size={14} /> Add asset</Button></div>} />
    <div className="mb-5 grid grid-cols-1 min-[420px]:grid-cols-2 xl:grid-cols-4 gap-3">
      <MetricCard title="People on register" value={String(data.people.length)} detail={`${activePeople} active`} icon={Users} accent="bg-[#edf5ec] text-[#54855b]" />
      <MetricCard title="Assets recorded" value={String(data.assets.length)} detail={`${workingAssets} in use`} icon={Package} accent="bg-[#eef1f8] text-[#6779aa]" />
    </div>
    <div className="grid min-w-0 gap-5 xl:grid-cols-2">
      <section className="min-w-0 rounded-[14px] border border-[#e8ede6] bg-white p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3"><div><h2 className="text-[13px] font-semibold">People</h2><p className="mt-1 text-[10px] text-[#929c92]">Staff contact and department details</p></div><Button variant="secondary" onClick={() => onAdd('person')}><Plus size={13} /> Add</Button></div>
        {data.people.length ? <div className="mt-4 divide-y divide-[#f0f2ee]">{data.people.map(person => <article key={person.id} className="flex min-w-0 items-start gap-3 py-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#edf5ec] text-[#54855b]"><UserRoundIcon /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="break-words text-[11px] font-semibold">{person.full_name}</h3><StatusPill status={person.status} /></div><p className="mt-1 break-words text-[10px] text-[#718073]">{person.job_title || 'Role not set'}{person.department_name ? ` · ${person.department_name}` : ''}</p><p className="mt-1 break-all text-[9px] text-[#929c92]">{[person.email, person.phone].filter(Boolean).join(' · ') || 'No contact details'}{person.start_date ? ` · Since ${person.start_date}` : ''}</p></div><Button variant="plain" className="shrink-0 px-2" onClick={() => onEdit('person', person)} aria-label={`Edit ${person.full_name}`}><Pencil size={14} /></Button></article>)}</div> : <EmptyPanel icon={Users} title="No people added" description="Add staff members and keep their role and contact information handy." button="Add a person" onClick={() => onAdd('person')} />}
      </section>
      <section className="min-w-0 rounded-[14px] border border-[#e8ede6] bg-white p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3"><div><h2 className="text-[13px] font-semibold">Asset register</h2><p className="mt-1 text-[10px] text-[#929c92]">Equipment, location, and assignment</p></div><Button variant="secondary" onClick={() => onAdd('asset')}><Plus size={13} /> Add</Button></div>
        {data.assets.length ? <div className="mt-4 divide-y divide-[#f0f2ee]">{data.assets.map(asset => <article key={asset.id} className="flex min-w-0 items-start gap-3 py-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#eef1f8] text-[#6779aa]"><Package size={16} /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="break-words text-[11px] font-semibold">{asset.name}</h3><StatusPill status={asset.status} /></div><p className="mt-1 break-words text-[10px] text-[#718073]">{asset.category}{asset.asset_tag ? ` · ${asset.asset_tag}` : ''}</p><p className="mt-1 break-words text-[9px] text-[#929c92]">{[asset.location_name, asset.assigned_to_name ? `Assigned to ${asset.assigned_to_name}` : ''].filter(Boolean).join(' · ') || 'No location or person assigned'}{Number(asset.cost_ugx) ? ` · ${currency(asset.cost_ugx)}` : ''}</p></div><Button variant="plain" className="shrink-0 px-2" onClick={() => onEdit('asset', asset)} aria-label={`Edit ${asset.name}`}><Pencil size={14} /></Button></article>)}</div> : <EmptyPanel icon={Package} title="No assets recorded" description="Add equipment and track where it is and who is responsible for it." button="Add an asset" onClick={() => onAdd('asset')} />}
      </section>
    </div>
  </>;
}
function UserRoundIcon() { return <Users size={16} />; }
function StatusPill({ status }) {
  const style = status === 'Active' || status === 'In use' ? 'bg-[#edf6ec] text-[#39804a]' : status === 'Maintenance' || status === 'On leave' ? 'bg-[#fff7e9] text-[#a57935]' : 'bg-[#f1f3f0] text-[#778178]';
  return <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${style}`}>{status}</span>;
}

function EmptyPanel({ icon: Icon, title, description, button, onClick }) { return <div className="flex flex-col items-center px-4 py-9 text-center"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f1f5ef] text-[#769078]"><Icon size={18} /></span><h3 className="mt-3 text-[11px] font-semibold">{title}</h3><p className="mt-1 max-w-[300px] text-[10px] leading-5 text-[#939d93]">{description}</p>{button && <button onClick={onClick} className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#edf5eb] px-3 py-2 text-[10px] font-semibold text-[#39804a] hover:bg-[#e3efdf]"><Plus size={13} /> {button}</button>}</div>; }

function Modal({ title, onClose, children }) { return <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#17291e]/35 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><section className="modal-sheet w-full max-w-[520px] overflow-y-auto rounded-t-[20px] border border-[#e5ebe3] bg-white p-4 shadow-2xl sm:max-h-[92dvh] sm:rounded-[18px] sm:p-6"><div className="mb-5 flex items-center justify-between gap-3"><div className="min-w-0"><h2 className="break-words text-[15px] font-semibold">{title}</h2><p className="mt-1 text-[10px] text-[#909b91]">This entry will be saved to the company database.</p></div><button onClick={onClose} className="shrink-0 rounded-lg p-2 text-[#849085] hover:bg-[#f4f6f2]" aria-label="Close dialog"><X size={17} /></button></div>{children}</section></div>; }
function modalTitle(kind, editingRecord) { if (editingRecord?.kind === kind) return kind === 'person' ? 'Edit person details' : 'Edit asset details'; return ({ transaction: 'Record a transaction', contribution: 'Record founder contribution', account: 'Add a company account', rate: 'Record an exchange rate', project: 'Create a project', purchase: 'Record purchase', crop: 'Record crop cycle', decision: 'Log investment decision', department: 'Add department', location: 'Add farm location', person: 'Add a person', asset: 'Add an asset' })[kind] || 'Add record'; }
function Field({ label, children, hint }) { return <label className="block"><span className="mb-1.5 block text-[10px] font-medium text-[#667368]">{label}</span>{children}{hint && <span className="mt-1 block text-[9px] text-[#9aa39a]">{hint}</span>}</label>; }
function ModalActions({ onCancel, saving, label = 'Save entry' }) { return <div className="mt-6 flex justify-end gap-2 border-t border-[#eff2ed] pt-4"><Button variant="secondary" onClick={onCancel}>Cancel</Button><Button type="submit" disabled={saving}>{saving && <LoaderCircle size={13} className="animate-spin" />}{label}</Button></div>; }

function TransactionForm({ accounts, rates, projects, onSubmit, onCancel, saving }) {
  const [direction, setDirection] = useState('out'); const [currencyCode, setCurrencyCode] = useState('UGX');
  const [form, setForm] = useState({ date: dateToday(), description: '', amount: '', accountId: '', projectId: '', phase: '', evidence: '', exchangeRateId: '' });
  const set = (key, value) => setForm(current => ({ ...current, [key]: value }));
  const filteredRates = rates.filter(rate => rate.from_currency === currencyCode && rate.to_currency === 'UGX');
  const submit = e => { e.preventDefault(); const scale = currencyCode === 'AED' ? 100 : 1; onSubmit({ date: form.date, direction, description: form.description, currency: currencyCode, originalMinor: Math.round(Number(form.amount) * scale), accountId: form.accountId || null, projectId: form.projectId || null, phase: form.phase ? Number(form.phase) : null, evidence: form.evidence || null, exchangeRateId: currencyCode === 'AED' ? form.exchangeRateId : null }); };
  return <form className="space-y-4" onSubmit={submit}>
    <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3"><Field label="Money movement"><select className="field" value={direction} onChange={e => setDirection(e.target.value)}><option value="out">Expense / money out</option><option value="in">Income / money in</option></select></Field><Field label="Transaction date"><input className="field" type="date" required value={form.date} onChange={e => set('date', e.target.value)} /></Field></div>
    <Field label="Description"><input className="field" required maxLength="1000" placeholder="What was this payment for?" value={form.description} onChange={e => set('description', e.target.value)} /></Field>
    <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3"><Field label="Currency"><select className="field" value={currencyCode} onChange={e => setCurrencyCode(e.target.value)}><option>UGX</option><option>AED</option></select></Field><Field label={`Amount (${currencyCode})`}><input className="field" type="number" min={currencyCode === 'AED' ? '0.01' : '1'} step={currencyCode === 'AED' ? '0.01' : '1'} required placeholder="0.00" value={form.amount} onChange={e => set('amount', e.target.value)} /></Field></div>
    {currencyCode === 'AED' && <Field label="Exchange rate" hint="The rate used will be stored with this transaction."><select className="field" required value={form.exchangeRateId} onChange={e => set('exchangeRateId', e.target.value)}><option value="">Choose a recorded AED rate</option>{filteredRates.map(rate => <option key={rate.id} value={rate.id}>1 AED = {Number(rate.rate).toLocaleString()} UGX · {rate.rate_date}</option>)}</select></Field>}
    <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3"><Field label="Account"><select className="field" value={form.accountId} onChange={e => set('accountId', e.target.value)}><option value="">Select account</option>{accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}</select></Field><Field label="Project"><select className="field" value={form.projectId} onChange={e => set('projectId',e.target.value)}><option value="">No project</option>{projects.map(project=><option key={project.id} value={project.id}>{project.name}</option>)}</select></Field></div>
    <Field label="Investment phase"><select className="field" value={form.phase} onChange={e => set('phase', e.target.value)}><option value="">Unassigned</option>{phaseNames.map((name, i) => <option key={name} value={i + 1}>{String(i + 1).padStart(2, '0')} · {name}</option>)}</select></Field>
    <Field label="Receipt / payment proof"><input className="field" maxLength="1000" placeholder="Receipt number or a short note" value={form.evidence} onChange={e => set('evidence', e.target.value)} /></Field>
    {currencyCode === 'AED' && !filteredRates.length && <p className="rounded-lg bg-[#fff8eb] px-3 py-2 text-[10px] text-[#927044]">Add an AED exchange rate before recording this transaction.</p>}
    <ModalActions onCancel={onCancel} saving={saving} label="Save transaction" />
  </form>;
}

function ContributionForm({ accounts, rates, onSubmit, onCancel, saving }) {
  const [currencyCode, setCurrencyCode] = useState('UGX');
  const [form, setForm] = useState({ date: dateToday(), amount: '', plannedUgx: '', accountId: '', phase: '0', exchangeRateId: '' });
  const set = (key, value) => setForm(current => ({ ...current, [key]: value }));
  const applicableRates = rates.filter(r => r.from_currency === currencyCode && r.to_currency === 'UGX');
  return <form onSubmit={e => { e.preventDefault(); onSubmit({ date: form.date, currency: currencyCode, originalMinor: Math.round(Number(form.amount) * (currencyCode === 'AED' ? 100 : 1)), plannedUgx: form.plannedUgx ? Number(form.plannedUgx) : null, accountId: form.accountId || null, phase: Number(form.phase), exchangeRateId: currencyCode === 'AED' ? form.exchangeRateId : null }); }} className="space-y-4">
    <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3"><Field label="Date"><input className="field" type="date" required value={form.date} onChange={e => set('date', e.target.value)} /></Field><Field label="Currency"><select className="field" value={currencyCode} onChange={e => setCurrencyCode(e.target.value)}><option>UGX</option><option>AED</option></select></Field></div>
    <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3"><Field label={`Actual amount (${currencyCode})`}><input className="field" type="number" min={currencyCode === 'AED' ? '0.01' : '1'} step={currencyCode === 'AED' ? '0.01' : '1'} required value={form.amount} onChange={e => set('amount', e.target.value)} /></Field><Field label="Planned monthly amount (UGX)"><input className="field" type="number" min="0" step="1" value={form.plannedUgx} onChange={e => set('plannedUgx', e.target.value)} /></Field></div>
    {currencyCode === 'AED' && <Field label="Exchange rate"><select className="field" required value={form.exchangeRateId} onChange={e => set('exchangeRateId', e.target.value)}><option value="">Select a recorded rate</option>{applicableRates.map(rate => <option key={rate.id} value={rate.id}>1 AED = {Number(rate.rate).toLocaleString()} UGX · {rate.rate_date}</option>)}</select></Field>}
    <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3"><Field label="Investment phase"><select className="field" value={form.phase} onChange={e => set('phase', e.target.value)}><option value="0">Held / unassigned</option>{phaseNames.map((p,i) => <option key={p} value={i+1}>{i+1} · {p}</option>)}</select></Field><Field label="Account"><select className="field" value={form.accountId} onChange={e => set('accountId', e.target.value)}><option value="">Select account</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field></div>
    <ModalActions onCancel={onCancel} saving={saving} label="Save contribution" />
  </form>;
}

function PurchaseForm({ onSubmit, onCancel, saving }) {
  const [form, setForm] = useState({ date: dateToday(), name: '', category: 'Seeds', quantity: '', costUgx: '', expectedBenefit: '', proof: '' });
  const set = (key,value) => setForm(current => ({...current,[key]:value}));
  return <form onSubmit={e => { e.preventDefault(); onSubmit({...form,costUgx:Number(form.costUgx)}); }} className="space-y-4">
    <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3"><Field label="Date"><input className="field" type="date" required value={form.date} onChange={e => set('date',e.target.value)} /></Field><Field label="Category"><select className="field" value={form.category} onChange={e => set('category',e.target.value)}>{['Land','Seeds','Tools','Fertiliser','Labour','Other'].map(v=><option key={v}>{v}</option>)}</select></Field></div>
    <Field label="Asset / input"><input className="field" required maxLength="200" placeholder="Item or service" value={form.name} onChange={e => set('name',e.target.value)} /></Field>
    <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3"><Field label="Quantity"><input className="field" maxLength="120" placeholder="e.g. 20 bags" value={form.quantity} onChange={e => set('quantity',e.target.value)} /></Field><Field label="Cost (UGX)"><input className="field" type="number" min="0" step="1" required value={form.costUgx} onChange={e => set('costUgx',e.target.value)} /></Field></div>
    <Field label="Expected benefit"><input className="field" maxLength="1000" value={form.expectedBenefit} onChange={e => set('expectedBenefit',e.target.value)} /></Field><Field label="Receipt / proof"><input className="field" maxLength="1000" value={form.proof} onChange={e => set('proof',e.target.value)} /></Field>
    <ModalActions onCancel={onCancel} saving={saving} label="Save purchase" />
  </form>;
}

function CropForm({ onSubmit, onCancel, saving }) {
  const [form, setForm] = useState({ name: '', area: '', costUgx: '', harvestQuantity: '', revenueUgx: '', startedOn: dateToday() });
  const set = (key,value) => setForm(current => ({...current,[key]:value}));
  return <form onSubmit={e => { e.preventDefault(); onSubmit({...form,costUgx:Number(form.costUgx||0),revenueUgx:Number(form.revenueUgx||0)}); }} className="space-y-4">
    <Field label="Crop / block"><input className="field" required maxLength="200" placeholder="e.g. Nakasongola maize block" value={form.name} onChange={e => set('name',e.target.value)} /></Field>
    <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3"><Field label="Area"><input className="field" placeholder="e.g. 2 acres" value={form.area} onChange={e => set('area',e.target.value)} /></Field><Field label="Start date"><input className="field" type="date" value={form.startedOn} onChange={e => set('startedOn',e.target.value)} /></Field></div>
    <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3"><Field label="Total cost (UGX)"><input className="field" type="number" min="0" step="1" value={form.costUgx} onChange={e => set('costUgx',e.target.value)} /></Field><Field label="Harvest quantity"><input className="field" placeholder="e.g. 1,200 kg" value={form.harvestQuantity} onChange={e => set('harvestQuantity',e.target.value)} /></Field></div>
    <Field label="Sales revenue (UGX)"><input className="field" type="number" min="0" step="1" value={form.revenueUgx} onChange={e => set('revenueUgx',e.target.value)} /></Field>
    <ModalActions onCancel={onCancel} saving={saving} label="Save crop cycle" />
  </form>;
}

function DecisionForm({ onSubmit, onCancel, saving }) {
  const [form,setForm]=useState({date:dateToday(),name:'',amountUgx:'',reason:'',approver:''}); const set=(key,value)=>setForm(current=>({...current,[key]:value}));
  return <form onSubmit={e=>{e.preventDefault();onSubmit({...form,amountUgx:Number(form.amountUgx||0)});}} className="space-y-4"><div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3"><Field label="Date"><input className="field" type="date" required value={form.date} onChange={e=>set('date',e.target.value)}/></Field><Field label="Amount (UGX)"><input className="field" type="number" min="0" step="1" value={form.amountUgx} onChange={e=>set('amountUgx',e.target.value)}/></Field></div><Field label="Decision / investment"><input className="field" required maxLength="200" value={form.name} onChange={e=>set('name',e.target.value)}/></Field><Field label="Reason / expected return"><textarea className="field" rows="3" maxLength="2000" value={form.reason} onChange={e=>set('reason',e.target.value)}/></Field><Field label="Approved by"><input className="field" maxLength="200" value={form.approver} onChange={e=>set('approver',e.target.value)}/></Field><ModalActions onCancel={onCancel} saving={saving} label="Save decision"/></form>;
}

function NamedForm({fieldLabel,onSubmit,onCancel,saving}){const [name,setName]=useState('');return <form onSubmit={e=>{e.preventDefault();onSubmit({name});}} className="space-y-4"><Field label={fieldLabel}><input className="field" required maxLength="200" value={name} onChange={e=>setName(e.target.value)}/></Field><ModalActions onCancel={onCancel} saving={saving} label="Save"/></form>;}
function LocationForm({onSubmit,onCancel,saving}){const [name,setName]=useState('');const [sizeNote,setSizeNote]=useState('');return <form onSubmit={e=>{e.preventDefault();onSubmit({name,sizeNote:sizeNote||null});}} className="space-y-4"><Field label="Farm / site name"><input className="field" required maxLength="200" value={name} onChange={e=>setName(e.target.value)}/></Field><Field label="Size / notes"><input className="field" maxLength="500" placeholder="Area, district, or details" value={sizeNote} onChange={e=>setSizeNote(e.target.value)}/></Field><ModalActions onCancel={onCancel} saving={saving} label="Save location"/></form>;}

function PersonForm({ initial, departments, onSubmit, onCancel, saving }) {
  const [form,setForm]=useState({fullName:initial?.full_name||'',jobTitle:initial?.job_title||'',email:initial?.email||'',phone:initial?.phone||'',departmentId:initial?.department_id||'',startDate:initial?(initial.start_date||''):dateToday(),status:initial?.status||'Active',notes:initial?.notes||''});
  const set=(key,value)=>setForm(current=>({...current,[key]:value}));
  return <form onSubmit={e=>{e.preventDefault();onSubmit({...form,departmentId:form.departmentId||null,startDate:form.startDate||null});}} className="space-y-4">
    <Field label="Full name"><input className="field" required maxLength="200" autoComplete="name" placeholder="Employee name" value={form.fullName} onChange={e=>set('fullName',e.target.value)} /></Field>
    <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3"><Field label="Job title"><input className="field" maxLength="150" placeholder="e.g. Farm manager" value={form.jobTitle} onChange={e=>set('jobTitle',e.target.value)} /></Field><Field label="Department"><select className="field" value={form.departmentId} onChange={e=>set('departmentId',e.target.value)}><option value="">No department</option>{departments.map(department=><option key={department.id} value={department.id}>{department.name}</option>)}</select></Field></div>
    <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3"><Field label="Email"><input className="field" type="email" maxLength="320" autoComplete="email" value={form.email} onChange={e=>set('email',e.target.value)} /></Field><Field label="Phone"><input className="field" type="tel" maxLength="50" autoComplete="tel" value={form.phone} onChange={e=>set('phone',e.target.value)} /></Field></div>
    <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3"><Field label="Start date"><input className="field" type="date" value={form.startDate} onChange={e=>set('startDate',e.target.value)} /></Field><Field label="Status"><select className="field" value={form.status} onChange={e=>set('status',e.target.value)}><option>Active</option><option>On leave</option><option>Inactive</option></select></Field></div>
    <Field label="Notes"><textarea className="field min-h-20 resize-y" maxLength="1000" value={form.notes} onChange={e=>set('notes',e.target.value)} /></Field>
    <ModalActions onCancel={onCancel} saving={saving} label={initial ? 'Update person' : 'Save person'} />
  </form>;
}

function AssetForm({ initial, people, locations, onSubmit, onCancel, saving }) {
  const [form,setForm]=useState({name:initial?.name||'',category:initial?.category||'Equipment',assetTag:initial?.asset_tag||'',acquiredOn:initial?(initial.acquired_on||''):dateToday(),costUgx:initial?.cost_ugx??'',status:initial?.status||'In use',locationId:initial?.location_id||'',assignedTo:initial?.assigned_to||'',notes:initial?.notes||''});
  const set=(key,value)=>setForm(current=>({...current,[key]:value}));
  return <form onSubmit={e=>{e.preventDefault();onSubmit({...form,costUgx:Number(form.costUgx||0),acquiredOn:form.acquiredOn||null,locationId:form.locationId||null,assignedTo:form.assignedTo||null});}} className="space-y-4">
    <Field label="Asset name"><input className="field" required maxLength="200" placeholder="e.g. Water pump" value={form.name} onChange={e=>set('name',e.target.value)} /></Field>
    <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3"><Field label="Category"><input className="field" required maxLength="100" placeholder="Equipment, vehicle, tools…" value={form.category} onChange={e=>set('category',e.target.value)} /></Field><Field label="Asset tag / serial"><input className="field" maxLength="100" value={form.assetTag} onChange={e=>set('assetTag',e.target.value)} /></Field></div>
    <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3"><Field label="Acquisition date"><input className="field" type="date" value={form.acquiredOn} onChange={e=>set('acquiredOn',e.target.value)} /></Field><Field label="Cost (UGX)"><input className="field" type="number" required min="0" step="1" value={form.costUgx} onChange={e=>set('costUgx',e.target.value)} /></Field></div>
    <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3"><Field label="Location"><select className="field" value={form.locationId} onChange={e=>set('locationId',e.target.value)}><option value="">No location</option>{locations.map(location=><option key={location.id} value={location.id}>{location.name}</option>)}</select></Field><Field label="Assigned to"><select className="field" value={form.assignedTo} onChange={e=>set('assignedTo',e.target.value)}><option value="">Unassigned</option>{people.filter(person=>person.status!=='Inactive').map(person=><option key={person.id} value={person.id}>{person.full_name}</option>)}</select></Field></div>
    <Field label="Status"><select className="field" value={form.status} onChange={e=>set('status',e.target.value)}><option>In use</option><option>Maintenance</option><option>Retired</option></select></Field>
    <Field label="Notes"><textarea className="field min-h-20 resize-y" maxLength="1000" value={form.notes} onChange={e=>set('notes',e.target.value)} /></Field>
    <ModalActions onCancel={onCancel} saving={saving} label={initial ? 'Update asset' : 'Save asset'} />
  </form>;
}

function AccountForm({ onSubmit, onCancel, saving }) { const [name, setName] = useState(''); const [kind, setKind] = useState('Bank'); const [currencyCode, setCurrencyCode] = useState('UGX'); return <form onSubmit={e => { e.preventDefault(); onSubmit({ name, kind, currency: currencyCode }); }} className="space-y-4"><Field label="Account name"><input className="field" required maxLength="200" placeholder="e.g. Main business account" value={name} onChange={e => setName(e.target.value)} /></Field><div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3"><Field label="Account type"><select className="field" value={kind} onChange={e => setKind(e.target.value)}><option>Cash</option><option>Bank</option><option>Mobile money</option></select></Field><Field label="Currency"><select className="field" value={currencyCode} onChange={e => setCurrencyCode(e.target.value)}><option>UGX</option><option>AED</option></select></Field></div><ModalActions onCancel={onCancel} saving={saving} label="Create account" /></form>; }
function RateForm({ onSubmit, onCancel, saving }) { const [rate, setRate] = useState(''); const [rateDate, setRateDate] = useState(dateToday()); const [source, setSource] = useState(''); return <form onSubmit={e => { e.preventDefault(); onSubmit({ fromCurrency: 'AED', toCurrency: 'UGX', rate: Number(rate), rateDate, source: source || null }); }} className="space-y-4"><div className="rounded-xl bg-[#f4f7f1] p-4"><div className="text-[10px] text-[#879286]">Reporting conversion</div><div className="mt-1 text-[17px] font-semibold">1 AED <span className="text-[#79907a">=</span> UGX {Number(rate || 0).toLocaleString()}</div></div><Field label="UGX per 1 AED"><input className="field" type="number" required min="0.000001" step="any" placeholder="e.g. 1,020" value={rate} onChange={e => setRate(e.target.value)} /></Field><div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3"><Field label="Rate date"><input className="field" type="date" required value={rateDate} onChange={e => setRateDate(e.target.value)} /></Field><Field label="Source"><input className="field" maxLength="250" placeholder="Bank statement, exchange desk…" value={source} onChange={e => setSource(e.target.value)} /></Field></div><ModalActions onCancel={onCancel} saving={saving} label="Save rate" /></form>; }
function ProjectForm({ structure = { departments: [], locations: [] }, onSubmit, onCancel, saving }) {
  const [form, setForm] = useState({ name: '', budgetUgx: '', forecastRevenueUgx: '', status: 'Planned', mainRisk: '', nextMilestone: '', milestoneDate: '', photoKey: '' });
  const [photoName, setPhotoName] = useState(''); const [uploading, setUploading] = useState(false); const [photoError, setPhotoError] = useState('');
  const set = (key, value) => setForm(current => ({ ...current, [key]: value }));
  async function upload(file) {
    if (!file) return;
    setPhotoError(''); setUploading(true);
    try { const photoKey = await api.uploadImage(file); set('photoKey', photoKey); setPhotoName(file.name); }
    catch (error) { setPhotoError(error.message); }
    finally { setUploading(false); }
  }
  return <form onSubmit={e => { e.preventDefault(); onSubmit({ ...form, budgetUgx: Number(form.budgetUgx) || 0, forecastRevenueUgx: Number(form.forecastRevenueUgx) || 0, milestoneDate: form.milestoneDate || null }); }} className="space-y-4">
    <Field label="Project name"><input className="field" required maxLength="200" placeholder="e.g. Maize season 2026" value={form.name} onChange={e => set('name', e.target.value)} /></Field>
    <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3"><Field label="Department"><select className="field" value={form.departmentId || ''} onChange={e => set('departmentId',e.target.value)}><option value="">No department</option>{structure.departments.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></Field><Field label="Location"><select className="field" value={form.locationId || ''} onChange={e => set('locationId',e.target.value)}><option value="">No location</option>{structure.locations.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></Field></div>
    <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3"><Field label="Budget (UGX)"><input className="field" type="number" min="0" step="1" value={form.budgetUgx} onChange={e => set('budgetUgx', e.target.value)} /></Field><Field label="Forecast revenue (UGX)"><input className="field" type="number" min="0" step="1" value={form.forecastRevenueUgx} onChange={e => set('forecastRevenueUgx', e.target.value)} /></Field></div>
    <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3"><Field label="Status"><select className="field" value={form.status} onChange={e => set('status', e.target.value)}><option>Planned</option><option>Active</option><option>Completed</option></select></Field><Field label="Next milestone date"><input className="field" type="date" value={form.milestoneDate} onChange={e => set('milestoneDate', e.target.value)} /></Field></div>
    <Field label="Main risk"><input className="field" maxLength="1000" placeholder="What could affect this project?" value={form.mainRisk} onChange={e => set('mainRisk', e.target.value)} /></Field>
    <Field label="Next milestone"><input className="field" maxLength="200" placeholder="e.g. Prepare land" value={form.nextMilestone} onChange={e => set('nextMilestone', e.target.value)} /></Field>
    <div><span className="mb-1.5 block text-[10px] font-medium text-[#667368]">Project picture</span><p className="mb-2 text-[9px] text-[#9aa39a]">JPG, PNG, WebP, or AVIF · up to 8 MB · stored privately in the AWS bucket</p><label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-[#d9e3d7] bg-[#fbfcfa] px-3 py-3 text-[10px] text-[#738174] hover:bg-[#f6f9f4]"><ImagePlus size={16} className="text-[#6c936f]" /><span className="flex-1">{uploading ? 'Uploading securely…' : photoName || 'Choose a project picture'}</span>{uploading ? <LoaderCircle size={14} className="animate-spin" /> : <CloudUpload size={15} />}<input type="file" className="hidden" accept="image/jpeg,image/png,image/webp,image/avif" disabled={uploading} onChange={e => upload(e.target.files?.[0])} /></label>{photoError && <span className="mt-1 block text-[9px] text-[#ab523e]">{photoError}</span>}{form.photoKey && <span className="mt-1 block text-[9px] text-[#4c8559]">Picture uploaded and attached to this project.</span>}</div>
    <ModalActions onCancel={onCancel} saving={saving || uploading} label="Create project" />
  </form>;
}
