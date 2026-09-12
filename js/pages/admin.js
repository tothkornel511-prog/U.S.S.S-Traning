import { getAccessCodes, upsertAccessCode, revokeAccessCode, generateCode, getAuditLog, getPersonnel, resetAllData, ref, getPositionEntries, addPosition, removePosition, getCustomCss, setCustomCss, getInvestigationCategories, addInvestigationCategory, removeInvestigationCategory, getCovertOpClassifications, addCovertOpClassification, removeCovertOpClassification, exportAllData, importAllData, getStorageReport, SECTIONS, BRANDING_SLOTS, MAX_BRANDING_BYTES, getBrandingUrl, getBrandingOverride, setBrandingOverride, clearBrandingOverride } from "../store.js?v=64";
import { hasRole, isSuperAdmin, SUPER_ADMIN_ID, actorLabel, ROLES, hasSuperAdminPin, clearSuperAdminPin, hasSuperAdminCode, clearSuperAdminCode } from "../auth.js?v=23";
import { esc, fmtDateTime, toast, openModal, closeModal, applyBranding } from "../utils.js?v=23";

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

let activeTab = "access";

export function renderAdmin(container) {
  if (!hasRole("TRAINING")) {
    container.innerHTML = `<div class="denied"><div class="ic">⚠</div><h3>Hozzáférés megtagadva</h3><p class="text-low">Ehhez az oldalhoz Oktatásvezetői vagy Admin jogosultság szükséges.</p></div>`;
    return;
  }
  const isAdmin = hasRole("ADMIN");
  const superAdmin = isSuperAdmin();

  container.innerHTML = `
    <div class="tabs">
      <button class="tab-btn ${activeTab === "access" ? "active" : ""}" data-tab="access">Hozzáférések</button>
      <button class="tab-btn ${activeTab === "positions" ? "active" : ""}" data-tab="positions">Pozíciók</button>
      <button class="tab-btn ${activeTab === "inv-categories" ? "active" : ""}" data-tab="inv-categories">Vizsgálati kategóriák</button>
      <button class="tab-btn ${activeTab === "op-classifications" ? "active" : ""}" data-tab="op-classifications">Műveleti minősítések</button>
      <button class="tab-btn ${activeTab === "audit" ? "active" : ""}" data-tab="audit">Eseménynapló</button>
      ${superAdmin ? `<button class="tab-btn ${activeTab === "system" ? "active" : ""}" data-tab="system">Rendszerbeállítások</button>` : ""}
      ${superAdmin ? `<button class="tab-btn ${activeTab === "dev" ? "active" : ""}" data-tab="dev">Fejlesztés</button>` : ""}
    </div>
    <div id="admin-tab-content"></div>
  `;

  container.querySelectorAll(".tab-btn").forEach((b) =>
    b.addEventListener("click", () => { activeTab = b.getAttribute("data-tab"); renderAdmin(container); })
  );

  const content = document.getElementById("admin-tab-content");
  if (activeTab === "access") renderAccessTab(content, superAdmin);
  else if (activeTab === "positions") renderPositionsTab(content, isAdmin);
  else if (activeTab === "inv-categories") renderInvestigationCategoriesTab(content, isAdmin);
  else if (activeTab === "op-classifications") renderOpClassificationsTab(content, isAdmin);
  else if (activeTab === "audit") renderAuditTab(content);
  else if (activeTab === "system") renderSystemTab(content);
  else if (activeTab === "dev") renderDevTab(content);
}

function renderPositionsTab(content, isAdmin) {
  const entries = getPositionEntries();
  const groups = [...new Set(entries.map((p) => p.group))];

  content.innerHTML = `
    <div class="section-head">
      <h2 style="font-size:15px">Pozíciók / rangok</h2>
      ${isAdmin ? `<button class="btn btn-gold btn-sm" id="new-position">+ Új pozíció</button>` : ""}
    </div>
    <p class="text-low small mb-2">Ezek jelennek meg a Pozíció mezőben a személyi profiloknál. Új rang felvételéhez nincs szükség kódmódosításra.</p>
    ${groups.map((g) => `
      <div class="card-title mb-1 mt-2">${esc(g)}</div>
      ${entries.filter((p) => p.group === g).map((p) => `
        <div class="history-item">
          <span>${esc(p.name)}</span>
          ${isAdmin ? `<button class="btn btn-sm btn-danger" data-remove-pos="${esc(p.name)}">×</button>` : ""}
        </div>`).join("") || `<div class="text-low small">Nincs pozíció ebben a csoportban.</div>`}
    `).join("")}
  `;

  if (isAdmin) {
    document.getElementById("new-position").addEventListener("click", () => openPositionForm(groups));
    content.querySelectorAll("[data-remove-pos]").forEach((b) =>
      b.addEventListener("click", () => {
        const name = b.getAttribute("data-remove-pos");
        if (confirm(`Törli a(z) "${name}" pozíciót a listából?`)) {
          removePosition(name, actorLabel());
          toast("Pozíció törölve");
          renderAdmin(document.getElementById("content"));
        }
      })
    );
  }
}

