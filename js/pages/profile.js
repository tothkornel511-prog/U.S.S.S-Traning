import {
  getPerson, ref, moduleState, readinessPercent, levelProgress, probationInfo,
  setModuleTheory, setModulePractical, approveLevelUp, nextLevelId, liftProbation,
  levelLabel, moduleByCode, examStats, THEORY_PASS_THRESHOLD, deleteHistoryEntry,
} from "../store.js?v=49";
import { hasRole, actorLabel } from "../auth.js?v=20";
import { esc, initials, fmtDate, fmtDateTime, toast, openModal, closeModal } from "../utils.js?v=22";
import { navigate } from "../router.js?v=20";

let activeTab = "modules";

export function renderProfile(container, usssId) {
  const person = getPerson(usssId);
  if (!person) {
    container.innerHTML = `<div class="empty-state"><h3>A személy nem található</h3><p>USSS ID: ${esc(usssId)}</p><a class="btn mt-2" href="#/personnel">Vissza az állományhoz</a></div>`;
    return;
  }
  const canEdit = hasRole("TRAINING");
  const canAdmin = hasRole("ADMIN");
  const prob = probationInfo(person);
  const readiness = readinessPercent(person);

  const allModuleCodes = [...new Set(Object.values(ref.LEVEL_MODULE_ORDER).filter((_, i) => true).flat())];
  const totalModules = new Set(Object.entries(ref.LEVEL_MODULE_ORDER).filter(([k]) => k !== "SPEC").flatMap(([, v]) => v)).size;
  const completedModules = Object.keys(person.modules || {}).filter((c) => moduleState(person, c).color === "green").length;

  const exam = examStats(person);

  container.innerHTML = `
    <a href="#/personnel" class="text-low small">← Vissza az állományhoz</a>
    <div class="profile-head mt-2">
      <div class="avatar avatar-lg">${person.photo ? `<img src="${esc(person.photo)}"/>` : initials(person.name)}</div>
      <div style="flex:1">
        <div class="profile-name">${esc(person.name)}</div>
        <div class="profile-id">${esc(person.usssId)} · ${esc(person.position)}</div>
        <div class="profile-meta">
          <span class="badge ${statusColor(person.status)}">${esc(person.status)}</span>
          <span class="level-chip">${esc(levelLabel(person.level))}</span>
          ${prob ? `<span class="badge ${prob.active ? "badge-yellow" : "badge-gray"}">PRÓBAIDŐ ${prob.active ? `AKTÍV · ${prob.daysLeft} nap hátra` : "LEJÁRT"}</span>` : ""}
          ${person.levelUpEligible ? `<span class="badge badge-gold">Szintlépésre jogosult</span>` : ""}
        </div>
      </div>
      ${canEdit ? `<div class="flex gap-1">
        ${prob && prob.active && canAdmin ? `<button class="btn btn-sm" id="lift-prob">Próbaidő korlátozás feloldása</button>` : ""}
        ${person.levelUpEligible && canAdmin ? `<button class="btn btn-gold btn-sm" id="approve-levelup">Szintlépés jóváhagyása</button>` : ""}
      </div>` : ""}
    </div>

    <div class="grid grid-3 section">
      <div class="card"><div class="card-title">Képzési Készenlét</div><div class="card-value">${readiness}%</div><div class="progress mt-1"><div style="width:${readiness}%"></div></div></div>
      <div class="card"><div class="card-title">Teljesített modulok</div><div class="card-value">${completedModules} / ${totalModules}</div><div class="card-sub">Vizsgák összesen: ${exam.totalAttempts} · Elmélet: ${exam.theoryPass} sikeres / ${exam.theoryFail} sikertelen · Gyakorlat: ${exam.practicalPass} sikeres / ${exam.practicalFail} sikertelen</div></div>
      <div class="card"><div class="card-title">Szakirányok</div><div class="card-value" style="font-size:20px">${specialtyBadges(person)}</div></div>
    </div>

    <div class="tabs">
      <button class="tab-btn ${activeTab === "modules" ? "active" : ""}" data-tab="modules">Képzési modulok</button>
      <button class="tab-btn ${activeTab === "history" ? "active" : ""}" data-tab="history">Vizsgatörténet</button>
      <button class="tab-btn ${activeTab === "notes" ? "active" : ""}" data-tab="notes">Megjegyzések</button>
    </div>
    <div id="tab-content"></div>
  `;

  container.querySelectorAll(".tab-btn").forEach((b) =>
    b.addEventListener("click", () => {
      activeTab = b.getAttribute("data-tab");
      renderProfile(container, usssId);
    })
  );

  if (prob && prob.active && canAdmin) {
    document.getElementById("lift-prob")?.addEventListener("click", () => {
      liftProbation(usssId, actorLabel());
      toast("Próbaidős korlátozás feloldva");
      renderProfile(container, usssId);
    });
  }
  if (person.levelUpEligible && canAdmin) {
    document.getElementById("approve-levelup")?.addEventListener("click", () => {
      const nl = nextLevelId(person.level);
      if (!nl) return toast("Nincs magasabb szint.", "warn");
      approveLevelUp(usssId, nl, actorLabel());
      toast(`Szintlépés jóváhagyva: ${levelLabel(nl)}`);
      renderProfile(container, usssId);
    });
  }

  renderTab(person, canEdit);
}

