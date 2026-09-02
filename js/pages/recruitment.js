import {
  getApplicants, getApplicant, createApplicant, setApplicantStatus, setApplicantNotes,
  deleteApplicant, promoteApplicant, getRecruitmentQuestions, addRecruitmentQuestion,
  removeRecruitmentQuestion, getPositions, getExamQuestions,
} from "../store.js?v=24";
import { hasRole, actorLabel } from "../auth.js?v=20";
import { esc, fmtDateTime, toast, openModal, closeModal } from "../utils.js?v=20";
import { navigate } from "../router.js?v=20";
import { renderExamList } from "./exam.js?v=22";

const STATUS_META = {
  review: { c: "badge-yellow", t: "Elbírálás alatt" },
  accepted: { c: "badge-green", t: "Elfogadva" },
  rejected: { c: "badge-red", t: "Elutasítva" },
};

export function renderRecruitmentList(container) {
  const canEdit = hasRole("TRAINING");
  const applicants = getApplicants();
  const questions = getExamQuestions();
  const applicantQuestions = getRecruitmentQuestions();

  container.innerHTML = `
    <div class="classification-strip">FELVÉTELI ELJÁRÁS · U.S.S.S. TOBORZÁS</div>
    <div class="section-head">
      <h2 style="visibility:hidden">.</h2>
      <div class="actions">${canEdit ? `<button class="btn btn-gold" id="new-applicant">+ Új jelentkező</button>` : ""}</div>
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th>Név</th><th>Beérkezett</th><th>Státusz</th><th>Elbíráló</th><th></th></tr></thead>
      <tbody>
        ${applicants.length ? applicants.map((a) => `
          <tr class="row-link" data-nav="/recruitment/${esc(a.id)}">
            <td class="text-hi">${esc(a.name)}</td>
            <td class="text-low small">${fmtDateTime(a.createdAt)}</td>
            <td><span class="badge ${STATUS_META[a.status]?.c || "badge-gray"}">${esc(STATUS_META[a.status]?.t || a.status)}</span></td>
            <td class="text-low small">${esc(a.decidedBy || "—")}</td>
            <td>${a.promotedTo ? `<span class="badge badge-gold">${esc(a.promotedTo)}</span>` : ""}</td>
          </tr>`).join("") : `<tr><td colspan="5"><div class="empty-state"><h3>Nincs még jelentkező</h3><p>Vegye fel az elsőt a fenti gombbal.</p></div></td></tr>`}
      </tbody>
    </table></div>

    <div class="card mt-2">
      <div class="flex justify-between items-center mb-1">
        <div class="card-title" style="margin:0">U.S.S.S. felvételi vizsgakérdések</div>
        <a class="btn btn-sm" href="#/exam">Vizsgamodul</a>
      </div>
      <p class="text-low small mb-1">A vizsgáztató ezeket a komoly, IC-alapú kérdéseket szóban teszi fel. A jelentkező nem használja a weboldalt.</p>
      ${questions.length ? questions.map((q) => `
        <div class="history-item">
          <span class="module-code">Q${String(q.num).padStart(2, "0")}</span>
          <span>${esc(q.text)}</span>
        </div>`).join("") : `<div class="text-low small">Nincs rögzített kérdés.</div>`}
    </div>
  `;

  container.querySelectorAll("[data-nav]").forEach((n) => n.addEventListener("click", () => navigate(n.getAttribute("data-nav"))));
  document.getElementById("new-applicant")?.addEventListener("click", () => openApplicantForm(applicantQuestions));
  document.getElementById("new-question")?.addEventListener("click", () => openQuestionForm());
  container.querySelectorAll("[data-remove-q]").forEach((b) =>
    b.addEventListener("click", () => {
      if (!confirm("Törli ezt a kérdést a bankból?")) return;
      removeRecruitmentQuestion(b.getAttribute("data-remove-q"), actorLabel());
      toast("Kérdés törölve");
      renderRecruitmentList(document.getElementById("content"));
    })
  );
}

export function renderRecruitmentHub(container) {
  renderRecruitmentList(container);
  const examPanel = document.createElement("section");
  examPanel.className = "mt-2";
  container.appendChild(examPanel);
  renderExamList(examPanel, { includeQuestionBank: false });
}