function openPositionForm(existingGroups) {
  openModal(`
    <div class="modal-head"><h3>Új pozíció</h3><button class="modal-close" data-close-modal>×</button></div>
    <form id="position-form">
      <div class="field"><label>Pozíció neve</label><input required id="pf-name" autofocus placeholder="pl. Deputy Director" /></div>
      <div class="field"><label>Csoport</label>
        <select id="pf-group">
          ${existingGroups.map((g) => `<option value="${esc(g)}">${esc(g)}</option>`).join("")}
          <option value="__new__">+ Új csoport…</option>
        </select>
      </div>
      <div class="field" id="pf-new-group-wrap" style="display:none;"><label>Új csoport neve</label><input id="pf-new-group" placeholder="pl. Rendőrség" /></div>
      <div class="flex justify-between mt-2">
        <button type="button" class="btn" data-close-modal>Mégse</button>
        <button type="submit" class="btn btn-gold">Mentés</button>
      </div>
    </form>
  `);

  document.getElementById("pf-group").addEventListener("change", (e) => {
    document.getElementById("pf-new-group-wrap").style.display = e.target.value === "__new__" ? "block" : "none";
  });

  document.getElementById("position-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("pf-name").value.trim();
    const groupSel = document.getElementById("pf-group").value;
    const group = groupSel === "__new__" ? document.getElementById("pf-new-group").value.trim() : groupSel;
    if (!name || !group) return;
    addPosition(name, group, actorLabel());
    toast("Pozíció hozzáadva");
    closeModal();
    renderAdmin(document.getElementById("content"));
  });
}

function renderInvestigationCategoriesTab(content, isAdmin) {
  const categories = getInvestigationCategories();

  content.innerHTML = `
    <div class="section-head">
      <h2 style="font-size:15px">Belső vizsgálati kategóriák</h2>
      ${isAdmin ? `<button class="btn btn-gold btn-sm" id="new-inv-category">+ Új kategória</button>` : ""}
    </div>
    <p class="text-low small mb-2">Ezek jelennek meg a Belső Vizsgálatok modul "Kategória" mezőjében. Új kategória felvételéhez nincs szükség kódmódosításra.</p>
    ${categories.map((c) => `
      <div class="history-item">
        <span>${esc(c)}</span>
        ${isAdmin ? `<button class="btn btn-sm btn-danger" data-remove-cat="${esc(c)}">×</button>` : ""}
      </div>`).join("") || `<div class="text-low small">Nincs rögzített kategória.</div>`}
  `;

  if (isAdmin) {
    document.getElementById("new-inv-category").addEventListener("click", () => openInvestigationCategoryForm());
    content.querySelectorAll("[data-remove-cat]").forEach((b) =>
      b.addEventListener("click", () => {
        const name = b.getAttribute("data-remove-cat");
        if (confirm(`Törli a(z) "${name}" kategóriát a listából?`)) {
          removeInvestigationCategory(name, actorLabel());
          toast("Kategória törölve");
          renderAdmin(document.getElementById("content"));
        }
      })
    );
  }
}

function openInvestigationCategoryForm() {
  openModal(`
    <div class="modal-head"><h3>Új vizsgálati kategória</h3><button class="modal-close" data-close-modal>×</button></div>
    <form id="inv-category-form">
      <div class="field"><label>Kategória neve</label><input required id="cf-name" autofocus placeholder="pl. Árulás" /></div>
      <div class="flex justify-between mt-2">
        <button type="button" class="btn" data-close-modal>Mégse</button>
        <button type="submit" class="btn btn-gold">Mentés</button>
      </div>
    </form>
  `);
  document.getElementById("inv-category-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("cf-name").value.trim();
    if (!name) return;
    addInvestigationCategory(name, actorLabel());
    toast("Kategória hozzáadva");
    closeModal();
    renderAdmin(document.getElementById("content"));
  });
}

