import {
  getChannelCategories, getChannelCategory, createChannelCategory, renameChannelCategory, deleteChannelCategory,
  getChannelDocs, getChannelDoc, createChannelDoc, updateChannelDoc, deleteChannelDoc,
  getChannelQuestions, createChannelQuestion, deleteChannelQuestion,
  CHANNEL_DOC_STATUSES, ATTACHMENT_MAX_UPLOAD_BYTES, formatFileSize,
} from "../store.js?v=81";
import { isSuperAdmin, actorLabel } from "../auth.js?v=23";
import { esc, fmtDateTime, toast, openModal, closeModal, renderRichText, uploadFileToGitHub } from "../utils.js?v=31";
import { navigate } from "../router.js?v=20";

const DENIED = `<div class="denied"><div class="ic">⚠</div><h3>Hozzáférés megtagadva</h3><p class="text-low">A Csatornák kizárólag a Super Admin fiók számára elérhetők.</p></div>`;

export function renderChannelsCategories(container) {
  if (!isSuperAdmin()) { container.innerHTML = DENIED; return; }
  const categories = getChannelCategories();

  container.innerHTML = `
    <div class="classification-strip">U.S.S.S. BELSŐ CSATORNÁK · KIZÁRÓLAG SUPER ADMIN HOZZÁFÉRÉS</div>
    <p class="text-low small mb-2">Szabadon elnevezhető tartalom-csatornák — dokumentumok, képek és kérdések egy helyen. Kizárólag ez a fiók éri el.</p>
    <div class="section-head">
      <h2 style="visibility:hidden">.</h2>
      <div class="actions"><button class="btn btn-gold" id="new-category">+ Új csatorna</button></div>
    </div>
    <div class="tc-grid">
      ${categories.map((c) => {
        const docs = getChannelDocs(c.id);
        return `<div class="tc-card" data-nav="/channels/${esc(c.id)}">
          <div class="tc-card-cover"><span class="ic">▧</span></div>
          <div class="tc-card-body">
            <div class="tc-card-title">#${esc(c.name)}</div>
            <div class="tc-card-meta">${docs.length} dokumentum</div>
          </div>
        </div>`;
      }).join("") || `<div class="empty-state"><h3>Nincs még csatorna</h3><p>Hozza létre az elsőt a fenti gombbal.</p></div>`}
    </div>
  `;

  container.querySelectorAll("[data-nav]").forEach((n) => n.addEventListener("click", () => navigate(n.getAttribute("data-nav"))));
  document.getElementById("new-category").addEventListener("click", () => {
    openModal(`
      <div class="modal-head"><h3>Új csatorna</h3><button class="modal-close" data-close-modal>×</button></div>
      <form id="cat-form">
        <div class="field"><label>Csatorna neve</label><input id="cat-name" required autofocus placeholder="pl. Vizsga anyagok" /></div>
        <div class="flex justify-between mt-2">
          <button type="button" class="btn" data-close-modal>Mégse</button>
          <button type="submit" class="btn btn-gold">Létrehozás</button>
        </div>
      </form>
    `);
    document.getElementById("cat-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const name = document.getElementById("cat-name").value.trim();
      if (!name) return;
      const category = createChannelCategory(name, actorLabel());
      toast(`Csatorna létrehozva: #${category.name}`);
      closeModal();
      navigate(`/channels/${category.id}`);
    });
  });
}

