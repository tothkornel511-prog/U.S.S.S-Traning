import { getPersonnel, getProtocols, getLocations, readinessPercent, ref } from "../store.js?v=7";
import { hasRole } from "../auth.js?v=7";
import { esc, initials } from "../utils.js?v=7";
import { navigate } from "../router.js?v=7";

export function renderDashboard(container) {
  const personnel = getPersonnel();
  const protocols = getProtocols();
  const locations = getLocations();

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

function statusPill(status) {
  const map = { "Aktív": "green", "Újonc": "gold", "Inaktív": "gray", "Felfüggesztett": "red" };
  return `<span class="badge badge-${map[status] || "gray"}">${esc(status)}</span>`;
}