function renderOpClassificationsTab(content, isAdmin) {
  const classifications = getCovertOpClassifications();

  content.innerHTML = `
    <div class="section-head">
      <h2 style="font-size:15px">Fedett műveleti minősítések</h2>
      ${isAdmin ? `<button class="btn btn-gold btn-sm" id="new-op-class">+ Új minősítés</button>` : ""}
    </div>
    <p class="text-low small mb-2">Ezek jelennek meg a Fedett Műveletek modul "Minősítés" mezőjében. Új szint felvételéhez nincs szükség kódmódosításra.</p>
    ${classifications.map((c) => `
      <div class="history-item">
        <span>${esc(c)}</span>
        ${isAdmin ? `<button class="btn btn-sm btn-danger" data-remove-op-class="${esc(c)}">×</button>` : ""}
      </div>`).join("") || `<div class="text-low small">Nincs rögzített minősítés.</div>`}
  `;

  if (isAdmin) {
    document.getElementById("new-op-class").addEventListener("click", () => openOpClassificationForm());
    content.querySelectorAll("[data-remove-op-class]").forEach((b) =>
      b.addEventListener("click", () => {
        const name = b.getAttribute("data-remove-op-class");
        if (confirm(`Törli a(z) "${name}" minősítést a listából?`)) {
          removeCovertOpClassification(name, actorLabel());
          toast("Minősítés törölve");
          renderAdmin(document.getElementById("content"));
        }
      })
    );
  }
}

function openOpClassificationForm() {
  openModal(`
    <div class="modal-head"><h3>Új fedett műveleti minősítés</h3><button class="modal-close" data-close-modal>×</button></div>
    <form id="op-class-form">
      <div class="field"><label>Minősítés neve</label><input required id="ocf-name" autofocus placeholder="pl. Kizárólag vezetői betekintés" /></div>
      <div class="flex justify-between mt-2">
        <button type="button" class="btn" data-close-modal>Mégse</button>
        <button type="submit" class="btn btn-gold">Mentés</button>
      </div>
    </form>
  `);
  document.getElementById("op-class-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("ocf-name").value.trim();
    if (!name) return;
    addCovertOpClassification(name, actorLabel());
    toast("Minősítés hozzáadva");
    closeModal();
    renderAdmin(document.getElementById("content"));
  });
}

function renderAccessTab(content, canManage) {
  const codes = getAccessCodes();
  const personnel = getPersonnel();

  content.innerHTML = `
    <div class="section-head">
      <h2 style="font-size:15px">Hozzáférési kódok és szobánkénti jogosultságok</h2>
      ${canManage ? `<button class="btn btn-gold btn-sm" id="new-access">+ Új hozzáférés</button>` : ""}
    </div>
    <p class="text-mid small mb-2">A ${esc(SUPER_ADMIN_ID)} fiók mindig teljes hozzáféréssel rendelkezik. Mindenki más csak azokat a menüpontokat ("szobákat") látja, amiket itt kifejezetten megkap.</p>
    <div class="table-wrap"><table>
      <thead><tr><th>USSS ID</th><th>Név</th><th>Szerepkör</th><th>Hozzáférési kód</th><th>Jogosultságok</th>${canManage ? "<th></th>" : ""}</tr></thead>
      <tbody>
        ${codes.length ? codes.map((c) => {
          const p = personnel.find((x) => x.usssId === c.usssId);
          const owner = c.usssId === SUPER_ADMIN_ID;
          const sectionCount = (c.sections || []).length;
          return `<tr>
            <td style="font-family:var(--font-mono)">${esc(c.usssId)}</td>
            <td>${esc(p?.name || "—")}</td>
            <td><span class="badge badge-gold">${esc(ROLES[c.role]?.label || c.role)}</span></td>
            <td style="font-family:var(--font-mono)">${esc(c.code)}</td>
            <td>${owner ? `<span class="badge badge-orange">Teljes (Super Admin)</span>` : sectionCount ? `<span class="text-mid small">${sectionCount} / ${SECTIONS.length} szoba</span>` : `<span class="text-low small">Nincs jogosultság</span>`}</td>
            ${canManage ? `<td><div class="flex gap-1"><button class="btn btn-sm" data-edit="${esc(c.usssId)}">Szerkeszt</button>${owner ? "" : `<button class="btn btn-sm btn-danger" data-revoke="${esc(c.usssId)}">Visszavonás</button>`}</div></td>` : ""}
          </tr>`;
        }).join("") : `<tr><td colspan="6"><div class="empty-state"><h3>Nincs rögzített hozzáférés</h3></div></td></tr>`}
      </tbody>
    </table></div>
  `;

  if (canManage) {
    document.getElementById("new-access").addEventListener("click", () => openAccessForm(personnel));
    content.querySelectorAll("[data-edit]").forEach((b) =>
      b.addEventListener("click", () => openAccessForm(personnel, codes.find((c) => c.usssId === b.getAttribute("data-edit"))))
    );
    content.querySelectorAll("[data-revoke]").forEach((b) =>
      b.addEventListener("click", () => {
        const id = b.getAttribute("data-revoke");
        if (confirm(`Visszavonja a(z) ${id} hozzáférését?`)) {
          revokeAccessCode(id, actorLabel());
          toast("Hozzáférés visszavonva");
          renderAdmin(document.getElementById("content"));
        }
      })
    );
  }
}