function openQuestionForm() {
  openModal(`
    <div class="modal-head"><h3>Új felvételi kérdés</h3><button class="modal-close" data-close-modal>×</button></div>
    <form id="question-form">
      <div class="field"><label>Kérdés szövege</label><textarea required id="qf-text" rows="2" autofocus></textarea></div>
      <div class="flex justify-between mt-2">
        <button type="button" class="btn" data-close-modal>Mégse</button>
        <button type="submit" class="btn btn-gold">Mentés</button>
      </div>
    </form>
  `);
  document.getElementById("question-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const text = document.getElementById("qf-text").value.trim();
    if (!text) return;
    addRecruitmentQuestion(text, actorLabel());
    toast("Kérdés hozzáadva");
    closeModal();
    renderRecruitmentList(document.getElementById("content"));
  });
}

function openApplicantForm(questions) {
  openModal(`
    <div class="modal-head"><h3>Új jelentkező felvétele</h3><button class="modal-close" data-close-modal>×</button></div>
    <form id="applicant-form">
      <div class="grid grid-2">
        <div class="field"><label>Név</label><input required id="af-name" autofocus /></div>
        <div class="field"><label>Elérhetőség (opcionális)</label><input id="af-contact" placeholder="Discord, telefonszám…" /></div>
      </div>
      <div class="divider"></div>
      ${questions.map((q, i) => `
        <div class="field">
          <label>${esc(q.text)}</label>
          <textarea id="af-q-${i}" rows="2"></textarea>
        </div>`).join("")}
      <div class="flex justify-between mt-2">
        <button type="button" class="btn" data-close-modal>Mégse</button>
        <button type="submit" class="btn btn-gold">Jelentkezés rögzítése</button>
      </div>
    </form>
  `);
  document.getElementById("applicant-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("af-name").value.trim();
    if (!name) return;
    const answers = questions.map((q, i) => ({
      questionId: q.id, questionText: q.text,
      answer: document.getElementById(`af-q-${i}`).value.trim(),
    }));
    const applicant = createApplicant({
      name, contact: document.getElementById("af-contact").value.trim(), answers,
    }, actorLabel());
    toast("Jelentkező rögzítve");
    closeModal();
    navigate(`/recruitment/${applicant.id}`);
  });
}

