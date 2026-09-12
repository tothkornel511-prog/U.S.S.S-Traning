/* ==========================================================================
   U.S.S.S. ELITE TRAINING SYSTEM — UI SEGÉDFÜGGVÉNYEK
   ========================================================================== */

import { getBrandingOverride } from "./store.js?v=67";

/* Ha az admin lecserélt egy márka-képet, ez állítja be a --brand-img egyéni
   CSS tulajdonságot az adott elemen — felülírás nélkül a CSS-ben megadott
   alapértelmezett kép (var(--brand-img, url(...))) marad érvényben. */
export function applyBranding(el, slotId) {
  if (!el) return;
  const override = getBrandingOverride(slotId);
  if (override) el.style.setProperty("--brand-img", `url("${override}")`);
  else el.style.removeProperty("--brand-img");
}

export function esc(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* Könnyű, saját "jegyzet-szintaxis" oktatási dokumentumokhoz — nem teljes
   Markdown, csak annyi, amennyi egy digitális kézikönyvhez kell: címsorok,
   felsorolás, idézet/kiemelt doboz, elválasztó, félkövér/dőlt szöveg.
   Mindig esc()-elt szövegből épül, HTML befecskendezés nem lehetséges. */
export function renderRichText(text) {
  if (!text) return "";
  const inline = (s) => esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, "<em>$1</em>");
  let html = "", inList = false, inQuote = false;
  const closeList = () => { if (inList) { html += "</ul>"; inList = false; } };
  const closeQuote = () => { if (inQuote) { html += "</blockquote>"; inQuote = false; } };
  String(text).replace(/\r\n/g, "\n").split("\n").forEach((raw) => {
    const line = raw.trim();
    if (!line) { closeList(); closeQuote(); return; }
    if (line === "---") { closeList(); closeQuote(); html += "<hr/>"; return; }
    if (line.startsWith("### ")) { closeList(); closeQuote(); html += `<h4>${inline(line.slice(4))}</h4>`; return; }
    if (line.startsWith("## ")) { closeList(); closeQuote(); html += `<h3>${inline(line.slice(3))}</h3>`; return; }
    if (line.startsWith("# ")) { closeList(); closeQuote(); html += `<h2>${inline(line.slice(2))}</h2>`; return; }
    if (line.startsWith("> ")) { closeList(); if (!inQuote) { html += "<blockquote>"; inQuote = true; } html += `<p>${inline(line.slice(2))}</p>`; return; }
    if (line.startsWith("- ") || line.startsWith("* ")) { closeQuote(); if (!inList) { html += "<ul>"; inList = true; } html += `<li>${inline(line.slice(2))}</li>`; return; }
    closeList(); closeQuote();
    html += `<p>${inline(line)}</p>`;
  });
  closeList(); closeQuote();
  return html;
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

/* Avatar tartalom (kép vagy monogram). Ha a fotó URL törött/lejárt
   (pl. régi, lejárt Discord CDN-link), a böngésző alapértelmezett
   "törött kép" ikonja helyett szépen visszaesik a monogramra. */
export function avatarContent(photo, name) {
  if (!photo) return esc(initials(name));
  return `<img src="${esc(photo)}" onerror="this.outerHTML='${esc(initials(name))}'"/>`;
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

/* PDF/DOCX mellékletek megnyitása egy ÚJ böngészőfülön/ablakban, nagyban,
   csak megtekintésre — nem letöltésként. PDF-nél a böngésző saját, natív
   PDF-nézője nyílik meg (ez data: URL-re és sima linkre is működik minden
   modern böngészőben). DOCX-nél nincs natív böngésző-támogatás, ezért a
   mammoth.js könyvtárral (lásd index.html, CDN-ről betöltve) alakítjuk
   HTML-lé kliensoldalon, majd egy önálló, egyszerű HTML-oldalként nyitjuk
   meg új fülön — nem kell hozzá szerver, és nem futtat semmilyen kódot a
   dokumentumból, csak a szöveges/formázási tartalmát olvassa ki. */
function attachmentFileType(label, url) {
  const s = `${label || ""} ${url || ""}`.toLowerCase();
  if (s.includes("application/pdf") || s.includes(".pdf")) return "pdf";
  if (s.includes("wordprocessingml") || s.includes(".docx")) return "docx";
  return "other";
}

export async function previewAttachment(label, url) {
  const type = attachmentFileType(label, url);
  const isDataUrl = url.startsWith("data:");

  // Sima külső link (nem feltöltött fájl, nem DOCX) — natívan, szinkron
  // módon nyílik meg, nincs szükség semmilyen átalakításra.
  if (type !== "docx" && !isDataUrl) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }

  // Feltöltött fájl (data: URL) vagy DOCX: a Chromium biztonsági okból
  // blokkolja, ha egy window.open() közvetlenül egy data: URL-re navigál —
  // ezért előbb (még a kattintás-eseményen belül, szinkron módon) nyitunk
  // egy üres fület, és csak utána, a blob előkészülte után navigálunk oda.
  const win = window.open("", "_blank");
  try {
    let target = url;
    if (type === "docx") {
      if (!window.mammoth) throw new Error("mammoth-missing");
      const buf = await (await fetch(url)).arrayBuffer();
      const result = await window.mammoth.convertToHtml({ arrayBuffer: buf });
      const html = `<!doctype html><html lang="hu"><head><meta charset="utf-8"/><title>${esc(label)}</title>
        <style>body{background:#f4f2ee;color:#161616;margin:0;padding:48px 24px;font-family:Georgia,"Times New Roman",serif;line-height:1.7;}
        .doc-wrap{max-width:820px;margin:0 auto;background:#fff;padding:56px;box-shadow:0 0 24px rgba(0,0,0,.15);}
        img{max-width:100%;} h1,h2,h3{font-family:sans-serif;}</style></head>
        <body><div class="doc-wrap">${result.value}</div></body></html>`;
      target = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    } else if (isDataUrl) {
      const blob = await (await fetch(url)).blob();
      target = URL.createObjectURL(blob);
    }
    if (win) win.location.href = target;
    else window.open(target, "_blank");
  } catch {
    if (win) win.close();
    toast("Nem sikerült megnyitni előnézetben.", "warn");
  }
}

export function statusBadge(color, label) {
  return `<span class="badge badge-${esc(color)}">${esc(label)}</span>`;
}

/* U.S.S.S. hivatalos jelvény — teljes körjelvény, gyűrűs felirattal és
   központi ötágú csillag-medállal, a szövetségi ügynökségi jelvények
   formanyelvét idézve, de a rendszer saját fekete-arany palettájában.
   Egyetlen inline SVG, nincs külső képfájl-függőség — bármilyen
   méretben élesen kirajzolódik, sötét/világos háttéren egyaránt. */
let sealMarkSeq = 0;
export function sealMark(size = 48) {
  // Minden hívás saját, egyedi ID-namespace-t kap (sealGold-0, sealGold-1, …).
  // SVG id-k a teljes HTML dokumentumban egyediek kell legyenek — ha két
  // sealMark() ugyanazon az oldalon (pl. bejelentkező vízjel + kis jelvény,
  // vagy oldalsáv + nyomtatható tanúsítvány) azonos id-t használna, a
  // url(#id) hivatkozás a DOM-ban elsőként szereplő (esetleg egy másik,
  // display:none ágban rejtett) SVG-re mutatna, és a jelvény kitöltés
  // nélkül, feketén jelenne meg.
  const uid = `seal${sealMarkSeq++}`;
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" class="seal-svg" aria-hidden="true">
    <defs>
      <linearGradient id="${uid}-gold" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#f4e2b0"/>
        <stop offset="0.55" stop-color="#e8c887"/>
        <stop offset="1" stop-color="#9a7a3f"/>
      </linearGradient>
      <path id="${uid}-ring-top" d="M12,52 A38,38 0 0 1 88,52"/>
      <path id="${uid}-ring-bot" d="M12,58 A38,38 0 0 0 88,58"/>
    </defs>
    <circle cx="50" cy="50" r="48.5" fill="#05060a" stroke="url(#${uid}-gold)" stroke-width="1.2"/>
    <circle cx="50" cy="50" r="44.5" fill="none" stroke="url(#${uid}-gold)" stroke-width="0.5" opacity="0.55"/>
    <circle cx="50" cy="50" r="31.5" fill="none" stroke="url(#${uid}-gold)" stroke-width="0.4" opacity="0.4" stroke-dasharray="1 2.6"/>
    <text font-family="IBM Plex Mono, monospace" font-size="6.6" letter-spacing="1.1" fill="url(#${uid}-gold)">
      <textPath href="#${uid}-ring-top" startOffset="50%" text-anchor="middle">U · S · S · S</textPath>
    </text>
    <text font-family="IBM Plex Mono, monospace" font-size="4.1" letter-spacing="0.9" fill="url(#${uid}-gold)" opacity="0.9">
      <textPath href="#${uid}-ring-bot" startOffset="50%" text-anchor="middle">ELIT VÉDELMI SZOLGÁLAT</textPath>
    </text>
    <g transform="translate(50,50) scale(0.52) translate(-50,-50)">
      <polygon points="50,4 62.93,32.2 93.75,35.79 70.92,56.8 77.04,87.21 50,72 22.96,87.21 29.08,56.8 6.25,35.79 37.07,32.2"
        fill="url(#${uid}-gold)" stroke="#1a1406" stroke-width="1"/>
      <g fill="url(#${uid}-gold)" stroke="#1a1406" stroke-width="0.9">
        <circle cx="50" cy="4" r="3.6"/><circle cx="93.75" cy="35.79" r="3.6"/>
        <circle cx="77.04" cy="87.21" r="3.6"/><circle cx="22.96" cy="87.21" r="3.6"/>
        <circle cx="6.25" cy="35.79" r="3.6"/>
      </g>
      <circle cx="50" cy="50" r="21" fill="#05060a" stroke="url(#${uid}-gold)" stroke-width="1.6"/>
      <circle cx="50" cy="50" r="17.5" fill="none" stroke="url(#${uid}-gold)" stroke-width="0.6" opacity="0.7"/>
      <polygon points="50,37 53.06,45.79 62.36,45.98 54.95,51.61 57.64,60.52 50,55.2 42.36,60.52 45.05,51.61 37.64,45.98 46.94,45.79" fill="url(#${uid}-gold)"/>
    </g>
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
