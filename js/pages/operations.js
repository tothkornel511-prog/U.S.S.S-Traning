import {
  OPERATION_TYPES,
  getOperationRecords,
  createOperationRecord,
  updateOperationRecord,
  archiveOperationRecord,
} from "../store.js?v=52";
import { actorLabel, hasRole } from "../auth.js?v=20";
import { esc, fmtDate, toast, openModal, closeModal } from "../utils.js?v=22";
import { navigate } from "../router.js?v=20";

const STATUS = ["OPEN", "IN REVIEW", "APPROVED", "REJECTED", "COMPLETED"];
const PRIORITIES = ["LOW", "NORMAL", "HIGH", "CRITICAL"];
const TEMPLATES = {
  reports: { label: "Általános szolgálati jelentés", description: "Mi történt?\nMikor és hol történt?\nKik voltak jelen?\nMilyen intézkedés történt?\nMi lett az eredmény?", action: "További intézkedés / ajánlás:" },
  advance: { label: "Advance Report", description: "Megközelítési lehetőségek:\nBejáratok és kijáratok:\nBiztonsági hiányosságok:\nTömeg és környezeti kockázatok:", action: "Javasolt intézkedések:\nEgyüttműködő szervek:" },
  threats: { label: "Threat Assessment", description: "Fenyegetés forrása:\nÉrintett védett személy vagy esemény:\nLeírás és hitelesség:\nSürgősség:", action: "Kockázatcsökkentő intézkedés:\nFelelős és felülvizsgálat:" },
};

export function renderOperations(container, type = "reports") {
  const meta = OPERATION_TYPES[type] || OPERATION_TYPES.reports;
  const records = getOperationRecords(type);
  const canEdit = hasRole("TRAINING");
  container.innerHTML = `
    <div class="classification-strip">U.S.S.S. PARANCSNOKI KÖZPONT · ${esc(meta.label)}</div>
    <div class="command-page-head">
      <div><div class="eyebrow">MŰVELETI OSZTÁLY / ELLENŐRZÖTT NYILVÁNTARTÁS</div><h2>${esc(meta.label)}</h2><p class="text-low small">Strukturált védelmi nyilvántartás · minden módosítás auditálva.</p></div>
      <div class="operation-head-actions"><button class="btn btn-sm" id="export-operations">JSON export</button><button class="btn btn-sm" id="export-csv">CSV export</button>${canEdit ? `<button class="btn btn-gold" id="new-operation">+ ${esc(meta.singular)}</button>` : ""}</div>
    </div>
    <div class="filters operation-filters">
      <input id="operation-search" placeholder="Keresés azonosító, cím, személy, helyszín alapján" />
      <select id="operation-status"><option value="ALL">Minden státusz</option>${STATUS.map((value) => `<option>${value}</option>`).join("")}</select>
      <select id="operation-priority"><option value="ALL">Minden prioritás</option>${PRIORITIES.map((value) => `<option>${value}</option>`).join("")}</select>
      <label class="filter-check"><input type="checkbox" id="operation-archive" /> Archiváltak</label>
    </div>
    ${type === "notifications" ? renderNotificationsOverview() : ""}
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
  render();
}

function renderNotificationsOverview() {
  const records = getOperationRecords().filter((record) => !record.archived && (record.priority === "CRITICAL" || record.priority === "HIGH" || record.risk === "CRITICAL"));
  return `<div class="card notification-banner"><div class="eyebrow">AUTOMATIKUS VEZETŐI ÉRTESÍTÉSEK</div><h3>${records.length ? `${records.length} ügy figyelmet igényel` : "Nincs kiemelt nyitott figyelmeztetés"}</h3><p class="text-low small">Az értesítések a mentett operációs rekordok prioritásából és kockázati szintjéből készülnek.</p></div>`;
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
  openModal(`<div class="modal-head"><h3>${esc(meta.singular)} rögzítése</h3><button class="modal-close" data-close-modal>×</button></div>
    <form id="operation-form"><div class="field"><label>Megnevezés</label><input id="op-title" required autofocus /></div>
    <div class="grid grid-2"><div class="field"><label>Dátum</label><input id="op-date" type="date" value="${new Date().toISOString().slice(0, 10)}" /></div><div class="field"><label>Felelős</label><input id="op-owner" /></div><div class="field"><label>Helyszín</label><input id="op-location" /></div><div class="field"><label>Védett személy / érintett</label><input id="op-protectee" /></div><div class="field"><label>Státusz</label><select id="op-status">${STATUS.map((value) => `<option>${value}</option>`).join("")}</select></div><div class="field"><label>Prioritás</label><select id="op-priority">${PRIORITIES.map((value) => `<option>${value}</option>`).join("")}</select></div><div class="field"><label>Kockázati szint</label><select id="op-risk">${PRIORITIES.map((value) => `<option>${value}</option>`).join("")}</select></div></div>
    ${TEMPLATES[type] ? `<div class="field"><label>Sablon</label><select id="op-template"><option value="">Üres rekord</option><option value="default">${esc(TEMPLATES[type].label)}</option></select></div>` : ""}
    <div class="field"><label>Leírás</label><textarea id="op-description" rows="5" required></textarea></div><div class="field"><label>Intézkedés / eredmény / ajánlás</label><textarea id="op-action" rows="4"></textarea></div>
    <div class="flex justify-between"><button type="button" class="btn" data-close-modal>Mégse</button><button class="btn btn-gold">Mentés és auditálás</button></div></form>`);
  document.getElementById("operation-form").addEventListener("submit", (event) => {
    event.preventDefault();
    createOperationRecord(type, { title: document.getElementById("op-title").value, date: document.getElementById("op-date").value, owner: document.getElementById("op-owner").value, location: document.getElementById("op-location").value, protectee: document.getElementById("op-protectee").value, status: document.getElementById("op-status").value, priority: document.getElementById("op-priority").value, risk: document.getElementById("op-risk").value, description: document.getElementById("op-description").value, action: document.getElementById("op-action").value }, actorLabel());
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
