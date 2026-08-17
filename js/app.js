/* ==========================================================================
   U.S.S.S. ELITE TRAINING SYSTEM — APP ENTRY
   ========================================================================== */

import { seedIfNeeded, globalSearch } from "./store.js";
import { isAuthenticated, currentSession, logout, hasRole, ROLES } from "./auth.js";
import { registerRoute, resolve, startRouter, navigate, currentPath } from "./router.js";
import { esc, sealMark } from "./utils.js";
import { renderLogin } from "./pages/login.js";
import { renderDashboard } from "./pages/dashboard.js";
import { renderPersonnelList } from "./pages/personnel.js";
import { renderProfile } from "./pages/profile.js";
import { renderMatrix } from "./pages/matrix.js";
import { renderProtocolsList, renderProtocolDetail } from "./pages/protocols.js";
import { renderLocationsList, renderLocationDetail } from "./pages/locations.js";
import { renderAdmin } from "./pages/admin.js";

seedIfNeeded();

const root = document.getElementById("root");

const NAV = [
  { group: "Áttekintés", items: [
    { path: "/dashboard", label: "Dashboard", icon: "◈" },
  ]},
  { group: "Állomány & Képzés", items: [
    { path: "/personnel", label: "Állomány", icon: "☰" },
    { path: "/matrix", label: "Training Matrix", icon: "▦" },
    { path: "/protocols", label: "Jegyzőkönyvek", icon: "▤" },
  ]},
  { group: "Objektumok", items: [
    { path: "/locations", label: "Védett helyszínek", icon: "◆" },
  ]},
  { group: "Rendszer", items: [
    { path: "/admin", label: "Adminisztráció", icon: "⚙", minRole: "TRAINING" },
  ]},
];

function pageTitleFor(path) {
  if (path.startsWith("/personnel/")) return { crumb: "Állomány", title: "Személyi profil" };
  if (path.startsWith("/protocols/")) return { crumb: "Jegyzőkönyvek", title: "Jegyzőkönyv részletei" };
  if (path.startsWith("/locations/")) return { crumb: "Objektumok", title: "Helyszín részletei" };
  const flat = NAV.flatMap((g) => g.items);
  const found = flat.find((i) => i.path === path);
  return found ? { crumb: found.label, title: found.label } : { crumb: "", title: "U.S.S.S." };
}

