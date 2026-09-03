import { getPersonnel, getProtocols, getLocations, getOperationRecords, getReadinessState, READINESS_LEVELS, readinessPercent, ref } from "../store.js?v=41";
import { hasRole } from "../auth.js?v=20";
import { esc, initials } from "../utils.js?v=20";
import { navigate } from "../router.js?v=20";

export function renderDashboard(container) {
  const personnel = getPersonnel();
  const protocols = getProtocols();
  const locations = getLocations();
  const operations = getOperationRecords();
  const openOperations = operations.filter((record) => !record.archived && record.status !== "COMPLETED" && record.status !== "REJECTED");
  const criticalOperations = openOperations.filter((record) => record.priority === "CRITICAL" || record.risk === "CRITICAL");
  const readiness = getReadinessState();
  const today = new Date().toISOString().slice(0, 10);
  const todayOperations = openOperations.filter((record) => record.date === today);
  const openReports = openOperations.filter((record) => record.type === "reports").length;
  const activeProtectees = operations.filter((record) => record.type === "protectees" && !record.archived && record.status !== "REJECTED").length;
  const commandBrief = buildCommandBrief(readiness, openOperations, criticalOperations, activeProtectees);

  const active = personnel.filter((p) => p.status === "Aktív").length;
  const probationers = personnel.filter((p) => p.level === "0" && !p.probationLifted).length;
  const eligible = personnel.filter((p) => p.levelUpEligible).length;
  const avgReadiness = personnel.length
    ? Math.round(personnel.reduce((s, p) => s + readinessPercent(p), 0) / personnel.length)
    : 0;

  const recent = [...personnel]
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, 6);

  container.innerHTML = `
    <div class="grid grid-3 section">
      <div class="card row-link" data-nav="/personnel">
        <div class="card-title">👤 Állomány</div>
        <div class="card-value">${personnel.length}</div>
        <div class="card-sub">${active} aktív szolgálatban · ${probationers} próbaidős</div>
      </div>
      <div class="card row-link" data-nav="/protocols">
        <div class="card-title">📋 Jegyzőkönyvek</div>
        <div class="card-value">${protocols.length}</div>
        <div class="card-sub">Rögzített oktatás / vizsga dokumentáció</div>
      </div>
      <div class="card row-link" data-nav="/locations">
        <div class="card-title">🛡️ Védett helyszínek</div>
        <div class="card-value">${locations.length}</div>
        <div class="card-sub">Nyilvántartott objektum</div>
      </div>
    </div>

    <div class="card command-overview section">
      <div class="flex justify-between items-center mb-1 flex-wrap"><div><div class="eyebrow">EXECUTIVE CONTROL / LIVE STATUS</div><h2>COMMAND OVERVIEW</h2></div><a href="#/operations/reports" class="btn btn-sm">Operációs központ →</a></div>
      <div class="grid grid-3 command-overview-stats">
        <div><span class="card-title">Nyitott rekordok</span><strong>${openOperations.length}</strong><span class="text-low small">Jelentések, feladatok és műveletek</span></div>
        <div><span class="card-title">Kritikus figyelmeztetések</span><strong class="command-alert">${criticalOperations.length}</strong><span class="text-low small">Azonnali vezetői áttekintést igényel</span></div>
        <div><span class="card-title">Összes operációs rekord</span><strong>${operations.length}</strong><span class="text-low small">Archivált rekordok nélkül is visszakereshető</span></div>
        <div><span class="card-title">Belső készültség</span><strong class="readiness-text-${readiness.level}">${esc(READINESS_LEVELS[readiness.level].label.split(" · ")[0])}</strong><span class="text-low small">${esc(READINESS_LEVELS[readiness.level].description)}</span></div>
        <div><span class="card-title">Nyitott jelentések</span><strong>${openReports}</strong><span class="text-low small">Vezetői feldolgozásra vár</span></div>
        <div><span class="card-title">Aktív védett személyek</span><strong>${activeProtectees}</strong><span class="text-low small">Folyamatos védelmi nyilvántartás</span></div>
        <div><span class="card-title">Mai műveleti rekordok</span><strong>${todayOperations.length}</strong><span class="text-low small">A mai napra rögzített nyitott feladatok</span></div>
      </div>
    </div>

    ${criticalOperations.length ? `<div class="card command-alert-panel section"><div class="flex justify-between items-center mb-1"><div><div class="eyebrow">AZONNALI VEZETŐI FIGYELEM</div><h2>Kiemelt kockázatok</h2></div><a href="#/operations/notifications" class="btn btn-sm">Értesítések megnyitása</a></div>${criticalOperations.slice(0, 5).map((record) => `<div class="history-item"><span><strong class="text-hi">${esc(record.title)}</strong><span class="text-low small"> · ${esc(record.id)} · ${esc(record.location || "Helyszín nincs megadva")}</span></span><span class="badge badge-red">${esc(record.priority === "CRITICAL" ? "KRITIKUS" : "MAGAS KOCKÁZAT")}</span></div>`).join("")}</div>` : ""}

    <div class="card command-brief section"><div class="flex justify-between items-center mb-1"><div><div class="eyebrow">AUTOMATIKUS DÖNTÉSTÁMOGATÁS</div><h2>Vezetői helyzetértékelés</h2></div><span class="badge badge-gold">HELYI ELEMZÉS</span></div><p>${esc(commandBrief.summary)}</p><div class="brief-actions">${commandBrief.actions.map((action) => `<div class="brief-action"><span class="brief-index">${action.level}</span><span>${esc(action.text)}</span></div>`).join("")}</div><div class="text-low small mt-1">Az összefoglaló a rendszerben mentett rekordokból készül, külső adatot nem használ.</div></div>

    <div class="grid grid-2 section">
      <div class="card">
        <div class="card-title">Átlagos képzési készenlét</div>
        <div class="card-value">${avgReadiness}%</div>
        <div class="progress mt-1"><div style="width:${avgReadiness}%"></div></div>
        <div class="card-sub mt-1">Teljes állomány, minden szintfüggő modul alapján</div>
      </div>
      <div class="card">
        <div class="card-title">Szintlépésre jogosultak</div>
        <div class="card-value">${eligible}</div>
        <div class="card-sub">Teljesítették a jelenlegi szintjükhöz szükséges modulokat, admin jóváhagyásra várnak</div>
        ${eligible ? `<a href="#/personnel" class="btn btn-sm mt-2">Megtekintés</a>` : ""}
      </div>
    </div>

    <div class="section">
      <div class="section-head">
        <h2>Legutóbb felvett személyek</h2>
        <a href="#/personnel" class="btn btn-sm">Teljes állomány →</a>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Név</th><th>Pozíció</th><th>Szint</th><th>Státusz</th><th>Készenlét</th></tr></thead>
          <tbody>
            ${recent.map((p) => `
              <tr class="row-link" data-nav="/personnel/${esc(p.usssId)}">
                <td><div class="person-cell">
                  <div class="avatar">${p.photo ? `<img src="${esc(p.photo)}"/>` : initials(p.name)}</div>
                  <div><div class="person-name">${esc(p.name)}</div><div class="person-sub">${esc(p.usssId)}</div></div>
                </div></td>
                <td>${esc(p.position)}</td>
                <td><span class="level-chip">${esc(p.level)}</span></td>
                <td>${statusPill(p.status)}</td>
                <td>${readinessPercent(p)}%</td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>
    </div>

    ${!hasRole("TRAINING") ? `<div class="text-low small">Megtekintési jogosultsággal rendelkezik. Módosításokhoz Oktatásvezetői vagy Admin jogosultság szükséges.</div>` : ""}
  `;

  container.querySelectorAll("[data-nav]").forEach((n) =>
    n.addEventListener("click", () => navigate(n.getAttribute("data-nav")))
  );
}

function buildCommandBrief(readiness, openOperations, criticalOperations, activeProtectees) {
  const level = readiness.level === "red" ? "Vörös készültség mellett" : readiness.level === "yellow" ? "Sárga készültség mellett" : "Zöld készültség mellett";
  const summary = `${level} jelenleg ${activeProtectees} védett személy és ${openOperations.length} nyitott operációs rekord tartozik a parancsnoki áttekintéshez.`;
  const actions = [];
  if (criticalOperations.length) actions.push({ level: "01", text: `${criticalOperations.length} kritikus rekord azonnali vezetői ellenőrzése szükséges.` });
  if (readiness.level !== "green") actions.push({ level: "02", text: "A kijelölt állomány és a védelmi tervek felülvizsgálata javasolt." });
  if (openOperations.length > 5) actions.push({ level: "03", text: "A nyitott ügyek felelőseinek és határidőinek áttekintése szükséges." });
  if (!actions.length) actions.push({ level: "01", text: "Nincs automatikusan kiemelt kockázat; a normál vezetői ellenőrzési rend fenntartása javasolt." });
  return { summary, actions };
}

function statusPill(status) {
  const map = { "Aktív": "green", "Újonc": "gold", "Inaktív": "gray", "Felfüggesztett": "red" };
  return `<span class="badge badge-${map[status] || "gray"}">${esc(status)}</span>`;
}
