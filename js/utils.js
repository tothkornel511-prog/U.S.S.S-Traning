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

/* Egységes U.S.S.S. pecsét — bezel jelölésekkel és központi csillaggal.
   Nincs beágyazott felirat, hogy bármilyen méretben élesen rajzolódjon ki. */
export function sealMark(size = 48) {
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" class="seal-svg" aria-hidden="true">
    <defs>
      <linearGradient id="sealGold" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#e8c887"/>
        <stop offset="1" stop-color="#a9834a"/>
      </linearGradient>
    </defs>
    <circle cx="50" cy="50" r="48" fill="none" stroke="url(#sealGold)" stroke-width="1"/>
    <circle cx="50" cy="50" r="38" fill="none" stroke="url(#sealGold)" stroke-width="0.6" opacity="0.7"/>
    <g stroke="url(#sealGold)" stroke-width="1.1" stroke-linecap="round">
      <line x1="93" y1="50" x2="97" y2="50"/><line x1="87.24" y1="71.5" x2="90.68" y2="73.5"/>
      <line x1="71.5" y1="87.24" x2="73.5" y2="90.68"/><line x1="50" y1="93" x2="50" y2="97"/>
      <line x1="28.5" y1="87.24" x2="26.5" y2="90.68"/><line x1="12.76" y1="71.5" x2="9.32" y2="73.5"/>
      <line x1="7" y1="50" x2="3" y2="50"/><line x1="12.76" y1="28.5" x2="9.32" y2="26.5"/>
      <line x1="28.5" y1="12.76" x2="26.5" y2="9.32"/><line x1="50" y1="7" x2="50" y2="3"/>
      <line x1="71.5" y1="12.76" x2="73.5" y2="9.32"/><line x1="87.24" y1="28.5" x2="90.68" y2="26.5"/>
    </g>
    <polygon points="50,26 55.88,41.91 72.83,42.58 59.51,53.09 64.11,69.42 50,60 35.89,69.42 40.49,53.09 27.17,42.58 44.12,41.91" fill="url(#sealGold)"/>
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
