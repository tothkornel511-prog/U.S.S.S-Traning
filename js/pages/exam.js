import {
  getExams, getExam, createExam, setExamAnswer, setExamFinalComment, setExamCompetency, setExamRecommendation, interruptExam, finishExam, deleteExam,
  getExamQuestions, getExamCategories, examScoreSummary, EXAM_MAX_SCORE, EXAM_PASS_PCT,
  promoteExamCandidate, getPositions, ref,
} from "../store.js?v=50";
import { hasRole, actorLabel, currentSession } from "../auth.js?v=20";
import { esc, fmtDate, fmtDateTime, toast, openModal, closeModal, sealMark } from "../utils.js?v=22";
import { navigate } from "../router.js?v=20";

const NOTE_TEMPLATES = ["Jó válasz", "Hiányos válasz", "Bizonytalan válasz", "Jó helyzetfelismerés", "Gyenge helyzetfelismerés", "Jó kommunikáció", "Gyenge kommunikáció", "Jó döntés", "Rossz döntés", "Kritikus hiba"];

export function renderExamList(container, { includeQuestionBank = true } = {}) {
  const canEdit = hasRole("TRAINING");
  const exams = getExams();
  const questions = getExamQuestions();

  container.innerHTML = `
    <div class="classification-strip">U.S.S.S. FELVÉTELI VIZSGA · KIZÁRÓLAG OKTATÁSVEZETŐI HASZNÁLATRA</div>
    <p class="text-low small mb-2">Ez a felület a vizsgáztatóé. A jelölt IC-ben, szóban válaszol — a rendszert csak az oktatásvezető kezeli, a jelölt nem lát belőle semmit.</p>
    <div class="section-head">
      <h2 style="visibility:hidden">.</h2>
      <div class="actions">${canEdit ? `<button class="btn btn-gold" id="new-exam">+ Új vizsga</button>` : ""}</div>
    </div>
    <div class="grid grid-3 mb-2">
      <div class="field"><label>Keresés</label><input id="exam-filter" placeholder="Azonosító, jelölt, Discord, vizsgáztató" /></div>
      <div class="field"><label>Eredmény</label><select id="exam-result-filter"><option value="all">Mindegyik</option><option value="active">Folyamatban</option><option value="passed">Sikeres</option><option value="failed">Sikertelen</option></select></div>
      <div class="field"><label>Dátum</label><input id="exam-date-filter" type="date" /></div>
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th>ID</th><th>Jelölt</th><th>Dátum</th><th>Pontszám</th><th>%</th><th>Eredmény</th><th>Vizsgáztató</th></tr></thead>
      <tbody id="exam-rows"></tbody>
    </table></div>
    ${includeQuestionBank ? `<details class="card mt-2" open>
      <summary class="card-title" style="cursor:pointer">U.S.S.S. IC kérdésbank · ${questions.length} kérdés</summary>
      <p class="text-low small mt-1">A kérdéseket a vizsgáztató szóban, IC-ben teszi fel. A jelentkező a weboldalt nem használja.</p>
      ${getExamCategories().map((category) => `
        <div class="section mt-2">
          <div class="card-title mb-1">${esc(category)}</div>
          ${questions.filter((q) => q.category === category).map((q) => `<div class="history-item"><span class="module-code">Q${String(q.num).padStart(2, "0")}</span><span>${esc(q.text)}</span></div>`).join("")}
        </div>
      `).join("")}
    </details>` : ""}
  `;

  container.querySelectorAll("[data-nav]").forEach((n) => n.addEventListener("click", () => navigate(n.getAttribute("data-nav"))));
  document.getElementById("new-exam")?.addEventListener("click", () => openExamStartForm());
  const updateRows = () => {
    const query = document.getElementById("exam-filter").value.trim().toLowerCase();
    const result = document.getElementById("exam-result-filter").value;
    const date = document.getElementById("exam-date-filter").value;
    const filtered = exams.filter((exam) => {
      const searchable = [exam.id, exam.candidateName, exam.candidateDiscord, exam.examinerName].join(" ").toLowerCase();
      const summary = examScoreSummary(exam);
      return (!query || searchable.includes(query)) && (!date || exam.date === date) &&
        (result === "all" || (result === "active" && !exam.endedAt) || (result === "passed" && exam.endedAt && summary.passed) || (result === "failed" && exam.endedAt && !summary.passed));
    });
    document.getElementById("exam-rows").innerHTML = filtered.length ? filtered.map(renderExamRow).join("") : `<tr><td colspan="7"><div class="empty-state"><h3>Nincs találat</h3></div></td></tr>`;
    container.querySelectorAll("[data-nav]").forEach((n) => n.addEventListener("click", () => navigate(n.getAttribute("data-nav"))));
  };
  ["exam-filter", "exam-result-filter", "exam-date-filter"].forEach((id) => document.getElementById(id).addEventListener("input", updateRows));
  updateRows();
}

