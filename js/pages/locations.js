import { getLocations, getLocation, upsertLocation, deleteLocation, ref, mapById } from "../store.js?v=10";
import { hasRole, actorLabel } from "../auth.js?v=10";
import { esc, fmtDateTime, toast, openModal, closeModal } from "../utils.js?v=10";
import { navigate } from "../router.js?v=10";
import { createPanZoomMap } from "../mapview.js?v=10";
import { openOnMap } from "./map.js?v=10";

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
            <div class="flex justify-between items-center">
              <div class="person-name">${esc(l.name)}</div>
              <span class="badge badge-gold">${esc(mapById(l.map || "los-santos").name)}</span>
            </div>
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
  const map = mapById(loc.map || "los-santos");

  container.innerHTML = `
    <a href="#/locations" class="text-low small">← Vissza a helyszínekhez</a>
    <div class="grid grid-2 mt-2" style="grid-template-columns: 1.1fr 1fr;">
      <div class="card">
        <div class="flex justify-between items-center mb-1">
          <h2 style="font-size:20px">${esc(loc.name)}</h2>
          ${canEdit ? `<div class="flex gap-1"><button class="btn btn-sm" id="edit-loc">Szerkeszt</button>${canAdmin ? `<button class="btn btn-sm btn-danger" id="del-loc">Törlés</button>` : ""}</div>` : ""}
        </div>
        <div class="text-low small mb-2">Helyszín: ${esc(loc.place)} · Térkép: <span class="badge badge-gold">${esc(map.name)}</span> · Bejáratok: ${loc.entrances.length}</div>
        <p class="text-mid">${esc(loc.description || "Nincs leírás megadva.")}</p>
        <div class="divider"></div>
        <div class="card-title mb-1">Bejáratok</div>
        ${loc.entrances.length ? loc.entrances.map((e, i) => `<div class="history-item"><span>${i + 1}. ${esc(e.name)}</span><span class="text-low small">${e.x !== undefined ? `X:${e.x.toFixed(0)} Y:${e.y.toFixed(0)}` : "—"}</span></div>`).join("") : `<div class="text-low small">Nincs rögzített bejárat.</div>`}
        <div class="divider"></div>
        <div class="small text-low">Utolsó módosítás: ${fmtDateTime(loc.updatedAt)} · ${esc(loc.updatedBy || "—")}</div>
      </div>
      <div class="card">
        <div class="flex justify-between items-center mb-1">
          <div class="card-title" style="margin:0">GTA V térkép</div>
          <button class="btn btn-sm" id="open-on-map">Megnyitás a térképen ↗</button>
        </div>
        <div class="loc-detail-canvas" id="loc-detail-canvas"></div>
      </div>
    </div>
  `;

  const api = createPanZoomMap(document.getElementById("loc-detail-canvas"), { image: map.image, alt: map.name });
  api.setPins([
    { id: loc.id, x: loc.x, y: loc.y, className: "pz-pin-location", title: loc.name },
    ...loc.entrances.filter((e) => e.x !== undefined).map((e, i) => ({ id: "e" + i, x: e.x, y: e.y, className: "pz-pin-entrance", title: e.name })),
  ]);
  setTimeout(() => api.focus(loc.x, loc.y, 2), 60);

  document.getElementById("open-on-map").addEventListener("click", () => openOnMap(loc.map || "los-santos", loc.id));
  document.getElementById("edit-loc")?.addEventListener("click", () => openLocationForm(loc));
  document.getElementById("del-loc")?.addEventListener("click", () => {
    if (confirm(`Biztosan törli a(z) ${loc.name} helyszínt?`)) {
      deleteLocation(loc.id, actorLabel());
      toast("Helyszín törölve");
      navigate("/locations");
    }
  });
}

