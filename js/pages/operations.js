import {
  OPERATION_TYPES,
  getOperationRecords,
  createOperationRecord,
  updateOperationRecord,
  archiveOperationRecord,
} from "../store.js?v=27";
import { actorLabel, hasRole } from "../auth.js?v=20";
import { esc, fmtDate, toast, openModal, closeModal } from "../utils.js?v=20";
import { navigate } from "../router.js?v=20";

const STATUS = ["OPEN", "IN REVIEW", "APPROVED", "REJECTED", "COMPLETED"];
const PRIORITIES = ["LOW", "NORMAL", "HIGH", "CRITICAL"];

export function renderOperations(container, type = "reports") {
  const meta = OPERATION_TYPES[type] || OPERATION_TYPES.reports;
  const records = getOperationRecords(type);
  const canEdit = hasRole("TRAINING");
  container.innerHTML = `
    <div class="classification-strip">U.S.S.S. COMMAND CENTER · ${esc(meta.label)}</div>
    <div class="command-page-head">
      <div><div class="eyebrow">OPERATIONS DIVISION / CONTROLLED RECORDS</div><h2>${esc(meta.label)}</h2><p class="text-low small">Strukturált operációs nyilvántartás · minden módosítás auditálva.</p></div>
      ${canEdit ? `<button class="btn btn-gold" id="new-operation">+ ${esc(meta.singular)}</button>` : ""}
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
    container.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => openRecordView(records.find((record) => record.id === button.dataset.view))));
    container.querySelectorAll("[data-archive]").forEach((button) => button.addEventListener("click", () => {
      archiveOperationRecord(button.dataset.archive, button.dataset.value !== "true", actorLabel());
      toast(button.dataset.value === "true" ? "Rekord archiválva" : "Rekord visszaállítva");
      render();
    }));
  };
  ["operation-search", "operation-status", "operation-priority", "operation-archive"].forEach((id) => document.getElementById(id).addEventListener("input", render));
  document.getElementById("new-operation")?.addEventListener("click", () => openOperationForm(type, meta));
  render();
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

function openRecordView(record) {
  if (!record) return;
  openModal(`<div class="modal-head"><h3>${esc(record.title)}</h3><button class="modal-close" data-close-modal>×</button></div>
    <div class="record-detail-grid"><div><span class="card-title">Azonosító</span><strong>${esc(record.id)}</strong></div><div><span class="card-title">Státusz</span><strong>${esc(record.status)}</strong></div><div><span class="card-title">Prioritás</span><strong>${esc(record.priority)}</strong></div><div><span class="card-title">Dátum</span><strong>${esc(fmtDate(record.date))}</strong></div><div><span class="card-title">Felelős</span><strong>${esc(record.owner || "—")}</strong></div><div><span class="card-title">Helyszín</span><strong>${esc(record.location || "—")}</strong></div></div>
    <div class="field mt-2"><label>Leírás</label><div class="record-detail-text">${esc(record.description || "—")}</div></div><div class="field"><label>Intézkedés / eredmény</label><div class="record-detail-text">${esc(record.action || "—")}</div></div><div class="field"><label>Előzmények</label>${(record.history || []).slice().reverse().map((item) => `<div class="history-item"><span>${esc(item.action)}</span><span class="text-low small">${esc(item.by)} · ${fmtDate(item.at)}</span></div>`).join("")}</div>`);
}

function openOperationForm(type, meta) {
  openModal(`<div class="modal-head"><h3>${esc(meta.singular)} rögzítése</h3><button class="modal-close" data-close-modal>×</button></div>
    <form id="operation-form"><div class="field"><label>Megnevezés</label><input id="op-title" required autofocus /></div>
    <div class="grid grid-2"><div class="field"><label>Dátum</label><input id="op-date" type="date" value="${new Date().toISOString().slice(0, 10)}" /></div><div class="field"><label>Felelős</label><input id="op-owner" /></div><div class="field"><label>Helyszín</label><input id="op-location" /></div><div class="field"><label>Védett személy / érintett</label><input id="op-protectee" /></div><div class="field"><label>Státusz</label><select id="op-status">${STATUS.map((value) => `<option>${value}</option>`).join("")}</select></div><div class="field"><label>Prioritás</label><select id="op-priority">${PRIORITIES.map((value) => `<option>${value}</option>`).join("")}</select></div></div>
    <div class="field"><label>Leírás</label><textarea id="op-description" rows="4" required></textarea></div><div class="field"><label>Intézkedés / eredmény / ajánlás</label><textarea id="op-action" rows="3"></textarea></div>
    <div class="flex justify-between"><button type="button" class="btn" data-close-modal>Mégse</button><button class="btn btn-gold">Mentés és auditálás</button></div></form>`);
  document.getElementById("operation-form").addEventListener("submit", (event) => {
    event.preventDefault();
    createOperationRecord(type, { title: document.getElementById("op-title").value, date: document.getElementById("op-date").value, owner: document.getElementById("op-owner").value, location: document.getElementById("op-location").value, protectee: document.getElementById("op-protectee").value, status: document.getElementById("op-status").value, priority: document.getElementById("op-priority").value, description: document.getElementById("op-description").value, action: document.getElementById("op-action").value }, actorLabel());
    closeModal(); toast("Rekord mentve és auditálva"); renderOperations(document.getElementById("content"), type);
  });
}
