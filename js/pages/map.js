import { ref, mapById, locationsForMap, districtsForMap, upsertDistrict, deleteDistrict } from "../store.js?v=50";
import { hasRole, actorLabel } from "../auth.js?v=20";
import { esc, toast, openModal, closeModal } from "../utils.js?v=22";
import { navigate } from "../router.js?v=20";
import { createPanZoomMap } from "../mapview.js?v=21";
import { openLocationForm } from "./locations.js?v=20";

let activeMapId = null;
let addingDistrict = false;
let addingLocation = false;
let pendingFocus = null; // { mapId, locationId } set by openOnMap()

export function openOnMap(mapId, locationId) {
  pendingFocus = { mapId, locationId };
  navigate(`/map/${mapId}`);
}

export function renderMapPage(container, mapId) {
  const canEdit = hasRole("TRAINING");
  activeMapId = mapId || (pendingFocus && pendingFocus.mapId) || ref.MAPS[0].id;
  const map = mapById(activeMapId);

  container.innerHTML = `
    <div class="map-tabs">
      ${ref.MAPS.map((m) => `<button class="map-tab-btn ${m.id === activeMapId ? "active" : ""}" data-map="${esc(m.id)}">${esc(m.name)}</button>`).join("")}
    </div>
    <div class="map-layout">
      <div class="map-page-canvas" id="map-page-canvas"></div>
      <div class="card">
        <div class="flex justify-between items-center mb-1">
          <div class="card-title" style="margin:0">Regisztrált védett helyszínek — ${esc(map.name)}</div>
          ${canEdit ? `<button class="btn btn-sm" id="add-location-btn">+ Helyszín</button>` : ""}
        </div>
        <div id="map-loc-list"></div>
        <div class="divider"></div>
        <div class="flex justify-between items-center mb-1">
          <div class="card-title" style="margin:0">Körzetek</div>
          ${canEdit ? `<button class="btn btn-sm" id="add-district-btn">+ Körzet</button>` : ""}
        </div>
        <div id="map-district-list"></div>
      </div>
    </div>
    <div class="small text-low mt-2 flex items-center gap-1" style="flex-wrap:wrap"><span class="dot dot-red" style="width:7px;height:7px;vertical-align:middle"></span> Nincs teljesítve · <span class="dot dot-yellow" style="width:7px;height:7px;vertical-align:middle"></span> Elmélet kész, gyakorlatra vár · <span class="dot dot-green" style="width:7px;height:7px;vertical-align:middle"></span> Teljesítve — a pöttyök a védett helyszíneket jelölik, kattints rájuk a részletekért.</div>
  `;

  container.querySelectorAll(".map-tab-btn").forEach((b) =>
    b.addEventListener("click", () => {
      addingDistrict = false;
      navigate(`/map/${b.getAttribute("data-map")}`);
    })
  );

  const canvas = document.getElementById("map-page-canvas");
  const api = createPanZoomMap(canvas, { image: map.image, alt: map.name, editable: canEdit });

  function drawLocations() {
    const locs = locationsForMap(activeMapId);
    api.setPins(locs.map((l) => ({
      id: l.id, x: l.x, y: l.y, className: "pz-pin-location",
      title: l.name, onClick: () => navigate(`/locations/${l.id}`),
    })));
    const listEl = document.getElementById("map-loc-list");
    listEl.innerHTML = locs.length ? locs.map((l) => `
      <div class="history-item row-link" data-loc="${esc(l.id)}">
        <span>${esc(l.name)}</span>
        <span class="text-low small">${l.entrances.length} bejárat</span>
      </div>`).join("") : `<div class="text-low small">Ezen a térképen nincs regisztrált helyszín.</div>`;
    listEl.querySelectorAll("[data-loc]").forEach((row) =>
      row.addEventListener("click", () => navigate(`/locations/${row.getAttribute("data-loc")}`))
    );
  }

  function drawDistricts() {
    const districts = districtsForMap(activeMapId);
    api.setLabels(districts.map((d) => ({ id: d.id, x: d.x, y: d.y, text: d.name })));
    const listEl = document.getElementById("map-district-list");
    listEl.innerHTML = districts.length ? districts.map((d) => `
      <div class="history-item">
        <span>${esc(d.name)}</span>
        ${canEdit ? `<button class="btn btn-sm btn-danger" data-del-district="${esc(d.id)}">×</button>` : ""}
      </div>`).join("") : `<div class="text-low small">Nincs még körzet-felirat ezen a térképen.</div>`;
    if (canEdit) {
      listEl.querySelectorAll("[data-del-district]").forEach((b) =>
        b.addEventListener("click", () => {
          deleteDistrict(b.getAttribute("data-del-district"), actorLabel());
          drawDistricts();
        })
      );
    }
  }

  drawLocations();
  drawDistricts();

  if (canEdit) {
    document.getElementById("add-district-btn").addEventListener("click", () => {
      addingDistrict = true;
      addingLocation = false;
      toast("Kattints a térképre a körzet pozíciójához.");
    });
    document.getElementById("add-location-btn").addEventListener("click", () => {
      addingLocation = true;
      addingDistrict = false;
      toast("Kattints a térképre az új védett helyszín pozíciójához.");
    });
    api.onMapClick((pos) => {
      if (addingLocation) {
        addingLocation = false;
        openLocationForm(null, { map: activeMapId, x: pos.x, y: pos.y });
        return;
      }
      if (!addingDistrict) return;
      addingDistrict = false;
      openModal(`
        <div class="modal-head"><h3>Új körzet</h3><button class="modal-close" data-close-modal>×</button></div>
        <form id="district-form">
          <div class="field"><label>Körzet neve</label><input required id="df-name" autofocus placeholder="pl. Vinewood" /></div>
          <div class="flex justify-between mt-2">
            <button type="button" class="btn" data-close-modal>Mégse</button>
            <button type="submit" class="btn btn-gold">Mentés</button>
          </div>
        </form>
      `);
      document.getElementById("district-form").addEventListener("submit", (e) => {
        e.preventDefault();
        const name = document.getElementById("df-name").value.trim();
        if (!name) return;
        upsertDistrict({ map: activeMapId, name, x: pos.x, y: pos.y }, actorLabel());
        toast("Körzet hozzáadva");
        closeModal();
        drawDistricts();
      });
    });
  }

  if (pendingFocus && pendingFocus.mapId === activeMapId && pendingFocus.locationId) {
    const locs = locationsForMap(activeMapId);
    const target = locs.find((l) => l.id === pendingFocus.locationId);
    if (target) setTimeout(() => api.focus(target.x, target.y), 60);
  }
  pendingFocus = null;
}