function openAccessForm(personnel, entry) {
  const isNew = !entry;
  const owner = entry?.usssId === SUPER_ADMIN_ID;
  const selectedSections = new Set(entry?.sections || []);
  const groups = [...new Set(SECTIONS.filter((s) => s.id !== "dashboard").map((s) => s.group))];

  openModal(`
    <div class="modal-head"><h3>${isNew ? "Új hozzáférés" : "Hozzáférés szerkesztése"}</h3><button class="modal-close" data-close-modal>×</button></div>
    <form id="access-form">
      <div class="field"><label>Személy</label>
        <select id="af-person" ${isNew ? "" : "disabled"}>
          ${personnel.map((p) => `<option value="${esc(p.usssId)}" ${entry?.usssId === p.usssId ? "selected" : ""}>${esc(p.name)} (${esc(p.usssId)})</option>`).join("")}
        </select>
      </div>
      <div class="field"><label>Szerepkör</label>
        <select id="af-role">
          <option value="ADMIN" ${entry?.role === "ADMIN" ? "selected" : ""}>Admin — teljes hozzáférés</option>
          <option value="TRAINING" ${entry?.role === "TRAINING" ? "selected" : ""}>Oktatásvezető — oktatás / vizsga kezelés</option>
          <option value="VIEWER" ${entry?.role === "VIEWER" ? "selected" : ""}>Megfigyelő — csak megtekintés</option>
        </select>
      </div>
      <div class="field">
        <label>Hozzáférési kód</label>
        <div class="flex gap-1"><input id="af-code" value="${esc(entry?.code || generateCode())}" style="flex:1; font-family:var(--font-mono)" /><button type="button" class="btn btn-sm" id="af-regen">Új kód</button></div>
      </div>
      ${owner ? `
      <div class="field"><label>Szobánkénti jogosultságok</label><p class="text-low small">Ez a fiók (${esc(SUPER_ADMIN_ID)}) mindig teljes hozzáféréssel rendelkezik — itt nincs mit beállítani.</p></div>
      ` : `
      <div style="margin-bottom:18px;">
        <div class="section-check-label">Szobánkénti jogosultságok</div>
        <div class="flex gap-1 mb-1"><button type="button" class="btn btn-sm" id="af-select-all">Mind kijelöl</button><button type="button" class="btn btn-sm" id="af-select-none">Mind töröl</button></div>
        <div style="max-height:260px; overflow-y:auto; border:1px solid var(--line-soft); border-radius:var(--radius-sm); padding:10px;">
          ${groups.map((g) => `
            <div class="card-title mb-1 mt-1">${esc(g)}</div>
            ${SECTIONS.filter((s) => s.group === g).map((s) => `
              <label class="section-check-row">
                <input type="checkbox" class="af-section" value="${esc(s.id)}" ${selectedSections.has(s.id) ? "checked" : ""} /> <span>${esc(s.label)}</span>
              </label>`).join("")}
          `).join("")}
        </div>
      </div>
      `}
      <div class="flex justify-between mt-2">
        <button type="button" class="btn" data-close-modal>Mégse</button>
        <button type="submit" class="btn btn-gold">Mentés</button>
      </div>
    </form>
  `);

  document.getElementById("af-regen").addEventListener("click", () => {
    document.getElementById("af-code").value = generateCode();
  });
  document.getElementById("af-select-all")?.addEventListener("click", () => {
    document.querySelectorAll(".af-section").forEach((cb) => { cb.checked = true; });
  });
  document.getElementById("af-select-none")?.addEventListener("click", () => {
    document.querySelectorAll(".af-section").forEach((cb) => { cb.checked = false; });
  });

  document.getElementById("access-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const sections = owner ? undefined : [...document.querySelectorAll(".af-section:checked")].map((cb) => cb.value);
    upsertAccessCode({
      usssId: document.getElementById("af-person").value,
      role: document.getElementById("af-role").value,
      code: document.getElementById("af-code").value.trim(),
      ...(sections ? { sections } : {}),
    }, actorLabel());
    toast("Hozzáférés mentve");
    closeModal();
    renderAdmin(document.getElementById("content"));
  });
}