export function renderChannelsCategory(container, categoryId) {
  if (!isSuperAdmin()) { container.innerHTML = DENIED; return; }
  const category = getChannelCategory(categoryId);
  if (!category) {
    container.innerHTML = `<div class="empty-state"><h3>A csatorna nem található</h3><a class="btn mt-2" href="#/channels">Vissza</a></div>`;
    return;
  }
  const docs = getChannelDocs(categoryId);

  container.innerHTML = `
    <a href="#/channels" class="text-low small">← Vissza a csatornákhoz</a>
    <div class="section-head mt-2">
      <h2>#${esc(category.name)}</h2>
      <div class="actions">
        <button class="btn btn-sm" id="rename-category">Átnevezés</button>
        <button class="btn btn-sm btn-danger" id="delete-category">Csatorna törlése</button>
        <button class="btn btn-gold" id="new-doc">+ Új dokumentum</button>
      </div>
    </div>
    <div class="tc-grid">
      ${docs.map((d) => `<div class="tc-card" data-nav="/channels/${esc(categoryId)}/${esc(d.id)}">
        <div class="tc-card-cover" ${d.coverImage ? `style="background-image:url('${esc(d.coverImage)}')"` : ""}>${d.coverImage ? "" : `<span class="ic">📄</span>`}</div>
        <div class="tc-card-body">
          <div class="tc-card-title">${esc(d.title)}</div>
          <div class="tc-card-meta"><span class="badge badge-gold" style="font-size:9px; padding:1px 6px;">${esc(d.status)}</span> · ${fmtDateTime(d.updatedAt)}</div>
        </div>
      </div>`).join("") || `<div class="empty-state"><h3>Nincs még dokumentum</h3><p>Hozza létre az elsőt a fenti gombbal.</p></div>`}
    </div>
  `;

  container.querySelectorAll("[data-nav]").forEach((n) => n.addEventListener("click", () => navigate(n.getAttribute("data-nav"))));

  document.getElementById("new-doc").addEventListener("click", () => {
    const doc = createChannelDoc(categoryId, { title: "Névtelen dokumentum" }, actorLabel());
    if (!doc) return toast("Nem sikerült létrehozni — megtelt a böngésző helyi tárhelye.", "warn");
    navigate(`/channels/${categoryId}/${doc.id}`);
  });

  document.getElementById("rename-category").addEventListener("click", () => {
    openModal(`
      <div class="modal-head"><h3>Csatorna átnevezése</h3><button class="modal-close" data-close-modal>×</button></div>
      <form id="rename-form">
        <div class="field"><label>Új név</label><input id="rename-input" required autofocus value="${esc(category.name)}" /></div>
        <div class="flex justify-between mt-2">
          <button type="button" class="btn" data-close-modal>Mégse</button>
          <button type="submit" class="btn btn-gold">Mentés</button>
        </div>
      </form>
    `);
    document.getElementById("rename-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const name = document.getElementById("rename-input").value.trim();
      if (!name) return;
      renameChannelCategory(categoryId, name, actorLabel());
      toast("Csatorna átnevezve");
      closeModal();
      renderChannelsCategory(document.getElementById("content"), categoryId);
    });
  });

  document.getElementById("delete-category").addEventListener("click", () => {
    if (!confirm(`Biztosan törli a(z) "#${category.name}" csatornát? Az összes benne lévő dokumentum és kérdés elvész.`)) return;
    deleteChannelCategory(categoryId, actorLabel());
    toast("Csatorna törölve");
    navigate("/channels");
  });
}

