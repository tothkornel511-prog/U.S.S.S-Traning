/* ==========================================================================
   U.S.S.S. ELITE TRAINING SYSTEM — APP ENTRY
   ========================================================================== */

import { seedIfNeeded, globalSearch, getCustomCss, getOperationRecords, SECTIONS } from "./store.js?v=66";
import { isAuthenticated, currentSession, logout, hasSection, isSuperAdmin, ROLES } from "./auth.js?v=23";
import { registerRoute, resolve, startRouter, navigate, currentPath } from "./router.js?v=20";
import { esc, sealMark, closeModal, applyBranding } from "./utils.js?v=25";
import { renderLogin } from "./pages/login.js?v=25";
import { renderDashboard } from "./pages/dashboard.js?v=46";
import { renderPersonnelList } from "./pages/personnel.js?v=22";
import { renderProfile } from "./pages/profile.js?v=22";
import { renderMatrix } from "./pages/matrix.js?v=23";
import { renderProtocolsList, renderProtocolDetail } from "./pages/protocols.js?v=22";
import { renderTrainingPlansList, renderTrainingPlanDetail } from "./pages/plans.js?v=7";
import { renderLocationsList, renderLocationDetail } from "./pages/locations.js?v=22";
import { renderMapPage } from "./pages/map.js?v=21";
import { renderRecruitmentHub, renderApplicantDetail } from "./pages/recruitment.js?v=26";
import { renderExamList, renderExamDetail } from "./pages/exam.js?v=40";
import { renderAdmin } from "./pages/admin.js?v=31";
import { renderOperations } from "./pages/operations.js?v=39";
import { renderReadiness } from "./pages/readiness.js?v=32";
import { renderInvestigationList, renderInvestigationDetail } from "./pages/investigations.js?v=9";
import { renderCovertOpList, renderCovertOpDetail } from "./pages/covert-ops.js?v=11";
import { renderChannelsHub } from "./pages/channels.js?v=3";
import { renderTrainingCenterCategories, renderTrainingCenterCategory, renderTrainingCenterDoc } from "./pages/training-center.js?v=1";

seedIfNeeded();
applyCustomCss();
applyBranding(document.body, "hero-main");

export function applyCustomCss() {
  let styleEl = document.getElementById("custom-css");
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = "custom-css";
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = getCustomCss();
}

const root = document.getElementById("root");

/* A NAV a SECTIONS katalógusból épül fel (lásd store.js) — így a menü, a
   route-védelem és az admin jogosultság-kezelő űrlap sosem futhat szét. */
const NAV = Object.values(
  SECTIONS.reduce((groups, s) => {
    (groups[s.group] ||= { group: s.group, items: [] }).items.push({
      path: "/" + s.id, label: s.label, icon: s.icon, section: s.id,
    });
    return groups;
  }, {})
);

function pageTitleFor(path) {
  if (path.startsWith("/personnel/")) return { crumb: "Állomány", title: "Személyi profil" };
  if (path.startsWith("/protocols/")) return { crumb: "Jegyzőkönyvek", title: "Jegyzőkönyv részletei" };
  if (path.startsWith("/plans/")) return { crumb: "Kiképzési tervek", title: "Kiképzési terv részletei" };
  if (path.startsWith("/recruitment/")) return { crumb: "Felvételi", title: "Jelentkező részletei" };
  if (path.startsWith("/exam/")) return { crumb: "Felvételi Vizsga", title: "Vizsga részletei" };
  if (path.startsWith("/locations/")) return { crumb: "Objektumok", title: "Helyszín részletei" };
  if (path.startsWith("/operations/")) return { crumb: "Command Center", title: "Operációs központ" };
  if (path.startsWith("/investigations/")) return { crumb: "Belső Vizsgálatok", title: "Vizsgálat részletei" };
  if (path.startsWith("/covert-ops/")) return { crumb: "Fedett Műveletek", title: "Művelet részletei" };
  if (path === "/channels") return { crumb: "Csatornák", title: "Csatornák" };
  if (path.startsWith("/channels/")) return { crumb: "Csatornák", title: "Csatorna" };
  if (path.startsWith("/training-center")) return { crumb: "Training Center", title: "Oktatási Központ" };
  if (path.startsWith("/map")) return { crumb: "Objektumok", title: "Térkép" };
  const flat = NAV.flatMap((g) => g.items);
  const found = flat.find((i) => i.path === path);
  return found ? { crumb: found.label, title: found.label } : { crumb: "", title: "U.S.S.S." };
}

