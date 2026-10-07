import {
  OPERATION_TYPES,
  PROTECTION_LEVELS,
  getProtectionLevelNotes,
  setProtectionLevelNote,
  getOperationRecords,
  createOperationRecord,
  updateOperationRecord,
  archiveOperationRecord,
} from "../store.js?v=86";
import { actorLabel, hasRole } from "../auth.js?v=20";
import { esc, fmtDate, toast, openModal, closeModal, applyBranding } from "../utils.js?v=31";
import { navigate } from "../router.js?v=20";

const STATUS = ["OPEN", "IN REVIEW", "APPROVED", "REJECTED", "COMPLETED"];
const PRIORITIES = ["LOW", "NORMAL", "HIGH", "CRITICAL"];
const TEMPLATES = {
  reports: { label: "Általános szolgálati jelentés", description: "Mi történt?\nMikor és hol történt?\nKik voltak jelen?\nMilyen intézkedés történt?\nMi lett az eredmény?", action: "További intézkedés / ajánlás:" },
};
/* Advance Work: a generikus leírás/intézkedés két szabad mező helyett
   tagolt, valódi Advance Report-mezőket kap — ezek mentéskor egyetlen
   címkézett description/action szövegbe íródnak össze, mert a megosztott
   operációs rekord-séma (createOperationRecord) nem vesz fel tetszőleges
   extra mezőt. */
const ADVANCE_FIELDS = {
  description: [
    { key: "approach", label: "Megközelítési lehetőségek" },
    { key: "entrances", label: "Bejáratok és kijáratok" },
    { key: "gaps", label: "Biztonsági hiányosságok" },
    { key: "crowd", label: "Tömeg és környezeti kockázatok" },
  ],
  action: [
    { key: "recommendations", label: "Javasolt intézkedések" },
    { key: "partners", label: "Együttműködő szervek" },
  ],
};

export function renderOperations(container, type = "reports") {
  if (type === "protection-levels") return renderProtectionLevels(container);
  const meta = OPERATION_TYPES[type] || OPERATION_TYPES.reports;
  const records = getOperationRecords(type);
  const canEdit = hasRole("TRAINING");
  container.innerHTML = `
    <div class="page-banner page-banner-command">
      <div class="page-banner-body">
        <div class="eyebrow">PARANCSNOKI KÖZPONT</div>
        <h2>${esc(meta.label)}</h2>
        <p>Strukturált védelmi nyilvántartás — minden módosítás auditálva.</p>
      </div>
    </div>
    <div class="classification-strip">U.S.S.S. PARANCSNOKI KÖZPONT · ${esc(meta.label)}</div>
    <div class="command-page-head">
      <div class="eyebrow">MŰVELETI OSZTÁLY / ELLENŐRZÖTT NYILVÁNTARTÁS</div>
      <div class="operation-head-actions"><button class="btn btn-sm" id="export-operations">JSON export</button><button class="btn btn-sm" id="export-csv">CSV export</button>${canEdit ? `<button class="btn btn-gold" id="new-operation">+ ${esc(meta.singular)}</button>` : ""}</div>
    </div>
    <div class="filters operation-filters">
      <input id="operation-search" placeholder="Keresés azonosító, cím, személy, helyszín alapján" />
      <select id="operation-status"><option value="ALL">Minden státusz</option>${STATUS.map((value) => `<option>${value}</option>`).join("")}</select>
      <select id="operation-priority"><option value="ALL">Minden prioritás</option>${PRIORITIES.map((value) => `<option>${value}</option>`).join("")}</select>
      <label class="filter-check"><input type="checkbox" id="operation-archive" /> Archiváltak</label>
    </div>
    <div class="operation-grid" id="operation-list"></div>
  `;
  const render = () => {
    const query = document.getElementById("operation-search").value.toLowerCase().trim();
    const status = document.getElementById("operation-status").value;
    const priority = document.getElementById("operation-priority").value;
    const includeArchived = document.getElementById("operation-archive").checked;
    const filtered = records.filter((record) => {
      const haystack = [record.id, record.title, record.owner, record.location, record.protectee, record.description].join(" ").toLowerCase();
      return (includeArchived ? record.archived : !record.archived) && (!query || haystack.includes(query)) && (status === "ALL" || record.status === status) && (priority === "ALL" || record.priority === priority);
    });
    document.getElementById("operation-list").innerHTML = filtered.length ? filtered.map((record) => renderRecord(record, canEdit)).join("") : `<div class="card empty-state"><h3>Nincs rögzített rekord</h3><p>Hozza létre az első ${esc(meta.singular.toLowerCase())} rekordot.</p></div>`;
    container.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => openRecordView(records.find((record) => record.id === button.dataset.view), canEdit)));
    container.querySelectorAll("[data-archive]").forEach((button) => button.addEventListener("click", () => {
      archiveOperationRecord(button.dataset.archive, button.dataset.value !== "true", actorLabel());
      toast(button.dataset.value === "true" ? "Rekord archiválva" : "Rekord visszaállítva");
      render();
    }));
  };
  ["operation-search", "operation-status", "operation-priority", "operation-archive"].forEach((id) => document.getElementById(id).addEventListener("input", render));
  document.getElementById("new-operation")?.addEventListener("click", () => openOperationForm(type, meta));
  document.getElementById("export-operations")?.addEventListener("click", () => exportOperations(records, meta.label));
  document.getElementById("export-csv")?.addEventListener("click", () => exportCsv(records, meta.label));
  applyBranding(container.querySelector(".page-banner-command"), "hero-command-ops");
  render();
}

