import {
  getCovertOps, getCovertOp, createCovertOp, updateCovertOp, addOperative, removeOperative, closeCovertOp, reopenCovertOp, deleteCovertOp,
  getCovertOpClassifications, addCovertOpClassification, getPersonnel, getInvestigationsLinkedToOp,
  addCovertOpAttachment, removeCovertOpAttachment, suggestCodename, formatCodename,
  isImageAttachment, formatFileSize, ATTACHMENT_MAX_UPLOAD_BYTES,
  addSubject, removeSubject,
  CO_STATUSES, CO_CLOSED_STATUSES,
} from "../store.js?v=53";
import { hasRole, actorLabel } from "../auth.js?v=20";
import { esc, fmtDate, fmtDateTime, toast, openModal, closeModal } from "../utils.js?v=22";
import { navigate } from "../router.js?v=20";

const CLASS_BADGE = { "Bizalmas": "gray", "Titkos": "yellow", "Szigorúan titkos": "red" };
const STATUS_BADGE = (status) => {
  if (status === "Tervezés alatt") return "gray";
  if (status === "Aktív") return "gold";
  if (status === "Felfüggesztve") return "yellow";
  if (status === "Lezárva – sikeres") return "green";
  if (status === "Lezárva – sikertelen" || status === "Megszakítva") return "red";
  return "gray";
};

export function renderCovertOpList(container) {
  const canEdit = hasRole("TRAINING");
  const ops = getCovertOps();

  container.innerHTML = `
    <div class="classification-strip">U.S.S.S. FEDETT MŰVELETEK · SZIGORÚAN TITKOS</div>
    <p class="text-low small mb-2">Engedélyezett fedett/nyomozási műveletek — fedőnév, engedélyező, végrehajtók és minősítés nyilvántartásával. Csak oktatásvezetői/admin jogosultsággal érhető el.</p>
    <div class="section-head">
      <h2 style="visibility:hidden">.</h2>
      <div class="actions">${canEdit ? `<button class="btn btn-gold" id="new-op">+ Új művelet</button>` : ""}</div>
    </div>
    <div class="grid grid-3 mb-2">
      <div class="field"><label>Keresés</label><input id="op-filter" placeholder="Fedőnév, cél, engedélyező, vezető" /></div>
      <div class="field"><label>Státusz</label><select id="op-status-filter"><option value="all">Mindegyik</option><option value="open">Folyamatban</option>${CO_STATUSES.map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join("")}</select></div>
      <div class="field"><label>Minősítés</label><select id="op-class-filter"><option value="all">Mindegyik</option>${getCovertOpClassifications().map((c) => `<option>${esc(c)}</option>`).join("")}</select></div>
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th>ID</th><th>Fedőnév</th><th>Célszemély / szervezet</th><th>Minősítés</th><th>Státusz</th><th>Vezető</th><th>Engedélyező</th><th>Indult</th></tr></thead>
      <tbody id="op-rows"></tbody>
    </table></div>
  `;

  const updateRows = () => {
    const query = document.getElementById("op-filter").value.trim().toLowerCase();
    const status = document.getElementById("op-status-filter").value;
    const cls = document.getElementById("op-class-filter").value;
    const filtered = ops.filter((op) => {
      const searchable = [op.id, op.codename, op.targetSubject, op.authorizedBy, op.leadOperative, ...(op.subjects || []).map((s) => `${s.label} ${s.name}`)].join(" ").toLowerCase();
      return (!query || searchable.includes(query)) &&
        (status === "all" || (status === "open" && !CO_CLOSED_STATUSES.includes(op.status)) || op.status === status) &&
        (cls === "all" || op.classification === cls);
    });
    document.getElementById("op-rows").innerHTML = filtered.length ? filtered.map(renderOpRow).join("") :
      `<tr><td colspan="8"><div class="empty-state"><h3>Nincs rögzített művelet</h3><p>Indítsa el az elsőt a fenti gombbal.</p></div></td></tr>`;
    container.querySelectorAll("[data-nav]").forEach((n) => n.addEventListener("click", () => navigate(n.getAttribute("data-nav"))));
  };
  ["op-filter", "op-status-filter", "op-class-filter"].forEach((id) => document.getElementById(id).addEventListener("input", updateRows));
  document.getElementById("new-op")?.addEventListener("click", () => openCovertOpForm());
  updateRows();
}

