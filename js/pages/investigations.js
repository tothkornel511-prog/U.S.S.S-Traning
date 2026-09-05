import {
  getInvestigations, getInvestigation, createInvestigation, updateInvestigation, closeInvestigation, reopenInvestigation, deleteInvestigation,
  getPersonnel, getInvestigationCategories, addInvestigationCategory,
  getCovertOps, getCovertOp, linkCovertOp, unlinkCovertOp,
  addInvestigationAttachment, removeInvestigationAttachment, formatCodename,
  INVESTIGATION_SEVERITIES, INVESTIGATION_STATUSES, INVESTIGATION_CLOSED_STATUSES, INVESTIGATION_OUTCOMES, INVESTIGATION_ORIGINS,
} from "../store.js?v=52";
import { hasRole, actorLabel } from "../auth.js?v=20";
import { esc, fmtDate, fmtDateTime, toast, openModal, closeModal } from "../utils.js?v=22";
import { navigate } from "../router.js?v=20";

const SEVERITY_BADGE = { "Alacsony": "gray", "Közepes": "yellow", "Súlyos": "red", "Kritikus": "red" };
const ORIGIN_BADGE = { "Belső kezdeményezés": "gray", "Külső panasz": "yellow" };
const STATUS_BADGE = (status) => {
  if (status === "Bejelentve") return "yellow";
  if (status === "Vizsgálat alatt" || status === "Felfüggesztve") return "gold";
  if (status === "Lezárva – megalapozott") return "red";
  if (status === "Lezárva – nem megalapozott" || status === "Elutasítva") return "green";
  return "gray";
};

export function renderInvestigationList(container) {
  const canEdit = hasRole("TRAINING");
  const investigations = getInvestigations();

  container.innerHTML = `
    <div class="classification-strip">U.S.S.S. BELSŐ VIZSGÁLATI RENDSZER · BIZALMAS</div>
    <p class="text-low small mb-2">Formális belső vizsgálatok bejelentéstől lezárásig — kivizsgáló kijelölése, megállapítások és szankció rögzítésével. Csak oktatásvezetői/admin jogosultsággal érhető el.</p>
    <div class="section-head">
      <h2 style="visibility:hidden">.</h2>
      <div class="actions">${canEdit ? `<button class="btn btn-gold" id="new-investigation">+ Új vizsgálat</button>` : ""}</div>
    </div>
    <div class="grid grid-3 mb-2">
      <div class="field"><label>Keresés</label><input id="inv-filter" placeholder="Azonosító, érintett, kivizsgáló" /></div>
      <div class="field"><label>Státusz</label><select id="inv-status-filter"><option value="all">Mindegyik</option><option value="open">Nyitott</option>${INVESTIGATION_STATUSES.map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join("")}</select></div>
      <div class="field"><label>Súlyosság</label><select id="inv-severity-filter"><option value="all">Mindegyik</option>${INVESTIGATION_SEVERITIES.map((s) => `<option>${esc(s)}</option>`).join("")}</select></div>
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th>ID</th><th>Érintett</th><th>Eredet</th><th>Kategória</th><th>Súlyosság</th><th>Státusz</th><th>Kivizsgáló</th><th>Bejelentve</th></tr></thead>
      <tbody id="inv-rows"></tbody>
    </table></div>
  `;

  const updateRows = () => {
    const query = document.getElementById("inv-filter").value.trim().toLowerCase();
    const status = document.getElementById("inv-status-filter").value;
    const severity = document.getElementById("inv-severity-filter").value;
    const filtered = investigations.filter((inv) => {
      const searchable = [inv.id, inv.subjectName, inv.subjectUsssId, inv.investigator, inv.reportedBy].join(" ").toLowerCase();
      return (!query || searchable.includes(query)) &&
        (status === "all" || (status === "open" && !INVESTIGATION_CLOSED_STATUSES.includes(inv.status)) || inv.status === status) &&
        (severity === "all" || inv.severity === severity);
    });
    document.getElementById("inv-rows").innerHTML = filtered.length ? filtered.map(renderInvestigationRow).join("") :
      `<tr><td colspan="8"><div class="empty-state"><h3>Nincs rögzített vizsgálat</h3><p>Indítsa el az elsőt a fenti gombbal.</p></div></td></tr>`;
    container.querySelectorAll("[data-nav]").forEach((n) => n.addEventListener("click", () => navigate(n.getAttribute("data-nav"))));
  };
  ["inv-filter", "inv-status-filter", "inv-severity-filter"].forEach((id) => document.getElementById(id).addEventListener("input", updateRows));
  document.getElementById("new-investigation")?.addEventListener("click", () => openInvestigationForm());
  updateRows();
}

