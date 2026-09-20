import { getPersonnel, upsertPerson, deletePerson, readinessPercent, ref, probationInfo, getPositions, sortByRank, MAX_PHOTO_BYTES } from "../store.js?v=76";
import { hasRole, actorLabel } from "../auth.js?v=20";
import { esc, avatarContent, toast, openModal, closeModal } from "../utils.js?v=31";
import { navigate } from "../router.js?v=20";

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

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
    const rows = sortByRank(all.filter((p) => {
      if (q && !(p.name.toLowerCase().includes(q) || p.usssId.toLowerCase().includes(q))) return false;
      if (state.level && p.level !== state.level) return false;
      if (state.status && p.status !== state.status) return false;
      if (state.position && p.position !== state.position) return false;
      return true;
    }));
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
          <div class="avatar ${p.level === "V" ? "avatar-elite" : ""}">${avatarContent(p.photo, p.name)}</div>
          <div><div class="person-name">${esc(p.name)}</div><div class="person-sub">${esc(p.usssId)}</div></div>
        </div></td>
        <td class="row-link" data-nav="/personnel/${esc(p.usssId)}">${esc(p.position)}</td>
        <td class="row-link" data-nav="/personnel/${esc(p.usssId)}"><span class="level-chip ${p.level === "V" ? "level-chip-elite" : ""}">${esc(p.level)}</span>${p.level === "V" ? ' <span class="badge badge-orange">ELIT</span>' : ""}${p.levelUpEligible ? ' <span class="badge badge-gold">Szintlépésre jogosult</span>' : ""}</td>
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
      <div class="field">
        <label>Profilkép</label>
        <div class="avatar-upload-row">
          <div class="avatar avatar-lg" id="pf-photo-preview">${avatarContent(person?.photo, person?.name || "?")}</div>
          <div class="avatar-upload-actions">
            <input type="file" id="pf-photo-file" accept="image/*" />
            <span class="text-low small">Max. ${Math.round(MAX_PHOTO_BYTES / 1024)} KB, vagy adjon meg URL-t:</span>
            <input id="pf-photo" value="${esc(person?.photo && person.photo.startsWith("http") ? person.photo : "")}" placeholder="https://…" />
          </div>
        </div>
      </div>
      <div class="field"><label>Megjegyzések</label><textarea id="pf-notes" rows="3">${esc(person?.notes || "")}</textarea></div>
      <div class="flex justify-between mt-2">
        ${!isNew ? `<button type="button" class="btn btn-danger" id="pf-delete">Törlés</button>` : "<span></span>"}
        <div class="flex gap-1">
          <button type="button" class="btn" data-close-modal>Mégse</button>
          <button type="submit" class="btn btn-gold" id="pf-submit">Mentés</button>
        </div>
      </div>
    </form>
  `);

  let currentPhoto = person?.photo || "";
  const photoPreview = document.getElementById("pf-photo-preview");
  const photoUrlInput = document.getElementById("pf-photo");
  const submitBtn = document.getElementById("pf-submit");

  function setPhoto(dataUrlOrUrl) {
    currentPhoto = dataUrlOrUrl || "";
    photoPreview.innerHTML = avatarContent(currentPhoto, document.getElementById("pf-name").value || "?");
  }

  photoUrlInput.addEventListener("input", () => setPhoto(photoUrlInput.value.trim()));

  document.getElementById("pf-photo-file").addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast("Csak képfájl tölthető fel.", "warn");
    if (file.size > MAX_PHOTO_BYTES) return toast(`A kép túl nagy (max. ${Math.round(MAX_PHOTO_BYTES / 1024)} KB).`, "warn");
    submitBtn.disabled = true;
    try {
      const dataUrl = await readFileAsDataUrl(file);
      photoUrlInput.value = "";
      setPhoto(dataUrl);
    } catch {
      toast("Nem sikerült beolvasni a képet.", "warn");
    } finally {
      submitBtn.disabled = false;
    }
  });

  document.getElementById("person-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const usssId = document.getElementById("pf-id").value.trim();
    if (!usssId) return toast("Az USSS azonosító megadása kötelező.", "warn");
    const ok = upsertPerson({
      usssId,
      name: document.getElementById("pf-name").value.trim(),
      position: document.getElementById("pf-position").value,
      status: document.getElementById("pf-status").value,
      level: document.getElementById("pf-level").value,
      probationStart: document.getElementById("pf-prob").value,
      photo: currentPhoto,
      notes: document.getElementById("pf-notes").value.trim(),
    }, actorLabel());
    if (!ok) return toast("Nem sikerült menteni — megtelt a böngésző helyi tárhelye. Próbáljon kisebb képet.", "warn");
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
