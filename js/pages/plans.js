import {
  getTrainingPlans, getTrainingPlan, createTrainingPlan, updateTrainingPlan, deleteTrainingPlan,
  linkTrainingPlanProtocol, PLAN_STATUSES, getPersonnel, allModulesFlat, moduleByCode,
  MAX_ATTACHMENT_BYTES, MAX_ATTACHMENTS_PER_PLAN, ALLOWED_ATTACHMENT_EXT,
} from "../store.js?v=54";
import { hasRole, actorLabel } from "../auth.js?v=20";
import { esc, fmtDate, fmtDateTime, toast, openModal, closeModal } from "../utils.js?v=22";
import { navigate } from "../router.js?v=20";
import { openProtocolForm } from "./protocols.js?v=22";

const STATUS_BADGE = {
  TERVEZETT: "badge-gray",
  FOLYAMATBAN: "badge-gold",
  LEZÁRVA: "badge-green",
  TÖRÖLVE: "badge-red",
};

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileExt(name) {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function renderTrainingPlansList(container) {
  const canEdit = hasRole("TRAINING");
  const allModules = allModulesFlat();
  const plans = getTrainingPlans();

  container.innerHTML = `
    <div class="page-banner page-banner-training">
      <div class="page-banner-body">
        <div class="eyebrow">ÁLLOMÁNY & KÉPZÉS</div>
        <h2>Kiképzési tervek</h2>
        <p>Jövőbeli oktatások és vizsgák előzetes megtervezése — cél, résztvevők, oktató, dátum.</p>
      </div>
    </div>
    <div class="section-head">
      <h2 style="visibility:hidden">.</h2>
      <div class="actions">${canEdit ? `<button class="btn btn-gold" id="new-plan">+ Új kiképzési terv</button>` : ""}</div>
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th>Azonosító</th><th>Cím</th><th>Modul</th><th>Tervezett dátum</th><th>Oktató</th><th>Résztvevők</th><th>Mellékletek</th><th>Státusz</th></tr></thead>
      <tbody>
        ${plans.length ? plans.map((p) => `
          <tr class="row-link" data-nav="/plans/${esc(p.id)}">
            <td class="text-gold" style="font-family:var(--font-mono)">${esc(p.id)}</td>
            <td>${esc(p.title)}</td>
            <td>${p.moduleCode ? `${esc(p.moduleCode)} — ${esc(moduleByCode(p.moduleCode)?.name || "")}` : "—"}</td>
            <td>${p.plannedDate ? fmtDate(p.plannedDate) : "—"}</td>
            <td>${esc(p.instructor || "—")}</td>
            <td>${p.participants.length} fő</td>
            <td>${(p.attachments || []).length ? `📎 ${p.attachments.length}` : "—"}</td>
            <td><span class="badge ${STATUS_BADGE[p.status] || "badge-gray"}">${esc(p.status)}</span></td>
          </tr>`).join("") : `<tr><td colspan="8"><div class="empty-state"><h3>Nincs még kiképzési terv</h3><p>Hozza létre az elsőt a fenti gombbal.</p></div></td></tr>`}
      </tbody>
    </table></div>
  `;

  container.querySelectorAll("[data-nav]").forEach((n) => n.addEventListener("click", () => navigate(n.getAttribute("data-nav"))));
  document.getElementById("new-plan")?.addEventListener("click", () => openPlanForm(allModules));
}

function openPlanForm(allModules, existing = null) {
  const personnel = getPersonnel();
  let selected = (existing?.participants || []).slice();
  let attachments = (existing?.attachments || []).slice();

  const overlay = openModal(`
    <div class="modal-head"><h3>${existing ? "Kiképzési terv szerkesztése" : "Új kiképzési terv"}</h3><button class="modal-close" data-close-modal>×</button></div>
    <form id="plan-form">
      <div class="field"><label>Cím</label><input id="pl-title" required autofocus value="${esc(existing?.title || "")}" /></div>
      <div class="grid grid-2">
        <div class="field"><label>Modul / vizsga (opcionális)</label>
          <select id="pl-module">
            <option value="">Nincs kiválasztva</option>
            ${allModules.map((m) => `<option value="${esc(m.code)}" ${existing?.moduleCode === m.code ? "selected" : ""}>${esc(m.code)} — ${esc(m.name)}</option>`).join("")}
          </select>
        </div>
        <div class="field"><label>Tervezett dátum</label><input type="date" id="pl-date" value="${esc(existing?.plannedDate || new Date().toISOString().slice(0,10))}" /></div>
      </div>
      <div class="grid grid-2">
        <div class="field"><label>Oktató</label>
          <select id="pl-instructor"><option value="">Válasszon…</option>${personnel.map((p) => `<option value="${esc(p.name)}" ${existing?.instructor === p.name ? "selected" : ""}>${esc(p.name)} (${esc(p.usssId)})</option>`).join("")}</select>
        </div>
        <div class="field"><label>Helyszín</label><input id="pl-location" value="${esc(existing?.location || "")}" /></div>
      </div>
      <div class="field">
        <label>Résztvevők (tervezett)</label>
        <select id="pl-add-participant"><option value="">+ Résztvevő hozzáadása…</option>${personnel.map((p) => `<option value="${esc(p.usssId)}">${esc(p.name)} (${esc(p.usssId)})</option>`).join("")}</select>
        <div id="pl-participants" class="mt-1"></div>
      </div>
      <div class="field"><label>Célok / napirend</label><textarea id="pl-objectives" rows="4">${esc(existing?.objectives || "")}</textarea></div>
      <div class="grid grid-2">
        <div class="field"><label>Státusz</label><select id="pl-status">${PLAN_STATUSES.map((s) => `<option ${(existing?.status || "TERVEZETT") === s ? "selected" : ""}>${s}</option>`).join("")}</select></div>
      </div>
      <div class="field">
        <label>Mellékletek (PDF, DOCX, XLSX, kép — max. ${formatBytes(MAX_ATTACHMENT_BYTES)}/fájl, legfeljebb ${MAX_ATTACHMENTS_PER_PLAN} db)</label>
        <input type="file" id="pl-attach-input" multiple accept="${ALLOWED_ATTACHMENT_EXT.join(",")}" />
        <div id="pl-attachments" class="mt-1"></div>
      </div>
      <div class="field"><label>Megjegyzések</label><textarea id="pl-notes" rows="3">${esc(existing?.notes || "")}</textarea></div>
      <div class="flex justify-between mt-2">
        <button type="button" class="btn" data-close-modal>Mégse</button>
        <button type="submit" class="btn btn-gold" id="pl-submit">${existing ? "Mentés" : "Terv létrehozása"}</button>
      </div>
    </form>
  `);

  const attachList = document.getElementById("pl-attachments");
  function redrawAttachments() {
    attachList.innerHTML = attachments.length ? attachments.map((a, i) => `
      <div class="participant-row">
        <div class="flex justify-between items-center">
          <a class="text-hi" href="${a.dataUrl}" download="${esc(a.name)}">📎 ${esc(a.name)}</a>
          <div class="flex items-center gap-1">
            <span class="text-low small">${formatBytes(a.size)}</span>
            <button type="button" class="btn btn-sm" data-remove-attach-idx="${i}">×</button>
          </div>
        </div>
      </div>`).join("") : `<div class="small text-low mt-1">Nincs csatolt fájl.</div>`;
    attachList.querySelectorAll("[data-remove-attach-idx]").forEach((b) =>
      b.addEventListener("click", () => { attachments.splice(Number(b.getAttribute("data-remove-attach-idx")), 1); redrawAttachments(); })
    );
  }
  redrawAttachments();

  const attachInput = document.getElementById("pl-attach-input");
  const submitBtn = document.getElementById("pl-submit");
  attachInput.addEventListener("change", async () => {
    const files = Array.from(attachInput.files || []);
    attachInput.value = "";
    if (!files.length) return;
    if (attachments.length + files.length > MAX_ATTACHMENTS_PER_PLAN) {
      return toast(`Legfeljebb ${MAX_ATTACHMENTS_PER_PLAN} melléklet adható hozzá tervenként.`, "warn");
    }
    const oversized = files.find((f) => f.size > MAX_ATTACHMENT_BYTES);
    if (oversized) {
      return toast(`"${oversized.name}" túl nagy (max. ${formatBytes(MAX_ATTACHMENT_BYTES)}/fájl).`, "warn");
    }
    const rejected = files.find((f) => !ALLOWED_ATTACHMENT_EXT.includes(fileExt(f.name)));
    if (rejected) {
      return toast(`"${rejected.name}" nem támogatott fájltípus.`, "warn");
    }
    submitBtn.disabled = true;
    submitBtn.textContent = "Feltöltés…";
    try {
      for (const file of files) {
        const dataUrl = await readFileAsDataUrl(file);
        attachments.push({
          id: `ATT-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
          name: file.name,
          type: file.type,
          size: file.size,
          dataUrl,
          uploadedBy: actorLabel(),
          uploadedAt: new Date().toISOString(),
        });
      }
      redrawAttachments();
    } catch {
      toast("Nem sikerült beolvasni a fájlt.", "warn");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = existing ? "Mentés" : "Terv létrehozása";
    }
  });

  const partList = document.getElementById("pl-participants");
  function redrawParticipants() {
    partList.innerHTML = selected.map((usssId, i) => `
      <div class="participant-row">
        <div class="flex justify-between items-center">
          <span class="text-hi">${esc(personnel.find((p) => p.usssId === usssId)?.name || usssId)}</span>
          <button type="button" class="btn btn-sm" data-remove-idx="${i}">×</button>
        </div>
      </div>`).join("");
    partList.querySelectorAll("[data-remove-idx]").forEach((b) =>
      b.addEventListener("click", () => { selected.splice(Number(b.getAttribute("data-remove-idx")), 1); redrawParticipants(); })
    );
  }
  redrawParticipants();

  document.getElementById("pl-add-participant").addEventListener("change", (e) => {
    const id = e.target.value;
    if (id && !selected.includes(id)) { selected.push(id); redrawParticipants(); }
    e.target.value = "";
  });

  document.getElementById("plan-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const title = document.getElementById("pl-title").value.trim();
    if (!title) return toast("Adjon meg egy címet.", "warn");
    const data = {
      title,
      moduleCode: document.getElementById("pl-module").value,
      plannedDate: document.getElementById("pl-date").value,
      instructor: document.getElementById("pl-instructor").value,
      location: document.getElementById("pl-location").value,
      participants: selected,
      objectives: document.getElementById("pl-objectives").value,
      status: document.getElementById("pl-status").value,
      notes: document.getElementById("pl-notes").value,
      attachments,
    };
    if (existing) {
      const plan = updateTrainingPlan(existing.id, data, actorLabel());
      if (!plan) return toast("Nem sikerült menteni — megtelt a böngésző helyi tárhelye. Távolítson el egy mellékletet.", "warn");
      toast(`Kiképzési terv frissítve: ${existing.id}`);
      closeModal();
      renderTrainingPlanDetail(document.getElementById("content"), existing.id);
    } else {
      const plan = createTrainingPlan(data, actorLabel());
      if (!plan) return toast("Nem sikerült létrehozni — megtelt a böngésző helyi tárhelye. Távolítson el egy mellékletet.", "warn");
      toast(`Kiképzési terv létrehozva: ${plan.id}`);
      closeModal();
      navigate(`/plans/${plan.id}`);
    }
  });
}

export function renderTrainingPlanDetail(container, id) {
  const plan = getTrainingPlan(id);
  if (!plan) {
    container.innerHTML = `<div class="empty-state"><h3>A kiképzési terv nem található</h3><a class="btn mt-2" href="#/plans">Vissza</a></div>`;
    return;
  }
  const canEdit = hasRole("TRAINING");
  const personnel = getPersonnel();
  const mod = plan.moduleCode ? moduleByCode(plan.moduleCode) : null;
  const allModules = allModulesFlat();

  container.innerHTML = `
    <a href="#/plans" class="text-low small">← Vissza a kiképzési tervekhez</a>
    <div class="card mt-2">
      <div class="flex justify-between items-center mb-2">
        <div>
          <div class="card-title">Kiképzési terv</div>
          <h2 style="font-size:22px; color: var(--gold-bright)">${esc(plan.title)}</h2>
        </div>
        <span class="badge ${STATUS_BADGE[plan.status] || "badge-gray"}">${esc(plan.status)}</span>
      </div>
      <div class="grid grid-2 mb-2">
        <div><div class="card-title">Azonosító</div><div class="text-hi" style="font-family:var(--font-mono)">${esc(plan.id)}</div></div>
        <div><div class="card-title">Modul / vizsga</div><div class="text-hi">${mod ? `${esc(plan.moduleCode)} — ${esc(mod.name)}` : "—"}</div></div>
        <div><div class="card-title">Tervezett dátum</div><div class="text-hi">${plan.plannedDate ? fmtDate(plan.plannedDate) : "—"}</div></div>
        <div><div class="card-title">Helyszín</div><div class="text-hi">${esc(plan.location || "—")}</div></div>
        <div><div class="card-title">Oktató</div><div class="text-hi">${esc(plan.instructor || "—")}</div></div>
        <div><div class="card-title">Létrehozta</div><div class="text-hi">${esc(plan.createdBy)} · ${fmtDateTime(plan.createdAt)}</div></div>
      </div>
      <div class="divider"></div>
      <div class="card-title mb-1">Tervezett résztvevők (${plan.participants.length})</div>
      ${plan.participants.length ? plan.participants.map((usssId) => {
        const p = personnel.find((x) => x.usssId === usssId);
        return `<div class="history-item"><a href="#/personnel/${esc(usssId)}" class="text-hi">${esc(p?.name || usssId)}</a></div>`;
      }).join("") : `<div class="text-low small">Nincs még hozzárendelt résztvevő.</div>`}
      ${plan.objectives ? `<div class="divider"></div><div class="card-title mb-1">Célok / napirend</div><div class="text-mid" style="white-space:pre-wrap">${esc(plan.objectives)}</div>` : ""}
      ${(plan.attachments || []).length ? `<div class="divider"></div><div class="card-title mb-1">Mellékletek (${plan.attachments.length})</div>
        ${plan.attachments.map((a) => `<div class="history-item"><a class="text-hi" href="${a.dataUrl}" download="${esc(a.name)}">📎 ${esc(a.name)}</a><span class="text-low small">${formatBytes(a.size)} · ${esc(a.uploadedBy || "")} · ${fmtDateTime(a.uploadedAt)}</span></div>`).join("")}` : ""}
      ${plan.notes ? `<div class="divider"></div><div class="card-title mb-1">Megjegyzések</div><div class="text-mid" style="white-space:pre-wrap">${esc(plan.notes)}</div>` : ""}
      ${plan.protocolId ? `<div class="divider"></div><div class="card-title mb-1">Kapcsolódó jegyzőkönyv</div><a class="text-hi" href="#/protocols/${esc(plan.protocolId)}">${esc(plan.protocolId)}</a>` : ""}
      ${canEdit ? `
      <div class="divider"></div>
      <div class="flex gap-1" style="flex-wrap:wrap">
        <button class="btn btn-sm" id="edit-plan">Szerkesztés</button>
        ${!plan.protocolId ? `<button class="btn btn-sm btn-gold" id="convert-plan">Jegyzőkönyv rögzítése ebből a tervből</button>` : ""}
        <button class="btn btn-sm" id="delete-plan">Törlés</button>
      </div>` : ""}
    </div>
  `;

  document.getElementById("edit-plan")?.addEventListener("click", () => openPlanForm(allModules, plan));
  document.getElementById("delete-plan")?.addEventListener("click", () => {
    if (!confirm(`Biztosan törli a(z) ${plan.id} kiképzési tervet?`)) return;
    deleteTrainingPlan(plan.id, actorLabel());
    toast("Kiképzési terv törölve");
    navigate("/plans");
  });
  document.getElementById("convert-plan")?.addEventListener("click", () => {
    openProtocolForm(allModules, {
      moduleCode: plan.moduleCode,
      date: plan.plannedDate,
      participants: plan.participants,
      onCreated: (protocol) => {
        linkTrainingPlanProtocol(plan.id, protocol.id, actorLabel());
        toast(`Jegyzőkönyv létrehozva és a tervhez kapcsolva: ${protocol.id}`);
        renderTrainingPlanDetail(document.getElementById("content"), plan.id);
      },
    });
  });
}