function renderAuditTab(content) {
  const log = getAuditLog();
  content.innerHTML = `
    <div class="table-wrap"><table>
      <thead><tr><th>Időpont</th><th>Végrehajtó</th><th>Esemény</th><th>Részletek</th></tr></thead>
      <tbody>
        ${log.length ? log.map((a) => `
          <tr>
            <td class="text-low">${fmtDateTime(a.timestamp)}</td>
            <td>${esc(a.actor)}</td>
            <td><span class="badge badge-gold">${esc(a.action)}</span></td>
            <td>${esc(a.detail)}</td>
          </tr>`).join("") : `<tr><td colspan="4"><div class="empty-state"><h3>Nincs rögzített esemény</h3></div></td></tr>`}
      </tbody>
    </table></div>
    <div class="small text-low mt-2">Az audit napló a normál adminfelületről nem törölhető.</div>
  `;
}

function renderSystemTab(content) {
  content.innerHTML = `
    <div class="card mb-2">
      <div class="card-title mb-1">Super Admin belépési kód és PIN</div>
      <p class="text-mid small mb-1">A ${esc(SUPER_ADMIN_ID)} fiók belépési kódja és PIN-je nincs a forráskódban — csak ennek a böngészőnek a tárhelyén, hash-elve. ${hasSuperAdminCode() ? "A belépési kód jelenleg be van állítva." : "A belépési kód még nincs beállítva — a következő bejelentkezéskor a rendszer aktiválást kér."} ${hasSuperAdminPin() ? "A PIN jelenleg aktív." : "A PIN még nincs beállítva."}</p>
      <p class="text-mid small mb-1" style="color:var(--orange, #d98b3f)">Ha bármelyiket itt törlöd, a legközelebbi USSS-118 bejelentkezéskor újra be kell állítani — addig senki sem tud belépni ezzel a fiókkal ezen a gépen.</p>
      <div class="flex gap-1">
        ${hasSuperAdminCode() ? `<button class="btn btn-sm btn-danger" id="clear-code">Belépési kód törlése</button>` : ""}
        ${hasSuperAdminPin() ? `<button class="btn btn-sm btn-danger" id="clear-pin">PIN törlése</button>` : ""}
      </div>
    </div>
    <div class="card mb-2">
      <div class="card-title mb-1">Egyéni CSS (fejlesztői)</div>
      <p class="text-mid small mb-1">Ide bármilyen CSS-t beilleszthetsz — azonnal, kód-push és várakozás nélkül alkalmazódik az oldalra. Ez a legközelebbi eszköz ahhoz, hogy a böngészőből "belenyúlj a kódba": vizuális finomítások (színek, méretek, elrendezés-részletek) igen, de teljes JS/HTML-szerkesztés statikus GitHub Pages oldalon nem lehetséges biztonságosan backend nélkül.</p>
      <textarea id="custom-css-input" rows="10" style="width:100%; font-family:var(--font-mono); font-size:12.5px; background:var(--bg-base); border:1px solid var(--line-soft); border-radius:var(--radius-sm); color:var(--text-hi); padding:12px;" placeholder="/* pl. .btn-gold { border-radius: 4px; } */">${esc(getCustomCss())}</textarea>
      <div class="flex justify-between mt-1">
        <button class="btn btn-sm" id="clear-css">Törlés</button>
        <button class="btn btn-gold btn-sm" id="save-css">Alkalmaz</button>
      </div>
    </div>
    <div class="card">
      <div class="card-title mb-1">Adatkezelés</div>
      <p class="text-mid small">A rendszer jelenleg a böngésző localStorage-át használja adattárolásra (GitHub Pages kompatibilitás miatt). Az adatkezelési réteg (js/store.js) el van választva a felülettől, így később valódi backend / adatbázis csatlakoztatható.</p>
      <div class="divider"></div>
      <div class="card-title mb-1">Modulok</div>
      <p class="text-mid small">${ref.LEVELS.length} képzési szint · ${new Set(Object.entries(ref.LEVEL_MODULE_ORDER).filter(([k]) => k !== "SPEC").flatMap(([, v]) => v)).size} egyedi modul (szintenkénti) + ${ref.LEVEL_MODULE_ORDER.SPEC.length} szinten kívüli szakirány</p>
      <div class="divider"></div>
      <button class="btn btn-danger" id="reset-data">Minden adat visszaállítása alapértelmezettre</button>
    </div>
  `;

  document.getElementById("clear-pin")?.addEventListener("click", () => {
    if (!confirm("Biztosan törli a PIN-t? A legközelebbi belépéskor újra be lehet (kell) állítani.")) return;
    clearSuperAdminPin();
    toast("PIN törölve");
    renderSystemTab(content);
  });
  document.getElementById("clear-code")?.addEventListener("click", () => {
    if (!confirm("Biztosan törli a belépési kódot? A legközelebbi USSS-118 bejelentkezési kísérlet fogja újra aktiválni a fiókot (kód + PIN megadásával) — addig senki sem tud belépni vele.")) return;
    clearSuperAdminCode();
    toast("Belépési kód törölve — a fiók inaktív, amíg újra nem aktiválják");
    renderSystemTab(content);
  });

  function applyCssLive(css) {
    let styleEl = document.getElementById("custom-css");
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "custom-css";
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = css;
  }

  document.getElementById("save-css").addEventListener("click", () => {
    const css = document.getElementById("custom-css-input").value;
    setCustomCss(css, actorLabel());
    applyCssLive(css);
    toast("Egyéni CSS alkalmazva");
  });
  document.getElementById("clear-css").addEventListener("click", () => {
    document.getElementById("custom-css-input").value = "";
    setCustomCss("", actorLabel());
    applyCssLive("");
    toast("Egyéni CSS törölve");
  });

  document.getElementById("reset-data").addEventListener("click", () => {
    if (confirm("Ez visszaállítja a teljes rendszert az alapértelmezett minta-adatokra. Biztosan folytatja?")) {
      resetAllData();
      toast("Adatok visszaállítva");
      location.hash = "/dashboard";
      location.reload();
    }
  });
}

