/* ==========================================================================
   U.S.S.S. ELITE TRAINING SYSTEM — UI SEGÉDFÜGGVÉNYEK
   ========================================================================== */

import { getBrandingOverride } from "./store.js?v=67";

/* Fájlfeltöltés a GitHub repóba egy Cloudflare Worker proxin keresztül,
   ahelyett hogy a fájl base64-ként a localStorage-ban végezné (ami az 5 MB-os
   böngésző-korlátba ütközik). A WORKER_SECRET itt, a publikus kliens-kódban
   szándékosan látható — lásd worker/worker.js teteje: ez csak egy szűk,
   korlátozott képességet (uploads/ mappába írás) tár fel, nem a GITHUB_TOKEN-t,
   ami kizárólag a Worker titkosított tárolójában él. */
const GITHUB_UPLOAD_URL = "https://u-s-s-s-traning.tothkornel511.workers.dev/";
const GITHUB_UPLOAD_SECRET = "Bhq751orJyX0wqHR8fC0Adt_J29YdF23";

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export async function uploadFileToGitHub(file) {
  const contentBase64 = await fileToBase64(file);
  const res = await fetch(GITHUB_UPLOAD_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Worker-Secret": GITHUB_UPLOAD_SECRET },
    body: JSON.stringify({ filename: file.name, contentBase64 }),
  });
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  const data = await res.json();
  return data.url;
}

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

export function openModal(innerHtml, { large = false } = {}) {
  closeModal();
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "modal-overlay";
  overlay.innerHTML = `<div class="modal-panel${large ? " modal-panel-lg" : ""}">${innerHtml}</div>`;
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

/* PDF/DOCX mellékletek megnyitása egy nagy, csak-megtekintésre szolgáló
   panelen, UGYANAZON az oldalon (nem külön böngészőfülön). Korábban ez
   window.open()-nel készült, de bizonyos böngészők/bővítmények némán
   blokkolják egy már megnyitott üres fül KÉSŐBBI (a DOCX-átalakítás async
   várakozása utáni) átirányítását — a felhasználó ilyenkor csak egy örökre
   "about:blank" fület lát. Az in-page panel ezt az egész problémakört
   kiküszöböli, és ugyanúgy nagyban, csak megtekintésre mutatja a tartalmat.
   PDF-nél a böngésző saját, natív PDF-nézője jelenik meg egy beágyazott
   iframe-ben. DOCX-nél nincs natív böngésző-támogatás, ezért a mammoth.js
   könyvtárral (lásd index.html, CDN-ről betöltve) alakítjuk HTML-lé
   kliensoldalon — nem kell hozzá szerver, és nem futtat semmilyen kódot a
   dokumentumból, csak a szöveges/formázási tartalmát olvassa ki. */
function attachmentFileType(label, url) {
  const s = `${label || ""} ${url || ""}`.toLowerCase();
  if (s.includes("application/pdf") || s.includes(".pdf")) return "pdf";
  if (s.includes("wordprocessingml") || s.includes(".docx")) return "docx";
  return "other";
}

export async function previewAttachment(label, url) {
  const type = attachmentFileType(label, url);

  if (type !== "pdf" && type !== "docx") {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }

  openModal(`
    <div class="modal-head"><h3>${esc(label)}</h3><button class="modal-close" data-close-modal>×</button></div>
    <div id="preview-body" style="width:100%; height:80vh; overflow:auto; background:#fff; border-radius:var(--radius-sm);">
      <div style="padding:60px; text-align:center; color:#333;">Betöltés…</div>
    </div>
  `, { large: true });
  const body = document.getElementById("preview-body");

  if (type === "pdf") {
    // A GitHub raw fájl-kiszolgálás minden fájlt "application/octet-stream"
    // típussal küld (biztonsági okból, nosniff-fel együtt), függetlenül a
    // kiterjesztéstől — emiatt a böngésző nem ismerné fel PDF-ként, és
    // letöltené megnyitás helyett. Ezért lekérjük a nyers bájtokat, és egy
    // helyesen "application/pdf" típusú Blob-ként adjuk oda az iframe-nek.
    try {
      const raw = await (await fetch(url)).blob();
      const pdfBlob = new Blob([raw], { type: "application/pdf" });
      const blobUrl = URL.createObjectURL(pdfBlob);
      body.innerHTML = `<iframe src="${esc(blobUrl)}" style="width:100%; height:100%; border:none;"></iframe>`;
    } catch {
      body.innerHTML = `<div style="padding:60px; text-align:center; color:#333;"><p>Nem sikerült megnyitni előnézetben.</p><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">Megnyitás/letöltés közvetlenül</a></div>`;
    }
    return;
  }

  // DOCX: ha a fájlnak van valódi, nyilvánosan elérhető URL-je (minden
  // GitHub-ra feltöltött fájlnak van), a Microsoft saját, valódi Word-
  // motorral működő Office Online Viewer-ét ágyazzuk be — ez sokkal
  // hívebb, "komolyabb" megjelenítés, mint bármilyen saját konvertálás,
  // és eleve csak megtekintésre való. Csak a régebbi, data: URL-ként
  // tárolt (nem GitHub-on lévő) fájloknál esünk vissza a mammoth.js-es
  // kliensoldali átalakításra, mert a Microsoft-szolgáltatás data: URL-t
  // nem tud lekérni.
  if (!url.startsWith("data:")) {
    const embedUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
    body.innerHTML = `<iframe src="${esc(embedUrl)}" style="width:100%; height:100%; border:none;"></iframe>`;
    return;
  }

  try {
    if (!window.mammoth) throw new Error("mammoth-missing");
    const buf = await (await fetch(url)).arrayBuffer();
    const result = await window.mammoth.convertToHtml({ arrayBuffer: buf });
    if (!document.getElementById("preview-body")) return; // a modal közben bezáródott
    body.innerHTML = `<div style="padding:40px 56px; color:#161616; font-family:Georgia,'Times New Roman',serif; line-height:1.7; max-width:820px; margin:0 auto;">${result.value}</div>`;
  } catch {
    if (!document.getElementById("preview-body")) return;
    body.innerHTML = `<div style="padding:60px; text-align:center; color:#333;"><p>Nem sikerült megnyitni előnézetben.</p><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">Megnyitás/letöltés közvetlenül</a></div>`;
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