function renderInvestigationRow(inv) {
  return `<tr class="row-link" data-nav="/investigations/${esc(inv.id)}">
    <td class="text-gold" style="font-family:var(--font-mono)">${esc(inv.id)}${inv.confidential ? ` <span class="badge badge-gold" style="font-size:9px; padding:1px 6px; vertical-align:middle">BIZALMAS</span>` : ""}</td>
    <td class="text-hi">${esc(inv.subjectName || inv.subjectUsssId || "—")}</td>
    <td><span class="badge badge-${ORIGIN_BADGE[inv.origin] || "gray"}">${esc(inv.origin === "Külső panasz" ? "Külső" : "Belső")}</span></td>
    <td class="text-low small">${esc(inv.category)}</td>
    <td><span class="badge badge-${SEVERITY_BADGE[inv.severity] || "gray"}">${esc(inv.severity)}</span></td>
    <td><span class="badge badge-${STATUS_BADGE(inv.status)}">${esc(inv.status)}</span></td>
    <td class="text-low small">${esc(inv.investigator || "—")}</td>
    <td class="text-low small">${fmtDate(inv.openedAt)}</td>
  </tr>`;
}

function openInvestigationForm() {
  const personnel = getPersonnel();
  const categories = getInvestigationCategories();
  openModal(`
    <div class="modal-head"><h3>Új belső vizsgálat indítása</h3><button class="modal-close" data-close-modal>×</button></div>
    <form id="inv-form">
      <div class="grid grid-2">
        <div class="field"><label>Érintett USSS azonosító</label><input id="if-usssid" list="inv-personnel-list" placeholder="USSS-000" autofocus /></div>
        <div class="field"><label>Érintett neve</label><input id="if-name" required /></div>
      </div>
      <datalist id="inv-personnel-list">${personnel.map((p) => `<option value="${esc(p.usssId)}">${esc(p.name)}</option>`).join("")}</datalist>
      <div class="grid grid-2">
        <div class="field"><label>Bejelentő</label><input id="if-reporter" placeholder="Név vagy 'Anonim'" /></div>
        <div class="field"><label>Kivizsgáló</label><select id="if-investigator"><option value="">Nincs kijelölve</option>${personnel.map((p) => `<option value="${esc(p.name)}">${esc(p.name)}</option>`).join("")}</select></div>
      </div>
      <div class="grid grid-2">
        <div class="field"><label>Eredet</label><select id="if-origin">${INVESTIGATION_ORIGINS.map((o) => `<option>${esc(o)}</option>`).join("")}</select></div>
        <div class="field"><label>Súlyosság</label><select id="if-severity">${INVESTIGATION_SEVERITIES.map((s) => `<option>${esc(s)}</option>`).join("")}</select></div>
      </div>
      <div class="field"><label>Kategória</label>
        <select id="if-category">${categories.map((c) => `<option>${esc(c)}</option>`).join("")}<option value="__new__">+ Új kategória…</option></select>
      </div>
      <div class="field" id="if-new-category-wrap" style="display:none;"><label>Új kategória neve</label><input id="if-new-category" placeholder="pl. Árulás" /></div>
      <div class="field"><label>A bejelentés leírása</label><textarea id="if-description" rows="5" required placeholder="Mi történt, mikor, kik voltak érintve…"></textarea></div>
      <label class="filter-check mb-2"><input type="checkbox" id="if-confidential" checked /> Bizalmas kezelés</label>
      <div class="flex justify-between mt-2">
        <button type="button" class="btn" data-close-modal>Mégse</button>
        <button type="submit" class="btn btn-gold">Vizsgálat indítása</button>
      </div>
    </form>
  `);
  document.getElementById("if-usssid").addEventListener("change", (e) => {
    const p = personnel.find((x) => x.usssId === e.target.value.trim());
    if (p) document.getElementById("if-name").value = p.name;
  });
  document.getElementById("if-category").addEventListener("change", (e) => {
    document.getElementById("if-new-category-wrap").style.display = e.target.value === "__new__" ? "block" : "none";
  });
  document.getElementById("inv-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const subjectName = document.getElementById("if-name").value.trim();
    const description = document.getElementById("if-description").value.trim();
    if (!subjectName || !description) return;
    let category = document.getElementById("if-category").value;
    if (category === "__new__") {
      category = document.getElementById("if-new-category").value.trim();
      if (!category) return;
      addInvestigationCategory(category, actorLabel());
    }
    const inv = createInvestigation({
      subjectUsssId: document.getElementById("if-usssid").value.trim(),
      subjectName,
      reportedBy: document.getElementById("if-reporter").value.trim(),
      investigator: document.getElementById("if-investigator").value,
      origin: document.getElementById("if-origin").value,
      category,
      severity: document.getElementById("if-severity").value,
      description,
      confidential: document.getElementById("if-confidential").checked,
    }, actorLabel());
    toast(`Vizsgálat elindítva: ${inv.id}`);
    closeModal();
    navigate(`/investigations/${inv.id}`);
  });
}