function renderExamRow(e) {
  const s = examScoreSummary(e);
  return `<tr class="row-link" data-nav="/exam/${esc(e.id)}"><td class="text-gold" style="font-family:var(--font-mono)">${esc(e.id)}</td><td class="text-hi">${esc(e.candidateName)}</td><td class="text-low small">${fmtDate(e.date)}</td><td style="font-family:var(--font-mono)">${s.total} / ${s.max}</td><td style="font-family:var(--font-mono)">${s.pct.toFixed(1)}%</td><td>${e.endedAt ? `<span class="badge ${s.passed ? "badge-green" : "badge-red"}">${s.passed ? "SIKERES" : "SIKERTELEN"}</span>` : `<span class="badge badge-yellow">Folyamatban</span>`}</td><td class="text-low small">${esc(e.examinerName || "—")}</td></tr>`;
}

function openExamStartForm() {
  const session = currentSession();
  openModal(`
    <div class="modal-head"><h3>Új felvételi vizsga indítása</h3><button class="modal-close" data-close-modal>×</button></div>
    <form id="exam-start-form">
      <div class="field"><label>Jelölt neve (IC)</label><input required id="ef-name" autofocus /></div>
      <div class="field"><label>Jelölt Discord neve</label><input id="ef-discord" placeholder="pl. jelolt#0001" /></div>
      <div class="grid grid-2">
        <div class="field"><label>Vizsgáztató / oktatásvezető</label><input id="ef-examiner" value="${esc(session?.name || "")}" /></div>
        <div class="field"><label>Vizsgáztató rangja</label><input id="ef-rank" placeholder="pl. Oktatásvezető" /></div>
      </div>
      <p class="text-low small">A vizsga ${getExamQuestions().length} kérdésből áll, kérdésenként 0–5 pont, összesen ${EXAM_MAX_SCORE} pont. A felvételi minimum ${EXAM_PASS_PCT}%.</p>
      <div class="flex justify-between mt-2">
        <button type="button" class="btn" data-close-modal>Mégse</button>
        <button type="submit" class="btn btn-gold">Vizsga indítása</button>
      </div>
    </form>
  `);
  document.getElementById("exam-start-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const candidateName = document.getElementById("ef-name").value.trim();
    if (!candidateName) return;
    const exam = createExam({
      candidateName,
      candidateDiscord: document.getElementById("ef-discord").value.trim(),
      examinerName: document.getElementById("ef-examiner").value.trim(),
      examinerRank: document.getElementById("ef-rank").value.trim(),
    }, actorLabel());
    toast(`Vizsga elindítva: ${exam.id}`);
    closeModal();
    navigate(`/exam/${exam.id}`);
  });
}

