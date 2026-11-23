// Local storage adapter (browser localStorage).
// It offers the small API app.js needs: collection().onSnapshot/doc().set/delete,
// doc().onSnapshot/set, and a single local user. To move to a real backend
// (e.g. PostgreSQL behind an API), re-implement this same interface and keep app.js unchanged.
const Store = (() => {
  const KEY = "ghms:v1";
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
  let data = load();
  const subs = [];
  const notify = () => subs.forEach(f => f());
  const persist = () => { localStorage.setItem(KEY, JSON.stringify(data)); notify(); };
  const clone = v => JSON.parse(JSON.stringify(v));
  window.addEventListener("storage", e => { if (e.key === KEY) { data = load(); notify(); } });

  const collection = name => ({
    onSnapshot(cb) {
      const run = () => cb({ docs: Object.entries(data[name] || {}).map(([id, v]) => ({ id, data: () => clone(v) })) });
      subs.push(run); setTimeout(run, 0);
    },
    doc: id => ({
      async set(v) { (data[name] = data[name] || {})[id] = clone(v); persist(); },
      async delete() { if (data[name]) delete data[name][id]; persist(); }
    })
  });
  const doc = path => {
    const [c, id] = path.split("/");
    return {
      onSnapshot(cb) {
        const run = () => { const v = (data[c] || {})[id]; cb({ exists: !!v, data: () => clone(v || {}) }); };
        subs.push(run); setTimeout(run, 0);
      },
      async set(v) { (data[c] = data[c] || {})[id] = clone(v); persist(); }
    };
  };
  const user = {
    async id() { return "local-owner"; },
    async profiles(ids) { return Object.fromEntries(ids.map(i => [i, { name: "Owner" }])); }
  };
  function exportBackup() {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    a.download = "green-harvest-backup-" + new Date().toISOString().slice(0, 10) + ".json";
    a.click();
  }
  function importBackup(file) {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const d = JSON.parse(r.result);
        if (!confirm("Replace ALL current data with this backup?")) return;
        data = d; persist();
      } catch (e) { alert("That file is not a valid backup."); }
    };
    r.readAsText(file);
  }
  return { db: { collection, doc }, user, exportBackup, importBackup };
})();
