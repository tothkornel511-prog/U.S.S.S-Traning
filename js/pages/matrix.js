import { getPersonnel, ref, moduleState, moduleByCode, levelLabel } from "../store.js?v=11";
import { hasRole } from "../auth.js?v=11";
import { esc, initials } from "../utils.js?v=11";
import { navigate } from "../router.js?v=11";
import { openModuleDetail } from "./profile.js?v=11";

let filterLevel = "";
let filterModule = "";

function buildGroups() {
  // Sorrend: 0. szint, majd a szinten kívüli szakirányok külön-külön
  // oszlopcsoportként, aztán I–V. Ez adja a fejléc-csoportosítást.
  const groups = [];
  groups.push({ id: "0", label: `0. ${levelLabel("0")}`, codes: ref.LEVEL_MODULE_ORDER["0"] });
  ref.LEVEL_MODULE_ORDER.SPEC.forEach((code) => {
    const def = moduleByCode(code);
    groups.push({ id: code, label: `${code}. ${def.name}`, codes: [code] });
  });
  ["I", "II", "III", "IV", "V"].forEach((lvl) => {
    groups.push({ id: lvl, label: `${lvl}. ${levelLabel(lvl)}`, codes: ref.LEVEL_MODULE_ORDER[lvl] });
  });
  return groups;
}

export function renderMatrix(container) {
  const canEdit = hasRole("TRAINING");
  const personnel = getPersonnel();
  const allGroups = buildGroups();
  const allModules = [...new Map(allGroups.flatMap((g) => g.codes).map((c) => [c, moduleByCode(c)])).keys()];

  container.innerHTML = `
    <div class="filters">
      <select id="mx-level"><option value="">Minden szint</option>${ref.LEVELS.map((l) => `<option value="${l.id}">${esc(l.label)}</option>`).join("")}${ref.LEVEL_MODULE_ORDER.SPEC.map((c) => `<option value="${c}">${esc(moduleByCode(c).name)}</option>`).join("")}</select>
      <select id="mx-module"><option value="">Minden modul</option>${allModules.map((c) => `<option value="${c}">${c} — ${esc(moduleByCode(c).name)}</option>`).join("")}</select>
    </div>
    <div class="matrix-wrap">
      <table class="matrix-table" id="matrix-table"></table>
    </div>
    <div class="small text-low mt-2">✓ = teljesítve · ✗ = sikertelen / nincs teljesítve · ⏳ = elmélet kész, gyakorlatra vár · ×N = próbálkozások száma. Kattints egy cellára a részletekért.</div>
  `;

  document.getElementById("mx-level").value = filterLevel;
  document.getElementById("mx-module").value = filterModule;
  document.getElementById("mx-level").addEventListener("change", (e) => { filterLevel = e.target.value; draw(); });
  document.getElementById("mx-module").addEventListener("change", (e) => { filterModule = e.target.value; draw(); });

  function draw() {
    let groups = allGroups;
    if (filterLevel) groups = groups.filter((g) => g.id === filterLevel);
    if (filterModule) groups = groups
      .map((g) => ({ ...g, codes: g.codes.filter((c) => c === filterModule) }))
      .filter((g) => g.codes.length);

    const seen = new Set();
    groups = groups.map((g) => ({
      ...g,
      codes: g.codes.filter((c) => (seen.has(c) ? false : (seen.add(c), true))),
    })).filter((g) => g.codes.length);

    const table = document.getElementById("matrix-table");
    table.innerHTML = `
      <thead>
        <tr>
          <th class="sticky-col" rowspan="2">Ügynök</th>
          ${groups.map((g) => `<th colspan="${g.codes.length}" class="mx-group-head">${esc(g.label)}</th>`).join("")}
        </tr>
        <tr>
          ${groups.flatMap((g) => g.codes.map((c) => `<th title="${esc(moduleByCode(c).name)}">${esc(c)}</th>`)).join("")}
        </tr>
      </thead>
      <tbody>
        ${personnel.map((p) => `
          <tr>
            <td class="sticky-col row-link" data-nav="/personnel/${esc(p.usssId)}">
              <div class="person-cell">
                <div class="avatar">${p.photo ? `<img src="${esc(p.photo)}"/>` : initials(p.name)}</div>
                <div><div class="person-name">${esc(p.name)}</div><div class="person-sub">${esc(p.usssId)}</div></div>
              </div>
            </td>
            ${groups.flatMap((g) => g.codes.map((c) => cellHtml(p, c))).join("")}
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
    const rec = (person.modules && person.modules[code]) || null;
    if (!rec || (rec.theory === null || rec.theory === undefined) && !rec.practical) {
      return `<td class="matrix-cell mc-empty" data-cell="${esc(person.usssId)}::${esc(code)}"><span class="matrix-empty">—</span></td>`;
    }
    const pct = st.theory !== null && st.theory !== undefined ? `${st.theory}%` : "—";
    const attempts = (rec.history || []).length;
    const icon = st.color === "green" ? "✓" : st.color === "yellow" ? "⏳" : "✗";
    return `<td class="matrix-cell mc-${st.color}" data-cell="${esc(person.usssId)}::${esc(code)}">
      <span class="mc-icon">${icon}</span>
      <span class="mc-pct">${pct}</span>
      ${attempts > 1 ? `<span class="mc-attempts">×${attempts}</span>` : ""}
    </td>`;
  }

  draw();
}