export function renderExamDetail(container, id) {
  const exam = getExam(id);
  if (!exam) {
    container.innerHTML = `<div class="empty-state"><h3>A vizsga nem található</h3><a class="btn mt-2" href="#/exam">Vissza</a></div>`;
    return;
  }
  const canEdit = hasRole("TRAINING");
  const canAdmin = hasRole("ADMIN");
  const questions = getExamQuestions();
  const categories = getExamCategories();
  const summary = examScoreSummary(exam);

  container.innerHTML = `
    <a href="#/exam" class="text-low small">← Vissza a felvételi vizsgákhoz</a>
    <button class="btn btn-sm exam-print-btn" id="print-exam">Nyomtatható vizsgalap</button>
    <div class="classification-strip mt-2">${esc(exam.id)} · CSAK OKTATÁSVEZETŐI HASZNÁLATRA</div>

    <div class="card mt-2 mb-2">
      <div class="flex justify-between items-center mb-2 flex-wrap">
        <div>
          <div class="card-title">Jelölt</div>
          <h2 style="font-size:22px; color: var(--gold-bright)">${esc(exam.candidateName)}</h2>
          <div class="text-low small">${esc(exam.candidateDiscord || "—")}</div>
        </div>
        ${canAdmin ? `<button class="btn btn-sm btn-danger" id="del-exam">Vizsga törlése</button>` : ""}
      </div>
      <div class="grid grid-3 mb-2">
        <div><div class="card-title">Vizsgáztató</div><div class="text-hi">${esc(exam.examinerName || "—")}${exam.examinerRank ? ` · ${esc(exam.examinerRank)}` : ""}</div></div>
        <div><div class="card-title">Dátum</div><div class="text-hi">${fmtDate(exam.date)}</div></div>
        <div><div class="card-title">Kezdés / Befejezés</div><div class="text-hi">${fmtDateTime(exam.startedAt)}${exam.endedAt ? ` → ${fmtDateTime(exam.endedAt)}` : " → folyamatban"}</div></div>
      </div>
      <div id="exam-summary"></div>
      <details class="card mt-1">
        <summary class="card-title" style="cursor:pointer">Vizsgáztatói pontozási standard</summary>
        <div class="grid grid-3 mt-1">
          ${[[5, "Kiváló", "Teljes veszélyfelmérés, helyes prioritás, határozott kommunikáció és arányos döntés."], [4, "Jó", "Szakmailag helyes válasz, legfeljebb egy kisebb hiányossággal."], [3, "Elfogadható", "Érti a helyzet lényegét, de a sorrend, kommunikáció vagy a kivitelezés hiányos."], [2, "Gyenge", "Felismer egy részletet, de a védett személy prioritása vagy az intézkedési terv bizonytalan."], [1, "Nagyon gyenge", "Komoly szakmai hiba, indokolatlan eszkaláció vagy rossz prioritás."], [0, "Elfogadhatatlan", "Figyelmen kívül hagyja a védett személy biztonságát, vagy súlyosan veszélyes döntést ad."]].map(([score, title, text]) => `<div class="exam-category-score"><strong>${score} · ${title}</strong><div class="text-low small">${text}</div></div>`).join("")}
        </div>
      </details>
      ${canEdit && !exam.endedAt ? `<button class="btn btn-sm btn-danger mt-1" id="interrupt-exam">Vizsga megszakítása</button>` : ""}
      ${canEdit && !exam.endedAt ? `<button class="btn btn-gold btn-sm mt-2" id="finish-exam">Vizsga lezárása</button>` : ""}
      ${canEdit && exam.endedAt && summary.passed && !exam.promotedTo ? `<button class="btn btn-gold btn-sm mt-2" id="promote-exam">★ Felvétel az állományba</button>` : ""}
      ${exam.promotedTo ? `<a href="#/personnel/${esc(exam.promotedTo)}" class="badge badge-gold mt-2" style="display:inline-flex">Felvéve · ${esc(exam.promotedTo)} →</a>` : ""}
      ${exam.endedAt && summary.passed ? `<button class="btn btn-sm mt-2" id="print-cert">Tanúsítvány nyomtatása</button>` : ""}
    </div>

    ${categories.map((cat) => `
      <div class="section">
        <div class="section-head"><h2 style="font-size:15px">${esc(cat)}</h2></div>
        ${questions.filter((q) => q.category === cat).map((q) => renderQuestionCard(exam, q, canEdit)).join("")}
      </div>
    `).join("")}

    <div class="card">
      <div class="card-title mb-1">OKTATÁSVEZETŐI ÉRTÉKELÉS</div>
      <p class="text-low small mb-1">Általános benyomás, erősségek, gyengeségek, kommunikáció, helyzetfelismerés, ajánlás.</p>
      ${canEdit ? `
        <textarea id="final-comment" rows="6" style="width:100%; background:var(--bg-base); border:1px solid var(--line-soft); border-radius:var(--radius-sm); color:var(--text-hi); padding:12px;">${esc(exam.finalComment || "")}</textarea>
        <button class="btn btn-sm mt-1" id="save-final-comment">Értékelés mentése</button>
      ` : `<div class="text-mid" style="white-space:pre-wrap">${exam.finalComment ? esc(exam.finalComment) : '<span class="text-low">Nincs rögzített értékelés.</span>'}</div>`}
    </div>
  `;

  renderSummaryBar(exam);
  document.getElementById("print-exam")?.addEventListener("click", () => window.print());

  container.querySelectorAll("[data-score-q]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const qid = btn.getAttribute("data-score-q");
      const score = Number(btn.getAttribute("data-score-val"));
      setExamAnswer(exam.id, qid, { score }, actorLabel());
      container.querySelectorAll(`[data-score-q="${qid}"]`).forEach((b) =>
        b.classList.toggle("active", b === btn)
      );
      renderSummaryBar(getExam(exam.id));
    })
  );

  container.querySelectorAll("[data-note-q]").forEach((ta) =>
    ta.addEventListener("blur", () => {
      setExamAnswer(exam.id, ta.getAttribute("data-note-q"), { note: ta.value });
    })
  );
  container.querySelectorAll("[data-note-template]").forEach((button) => button.addEventListener("click", () => {
    const questionId = button.getAttribute("data-note-target");
    const textarea = container.querySelector(`[data-note-q="${questionId}"]`);
    const text = button.getAttribute("data-note-template");
    textarea.value = textarea.value.trim() ? `${textarea.value.trim()} · ${text}` : text;
    setExamAnswer(exam.id, questionId, { note: textarea.value }, actorLabel());
  }));

  container.querySelectorAll("[data-critical-q]").forEach((box) => box.addEventListener("change", () => {
    setExamAnswer(exam.id, box.getAttribute("data-critical-q"), { critical: box.checked }, actorLabel());
    renderSummaryBar(getExam(exam.id));
  }));
  container.querySelectorAll("[data-competency]").forEach((select) => select.addEventListener("change", () => setExamCompetency(exam.id, select.getAttribute("data-competency"), select.value)));
  document.getElementById("exam-recommendation")?.addEventListener("change", (event) => setExamRecommendation(exam.id, event.target.value));

  document.getElementById("finish-exam")?.addEventListener("click", () => {
    if (!confirm("Lezárja a vizsgát? A pontszámok utána is módosíthatók maradnak.")) return;
    finishExam(exam.id, actorLabel());
    toast("Vizsga lezárva");
    renderExamDetail(container, exam.id);
  });

  document.getElementById("interrupt-exam")?.addEventListener("click", () => {
    const reason = prompt("A megszakítás indoka:", "");
    if (!reason?.trim()) return;
    interruptExam(exam.id, reason.trim(), actorLabel());
    toast("Vizsga megszakítva");
    renderExamDetail(container, exam.id);
  });

  document.getElementById("promote-exam")?.addEventListener("click", () => openPromoteForm(exam, container));
  document.getElementById("print-cert")?.addEventListener("click", () => printCertificate(exam, summary));

  document.getElementById("save-final-comment")?.addEventListener("click", () => {
    setExamFinalComment(exam.id, document.getElementById("final-comment").value);
    toast("Értékelés mentve");
  });

  document.getElementById("del-exam")?.addEventListener("click", () => {
    if (!confirm(`Biztosan törli ${exam.candidateName} vizsgáját? Ez nem vonható vissza.`)) return;
    deleteExam(exam.id, actorLabel());
    toast("Vizsga törölve");
    navigate("/exam");
  });
}

