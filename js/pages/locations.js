import { getLocations, getLocation, upsertLocation, deleteLocation } from "../store.js";
import { hasRole, actorLabel } from "../auth.js";
import { esc, fmtDateTime, toast, openModal, closeModal } from "../utils.js";
import { navigate } from "../router.js";

export function renderLocationsList(container) {
  const canEdit = hasRole("TRAINING");
  const locations = getLocations();

  container.innerHTML = `
    <div class="section-head">
      <h2 style="visibility:hidden">.</h2>
      <div class="actions">${canEdit ? `<button class="btn btn-gold" id="new-loc">+ Új helyszín</button>` : ""}</div>
    </div>
    <div class="grid grid-3" id="loc-grid">
      ${locations.length ? locations.map((l) => `
        <div class="loc-card row-link" data-nav="/locations/${esc(l.id)}">
          <div class="loc-card-img">${l.image ? `<img src="${esc(l.image)}" style="width:100%;height:100%;object-fit:cover"/>` : "🛡️"}</div>
          <div class="loc-card-body">
            <div class="person-name">${esc(l.name)}</div>
            <div class="person-sub mb-1">${esc(l.place)}</div>
            <div class="small text-low">${l.entrances.length} bejárat</div>
          </div>
        </div>`).join("") : `<div class="empty-state" style="grid-column:1/-1"><h3>Nincs rögzített helyszín</h3></div>`}
    </div>
  `;
  container.querySelectorAll("[data-nav]").forEach((n) => n.addEventListener("click", () => navigate(n.getAttribute("data-nav"))));
  document.getElementById("new-loc")?.addEventListener("click", () => openLocationForm());
}

export function renderLocationDetail(container, id) {
  const loc = getLocation(id);
  if (!loc) {
    container.innerHTML = `<div class="empty-state"><h3>A helyszín nem található</h3><a class="btn mt-2" href="#/locations">Vissza</a></div>`;
    return;
  }
  const canEdit = hasRole("TRAINING");
  const canAdmin = hasRole("ADMIN");

  container.innerHTML = `
    <a href="#/locations" class="text-low small">← Vissza a helyszínekhez</a>
    <div class="grid grid-2 mt-2" style="grid-template-columns: 1.1fr 1fr;">
      <div class="card">
        <div class="flex justify-between items-center mb-1">
          <h2 style="font-size:20px">${esc(loc.name)}</h2>
          ${canEdit ? `<div class="flex gap-1"><button class="btn btn-sm" id="edit-loc">Szerkeszt</button>${canAdmin ? `<button class="btn btn-sm btn-danger" id="del-loc">Törlés</button>` : ""}</div>` : ""}
        </div>
        <div class="text-low small mb-2">Helyszín: ${esc(loc.place)} · Bejáratok: ${loc.entrances.length}</div>
        <p class="text-mid">${esc(loc.description || "Nincs leírás megadva.")}</p>
        <div class="divider"></div>
        <div class="card-title mb-1">Bejáratok</div>
        ${loc.entrances.length ? loc.entrances.map((e, i) => `<div class="history-item"><span>${i + 1}. ${esc(e.name)}</span><span class="text-low small">${e.x !== undefined ? `X:${e.x.toFixed(0)} Y:${e.y.toFixed(0)}` : "—"}</span></div>`).join("") : `<div class="text-low small">Nincs rögzített bejárat.</div>`}
        <div class="divider"></div>
        <div class="small text-low">Utolsó módosítás: ${fmtDateTime(loc.updatedAt)} · ${esc(loc.updatedBy || "—")}</div>
      </div>
      <div class="card">
        <div class="card-title mb-1">GTA V térkép (előnézeti pozíció)</div>
        <div class="map-canvas" id="map-canvas">
          <div class="map-pin" style="left:${loc.x}%; top:${loc.y}%" title="${esc(loc.name)}"></div>
          ${loc.entrances.map((e) => e.x !== undefined ? `<div class="map-pin entrance" style="left:${e.x}%; top:${e.y}%" title="${esc(e.name)}"></div>` : "").join("")}
          <div class="map-hint">Ide illeszthető be a hivatalos GTA V térképréteg</div>
        </div>
      </div>
    </div>
  `;

  document.getElementById("edit-loc")?.addEventListener("click", () => openLocationForm(loc));
  document.getElementById("del-loc")?.addEventListener("click", () => {
    if (confirm(`Biztosan törli a(z) ${loc.name} helyszínt?`)) {
      deleteLocation(loc.id, actorLabel());
      toast("Helyszín törölve");
      navigate("/locations");
    }
  });
}

