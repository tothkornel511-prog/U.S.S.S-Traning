import {
  getChannels, getChannel, createChannel, deleteChannel,
  getChannelPosts, createChannelPost, deleteChannelPost,
  isImageAttachment, formatFileSize, ATTACHMENT_MAX_UPLOAD_BYTES,
} from "../store.js?v=64";
import { hasRole, actorLabel } from "../auth.js?v=20";
import { esc, fmtDateTime, toast, openModal, closeModal } from "../utils.js?v=23";
import { navigate } from "../router.js?v=20";

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function renderChannelsHub(container, channelId) {
  const canEdit = hasRole("TRAINING");
  const channels = getChannels();
  const active = getChannel(channelId) || channels[0] || null;
  const posts = active ? getChannelPosts(active.id) : [];

  container.innerHTML = `
    <div class="classification-strip">U.S.S.S. BELSŐ CSATORNÁK · CSAPAT KOMMUNIKÁCIÓ</div>
    <p class="text-low small mb-2">Saját szervezésű tartalom-szobák jegyzeteknek és mellékleteknek. <strong>Fontos:</strong> nincs szerver — minden csatorna és bejegyzés kizárólag ebben a böngészőben létezik, nem szinkronizál automatikusan más eszközre vagy felhasználóra.</p>
    <div class="channels-layout">
      <aside class="channels-sidebar">
        <div class="card-title mb-1">Csatornák</div>
        ${channels.map((c) => `<a class="channel-link ${active && c.id === active.id ? "active" : ""}" data-nav="/channels/${esc(c.id)}">${esc(c.name)}</a>`).join("") || `<div class="text-low small">Nincs még csatorna.</div>`}
        ${canEdit ? `<button class="btn btn-sm btn-block mt-1" id="new-channel">+ Új csatorna</button>` : ""}
      </aside>
      <div class="channels-main">
        ${active ? `
          <div class="section-head">
            <h2 style="font-size:19px">#${esc(active.name)}</h2>
            <div class="actions">
              ${canEdit ? `<button class="btn btn-gold btn-sm" id="new-post">+ Új bejegyzés</button>` : ""}
              ${canEdit ? `<button class="btn btn-sm btn-danger" id="delete-channel">Csatorna törlése</button>` : ""}
            </div>
          </div>
          <div id="channel-posts">
            ${posts.length ? posts.map(renderPost).join("") : `<div class="empty-state"><h3>Nincs még bejegyzés</h3><p>Hozza létre az elsőt a fenti gombbal.</p></div>`}
          </div>
        ` : `<div class="empty-state"><h3>Nincs még csatorna</h3><p>${canEdit ? "Hozza létre az elsőt a bal oldali gombbal." : "Kérjen egy adminisztrátort, hogy hozzon létre egyet."}</p></div>`}
      </div>
    </div>
  `;

  container.querySelectorAll("[data-nav]").forEach((n) => n.addEventListener("click", () => navigate(n.getAttribute("data-nav"))));
  container.querySelectorAll("[data-delete-post]").forEach((b) =>
    b.addEventListener("click", () => {
      if (!confirm("Biztosan törli ezt a bejegyzést?")) return;
      deleteChannelPost(b.getAttribute("data-delete-post"), actorLabel());
      toast("Bejegyzés törölve");
      renderChannelsHub(container, active.id);
    })
  );

  document.getElementById("new-channel")?.addEventListener("click", () => {
    openModal(`
      <div class="modal-head"><h3>Új csatorna</h3><button class="modal-close" data-close-modal>×</button></div>
      <form id="channel-form">
        <div class="field"><label>Csatorna neve</label><input id="cf-name" required autofocus placeholder="pl. Vizsga anyagok" /></div>
        <div class="flex justify-between mt-2">
          <button type="button" class="btn" data-close-modal>Mégse</button>
          <button type="submit" class="btn btn-gold">Létrehozás</button>
        </div>
      </form>
    `);
    document.getElementById("channel-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const name = document.getElementById("cf-name").value.trim();
      if (!name) return;
      const channel = createChannel(name, actorLabel());
      toast(`Csatorna létrehozva: #${channel.name}`);
      closeModal();
      navigate(`/channels/${channel.id}`);
    });
  });

  document.getElementById("delete-channel")?.addEventListener("click", () => {
    if (!confirm(`Biztosan törli a(z) "#${active.name}" csatornát? Minden benne lévő bejegyzés elvész.`)) return;
    deleteChannel(active.id, actorLabel());
    toast("Csatorna törölve");
    navigate("/channels");
  });

  document.getElementById("new-post")?.addEventListener("click", () => openPostForm(active.id, () => renderChannelsHub(container, active.id)));
}

