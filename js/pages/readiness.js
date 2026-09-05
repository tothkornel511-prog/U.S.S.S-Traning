import { getReadinessState, setReadinessState, READINESS_LEVELS, getAuditLog } from "../store.js?v=49";
import { hasRole, actorLabel } from "../auth.js?v=20";
import { esc, fmtDateTime, toast } from "../utils.js?v=22";

export function renderReadiness(container) {
  const state = getReadinessState();
  const canEdit = hasRole("TRAINING");
  const changes = getAuditLog().filter((item) => item.action === "Készültségi szint módosítva").slice(0, 12);
  container.innerHTML = `<div class="classification-strip">U.S.S.S. PARANCSNOKI KÖZPONT · KÉSZÜLTSÉG</div>
    <div class="command-page-head readiness-head"><div><div class="eyebrow">VEZETŐI KONTROLL / BELSŐ KÉSZENLÉTI ÁLLAPOT</div><h2>Belső készültségi rendszer</h2><p class="text-low small">A rendőrségi készültségi rendszertől független U.S.S.S. állapot.</p></div><span class="readiness-badge readiness-${state.level}">${esc(READINESS_LEVELS[state.level].label)}</span></div>
    <div class="readiness-levels">${Object.entries(READINESS_LEVELS).map(([key, level]) => `<article class="readiness-level ${key === state.level ? "active" : ""}"><span class="readiness-dot readiness-${key}"></span><h3>${esc(level.label)}</h3><p>${esc(level.description)}</p><button class="btn btn-sm" data-level="${key}" ${canEdit ? "" : "disabled"}>${key === state.level ? "Aktuális szint" : "Szint beállítása"}</button></article>`).join("")}</div>
    <div class="grid grid-2 mt-2"><div class="card"><div class="card-title">Aktuális indoklás</div><p class="readiness-reason">${esc(state.reason || "Nincs megadva")}</p><div class="text-low small">${state.changedAt ? `${esc(fmtDateTime(state.changedAt))} · ${esc(state.changedBy)}` : "Alapértelmezett állapot"}</div></div><div class="card"><div class="card-title">Vezetői működési elv</div><p class="readiness-reason">A készültségi szint emelése, csökkentése és megszüntetése kizárólag jogosult vezetői döntéssel történhet. Minden váltás naplózásra kerül.</p></div></div>
    <div class="card mt-2"><div class="card-title">Készültségi előzmények</div>${changes.length ? changes.map((item) => `<div class="history-item"><span>${esc(item.detail)}</span><span class="text-low small">${esc(item.actor)} · ${esc(fmtDateTime(item.timestamp))}</span></div>`).join("") : `<div class="text-low small">Még nincs rögzített szintváltás.</div>`}</div>`;
  container.querySelectorAll("[data-level]").forEach((button) => button.addEventListener("click", () => {
    const level = button.dataset.level;
    const reason = prompt("A készültségi szint módosításának indoka:", "");
    if (!reason?.trim()) return;
    setReadinessState(level, reason, actorLabel());
    toast("Készültségi szint mentve");
    renderReadiness(container);
  }));
}