function renderOpRow(op) {
  return `<tr class="row-link" data-nav="/covert-ops/${esc(op.id)}">
    <td class="text-gold" style="font-family:var(--font-mono)">${esc(op.id)}</td>
    <td class="text-hi">${esc(formatCodename(op.codename))}</td>
    <td class="text-low small">${esc(op.targetSubject || "—")}${(op.subjects || []).length ? ` <span class="badge badge-gold" style="font-size:9px; padding:1px 6px; vertical-align:middle">${op.subjects.length} gyanúsított</span>` : ""}</td>
    <td><span class="badge badge-${CLASS_BADGE[op.classification] || "gray"}">${esc(op.classification)}</span></td>
    <td><span class="badge badge-${STATUS_BADGE(op.status)}">${esc(op.status)}</span></td>
    <td class="text-low small">${esc(op.leadOperative || "—")}</td>
    <td class="text-low small">${esc(op.authorizedBy || "—")}</td>
    <td class="text-low small">${fmtDate(op.startDate)}</td>
  </tr>`;
}

function openCovertOpForm() {
  const personnel = getPersonnel();
  const classifications = getCovertOpClassifications();
  openModal(`
    <div class="modal-head"><h3>Új fedett művelet indítása</h3><button class="modal-close" data-close-modal>×</button></div>
    <form id="op-form">
      <div class="grid grid-2">
        <div class="field">
          <label>Fedőnév</label>
          <div class="flex gap-1"><input id="of-codename" required placeholder="pl. Operation Overlord" autofocus style="flex:1" /><button type="button" class="btn btn-sm" id="of-suggest-codename" title="Javasolj fedőnevet a cél leírása alapján">Javasolj</button></div>
          <p class="hint">A javaslat a lent megadott cél/célszemély szövege alapján készül — töltse ki előbb azokat a pontosabb találathoz.</p>
        </div>
        <div class="field"><label>Célszemély / szervezet</label><input id="of-target" placeholder="opcionális" /></div>
      </div>
      <div class="field"><label>A művelet célja</label><textarea id="of-objective" rows="4" required placeholder="Mit kell elérni, milyen körülmények indokolják…"></textarea></div>
      <div class="grid grid-2">
        <div class="field"><label>Engedélyező</label><select id="of-authorizer"><option value="">Nincs kijelölve</option>${personnel.map((p) => `<option value="${esc(p.name)}" data-position="${esc(p.position || "")}">${esc(p.name)}</option>`).join("")}</select></div>
        <div class="field"><label>Engedélyező rangja</label><input id="of-authorizer-rank" placeholder="pl. U.S.S.S. Director" /></div>
      </div>
      <div class="grid grid-2">
        <div class="field"><label>Művelet vezetője</label><select id="of-lead"><option value="">Nincs kijelölve</option>${personnel.map((p) => `<option value="${esc(p.name)}">${esc(p.name)}</option>`).join("")}</select></div>
        <div class="field"><label>Minősítés</label>
          <select id="of-classification">${classifications.map((c) => `<option>${esc(c)}</option>`).join("")}<option value="__new__">+ Új minősítés…</option></select>
        </div>
      </div>
      <div class="field" id="of-new-class-wrap" style="display:none;"><label>Új minősítés neve</label><input id="of-new-class" placeholder="pl. Kizárólag vezetői betekintés" /></div>
      <div class="field"><label>Kezdés dátuma</label><input type="date" id="of-start" value="${new Date().toISOString().slice(0, 10)}" /></div>
      <div class="flex justify-between mt-2">
        <button type="button" class="btn" data-close-modal>Mégse</button>
        <button type="submit" class="btn btn-gold">Művelet indítása</button>
      </div>
    </form>
  `);
  document.getElementById("of-classification").addEventListener("change", (e) => {
    document.getElementById("of-new-class-wrap").style.display = e.target.value === "__new__" ? "block" : "none";
  });
  document.getElementById("of-suggest-codename").addEventListener("click", () => {
    const context = `${document.getElementById("of-target").value} ${document.getElementById("of-objective").value}`;
    document.getElementById("of-codename").value = suggestCodename(context);
  });
  document.getElementById("of-authorizer").addEventListener("change", (e) => {
    const position = e.target.selectedOptions[0]?.getAttribute("data-position");
    if (position) document.getElementById("of-authorizer-rank").value = position;
  });
  document.getElementById("op-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const codename = document.getElementById("of-codename").value.trim();
    const objective = document.getElementById("of-objective").value.trim();
    if (!codename || !objective) return;
    let classification = document.getElementById("of-classification").value;
    if (classification === "__new__") {
      classification = document.getElementById("of-new-class").value.trim();
      if (!classification) return;
      addCovertOpClassification(classification, actorLabel());
    }
    const op = createCovertOp({
      codename,
      objective,
      targetSubject: document.getElementById("of-target").value.trim(),
      authorizedBy: document.getElementById("of-authorizer").value.trim(),
      authorizedByRank: document.getElementById("of-authorizer-rank").value.trim(),
      leadOperative: document.getElementById("of-lead").value,
      classification,
      startDate: document.getElementById("of-start").value,
    }, actorLabel());
    toast(`Művelet elindítva: ${op.id}`);
    closeModal();
    navigate(`/covert-ops/${op.id}`);
  });
}