function openPromoteForm(exam, container) {
  const positions = getPositions();
  openModal(`
    <div class="modal-head"><h3>Felvétel az állományba</h3><button class="modal-close" data-close-modal>×</button></div>
    <p class="text-low small mb-2">A(z) ${esc(exam.id)} vizsgát sikeresen teljesítő jelöltből új személyi profil jön létre, 0. szinten, próbaidős státuszban.</p>
    <form id="promote-form">
      <div class="grid grid-2">
        <div class="field"><label>Teljes név</label><input required id="pf-name" value="${esc(exam.candidateName)}" /></div>
        <div class="field"><label>USSS azonosító</label><input required id="pf-id" placeholder="USSS-000" autofocus /></div>
        <div class="field"><label>Pozíció</label><select id="pf-position">${positions.map((p) => `<option value="${esc(p)}">${esc(p)}</option>`).join("")}</select></div>
        <div class="field"><label>Próbaidő kezdete</label><input type="date" id="pf-prob" value="${new Date().toISOString().slice(0, 10)}" /></div>
      </div>
      <div class="flex justify-between mt-2">
        <button type="button" class="btn" data-close-modal>Mégse</button>
        <button type="submit" class="btn btn-gold">Felvétel</button>
      </div>
    </form>
  `);
  document.getElementById("promote-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const usssId = document.getElementById("pf-id").value.trim();
    if (!usssId) return;
    promoteExamCandidate(exam.id, {
      usssId,
      name: document.getElementById("pf-name").value.trim(),
      position: document.getElementById("pf-position").value,
      status: ref.SERVICE_STATUSES[0],
      level: "0",
      probationStart: document.getElementById("pf-prob").value,
    }, actorLabel());
    toast(`${usssId} felvéve az állományba`);
    closeModal();
    renderExamDetail(container, exam.id);
  });
}

