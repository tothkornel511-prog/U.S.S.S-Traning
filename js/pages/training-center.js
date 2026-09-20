import {
  getTrainingCategories, getTrainingCategory, createTrainingCategory, renameTrainingCategory, deleteTrainingCategory,
  getTrainingFiles, createTrainingFile, deleteTrainingFile,
  isImageAttachment, ATTACHMENT_MAX_UPLOAD_BYTES, formatFileSize,
} from "../store.js?v=76";
import { isSuperAdmin, actorLabel } from "../auth.js?v=23";
import { esc, fmtDateTime, toast, openModal, closeModal, previewAttachment, uploadFileToGitHub } from "../utils.js?v=31";
import { navigate } from "../router.js?v=20";

const DENIED = `<div class="denied"><div class="ic">⚠</div><h3>Hozzáférés megtagadva</h3><p class="text-low">A Training Center kizárólag a Super Admin fiók számára elérhető.</p></div>`;

export function renderTrainingCenterCategories(container) {
  if (!isSuperAdmin()) { container.innerHTML = DENIED; return; }
  const categories = getTrainingCategories();

  container.innerHTML = `
    <div class="classification-strip">U.S.S.S. TRAINING CENTER · KIZÁRÓLAG SUPER ADMIN HOZZÁFÉRÉS</div>
    <p class="text-low small mb-2">Kategorizált fájlkönyvtár — tölts fel PDF/DOCX/kép anyagokat fokozatonként, és nyisd meg őket egy kattintással. Kizárólag ez a fiók éri el.</p>
    <div class="section-head">
      <h2 style="visibility:hidden">.</h2>
      <div class="actions"><button class="btn btn-gold" id="new-category">+ Új kategória</button></div>
    </div>
    <div class="tc-grid">
      ${categories.map((c) => {
        const files = getTrainingFiles(c.id);
        return `<div class="tc-card" data-nav="/training-center/${esc(c.id)}">
          <div class="tc-card-cover"><span class="ic">📁</span></div>
          <div class="tc-card-body">
            <div class="tc-card-title">${esc(c.name)}</div>
            <div class="tc-card-meta">${files.length} fájl</div>
          </div>
        </div>`;
      }).join("") || `<div class="empty-state"><h3>Nincs még kategória</h3><p>Hozza létre az elsőt a fenti gombbal.</p></div>`}
    </div>
  `;

  container.querySelectorAll("[data-nav]").forEach((n) => n.addEventListener("click", () => navigate(n.getAttribute("data-nav"))));
  document.getElementById("new-category").addEventListener("click", () => {
    openModal(`
      <div class="modal-head"><h3>Új kategória</h3><button class="modal-close" data-close-modal>×</button></div>
      <form id="cat-form">
        <div class="field"><label>Kategória neve</label><input id="cat-name" required autofocus placeholder="pl. VI – Speciális egység" /></div>
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
      const category = createTrainingCategory(name, actorLabel());
      toast(`Kategória létrehozva: ${category.name}`);
      closeModal();
      navigate(`/training-center/${category.id}`);
    });
  });
}

export function renderTrainingCenterCategory(container, categoryId) {
  if (!isSuperAdmin()) { container.innerHTML = DENIED; return; }
  const category = getTrainingCategory(categoryId);
  if (!category) {
    container.innerHTML = `<div class="empty-state"><h3>A kategória nem található</h3><a class="btn mt-2" href="#/training-center">Vissza</a></div>`;
    return;
  }
  const files = getTrainingFiles(categoryId);

  container.innerHTML = `
    <a href="#/training-center" class="text-low small">← Vissza a kategóriákhoz</a>
    <div class="section-head mt-2">
      <h2>${esc(category.name)}</h2>
      <div class="actions">
        <button class="btn btn-sm" id="rename-category">Átnevezés</button>
        <button class="btn btn-sm btn-danger" id="delete-category">Kategória törlése</button>
      </div>
    </div>
    <div class="attachment-grid" id="tc-files">${renderFiles(files)}</div>
    <div class="card mt-2">
      <div class="card-title mb-1">Új fájl hozzáadása</div>
      <div class="grid grid-2">
        <input id="file-label" placeholder="Megnevezés, pl. Konvoj szabályzat.pdf" />
        <div class="flex gap-1"><input id="file-url" placeholder="https://… (külső hivatkozás)" style="flex:1" /><button type="button" class="btn btn-sm" id="add-file-link">+ Link</button></div>
      </div>
      <div class="flex gap-1 mt-1 items-center">
        <label class="btn btn-sm" style="cursor:pointer">Fájl feltöltése<input type="file" id="file-upload-input" style="display:none" /></label>
        <span class="text-low small">max. ${formatFileSize(ATTACHMENT_MAX_UPLOAD_BYTES)}/fájl — nagyobb anyaghoz külső linket használj</span>
      </div>
    </div>
  `;

  wireFileManager(container, categoryId, category);
}

function renderFiles(files) {
  if (!files.length) return `<div class="empty-state"><h3>Nincs még fájl</h3><p>Töltsd fel vagy linkeld az elsőt lent.</p></div>`;
  return files.map((f) => `
    <div class="attachment-card">
      ${isImageAttachment(f) ? `<img src="${esc(f.url)}" alt="${esc(f.label)}" class="attachment-thumb" data-open-file="${esc(f.id)}" style="cursor:pointer" />` : `<a href="#" data-open-file="${esc(f.id)}" class="attachment-file-icon">📄</a>`}
      <div class="attachment-meta">
        <a href="#" data-open-file="${esc(f.id)}" class="text-gold small">${esc(f.label)}</a>
        <span class="text-low" style="font-size:11px">${f.kind === "upload" ? `Feltöltve${f.size ? ` · ${formatFileSize(f.size)}` : ""}` : "Külső hivatkozás"} · ${fmtDateTime(f.createdAt)}</span>
      </div>
      <button class="btn btn-sm btn-danger" data-delete-file="${esc(f.id)}">×</button>
    </div>`).join("");
}

function wireFileManager(container, categoryId, category) {
  function refreshFiles() {
    document.getElementById("tc-files").innerHTML = renderFiles(getTrainingFiles(categoryId));
    wireFileActions();
  }
  function wireFileActions() {
    container.querySelectorAll("[data-open-file]").forEach((el) =>
      el.addEventListener("click", (e) => {
        e.preventDefault();
        const file = getTrainingFiles(categoryId).find((f) => f.id === el.getAttribute("data-open-file"));
        if (file) previewAttachment(file.label, file.url);
      })
    );
    container.querySelectorAll("[data-delete-file]").forEach((b) =>
      b.addEventListener("click", () => {
        if (!confirm("Biztosan törli ezt a fájlt?")) return;
        deleteTrainingFile(b.getAttribute("data-delete-file"), actorLabel());
        toast("Fájl törölve");
        refreshFiles();
      })
    );
  }
  wireFileActions();

  document.getElementById("add-file-link").addEventListener("click", () => {
    const label = document.getElementById("file-label").value.trim();
    const url = document.getElementById("file-url").value.trim();
    if (!label || !url) return toast("Adjon meg megnevezést és linket is.", "warn");
    const file = createTrainingFile(categoryId, { label, url, kind: "link" }, actorLabel());
    if (!file) return toast("Nem sikerült menteni — megtelt a böngésző helyi tárhelye.", "warn");
    document.getElementById("file-label").value = "";
    document.getElementById("file-url").value = "";
    toast("Fájl hozzáadva");
    refreshFiles();
  });

  document.getElementById("file-upload-input").addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > ATTACHMENT_MAX_UPLOAD_BYTES) return toast(`A fájl túl nagy (max. ${formatFileSize(ATTACHMENT_MAX_UPLOAD_BYTES)}).`, "warn");
    toast("Feltöltés a GitHub-ra…");
    try {
      const url = await uploadFileToGitHub(file);
      const label = document.getElementById("file-label").value.trim() || file.name;
      const saved = createTrainingFile(categoryId, { label, url, kind: "upload", size: file.size }, actorLabel());
      if (!saved) return toast("Nem sikerült menteni.", "warn");
      document.getElementById("file-label").value = "";
      toast("Fájl feltöltve");
      refreshFiles();
    } catch {
      toast("Nem sikerült feltölteni a GitHub-ra.", "warn");
    }
  });

  document.getElementById("rename-category").addEventListener("click", () => {
    openModal(`
      <div class="modal-head"><h3>Kategória átnevezése</h3><button class="modal-close" data-close-modal>×</button></div>
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
      renameTrainingCategory(categoryId, name, actorLabel());
      toast("Kategória átnevezve");
      closeModal();
      renderTrainingCenterCategory(document.getElementById("content"), categoryId);
    });
  });

  document.getElementById("delete-category").addEventListener("click", () => {
    if (!confirm(`Biztosan törli a(z) "${category.name}" kategóriát? Az összes benne lévő fájl elvész.`)) return;
    deleteTrainingCategory(categoryId, actorLabel());
    toast("Kategória törölve");
    navigate("/training-center");
  });
}
