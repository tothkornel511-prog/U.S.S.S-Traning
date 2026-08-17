/* ==========================================================================
   U.S.S.S. ELITE TRAINING SYSTEM — NAGYÍTHATÓ/PANOZHATÓ TÉRKÉP KOMPONENS
   Egyetlen nagyfelbontású térképkép fölé pöttyöket (pin) és felirat-
   címkéket (label) rajzol. Görgővel nagyít (kurzor köré), húzással
   pásztáz, kattintással (ha engedélyezett) pozíciót jelöl ki %-ban.
   Hiányzó térképkép esetén sötét placeholderre esik vissza, hogy a
   pöttyök/címkék attól még szerkeszthetők/megtekinthetők maradjanak.
   ========================================================================== */
import { esc } from "./utils.js?v=4";

const STAGE_W = 2000;
const STAGE_H = 2700; // ~ a valós GTA V térkép portré-arányához közelítve

export function createPanZoomMap(container, opts = {}) {
  const { image, alt = "Térkép", editable = false, minScale = 0.3, maxScale = 6 } = opts;
  let scale = 1, tx = 0, ty = 0;
  let clickCb = null;
  let dragging = false, moved = false, lastX = 0, lastY = 0;

  container.innerHTML = `
    <div class="pz-viewport">
      <div class="pz-stage">
        <div class="pz-imgbox"></div>
        <div class="pz-pins"></div>
        <div class="pz-labels"></div>
      </div>
      <div class="pz-controls">
        <button type="button" class="pz-btn" data-act="in" title="Nagyítás">+</button>
        <button type="button" class="pz-btn" data-act="out" title="Kicsinyítés">−</button>
        <button type="button" class="pz-btn" data-act="reset" title="Nézet visszaállítása">⟲</button>
      </div>
      ${editable ? `<div class="pz-hint">Kattintás: pozíció kijelölése · húzás: pásztázás · görgő: nagyítás</div>` : ""}
    </div>
  `;

  const viewport = container.querySelector(".pz-viewport");
  const stage = container.querySelector(".pz-stage");
  const imgBox = container.querySelector(".pz-imgbox");
  const pinsLayer = container.querySelector(".pz-pins");
  const labelsLayer = container.querySelector(".pz-labels");

  stage.style.width = STAGE_W + "px";
  stage.style.height = STAGE_H + "px";

  const img = new Image();
  img.alt = alt;
  img.decoding = "async";
  img.addEventListener("load", () => {
    imgBox.innerHTML = "";
    imgBox.appendChild(img);
    fitToViewport();
  });
  img.addEventListener("error", () => {
    imgBox.innerHTML = `
      <div class="pz-missing">
        <div class="pz-missing-ic">🗺️</div>
        <div>Térképkép hiányzik</div>
        <div class="pz-missing-path">${esc(image || "")}</div>
      </div>`;
    fitToViewport();
  });
  if (image) img.src = image;
  else imgBox.innerHTML = `<div class="pz-missing"><div class="pz-missing-ic">🗺️</div><div>Nincs kiválasztva térkép</div></div>`;

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function applyTransform() {
    stage.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
  }

  function fitToViewport() {
    const vw = viewport.clientWidth || 600;
    const vh = viewport.clientHeight || 400;
    scale = clamp(Math.min(vw / STAGE_W, vh / STAGE_H) * 0.98, minScale, maxScale);
    tx = (vw - STAGE_W * scale) / 2;
    ty = (vh - STAGE_H * scale) / 2;
    applyTransform();
  }

  function zoomAt(cx, cy, factor) {
    const newScale = clamp(scale * factor, minScale, maxScale);
    const stageX = (cx - tx) / scale;
    const stageY = (cy - ty) / scale;
    tx = cx - stageX * newScale;
    ty = cy - stageY * newScale;
    scale = newScale;
    applyTransform();
  }

  viewport.addEventListener("wheel", (e) => {
    e.preventDefault();
    const rect = viewport.getBoundingClientRect();
    zoomAt(e.clientX - rect.left, e.clientY - rect.top, e.deltaY < 0 ? 1.18 : 1 / 1.18);
  }, { passive: false });

  viewport.addEventListener("pointerdown", (e) => {
    dragging = true; moved = false; lastX = e.clientX; lastY = e.clientY;
    viewport.setPointerCapture(e.pointerId);
    viewport.classList.add("dragging");
  });
  viewport.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) moved = true;
    tx += dx; ty += dy; lastX = e.clientX; lastY = e.clientY;
    applyTransform();
  });
  viewport.addEventListener("pointerup", (e) => {
    dragging = false;
    viewport.classList.remove("dragging");
    if (!moved && clickCb) {
      const rect = stage.getBoundingClientRect();
      const px = ((e.clientX - rect.left) / rect.width) * 100;
      const py = ((e.clientY - rect.top) / rect.height) * 100;
      if (px >= 0 && px <= 100 && py >= 0 && py <= 100) clickCb({ x: px, y: py });
    }
  });
  viewport.addEventListener("pointercancel", () => { dragging = false; viewport.classList.remove("dragging"); });

  container.querySelectorAll(".pz-btn").forEach((b) =>
    b.addEventListener("click", () => {
      const act = b.getAttribute("data-act");
      const vw = viewport.clientWidth, vh = viewport.clientHeight;
      if (act === "in") zoomAt(vw / 2, vh / 2, 1.3);
      else if (act === "out") zoomAt(vw / 2, vh / 2, 1 / 1.3);
      else fitToViewport();
    })
  );

  window.addEventListener("resize", fitToViewport);

  const api = {
    setPins(pins = []) {
      pinsLayer.innerHTML = pins.map((p) => `
        <div class="pz-pin ${p.className || ""}" style="left:${p.x}%; top:${p.y}%" data-id="${esc(p.id || "")}" title="${esc(p.title || "")}"></div>
      `).join("");
      pinsLayer.querySelectorAll(".pz-pin").forEach((el, i) => {
        if (pins[i].onClick) el.addEventListener("click", (e) => { e.stopPropagation(); pins[i].onClick(); });
      });
    },
    setLabels(labels = []) {
      labelsLayer.innerHTML = labels.map((l) => `
        <div class="pz-label" style="left:${l.x}%; top:${l.y}%" data-id="${esc(l.id || "")}">${esc(l.text)}</div>
      `).join("");
      if (labels.some((l) => l.onClick)) {
        labelsLayer.querySelectorAll(".pz-label").forEach((el, i) => {
          if (labels[i].onClick) el.addEventListener("click", (e) => { e.stopPropagation(); labels[i].onClick(); });
        });
      }
    },
    onMapClick(cb) { clickCb = cb; },
    focus(x, y, targetScale = 2.2) {
      const vw = viewport.clientWidth, vh = viewport.clientHeight;
      scale = clamp(targetScale, minScale, maxScale);
      tx = vw / 2 - (x / 100) * STAGE_W * scale;
      ty = vh / 2 - (y / 100) * STAGE_H * scale;
      applyTransform();
    },
    resetView: fitToViewport,
    destroy() { window.removeEventListener("resize", fitToViewport); },
  };
  return api;
}