function renderShell() {
  const session = currentSession();
  root.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar" id="sidebar">
        <div class="brand">
          <div class="brand-seal">${sealMark(34)}</div>
          <div>
            <div class="brand-name">U.S.S.S. ELITE</div>
            <div class="brand-sub">Training System</div>
          </div>
        </div>
        <nav id="nav-root" style="flex:1; overflow-y:auto;"></nav>
        <div class="sidebar-footer">
          <div class="session-card">
            <div class="session-name">${esc(session.name)}</div>
            <div class="session-role">${esc(ROLES[session.role]?.label || session.role)} · ${esc(session.usssId)}</div>
          </div>
          <a href="#" id="logout-btn" class="logout-link">Kijelentkezés</a>
        </div>
      </aside>
      <div class="main">
        <header class="topbar">
          <button class="menu-toggle" id="menu-toggle">☰</button>
          <div class="page-heading">
            <div class="crumb" id="crumb"></div>
            <h1 id="page-title"></h1>
          </div>
          <div class="search-wrap">
            <span class="ic">⌕</span>
            <input id="global-search" type="text" placeholder="Keresés: név, USSS ID, modul, jegyzőkönyv, helyszín…" autocomplete="off" />
            <div id="search-results" style="display:none;"></div>
          </div>
        </header>
        <main class="content" id="content"></main>
      </div>
    </div>
  `;

  renderNav();

  document.getElementById("logout-btn").addEventListener("click", (e) => {
    e.preventDefault();
    logout();
    boot();
  });
  document.getElementById("menu-toggle").addEventListener("click", () => {
    document.getElementById("sidebar").classList.toggle("open");
  });

  const searchInput = document.getElementById("global-search");
  const searchResults = document.getElementById("search-results");
  searchInput.addEventListener("input", () => {
    const q = searchInput.value;
    if (!q.trim()) { searchResults.style.display = "none"; return; }
    renderSearchResults(globalSearch(q), searchResults);
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".search-wrap")) searchResults.style.display = "none";
  });
}

function renderSearchResults(results, container) {
  const total = results.personnel.length + results.modules.length + results.protocols.length + results.locations.length;
  if (!total) {
    container.innerHTML = `<div class="search-results"><div class="sr-empty">Nincs találat.</div></div>`;
    container.style.display = "block";
    return;
  }
  const block = (label, items, render) => items.length ? `
    <div class="sr-group">
      <div class="sr-label">${esc(label)}</div>
      ${items.slice(0, 5).map(render).join("")}
    </div>` : "";

  container.innerHTML = `<div class="search-results">
    ${block("Állomány", results.personnel, (p) => `<div class="sr-item" data-nav="/personnel/${esc(p.usssId)}"><span>${esc(p.name)}</span><span class="text-low small">${esc(p.usssId)}</span></div>`)}
    ${block("Modulok", results.modules, (m) => `<div class="sr-item" data-nav="/matrix"><span>${esc(m.code)} — ${esc(m.name)}</span></div>`)}
    ${block("Jegyzőkönyvek", results.protocols, (p) => `<div class="sr-item" data-nav="/protocols/${esc(p.id)}"><span>${esc(p.id)}</span><span class="text-low small">${esc(p.moduleCode)}</span></div>`)}
    ${block("Helyszínek", results.locations, (l) => `<div class="sr-item" data-nav="/locations/${esc(l.id)}"><span>${esc(l.name)}</span></div>`)}
  </div>`;
  container.style.display = "block";
  container.querySelectorAll("[data-nav]").forEach((it) =>
    it.addEventListener("click", () => {
      navigate(it.getAttribute("data-nav"));
      container.style.display = "none";
      document.getElementById("global-search").value = "";
    })
  );
}

function renderNav() {
  const navRoot = document.getElementById("nav-root");
  const path = currentPath();
  navRoot.innerHTML = NAV.map((group) => {
    const items = group.items.filter((i) => !i.minRole || hasRole(i.minRole));
    if (!items.length) return "";
    return `
      <div class="nav-group">
        <div class="nav-group-label">${esc(group.group)}</div>
        ${items.map((i) => `
          <a href="#${i.path}" class="nav-link ${path === i.path ? "active" : ""}">
            <span class="ic">${i.icon}</span>${esc(i.label)}
          </a>`).join("")}
      </div>`;
  }).join("");
}

/* ---------- Routes -------------------------------------------------- */
registerRoute("/dashboard", () => renderDashboard(document.getElementById("content")));
registerRoute("/personnel", () => renderPersonnelList(document.getElementById("content")));
registerRoute("/personnel/:id", (p) => renderProfile(document.getElementById("content"), p.id));
registerRoute("/matrix", () => renderMatrix(document.getElementById("content")));
registerRoute("/protocols", () => renderProtocolsList(document.getElementById("content")));
registerRoute("/protocols/:id", (p) => renderProtocolDetail(document.getElementById("content"), p.id));
registerRoute("/locations", () => renderLocationsList(document.getElementById("content")));
registerRoute("/locations/:id", (p) => renderLocationDetail(document.getElementById("content"), p.id));
registerRoute("/admin", () => renderAdmin(document.getElementById("content")));

function onRouteChange() {
  if (!isAuthenticated()) { boot(); return; }
  document.getElementById("sidebar")?.classList.remove("open");
  const match = resolve();
  const content = document.getElementById("content");
  if (!content) return;
  const { crumb, title } = pageTitleFor(currentPath());
  document.getElementById("crumb").textContent = crumb;
  document.getElementById("page-title").textContent = title;
  renderNav();
  if (!match) { navigate("/dashboard"); return; }
  content.innerHTML = "";
  match.handler(match.params);
}

function boot() {
  if (!isAuthenticated()) {
    renderLogin(root, () => boot());
    return;
  }
  renderShell();
  startRouter(onRouteChange);
}

boot();