/* Védelmi fokozatok — a PROTECTION_LEVELS 4 fix tétele rögzített szabályzati
   referencia, nem nyitható/zárható, archiválható "ügy" — ezért itt NEM az
   általános operációs-rekord listát használjuk, hanem egy saját, egyszerű
   nézetet: a 4 szint leírása + egy admin-szerkeszthető alkalmazási
   megjegyzés fokozatonként (lásd getProtectionLevelNotes/setProtectionLevelNote). */
function renderProtectionLevels(container) {
  const canEdit = hasRole("TRAINING");
  const meta = OPERATION_TYPES["protection-levels"];
  const draw = () => {
    const notes = getProtectionLevelNotes();
    container.innerHTML = `
      <div class="page-banner page-banner-command">
        <div class="page-banner-body">
          <div class="eyebrow">PARANCSNOKI KÖZPONT</div>
          <h2>${esc(meta.label)}</h2>
          <p>Rögzített védelmi szint-rendszer — a besorolás minden védett személyhez, eseményhez vagy helyszínhez vezetői döntéssel rendelhető hozzá.</p>
        </div>
      </div>
      <div class="classification-strip">U.S.S.S. PARANCSNOKI KÖZPONT · ${esc(meta.label)}</div>
      <div class="grid grid-2" id="protection-level-grid">
        ${PROTECTION_LEVELS.map((level) => `
          <div class="card protection-level-card">
            <div class="flex justify-between items-center mb-1">
              <span class="badge badge-gold" style="font-family:var(--font-mono)">${esc(level.id)}</span>
            </div>
            <div class="card-title">${esc(level.label)}</div>
            <p class="text-mid">${esc(level.description)}</p>
            <div class="field mt-1">
              <label>Alkalmazási megjegyzés</label>
              ${canEdit
                ? `<textarea rows="3" data-note="${esc(level.id)}" placeholder="pl. mikor, kikre kell kiosztani ezt a szintet…">${esc(notes[level.id] || "")}</textarea>`
                : `<div class="record-detail-text">${esc(notes[level.id] || "—")}</div>`}
            </div>
            ${canEdit ? `<button class="btn btn-sm mt-1" data-save-note="${esc(level.id)}">Mentés</button>` : ""}
          </div>`).join("")}
      </div>
    `;
    applyBranding(container.querySelector(".page-banner-command"), "hero-command-ops");
    container.querySelectorAll("[data-save-note]").forEach((button) => button.addEventListener("click", () => {
      const levelId = button.getAttribute("data-save-note");
      const text = container.querySelector(`[data-note="${levelId}"]`).value;
      setProtectionLevelNote(levelId, text, actorLabel());
      toast("Megjegyzés mentve");
    }));
  };
  draw();
}