function openLocationForm(loc) {
  const isNew = !loc;
  let entrances = loc ? JSON.parse(JSON.stringify(loc.entrances || [])) : [];
  let pos = { x: loc?.x ?? 50, y: loc?.y ?? 50 };

  openModal(`
    <div class="modal-head"><h3>${isNew ? "Új védett helyszín" : "Helyszín szerkesztése"}</h3><button class="modal-close" data-close-modal>×</button></div>
    <form id="loc-form">
      <div class="grid grid-2">
        <div class="field"><label>Hely neve</label><input required id="lf-name" value="${esc(loc?.name || "")}" /></div>
        <div class="field"><label>Helyszín</label><input required id="lf-place" value="${esc(loc?.place || "")}" placeholder="pl. Los Santos, Downtown" /></div>
      </div>
      <div class="field"><label>Kép URL (opcionális)</label><input id="lf-image" value="${esc(loc?.image || "")}" /></div>
      <div class="field"><label>Rövid leírás</label><textarea id="lf-desc" rows="3">${esc(loc?.description || "")}</textarea></div>
      <div class="field">
        <label>Térképpozíció (kattintson a térképre a hely elhelyezéséhez)</label>
        <div class="map-canvas" id="lf-map">
          <div class="map-pin" id="lf-pin" style="left:${pos.x}%; top:${pos.y}%"></div>
          <div id="lf-entrance-pins"></div>
          <div class="map-hint">Kattintson: fő pozíció</div>
        </div>
      </div>
      <div class="field">
        <label>Bejáratok</label>
        <div class="flex gap-1"><input id="lf-entrance-name" placeholder="Bejárat neve, pl. Főbejárat" style="flex:1" /><button type="button" class="btn btn-sm" id="lf-add-entrance">+ Hozzáadás</button></div>
        <div id="lf-entrance-list" class="mt-1"></div>
        <div class="hint">Hozzáadás után kattintson a térképre a bejárat pozíciójának megadásához.</div>
      </div>
      <div class="flex justify-between mt-2">
        <button type="button" class="btn" data-close-modal>Mégse</button>
        <button type="submit" class="btn btn-gold">Mentés</button>
      </div>
    </form>
  `);

  let placingEntranceIdx = null;

  function redrawEntrances() {
    document.getElementById("lf-entrance-list").innerHTML = entrances.map((e, i) => `
      <div class="module-row" style="cursor:default; padding:7px 10px;">
        <span>${i + 1}. ${esc(e.name)} ${e.x !== undefined ? `<span class="text-low small">(pozíció megadva)</span>` : `<span class="text-low small">(kattintson a térképre)</span>`}</span>
        <div class="flex gap-1">
          <button type="button" class="btn btn-sm" data-place-idx="${i}">Pozíció</button>
          <button type="button" class="btn btn-sm" data-remove-idx="${i}">×</button>
        </div>
      </div>`).join("");
    document.querySelectorAll("[data-place-idx]").forEach((b) =>
      b.addEventListener("click", () => { placingEntranceIdx = Number(b.getAttribute("data-place-idx")); toast("Kattintson a térképre a bejárat pozíciójához."); })
    );
    document.querySelectorAll("[data-remove-idx]").forEach((b) =>
      b.addEventListener("click", () => { entrances.splice(Number(b.getAttribute("data-remove-idx")), 1); redrawEntrances(); redrawPins(); })
    );
  }
  function redrawPins() {
    document.getElementById("lf-entrance-pins").innerHTML = entrances.map((e) =>
      e.x !== undefined ? `<div class="map-pin entrance" style="left:${e.x}%; top:${e.y}%"></div>` : ""
    ).join("");
  }

  document.getElementById("lf-add-entrance").addEventListener("click", () => {
    const nameEl = document.getElementById("lf-entrance-name");
    if (!nameEl.value.trim()) return;
    entrances.push({ name: nameEl.value.trim() });
    nameEl.value = "";
    redrawEntrances();
  });

  document.getElementById("lf-map").addEventListener("click", (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    if (placingEntranceIdx !== null) {
      entrances[placingEntranceIdx].x = x;
      entrances[placingEntranceIdx].y = y;
      placingEntranceIdx = null;
      redrawEntrances();
      redrawPins();
    } else {
      pos = { x, y };
      document.getElementById("lf-pin").style.left = x + "%";
      document.getElementById("lf-pin").style.top = y + "%";
    }
  });

  redrawEntrances();
  redrawPins();

  document.getElementById("loc-form").addEventListener("submit", (e) => {
    e.preventDefault();
    upsertLocation({
      id: loc?.id,
      name: document.getElementById("lf-name").value.trim(),
      place: document.getElementById("lf-place").value.trim(),
      image: document.getElementById("lf-image").value.trim(),
      description: document.getElementById("lf-desc").value.trim(),
      x: pos.x, y: pos.y,
      entrances,
    }, actorLabel());
    toast(isNew ? "Helyszín létrehozva" : "Helyszín frissítve");
    closeModal();
    navigate("/locations");
    renderLocationsList(document.getElementById("content"));
  });
}