function classificationRibbon(text) {
  return `<div class="global-classification"><span>${esc(text)}</span></div>`;
}

function renderShell() {
  const session = currentSession();
  root.innerHTML = `
    ${classificationRibbon(`U.S.S.S. // RESTRICTED SYSTEM — ${ROLES[session.role]?.label || session.role} CLEARANCE // ${session.usssId}`)}
    <div class="app-shell">
      <aside class="sidebar" id="sidebar">
        <div class="brand">
          <div class="brand-seal">${sealMark(44)}</div>
          <div>
            <div class="brand-name">U.S.S.S. COMMAND</div>
            <div class="brand-sub">Védelmi Műveletek</div>
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
  const total = results.personnel.length + results.modules.length + results.protocols.length + results.locations.length + (results.operations || []).length + (results.plans || []).length;
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
    ${block("Kiképzési tervek", results.plans || [], (p) => `<div class="sr-item" data-nav="/plans/${esc(p.id)}"><span>${esc(p.title)}</span><span class="text-low small">${esc(p.id)}</span></div>`)}
    ${block("Helyszínek", results.locations, (l) => `<div class="sr-item" data-nav="/locations/${esc(l.id)}"><span>${esc(l.name)}</span></div>`)}
    ${block("Command Center", results.operations || [], (r) => `<div class="sr-item" data-nav="/operations/${esc(r.type)}"><span>${esc(r.title)}</span><span class="text-low small">${esc(r.id)}</span></div>`)}
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
  const alertCount = getOperationRecords().filter((record) => !record.archived && record.status !== "COMPLETED" && (record.priority === "CRITICAL" || record.priority === "HIGH" || record.risk === "CRITICAL")).length;
  navRoot.innerHTML = NAV.map((group) => {
    const items = group.items.filter((i) => hasSection(i.section));
    if (!items.length) return "";
    return `
      <div class="nav-group">
        <div class="nav-group-label">${esc(group.group)}</div>
        ${items.map((i) => `
          <a href="#${i.path}" class="nav-link ${(path === i.path || path.startsWith(i.path + "/")) ? "active" : ""}">
            <span class="ic">${i.icon}</span>${esc(i.label)}${i.path === "/operations/notifications" && alertCount ? `<span class="nav-alert-count">${alertCount}</span>` : ""}
          </a>`).join("")}
      </div>`;
  }).join("") + (isSuperAdmin() ? `
      <div class="nav-group">
        <div class="nav-group-label">Csak Super Admin</div>
        <a href="#/channels" class="nav-link ${path === "/channels" || path.startsWith("/channels/") ? "active" : ""}">
          <span class="ic">▧</span>Csatornák
        </a>
        <a href="#/training-center" class="nav-link ${path === "/training-center" || path.startsWith("/training-center/") ? "active" : ""}">
          <span class="ic">🎓</span>Training Center
        </a>
      </div>` : "");
}