const BRANDING_WISHLIST = [
  "Valódi Los Santos térkép-kép az assets/maps/ mappába (lásd assets/maps/README.md) — enélkül a Térkép oldal helyőrző felületet mutat",
  "Néhány semleges, arctalan/egyenruhás 'agent' portré alapértelmezett profilképnek, azok számára, akik nem töltenek fel sajátot",
];

function renderDevTab(content) {
  const report = getStorageReport();
  const quotaEstimateBytes = 5 * 1024 * 1024;
  const pct = Math.min(100, Math.round((report.total / quotaEstimateBytes) * 100));

  content.innerHTML = `
    <div class="card mb-2">
      <div class="card-title mb-1">Adatmentés / visszaállítás</div>
      <p class="text-mid small mb-1">Minden adat kizárólag ebben a böngészőben, a localStorage-ban él — nincs szerver, nincs automatikus felhő-mentés. Egy törölt böngészőadat vagy géphiba mindent elvinne. Töltsd le rendszeresen ezt a biztonsági mentést, és őrizd meg egy külön helyen.</p>
      <div class="flex gap-1 flex-wrap">
        <button class="btn btn-gold btn-sm" id="dev-export">Teljes mentés letöltése (.json)</button>
        <label class="btn btn-sm" style="cursor:pointer">Mentés visszatöltése…<input type="file" id="dev-import" accept="application/json" style="display:none" /></label>
      </div>
    </div>

    <div class="card mb-2">
      <div class="card-title mb-1">Tárhely-használat</div>
      <p class="text-mid small mb-1">A böngészők jellemzően 5-10 MB localStorage-ot engednek eredetenként. Ez alatta marad a rendszer szinte mindig biztonságos — a nagy fájlmellékletek (kiképzési terv, fedett művelet, profilkép) miatt viszont érdemes szemmel tartani.</p>
      <div class="progress mb-1"><div style="width:${pct}%; ${pct > 70 ? "background:linear-gradient(90deg,#8a3f3a,#d1554a); box-shadow:var(--glow-red)" : ""}"></div></div>
      <div class="flex justify-between small text-low mb-2"><span>${formatBytes(report.total)} felhasználva</span><span>~5 MB becsült keret</span></div>
      ${report.items.map((i) => `<div class="history-item"><span>${esc(i.label)}</span><span class="text-low small" style="font-family:var(--font-mono)">${formatBytes(i.bytes)}</span></div>`).join("") || `<div class="text-low small">Nincs adat.</div>`}
    </div>

    <div class="card">
      <div class="card-title mb-1">Márka-képek (branding)</div>
      <p class="text-mid small mb-2">Bármelyik kép lecserélhető innen — a csere azonnal, kód-push nélkül érvényes lesz mindenkinek. Max. ${formatBytes(MAX_BRANDING_BYTES)}/kép.</p>
      <div class="grid grid-3 mb-2">
        ${BRANDING_SLOTS.map((s) => `
          <div class="loc-card" style="cursor:default">
            <div class="loc-card-img"><img src="${esc(getBrandingUrl(s.id))}" style="width:100%;height:100%;object-fit:cover" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'loc-card-ic',textContent:'◆'}))"/></div>
            <div class="loc-card-body">
              <div class="person-name">${esc(s.label)}${getBrandingOverride(s.id) ? ` <span class="badge badge-orange" style="font-size:9px; padding:1px 6px; vertical-align:middle">EGYÉNI</span>` : ""}</div>
              <div class="text-low small mt-1">${esc(s.usage)}</div>
              <div class="flex gap-1 mt-1">
                <label class="btn btn-sm" style="cursor:pointer">Csere…<input type="file" class="brand-upload" data-slot="${esc(s.id)}" accept="image/*" style="display:none" /></label>
                ${getBrandingOverride(s.id) ? `<button class="btn btn-sm" data-brand-reset="${esc(s.id)}">Alapértelmezett</button>` : ""}
              </div>
            </div>
          </div>`).join("")}
      </div>
      <div class="divider"></div>
      <div class="card-title mb-1">Még hasznos lenne</div>
      ${BRANDING_WISHLIST.map((w) => `<div class="history-item"><span>${esc(w)}</span></div>`).join("")}
    </div>
  `;

  content.querySelectorAll(".brand-upload").forEach((input) =>
    input.addEventListener("change", async (e) => {
      const slotId = input.getAttribute("data-slot");
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      if (!file.type.startsWith("image/")) return toast("Csak képfájl tölthető fel.", "warn");
      if (file.size > MAX_BRANDING_BYTES) return toast(`A kép túl nagy (max. ${formatBytes(MAX_BRANDING_BYTES)}).`, "warn");
      try {
        const dataUrl = await readFileAsDataUrl(file);
        const ok = setBrandingOverride(slotId, dataUrl, actorLabel());
        if (!ok) return toast("Nem sikerült menteni — megtelt a böngésző helyi tárhelye.", "warn");
        toast("Márka-kép lecserélve");
        renderAdmin(document.getElementById("content"));
        applyBranding(document.body, "hero-main");
      } catch {
        toast("Nem sikerült beolvasni a képet.", "warn");
      }
    })
  );
  content.querySelectorAll("[data-brand-reset]").forEach((b) =>
    b.addEventListener("click", () => {
      clearBrandingOverride(b.getAttribute("data-brand-reset"), actorLabel());
      toast("Visszaállítva az alapértelmezett képre");
      renderAdmin(document.getElementById("content"));
      applyBranding(document.body, "hero-main");
    })
  );

  document.getElementById("dev-export").addEventListener("click", () => {
    const payload = exportAllData();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `usss-mentes-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast("Mentés letöltve");
  });

  document.getElementById("dev-import").addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!confirm("Ez felülírja a jelenlegi adatokat a fájlban lévőkkel. Biztosan folytatja?")) return;
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const ok = importAllData(payload, actorLabel());
      if (!ok) return toast("Érvénytelen mentésfájl.", "warn");
      toast("Adatok visszatöltve — újratöltés…");
      setTimeout(() => location.reload(), 800);
    } catch {
      toast("Nem sikerült beolvasni a fájlt.", "warn");
    }
  });
}
