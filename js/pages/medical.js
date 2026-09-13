import {
  getPersonnel, getPerson, ref,
  getMedicalIntervals, setMedicalInterval,
  getMedicalRecords, getLatestMedicalRecord, createMedicalRecord, deleteMedicalRecord, medicalStatusFor,
} from "../store.js?v=70";
import { hasRole, actorLabel } from "../auth.js?v=23";
import { esc, fmtDate, toast, openModal, closeModal } from "../utils.js?v=31";

const STATUS_BADGE = {
  "rendben": { cls: "badge-green", label: "Rendben" },
  "hamarosan": { cls: "badge-yellow", label: "Hamarosan esedékes" },
  "lejart": { cls: "badge-red", label: "Lejárt" },
  "nincs-adat": { cls: "badge-gray", label: "Nincs adat" },
};

export function renderMedicalList(container) {
  const canEdit = hasRole("TRAINING");
  const personnel = getPersonnel();

  container.innerHTML = `
    <div class="classification-strip">U.S.S.S. ORVOSI ALKALMASSÁGI NYILVÁNTARTÁS</div>
    <p class="text-low small mb-2">Ki mikor esett át orvosi vizsgálaton, és fokozatonként beállított időköz alapján mikor esedékes a következő.</p>
    <div class="section-head">
      <h2 style="visibility:hidden">.</h2>
      <div class="actions">${canEdit ? `<button class="btn" id="edit-intervals">Fokozatonkénti időközök</button>` : ""}</div>
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th>Név</th><th>USSS ID</th><th>Fokozat</th><th>Utolsó orvosi</th><th>Következő esedékesség</th><th>Állapot</th>${canEdit ? "<th></th>" : ""}</tr></thead>
      <tbody>
        ${personnel.length ? personnel.map((p) => {
          const latest = getLatestMedicalRecord(p.usssId);
          const status = medicalStatusFor(p.usssId);
          const badge = STATUS_BADGE[status];
          return `<tr>
            <td class="text-hi"><a href="#/personnel/${esc(p.usssId)}">${esc(p.name)}</a></td>
            <td style="font-family:var(--font-mono)" class="text-low small">${esc(p.usssId)}</td>
            <td class="text-low small">${esc(p.level)}</td>
            <td class="text-low small">${latest ? fmtDate(latest.examDate) : "—"}</td>
            <td class="text-low small">${latest ? fmtDate(latest.nextDueDate) : "—"}</td>
            <td><span class="badge ${badge.cls}">${badge.label}</span></td>
            ${canEdit ? `<td><button class="btn btn-sm" data-log="${esc(p.usssId)}">+ Orvosi rögzítése</button></td>` : ""}
          </tr>`;
        }).join("") : `<tr><td colspan="7"><div class="empty-state"><h3>Nincs állomány</h3></div></td></tr>`}
      </tbody>
    </table></div>
  `;

  container.querySelectorAll("[data-log]").forEach((b) =>
    b.addEventListener("click", () => openLogForm(b.getAttribute("data-log"), () => renderMedicalList(container)))
  );
  document.getElementById("edit-intervals")?.addEventListener("click", () => openIntervalsForm(() => renderMedicalList(container)));
}

function openLogForm(usssId, onDone) {
  const person = getPerson(usssId);
  const history = getMedicalRecords(usssId);
  openModal(`
    <div class="modal-head"><h3>Orvosi vizsgálat rögzítése — ${esc(person?.name || usssId)}</h3><button class="modal-close" data-close-modal>×</button></div>
    <form id="med-form">
      <div class="field"><label>Vizsgálat dátuma</label><input type="date" id="med-date" value="${new Date().toISOString().slice(0, 10)}" required /></div>
      <div class="field"><label>Vizsgáló (opcionális)</label><input id="med-examiner" /></div>
      <div class="field"><label>Megjegyzés (opcionális)</label><textarea id="med-notes" rows="2"></textarea></div>
      <div class="flex justify-between mt-2">
        <button type="button" class="btn" data-close-modal>Mégse</button>
        <button type="submit" class="btn btn-gold">Rögzítés</button>
      </div>
    </form>
    ${history.length ? `
      <div class="divider"></div>
      <div class="card-title mb-1">Korábbi bejegyzések</div>
      ${history.map((r) => `<div class="history-item"><span class="text-hi">${fmtDate(r.examDate)}</span><span class="text-low small">Következő: ${fmtDate(r.nextDueDate)}${r.examinedBy ? ` · ${esc(r.examinedBy)}` : ""}</span><button class="btn btn-sm btn-danger" data-delete-med="${esc(r.id)}">×</button></div>`).join("")}
    ` : ""}
  `);

  document.getElementById("med-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const examDate = document.getElementById("med-date").value;
    const examinedBy = document.getElementById("med-examiner").value;
    const notes = document.getElementById("med-notes").value;
    const record = createMedicalRecord(usssId, { examDate, examinedBy, notes }, actorLabel());
    if (!record) return toast("Nem sikerült menteni.", "warn");
    toast(`Orvosi vizsgálat rögzítve — következő esedékesség: ${fmtDate(record.nextDueDate)}`);
    closeModal();
    onDone();
  });
  document.querySelectorAll("[data-delete-med]").forEach((b) =>
    b.addEventListener("click", () => {
      if (!confirm("Biztosan törli ezt a bejegyzést?")) return;
      deleteMedicalRecord(b.getAttribute("data-delete-med"), actorLabel());
      toast("Bejegyzés törölve");
      closeModal();
      openLogForm(usssId, onDone);
    })
  );
}

function openIntervalsForm(onDone) {
  const intervals = getMedicalIntervals();
  openModal(`
    <div class="modal-head"><h3>Fokozatonkénti orvosi időközök</h3><button class="modal-close" data-close-modal>×</button></div>
    <p class="text-low small mb-2">Ennyi hét vagy hónap múlva esedékes az újabb orvosi vizsgálat az adott fokozatban lévőknek — fokozatonként külön választható a mértékegység. A rendszer ez alapján számolja ki a következő esedékességet, amikor rögzítesz egy vizsgálatot.</p>
    <form id="interval-form">
      ${ref.LEVELS.map((l) => {
        const interval = intervals[l.id] || { amount: 12, unit: "month" };
        return `
        <div class="field flex items-center gap-1" style="justify-content:space-between">
          <label style="margin:0">${esc(l.label)}</label>
          <div class="flex items-center gap-1">
            <input type="number" min="1" style="width:70px" class="interval-amount" data-level="${esc(l.id)}" value="${interval.amount}" />
            <select class="interval-unit" data-level="${esc(l.id)}">
              <option value="week" ${interval.unit === "week" ? "selected" : ""}>hét</option>
              <option value="month" ${interval.unit === "month" ? "selected" : ""}>hónap</option>
            </select>
          </div>
        </div>`;
      }).join("")}
      <div class="flex justify-between mt-2">
        <button type="button" class="btn" data-close-modal>Mégse</button>
        <button type="submit" class="btn btn-gold">Mentés</button>
      </div>
    </form>
  `);
  document.getElementById("interval-form").addEventListener("submit", (e) => {
    e.preventDefault();
    document.querySelectorAll(".interval-amount").forEach((input) => {
      const level = input.getAttribute("data-level");
      const unit = document.querySelector(`.interval-unit[data-level="${level}"]`).value;
      setMedicalInterval(level, input.value, unit, actorLabel());
    });
    toast("Időközök mentve");
    closeModal();
    onDone();
  });
}