/* ---------- Routes -------------------------------------------------- */
registerRoute("/dashboard", () => renderDashboard(document.getElementById("content")));
registerRoute("/personnel", () => renderPersonnelList(document.getElementById("content")));
registerRoute("/personnel/:id", (p) => renderProfile(document.getElementById("content"), p.id));
registerRoute("/matrix", () => renderMatrix(document.getElementById("content")));
registerRoute("/protocols", () => renderProtocolsList(document.getElementById("content")));
registerRoute("/protocols/:id", (p) => renderProtocolDetail(document.getElementById("content"), p.id));
registerRoute("/plans", () => renderTrainingPlansList(document.getElementById("content")));
registerRoute("/plans/:id", (p) => renderTrainingPlanDetail(document.getElementById("content"), p.id));
registerRoute("/recruitment", () => renderRecruitmentHub(document.getElementById("content")));
registerRoute("/recruitment/:id", (p) => renderApplicantDetail(document.getElementById("content"), p.id));
registerRoute("/exam", () => renderExamList(document.getElementById("content")));
registerRoute("/exam/:id", (p) => renderExamDetail(document.getElementById("content"), p.id));
registerRoute("/locations", () => renderLocationsList(document.getElementById("content")));
registerRoute("/locations/:id", (p) => renderLocationDetail(document.getElementById("content"), p.id));
registerRoute("/map", () => renderMapPage(document.getElementById("content")));
registerRoute("/map/:mapId", (p) => renderMapPage(document.getElementById("content"), p.mapId));
registerRoute("/admin", () => renderAdmin(document.getElementById("content")));
registerRoute("/readiness", () => renderReadiness(document.getElementById("content")));
registerRoute("/operations/:type", (p) => renderOperations(document.getElementById("content"), p.type));
registerRoute("/investigations", () => renderInvestigationList(document.getElementById("content")));
registerRoute("/investigations/:id", (p) => renderInvestigationDetail(document.getElementById("content"), p.id));
registerRoute("/covert-ops", () => renderCovertOpList(document.getElementById("content")));
registerRoute("/covert-ops/:id", (p) => renderCovertOpDetail(document.getElementById("content"), p.id));
registerRoute("/channels", () => renderChannelsHub(document.getElementById("content")));
registerRoute("/channels/:channelId", (p) => renderChannelsHub(document.getElementById("content"), p.channelId));
registerRoute("/training-center", () => renderTrainingCenterCategories(document.getElementById("content")));
registerRoute("/training-center/:categoryId", (p) => renderTrainingCenterCategory(document.getElementById("content"), p.categoryId));
registerRoute("/training-center/:categoryId/:docId", (p) => renderTrainingCenterDoc(document.getElementById("content"), p.categoryId, p.docId));

/* Az útvonal első (operations esetén első két) szegmenséből számolja ki,
   melyik "szoba" felel meg neki — ugyanaz az id, mint a SECTIONS-ban. */
function sectionForPath(path) {
  const clean = path.replace(/^\//, "");
  const first = clean.split("/")[0];
  if (first === "operations") return clean.split("/").slice(0, 2).join("/");
  if (first === "exam") return "recruitment";
  return first;
}

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
  const section = sectionForPath(currentPath());
  const superAdminOnly = section === "training-center" || section === "channels";
  const allowed = superAdminOnly ? isSuperAdmin() : hasSection(section);
  if (!allowed) {
    content.innerHTML = `<div class="denied"><div class="ic">⚠</div><h3>Hozzáférés megtagadva</h3><p class="text-low">Ehhez a részhez nincs jogosultságod. Kérj hozzáférést egy adminisztrátortól.</p></div>`;
    return;
  }
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
window.addEventListener("storage", () => {
  if (isAuthenticated()) onRouteChange();
});

/* Globális gyorsbillentyűk: "/" a kereséshez, Esc a modál/keresés záráshoz. */
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (document.getElementById("modal-overlay")) { closeModal(); return; }
    const results = document.getElementById("search-results");
    if (results && results.style.display !== "none") { results.style.display = "none"; document.getElementById("global-search")?.blur(); }
    return;
  }
  if (e.key !== "/") return;
  const active = document.activeElement;
  const typing = active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.tagName === "SELECT" || active.isContentEditable);
  if (typing) return;
  const search = document.getElementById("global-search");
  if (!search) return;
  e.preventDefault();
  search.focus();
});
