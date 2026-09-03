import { actorLabel } from "../auth.js?v=20";
import { getAuditLog, logAudit } from "../store.js?v=40";
import { esc, fmtDateTime } from "../utils.js?v=20";

const SATCOM_URL = "https://bluedragon2satcom.replit.app/";
const AUDIT_ACTION = "SATCOM megnyitva";

export function renderSatcom(container) {
  container.innerHTML = `<div class="classification-strip">U.S.S.S. PARANCSNOKI KÖZPONT · SATCOM</div>
    <div class="command-page-head satcom-head">
      <div>
        <div class="eyebrow">BIZTONSÁGOS KOMMUNIKÁCIÓ · KÜLSŐ RENDSZER</div>
        <h2>Blue Dragon 2 SATCOM</h2>
        <p class="text-low small">Offline kiberkommunikációs és üzenetvédelmi rendszer. A kapcsolat és a hozzáférés naplózott.</p>
      </div>
      <span class="satcom-status"><span class="satcom-dot"></span>KAPCSOLAT AKTÍV</span>
    </div>

    <div class="grid grid-2">
      <section class="card">
        <div class="card-title">Végpont</div>
        <div class="satcom-endpoint">${esc(SATCOM_URL)}</div>
        <a class="btn btn-gold mt-2" href="${SATCOM_URL}" target="_blank" rel="noopener noreferrer" id="open-satcom">SATCOM megnyitása →</a>
        <p class="text-low small mt-2">A Blue Dragon 2 különálló, külső alkalmazás. Az U.S.S.S. rendszer nem tárolja és nem másolja a kulcsokat, üzeneteket vagy a titkosítási folyamatot — kizárólag a hozzáférést naplózza.</p>
      </section>

      <section class="card">
        <div class="card-title">Használati rend</div>
        <div class="satcom-rule"><strong>1.</strong><span>A külső SATCOM-rendszerben kezeld a titkosított üzeneteket és kulcsokat.</span></div>
        <div class="satcom-rule"><strong>2.</strong><span>Szolgálati kulcs cseréjét csak jogosult vezető rendelje el.</span></div>
        <div class="satcom-rule"><strong>3.</strong><span>Kulcsot, jelszót vagy visszafejtett üzenetet ne rögzíts az U.S.S.S. nyilvántartásban.</span></div>
        <div class="satcom-rule"><strong>4.</strong><span>Elérhetetlenség esetén használj vezető által kijelölt tartalék kommunikációs csatornát.</span></div>
      </section>
    </div>

    <section class="card mt-2">
      <div class="card-title">Hozzáférési napló</div>
      <div id="satcom-log"></div>
    </section>
  `;

  renderLog();

  document.getElementById("open-satcom").addEventListener("click", () => {
    logAudit(actorLabel(), AUDIT_ACTION, SATCOM_URL);
    renderLog();
  });
}

function renderLog() {
  const el = document.getElementById("satcom-log");
  if (!el) return;
  const entries = getAuditLog().filter((e) => e.action === AUDIT_ACTION).slice(0, 8);
  el.innerHTML = entries.length
    ? `<div class="table-wrap"><table>
        <thead><tr><th>Időpont</th><th>Ki nyitotta meg</th></tr></thead>
        <tbody>${entries.map((e) => `<tr><td class="text-low small" style="font-family:var(--font-mono)">${fmtDateTime(e.timestamp)}</td><td class="text-hi">${esc(e.actor)}</td></tr>`).join("")}</tbody>
      </table></div>`
    : `<p class="text-low small">Még nem történt naplózott hozzáférés.</p>`;
}