export function renderCovertOpDetail(container, id) {
  const op = getCovertOp(id);
  if (!op) {
    container.innerHTML = `<div class="empty-state"><h3>A művelet nem található</h3><a class="btn mt-2" href="#/covert-ops">Vissza</a></div>`;
    return;
  }
  const canEdit = hasRole("TRAINING");
  const canAdmin = hasRole("ADMIN");
  const isClosed = CO_CLOSED_STATUSES.includes(op.status);
  const personnel = getPersonnel();
  const linkedInvestigations = getInvestigationsLinkedToOp(op.id);

  container.innerHTML = `
    <a href="#/covert-ops" class="text-low small">← Vissza a fedett műveletekhez</a>
    <div class="classification-strip mt-2">${esc(op.id)} · ${esc(op.classification).toUpperCase()}</div>

    <div class="card mt-2 mb-2">
      <div class="flex justify-between items-center mb-2 flex-wrap">
        <div>
          <div class="card-title">Fedőnév</div>
          <h2 style="font-size:22px; color: var(--gold-bright)">${esc(formatCodename(op.codename))}</h2>
          <div class="text-low small">${esc(op.targetSubject || "Nincs megadva célszemély/szervezet")}</div>
        </div>
        <div class="flex gap-1" style="align-items:flex-start">
          <span class="badge badge-${CLASS_BADGE[op.classification] || "gray"}">${esc(op.classification)}</span>
          <span class="badge badge-${STATUS_BADGE(op.status)}">${esc(op.status)}</span>
          ${canAdmin ? `<button class="btn btn-sm btn-danger" id="del-op">Törlés</button>` : ""}
        </div>
      </div>
      <div class="grid grid-3 mb-2">
        <div><div class="card-title">Engedélyező</div><div class="text-hi">${esc(op.authorizedBy || "—")}${op.authorizedByRank ? ` · ${esc(op.authorizedByRank)}` : ""}</div></div>
        <div><div class="card-title">Művelet vezetője</div><div class="text-hi">${esc(op.leadOperative || "Nincs kijelölve")}</div></div>
        <div><div class="card-title">Kezdés</div><div class="text-hi">${fmtDate(op.startDate)}</div></div>
        <div><div class="card-title">Végrehajtók száma</div><div class="card-value" style="font-size:22px">${(op.operatives || []).length}</div></div>
        <div><div class="card-title">Gyanúsítottak száma</div><div class="card-value" style="font-size:22px">${(op.subjects || []).length}</div></div>
        <div><div class="card-title">Lezárás</div><div class="text-hi">${op.endDate ? fmtDate(op.endDate) : "Folyamatban"}</div></div>
      </div>

      ${canEdit && !isClosed ? `<div class="flex gap-1 flex-wrap mt-1">
        ${op.status === "Tervezés alatt" ? `<button class="btn btn-sm" id="activate-op">Művelet aktiválása</button>` : ""}
        ${op.status === "Aktív" ? `<button class="btn btn-sm" id="suspend-op">Felfüggesztés</button>` : ""}
        ${op.status === "Felfüggesztve" ? `<button class="btn btn-sm" id="resume-op">Folytatás</button>` : ""}
        <button class="btn btn-gold btn-sm" id="close-op">Művelet lezárása</button>
      </div>` : ""}
      ${canEdit && isClosed ? `<button class="btn btn-sm mt-1" id="reopen-op">Művelet újranyitása</button>` : ""}
    </div>

    <div class="card mb-2">
      <div class="card-title mb-1">A MŰVELET CÉLJA</div>
      ${canEdit ? `<textarea id="op-objective" rows="4" style="width:100%; background:var(--bg-base); border:1px solid var(--line-soft); border-radius:var(--radius-sm); color:var(--text-hi); padding:12px;">${esc(op.objective || "")}</textarea><button class="btn btn-sm mt-1" id="save-objective">Mentés</button>` :
        `<div class="text-mid" style="white-space:pre-wrap">${esc(op.objective || "—")}</div>`}
    </div>

    <div class="card mb-2">
      <div class="card-title mb-1">VÉGREHAJTÓK</div>
      ${(op.operatives || []).length ? op.operatives.map((o, i) => `
        <div class="history-item">
          <span>${esc(o.name)}${o.codename ? ` — <span class="text-gold">${esc(o.codename)}</span>` : ""}${o.usssId ? ` <span class="text-low small">(${esc(o.usssId)})</span>` : ""}</span>
          ${canEdit && !isClosed ? `<button class="btn btn-sm btn-danger" data-remove-op="${i}">×</button>` : ""}
        </div>`).join("") : `<div class="text-low small">Nincs kijelölt végrehajtó.</div>`}
      ${canEdit && !isClosed ? `
        <div class="grid grid-2 mt-2">
          <select id="op-new-operative"><option value="">Válasszon személyt…</option>${personnel.map((p) => `<option value="${esc(p.usssId)}">${esc(p.name)} (${esc(p.usssId)})</option>`).join("")}</select>
          <input id="op-new-operative-codename" placeholder="Kódnév (opcionális), pl. Ghost" />
        </div>
        <div class="flex gap-1 mt-1">
          <button type="button" class="btn btn-sm" id="add-operative-btn">+ Hozzáadás</button>
        </div>
      ` : ""}
    </div>

    <div class="card mb-2">
      <div class="card-title mb-1">GYANÚSÍTOTTAK / CÉLSZEMÉLYEK</div>
      <p class="text-low small mb-1">NATO-betűzéses jelölés (Subject Alpha, Subject Bravo, …) — akkor is rögzíthető, ha a valódi kilét még nem megerősített.</p>
      ${(op.subjects || []).length ? op.subjects.map((s, i) => `
        <div class="history-item">
          <span><span class="text-gold">${esc(s.label)}</span> — ${esc(s.name)}${s.notes ? ` <span class="text-low small">(${esc(s.notes)})</span>` : ""}</span>
          ${canEdit && !isClosed ? `<button class="btn btn-sm btn-danger" data-remove-subject="${i}">×</button>` : ""}
        </div>`).join("") : `<div class="text-low small">Nincs rögzített gyanúsított.</div>`}
      ${canEdit && !isClosed ? `
        <div class="grid grid-2 mt-2">
          <input id="op-new-subject-name" placeholder="Név / leírás, pl. Ismeretlen férfi, kb. 40 éves" />
          <input id="op-new-subject-notes" placeholder="Megjegyzés (opcionális)" />
        </div>
        <div class="flex gap-1 mt-1">
          <button type="button" class="btn btn-sm" id="add-subject-btn">+ Hozzáadás</button>
        </div>
      ` : ""}
    </div>

    <div class="card mb-2">
      <div class="card-title mb-1">JELENTÉS</div>
      <p class="text-low small mb-1">A művelet lezárásakor vagy közben rögzített eredmények, tapasztalatok.</p>
      ${canEdit ? `<textarea id="op-report" rows="6" style="width:100%; background:var(--bg-base); border:1px solid var(--line-soft); border-radius:var(--radius-sm); color:var(--text-hi); padding:12px;">${esc(op.report || "")}</textarea><button class="btn btn-sm mt-1" id="save-report">Mentés</button>` :
        `<div class="text-mid" style="white-space:pre-wrap">${op.report ? esc(op.report) : '<span class="text-low">Nincs rögzített jelentés.</span>'}</div>`}
    </div>

    <div class="card mb-2">
      <div class="card-title mb-1">CSATOLMÁNYOK</div>
      <p class="text-low small mb-1">Bizonyítékok, dokumentumok — közvetlenül feltöltve (böngésző helyi tárolójában) vagy külső helyen (Discord, Drive, Dropbox) tárolt hivatkozásként. Kép típusú csatolmányok előnézettel jelennek meg.</p>
      ${(op.attachments || []).length ? `<div class="attachment-grid">${op.attachments.map((a, i) => `
        <div class="attachment-card">
          ${isImageAttachment(a) ? `<a href="${esc(a.url)}" target="_blank" rel="noopener noreferrer"><img src="${esc(a.url)}" alt="${esc(a.label)}" class="attachment-thumb" /></a>` : `<div class="attachment-file-icon">📄</div>`}
          <div class="attachment-meta">
            <a href="${esc(a.url)}" target="_blank" rel="noopener noreferrer" class="text-gold small">${esc(a.label)}</a>
            <span class="text-low" style="font-size:11px">${a.kind === "upload" ? `Feltöltve${a.size ? ` · ${formatFileSize(a.size)}` : ""}` : "Külső hivatkozás"}</span>
          </div>
          ${canEdit ? `<button class="btn btn-sm btn-danger" data-remove-attachment="${i}">×</button>` : ""}
        </div>`).join("")}</div>` : `<div class="text-low small">Nincs csatolmány.</div>`}
      ${canEdit ? `
        <div class="grid grid-2 mt-2">
          <input id="op-attachment-label" placeholder="Megnevezés, pl. Kihallgatási jegyzőkönyv.docx" />
          <div class="flex gap-1"><input id="op-attachment-url" placeholder="https://… (külső hivatkozás)" style="flex:1" /><button type="button" class="btn btn-sm" id="add-attachment-btn">+ Link hozzáadása</button></div>
        </div>
        <div class="flex gap-1 mt-1 items-center">
          <label class="btn btn-sm" style="cursor:pointer">Fájl kiválasztása<input type="file" id="op-attachment-file" style="display:none" /></label>
          <span class="text-low small" id="op-attachment-file-name">Nincs fájl kiválasztva.</span>
        </div>
        <p class="text-low small mt-1">Feltöltés esetén a fájl a böngésző helyi tárolójában (localStorage) kerül mentésre, max. ${formatFileSize(ATTACHMENT_MAX_UPLOAD_BYTES)} méretig. Nagyobb dokumentumokhoz külső linket használj.</p>
      ` : ""}
    </div>

    <div class="card mb-2">
      <div class="card-title mb-1">KAPCSOLÓDÓ BELSŐ VIZSGÁLATOK</div>
      ${linkedInvestigations.length ? linkedInvestigations.map((inv) => `
        <div class="history-item">
          <a href="#/investigations/${esc(inv.id)}" class="text-gold">${esc(inv.id)} — ${esc(inv.subjectName || inv.subjectUsssId || "Ismeretlen érintett")}</a>
          <span class="badge badge-gold">${esc(inv.status)}</span>
        </div>`).join("") : `<div class="text-low small">Nincs hozzárendelt belső vizsgálat.</div>`}
      <p class="text-low small mt-1">Hozzárendelés a Belső Vizsgálatok modulból, az érintett vizsgálat oldaláról tehető meg.</p>
    </div>

    <div class="card">
      <div class="card-title mb-1">ELŐZMÉNYEK</div>
      ${(op.history || []).slice().reverse().map((h) => `<div class="history-item"><span>${esc(h.action)}</span><span class="text-low small">${esc(h.by)} · ${fmtDateTime(h.at)}</span></div>`).join("") || `<div class="text-low small">Nincs rögzített esemény.</div>`}
    </div>
  `;

  document.getElementById("save-objective")?.addEventListener("click", () => {
    updateCovertOp(op.id, { objective: document.getElementById("op-objective").value }, actorLabel());
    toast("Cél mentve");
    renderCovertOpDetail(container, op.id);
  });
  document.getElementById("save-report")?.addEventListener("click", () => {
    updateCovertOp(op.id, { report: document.getElementById("op-report").value }, actorLabel());
    toast("Jelentés mentve");
    renderCovertOpDetail(container, op.id);
  });
  document.getElementById("activate-op")?.addEventListener("click", () => {
    updateCovertOp(op.id, { status: "Aktív" }, actorLabel());
    toast("Művelet aktiválva");
    renderCovertOpDetail(container, op.id);
  });
  document.getElementById("suspend-op")?.addEventListener("click", () => {
    updateCovertOp(op.id, { status: "Felfüggesztve" }, actorLabel());
    toast("Művelet felfüggesztve");
    renderCovertOpDetail(container, op.id);
  });
  document.getElementById("resume-op")?.addEventListener("click", () => {
    updateCovertOp(op.id, { status: "Aktív" }, actorLabel());
    toast("Művelet folytatva");
    renderCovertOpDetail(container, op.id);
  });
  document.getElementById("close-op")?.addEventListener("click", () => openCloseOpForm(op, container));
  document.getElementById("reopen-op")?.addEventListener("click", () => {
    if (!confirm("Biztosan újranyitja a műveletet?")) return;
    reopenCovertOp(op.id, actorLabel());
    toast("Művelet újranyitva");
    renderCovertOpDetail(container, op.id);
  });
  document.getElementById("del-op")?.addEventListener("click", () => {
    if (!confirm(`Biztosan törli a(z) ${op.id} műveletet? Ez nem vonható vissza.`)) return;
    deleteCovertOp(op.id, actorLabel());
    toast("Művelet törölve");
    navigate("/covert-ops");
  });
  document.getElementById("add-operative-btn")?.addEventListener("click", () => {
    const select = document.getElementById("op-new-operative");
    const usssId = select.value;
    if (!usssId) return;
    const person = personnel.find((p) => p.usssId === usssId);
    const codename = document.getElementById("op-new-operative-codename").value.trim();
    addOperative(op.id, { usssId, name: person ? person.name : usssId, codename }, actorLabel());
    toast("Végrehajtó hozzáadva");
    renderCovertOpDetail(container, op.id);
  });
  container.querySelectorAll("[data-remove-op]").forEach((b) =>
    b.addEventListener("click", () => {
      removeOperative(op.id, Number(b.getAttribute("data-remove-op")), actorLabel());
      toast("Végrehajtó eltávolítva");
      renderCovertOpDetail(container, op.id);
    })
  );
  document.getElementById("add-subject-btn")?.addEventListener("click", () => {
    const name = document.getElementById("op-new-subject-name").value.trim();
    if (!name) return;
    const notes = document.getElementById("op-new-subject-notes").value.trim();
    addSubject(op.id, { name, notes }, actorLabel());
    toast("Gyanúsított hozzáadva");
    renderCovertOpDetail(container, op.id);
  });
  container.querySelectorAll("[data-remove-subject]").forEach((b) =>
    b.addEventListener("click", () => {
      removeSubject(op.id, Number(b.getAttribute("data-remove-subject")), actorLabel());
      toast("Gyanúsított eltávolítva");
      renderCovertOpDetail(container, op.id);
    })
  );
  document.getElementById("add-attachment-btn")?.addEventListener("click", () => {
    const label = document.getElementById("op-attachment-label").value.trim();
    const url = document.getElementById("op-attachment-url").value.trim();
    if (!label || !url) return;
    addCovertOpAttachment(op.id, { label, url, kind: "link" }, actorLabel());
    toast("Csatolmány hozzáadva");
    renderCovertOpDetail(container, op.id);
  });
  document.getElementById("op-attachment-file")?.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (file.size > ATTACHMENT_MAX_UPLOAD_BYTES) {
      toast(`A fájl túl nagy (max. ${formatFileSize(ATTACHMENT_MAX_UPLOAD_BYTES)})`, "error");
      e.target.value = "";
      return;
    }
    document.getElementById("op-attachment-file-name").textContent = file.name;
    const reader = new FileReader();
    reader.onload = () => {
      const labelInput = document.getElementById("op-attachment-label");
      const label = labelInput.value.trim() || file.name;
      addCovertOpAttachment(op.id, { label, url: reader.result, kind: "upload", size: file.size }, actorLabel());
      toast("Fájl feltöltve");
      renderCovertOpDetail(container, op.id);
    };
    reader.onerror = () => toast("Nem sikerült beolvasni a fájlt", "error");
    reader.readAsDataURL(file);
  });
  container.querySelectorAll("[data-remove-attachment]").forEach((b) =>
    b.addEventListener("click", () => {
      removeCovertOpAttachment(op.id, Number(b.getAttribute("data-remove-attachment")), actorLabel());
      toast("Csatolmány eltávolítva");
      renderCovertOpDetail(container, op.id);
    })
  );
}