export function renderChannelsDoc(container, categoryId, docId) {
  if (!isSuperAdmin()) { container.innerHTML = DENIED; return; }
  const doc = getChannelDoc(docId);
  if (!doc) {
    container.innerHTML = `<div class="empty-state"><h3>A dokumentum nem található</h3><a class="btn mt-2" href="#/channels/${esc(categoryId)}">Vissza</a></div>`;
    return;
  }
  const questions = getChannelQuestions(docId);

  container.innerHTML = `
    <a href="#/channels/${esc(categoryId)}" class="text-low small">← Vissza a csatornához</a>
    <div class="card mt-2">
      <div class="flex justify-between items-center mb-2" style="gap:12px">
        <input id="doc-title" value="${esc(doc.title)}" style="flex:1; font-size:21px; font-family:var(--font-display); background:none; border:none; color:var(--gold-bright); padding:4px 0;" />
        <div class="flex items-center gap-1" style="flex:none">
          <span class="save-indicator" id="save-indicator"></span>
          <select id="doc-status">${CHANNEL_DOC_STATUSES.map((s) => `<option ${doc.status === s ? "selected" : ""}>${esc(s)}</option>`).join("")}</select>
          <button class="btn btn-sm btn-danger" id="delete-doc">Törlés</button>
        </div>
      </div>
      <textarea id="doc-description" rows="2" placeholder="Rövid leírás…" style="width:100%; background:var(--bg-base); border:1px solid var(--line-soft); border-radius:var(--radius-sm); color:var(--text-mid); padding:8px 10px; font-size:13px;">${esc(doc.description)}</textarea>

      <div class="divider"></div>
      <div class="card-title mb-1">Borítókép</div>
      <div id="doc-cover-wrap">${doc.coverImage ? `<img src="${esc(doc.coverImage)}" class="doc-cover" id="doc-cover-img"/>` : ""}</div>
      <div class="flex gap-1 items-center">
        <label class="btn btn-sm" style="cursor:pointer">Kép kiválasztása<input type="file" id="doc-cover-input" accept="image/*" style="display:none" /></label>
        ${doc.coverImage ? `<button class="btn btn-sm btn-danger" id="remove-cover">Eltávolítás</button>` : ""}
      </div>

      <div class="divider"></div>
      <div class="card-title mb-1">Tartalom</div>
      <div class="doc-editor-toolbar">
        <button type="button" class="btn" data-insert="## ">Alcím</button>
        <button type="button" class="btn" data-insert="### ">Kiscím</button>
        <button type="button" class="btn" data-insert="- ">Felsorolás</button>
        <button type="button" class="btn" data-insert="> ">Kiemelés</button>
        <button type="button" class="btn" data-wrap="**">Félkövér</button>
        <button type="button" class="btn" data-insert="\n---\n">Elválasztó</button>
        <button type="button" class="btn btn-gold" id="toggle-preview">Előnézet</button>
      </div>
      <textarea id="doc-content" rows="16" style="width:100%; background:var(--bg-base); border:1px solid var(--line-soft); border-radius:var(--radius-sm); color:var(--text-hi); padding:12px; font-family:var(--font-mono); font-size:12.5px;">${esc(doc.content)}</textarea>
      <div id="doc-preview" class="doc-content card mt-1" style="display:none"></div>

      <div class="divider"></div>
      <div class="card-title mb-1">Galéria</div>
      <div class="attachment-grid" id="doc-gallery">${renderGallery(doc.gallery || [])}</div>
      <div class="grid grid-2 mt-2">
        <input id="gallery-label" placeholder="Megnevezés" />
        <div class="flex gap-1"><input id="gallery-url" placeholder="https://… (külső hivatkozás)" style="flex:1" /><button type="button" class="btn btn-sm" id="add-gallery-link">+ Link</button></div>
      </div>
      <div class="flex gap-1 mt-1 items-center">
        <label class="btn btn-sm" style="cursor:pointer">Kép feltöltése<input type="file" id="gallery-file" accept="image/*" style="display:none" /></label>
        <span class="text-low small">max. ${formatFileSize(ATTACHMENT_MAX_UPLOAD_BYTES)}/kép</span>
      </div>

      <div class="divider"></div>
      <div class="card-title mb-1">Kapcsolódó kérdések (${questions.length})</div>
      <div id="doc-questions">${renderQuestions(questions)}</div>
      <button class="btn btn-sm btn-gold mt-1" id="new-question">+ Új kérdés</button>
    </div>
  `;

  wireDocEditor(container, categoryId, doc);
}

function renderGallery(gallery) {
  if (!gallery.length) return `<div class="text-low small">Nincs kép a galériában.</div>`;
  return gallery.map((g, i) => `
    <div class="attachment-card">
      <a href="${esc(g.url)}" target="_blank" rel="noopener noreferrer"><img src="${esc(g.url)}" alt="${esc(g.label)}" class="attachment-thumb" /></a>
      <div class="attachment-meta"><span class="text-gold small">${esc(g.label)}</span><span class="text-low" style="font-size:11px">${g.kind === "upload" ? `Feltöltve${g.size ? ` · ${formatFileSize(g.size)}` : ""}` : "Külső hivatkozás"}</span></div>
      <button class="btn btn-sm btn-danger" data-remove-gallery="${i}">×</button>
    </div>`).join("");
}

