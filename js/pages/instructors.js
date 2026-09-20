/* ==========================================================================
   U.S.S.S. ELITE TRAINING SYSTEM — OKTATÓK
   Modulcsoportonként EGY oktató-mező soronként (szabad szöveg — lehet
   konkrét név, VAGY szerepkör-jellegű megnevezés, pl. "Mindenkori LSNTA
   vezető"), plusz egy külön oktatói nyilvántartás (név, rang, oktatott
   modulok, jelölőnégyzetekkel). A két nézet szándékosan nem szinkronizált
   automatikusan (lásd store.js) — a modulmezőnél a nyilvántartásban lévő
   nevek csak javaslatként (datalist) jelennek meg, de bármi más szöveg is
   beírható. Alapértelmezetten egyik sorhoz sincs semmi beállítva.

   A H / I / J modulokat a rendszer belül két külön vizsgaként tartja
   nyilván (alap: H1/I1/J1, emelt: H2/I2/J2 — lásd data.js), de az eredeti
   képzési dokumentum ezeket EGY modulként kezeli, két követelményszinttel.
   Itt ezért egy közös, virtuális kulccsal (H/I/J) jelenik meg egyetlen
   sorként, egyetlen oktató-mezővel — a két szint csak jegyzetként szerepel
   alatta, ahogy az eredeti dokumentumban is. */
import { getModuleInstructor, setModuleInstructor, getInstructors, getInstructor, createInstructor, updateInstructor, deleteInstructor, moduleByCode, levelLabel } from "../store.js?v=73";
import { hasRole, actorLabel } from "../auth.js?v=23";
import { esc, toast, openModal, closeModal, applyBranding } from "../utils.js?v=31";

const MERGES = {
  H: { key: "H", codes: ["H1", "H2"], name: "Helikopter pilóta képzés", note: "IV. szint – Operátor: Alap / standard követelmények · V. szint – Elit / Parancsnok: Emelt követelmények" },
  I: { key: "I", codes: ["I1", "I2"], name: "Kiképzés az éj leple alatt", note: "III. szint – Őrszem: Alap követelmények · V. szint – Elit / Parancsnok: Emelt követelmények" },
  J: { key: "J", codes: ["J1", "J2"], name: "Ejtőernyős vizsga követelményei", note: "IV. szint – Operátor: Alap követelmények · V. szint – Elit / Parancsnok: Emelt követelmények" },
};

/* Modulcsoportok a képzési terület szerint (nem a szint szerint — lásd
   matrix.js azt a nézetet). A kódok a data.js valós modulkódjai. */
const GROUP_DEFS = [
  { title: "0 – Alapozás", codes: ["0"] },
  { title: "A – Alapvető ismeretek", codes: ["A"] },
  { title: "B – Kormányzati járművezetés", codes: ["B1", "B2"] },
  { title: "C – Konvoj közlekedés", codes: ["C"] },
  { title: "D – Taktikai kiképzés", codes: ["D"] },
  { title: "E – Egészségügyi oktatás", codes: ["E"] },
  { title: "F – Lőfegyveres képzés", codes: ["F", "F1", "F2", "F3"] },
  { title: "G – Erőnléti és közelharci képzés", codes: ["G1", "G1H", "G2", "G2H", "G3"] },
  { title: "H – Helikopteres képzés", merge: MERGES.H },
  { title: "I – Éjszakai kiképzés", merge: MERGES.I },
  { title: "J – Ejtőernyős képzés", merge: MERGES.J },
  { title: "K – Kommunikáció", codes: ["K"] },
  { title: "L – Kódhasználat", codes: ["L"] },
  { title: "M – Együttműködés más szervezetekkel", codes: ["M"] },
  { title: "N – Jogi és kényszerítő eszközök", codes: ["N"] },
  { title: "O – Advance és rendezvénybiztosítás", codes: ["O"] },
  { title: "P – Titoktartás és információvédelem", codes: ["P"] },
  { title: "R – Szolgálati rend és dokumentáció", codes: ["R"] },
  { title: "S – Vízi műveletek", codes: ["S1", "S2"] },
  { title: "T – Tűzszerész képzés", codes: ["T1", "T2"] },
  { title: "Szinten kívüli szakirányok", codes: ["ADM", "LSNTA"] },
];

const INSTRUCTOR_OPTIONS_ID = "ins-name-options";

