import { getPersonnel, ref, moduleState, moduleByCode } from "../store.js?v=8";
import { hasRole } from "../auth.js?v=8";
import { esc, initials } from "../utils.js?v=8";
import { navigate } from "../router.js?v=8";
import { openModuleDetail } from "./profile.js?v=8";

let filterLevel = "";
let filterModule = "";

export function renderMatrix(container) {
  const canEdit = hasRole("TRAINING");
  const personnel = getPersonnel();

  const allModules = [
    ...ref.LEVEL_MODULE_ORDER["0"].map((c) => ({ code: c, group: "0" })),
    ...ref.LEVEL_MODULE_ORDER["I"].map((c) => ({ code: c, group: "I" })),
    ...ref.LEVEL_MODULE_ORDER["II"].map((c) => ({ code: c, group: "II" })),
    ...ref.LEVEL_MODULE_ORDER["III"].map((c) => ({ code: c, group: "III" })),
    ...ref.LEVEL_MODULE_ORDER["IV"].map((c) => ({ code: c, group: "IV" })),
    ...ref.LEVEL_MODULE_ORDER["V"].map((c) => ({ code: c, group: "V" })),
    ...ref.LEVEL_MODULE_ORDER["SPEC"].map((c) => ({ code: c, group: "SPEC" })),
  ];

  container.innerHTML = `
    <div class="filters">
      <select id="mx-level"><option value="">Minden szint</option>${ref.LEVELS.map((l) => `<option value="${l.id}">${esc(l.label)}</option>`).join("")}<option value="SPEC">Szakirányok</option></select>
      <select id="mx-module"><option value="">Minden modul</option>${allModules.map((m) => `<option value="${m.code}">${m.code} — ${esc(moduleByCode(m.code).name)}</option>`).join("")}</select>
    </div>
    <div class="matrix-wrap">
      <table class="matrix-table" id="matrix-table"></table>
    </div>
    <div class="small text-low mt-2">🔴 Nincs teljesítve · 🟡 Elmélet kész, gyakorlatra vár · 🟢 Teljesítve / sikeres. Kattintson egy cellára a részletekért.</div>
  `;

  document.getElementById("mx-level").value = filterLevel;
  document.getElementById("mx-module").value = filterModule;
  document.getElementById("mx-level").addEventListener("change", (e) => { filterLevel = e.target.value; draw(); });
  document.getElementById("mx-module").addEventListener("change", (e) => { filterModule = e.target.value; draw(); });

  function draw() {
    let mods = allModules;
    if (filterLevel) mods = mods.filter((m) => m.group === filterLevel);
    if (filterModule) mods = mods.filter((m) => m.code === filterModule);
    // de-dupe display columns by code (H/I/J may repeat if no level filter narrows)
    const seen = new Set();
    mods = mods.filter((m) => (seen.has(m.code) ? false : (seen.add(m.code), true)));

    const table = document.getElementById("matrix-table");
    table.innerHTML = `
      <thead><tr>
        <th class="sticky-col">Személy</th>
        ${mods.map((m) => `<th title="${esc(moduleByCode(m.code).name)}">${esc(m.code)}</th>`).join("")}
      </tr></thead>
      <tbody>
        ${personnel.map((p) => `
          <tr>
            <td class="sticky-col row-link" data-nav="/personnel/${esc(p.usssId)}">
              <div class="person-cell">
                <div class="avatar">${p.photo ? `<img src="${esc(p.photo)}"/>` : initials(p.name)}</div>
                <div><div class="person-name">${esc(p.name)}</div><div class="person-sub">${esc(p.usssId)} · ${esc(p.level)}</div></div>
              </div>
            </td>
            ${mods.map((m) => cellHtml(p, m.code)).join("")}
          </tr>`).join("")}
      </tbody>
    `;

    table.querySelectorAll("[data-nav]").forEach((n) => n.addEventListener("click", () => navigate(n.getAttribute("data-nav"))));
    table.querySelectorAll("[data-cell]").forEach((c) =>
      c.addEventListener("click", () => {
        const [usssId, code] = c.getAttribute("data-cell").split("::");
        const person = personnel.find((x) => x.usssId === usssId);
        openModuleDetail(person, code, canEdit, () => renderMatrix(container));
      })
    );
  }

  function cellHtml(person, code) {
    const st = moduleState(person, code);
    const pct = st.theory !== null && st.theory !== undefined ? `${st.theory}%` : "—";
    return `<td class="matrix-cell mc-${st.color}" data-cell="${esc(person.usssId)}::${esc(code)}">
      <span class="mc-pct">${pct}</span>
      <span class="dot dot-${st.color} mc-dot"></span>
    </td>`;
  }

  draw();
}