export function openLocationForm(loc, preset = {}) {
  const isNew = !loc;
  let entrances = loc ? JSON.parse(JSON.stringify(loc.entrances || [])) : [];
  let pos = { x: loc?.x ?? preset.x ?? 50, y: loc?.y ?? preset.y ?? 50 };
  let mapId = loc?.map || preset.map || ref.MAPS[0].id;

  openModal(`
    <div class="modal-head"><h3>${isNew ? "Új védett helyszín" : "Helyszín szerkesztése"}</h3><button class="modal-close" data-close-modal>×</button></div>
    <form id="loc-form">
      <div class="grid grid-2">
        <div class="field"><label>Hely neve</label><input required id="lf-name" value="${esc(loc?.name || "")}" /></div>
        <div class="field"><label>Helyszín</label><input required id="lf-place" value="${esc(loc?.place || "")}" placeholder="pl. Los Santos, Downtown" /></div>
      </div>
      <div class="grid grid-2">
        <div class="field"><label>Térkép</label>
          <select id="lf-mapid">${ref.MAPS.map((m) => `<option value="${esc(m.id)}" ${mapId === m.id ? "selected" : ""}>${esc(m.name)}</option>`).join("")}</select>
        </div>
        <div class="field"><label>Kép URL (opcionális)</label><input id="lf-image" value="${esc(loc?.image || "")}" /></div>
      </div>
      <div class="field"><label>Rövid leírás</label><textarea id="lf-desc" rows="3">${esc(loc?.description || "")}</textarea></div>
      <div class="field">
        <label>Térképpozíció (kattintson a térképre a hely elhelyezéséhez)</label>
        <div class="loc-form-canvas" id="lf-map"></div>
      </div>
      <div class="field">
        <label>Bejáratok</label>
        <div class="flex gap-1"><input id="lf-entrance-name" placeholder="Bejárat neve, pl. Főbejárat" style="flex:1" /><button type="button" class="btn btn-sm" id="lf-add-entrance">+ Hozzáadás</button></div>
        <div id="lf-entrance-list" class="mt-1"></div>
        <div class="hint">Hozzáadás után kattints a "Pozíció" gombra, majd a térképre.</div>
      </div>
      <div class="flex justify-between mt-2">
        <button type="button" class="btn" data-close-modal>Mégse</button>
        <button type="submit" class="btn btn-gold">Mentés</button>
      </div>
    </form>
  `);

  let placingEntranceIdx = null;
  let mapApi = createPanZoomMap(document.getElementById("lf-map"), { image: mapById(mapId).image, alt: mapById(mapId).name, editable: true });

  function redrawEntrances() {
    document.getElementById("lf-entrance-list").innerHTML = entrances.map((e, i) => `
      <div class="module-row" style="cursor:default; padding:7px 10px;">
        <span>${i + 1}. ${esc(e.name)} ${e.x !== undefined ? `<span class="text-low small">(pozíció megadva)</span>` : `<span class="text-low small">(nincs pozíció)</span>`}</span>
        <div class="flex gap-1">
          <button type="button" class="btn btn-sm" data-place-idx="${i}">Pozíció</button>
          <button type="button" class="btn btn-sm" data-remove-idx="${i}">×</button>
        </div>
      </div>`).join("");
    document.querySelectorAll("[data-place-idx]").forEach((b) =>
      b.addEventListener("click", () => { placingEntranceIdx = Number(b.getAttribute("data-place-idx")); toast("Kattints a térképre a bejárat pozíciójához."); })
    );
    document.querySelectorAll("[data-remove-idx]").forEach((b) =>
      b.addEventListener("click", () => { entrances.splice(Number(b.getAttribute("data-remove-idx")), 1); redrawEntrances(); redrawPins(); })
    );
  }
  function redrawPins() {
    mapApi.setPins([
      { id: "main", x: pos.x, y: pos.y, className: "pz-pin-location", title: "Fő pozíció" },
      ...entrances.filter((e) => e.x !== undefined).map((e, i) => ({ id: "e" + i, x: e.x, y: e.y, className: "pz-pin-entrance", title: e.name })),
    ]);
  }

  mapApi.onMapClick((p) => {
    if (placingEntranceIdx !== null) {
      entrances[placingEntranceIdx].x = p.x;
      entrances[placingEntranceIdx].y = p.y;
      placingEntranceIdx = null;
      redrawEntrances();
    } else {
      pos = { x: p.x, y: p.y };
    }
    redrawPins();
  });

  document.getElementById("lf-mapid").addEventListener("change", (e) => {
    mapId = e.target.value;
    const m = mapById(mapId);
    mapApi.destroy();
    mapApi = createPanZoomMap(document.getElementById("lf-map"), { image: m.image, alt: m.name, editable: true });
    mapApi.onMapClick((p) => {
      if (placingEntranceIdx !== null) {
        entrances[placingEntranceIdx].x = p.x;
        entrances[placingEntranceIdx].y = p.y;
        placingEntranceIdx = null;
        redrawEntrances();
      } else {
        pos = { x: p.x, y: p.y };
      }
      redrawPins();
    });
    redrawPins();
  });

  document.getElementById("lf-add-entrance").addEventListener("click", () => {
    const nameEl = document.getElementById("lf-entrance-name");
    if (!nameEl.value.trim()) return;
    entrances.push({ name: nameEl.value.trim() });
    nameEl.value = "";
    redrawEntrances();
  });

  redrawEntrances();
  redrawPins();

  document.getElementById("loc-form").addEventListener("submit", (e) => {
    e.preventDefault();
    upsertLocation({
      id: loc?.id,
      name: document.getElementById("lf-name").value.trim(),
      place: document.getElementById("lf-place").value.trim(),
      map: mapId,
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
