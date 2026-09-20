/* ==========================================================================
   U.S.S.S. ELITE TRAINING SYSTEM — OKTATÓK
   Modulcsoportonként mutatja, ki oktatja az adott modult, plusz egy
   oktatói nyilvántartás (név, rang, oktatott modulok). Egyetlen adatforrás:
   minden oktatóhoz tartozik egy modulkód-lista (lásd store.js) — a
   modulsoron megjelenő oktató(k) ebből szűrve jelennek meg, úgyhogy a két
   nézet (modulonkénti / oktatónkénti) sosem futhat szét egymástól.
   Alapértelmezetten egyetlen modulhoz sincs oktató hozzárendelve — ezt
   admin/oktatásvezető tölti fel innen. */
import { getInstructors, getInstructor, createInstructor, updateInstructor, deleteInstructor, getInstructorsForModule, moduleByCode, levelLabel } from "../store.js?v=72";
import { hasRole, actorLabel } from "../auth.js?v=23";
import { esc, toast, openModal, closeModal, applyBranding } from "../utils.js?v=31";

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
  { title: "H – Helikopteres képzés", codes: ["H1", "H2"] },
  { title: "I – Éjszakai kiképzés", codes: ["I1", "I2"] },
  { title: "J – Ejtőernyős képzés", codes: ["J1", "J2"] },
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
          <p>Képzési területenként csoportosított modullista — minden modulhoz itt rendelhető hozzá az oktató. Alapértelmezetten egyik modulhoz sincs oktató beállítva.</p>
        </div>
      </div>
      <div class="ins-groups">
        ${GROUP_DEFS.map((g) => renderGroup(g)).join("")}
      </div>
      <div class="section-head mt-2">
        <h2 style="font-size:15px">Oktatói nyilvántartás</h2>
        ${canEdit ? `<button class="btn btn-gold btn-sm" id="new-instructor">+ Új oktató</button>` : ""}
      </div>
      <p class="text-mid small mb-2">Minden oktatóhoz több modul is hozzárendelhető.</p>
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
    const codes = g.codes.filter((c) => moduleByCode(c));
    if (!codes.length) return "";
    return `
      <div class="card ins-group-card">
        <div class="card-title mb-1">${esc(g.title)}</div>
        ${codes.map((code) => {
          const def = moduleByCode(code);
          const names = getInstructorsForModule(code).map((i) => i.name);
          return `
            <div class="ins-module-row">
              <div class="ins-module-info">
                <span class="badge badge-gold" style="font-family:var(--font-mono)">${esc(code)}</span>
                <span class="ins-module-name">${esc(def.name)}</span>
                <span class="text-low small">${esc((def.levels || []).map((l) => levelLabel(l)).join(" / "))}</span>
              </div>
              <div class="ins-module-teacher">
                <span class="${names.length ? "text-gold" : "text-low"} small">${names.length ? esc(names.join(", ")) : "— nincs oktató —"}</span>
                ${canEdit ? `<button class="btn btn-sm" data-assign-module="${esc(code)}">Szerkeszt</button>` : ""}
              </div>
            </div>`;
        }).join("")}
      </div>`;
  }

  function wireActions() {
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
    container.querySelectorAll("[data-assign-module]").forEach((b) =>
      b.addEventListener("click", () => openModuleAssignForm(b.getAttribute("data-assign-module")))
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
              const codes = g.codes.filter((c) => moduleByCode(c));
              if (!codes.length) return "";
              return `
                <div class="card-title mb-1 mt-1">${esc(g.title)}</div>
                ${codes.map((c) => `
                  <label class="section-check-row">
                    <input type="checkbox" class="ins-module-check" value="${esc(c)}" ${selected.has(c) ? "checked" : ""} /> <span>${esc(c)} — ${esc(moduleByCode(c).name)}</span>
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

  function openModuleAssignForm(code) {
    const def = moduleByCode(code);
    const instructors = getInstructors();
    const assigned = new Set(getInstructorsForModule(code).map((i) => i.id));
    openModal(`
      <div class="modal-head"><h3>${esc(code)} — ${esc(def.name)}</h3><button class="modal-close" data-close-modal>×</button></div>
      <p class="text-mid small mb-2">Válaszd ki, mely oktatók tanítják ezt a modult, vagy vegyél fel egy újat.</p>
      <div style="max-height:280px; overflow-y:auto; border:1px solid var(--line-soft); border-radius:var(--radius-sm); padding:10px; margin-bottom:14px;">
        ${instructors.length ? instructors.map((i) => `
          <label class="section-check-row">
            <input type="checkbox" class="ma-instructor-check" value="${esc(i.id)}" ${assigned.has(i.id) ? "checked" : ""} /> <span>${esc(i.name)}${i.rank ? ` — ${esc(i.rank)}` : ""}</span>
          </label>`).join("") : `<p class="text-low small">Még nincs felvéve oktató a nyilvántartásba.</p>`}
      </div>
      <div class="field"><label>+ Új oktató felvétele és hozzárendelése</label><input id="ma-new-name" placeholder="Oktató neve (üresen hagyva kihagyható)" /></div>
      <div class="flex justify-between mt-2">
        <button type="button" class="btn" data-close-modal>Mégse</button>
        <button type="button" class="btn btn-gold" id="ma-save">Mentés</button>
      </div>
    `);

    document.getElementById("ma-save").addEventListener("click", () => {
      const checkedIds = new Set([...document.querySelectorAll(".ma-instructor-check:checked")].map((cb) => cb.value));
      instructors.forEach((i) => {
        const shouldHave = checkedIds.has(i.id);
        const has = (i.modules || []).includes(code);
        if (shouldHave && !has) updateInstructor(i.id, { modules: [...(i.modules || []), code] }, actorLabel());
        if (!shouldHave && has) updateInstructor(i.id, { modules: (i.modules || []).filter((c) => c !== code) }, actorLabel());
      });
      const newName = document.getElementById("ma-new-name").value.trim();
      if (newName) createInstructor({ name: newName, modules: [code] }, actorLabel());
      toast("Modul-hozzárendelés mentve");
      closeModal();
      draw();
    });
  }
}
