/* ==========================================================================
   U.S.S.S. ELITE TRAINING SYSTEM — UI SEGÉDFÜGGVÉNYEK
   ========================================================================== */

export function esc(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString("hu-HU", { year: "numeric", month: "2-digit", day: "2-digit" });
}

export function fmtDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return (
    d.toLocaleDateString("hu-HU", { year: "numeric", month: "2-digit", day: "2-digit" }) +
    " " +
    d.toLocaleTimeString("hu-HU", { hour: "2-digit", minute: "2-digit" })
  );
}

export function initials(name) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

let toastTimer = null;
export function toast(message, type = "ok") {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    document.body.appendChild(el);
  }
  el.textContent = (type === "ok" ? "✓ " : "⚠ ") + message;
  el.className = "toast show " + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 3200);
}

export function openModal(innerHtml) {
  closeModal();
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "modal-overlay";
  overlay.innerHTML = `<div class="modal-panel">${innerHtml}</div>`;
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal();
  });
  document.body.appendChild(overlay);
  document.querySelectorAll("[data-close-modal]").forEach((b) =>
    b.addEventListener("click", closeModal)
  );
  return overlay;
}

export function closeModal() {
  const el = document.getElementById("modal-overlay");
  if (el) el.remove();
}

export function statusBadge(color, label) {
  return `<span class="badge badge-${esc(color)}">${esc(label)}</span>`;
}

/* U.S.S.S. csillagjelvény — az öttagú szövetségi ügynökségi jelvények
   formanyelvét idézi (ötágú csillag, gömbös csúcsok, központi medál),
   de a rendszer saját fekete-arany palettájában, felirat nélkül, hogy
   bármilyen méretben élesen kirajzolódjon. */
export function sealMark(size = 48) {
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" class="seal-svg" aria-hidden="true">
    <defs>
      <linearGradient id="sealGold" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#e8c887"/>
        <stop offset="1" stop-color="#a9834a"/>
      </linearGradient>
    </defs>
    <polygon points="50,4 62.93,32.2 93.75,35.79 70.92,56.8 77.04,87.21 50,72 22.96,87.21 29.08,56.8 6.25,35.79 37.07,32.2"
      fill="url(#sealGold)" stroke="#1a1406" stroke-width="0.6"/>
    <g fill="url(#sealGold)" stroke="#1a1406" stroke-width="0.5">
      <circle cx="50" cy="4" r="3.6"/><circle cx="93.75" cy="35.79" r="3.6"/>
      <circle cx="77.04" cy="87.21" r="3.6"/><circle cx="22.96" cy="87.21" r="3.6"/>
      <circle cx="6.25" cy="35.79" r="3.6"/>
    </g>
    <circle cx="50" cy="50" r="21" fill="#0b0d12" stroke="url(#sealGold)" stroke-width="1.4"/>
    <circle cx="50" cy="50" r="17.5" fill="none" stroke="url(#sealGold)" stroke-width="0.5" opacity="0.7"/>
    <polygon points="50,37 53.06,45.79 62.36,45.98 54.95,51.61 57.64,60.52 50,55.2 42.36,60.52 45.05,51.61 37.64,45.98 46.94,45.79" fill="url(#sealGold)"/>
  </svg>`;
}

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === "class") node.className = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  });
  (Array.isArray(children) ? children : [children]).forEach((c) => {
    if (typeof c === "string") node.insertAdjacentHTML("beforeend", c);
    else if (c) node.appendChild(c);
  });
  return node;
}
