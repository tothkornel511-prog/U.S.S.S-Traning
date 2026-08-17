import { getAccessCodes, upsertAccessCode, revokeAccessCode, generateCode, getAuditLog, getPersonnel, resetAllData, ref, getPositionEntries, addPosition, removePosition, getCustomCss, setCustomCss } from "../store.js?v=11";
import { hasRole, actorLabel, ROLES } from "../auth.js?v=11";
import { esc, fmtDateTime, toast, openModal, closeModal } from "../utils.js?v=11";

let activeTab = "access";

export function renderAdmin(container) {
  if (!hasRole("TRAINING")) {
    container.innerHTML = `<div class="denied"><div class="ic">⛔</div><h3>Hozzáférés megtagadva</h3><p class="text-low">Ehhez az oldalhoz Oktatásvezetői vagy Admin jogosultság szükséges.</p></div>`;
    return;
  }
  const isAdmin = hasRole("ADMIN");

  container.innerHTML = `
    <div class="tabs">
      <button class="tab-btn ${activeTab === "access" ? "active" : ""}" data-tab="access">Hozzáférések</button>
      <button class="tab-btn ${activeTab === "positions" ? "active" : ""}" data-tab="positions">Pozíciók</button>
      <button class="tab-btn ${activeTab === "audit" ? "active" : ""}" data-tab="audit">Eseménynapló</button>
      ${isAdmin ? `<button class="tab-btn ${activeTab === "system" ? "active" : ""}" data-tab="system">Rendszerbeállítások</button>` : ""}
    </div>
    <div id="admin-tab-content"></div>
  `;

  container.querySelectorAll(".tab-btn").forEach((b) =>
    b.addEventListener("click", () => { activeTab = b.getAttribute("data-tab"); renderAdmin(container); })
  );

  const content = document.getElementById("admin-tab-content");
  if (activeTab === "access") renderAccessTab(content, isAdmin);
  else if (activeTab === "positions") renderPositionsTab(content, isAdmin);
  else if (activeTab === "audit") renderAuditTab(content);
  else if (activeTab === "system") renderSystemTab(content);
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

function renderAccessTab(content, isAdmin) {
  const codes = getAccessCodes();
  const personnel = getPersonnel();

  content.innerHTML = `
    <div class="section-head">
      <h2 style="font-size:15px">Hozzáférési kódok és szerepkörök</h2>
      ${isAdmin ? `<button class="btn btn-gold btn-sm" id="new-access">+ Új hozzáférés</button>` : ""}
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th>USSS ID</th><th>Név</th><th>Szerepkör</th><th>Hozzáférési kód</th>${isAdmin ? "<th></th>" : ""}</tr></thead>
      <tbody>
        ${codes.length ? codes.map((c) => {
          const p = personnel.find((x) => x.usssId === c.usssId);
          return `<tr>
            <td style="font-family:var(--font-mono)">${esc(c.usssId)}</td>
            <td>${esc(p?.name || "—")}</td>
            <td><span class="badge badge-gold">${esc(ROLES[c.role]?.label || c.role)}</span></td>
            <td style="font-family:var(--font-mono)">${esc(c.code)}</td>
            ${isAdmin ? `<td><div class="flex gap-1"><button class="btn btn-sm" data-edit="${esc(c.usssId)}">Szerkeszt</button><button class="btn btn-sm btn-danger" data-revoke="${esc(c.usssId)}">Visszavonás</button></div></td>` : ""}
          </tr>`;
        }).join("") : `<tr><td colspan="5"><div class="empty-state"><h3>Nincs rögzített hozzáférés</h3></div></td></tr>`}
      </tbody>
    </table></div>
  `;

  if (isAdmin) {
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
      <div class="flex justify-between mt-2">
        <button type="button" class="btn" data-close-modal>Mégse</button>
        <button type="submit" class="btn btn-gold">Mentés</button>
      </div>
    </form>
  `);

  document.getElementById("af-regen").addEventListener("click", () => {
    document.getElementById("af-code").value = generateCode();
  });

  document.getElementById("access-form").addEventListener("submit", (e) => {
    e.preventDefault();
    upsertAccessCode({
      usssId: document.getElementById("af-person").value,
      role: document.getElementById("af-role").value,
      code: document.getElementById("af-code").value.trim(),
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