function specialtyBadges(person) {
  const specs = ref.LEVEL_MODULE_ORDER.SPEC.filter((c) => moduleState(person, c).color === "green");
  if (!specs.length) return `<span class="text-low" style="font-size:13px">—</span>`;
  return specs.map((c) => `<span class="badge badge-gold">${esc(c)}</span>`).join(" ");
}

function renderTab(person, canEdit) {
  const tabEl = document.getElementById("tab-content");
  if (activeTab === "modules") {
    tabEl.innerHTML = ["0", "I", "II", "III", "IV", "V", "SPEC"].map((lvl) => {
      const mods = ref.LEVEL_MODULE_ORDER[lvl] || [];
      const prog = levelProgress(person, lvl);
      const label = lvl === "SPEC" ? "Szinten kívüli szakirányok" : levelLabel(lvl);
      return `
        <div class="section">
          <div class="section-head"><h2 style="font-size:14px">${esc(label)}</h2>
            ${lvl !== "SPEC" ? `<span class="text-low small">${prog.done}/${prog.total} modul</span>` : ""}
          </div>
          ${mods.map((code) => {
            const def = moduleByCode(code);
            const st = moduleState(person, code);
            return `
            <div class="module-row" data-code="${esc(code)}">
              <div class="mr-left">
                <span class="dot dot-${st.color}"></span>
                <span class="module-code">${esc(code)}</span>
                <span class="text-hi">${esc(def.name)}</span>
              </div>
              <div class="flex items-center gap-1">
                ${st.theory !== null && st.theory !== undefined ? `<span class="small" style="color:${st.theory >= THEORY_PASS_THRESHOLD ? "var(--green)" : "var(--red)"}">${st.theory}%</span>` : ""}
                <span class="badge badge-${st.color}">${esc(st.label)}</span>
              </div>
            </div>`;
          }).join("")}
        </div>`;
    }).join("");

    tabEl.querySelectorAll(".module-row").forEach((row) =>
      row.addEventListener("click", () => openModuleDetail(person, row.getAttribute("data-code"), canEdit,
        () => renderProfile(document.getElementById("content"), person.usssId)))
    );
  } else if (activeTab === "history") {
    const entries = [];
    Object.entries(person.modules || {}).forEach(([code, rec]) => {
      (rec.history || []).forEach((h) => entries.push({ code, ...h }));
    });
    entries.sort((a, b) => new Date(b.date) - new Date(a.date));
    tabEl.innerHTML = `<div class="card">
      ${entries.length ? entries.map((h) => `
        <div class="history-item">
          <span><span class="module-code">${esc(h.code)}</span> ${esc(moduleByCode(h.code)?.name || "")} ${h.protocolId ? `· <span class="text-low">${esc(h.protocolId)}</span>` : ""}</span>
          <span>${h.theory !== null && h.theory !== undefined ? `${h.theory}% · ` : ""}<span class="badge ${resultColor(h.result)}">${esc(resultLabel(h.result))}</span> <span class="text-low">${fmtDate(h.date)}</span></span>
        </div>`).join("") : `<div class="empty-state"><h3>Nincs rögzített vizsgatörténet</h3></div>`}
    </div>`;
  } else if (activeTab === "notes") {
    tabEl.innerHTML = `<div class="card"><div class="card-title">Megjegyzések</div><div class="mt-1" style="white-space:pre-wrap; color:var(--text-hi)">${person.notes ? esc(person.notes) : '<span class="text-low">Nincs rögzített megjegyzés.</span>'}</div></div>`;
  }
}

function resultColor(r) {
  if (r === "pass" || r === "Sikeres") return "badge-green";
  if (r === "fail" || r === "Sikertelen") return "badge-red";
  if (r === "waiting") return "badge-yellow";
  return "badge-gray";
}
function resultLabel(r) {
  return { pass: "Sikeres", fail: "Sikertelen", waiting: "Gyakorlatra vár" }[r] || r || "résztvevő";
}
function statusColor(status) {
  const map = { "Aktív": "badge-green", "Újonc": "badge-gold", "Inaktív": "badge-gray", "Felfüggesztett": "badge-red" };
  return map[status] || "badge-gray";
}