function renderPost(post) {
  return `
    <article class="channel-post">
      <div class="channel-post-head">
        <div>
          ${post.title ? `<div class="channel-post-title">${esc(post.title)}</div>` : ""}
          <div class="text-low small">${esc(post.createdBy)}</div>
        </div>
        <div class="flex items-center gap-1">
          <span class="channel-post-meta">${fmtDateTime(post.createdAt)}</span>
          <button class="btn btn-sm btn-danger" data-delete-post="${esc(post.id)}">×</button>
        </div>
      </div>
      ${post.body ? `<div class="channel-post-body">${esc(post.body)}</div>` : ""}
      ${(post.attachments || []).length ? `<div class="attachment-grid">${post.attachments.map((a) => `
        <div class="attachment-card">
          ${isImageAttachment(a) ? `<a href="${esc(a.url)}" target="_blank" rel="noopener noreferrer"><img src="${esc(a.url)}" alt="${esc(a.label)}" class="attachment-thumb" /></a>` : `<a href="${esc(a.url)}" target="_blank" rel="noopener noreferrer" class="attachment-file-icon">📄</a>`}
          <div class="attachment-meta">
            <a href="${esc(a.url)}" target="_blank" rel="noopener noreferrer" class="text-gold small">${esc(a.label)}</a>
            <span class="text-low" style="font-size:11px">${a.kind === "upload" ? `Feltöltve${a.size ? ` · ${formatFileSize(a.size)}` : ""}` : "Külső hivatkozás"}</span>
          </div>
        </div>`).join("")}</div>` : ""}
    </article>`;
}

function openPostForm(channelId, onDone) {
  let attachments = [];
  openModal(`
    <div class="modal-head"><h3>Új bejegyzés</h3><button class="modal-close" data-close-modal>×</button></div>
    <form id="post-form">
      <div class="field"><label>Cím (opcionális)</label><input id="pf-title" autofocus /></div>
      <div class="field"><label>Szöveg</label><textarea id="pf-body" rows="5"></textarea></div>
      <div class="field">
        <label>Mellékletek</label>
        <div id="pf-attachments" class="mb-1"></div>
        <div class="grid grid-2">
          <input id="pf-attach-label" placeholder="Megnevezés, pl. Elméleti vizsga jegyzet.pdf" />
          <div class="flex gap-1"><input id="pf-attach-url" placeholder="https://… (külső hivatkozás)" style="flex:1" /><button type="button" class="btn btn-sm" id="pf-add-link">+ Link</button></div>
        </div>
        <div class="flex gap-1 mt-1 items-center">
          <label class="btn btn-sm" style="cursor:pointer">Fájl kiválasztása<input type="file" id="pf-attach-file" style="display:none" /></label>
          <span class="text-low small" id="pf-attach-file-name">Nincs fájl kiválasztva.</span>
        </div>
        <p class="text-low small mt-1">Közvetlen feltöltés max. ${formatFileSize(ATTACHMENT_MAX_UPLOAD_BYTES)}/fájl (a böngésző helyi tárolójának korlátja miatt). Ennél nagyobb anyaghoz töltsd fel máshova (pl. Discord, Drive), és a linket add meg mellékletként.</p>
      </div>
      <div class="flex justify-between mt-2">
        <button type="button" class="btn" data-close-modal>Mégse</button>
        <button type="submit" class="btn btn-gold" id="pf-submit">Közzététel</button>
      </div>
    </form>
  `);

  const attachList = document.getElementById("pf-attachments");
  function redrawAttachments() {
    attachList.innerHTML = attachments.length ? attachments.map((a, i) => `
      <div class="participant-row">
        <div class="flex justify-between items-center">
          <span class="text-hi">${a.kind === "upload" ? "📎" : "🔗"} ${esc(a.label)}</span>
          <button type="button" class="btn btn-sm" data-remove-attach-idx="${i}">×</button>
        </div>
      </div>`).join("") : "";
    attachList.querySelectorAll("[data-remove-attach-idx]").forEach((b) =>
      b.addEventListener("click", () => { attachments.splice(Number(b.getAttribute("data-remove-attach-idx")), 1); redrawAttachments(); })
    );
  }

  document.getElementById("pf-add-link").addEventListener("click", () => {
    const label = document.getElementById("pf-attach-label").value.trim();
    const url = document.getElementById("pf-attach-url").value.trim();
    if (!label || !url) return toast("Adjon meg megnevezést és linket is.", "warn");
    attachments.push({ label, url, kind: "link" });
    document.getElementById("pf-attach-label").value = "";
    document.getElementById("pf-attach-url").value = "";
    redrawAttachments();
  });

  document.getElementById("pf-attach-file").addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > ATTACHMENT_MAX_UPLOAD_BYTES) {
      return toast(`A fájl túl nagy (max. ${formatFileSize(ATTACHMENT_MAX_UPLOAD_BYTES)}).`, "warn");
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const label = document.getElementById("pf-attach-label").value.trim() || file.name;
      attachments.push({ label, url: dataUrl, kind: "upload", size: file.size });
      document.getElementById("pf-attach-label").value = "";
      redrawAttachments();
    } catch {
      toast("Nem sikerült beolvasni a fájlt.", "warn");
    }
  });

  document.getElementById("post-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const title = document.getElementById("pf-title").value.trim();
    const body = document.getElementById("pf-body").value.trim();
    if (!title && !body && !attachments.length) return toast("Adjon meg szöveget, címet vagy mellékletet.", "warn");
    const post = createChannelPost(channelId, { title, body, attachments }, actorLabel());
    if (!post) return toast("Nem sikerült menteni — megtelt a böngésző helyi tárhelye.", "warn");
    toast("Bejegyzés közzétéve");
    closeModal();
    onDone();
  });
}