function renderQuestionCard(exam, q, canEdit) {
  const a = (exam.answers || []).find((x) => x.questionId === q.id) || { score: null, note: "", critical: false };
  return `
    <div class="exam-q-card">
      <div class="exam-q-head">
        <span class="module-code">Q${String(q.num).padStart(2, "0")}</span>
        <span class="text-hi">${esc(q.text)}</span>
      </div>
      <div class="exam-q-tips">
        <div class="small text-low mb-1">Elfogadhatósági támpont:</div>
        <ul class="exam-tip-list">${q.tips.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
        ${q.watch ? `<div class="exam-q-watch">Mit figyeljek? ${esc(q.watch)}</div>` : ""}
      </div>
      ${canEdit ? `
        <div class="exam-score-row">
          ${[0, 1, 2, 3, 4, 5].map((n) => `<button type="button" class="exam-score-btn ${a.score === n ? "active" : ""}" data-score-q="${esc(q.id)}" data-score-val="${n}">${n}</button>`).join("")}
        </div>
        <textarea class="exam-note" rows="2" placeholder="Vizsgáztatói megjegyzés (opcionális)" data-note-q="${esc(q.id)}">${esc(a.note || "")}</textarea>
        <div class="exam-note-templates">${NOTE_TEMPLATES.map((template) => `<button type="button" class="note-template" data-note-template="${esc(template)}" data-note-target="${esc(q.id)}">${esc(template)}</button>`).join("")}</div>
        <label class="small text-low"><input type="checkbox" data-critical-q="${esc(q.id)}" ${a.critical ? "checked" : ""} /> Kritikus hiba</label>
      ` : `
        <div class="exam-score-row"><span class="badge badge-gold">${a.score === null ? "—" : a.score + " / 5"}</span></div>
        ${a.note ? `<div class="text-low small">${esc(a.note)}</div>` : ""}
      `}
      <div class="grid grid-3 mt-2">
        ${["Kommunikáció", "Döntéshozatal", "Fegyelem", "Helyzetfelismerés", "Védett személy kezelése", "Stresszhelyzet kezelése", "Csapatmunka"].map((name) => `<label class="field"><span>${name}</span><select data-competency="${esc(name)}" ${canEdit && !exam.endedAt ? "" : "disabled"}><option value="">— / 5</option>${[1, 2, 3, 4, 5].map((n) => `<option value="${n}" ${exam.competencies?.[name] === n ? "selected" : ""}>${n} / 5</option>`).join("")}</select></label>`).join("")}
      </div>
      <label class="field mt-1"><span>FELVÉTELI AJÁNLÁS</span><select id="exam-recommendation" ${canEdit && !exam.endedAt ? "" : "disabled"}><option value="">Nincs kiválasztva</option>${[["recommended", "Felvételre ajánlott"], ["conditional", "Feltételesen ajánlott"], ["rejected", "Nem ajánlott"], ["retest", "Újravizsga javasolt"]].map(([value, label]) => `<option value="${value}" ${exam.recommendation === value ? "selected" : ""}>${label}</option>`).join("")}</select></label>
    </div>
  `;
}