export function renderApplicantDetail(container, id) {
  const a = getApplicant(id);
  if (!a) {
    container.innerHTML = `<div class="empty-state"><h3>A jelentkező nem található</h3><a class="btn mt-2" href="#/recruitment">Vissza</a></div>`;
    return;
  }
  const canEdit = hasRole("TRAINING");
  const canAdmin = hasRole("ADMIN");
  const status = STATUS_META[a.status] || { c: "badge-gray", t: a.status };

  container.innerHTML = `
    <a href="#/recruitment" class="text-low small">← Vissza a jelentkezőkhöz</a>
    <div class="card mt-2">
      <div class="flex justify-between items-center mb-2">
        <div>
          <div class="card-title">Jelentkező</div>
          <h2 style="font-size:22px; color: var(--gold-bright)">${esc(a.name)}</h2>
        </div>
        <span class="badge ${status.c}">${esc(status.t)}</span>
      </div>
      <div class="grid grid-2 mb-2">
        <div><div class="card-title">Elérhetőség</div><div class="text-hi">${esc(a.contact || "—")}</div></div>
        <div><div class="card-title">Beérkezett</div><div class="text-hi">${fmtDateTime(a.createdAt)} · ${esc(a.createdBy)}</div></div>
        ${a.decidedBy ? `<div><div class="card-title">Elbírálta</div><div class="text-hi">${esc(a.decidedBy)} · ${fmtDateTime(a.decidedAt)}</div></div>` : ""}
        ${a.promotedTo ? `<div><div class="card-title">Felvéve az állományba</div><a href="#/personnel/${esc(a.promotedTo)}" class="badge badge-gold">${esc(a.promotedTo)}</a></div>` : ""}
      </div>

      ${canEdit ? `
      <div class="flex gap-1 mb-2 flex-wrap">
        <button class="btn btn-sm ${a.status === "review" ? "" : ""}" data-status="review">Elbírálás alatt</button>
        <button class="btn btn-sm btn-result-pass ${a.status === "accepted" ? "active" : ""}" data-status="accepted">Elfogadva</button>
        <button class="btn btn-sm btn-result-fail ${a.status === "rejected" ? "active" : ""}" data-status="rejected">Elutasítva</button>
        <button class="btn btn-sm" id="copy-ai">Másolás AI-értékeléshez</button>
        ${a.status === "accepted" && !a.promotedTo && canAdmin ? `<button class="btn btn-sm btn-gold" id="promote-btn">Felvétel az állományba</button>` : ""}
        ${canAdmin ? `<button class="btn btn-sm btn-danger" id="del-applicant">Törlés</button>` : ""}
      </div>` : ""}

      <div class="divider"></div>
      <div class="card-title mb-1">Válaszok</div>
      ${a.answers.length ? a.answers.map((ans) => `
        <div class="mb-2">
          <div class="small text-low mb-1">${esc(ans.questionText)}</div>
          <div class="text-hi" style="white-space:pre-wrap">${ans.answer ? esc(ans.answer) : '<span class="text-low">— nincs válasz —</span>'}</div>
        </div>`).join("") : `<div class="text-low small">Nincs rögzített válasz.</div>`}

      <div class="divider"></div>
      <div class="card-title mb-1">Megjegyzés (belső)</div>
      ${canEdit ? `
        <textarea id="notes-input" rows="3" style="width:100%; background:var(--bg-base); border:1px solid var(--line-soft); border-radius:var(--radius-sm); color:var(--text-hi); padding:10px;">${esc(a.notes || "")}</textarea>
        <button class="btn btn-sm mt-1" id="save-notes">Megjegyzés mentése</button>
      ` : `<div class="text-mid" style="white-space:pre-wrap">${a.notes ? esc(a.notes) : '<span class="text-low">Nincs megjegyzés.</span>'}</div>`}
    </div>
  `;

  container.querySelectorAll("[data-status]").forEach((b) =>
    b.addEventListener("click", () => {
      setApplicantStatus(a.id, b.getAttribute("data-status"), actorLabel());
      toast("Státusz frissítve");
      renderApplicantDetail(container, a.id);
    })
  );

  document.getElementById("copy-ai")?.addEventListener("click", async () => {
    const text = [
      `U.S.S.S. felvételi jelentkezés — ${a.name}`,
      "",
      ...a.answers.map((ans) => `K: ${ans.questionText}\nV: ${ans.answer || "(nincs válasz)"}`),
      "",
      "Kérlek értékeld röviden ezt a felvételi jelentkezést, és adj ajánlást (elfogadás/elutasítás) indoklással.",
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast("Vágólapra másolva — illeszd be egy AI-beszélgetésbe.");
    } catch {
      toast("A vágólapra másolás nem sikerült (böngésző-jogosultság).", "warn");
    }
  });

  document.getElementById("save-notes")?.addEventListener("click", () => {
    setApplicantNotes(a.id, document.getElementById("notes-input").value, actorLabel());
    toast("Megjegyzés mentve");
  });

  document.getElementById("promote-btn")?.addEventListener("click", () => openPromoteForm(a));

  document.getElementById("del-applicant")?.addEventListener("click", () => {
    if (!confirm(`Biztosan törli ${a.name} jelentkezését?`)) return;
    deleteApplicant(a.id, actorLabel());
    toast("Jelentkező törölve");
    navigate("/recruitment");
  });
}

function openPromoteForm(a) {
  const positions = getPositions();
  openModal(`
    <div class="modal-head"><h3>Felvétel az állományba</h3><button class="modal-close" data-close-modal>×</button></div>
    <form id="promote-form">
      <div class="field"><label>USSS azonosító</label><input required id="pf-usssid" placeholder="USSS-000" autofocus /></div>
      <div class="field"><label>Pozíció</label>
        <select id="pf-position">${positions.map((p) => `<option>${esc(p)}</option>`).join("")}</select>
      </div>
      <p class="text-low small">A rendszer 0. szint (Próbaidős) / Újonc státusszal veszi fel — utána a szokásos módon kezelhető.</p>
      <div class="flex justify-between mt-2">
        <button type="button" class="btn" data-close-modal>Mégse</button>
        <button type="submit" class="btn btn-gold">Felvétel</button>
      </div>
    </form>
  `);
  document.getElementById("promote-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const usssId = document.getElementById("pf-usssid").value.trim();
    if (!usssId) return;
    promoteApplicant(a.id, usssId, document.getElementById("pf-position").value, actorLabel());
    toast(`${a.name} felvéve: ${usssId}`);
    closeModal();
    navigate(`/personnel/${usssId}`);
  });
}