export function openModuleDetail(person, code, canEdit, onUpdate) {
  const def = moduleByCode(code);
  const st = moduleState(person, code);
  const rec = (person.modules && person.modules[code]) || {};
  const history = rec.history || [];

  openModal(`
    <div class="modal-head">
      <h3>${esc(code)} — ${esc(def.name)}</h3>
      <button class="modal-close" data-close-modal>×</button>
    </div>
    <div class="flex gap-2 mb-2">
      <div class="card" style="flex:1">
        <div class="card-title">Elmélet</div>
        <div class="card-value" style="font-size:22px">${st.theory !== null && st.theory !== undefined ? st.theory + "%" : "—"}</div>
        ${st.theory !== null && st.theory !== undefined ? `<span class="badge ${st.theory >= THEORY_PASS_THRESHOLD ? "badge-green" : "badge-red"} mt-1">${st.theory >= THEORY_PASS_THRESHOLD ? "Sikeres" : `Sikertelen (<${THEORY_PASS_THRESHOLD}%)`}</span>` : ""}
        ${rec.examiner ? `<div class="small text-low mt-1">Vizsgáztató: ${esc(rec.examiner)}</div>` : ""}
      </div>
      <div class="card" style="flex:1">
        <div class="card-title">Gyakorlat</div>
        <div class="card-value" style="font-size:22px"><span class="badge ${resultColor(st.practical)}">${esc(resultLabel(st.practical) || "—")}</span></div>
        ${rec.practicalExaminer ? `<div class="small text-low mt-1">Vizsgáztató: ${esc(rec.practicalExaminer)}</div>` : ""}
      </div>
    </div>

    ${canEdit && def.theory ? `
    <form id="theory-form" class="mb-2">
      <div class="grid grid-2">
        <div class="field"><label>Elméleti eredmény (%)</label><input type="number" min="0" max="100" id="mf-theory" value="${st.theory ?? ""}" /></div>
        <div class="field"><label>Vizsgáztató</label><input id="mf-examiner" value="${esc(rec.examiner || "A rendszer")}" placeholder="Név" /></div>
      </div>
      <div class="field"><label>Vizsga dátuma</label><input type="date" id="mf-date" value="${esc(rec.theoryDate || "")}" /></div>
      <button type="submit" class="btn btn-sm">Elméleti eredmény mentése</button>
    </form>` : ""}

    ${canEdit && def.practical ? `
    <div class="field">
      <label>Gyakorlati vizsga állapota</label>
      <div class="flex gap-1">
        <button class="btn btn-sm" data-practical="waiting">Gyakorlatra vár</button>
        <button class="btn btn-sm" style="border-color:rgba(78,158,111,.4)" data-practical="pass">Gyakorlat sikeres</button>
        <button class="btn btn-sm" style="border-color:rgba(209,85,74,.4)" data-practical="fail">Gyakorlat sikertelen</button>
      </div>
    </div>` : ""}

    <div class="divider"></div>
    <div class="card-title mb-1">Vizsgatörténet</div>
    ${history.length ? history.map((h, idx) => ({ h, idx })).slice().reverse().map(({ h, idx }) => `
      <div class="history-item"><span>${esc(h.type === "theory" ? "Elméleti" : "Gyakorlati")} próbálkozás ${h.theory !== null && h.theory !== undefined ? `· ${h.theory}%` : ""} ${h.examiner ? `<span class="text-low">· ${esc(h.examiner)}</span>` : ""}</span>
      <span class="flex items-center gap-1"><span class="badge ${resultColor(h.result)}">${esc(resultLabel(h.result))}</span> <span class="text-low">${fmtDate(h.date)}</span>${canEdit ? `<button type="button" class="btn btn-sm btn-danger" data-del-history="${idx}" title="Próbálkozás törlése">×</button>` : ""}</span></div>
    `).join("") : `<div class="text-low small">Nincs korábbi próbálkozás.</div>`}
  `);

  document.querySelectorAll("[data-del-history]").forEach((b) =>
    b.addEventListener("click", () => {
      if (!confirm("Biztosan törli ezt a próbálkozást az előzményből?")) return;
      deleteHistoryEntry(person.usssId, code, Number(b.getAttribute("data-del-history")), actorLabel());
      toast("Próbálkozás törölve");
      closeModal();
      onUpdate && onUpdate();
      const refreshed = getPerson(person.usssId);
      if (refreshed) openModuleDetail(refreshed, code, canEdit, onUpdate);
    })
  );

  document.getElementById("theory-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const val = document.getElementById("mf-theory").value;
    setModuleTheory(person.usssId, code, {
      theory: val === "" ? null : Number(val),
      theoryDate: document.getElementById("mf-date").value,
      examiner: document.getElementById("mf-examiner").value,
    }, actorLabel());
    toast("Elméleti eredmény rögzítve");
    closeModal();
    onUpdate && onUpdate();
  });

  document.querySelectorAll("[data-practical]").forEach((b) =>
    b.addEventListener("click", () => {
      setModulePractical(person.usssId, code, b.getAttribute("data-practical"), actorLabel());
      toast("Gyakorlati vizsgaeredmény rögzítve");
      closeModal();
      onUpdate && onUpdate();
    })
  );
}