function renderSummaryBar(exam) {
  const el = document.getElementById("exam-summary");
  if (!el) return;
  const s = examScoreSummary(exam);
  el.innerHTML = `
    <div class="exam-summary-bar">
      <div><span class="card-title">Pontszám</span><div class="card-value" style="font-size:22px">${s.total} / ${s.max}</div></div>
      <div><span class="card-title">Teljesítmény</span><div class="card-value" style="font-size:22px">${s.pct.toFixed(1)}%</div></div>
      <div><span class="card-title">Megválaszolva</span><div class="card-value" style="font-size:22px">${s.answered} / ${s.totalQuestions}</div></div>
      <div><span class="card-title">Eredmény</span><div class="mt-1"><span class="badge ${s.passed ? "badge-green" : "badge-red"}" style="font-size:13px">${s.passed ? "SIKERES" : "SIKERTELEN"}</span> <span class="text-low small">${esc(s.tier)}</span></div></div>
      <div><span class="card-title">Kritikus hibák</span><div class="card-value" style="font-size:22px">${s.criticalErrors}</div></div>
    </div>
    <div class="grid grid-3 mt-1">
      ${s.categories.map((cat) => `<div class="exam-category-score"><div class="card-title">${esc(cat.category)}</div><strong>${cat.total} / ${cat.max}</strong><span class="text-low small">${cat.max ? ((cat.total / cat.max) * 100).toFixed(0) : 0}%</span></div>`).join("")}
    </div>
  `;
}

function printCertificate(exam, summary) {
  let root = document.getElementById("cert-print-root");
  if (!root) {
    root = document.createElement("div");
    root.id = "cert-print-root";
    document.body.appendChild(root);
  }
  const today = fmtDate(new Date().toISOString());
  root.innerHTML = `
    <div class="cert-page">
      <div class="cert-seal">${sealMark(150)}</div>
      <div class="cert-org">U.S.S.S. · ELIT VÉDELMI SZOLGÁLAT</div>
      <h1 class="cert-title">Felvételi Tanúsítvány</h1>
      <p class="cert-lede">Ezennel igazoljuk, hogy</p>
      <div class="cert-name">${esc(exam.candidateName)}</div>
      <p class="cert-lede">sikeresen teljesítette az U.S.S.S. felvételi vizsgáját, és alkalmasnak bizonyult a szolgálatra.</p>
      <div class="cert-stats">
        <div><span>Vizsgaazonosító</span><strong>${esc(exam.id)}</strong></div>
        <div><span>Vizsga dátuma</span><strong>${fmtDate(exam.date)}</strong></div>
        <div><span>Eredmény</span><strong>${summary.total} / ${summary.max} pont · ${summary.pct.toFixed(1)}%</strong></div>
        <div><span>Minősítés</span><strong>${esc(summary.tier)}</strong></div>
      </div>
      <div class="cert-sign">
        <div class="cert-sign-block">
          <div class="cert-sign-line">${esc(exam.examinerName || "—")}${exam.examinerRank ? ` · ${esc(exam.examinerRank)}` : ""}</div>
          <div class="cert-sign-label">Vizsgáztató</div>
        </div>
        <div class="cert-sign-block">
          <div class="cert-sign-line">${today}</div>
          <div class="cert-sign-label">Kiállítás dátuma</div>
        </div>
      </div>
    </div>
  `;
  document.body.classList.add("printing-cert");
  const cleanup = () => document.body.classList.remove("printing-cert");
  window.addEventListener("afterprint", cleanup, { once: true });
  window.print();
  setTimeout(cleanup, 2000);
}