function openCloseOpForm(op, container) {
  openModal(`
    <div class="modal-head"><h3>Művelet lezárása — ${esc(op.id)}</h3><button class="modal-close" data-close-modal>×</button></div>
    <form id="close-op-form">
      <div class="field"><label>Záró státusz</label>
        <select id="cof-status" required>
          <option value="">Válasszon…</option>
          <option value="Lezárva – sikeres">Lezárva – sikeres</option>
          <option value="Lezárva – sikertelen">Lezárva – sikertelen</option>
          <option value="Megszakítva">Megszakítva</option>
        </select>
      </div>
      <div class="field"><label>Zárójelentés</label><textarea id="cof-report" rows="5" placeholder="Eredmények, tapasztalatok, ajánlások…">${esc(op.report || "")}</textarea></div>
      <div class="flex justify-between mt-2">
        <button type="button" class="btn" data-close-modal>Mégse</button>
        <button type="submit" class="btn btn-gold">Művelet lezárása</button>
      </div>
    </form>
  `);
  document.getElementById("close-op-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const status = document.getElementById("cof-status").value;
    if (!status) return;
    closeCovertOp(op.id, { status, report: document.getElementById("cof-report").value }, actorLabel());
    toast("Művelet lezárva");
    closeModal();
    renderCovertOpDetail(container, op.id);
  });
}