function renderQuestions(questions) {
  if (!questions.length) return `<div class="text-low small">Nincs még kérdés.</div>`;
  return questions.map((q) => `
    <div class="history-item" style="align-items:flex-start; flex-direction:column; gap:4px;">
      <div class="flex justify-between items-start" style="width:100%">
        <span class="text-hi">${esc(q.question)}</span>
        <button class="btn btn-sm btn-danger" data-delete-question="${esc(q.id)}">×</button>
      </div>
      ${q.correctAnswer ? `<span class="text-low small">Helyes válasz: ${esc(q.correctAnswer)}</span>` : ""}
      ${q.explanation ? `<span class="text-low small">${esc(q.explanation)}</span>` : ""}
    </div>`).join("");
}

function wireDocEditor(container, categoryId, doc) {
  const indicator = document.getElementById("save-indicator");
  let saveTimer = null;
  let pendingPatch = {};
  function scheduleSave(patch) {
    Object.assign(pendingPatch, patch);
    indicator.textContent = "Mentés…";
    indicator.className = "save-indicator saving";
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const toSave = pendingPatch;
      pendingPatch = {};
      const result = updateChannelDoc(doc.id, toSave, actorLabel());
      if (!result) {
        indicator.textContent = "Mentés sikertelen — megtelt a tárhely";
        indicator.className = "save-indicator";
        return;
      }
      Object.assign(doc, toSave);
      indicator.textContent = "Mentve ✓";
      indicator.className = "save-indicator saved";
    }, 600);
  }

  document.getElementById("doc-title").addEventListener("input", (e) => scheduleSave({ title: e.target.value.trim() || "Névtelen dokumentum" }));
  document.getElementById("doc-description").addEventListener("input", (e) => scheduleSave({ description: e.target.value }));
  document.getElementById("doc-content").addEventListener("input", (e) => scheduleSave({ content: e.target.value }));
  document.getElementById("doc-status").addEventListener("change", (e) => scheduleSave({ status: e.target.value }));

  document.getElementById("delete-doc").addEventListener("click", () => {
    if (!confirm(`Biztosan törli a(z) "${doc.title}" dokumentumot?`)) return;
    deleteChannelDoc(doc.id, actorLabel());
    toast("Dokumentum törölve");
    navigate(`/channels/${categoryId}`);
  });

  const contentArea = document.getElementById("doc-content");
  container.querySelectorAll("[data-insert]").forEach((b) =>
    b.addEventListener("click", () => {
      const text = b.getAttribute("data-insert");
      const pos = contentArea.selectionStart;
      contentArea.value = contentArea.value.slice(0, pos) + text + contentArea.value.slice(pos);
      contentArea.focus();
      contentArea.selectionStart = contentArea.selectionEnd = pos + text.length;
      scheduleSave({ content: contentArea.value });
    })
  );
  container.querySelectorAll("[data-wrap]").forEach((b) =>
    b.addEventListener("click", () => {
      const mark = b.getAttribute("data-wrap");
      const start = contentArea.selectionStart, end = contentArea.selectionEnd;
      const selected = contentArea.value.slice(start, end) || "szöveg";
      contentArea.value = contentArea.value.slice(0, start) + mark + selected + mark + contentArea.value.slice(end);
      contentArea.focus();
      scheduleSave({ content: contentArea.value });
    })
  );

  const previewEl = document.getElementById("doc-preview");
  document.getElementById("toggle-preview").addEventListener("click", (e) => {
    const showing = previewEl.style.display !== "none";
    if (showing) {
      previewEl.style.display = "none";
      contentArea.style.display = "";
      e.target.textContent = "Előnézet";
    } else {
      previewEl.innerHTML = renderRichText(contentArea.value);
      previewEl.style.display = "";
      contentArea.style.display = "none";
      e.target.textContent = "Szerkesztés";
    }
  });

  document.getElementById("doc-cover-input").addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > ATTACHMENT_MAX_UPLOAD_BYTES) return toast(`A kép túl nagy (max. ${formatFileSize(ATTACHMENT_MAX_UPLOAD_BYTES)}).`, "warn");
    toast("Feltöltés a GitHub-ra…");
    try {
      const dataUrl = await uploadFileToGitHub(file);
      const result = updateChannelDoc(doc.id, { coverImage: dataUrl }, actorLabel());
      if (!result) return toast("Nem sikerült menteni.", "warn");
      toast("Borítókép frissítve");
      renderChannelsDoc(container, categoryId, doc.id);
    } catch {
      toast("Nem sikerült feltölteni a GitHub-ra.", "warn");
    }
  });
  document.getElementById("remove-cover")?.addEventListener("click", () => {
    updateChannelDoc(doc.id, { coverImage: null }, actorLabel());
    toast("Borítókép eltávolítva");
    renderChannelsDoc(container, categoryId, doc.id);
  });

  const gallery = (doc.gallery || []).slice();
  function persistGallery() {
    const result = updateChannelDoc(doc.id, { gallery }, actorLabel());
    if (!result) { toast("Nem sikerült menteni — megtelt a böngésző helyi tárhelye.", "warn"); return; }
    document.getElementById("doc-gallery").innerHTML = renderGallery(gallery);
    wireGalleryRemove();
  }
  function wireGalleryRemove() {
    document.querySelectorAll("[data-remove-gallery]").forEach((b) =>
      b.addEventListener("click", () => { gallery.splice(Number(b.getAttribute("data-remove-gallery")), 1); persistGallery(); })
    );
  }
  wireGalleryRemove();

  document.getElementById("add-gallery-link").addEventListener("click", () => {
    const label = document.getElementById("gallery-label").value.trim();
    const url = document.getElementById("gallery-url").value.trim();
    if (!label || !url) return toast("Adjon meg megnevezést és linket is.", "warn");
    gallery.push({ label, url, kind: "link" });
    document.getElementById("gallery-label").value = "";
    document.getElementById("gallery-url").value = "";
    persistGallery();
  });
  document.getElementById("gallery-file").addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > ATTACHMENT_MAX_UPLOAD_BYTES) return toast(`A fájl túl nagy (max. ${formatFileSize(ATTACHMENT_MAX_UPLOAD_BYTES)}).`, "warn");
    toast("Feltöltés a GitHub-ra…");
    try {
      const dataUrl = await uploadFileToGitHub(file);
      const label = document.getElementById("gallery-label").value.trim() || file.name;
      gallery.push({ label, url: dataUrl, kind: "upload", size: file.size });
      document.getElementById("gallery-label").value = "";
      persistGallery();
    } catch {
      toast("Nem sikerült feltölteni a GitHub-ra.", "warn");
    }
  });

  container.querySelectorAll("[data-delete-question]").forEach((b) =>
    b.addEventListener("click", () => {
      deleteChannelQuestion(b.getAttribute("data-delete-question"), actorLabel());
      toast("Kérdés törölve");
      renderChannelsDoc(container, categoryId, doc.id);
    })
  );

  document.getElementById("new-question").addEventListener("click", () => {
    openModal(`
      <div class="modal-head"><h3>Új kérdés</h3><button class="modal-close" data-close-modal>×</button></div>
      <form id="question-form">
        <div class="field"><label>Kérdés</label><textarea id="qf-question" rows="2" required autofocus></textarea></div>
        <div class="field"><label>Helyes válasz (opcionális)</label><input id="qf-answer" /></div>
        <div class="field"><label>Magyarázat (opcionális)</label><textarea id="qf-explanation" rows="2"></textarea></div>
        <div class="flex justify-between mt-2">
          <button type="button" class="btn" data-close-modal>Mégse</button>
          <button type="submit" class="btn btn-gold">Hozzáadás</button>
        </div>
      </form>
    `);
    document.getElementById("question-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const question = document.getElementById("qf-question").value.trim();
      if (!question) return;
      createChannelQuestion(doc.id, {
        question,
        correctAnswer: document.getElementById("qf-answer").value,
        explanation: document.getElementById("qf-explanation").value,
      }, actorLabel());
      toast("Kérdés hozzáadva");
      closeModal();
      renderChannelsDoc(container, categoryId, doc.id);
    });
  });
}
