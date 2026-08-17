import { getPersonnel, upsertPerson, deletePerson, readinessPercent, ref, probationInfo, getPositions } from "../store.js?v=18";
import { hasRole, actorLabel } from "../auth.js?v=18";
import { esc, initials, toast, openModal, closeModal } from "../utils.js?v=18";
import { navigate } from "../router.js?v=18";

let state = { search: "", position: "", level: "", status: "" };

export function renderPersonnelList(container) {
  const canEdit = hasRole("TRAINING");
  const canAdmin = hasRole("ADMIN");
  const all = getPersonnel();

  container.innerHTML = `
    <div class="section-head">
      <h2 style="visibility:hidden">.</h2>
      <div class="actions">
        ${canEdit ? `<button class="btn btn-gold" id="new-person">+ Új személy</button>` : ""}
      </div>
    </div>
    <div class="filters">
      <input id="f-search" type="text" placeholder="Keresés név / USSS ID alapján…" />
      <select id="f-level"><option value="">Minden szint</option>${ref.LEVELS.map((l) => `<option value="${l.id}">${esc(l.label)}</option>`).join("")}</select>
      <select id="f-status"><option value="">Minden státusz</option>${ref.SERVICE_STATUSES.map((s) => `<option value="${s}">${s}</option>`).join("")}</select>
      <select id="f-position"><option value="">Minden pozíció</option>${getPositions().map((p) => `<option value="${esc(p)}">${esc(p)}</option>`).join("")}</select>
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th>Név</th><th>Pozíció</th><th>Szint</th><th>Státusz</th><th>Készenlét</th><th>Próbaidő</th>${canAdmin ? "<th></th>" : ""}</tr></thead>
      <tbody id="p-tbody"></tbody>
    </table></div>
  `;

  document.getElementById("f-search").value = state.search;
  document.getElementById("f-level").value = state.level;
  document.getElementById("f-status").value = state.status;
  document.getElementById("f-position").value = state.position;

  ["f-search", "f-level", "f-status", "f-position"].forEach((id) => {
    const el = document.getElementById(id);
    const evt = id === "f-search" ? "input" : "change";
    el.addEventListener(evt, () => {
      state.search = document.getElementById("f-search").value;
      state.level = document.getElementById("f-level").value;
      state.status = document.getElementById("f-status").value;
      state.position = document.getElementById("f-position").value;
      renderRows();
    });
  });

  if (canEdit) {
    document.getElementById("new-person").addEventListener("click", () => openPersonForm());
  }

  function renderRows() {
    const q = state.search.trim().toLowerCase();
    const rows = all.filter((p) => {
      if (q && !(p.name.toLowerCase().includes(q) || p.usssId.toLowerCase().includes(q))) return false;
      if (state.level && p.level !== state.level) return false;
      if (state.status && p.status !== state.status) return false;
      if (state.position && p.position !== state.position) return false;
      return true;
    });
    const tbody = document.getElementById("p-tbody");
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><h3>Nincs találat</h3><p>Módosítsa a szűrési feltételeket.</p></div></td></tr>`;
      return;
    }
    tbody.innerHTML = rows.map((p) => {
      const prob = probationInfo(p);
      return `
      <tr>
        <td class="row-link" data-nav="/personnel/${esc(p.usssId)}"><div class="person-cell">
          <div class="avatar">${p.photo ? `<img src="${esc(p.photo)}"/>` : initials(p.name)}</div>
          <div><div class="person-name">${esc(p.name)}</div><div class="person-sub">${esc(p.usssId)}</div></div>
        </div></td>
        <td class="row-link" data-nav="/personnel/${esc(p.usssId)}">${esc(p.position)}</td>
        <td class="row-link" data-nav="/personnel/${esc(p.usssId)}"><span class="level-chip">${esc(p.level)}</span>${p.levelUpEligible ? ' <span class="badge badge-gold">Szintlépésre jogosult</span>' : ""}</td>
        <td class="row-link" data-nav="/personnel/${esc(p.usssId)}">${statusPill(p.status)}</td>
        <td class="row-link" data-nav="/personnel/${esc(p.usssId)}">${readinessPercent(p)}%</td>
        <td class="row-link" data-nav="/personnel/${esc(p.usssId)}">${prob ? `<span class="badge ${prob.active ? "badge-yellow" : "badge-gray"}">${prob.active ? `Aktív · ${prob.daysLeft} nap` : "Lejárt"}</span>` : "—"}</td>
        ${canAdmin ? `<td><button class="btn btn-sm" data-edit="${esc(p.usssId)}">Szerkeszt</button></td>` : ""}
      </tr>`;
    }).join("");

    tbody.querySelectorAll("[data-nav]").forEach((n) => n.addEventListener("click", () => navigate(n.getAttribute("data-nav"))));
    tbody.querySelectorAll("[data-edit]").forEach((b) =>
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        const person = all.find((p) => p.usssId === b.getAttribute("data-edit"));
        openPersonForm(person);
      })
    );
  }

  renderRows();
}

function openPersonForm(person) {
  const isNew = !person;
  const positions = getPositions();
  const overlay = openModal(`
    <div class="modal-head">
      <h3>${isNew ? "Új személy felvétele" : "Profil szerkesztése"}</h3>
      <button class="modal-close" data-close-modal>×</button>
    </div>
    <form id="person-form">
      <div class="grid grid-2">
        <div class="field"><label>Teljes név</label><input required id="pf-name" value="${esc(person?.name || "")}" /></div>
        <div class="field"><label>USSS azonosító</label><input required id="pf-id" ${isNew ? "" : "readonly"} value="${esc(person?.usssId || "")}" placeholder="USSS-000" /></div>
        <div class="field"><label>Pozíció</label>
          <select id="pf-position">${positions.map((p) => `<option value="${esc(p)}" ${person?.position === p ? "selected" : ""}>${esc(p)}</option>`).join("")}</select>
        </div>
        <div class="field"><label>Szolgálati státusz</label>
          <select id="pf-status">${ref.SERVICE_STATUSES.map((s) => `<option ${person?.status === s ? "selected" : ""}>${s}</option>`).join("")}</select>
        </div>
        <div class="field"><label>Képzési szint</label>
          <select id="pf-level">${ref.LEVELS.map((l) => `<option value="${l.id}" ${person?.level === l.id ? "selected" : ""}>${esc(l.label)}</option>`).join("")}</select>
        </div>
        <div class="field"><label>Próbaidő kezdete</label><input type="date" id="pf-prob" value="${esc(person?.probationStart || "")}" /></div>
      </div>
      <div class="field"><label>Profilkép URL (opcionális)</label><input id="pf-photo" value="${esc(person?.photo || "")}" placeholder="https://…" /></div>
      <div class="field"><label>Megjegyzések</label><textarea id="pf-notes" rows="3">${esc(person?.notes || "")}</textarea></div>
      <div class="flex justify-between mt-2">
        ${!isNew ? `<button type="button" class="btn btn-danger" id="pf-delete">Törlés</button>` : "<span></span>"}
        <div class="flex gap-1">
          <button type="button" class="btn" data-close-modal>Mégse</button>
          <button type="submit" class="btn btn-gold">Mentés</button>
        </div>
      </div>
    </form>
  `);

  document.getElementById("person-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const usssId = document.getElementById("pf-id").value.trim();
    if (!usssId) return toast("Az USSS azonosító megadása kötelező.", "warn");
    upsertPerson({
      usssId,
      name: document.getElementById("pf-name").value.trim(),
      position: document.getElementById("pf-position").value,
      status: document.getElementById("pf-status").value,
      level: document.getElementById("pf-level").value,
      probationStart: document.getElementById("pf-prob").value,
      photo: document.getElementById("pf-photo").value.trim(),
      notes: document.getElementById("pf-notes").value.trim(),
    }, actorLabel());
    toast(isNew ? "Személy felvéve" : "Profil frissítve");
    closeModal();
    navigate("/personnel");
    renderPersonnelList(document.getElementById("content"));
  });

  if (!isNew) {
    document.getElementById("pf-delete").addEventListener("click", () => {
      if (confirm(`Biztosan törli ${person.name} profilját?`)) {
        deletePerson(person.usssId, actorLabel());
        toast("Személy törölve");
        closeModal();
        renderPersonnelList(document.getElementById("content"));
      }
    });
  }
}

function statusPill(status) {
  const map = { "Aktív": "green", "Újonc": "gold", "Inaktív": "gray", "Felfüggesztett": "red" };
  return `<span class="badge badge-${map[status] || "gray"}">${esc(status)}</span>`;
}