/* Egy csoport sorai — egy elem = { key, name, note? or levelText? }. A
   H/I/J csoportnál egyetlen (összevont) elemet ad vissza, a többinél
   modulonként egyet. */
function groupEntries(g) {
  if (g.merge) {
    const m = g.merge;
    if (!m.codes.every((c) => moduleByCode(c))) return [];
    return [{ key: m.key, name: m.name, note: m.note }];
  }
  return g.codes.filter((c) => moduleByCode(c)).map((code) => {
    const def = moduleByCode(code);
    return { key: code, name: def.name, levelText: (def.levels || []).map((l) => levelLabel(l)).join(" / ") };
  });
}

export function renderInstructors(container) {
  const canEdit = hasRole("TRAINING");
  draw();

  function draw() {
    const instructors = getInstructors();
    container.innerHTML = `
      <div class="page-banner page-banner-training">
        <div class="page-banner-body">
          <div class="eyebrow">ÁLLOMÁNY & KÉPZÉS</div>
          <h2>Oktatók</h2>
          <p>Képzési területenként csoportosított modullista — minden sorhoz egy oktató adható meg: válassz a nyilvántartásból, vagy írj be bármilyen szöveget (pl. "Mindenkori LSNTA vezető"). Alapértelmezetten egyik sorhoz sincs oktató beállítva.</p>
        </div>
      </div>
      <datalist id="${INSTRUCTOR_OPTIONS_ID}">
        ${instructors.map((i) => `<option value="${esc(i.name)}"></option>`).join("")}
      </datalist>
      <div class="ins-groups">
        ${GROUP_DEFS.map((g) => renderGroup(g)).join("")}
      </div>
      <div class="section-head mt-2">
        <h2 style="font-size:15px">Oktatói nyilvántartás</h2>
        ${canEdit ? `<button class="btn btn-gold btn-sm" id="new-instructor">+ Új oktató</button>` : ""}
      </div>
      <p class="text-mid small mb-2">Minden oktatóhoz több modul is hozzárendelhető — ez a lista csak áttekintésre szolgál, a fenti sorokat külön-külön kell kitölteni.</p>
      <div class="table-wrap"><table>
        <thead><tr><th>Oktató neve</th><th>Rang / beosztás</th><th>Oktatott modulok</th>${canEdit ? "<th></th>" : ""}</tr></thead>
        <tbody>
          ${instructors.length ? instructors.map((i) => `
            <tr>
              <td>${esc(i.name)}</td>
              <td>${esc(i.rank) || `<span class="text-low">—</span>`}</td>
              <td>${(i.modules || []).length
                ? `<div class="ins-chip-row">${i.modules.map((c) => `<span class="badge badge-gray">${esc(c)}</span>`).join("")}</div>`
                : `<span class="text-low small">Nincs modul hozzárendelve</span>`}</td>
              ${canEdit ? `<td><div class="flex gap-1"><button class="btn btn-sm" data-edit-ins="${esc(i.id)}">Szerkeszt</button><button class="btn btn-sm btn-danger" data-del-ins="${esc(i.id)}">Törlés</button></div></td>` : ""}
            </tr>`).join("") : `<tr><td colspan="${canEdit ? 4 : 3}"><div class="empty-state"><h3>Nincs még felvéve oktató</h3><p>Add hozzá az elsőt a fenti gombbal.</p></div></td></tr>`}
        </tbody>
      </table></div>
    `;

    applyBranding(container.querySelector(".page-banner-training"), "hero-training");
    wireActions();
  }

  function renderGroup(g) {
    const entries = groupEntries(g);
    if (!entries.length) return "";
    return `
      <div class="card ins-group-card">
        <div class="card-title mb-1">${esc(g.title)}</div>
        ${entries.map((entry) => {
          const current = getModuleInstructor(entry.key);
          return `
            <div class="ins-module-row">
              <div class="ins-module-info">
                <span class="badge badge-gold" style="font-family:var(--font-mono)">${esc(entry.key)}</span>
                <span class="ins-module-name">${esc(entry.name)}</span>
                ${entry.note ? `<span class="ins-module-note">${esc(entry.note)}</span>` : `<span class="text-low small">${esc(entry.levelText)}</span>`}
              </div>
              <div class="ins-module-teacher">
                <label class="ins-module-label" for="ins-input-${esc(entry.key)}">Oktató</label>
                <input
                  id="ins-input-${esc(entry.key)}"
                  class="ins-module-input"
                  data-code="${esc(entry.key)}"
                  list="${INSTRUCTOR_OPTIONS_ID}"
                  placeholder="— nincs megadva —"
                  value="${esc(current)}"
                  ${canEdit ? "" : "disabled"}
                />
              </div>
            </div>`;
        }).join("")}
      </div>`;
  }

  function wireActions() {
    if (canEdit) {
      container.querySelectorAll(".ins-module-input").forEach((input) => {
        input.addEventListener("change", () => {
          setModuleInstructor(input.getAttribute("data-code"), input.value, actorLabel());
          toast("Mentve");
        });
      });
    }
    document.getElementById("new-instructor")?.addEventListener("click", () => openInstructorForm());
    container.querySelectorAll("[data-edit-ins]").forEach((b) =>
      b.addEventListener("click", () => openInstructorForm(getInstructor(b.getAttribute("data-edit-ins"))))
    );
    container.querySelectorAll("[data-del-ins]").forEach((b) =>
      b.addEventListener("click", () => {
        const instructor = getInstructor(b.getAttribute("data-del-ins"));
        if (!confirm(`Biztosan törli "${instructor?.name}" oktatót a nyilvántartásból?`)) return;
        deleteInstructor(b.getAttribute("data-del-ins"), actorLabel());
        toast("Oktató törölve");
        draw();
      })
    );
  }

  function openInstructorForm(existing) {
    const isNew = !existing;
    const selected = new Set(existing?.modules || []);
    openModal(`
      <div class="modal-head"><h3>${isNew ? "Új oktató" : "Oktató szerkesztése"}</h3><button class="modal-close" data-close-modal>×</button></div>
      <form id="ins-form">
        <div class="field"><label>Oktató neve</label><input id="ins-name" required autofocus value="${esc(existing?.name || "")}" /></div>
        <div class="field"><label>Rang / beosztás</label><input id="ins-rank" value="${esc(existing?.rank || "")}" /></div>
        <div style="margin-bottom:18px;">
          <div class="section-check-label">Oktatott modulok</div>
          <div class="flex gap-1 mb-1"><button type="button" class="btn btn-sm" id="ins-select-all">Mind kijelöl</button><button type="button" class="btn btn-sm" id="ins-select-none">Mind töröl</button></div>
          <div style="max-height:280px; overflow-y:auto; border:1px solid var(--line-soft); border-radius:var(--radius-sm); padding:10px;">
            ${GROUP_DEFS.map((g) => {
              const entries = groupEntries(g);
              if (!entries.length) return "";
              return `
                <div class="card-title mb-1 mt-1">${esc(g.title)}</div>
                ${entries.map((entry) => `
                  <label class="section-check-row">
                    <input type="checkbox" class="ins-module-check" value="${esc(entry.key)}" ${selected.has(entry.key) ? "checked" : ""} /> <span>${esc(entry.key)} — ${esc(entry.name)}</span>
                  </label>`).join("")}
              `;
            }).join("")}
          </div>
        </div>
        <div class="flex justify-between mt-2">
          <button type="button" class="btn" data-close-modal>Mégse</button>
          <button type="submit" class="btn btn-gold">Mentés</button>
        </div>
      </form>
    `);

    document.getElementById("ins-select-all").addEventListener("click", () => {
      document.querySelectorAll(".ins-module-check").forEach((cb) => { cb.checked = true; });
    });
    document.getElementById("ins-select-none").addEventListener("click", () => {
      document.querySelectorAll(".ins-module-check").forEach((cb) => { cb.checked = false; });
    });

    document.getElementById("ins-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const name = document.getElementById("ins-name").value.trim();
      if (!name) return toast("Adjon meg egy nevet.", "warn");
      const rank = document.getElementById("ins-rank").value.trim();
      const modules = [...document.querySelectorAll(".ins-module-check:checked")].map((cb) => cb.value);
      const saved = isNew
        ? createInstructor({ name, rank, modules }, actorLabel())
        : updateInstructor(existing.id, { name, rank, modules }, actorLabel());
      if (!saved) return toast("Nem sikerült menteni.", "warn");
      toast(isNew ? "Oktató felvéve" : "Oktató módosítva");
      closeModal();
      draw();
    });
  }
}