export function renderInvestigationDetail(container, id) {
  const inv = getInvestigation(id);
  if (!inv) {
    container.innerHTML = `<div class="empty-state"><h3>A vizsgálat nem található</h3><a class="btn mt-2" href="#/investigations">Vissza</a></div>`;
    return;
  }
  const canEdit = hasRole("TRAINING");
  const canAdmin = hasRole("ADMIN");
  const isClosed = INVESTIGATION_CLOSED_STATUSES.includes(inv.status);

  container.innerHTML = `
    <a href="#/investigations" class="text-low small">← Vissza a belső vizsgálatokhoz</a>
    <div class="classification-strip mt-2">${esc(inv.id)} · BIZALMAS ${inv.confidential ? "· FOKOZOTTAN BIZALMAS" : ""}</div>

    <div class="card mt-2 mb-2">
      <div class="flex justify-between items-center mb-2 flex-wrap">
        <div>
          <div class="card-title">Érintett személy</div>
          <h2 style="font-size:22px; color: var(--gold-bright)">${esc(inv.subjectName || "—")}</h2>
          <div class="text-low small">${esc(inv.subjectUsssId || "Azonosító nincs megadva")}</div>
        </div>
        <div class="flex gap-1" style="align-items:flex-start">
          <span class="badge badge-${SEVERITY_BADGE[inv.severity] || "gray"}">${esc(inv.severity)}</span>
          <span class="badge badge-${STATUS_BADGE(inv.status)}">${esc(inv.status)}</span>
          ${canAdmin ? `<button class="btn btn-sm btn-danger" id="del-inv">Törlés</button>` : ""}
        </div>
      </div>
      <div class="grid grid-3 mb-2">
        <div><div class="card-title">Eredet</div><div class="text-hi"><span class="badge badge-${ORIGIN_BADGE[inv.origin] || "gray"}">${esc(inv.origin || "—")}</span></div></div>
        <div><div class="card-title">Kategória</div><div class="text-hi">${esc(inv.category)}</div></div>
        <div><div class="card-title">Bejelentő</div><div class="text-hi">${esc(inv.reportedBy || "—")}</div></div>
        <div><div class="card-title">Kivizsgáló</div><div class="text-hi">${esc(inv.investigator || "Nincs kijelölve")}</div></div>
        <div><div class="card-title">Bejelentve</div><div class="text-hi">${fmtDateTime(inv.openedAt)}</div></div>
        <div><div class="card-title">Lezárva</div><div class="text-hi">${inv.closedAt ? fmtDateTime(inv.closedAt) : "Nyitott ügy"}</div></div>
        <div><div class="card-title">Szankció</div><div class="text-hi">${esc(inv.outcome || "—")}</div></div>
      </div>

      ${canEdit && !isClosed ? `<div class="flex gap-1 flex-wrap mt-1">
        <select id="inv-investigator-quick" class="btn btn-sm" style="cursor:pointer"><option value="">Kivizsgáló módosítása…</option></select>
        ${inv.status === "Bejelentve" ? `<button class="btn btn-sm" id="start-inv">Vizsgálat alá helyezés</button>` : ""}
        ${inv.status === "Vizsgálat alatt" ? `<button class="btn btn-sm" id="suspend-inv">Felfüggesztés</button>` : ""}
        ${inv.status === "Felfüggesztve" ? `<button class="btn btn-sm" id="resume-inv">Folytatás</button>` : ""}
        <button class="btn btn-gold btn-sm" id="close-inv">Vizsgálat lezárása</button>
      </div>` : ""}
      ${canEdit && isClosed ? `<button class="btn btn-sm mt-1" id="reopen-inv">Vizsgálat újranyitása</button>` : ""}
    </div>

    <div class="card mb-2">
      <div class="card-title mb-1">A BEJELENTÉS LEÍRÁSA</div>
      ${canEdit ? `<textarea id="inv-description" rows="5" style="width:100%; background:var(--bg-base); border:1px solid var(--line-soft); border-radius:var(--radius-sm); color:var(--text-hi); padding:12px;">${esc(inv.description || "")}</textarea><button class="btn btn-sm mt-1" id="save-description">Mentés</button>` :
        `<div class="text-mid" style="white-space:pre-wrap">${esc(inv.description || "—")}</div>`}
    </div>

    <div class="card mb-2">
      <div class="card-title mb-1">MEGÁLLAPÍTÁSOK</div>
      <p class="text-low small mb-1">A kivizsgáló feljegyzései — mit talált, kikkel beszélt, mi a következtetés.</p>
      ${canEdit ? `<textarea id="inv-findings" rows="6" style="width:100%; background:var(--bg-base); border:1px solid var(--line-soft); border-radius:var(--radius-sm); color:var(--text-hi); padding:12px;">${esc(inv.findings || "")}</textarea><button class="btn btn-sm mt-1" id="save-findings">Mentés</button>` :
        `<div class="text-mid" style="white-space:pre-wrap">${inv.findings ? esc(inv.findings) : '<span class="text-low">Nincs rögzített megállapítás.</span>'}</div>`}
    </div>

    <div class="card mb-2">
      <div class="card-title mb-1">CSATOLMÁNYOK</div>
      <p class="text-low small mb-1">Bizonyítékok, dokumentumok (.docx, kép stb.) és beszélgetés-linkek — külső helyen tárolva (Discord, Drive, Dropbox), itt csak hivatkozásként.</p>
      ${(inv.attachments || []).length ? inv.attachments.map((a, i) => `
        <div class="history-item">
          <a href="${esc(a.url)}" target="_blank" rel="noopener noreferrer" class="text-gold">${esc(a.label)}</a>
          ${canEdit ? `<button class="btn btn-sm btn-danger" data-remove-attachment="${i}">×</button>` : ""}
        </div>`).join("") : `<div class="text-low small">Nincs csatolmány.</div>`}
      ${canEdit ? `
        <div class="grid grid-2 mt-2">
          <input id="inv-attachment-label" placeholder="Megnevezés, pl. Kihallgatási jegyzőkönyv.docx" />
          <div class="flex gap-1"><input id="inv-attachment-url" placeholder="https://…" style="flex:1" /><button type="button" class="btn btn-sm" id="add-inv-attachment-btn">+ Hozzáadás</button></div>
        </div>
      ` : ""}
    </div>

    <div class="card mb-2">
      <div class="card-title mb-1">KAPCSOLÓDÓ FEDETT MŰVELETEK</div>
      ${(inv.linkedOps || []).length ? (inv.linkedOps || []).map((opId) => {
        const op = getCovertOp(opId);
        return `<div class="history-item">
          <span>${op ? `<a href="#/covert-ops/${esc(opId)}" class="text-gold">${esc(opId)} — ${esc(formatCodename(op.codename))}</a>` : `<span class="text-low">${esc(opId)} (törölve)</span>`}</span>
          ${canEdit ? `<button class="btn btn-sm btn-danger" data-unlink-op="${esc(opId)}">×</button>` : ""}
        </div>`;
      }).join("") : `<div class="text-low small">Nincs hozzárendelt fedett művelet.</div>`}
      ${canEdit ? `
        <div class="flex gap-1 mt-2">
          <select id="inv-link-op" style="flex:1"><option value="">Válasszon fedett műveletet…</option>${getCovertOps().filter((op) => !(inv.linkedOps || []).includes(op.id)).map((op) => `<option value="${esc(op.id)}">${esc(op.id)} — ${esc(formatCodename(op.codename))}</option>`).join("")}</select>
          <button type="button" class="btn btn-sm" id="link-op-btn">+ Hozzárendelés</button>
        </div>
      ` : ""}
    </div>

    <div class="card">
      <div class="card-title mb-1">ELŐZMÉNYEK</div>
      ${(inv.history || []).slice().reverse().map((h) => `<div class="history-item"><span>${esc(h.action)}</span><span class="text-low small">${esc(h.by)} · ${fmtDateTime(h.at)}</span></div>`).join("") || `<div class="text-low small">Nincs rögzített esemény.</div>`}
    </div>
  `;

  document.getElementById("save-description")?.addEventListener("click", () => {
    updateInvestigation(inv.id, { description: document.getElementById("inv-description").value }, actorLabel());
    toast("Leírás mentve");
    renderInvestigationDetail(container, inv.id);
  });
  document.getElementById("save-findings")?.addEventListener("click", () => {
    updateInvestigation(inv.id, { findings: document.getElementById("inv-findings").value }, actorLabel());
    toast("Megállapítások mentve");
    renderInvestigationDetail(container, inv.id);
  });
  document.getElementById("start-inv")?.addEventListener("click", () => {
    updateInvestigation(inv.id, { status: "Vizsgálat alatt" }, actorLabel());
    toast("Vizsgálat alá helyezve");
    renderInvestigationDetail(container, inv.id);
  });
  document.getElementById("suspend-inv")?.addEventListener("click", () => {
    updateInvestigation(inv.id, { status: "Felfüggesztve" }, actorLabel());
    toast("Vizsgálat felfüggesztve");
    renderInvestigationDetail(container, inv.id);
  });
  document.getElementById("resume-inv")?.addEventListener("click", () => {
    updateInvestigation(inv.id, { status: "Vizsgálat alatt" }, actorLabel());
    toast("Vizsgálat folytatva");
    renderInvestigationDetail(container, inv.id);
  });
  document.getElementById("close-inv")?.addEventListener("click", () => openCloseForm(inv, container));
  document.getElementById("reopen-inv")?.addEventListener("click", () => {
    if (!confirm("Biztosan újranyitja a vizsgálatot?")) return;
    reopenInvestigation(inv.id, actorLabel());
    toast("Vizsgálat újranyitva");
    renderInvestigationDetail(container, inv.id);
  });
  document.getElementById("del-inv")?.addEventListener("click", () => {
    if (!confirm(`Biztosan törli a(z) ${inv.id} vizsgálatot? Ez nem vonható vissza.`)) return;
    deleteInvestigation(inv.id, actorLabel());
    toast("Vizsgálat törölve");
    navigate("/investigations");
  });
  document.getElementById("link-op-btn")?.addEventListener("click", () => {
    const opId = document.getElementById("inv-link-op").value;
    if (!opId) return;
    linkCovertOp(inv.id, opId, actorLabel());
    toast("Fedett művelet hozzárendelve");
    renderInvestigationDetail(container, inv.id);
  });
  container.querySelectorAll("[data-unlink-op]").forEach((b) =>
    b.addEventListener("click", () => {
      unlinkCovertOp(inv.id, b.getAttribute("data-unlink-op"), actorLabel());
      toast("Kapcsolat megszüntetve");
      renderInvestigationDetail(container, inv.id);
    })
  );
  document.getElementById("add-inv-attachment-btn")?.addEventListener("click", () => {
    const label = document.getElementById("inv-attachment-label").value.trim();
    const url = document.getElementById("inv-attachment-url").value.trim();
    if (!label || !url) return;
    addInvestigationAttachment(inv.id, { label, url }, actorLabel());
    toast("Csatolmány hozzáadva");
    renderInvestigationDetail(container, inv.id);
  });
  container.querySelectorAll("[data-remove-attachment]").forEach((b) =>
    b.addEventListener("click", () => {
      removeInvestigationAttachment(inv.id, Number(b.getAttribute("data-remove-attachment")), actorLabel());
      toast("Csatolmány eltávolítva");
      renderInvestigationDetail(container, inv.id);
    })
  );

  const quickInvestigator = document.getElementById("inv-investigator-quick");
  if (quickInvestigator) {
    quickInvestigator.innerHTML = `<option value="">Kivizsgáló módosítása…</option>` + getPersonnel().map((p) => `<option value="${esc(p.name)}">${esc(p.name)}</option>`).join("");
    quickInvestigator.addEventListener("change", (e) => {
      if (!e.target.value) return;
      updateInvestigation(inv.id, { investigator: e.target.value }, actorLabel());
      toast("Kivizsgáló módosítva");
      renderInvestigationDetail(container, inv.id);
    });
  }
}

