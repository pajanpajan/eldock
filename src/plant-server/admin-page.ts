// Fáze 72: správa serveru závodu – jedna stránka bez knihoven (běží i bez internetu), API `/api/plant/v1/*`.
// První nastavení (heslo správy) jen přímo na serveru (localhost), pak přihlášení heslem z kteréhokoli počítače v síti.

export function adminPage(): string {
  return `<!doctype html>
<html lang="cs">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Eldock – správa serveru závodu</title>
<style>
  :root { color-scheme: dark; --bg:#09090b; --card:#18181b; --muted:#a1a1aa; --border:#ffffff1f; --primary:#facc15; --red:#f87171; --green:#34d399; --amber:#fbbf24; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:#fafafa; font: 15px/1.5 "Segoe UI", system-ui, sans-serif; }
  header { display:flex; align-items:center; gap:12px; padding:12px 20px; border-bottom:1px solid var(--border); }
  header b { font-size:17px; } header span { color:var(--muted); font-size:13px; }
  main { max-width:1100px; margin:0 auto; padding:20px; display:grid; gap:16px; }
  section { background:var(--card); border:1px solid var(--border); border-radius:12px; padding:16px; }
  h2 { margin:0 0 10px; font-size:16px; }
  label { display:block; font-size:13px; margin:8px 0 4px; }
  input { width:100%; padding:9px 11px; border-radius:8px; border:1px solid #ffffff29; background:var(--bg); color:inherit; font-size:15px; }
  button { padding:8px 14px; border-radius:8px; border:1px solid var(--border); background:#27272a; color:inherit; font-size:14px; cursor:pointer; }
  button.primary { background:var(--primary); color:#09090b; border-color:var(--primary); font-weight:600; }
  button.danger { border-color:#ef444480; color:var(--red); background:#ef44441a; }
  button:disabled { opacity:.5; cursor:not-allowed; }
  table { width:100%; border-collapse:collapse; font-size:13px; } td, th { padding:6px 8px; border-top:1px solid var(--border); text-align:left; vertical-align:top; } th { color:var(--muted); font-weight:500; border-top:0; }
  .muted { color:var(--muted); font-size:13px; } .ok { color:var(--green); } .warn { color:var(--amber); } .bad { color:var(--red); }
  .row { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
  .code { font: 600 28px/1.2 Consolas, monospace; letter-spacing:4px; color:var(--primary); }
  .grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap:8px 16px; }
  .msg { padding:10px 12px; border-radius:8px; border:1px solid #ef444466; background:#ef44441a; color:#fecaca; display:none; }
  [hidden] { display:none !important; }
</style>
</head>
<body>
<header><svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true"><rect x="1.5" y="1.5" width="29" height="29" rx="7" fill="#facc15"/><path d="M7 23V9.5h18V23" fill="none" stroke="#09090b" stroke-width="2.6" stroke-linejoin="round"/><path d="M17.6 11.5 12.8 17.4h3.3l-1.4 4.2 4.9-6.1h-3.3z" fill="#09090b"/><rect x="4.5" y="23" width="23" height="4" rx="1" fill="#09090b"/></svg><div><b>Eldock – server závodu</b><br><span id="server-name"></span></div></header>
<main>
  <div id="error" class="msg" role="alert"></div>

  <section id="setup" hidden>
    <h2>První nastavení</h2>
    <p class="muted" id="setup-remote" hidden>Heslo správy se nastavuje jen přímo na tomto serveru – otevřete na něm <b>http://localhost</b> s portem serveru.</p>
    <form id="setup-form">
      <label for="setup-password">Heslo správy serveru (aspoň 10 znaků)</label>
      <input id="setup-password" type="password" autocomplete="new-password" minlength="10" required>
      <p class="muted">Heslo chrání kódy párování pro zařízení v hale a spojení s cloudem. Uložte ho do správce hesel – obnovit ho nejde.</p>
      <button class="primary" type="submit">Nastavit heslo</button>
    </form>
  </section>

  <section id="login" hidden>
    <h2>Přihlášení do správy</h2>
    <form id="login-form" class="row">
      <input id="login-password" type="password" autocomplete="current-password" placeholder="Heslo správy" required style="flex:1;min-width:220px">
      <button class="primary" type="submit">Přihlásit</button>
    </form>
  </section>

  <div id="dashboard" hidden style="display:grid;gap:16px">
    <section>
      <h2>Spojení s cloudem</h2>
      <div id="cloud-status" class="grid"></div>
      <div class="row" style="margin-top:12px">
        <button class="primary" id="sync-now" type="button">Synchronizovat teď</button>
        <button id="logout" type="button">Odhlásit ze správy</button>
      </div>
      <form id="pair-form" hidden style="margin-top:12px">
        <p class="muted">Kód vytvoří správce firmy na eldock.cz: <b>Administrace → Zařízení → Spárovat server závodu</b>.</p>
        <label for="pair-server">Adresa cloudu</label><input id="pair-server" value="https://eldock.cz">
        <label for="pair-code">Kód (8 znaků)</label><input id="pair-code" autocomplete="off" style="text-transform:uppercase;letter-spacing:3px">
        <div class="row" style="margin-top:10px"><button class="primary" type="submit">Spárovat s cloudem</button></div>
      </form>
    </section>

    <section>
      <h2>Adresy pro zařízení v hale</h2>
      <p class="muted">V aplikaci Eldock zadejte jako adresu serveru jednu z adres (počítač a zařízení musí být ve stejné síti; port musí povolit brána firewall). Spojení přes http v síti závodu není šifrované.</p>
      <ul id="addresses"></ul>
    </section>

    <section>
      <h2>Uživatelé a kódy párování</h2>
      <p class="muted">Kód platí 10 minut a jednou. Zařízení pak pracuje pod jménem uživatele – úpravy z haly přepošle server cloudu jeho jménem.</p>
      <div id="pairing" hidden style="margin:8px 0 12px"></div>
      <table><thead><tr><th>Uživatel</th><th>Účet</th><th></th></tr></thead><tbody id="users"></tbody></table>
    </section>

    <section>
      <h2>Zařízení v hale</h2>
      <table><thead><tr><th>Zařízení</th><th>Uživatel</th><th>Poslední synchronizace</th><th></th></tr></thead><tbody id="devices"></tbody></table>
    </section>

    <section>
      <h2>Úpravy z haly</h2>
      <p class="muted" id="relay-summary"></p>
      <table><thead><tr><th>Úprava</th><th>Uživatel</th><th>Stav</th></tr></thead><tbody id="relays"></tbody></table>
    </section>

    <section>
      <h2>Odpojení od cloudu</h2>
      <p class="muted">Smaže data závodu na tomto serveru, zařízení v hale i neodeslané úpravy. Heslo správy zůstane.</p>
      <button class="danger" id="disconnect" type="button">Odpojit server od cloudu</button>
    </section>
  </div>
</main>
<script>
const $ = (id) => document.getElementById(id);
const text = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const when = (value) => value ? new Date(value).toLocaleString("cs-CZ") : "—";
const STATUS = { pending: ["Čeká na cloud", "warn"], applied: ["Provedeno v cloudu", "ok"], rejected: ["Odmítnuto cloudem", "bad"] };
function showError(message) { const box = $("error"); box.textContent = message || ""; box.style.display = message ? "block" : "none"; }
async function api(path, body) {
  const response = await fetch("/api/plant/v1/" + path, body === undefined ? { credentials: "same-origin" } : { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((data.error && data.error.message) || "Požadavek se nepodařil.");
  return data;
}
async function refresh() {
  showError("");
  const state = await api("state");
  $("server-name").textContent = state.name;
  $("setup").hidden = state.setup; $("setup-remote").hidden = state.local; $("setup-form").hidden = !state.local;
  $("login").hidden = !state.setup || state.signedIn; $("dashboard").hidden = !state.signedIn;
  if (!state.signedIn) return;
  const data = await api("overview");
  const cloud = data.cloud;
  $("cloud-status").innerHTML = [
    ["Stav", cloud.paired ? (cloud.offline ? '<span class="warn">Cloud teď nedostupný – server pracuje offline</span>' : (cloud.stale ? '<span class="bad">Nesynchronizováno déle než 24 h</span>' : '<span class="ok">Spárováno a synchronizováno</span>')) : '<span class="warn">Nespárováno s cloudem</span>' + (cloud.unpairedReason ? " – " + text(cloud.unpairedReason) : "")],
    ["Cloud", text(cloud.server || "—")], ["Firma", text(cloud.company || "—")], ["Závod", text(cloud.plants.join(", ") || "—")],
    ["Poslední synchronizace", when(cloud.lastSyncAt)], ["Poslední chyba", text(cloud.lastError || "—")], ["Záznamů závodu", text(data.journal.records)], ["Verze serveru", text(data.version)],
  ].map(([k, v]) => '<div><div class="muted">' + k + '</div><div>' + v + '</div></div>').join("");
  $("pair-form").hidden = cloud.paired; $("sync-now").disabled = !cloud.paired;
  $("addresses").innerHTML = data.addresses.map((a) => "<li><code>" + text(a) + "</code></li>").join("");
  $("users").innerHTML = data.users.map((u) => "<tr><td>" + text(u.name) + (u.title ? '<div class="muted">' + text(u.title) + "</div>" : "") + "</td><td>" + text(u.accountLabel) + (u.disabled ? ' <span class="bad">zablokovaný</span>' : "") + '</td><td>' + (u.disabled ? "" : '<button data-pair="' + text(u.id) + '" type="button">Kód pro zařízení</button>') + "</td></tr>").join("") || '<tr><td colspan="3" class="muted">Po spárování s cloudem se tu objeví uživatelé firmy v závodě.</td></tr>';
  $("devices").innerHTML = data.devices.map((d) => "<tr><td>" + text(d.name) + '<div class="muted">' + text(d.platform) + " · spárováno " + when(d.createdAt) + "</div></td><td>" + text(d.user) + "</td><td>" + (d.revokedAt ? '<span class="muted">Odpojeno – ' + text(d.revokedReason) + "</span>" : when(d.lastPullAt)) + "</td><td>" + (d.revokedAt ? "" : '<button data-revoke="' + text(d.id) + '" type="button">Odpojit</button>') + "</td></tr>").join("") || '<tr><td colspan="4" class="muted">Zatím žádné zařízení.</td></tr>';
  $("relay-summary").textContent = "Čeká na cloud: " + data.relays.pending + " · provedeno: " + data.relays.applied + " · odmítnuto: " + data.relays.rejected;
  $("relays").innerHTML = data.relays.recent.map((r) => { const [label, tone] = STATUS[r.status] || [r.status, ""]; return "<tr><td>" + text(r.label) + '<div class="muted">' + when(r.createdAt) + (r.result && r.result.number ? " · " + text(r.result.number) : "") + "</div></td><td>" + text(r.user) + '</td><td class="' + tone + '">' + label + (r.message && r.status === "rejected" ? '<div class="muted">' + text(r.message) + "</div>" : "") + "</td></tr>"; }).join("") || '<tr><td colspan="3" class="muted">Zatím žádné úpravy z haly.</td></tr>';
}
async function run(action) { try { await action(); await refresh(); } catch (error) { showError(error.message); } }
$("setup-form").addEventListener("submit", (event) => { event.preventDefault(); run(() => api("setup", { password: $("setup-password").value })); });
$("login-form").addEventListener("submit", (event) => { event.preventDefault(); run(() => api("login", { password: $("login-password").value })); });
$("logout").addEventListener("click", () => run(() => api("logout", {})));
$("sync-now").addEventListener("click", () => run(async () => { $("sync-now").disabled = true; const report = await api("cloud/sync", {}); if (!report.ok) showError(report.error || "Cloud je nedostupný."); }));
$("pair-form").addEventListener("submit", (event) => { event.preventDefault(); run(() => api("cloud/pair", { server: $("pair-server").value, code: $("pair-code").value })); });
$("disconnect").addEventListener("click", () => { if (confirm("Odpojit server od cloudu a smazat data závodu i neodeslané úpravy?")) run(() => api("cloud/disconnect", {})); });
document.addEventListener("click", (event) => {
  const pair = event.target.closest("[data-pair]");
  if (pair) run(async () => { const result = await api("pairing", { userId: pair.dataset.pair }); const box = $("pairing"); box.hidden = false; box.innerHTML = "<div>Kód pro <b>" + text(result.user) + '</b> (platí do ' + when(result.expiresAt) + '):</div><div class="code">' + text(result.code) + '</div><div class="muted">Adresa serveru: ' + result.servers.map(text).join(" nebo ") + "</div>"; });
  const revoke = event.target.closest("[data-revoke]");
  if (revoke && confirm("Odpojit zařízení? Musí se spárovat znovu.")) run(() => api("devices/revoke", { deviceId: revoke.dataset.revoke }));
});
refresh().catch((error) => showError(error.message));
setInterval(() => { if (!$("dashboard").hidden) refresh().catch(() => undefined); }, 30000);
</script>
</body>
</html>`;
}
