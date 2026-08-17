import { getProtocols, getProtocol, getPersonnel, createProtocol, ref, moduleByCode } from "../store.js?v=17";
import { hasRole, actorLabel } from "../auth.js?v=17";
import { esc, fmtDate, fmtDateTime, toast, openModal, closeModal } from "../utils.js?v=17";
import { navigate } from "../router.js?v=17";

export function renderProtocolsList(container) {
  const canEdit = hasRole("TRAINING");
  const protocols = getProtocols();
  const allModules = [
    ...new Map(
      Object.entries(ref.LEVEL_MODULE_ORDER).flatMap(([, codes]) => codes).map((c) => [c, moduleByCode(c)])
    ).values(),
  ];

  container.innerHTML = `
    <div class="section-head">
      <h2 style="visibility:hidden">.</h2>
      <div class="actions">${canEdit ? `<button class="btn btn-gold" id="new-protocol">+ Új jegyzőkönyv</button>` : ""}</div>
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th>Azonosító</th><th>Vizsga / oktatás</th><th>Dátum</th><th>Oktató</th><th>Résztvevők</th></tr></thead>
      <tbody>
        ${protocols.length ? protocols.map((p) => `
          <tr class="row-link" data-nav="/protocols/${esc(p.id)}">
            <td class="text-gold" style="font-family:var(--font-mono)">${esc(p.id)}</td>
            <td>${esc(p.moduleCode)} — ${esc(moduleByCode(p.moduleCode)?.name || "")}</td>
            <td>${fmtDate(p.date)}</td>
            <td>${esc(p.examiner || "—")}</td>
            <td>${p.participants.length} fő${participantSummary(p.participants)}</td>
          </tr>`).join("") : `<tr><td colspan="5"><div class="empty-state"><h3>Nincs még jegyzőkönyv</h3><p>Hozza létre az elsőt a fenti gombbal.</p></div></td></tr>`}
      </tbody>
    </table></div>
  `;

  container.querySelectorAll("[data-nav]").forEach((n) => n.addEventListener("click", () => navigate(n.getAttribute("data-nav"))));
  document.getElementById("new-protocol")?.addEventListener("click", () => openProtocolForm(allModules));
}

function participantSummary(participants) {
  const pass = participants.filter((p) => p.examResult === "pass").length;
  const fail = participants.filter((p) => p.examResult === "fail").length;
  if (!pass && !fail) return "";
  return ` <span class="text-low small">(${pass ? `${pass} sikeres` : ""}${pass && fail ? ", " : ""}${fail ? `${fail} sikertelen` : ""})</span>`;
}