function openCloseForm(inv, container) {
  openModal(`
    <div class="modal-head"><h3>Vizsgálat lezárása — ${esc(inv.id)}</h3><button class="modal-close" data-close-modal>×</button></div>
    <form id="close-form">
      <div class="field"><label>Záró státusz</label>
        <select id="cf-status" required>
          <option value="">Válasszon…</option>
          <option value="Lezárva – megalapozott">Lezárva – megalapozott</option>
          <option value="Lezárva – nem megalapozott">Lezárva – nem megalapozott</option>
          <option value="Elutasítva">Elutasítva</option>
        </select>
      </div>
      <div class="field"><label>Szankció</label>
        <select id="cf-outcome">${INVESTIGATION_OUTCOMES.map((o) => `<option>${esc(o)}</option>`).join("")}</select>
      </div>
      <p class="text-low small">A megállapításokat és a szankció indoklását a "Megállapítások" mezőben rögzítse lezárás előtt.</p>
      <div class="flex justify-between mt-2">
        <button type="button" class="btn" data-close-modal>Mégse</button>
        <button type="submit" class="btn btn-gold">Vizsgálat lezárása</button>
      </div>
    </form>
  `);
  document.getElementById("close-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const status = document.getElementById("cf-status").value;
    if (!status) return;
    closeInvestigation(inv.id, { status, outcome: document.getElementById("cf-outcome").value }, actorLabel());
    toast("Vizsgálat lezárva");
    closeModal();
    renderInvestigationDetail(container, inv.id);
  });
}