function exportOperations(records, label) {
  const blob = new Blob([JSON.stringify({ title: label, exportedAt: new Date().toISOString(), records }, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `usss-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
  toast("Adatok exportálva");
}

function exportCsv(records, label) {
  const columns = ["Azonosító", "Megnevezés", "Dátum", "Státusz", "Prioritás", "Kockázat", "Védelmi szint", "Felelős", "Helyszín", "Védett személy", "Leírás", "Intézkedés"];
  const values = records.map((record) => [record.id, record.title, record.date, record.status, record.priority, record.risk, record.protectionLevel, record.owner, record.location, record.protectee, record.description, record.action]);
  const csv = [columns, ...values].map((row) => row.map((value) => `"${String(value || "").replace(/"/g, '""')}"`).join(";")).join("\r\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
  link.download = `usss-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
  toast("CSV export elkészült");
}

function renderRecord(record, canEdit) {
  return `<article class="operation-record ${record.priority === "CRITICAL" ? "operation-critical" : ""}">
    <div class="operation-record-top"><span class="record-id">${esc(record.id)}</span><span class="badge badge-${record.status === "COMPLETED" || record.status === "APPROVED" ? "green" : record.priority === "CRITICAL" ? "red" : "gold"}">${esc(record.status)}</span></div>
    <h3>${esc(record.title)}</h3><div class="record-meta"><span>${esc(record.date)}</span><span>${esc(record.location || "Helyszín nincs megadva")}</span></div>
    <p>${esc(record.description || "Nincs leírás rögzítve.")}</p>
    <div class="record-footer"><span>${esc(record.owner || "Felelős nincs kijelölve")}</span><span>${esc(record.protectee || "Nincs védett személy")}</span></div>
    <div class="record-actions"><button class="btn btn-sm" data-view="${esc(record.id)}">Részletek</button>${canEdit ? `<button class="btn btn-sm" data-archive="${esc(record.id)}" data-value="${record.archived}">${record.archived ? "Visszaállítás" : "Archiválás"}</button>` : ""}</div>
  </article>`;
}

function openRecordView(record, canEdit) {
  if (!record) return;
  openModal(`<div class="modal-head"><h3>${esc(record.title)}</h3><button class="modal-close" data-close-modal>×</button></div>
    <div class="record-detail-grid"><div><span class="card-title">Azonosító</span><strong>${esc(record.id)}</strong></div><div><span class="card-title">Státusz</span><strong>${esc(record.status)}</strong></div><div><span class="card-title">Prioritás</span><strong>${esc(record.priority)}</strong></div><div><span class="card-title">Dátum</span><strong>${esc(fmtDate(record.date))}</strong></div><div><span class="card-title">Felelős</span><strong>${esc(record.owner || "—")}</strong></div><div><span class="card-title">Helyszín</span><strong>${esc(record.location || "—")}</strong></div></div>
    <div class="record-actions record-detail-actions"><button class="btn btn-sm" id="print-record">Nyomtatás</button></div>
    <div class="field mt-2"><label>Leírás</label>${canEdit ? `<textarea id="record-description" rows="5">${esc(record.description || "")}</textarea>` : `<div class="record-detail-text">${esc(record.description || "—")}</div>`}</div><div class="field"><label>Intézkedés / eredmény</label>${canEdit ? `<textarea id="record-action" rows="4">${esc(record.action || "")}</textarea>` : `<div class="record-detail-text">${esc(record.action || "—")}</div>`}</div>${canEdit ? `<div class="grid grid-2"><label class="field"><span>Státusz</span><select id="record-status">${STATUS.map((value) => `<option ${record.status === value ? "selected" : ""}>${value}</option>`).join("")}</select></label><label class="field"><span>Prioritás</span><select id="record-priority">${PRIORITIES.map((value) => `<option ${record.priority === value ? "selected" : ""}>${value}</option>`).join("")}</select></label></div><button class="btn btn-gold" id="save-record">Módosítások mentése</button>` : ""}<div class="field mt-2"><label>Előzmények</label>${(record.history || []).slice().reverse().map((item) => `<div class="history-item"><span>${esc(item.action)}</span><span class="text-low small">${esc(item.by)} · ${fmtDate(item.at)}</span></div>`).join("")}</div>`);
  document.getElementById("save-record")?.addEventListener("click", () => {
    updateOperationRecord(record.id, { description: document.getElementById("record-description").value, action: document.getElementById("record-action").value, status: document.getElementById("record-status").value, priority: document.getElementById("record-priority").value }, actorLabel());
    closeModal();
    toast("Rekord módosítva és auditálva");
    renderOperations(document.getElementById("content"), record.type);
  });
  document.getElementById("print-record")?.addEventListener("click", () => window.print());
}

function openOperationForm(type, meta) {
  const isAdvance = type === "advance";
  openModal(`<div class="modal-head"><h3>${esc(meta.singular)} rögzítése</h3><button class="modal-close" data-close-modal>×</button></div>
    <form id="operation-form"><div class="field"><label>Megnevezés</label><input id="op-title" required autofocus /></div>
    <div class="grid grid-2"><div class="field"><label>Dátum</label><input id="op-date" type="date" value="${new Date().toISOString().slice(0, 10)}" /></div><div class="field"><label>Felelős</label><input id="op-owner" /></div><div class="field"><label>Helyszín</label><input id="op-location" /></div><div class="field"><label>Védett személy / érintett</label><input id="op-protectee" /></div><div class="field"><label>Státusz</label><select id="op-status">${STATUS.map((value) => `<option>${value}</option>`).join("")}</select></div><div class="field"><label>Prioritás</label><select id="op-priority">${PRIORITIES.map((value) => `<option>${value}</option>`).join("")}</select></div><div class="field"><label>Kockázati szint</label><select id="op-risk">${PRIORITIES.map((value) => `<option>${value}</option>`).join("")}</select></div></div>
    ${isAdvance ? `
      <div class="card-title mt-1 mb-1">HELYSZÍNFELMÉRÉS</div>
      ${ADVANCE_FIELDS.description.map((f) => `<div class="field"><label>${esc(f.label)}</label><textarea id="adv-${f.key}" rows="2"></textarea></div>`).join("")}
      <div class="card-title mt-1 mb-1">INTÉZKEDÉSEK</div>
      ${ADVANCE_FIELDS.action.map((f) => `<div class="field"><label>${esc(f.label)}</label><textarea id="adv-${f.key}" rows="2"></textarea></div>`).join("")}
    ` : `
      ${TEMPLATES[type] ? `<div class="field"><label>Sablon</label><select id="op-template"><option value="">Üres rekord</option><option value="default">${esc(TEMPLATES[type].label)}</option></select></div>` : ""}
      <div class="field"><label>Leírás</label><textarea id="op-description" rows="5" required></textarea></div><div class="field"><label>Intézkedés / eredmény / ajánlás</label><textarea id="op-action" rows="4"></textarea></div>
    `}
    <div class="flex justify-between"><button type="button" class="btn" data-close-modal>Mégse</button><button class="btn btn-gold">Mentés és auditálás</button></div></form>`);
  document.getElementById("operation-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const base = { title: document.getElementById("op-title").value, date: document.getElementById("op-date").value, owner: document.getElementById("op-owner").value, location: document.getElementById("op-location").value, protectee: document.getElementById("op-protectee").value, status: document.getElementById("op-status").value, priority: document.getElementById("op-priority").value, risk: document.getElementById("op-risk").value };
    if (isAdvance) {
      base.description = ADVANCE_FIELDS.description.map((f) => `${f.label}:\n${document.getElementById(`adv-${f.key}`).value.trim()}`).join("\n\n");
      base.action = ADVANCE_FIELDS.action.map((f) => `${f.label}:\n${document.getElementById(`adv-${f.key}`).value.trim()}`).join("\n\n");
    } else {
      base.description = document.getElementById("op-description").value;
      base.action = document.getElementById("op-action").value;
    }
    createOperationRecord(type, base, actorLabel());
    closeModal(); toast("Rekord mentve és auditálva"); renderOperations(document.getElementById("content"), type);
  });
  document.getElementById("op-template")?.addEventListener("change", (event) => {
    const template = TEMPLATES[type];
    if (event.target.value && template) {
      document.getElementById("op-description").value = template.description;
      document.getElementById("op-action").value = template.action;
    }
  });
}