function openProtocolForm(allModules) {
  const personnel = getPersonnel();
  let selected = [];

  const overlay = openModal(`
    <div class="modal-head"><h3>Új jegyzőkönyv</h3><button class="modal-close" data-close-modal>×</button></div>
    <form id="protocol-form">
      <div class="grid grid-2">
        <div class="field"><label>Vizsga / oktatás</label>
          <select id="pr-module" required>
            <option value="">Válasszon…</option>
            ${allModules.map((m) => `<option value="${esc(m.code)}">${esc(m.code)} — ${esc(m.name)}</option>`).join("")}
          </select>
        </div>
        <div class="field"><label>Dátum</label><input type="date" id="pr-date" required value="${new Date().toISOString().slice(0,10)}" /></div>
      </div>
      <div class="field"><label>Vizsgáztató / oktató</label>
        <select id="pr-examiner"><option value="">Válasszon…</option>${personnel.map((p) => `<option value="${esc(p.name)}">${esc(p.name)} (${esc(p.usssId)})</option>`).join("")}</select>
      </div>
      <div class="field">
        <label>Résztvevők</label>
        <select id="pr-add-participant"><option value="">+ Résztvevő hozzáadása…</option>${personnel.map((p) => `<option value="${esc(p.usssId)}">${esc(p.name)} (${esc(p.usssId)})</option>`).join("")}</select>
        <div id="pr-participants" class="mt-1"></div>
      </div>
      <div class="field"><label>Megjegyzések</label><textarea id="pr-notes" rows="3"></textarea></div>
      <div class="flex justify-between mt-2">
        <button type="button" class="btn" data-close-modal>Mégse</button>
        <button type="submit" class="btn btn-gold">Jegyzőkönyv létrehozása</button>
      </div>
    </form>
  `);

  const partList = document.getElementById("pr-participants");
  function redrawParticipants() {
    partList.innerHTML = selected.map((s, i) => `
      <div class="participant-row">
        <div class="flex justify-between items-center">
          <span class="text-hi">${esc(personnel.find((p) => p.usssId === s.usssId)?.name || s.usssId)}</span>
          <button type="button" class="btn btn-sm" data-remove-idx="${i}">×</button>
        </div>
        <label class="flex items-center gap-1 small text-mid" style="cursor:pointer; margin-top:6px;">
          <input type="checkbox" data-examined-idx="${i}" ${s.examined ? "checked" : ""} /> Vizsgázott ezen az oktatáson
        </label>
        ${s.examined ? `
        <div class="flex gap-1 mt-1">
          <button type="button" class="btn btn-sm ${s.examResult === "pass" ? "btn-result-pass active" : "btn-result-pass"}" data-result-idx="${i}" data-result="pass">Sikeres</button>
          <button type="button" class="btn btn-sm ${s.examResult === "fail" ? "btn-result-fail active" : "btn-result-fail"}" data-result-idx="${i}" data-result="fail">Sikertelen</button>
        </div>` : `<div class="small text-low mt-1">Csak részt vett, a modul állapota nem változik.</div>`}
      </div>`).join("");

    partList.querySelectorAll("[data-examined-idx]").forEach((cb) =>
      cb.addEventListener("change", () => {
        const i = Number(cb.getAttribute("data-examined-idx"));
        selected[i].examined = cb.checked;
        if (!cb.checked) selected[i].examResult = null;
        redrawParticipants();
      })
    );
    partList.querySelectorAll("[data-result-idx]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const i = Number(btn.getAttribute("data-result-idx"));
        selected[i].examResult = btn.getAttribute("data-result");
        redrawParticipants();
      })
    );
    partList.querySelectorAll("[data-remove-idx]").forEach((b) =>
      b.addEventListener("click", () => { selected.splice(Number(b.getAttribute("data-remove-idx")), 1); redrawParticipants(); })
    );
  }

  document.getElementById("pr-add-participant").addEventListener("change", (e) => {
    const id = e.target.value;
    if (id && !selected.find((s) => s.usssId === id)) {
      selected.push({ usssId: id, examined: false, examResult: null, note: "" });
      redrawParticipants();
    }
    e.target.value = "";
  });

  document.getElementById("protocol-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const moduleCode = document.getElementById("pr-module").value;
    if (!moduleCode) return toast("Válasszon vizsgát / oktatást.", "warn");
    if (!selected.length) return toast("Adjon hozzá legalább egy résztvevőt.", "warn");
    if (selected.some((s) => s.examined && !s.examResult)) {
      return toast("Minden vizsgázott résztvevőnél válassz eredményt (sikeres/sikertelen).", "warn");
    }
    const protocol = createProtocol({
      moduleCode,
      date: document.getElementById("pr-date").value,
      examiner: document.getElementById("pr-examiner").value,
      participants: selected,
      notes: document.getElementById("pr-notes").value,
    }, actorLabel());
    toast(`Jegyzőkönyv létrehozva: ${protocol.id}`);
    closeModal();
    navigate(`/protocols/${protocol.id}`);
  });
}

export function renderProtocolDetail(container, id) {
  const protocol = getProtocol(id);
  if (!protocol) {
    container.innerHTML = `<div class="empty-state"><h3>A jegyzőkönyv nem található</h3><a class="btn mt-2" href="#/protocols">Vissza</a></div>`;
    return;
  }
  const personnel = getPersonnel();
  const mod = moduleByCode(protocol.moduleCode);

  container.innerHTML = `
    <a href="#/protocols" class="text-low small">← Vissza a jegyzőkönyvekhez</a>
    <div class="card mt-2">
      <div class="flex justify-between items-center mb-2">
        <div>
          <div class="card-title">Jegyzőkönyv</div>
          <h2 style="font-size:22px; color: var(--gold-bright)">${esc(protocol.id)}</h2>
        </div>
        <span class="badge badge-gold">${esc(protocol.moduleCode)}</span>
      </div>
      <div class="grid grid-2 mb-2">
        <div><div class="card-title">Vizsga / oktatás</div><div class="text-hi">${esc(mod?.name || protocol.moduleCode)}</div></div>
        <div><div class="card-title">Dátum</div><div class="text-hi">${fmtDate(protocol.date)}</div></div>
        <div><div class="card-title">Vizsgáztató / oktató</div><div class="text-hi">${esc(protocol.examiner || "—")}</div></div>
        <div><div class="card-title">Létrehozta</div><div class="text-hi">${esc(protocol.createdBy)} · ${fmtDateTime(protocol.createdAt)}</div></div>
      </div>
      <div class="divider"></div>
      <div class="card-title mb-1">Résztvevők (${protocol.participants.length})</div>
      ${protocol.participants.map((pt) => {
        const p = personnel.find((x) => x.usssId === pt.usssId);
        const badge = pt.examResult === "pass" ? { c: "badge-green", t: "Sikeres" }
          : pt.examResult === "fail" ? { c: "badge-red", t: "Sikertelen" }
          : { c: "badge-gray", t: "Résztvevő (nem vizsgázott)" };
        return `<div class="history-item">
          <a href="#/personnel/${esc(pt.usssId)}" class="text-hi">${esc(p?.name || pt.usssId)}</a>
          <span class="badge ${badge.c}">${badge.t}</span>
        </div>`;
      }).join("")}
      ${protocol.notes ? `<div class="divider"></div><div class="card-title mb-1">Megjegyzések</div><div class="text-mid" style="white-space:pre-wrap">${esc(protocol.notes)}</div>` : ""}
    </div>
  `;
}
