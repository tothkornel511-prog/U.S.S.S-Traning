/* ==========================================================================
   U.S.S.S. ELITE TRAINING SYSTEM — ADATKEZELÉSI RÉTEG
   Ez a réteg teljesen el van választva a UI-tól. Jelenleg localStorage-t
   használ, de az API úgy lett tervezve, hogy később könnyen lecserélhető
   legyen egy valódi backend/database hívásra (minden függvény szinkron,
   de a hívási felület kompatibilis egy async átalakítással).
   ========================================================================== */

import {
  LEVELS, SERVICE_STATUSES, POSITIONS, MODULES, LEVEL_MODULE_ORDER,
  PERSONNEL, ACCESS_CODES, PROTECTED_LOCATIONS, AUDIT_LOG_SEED, MAPS, DISTRICTS,
  RECRUITMENT_QUESTIONS, EXAM_QUESTIONS, EXAM_CATEGORIES,
} from "./data.js?v=24";

/* v7: Roxwood/Cayo Perico eltávolítva, csak Los Santos térkép maradt. */
const NS = "usss_ets_v7_";
const KEYS = {
  personnel: NS + "personnel",
  accessCodes: NS + "access_codes",
  locations: NS + "locations",
  districts: NS + "districts",
  positions: NS + "positions",
  protocols: NS + "protocols",
  auditLog: NS + "audit_log",
  seeded: NS + "seeded",
  nextProtocol: NS + "next_protocol_seq",
  recruitmentQuestions: NS + "recruitment_questions",
  applicants: NS + "applicants",
  exams: NS + "exams",
  nextExamSeq: NS + "next_exam_seq",
  operations: NS + "operations",
  readiness: NS + "readiness",
  investigations: NS + "investigations",
  nextInvestigationSeq: NS + "next_investigation_seq",
  investigationCategories: NS + "investigation_categories",
  covertOps: NS + "covert_ops",
  nextCovertOpSeq: NS + "next_covert_op_seq",
  covertOpClassifications: NS + "covert_op_classifications",
};

/* Elméleti vizsgánál ez alatt a százalék alatt a modul nem számít teljesítettnek. */
export const THEORY_PASS_THRESHOLD = 80;

/* Egyéni CSS — admin a böngészőből finomíthatja a design-t kód/push nélkül.
   Szándékosan a névtér-verzión kívüli, fix kulcs, hogy egy jövőbeli reset
   vagy verzióváltás se törölje a beállított stílust. */
const CUSTOM_CSS_KEY = "usss_ets_custom_css";
export function getCustomCss() {
  return localStorage.getItem(CUSTOM_CSS_KEY) || "";
}
export function setCustomCss(css, actorLabel) {
  try {
    localStorage.setItem(CUSTOM_CSS_KEY, css || "");
    logAudit(actorLabel, "Egyéni CSS frissítve", `${(css || "").length} karakter`);
    return true;
  } catch (e) {
    console.error("Custom CSS write error", e);
    return false;
  }
}

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.error("Store read error", key, e);
    return fallback;
  }
}
function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error("Store write error", key, e);
    return false;
  }
}

function uid(prefix) {
  return prefix + "-" + Math.random().toString(36).slice(2, 8).toUpperCase();
}

/* ---------- Seed / init ---------------------------------------------- */
function seedPersonnel() {
  return PERSONNEL.map((p) => ({
    ...p,
    photo: "",
    probationStart: p.level === "0" ? "2026-08-17" : "",
    probationLifted: false,
    notes: "",
    modules: {}, // code -> { theory: number|null, theoryDate, examiner, practical: 'waiting'|'pass'|'fail', history: [] }
    levelUpEligible: false,
    createdAt: new Date().toISOString(),
  }));
}

export function seedIfNeeded() {
  if (!read(KEYS.seeded, false)) {
    write(KEYS.personnel, seedPersonnel());
    write(KEYS.accessCodes, ACCESS_CODES);
    write(KEYS.locations, PROTECTED_LOCATIONS);
    write(KEYS.districts, DISTRICTS);
    write(KEYS.positions, POSITIONS.flatMap((g) => g.items.map((name) => ({ group: g.group, name }))));
    write(KEYS.protocols, []);
    write(KEYS.auditLog, AUDIT_LOG_SEED);
    write(KEYS.nextProtocol, 1);
    write(KEYS.recruitmentQuestions, RECRUITMENT_QUESTIONS);
    write(KEYS.applicants, []);
    write(KEYS.seeded, true);
  }
  applyPositionPatch();
  applyHijSplitPatch();
  applyTheoryFillPatch();
  applyRecruitmentSeedPatch();
  applyLocationIdFixPatch();
  applyCommandCenterSeedPatch();
  applyGovernmentHierarchySeedPatch();
  applyCommandCenterCatalogSeedPatch();
  applyProtecteeScopePatch();
  applyInvestigationSeedPatch();
}

/* Célzott, egyszeri pozíció-javítás — csak a felsorolt személyek "position"
   mezőjét írja át, mindent mást (vizsgaeredményeket, próbálkozásokat stb.)
   érintetlenül hagy. Nem igényel teljes resetet. */
const POSITION_PATCH_KEY = NS + "position_patch_2026_08_17a";
const POSITION_PATCHES = {
  "USSS-004": "President",
  "USSS-80": "Secretary of Development",
  "USSS-98": "Secretary of Homeland Security",
  "USSS-109": "Secretary of Health",
  "USSS-96": "U.S.S.S Director",
  "USSS-50": "Lawyer",
  "USSS-119": "U.S.S.S Agent",
};
function applyPositionPatch() {
  if (read(POSITION_PATCH_KEY, false)) return;
  const list = getPersonnel();
  let changed = false;
  Object.entries(POSITION_PATCHES).forEach(([usssId, position]) => {
    const p = list.find((x) => x.usssId === usssId);
    if (p && p.position !== position) { p.position = position; changed = true; }
  });
  if (changed) savePersonnel(list);
  write(POSITION_PATCH_KEY, true);
}

/* Célzott, egyszeri migráció: a H/I/J modulok mostantól szintenként külön
   kódot kapnak (H1/H2, I1/I2, J1/J2), mert az alap és az "ismételt" emelt
   szintű változat innentől külön nyomon követett vizsga. A korábban a közös
   H/I/J kód alatt rögzített eredményeket átmásolja az alapszintű (…1) kódra,
   hogy semmi ne vesszen el — a modul tartalma és minden más adat változatlan. */
const HIJ_SPLIT_PATCH_KEY = NS + "hij_split_patch_2026_08_17a";
function applyHijSplitPatch() {
  if (read(HIJ_SPLIT_PATCH_KEY, false)) return;
  const list = getPersonnel();
  let changed = false;
  list.forEach((p) => {
    if (!p.modules) return;
    [["H", "H1"], ["I", "I1"], ["J", "J1"]].forEach(([oldCode, newCode]) => {
      if (p.modules[oldCode] && !p.modules[newCode]) {
        p.modules[newCode] = p.modules[oldCode];
        delete p.modules[oldCode];
        changed = true;
      }
    });
  });
  if (changed) savePersonnel(list);
  write(HIJ_SPLIT_PATCH_KEY, true);
}

/* Célzott, egyszeri feltöltés: mindenkinek, akinek MÉG NINCS elméleti
   eredménye a "0" (Belépés, betanulás és bázisrend) modulra — vagyis a
   jelenlegi szintjükhöz tartozó modulra —, rögzít egy minta-eredményt.
   Akinek már van bármilyen adata ezen a modulon, azt nem érinti. */
const THEORY_FILL_PATCH_KEY = NS + "theory_fill_0_2026_08_17a";
const THEORY_FILL_VALUES = {
  "USSS-004": 92, "USSS-80": 88, "USSS-91": 76, "USSS-121": 95, "USSS-112": 65,
  "USSS-119": 84, "USSS-8": 91, "USSS-120": 98, "USSS-111": 72, "USSS-124": 87,
  "USSS-92": 60, "USSS-107": 90, "USSS-106": 55, "USSS-123": 93, "USSS-50": 89,
  "USSS-98": 96, "USSS-118": 90, "USSS-96": 82, "USSS-109": 79,
};
function applyTheoryFillPatch() {
  if (read(THEORY_FILL_PATCH_KEY, false)) return;
  const list = getPersonnel();
  let changed = false;
  list.forEach((p) => {
    const value = THEORY_FILL_VALUES[p.usssId];
    if (value === undefined) return;
    p.modules = p.modules || {};
    const existing = p.modules["0"];
    if (existing && existing.theory !== null && existing.theory !== undefined) return;
    p.modules["0"] = existing || { theory: null, practical: undefined, history: [] };
    p.modules["0"].theory = value;
    p.modules["0"].theoryDate = "2026-08-17";
    p.modules["0"].examiner = "A rendszer";
    p.modules["0"].history = p.modules["0"].history || [];
    p.modules["0"].history.push({
      date: "2026-08-17T10:00:00.000Z", type: "theory", theory: value,
      result: value >= THEORY_PASS_THRESHOLD ? "pass" : "fail", examiner: "A rendszer",
    });
    changed = true;
  });
  if (changed) savePersonnel(list);
  write(THEORY_FILL_PATCH_KEY, true);
}

/* Célzott javítás: az upsertLocation-ben volt egy object-spread sorrend hiba,
   ami miatt az admin felületen újonnan létrehozott védett helyszínek üres
   ("") id-t kaptak — emiatt rájuk kattintva a #/locations/ útvonal nem
   illeszkedett egyik route-ra sem, és a rendszer visszadobott a Vezérlőpultra.
   Ez a patch minden hiányzó/üres id-jű helyszínnek generál egy valódit. */
const LOCATION_ID_FIX_PATCH_KEY = NS + "location_id_fix_2026_08_17a";
function applyLocationIdFixPatch() {
  if (read(LOCATION_ID_FIX_PATCH_KEY, false)) return;
  const list = getLocations();
  let changed = false;
  list.forEach((l) => {
    if (!l.id) { l.id = uid("LOC"); changed = true; }
  });
  if (changed) write(KEYS.locations, list);
  write(LOCATION_ID_FIX_PATCH_KEY, true);
}

/* Célzott seedelés: a Felvételi modul (kérdésbank + jelentkezők) új
   localStorage-kulcsokat vezet be, amiket egy már korábban seedelt
   böngésző még nem ismer — ez a patch pótolja őket, minden mást
   érintetlenül hagyva. */
function applyRecruitmentSeedPatch() {
  if (read(KEYS.recruitmentQuestions, null) === null) {
    write(KEYS.recruitmentQuestions, RECRUITMENT_QUESTIONS);
  }
  if (read(KEYS.applicants, null) === null) {
    write(KEYS.applicants, []);
  }
  if (read(KEYS.exams, null) === null) {
    write(KEYS.exams, []);
    write(KEYS.nextExamSeq, 0);
  }
}

/* Célzott seedelés: a Belső Vizsgálati Rendszer új localStorage-kulcsokat
   vezet be, amiket egy már korábban seedelt böngésző még nem ismer — ez a
   patch pótolja őket, minden mást érintetlenül hagyva. */
function applyInvestigationSeedPatch() {
  if (read(KEYS.investigations, null) === null) {
    write(KEYS.investigations, []);
    write(KEYS.nextInvestigationSeq, 1);
  }
}

export function resetAllData() {
  Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
  seedIfNeeded();
}

/* ---------- Static reference data ------------------------------------ */
export const ref = { LEVELS, SERVICE_STATUSES, MODULES, LEVEL_MODULE_ORDER, MAPS };

export function mapById(id) {
  return MAPS.find((m) => m.id === id) || MAPS[0];
}

/* ---------- Pozíciók (admin felületről szerkeszthető) -------------------*/
export function getPositionEntries() {
  return read(KEYS.positions, []);
}
export function getPositions() {
  return getPositionEntries().map((p) => p.name);
}
export function addPosition(name, group, actorLabel) {
  const trimmed = (name || "").trim();
  if (!trimmed) return;
  const list = getPositionEntries();
  if (list.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) return;
  list.push({ group: group || "Egyéb", name: trimmed });
  write(KEYS.positions, list);
  logAudit(actorLabel, "Pozíció hozzáadva", trimmed);
}
export function removePosition(name, actorLabel) {
  write(KEYS.positions, getPositionEntries().filter((p) => p.name !== name));
  logAudit(actorLabel, "Pozíció törölve", name);
}

export function moduleByCode(code) {
  return MODULES.find((m) => m.code === code);
}
export function modulesForLevel(levelId) {
  const order = LEVEL_MODULE_ORDER[levelId] || [];
  return order.map(moduleByCode).filter(Boolean);
}
export function allSpecialtyModules() {
  return modulesForLevel("SPEC");
}
export function levelLabel(id) {
  const lv = LEVELS.find((l) => l.id === id);
  return lv ? lv.label : id;
}

/* ---------- Personnel --------------------------------------------------*/
export function getPersonnel() {
  return read(KEYS.personnel, []);
}
export function getPerson(usssId) {
  return getPersonnel().find((p) => p.usssId === usssId);
}
export function savePersonnel(list) {
  write(KEYS.personnel, list);
}
export function upsertPerson(person, actorLabel) {
  const list = getPersonnel();
  const idx = list.findIndex((p) => p.usssId === person.usssId);
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...person };
    logAudit(actorLabel, "Profil frissítve", `${person.name || list[idx].name} (${person.usssId})`);
  } else {
    list.push({
      modules: {}, notes: "", photo: "", probationLifted: false,
      levelUpEligible: false, createdAt: new Date().toISOString(), ...person,
    });
    logAudit(actorLabel, "Új személy felvéve", `${person.name} (${person.usssId})`);
  }
  savePersonnel(list);
}
export function deletePerson(usssId, actorLabel) {
  const list = getPersonnel().filter((p) => p.usssId !== usssId);
  savePersonnel(list);
  logAudit(actorLabel, "Személy törölve", usssId);
}

/* ---- Modul állapot számítás -------------------------------------------*/
export function moduleState(person, code) {
  const rec = (person.modules && person.modules[code]) || null;
  const def = moduleByCode(code);
  if (!def) return { color: "gray", label: "Ismeretlen modul" };

  const theory = rec ? rec.theory : null;
  const practical = rec ? rec.practical : null; // undefined | 'waiting' | 'pass' | 'fail'

  const needsTheory = def.theory;
  const needsPractical = def.practical;

  const theorySubmitted = theory !== null && theory !== undefined;
  const theoryPassed = theorySubmitted && theory >= THEORY_PASS_THRESHOLD;
  const theoryDone = !needsTheory || theoryPassed;

  if (!theoryDone) {
    if (theorySubmitted) {
      return { color: "red", label: `Elméleti vizsga sikertelen (<${THEORY_PASS_THRESHOLD}%)`, theory, practical };
    }
    return { color: "red", label: "Nincs teljesítve", theory, practical };
  }
  if (!needsPractical) {
    return { color: "green", label: "Teljesítve", theory, practical };
  }
  if (practical === "pass") {
    return { color: "green", label: "Gyakorlat sikeres", theory, practical };
  }
  if (practical === "fail") {
    return { color: "red", label: "Gyakorlat sikertelen", theory, practical };
  }
  return { color: "yellow", label: "Elmélet teljesítve, gyakorlatra vár", theory, practical };
}

export function isModuleComplete(person, code) {
  return moduleState(person, code).color === "green";
}

export function readinessPercent(person) {
  const allCodes = Object.keys(LEVEL_MODULE_ORDER).filter((k) => k !== "SPEC")
    .flatMap((lv) => LEVEL_MODULE_ORDER[lv]);
  const unique = [...new Set(allCodes)];
  const done = unique.filter((c) => isModuleComplete(person, c)).length;
  return Math.round((done / unique.length) * 100);
}

export function levelProgress(person, levelId) {
  const mods = modulesForLevel(levelId);
  if (!mods.length) return { done: 0, total: 0, eligible: false };
  const done = mods.filter((m) => isModuleComplete(person, m.code)).length;
  return { done, total: mods.length, eligible: done === mods.length && levelId !== "0" };
}

export function setModuleTheory(usssId, code, { theory, theoryDate, examiner }, actorLabel) {
  const list = getPersonnel();
  const p = list.find((x) => x.usssId === usssId);
  if (!p) return;
  p.modules = p.modules || {};
  p.modules[code] = p.modules[code] || { theory: null, practical: undefined, history: [] };
  p.modules[code].theory = theory;
  p.modules[code].theoryDate = theoryDate || new Date().toISOString().slice(0, 10);
  p.modules[code].examiner = examiner || "A rendszer";
  p.modules[code].history = p.modules[code].history || [];
  if (theory !== null && theory !== undefined) {
    p.modules[code].history.push({
      date: new Date(theoryDate || Date.now()).toISOString(),
      type: "theory",
      theory,
      result: theory >= THEORY_PASS_THRESHOLD ? "pass" : "fail",
      examiner: p.modules[code].examiner,
    });
  }
  savePersonnel(list);
  logAudit(actorLabel, "Elméleti eredmény rögzítve",
    `${p.name} – ${code}: ${theory}% (${theory >= THEORY_PASS_THRESHOLD ? "sikeres" : "sikertelen"})`);
  checkLevelUpEligibility(p, actorLabel);
}

/* Egy személy összes elméleti/gyakorlati próbálkozása a modul-előzményekből. */
export function examStats(person) {
  let theoryAttempts = 0, theoryPass = 0, theoryFail = 0, practicalPass = 0, practicalFail = 0;
  Object.values(person.modules || {}).forEach((rec) => {
    (rec.history || []).forEach((h) => {
      if (h.type === "theory") {
        theoryAttempts++;
        if (h.result === "pass") theoryPass++; else theoryFail++;
      } else if (h.result === "pass") {
        practicalPass++;
      } else if (h.result === "fail") {
        practicalFail++;
      }
    });
  });
  return {
    theoryAttempts, theoryPass, theoryFail, practicalPass, practicalFail,
    totalAttempts: theoryAttempts + practicalPass + practicalFail,
  };
}

export function setModulePractical(usssId, code, result, actorLabel, extra = {}) {
  // result: 'waiting' | 'pass' | 'fail'
  const list = getPersonnel();
  const p = list.find((x) => x.usssId === usssId);
  if (!p) return;
  p.modules = p.modules || {};
  p.modules[code] = p.modules[code] || { theory: null, practical: undefined, history: [] };
  const prev = p.modules[code].practical;
  p.modules[code].practical = result;
  p.modules[code].practicalExaminer = actorLabel || "A rendszer";
  p.modules[code].history = p.modules[code].history || [];
  p.modules[code].history.push({
    date: new Date().toISOString(),
    type: "practical",
    theory: p.modules[code].theory,
    result,
    examiner: actorLabel || "A rendszer",
    ...extra,
  });
  savePersonnel(list);
  logAudit(actorLabel, "Gyakorlati vizsga rögzítve",
    `${p.name} – ${code}: ${prev || "—"} → ${result}${extra.protocolId ? ` (${extra.protocolId})` : ""}`);
  checkLevelUpEligibility(p, actorLabel);
}

/* Egy próbálkozás törlése a modul előzményéből (téves rögzítés javítása).
   Törlés után az aktuális elméleti/gyakorlati állapot a maradék előzmény
   legutóbbi bejegyzéséhez igazodik — ha nem marad ilyen, üresre áll vissza. */
export function deleteHistoryEntry(usssId, code, historyIndex, actorLabel) {
  const list = getPersonnel();
  const p = list.find((x) => x.usssId === usssId);
  if (!p || !p.modules || !p.modules[code]) return;
  const rec = p.modules[code];
  const history = rec.history || [];
  if (historyIndex < 0 || historyIndex >= history.length) return;
  const [removed] = history.splice(historyIndex, 1);

  const lastTheory = [...history].reverse().find((h) => h.type === "theory");
  const lastPractical = [...history].reverse().find((h) => h.type === "practical");
  rec.theory = lastTheory ? lastTheory.theory : null;
  rec.practical = lastPractical ? lastPractical.result : undefined;

  savePersonnel(list);
  logAudit(actorLabel, "Próbálkozás törölve",
    `${p.name} – ${code}: ${removed.type === "theory" ? "elméleti" : "gyakorlati"} próbálkozás (${fmtHistoryDate(removed.date)})`);
  checkLevelUpEligibility(p, actorLabel);
}
function fmtHistoryDate(iso) {
  try { return new Date(iso).toLocaleDateString("hu-HU"); } catch { return iso; }
}

function checkLevelUpEligibility(person, actorLabel) {
  if (person.level === "0") return; // próbaidő nem igényel jóváhagyást
  const prog = levelProgress(person, person.level);
  const wasEligible = person.levelUpEligible;
  person.levelUpEligible = prog.eligible;
  if (person.levelUpEligible && !wasEligible) {
    logAudit(actorLabel, "Szintlépésre jogosult", `${person.name} teljesítette a(z) ${person.level}. szint moduljait`);
  }
  savePersonnel(getPersonnel().map((p) => (p.usssId === person.usssId ? person : p)));
}

export function approveLevelUp(usssId, newLevelId, actorLabel) {
  const list = getPersonnel();
  const p = list.find((x) => x.usssId === usssId);
  if (!p) return;
  const old = p.level;
  p.level = newLevelId;
  p.levelUpEligible = false;
  savePersonnel(list);
  logAudit(actorLabel, "Szintlépés jóváhagyva", `${p.name}: ${levelLabel(old)} → ${levelLabel(newLevelId)}`);
}

export function nextLevelId(levelId) {
  const idx = LEVELS.findIndex((l) => l.id === levelId);
  if (idx === -1 || idx === LEVELS.length - 1) return null;
  return LEVELS[idx + 1].id;
}

/* ---- Próbaidő ----------------------------------------------------------*/
export function probationInfo(person) {
  if (person.level !== "0" || person.probationLifted) return null;
  if (!person.probationStart) return null;
  const start = new Date(person.probationStart + "T00:00:00");
  const end = new Date(start.getTime() + 14 * 24 * 3600 * 1000);
  const now = new Date();
  const msLeft = end - now;
  const daysLeft = Math.ceil(msLeft / (24 * 3600 * 1000));
  return {
    start: person.probationStart,
    end: end.toISOString().slice(0, 10),
    active: msLeft > 0,
    daysLeft: Math.max(0, daysLeft),
  };
}

export function liftProbation(usssId, actorLabel) {
  const list = getPersonnel();
  const p = list.find((x) => x.usssId === usssId);
  if (!p) return;
  p.probationLifted = true;
  savePersonnel(list);
  logAudit(actorLabel, "Próbaidős korlátozás feloldva", p.name);
}

/* ---------- Access codes / roles --------------------------------------*/
export function getAccessCodes() {
  return read(KEYS.accessCodes, []);
}
export function saveAccessCodes(list) {
  write(KEYS.accessCodes, list);
}
export function findAccessCode(usssId, code) {
  return getAccessCodes().find(
    (a) => a.usssId.toLowerCase() === usssId.toLowerCase() && a.code === code
  );
}
export function upsertAccessCode(entry, actorLabel) {
  const list = getAccessCodes();
  const idx = list.findIndex((a) => a.usssId === entry.usssId);
  if (idx >= 0) list[idx] = { ...list[idx], ...entry };
  else list.push(entry);
  saveAccessCodes(list);
  logAudit(actorLabel, "Hozzáférés módosítva", `${entry.usssId} – szerepkör: ${entry.role}`);
}
export function revokeAccessCode(usssId, actorLabel) {
  saveAccessCodes(getAccessCodes().filter((a) => a.usssId !== usssId));
  logAudit(actorLabel, "Hozzáférés visszavonva", usssId);
}
export function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s.slice(0, 4) + "-" + s.slice(4);
}

/* ---------- Protocols (Jegyzőkönyvek) ----------------------------------*/
export function getProtocols() {
  return read(KEYS.protocols, []);
}
export function getProtocol(id) {
  return getProtocols().find((p) => p.id === id);
}
export function nextProtocolId() {
  const year = new Date().getFullYear();
  const seq = read(KEYS.nextProtocol, 1);
  return { id: `TR-${year}-${String(seq).padStart(3, "0")}`, seq };
}
export function createProtocol(data, actorLabel) {
  const { id, seq } = nextProtocolId();
  const protocol = {
    id,
    moduleCode: data.moduleCode,
    date: data.date,
    examiner: data.examiner,
    participants: data.participants || [], // [{usssId, examined, examResult, note}]
    notes: data.notes || "",
    createdBy: actorLabel,
    createdAt: new Date().toISOString(),
  };
  const list = getProtocols();
  list.unshift(protocol);
  write(KEYS.protocols, list);
  write(KEYS.nextProtocol, seq + 1);

  const participants = data.participants || [];

  // Akik vizsgáztak (sikeres/sikertelen): ez a modul tényleges gyakorlati
  // állapotát is frissíti, nem csak egy előzmény-bejegyzést hagy hátra.
  participants
    .filter((part) => part.examResult === "pass" || part.examResult === "fail")
    .forEach((part) => {
      setModulePractical(part.usssId, data.moduleCode, part.examResult, actorLabel, {
        protocolId: id,
        note: part.note || "",
      });
    });

  // Akik csak részt vettek (nem vizsgáztak): könnyű előzmény-bejegyzés, a
  // modul állapotát nem módosítja. Friss olvasás, hogy a fenti mentéseket
  // ne írja felül.
  const attendedOnly = participants.filter((part) => part.examResult !== "pass" && part.examResult !== "fail");
  if (attendedOnly.length) {
    const personnel = getPersonnel();
    attendedOnly.forEach((part) => {
      const p = personnel.find((x) => x.usssId === part.usssId);
      if (!p) return;
      p.modules = p.modules || {};
      p.modules[data.moduleCode] = p.modules[data.moduleCode] || { theory: null, practical: undefined, history: [] };
      p.modules[data.moduleCode].history = p.modules[data.moduleCode].history || [];
      p.modules[data.moduleCode].history.push({
        date: new Date(data.date).toISOString(),
        type: "attendance",
        protocolId: id,
        note: part.note || "",
        result: "résztvevő",
      });
    });
    savePersonnel(personnel);
  }

  logAudit(actorLabel, "Jegyzőkönyv létrehozva", `${id} — ${data.moduleCode}`);
  return protocol;
}

/* ---------- Protected locations ----------------------------------------*/
export function getLocations() {
  return read(KEYS.locations, []);
}
export function getLocation(id) {
  return getLocations().find((l) => l.id === id);
}
export function upsertLocation(loc, actorLabel) {
  const list = getLocations();
  const idx = list.findIndex((l) => l.id === loc.id);
  const stamped = { ...loc, updatedBy: actorLabel, updatedAt: new Date().toISOString() };
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...stamped };
  } else {
    // A "...stamped" tartalmaz egy explicit id:undefined kulcsot új helyszínnél
    // (mert a form loc?.id-t küld), ami felülírná a generált ID-t, ha korábban
    // állna a sorban — ezért az id-nek a spread UTÁN kell jönnie.
    list.push({ entrances: [], ...stamped, id: loc.id || uid("LOC") });
  }
  write(KEYS.locations, list);
  logAudit(actorLabel, "Védett helyszín mentve", stamped.name);
}
export function deleteLocation(id, actorLabel) {
  write(KEYS.locations, getLocations().filter((l) => l.id !== id));
  logAudit(actorLabel, "Védett helyszín törölve", id);
}
export function locationsForMap(mapId) {
  return getLocations().filter((l) => (l.map || "los-santos") === mapId);
}

/* ---------- Körzet-feliratok a Térkép oldalhoz --------------------------*/
export function getDistricts() {
  return read(KEYS.districts, []);
}
export function districtsForMap(mapId) {
  return getDistricts().filter((d) => d.map === mapId);
}
export function upsertDistrict(district, actorLabel) {
  const list = getDistricts();
  const idx = list.findIndex((d) => d.id === district.id);
  if (idx >= 0) list[idx] = { ...list[idx], ...district };
  else list.push({ ...district, id: district.id || uid("D") });
  write(KEYS.districts, list);
  logAudit(actorLabel, "Körzet mentve", `${district.name} (${district.map})`);
}
export function deleteDistrict(id, actorLabel) {
  write(KEYS.districts, getDistricts().filter((d) => d.id !== id));
  logAudit(actorLabel, "Körzet törölve", id);
}

/* ---------- Audit log ----------------------------------------------------*/
export function getAuditLog() {
  return read(KEYS.auditLog, []);
}
export function logAudit(actor, action, detail) {
  const list = read(KEYS.auditLog, []);
  list.unshift({
    id: uid("AL"),
    timestamp: new Date().toISOString(),
    actor: actor || "Ismeretlen",
    action,
    detail,
  });
  write(KEYS.auditLog, list.slice(0, 500));
}

/* ---------- Felvételi (kérdésbank + jelentkezők) --------------------------*/
export function getRecruitmentQuestions() {
  return read(KEYS.recruitmentQuestions, []);
}
export function addRecruitmentQuestion(text, actorLabel) {
  const trimmed = (text || "").trim();
  if (!trimmed) return;
  const list = getRecruitmentQuestions();
  list.push({ id: uid("Q"), text: trimmed });
  write(KEYS.recruitmentQuestions, list);
  logAudit(actorLabel, "Felvételi kérdés hozzáadva", trimmed);
}
export function removeRecruitmentQuestion(id, actorLabel) {
  write(KEYS.recruitmentQuestions, getRecruitmentQuestions().filter((q) => q.id !== id));
  logAudit(actorLabel, "Felvételi kérdés törölve", id);
}

export function getApplicants() {
  return read(KEYS.applicants, []);
}
export function getApplicant(id) {
  return getApplicants().find((a) => a.id === id);
}
export function createApplicant({ name, contact, answers }, actorLabel) {
  const list = getApplicants();
  const applicant = {
    id: uid("APP"),
    name: (name || "").trim(),
    contact: (contact || "").trim(),
    answers: answers || [], // [{questionId, questionText, answer}]
    status: "review", // review | accepted | rejected
    notes: "",
    promotedTo: null,
    createdBy: actorLabel,
    createdAt: new Date().toISOString(),
  };
  list.unshift(applicant);
  write(KEYS.applicants, list);
  logAudit(actorLabel, "Jelentkező felvéve", applicant.name);
  return applicant;
}
export function setApplicantStatus(id, status, actorLabel) {
  const list = getApplicants();
  const a = list.find((x) => x.id === id);
  if (!a) return;
  const prev = a.status;
  a.status = status;
  a.decidedBy = actorLabel;
  a.decidedAt = new Date().toISOString();
  write(KEYS.applicants, list);
  logAudit(actorLabel, "Jelentkező elbírálva", `${a.name}: ${prev} → ${status}`);
}
export function setApplicantNotes(id, notes, actorLabel) {
  const list = getApplicants();
  const a = list.find((x) => x.id === id);
  if (!a) return;
  a.notes = notes || "";
  write(KEYS.applicants, list);
  logAudit(actorLabel, "Jelentkező megjegyzés frissítve", a.name);
}
export function deleteApplicant(id, actorLabel) {
  const a = getApplicant(id);
  write(KEYS.applicants, getApplicants().filter((x) => x.id !== id));
  logAudit(actorLabel, "Jelentkező törölve", a ? a.name : id);
}
/* Elfogadott jelentkezőből valódi állomány-tag lesz: 0. szint, Újonc
   státusz — ugyanaz a kiindulópont, mint bárki másnak a rendszerben. */
export function promoteApplicant(id, usssId, position, actorLabel) {
  const a = getApplicant(id);
  if (!a) return;
  upsertPerson({
    usssId, name: a.name, position: position || "U.S.S.S Agent",
    level: "0", status: "Újonc", probationStart: new Date().toISOString().slice(0, 10),
  }, actorLabel);
  const list = getApplicants();
  const idx = list.findIndex((x) => x.id === id);
  if (idx >= 0) list[idx].promotedTo = usssId;
  write(KEYS.applicants, list);
  logAudit(actorLabel, "Jelentkező felvéve az állományba", `${a.name} → ${usssId}`);
}

/* ---------- Felvételi vizsga (IC szóbeli, oktatásvezető pontozza) --------*/
export const EXAM_MAX_SCORE = EXAM_QUESTIONS.length * 5; // 200
export const EXAM_PASS_PCT = 80;

export function getExamQuestions() {
  return EXAM_QUESTIONS;
}
export function getExamCategories() {
  return EXAM_CATEGORIES;
}

function nextExamId() {
  const seq = Math.max(1, read(KEYS.nextExamSeq, 1));
  return { id: `USSS-${String(seq).padStart(3, "0")}`, seq };
}

export function getExams() {
  return read(KEYS.exams, []);
}

export const OPERATION_TYPES = {
  protectees: { label: "Védett személyek", singular: "Védett személy", icon: "◆" },
  events: { label: "Események", singular: "Esemény", icon: "◈" },
  escorts: { label: "Kísérések", singular: "Kísérés", icon: "↗" },
  assignments: { label: "Feladatok", singular: "Feladat", icon: "▣" },
  reports: { label: "Jelentések", singular: "Jelentés", icon: "▤" },
  threats: { label: "Fenyegetésértékelés", singular: "Fenyegetés", icon: "△" },
  advance: { label: "Advance Work", singular: "Advance", icon: "⌖" },
  "protection-levels": { label: "Védelmi fokozatok", singular: "Védelmi fokozat", icon: "◉" },
  "protective-plans": { label: "Védelmi tervek", singular: "Védelmi terv", icon: "⬡" },
  intelligence: { label: "Védelmi információk", singular: "Védelmi információ", icon: "⌁" },
  government: { label: "Kormányzati névjegyzék", singular: "Kormányzati bejegyzés", icon: "⌂" },
  succession: { label: "Elnöki öröklési sorrend", singular: "Öröklési bejegyzés", icon: "Ⅰ" },
  calendar: { label: "Naptár", singular: "Naptári esemény", icon: "▦" },
  notifications: { label: "Értesítések", singular: "Értesítés", icon: "◌" },
  settings: { label: "Beállítások", singular: "Beállítás", icon: "⚙" },
};
export const PROTECTION_LEVELS = [
  { id: "LEVEL 1", label: "1. szint · Standard", description: "Alapvető védelmi jelenlét és előzetes kockázatfelmérés." },
  { id: "LEVEL 2", label: "2. szint · Emelt", description: "Fokozott figyelem, megerősített biztosítás és részletesebb terv." },
  { id: "LEVEL 3", label: "3. szint · Magas", description: "Kiemelt védelmi terv, kijelölt detail és folyamatos vezetői kontroll." },
  { id: "LEVEL 4", label: "4. szint · Kritikus", description: "Teljes körű, kiemelt védelem közvetlen fenyegetés esetén." },
];
export const READINESS_LEVELS = {
  green: { label: "Zöld · Alapkészültség", color: "green", description: "Normál szolgálati állapot, nincs ismert kiemelt fenyegetés." },
  yellow: { label: "Sárga · Fokozott készültség", color: "yellow", description: "Fokozott figyelem, megerősíthető védelem és értesíthető állomány." },
  red: { label: "Vörös · Teljes készültség", color: "red", description: "Teljes U.S.S.S. készültség, kiemelt védelem és vezetői koordináció." },
};

export function getReadinessState() {
  return read(KEYS.readiness, { level: "green", reason: "Normál szolgálati állapot.", changedAt: null, changedBy: "Rendszer" });
}

export function setReadinessState(level, reason, actorLabel) {
  if (!READINESS_LEVELS[level]) return false;
  const state = { level, reason: (reason || "").trim(), changedAt: new Date().toISOString(), changedBy: actorLabel || "Rendszer" };
  write(KEYS.readiness, state);
  logAudit(actorLabel, "Készültségi szint módosítva", `${READINESS_LEVELS[level].label} — ${state.reason}`);
  return true;
}
export const GOVERNMENT_HIERARCHY = [
  ["President", "Elnök", "Az önkormányzat legfőbb vezetője és végső döntéshozója."],
  ["Vice President", "Alelnök", "Az elnök helyettese, az önkormányzati működés vezetői felügyelete."],
  ["Chief Of Staff", "Kabinettfőnök", "Az összes miniszteri munka koordinálása; közvetlen elszámolás az elnök és az alelnök felé."],
  ["Secretary of Defense", "Védelmi miniszter", "A teljes rendvédelem koordinálása, beleértve a Sheriffséget, az LSPD-t és az U.S.S.S.-t; közvetlen beosztottjai az U.S.S.S. Directorok."],
  ["Secretary of Homeland Security", "Belbiztonsági miniszter", "Terrorveszélyek, nagy kaliberű szervezetek és egyéb kiemelt veszélyek feltárása; a védelmi miniszter helyettese."],
  ["Secretary of Development", "Fejlődési és pénzügyi miniszter", "Az államkassza vezetése, támogatási döntések előkészítése és városi partnerségek ápolása."],
  ["Secretary of Public Relations", "Kommunikációs miniszter", "Sajtótájékoztatók, újságcikkek, nyilvános hirdetések és önkormányzati kommunikáció koordinálása."],
  ["Campaign Manager", "Kampánymenedzser", "Az elnöki kampány megtervezése, koordinálása, üzenetei, rendezvényei és stratégiai javaslatai."],
  ["Secretary of Health", "Egészségügyi miniszter", "Az egészségügy korszerűsítése, folyamatok átvilágítása és fejlesztési javaslatok előkészítése."],
  ["Secretary of Transportation", "Közlekedési miniszter", "Közlekedési projektek és fejlesztési javaslatok koordinálása a rendvédelemmel és városi szolgáltatókkal együttműködésben."],
  ["U.S.S.S. Director", "U.S.S.S. műveleti parancsnok / oktatásvezető", "Az U.S.S.S. műveleti irányítása, az állomány koordinálása, a vizsgák és képzések vezetése, valamint a szolgálati fegyelem felügyelete."],
];
export const SUCCESSION_ORDER = [
  [1, "President", "Elnök"],
  [2, "Vice President", "Alelnök"],
  [3, "Chief Of Staff", "Kabinettfőnök"],
  [4, "Secretary of Defense", "Védelmi miniszter"],
  [5, "Secretary of Homeland Security", "Belbiztonsági miniszter"],
  [6, "Secretary of Development", "Fejlődési és pénzügyi miniszter"],
  [7, "Secretary of Public Relations", "Kommunikációs miniszter"],
  [8, "Campaign Manager", "Kampánymenedzser"],
  [9, "Secretary of Health", "Egészségügyi miniszter"],
  [10, "Secretary of Transportation", "Közlekedési miniszter"],
];

function applyGovernmentHierarchySeedPatch() {
  const patchKey = NS + "government_hierarchy_seed_2026_09_02";
  if (read(patchKey, false)) return;
  const records = read(KEYS.operations, []);
  const existing = new Set(records.filter((record) => record.type === "government").map((record) => record.title));
  const now = new Date().toISOString();
  GOVERNMENT_HIERARCHY.forEach(([position, title, description], index) => {
    if (existing.has(title)) return;
    records.push({
      id: `GOV-${String(index + 1).padStart(3, "0")}`,
      type: "government",
      title,
      status: "APPROVED",
      priority: index < 2 ? "CRITICAL" : "HIGH",
      risk: "LOW",
      protectionLevel: index < 2 ? "LEVEL 4" : "LEVEL 2",
      owner: "Önkormányzati vezetés",
      location: "Önkormányzati központ",
      protectee: "",
      date: now.slice(0, 10),
      description: `${position}\n\n${description}`,
      action: "A tisztséghez kapcsolódó U.S.S.S. védelmi és koordinációs feladatok nyilvántartva.",
      recommendation: "A beosztás és az aktuális személy kijelölése vezetői jóváhagyással frissítendő.",
      tags: "government, hierarchy, protected-office",
      archived: false,
      createdAt: now,
      createdBy: "Rendszer",
      updatedAt: now,
      history: [{ at: now, by: "Rendszer", action: "Önkormányzati hierarchia rögzítve" }],
    });
  });
  write(KEYS.operations, records);
  write(patchKey, true);
}

function applyCommandCenterCatalogSeedPatch() {
  const patchKey = NS + "command_center_catalog_seed_2026_09_02";
  if (read(patchKey, false)) return;
  const records = read(KEYS.operations, []);
  const existing = new Set(records.map((record) => `${record.type}:${record.title}`));
  const now = new Date().toISOString();
  SUCCESSION_ORDER.forEach(([order, position, title]) => {
    const key = `succession:${title}`;
    if (existing.has(key)) return;
    records.push({ id: `SUC-${String(order).padStart(3, "0")}`, type: "succession", title, status: "APPROVED", priority: order <= 2 ? "CRITICAL" : "HIGH", risk: "LOW", protectionLevel: order <= 2 ? "LEVEL 4" : "LEVEL 2", owner: "Önkormányzati vezetés", location: "Önkormányzati központ", protectee: "", date: now.slice(0, 10), description: `${position}\nÖröklési sorrend: ${order}. hely`, action: "A sorrend vezetői jóváhagyással és auditált módosítással kezelendő.", recommendation: "A tisztség aktuális betöltőjét és helyettesét rendszeresen felül kell vizsgálni.", tags: "government, succession, protected-office", archived: false, createdAt: now, createdBy: "Rendszer", updatedAt: now, history: [{ at: now, by: "Rendszer", action: "Öröklési sorrend rögzítve" }] });
  });
  PROTECTION_LEVELS.forEach((level) => {
    const key = `protection-levels:${level.label}`;
    if (existing.has(key)) return;
    records.push({ id: `LVL-${level.id.replace("LEVEL ", "")}`, type: "protection-levels", title: level.label, status: "APPROVED", priority: "HIGH", risk: level.id === "LEVEL 4" ? "CRITICAL" : "LOW", protectionLevel: level.id, owner: "U.S.S.S. Command", location: "U.S.S.S. belső szabályzat", protectee: "", date: now.slice(0, 10), description: level.description, action: "A szint hozzárendelése védett személyhez, eseményhez vagy helyszínhez vezetői felülvizsgálattal történik.", recommendation: "Minden kiemelt esemény előtt a szintet felül kell vizsgálni.", tags: "protection-level, policy", archived: false, createdAt: now, createdBy: "Rendszer", updatedAt: now, history: [{ at: now, by: "Rendszer", action: "Védelmi fokozat rögzítve" }] });
  });
  write(KEYS.operations, records);
  write(patchKey, true);
}

function applyCommandCenterSeedPatch() {
  const patchKey = NS + "command_center_seed_2026_09_02";
  if (read(patchKey, false)) return;
  const records = read(KEYS.operations, []);
  const existingProtectees = new Set(records.filter((record) => record.type === "protectees").map((record) => record.protectee));
  const now = new Date().toISOString();
  getPersonnel().filter((person) => isProtectedGovernmentOfficial(person.position)).forEach((person) => {
    if (existingProtectees.has(person.name)) return;
    records.push({
      id: `PTC-${person.usssId}`,
      type: "protectees",
      title: `${person.name} · ${person.position}`,
      status: "APPROVED",
      priority: "HIGH",
      risk: "MODERATE",
      protectionLevel: "LEVEL 2",
      owner: "U.S.S.S. Command",
      location: "Kormányzati védelmi körzet",
      protectee: person.name,
      date: now.slice(0, 10),
      description: `${person.position} · ${person.usssId}\nAlapértelmezett U.S.S.S. védelmi nyilvántartás. A védelmi terv vezetői felülvizsgálatra kijelölhető.`,
      action: "Védelem aktív · kijelölt állomány és részletes terv szerint.",
      recommendation: "A védelmi szintet minden kiemelt esemény előtt felül kell vizsgálni.",
      tags: "government, protectee, standing-detail",
      archived: false,
      createdAt: now,
      createdBy: "Rendszer",
      updatedAt: now,
      history: [{ at: now, by: "Rendszer", action: "Alap védelmi rekord létrehozva" }],
    });
  });
  write(KEYS.operations, records);
  write(patchKey, true);
}

function isProtectedGovernmentOfficial(position) {
  return position === "President" || position === "Vice President" || position === "Chief Of Staff" || /^Secretary of /.test(position);
}

function applyProtecteeScopePatch() {
  const patchKey = NS + "protectee_scope_2026_09_02";
  if (read(patchKey, false)) return;
  const protectedNames = new Set(getPersonnel().filter((person) => isProtectedGovernmentOfficial(person.position)).map((person) => person.name));
  const records = read(KEYS.operations, []);
  const scoped = records.filter((record) => record.type !== "protectees" || !record.tags?.includes("standing-detail") || protectedNames.has(record.protectee));
  if (scoped.length !== records.length) write(KEYS.operations, scoped);
  write(patchKey, true);
}

export function getOperationRecords(type = "") {
  return read(KEYS.operations, []).filter((record) => !type || record.type === type);
}

export function createOperationRecord(type, fields, actorLabel) {
  const meta = OPERATION_TYPES[type];
  if (!meta) return null;
  const now = new Date().toISOString();
  const record = {
    id: `${type.slice(0, 3).toUpperCase()}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    type,
    title: (fields.title || meta.singular).trim(),
    status: fields.status || "OPEN",
    priority: fields.priority || "NORMAL",
    risk: fields.risk || "LOW",
    owner: (fields.owner || "").trim(),
    location: (fields.location || "").trim(),
    protectee: (fields.protectee || "").trim(),
    date: fields.date || now.slice(0, 10),
    description: (fields.description || "").trim(),
    action: (fields.action || "").trim(),
    recommendation: (fields.recommendation || "").trim(),
    tags: (fields.tags || "").trim(),
    archived: false,
    createdAt: now,
    createdBy: actorLabel || "Rendszer",
    updatedAt: now,
    history: [{ at: now, by: actorLabel || "Rendszer", action: "Létrehozva" }],
  };
  const list = read(KEYS.operations, []);
  list.unshift(record);
  write(KEYS.operations, list);
  logAudit(actorLabel, `${meta.singular} létrehozva`, `${record.id} — ${record.title}`);
  return record;
}

export function updateOperationRecord(id, patch, actorLabel) {
  const list = read(KEYS.operations, []);
  const record = list.find((item) => item.id === id);
  if (!record) return null;
  const changes = Object.entries(patch).filter(([key, value]) => value !== undefined && record[key] !== value);
  changes.forEach(([key, value]) => { record[key] = value; });
  record.updatedAt = new Date().toISOString();
  record.history = record.history || [];
  record.history.push({ at: record.updatedAt, by: actorLabel || "Rendszer", action: changes.map(([key]) => key).join(", ") + " módosítva" });
  write(KEYS.operations, list);
  if (changes.length) logAudit(actorLabel, "Operációs rekord módosítva", `${id} — ${changes.map(([key]) => key).join(", ")}`);
  return record;
}

export function archiveOperationRecord(id, archived, actorLabel) {
  return updateOperationRecord(id, { archived: Boolean(archived) }, actorLabel);
}
export function getExam(id) {
  return getExams().find((e) => e.id === id);
}
export function createExam({ candidateName, candidateDiscord, examinerName, examinerRank }, actorLabel) {
  const { id, seq } = nextExamId();
  const exam = {
    id,
    candidateName: (candidateName || "").trim(),
    candidateDiscord: (candidateDiscord || "").trim(),
    examinerName: (examinerName || "").trim(),
    examinerRank: (examinerRank || "").trim(),
    date: new Date().toISOString().slice(0, 10),
    startedAt: new Date().toISOString(),
    endedAt: null,
    answers: [], // [{questionId, score: 0-5|null, note, critical}]
    competencies: {},
    recommendation: "",
    interruptionReason: "",
    interruptedAt: null,
    finalComment: "",
    createdBy: actorLabel,
    createdAt: new Date().toISOString(),
  };
  const list = getExams();
  list.unshift(exam);
  write(KEYS.exams, list);
  write(KEYS.nextExamSeq, seq + 1);
  logAudit(actorLabel, "Felvételi vizsga indítva", `${id} — ${exam.candidateName}`);
  return exam;
}
export function setExamAnswer(examId, questionId, patch, actorLabel) {
  const list = getExams();
  const exam = list.find((e) => e.id === examId);
  if (!exam) return;
  exam.answers = exam.answers || [];
  let a = exam.answers.find((x) => x.questionId === questionId);
  if (!a) { a = { questionId, score: null, note: "", critical: false }; exam.answers.push(a); }
  const previousScore = a.score;
  if (patch.score !== undefined) a.score = patch.score;
  if (patch.note !== undefined) a.note = patch.note;
  if (patch.critical !== undefined) a.critical = Boolean(patch.critical);
  write(KEYS.exams, list);
  if (actorLabel && patch.score !== undefined && previousScore !== patch.score) {
    logAudit(actorLabel, "Vizsgapont módosítva", `${examId} · ${questionId}: ${previousScore ?? "—"} → ${patch.score}`);
  }
}
export function setExamCompetency(examId, name, score) {
  const list = getExams();
  const exam = list.find((e) => e.id === examId);
  if (!exam) return;
  exam.competencies = exam.competencies || {};
  exam.competencies[name] = Math.max(1, Math.min(5, Number(score)));
  write(KEYS.exams, list);
}
export function setExamRecommendation(examId, recommendation) {
  const list = getExams();
  const exam = list.find((e) => e.id === examId);
  if (!exam) return;
  exam.recommendation = recommendation || "";
  write(KEYS.exams, list);
}
export function interruptExam(examId, reason, actorLabel) {
  const list = getExams();
  const exam = list.find((e) => e.id === examId);
  if (!exam) return;
  exam.interruptionReason = reason || "Egyéb";
  exam.interruptedAt = new Date().toISOString();
  exam.endedAt = exam.interruptedAt;
  write(KEYS.exams, list);
  logAudit(actorLabel, "Felvételi vizsga megszakítva", `${examId} — ${exam.interruptionReason}`);
}
export function setExamFinalComment(examId, comment) {
  const list = getExams();
  const exam = list.find((e) => e.id === examId);
  if (!exam) return;
  exam.finalComment = comment || "";
  write(KEYS.exams, list);
}
export function finishExam(examId, actorLabel) {
  const list = getExams();
  const exam = list.find((e) => e.id === examId);
  if (!exam) return;
  exam.endedAt = new Date().toISOString();
  write(KEYS.exams, list);
  const s = examScoreSummary(exam);
  logAudit(actorLabel, "Felvételi vizsga lezárva",
    `${exam.id} — ${exam.candidateName}: ${s.total}/${s.max} (${s.pct.toFixed(1)}%) — ${s.passed ? "SIKERES" : "SIKERTELEN"}`);
}
export function deleteExam(id, actorLabel) {
  const exam = getExam(id);
  write(KEYS.exams, getExams().filter((e) => e.id !== id));
  logAudit(actorLabel, "Felvételi vizsga törölve", exam ? `${id} — ${exam.candidateName}` : id);
}
/* Sikeres vizsga → új személyi profil egy lépésben. A profil a szokásos
   upsertPerson-on megy át (saját auditbejegyzést kap), az exam rekordon
   csak a visszahivatkozás (promotedTo) marad, hogy a gomb ne jelenjen
   meg újra és a vizsgalapról egy kattintással el lehessen jutni a
   profilhoz. */
export function promoteExamCandidate(examId, personFields, actorLabel) {
  const list = getExams();
  const exam = list.find((e) => e.id === examId);
  if (!exam) return null;
  upsertPerson({ modules: {}, notes: `Felvéve a(z) ${examId} felvételi vizsga alapján.`, ...personFields }, actorLabel);
  exam.promotedTo = personFields.usssId;
  write(KEYS.exams, list);
  logAudit(actorLabel, "Jelölt felvéve az állományba", `${exam.id} — ${exam.candidateName} → ${personFields.usssId}`);
  return getPerson(personFields.usssId);
}

/* Pontszám, százalék, min. 80% eredmény és minőségi sáv kiszámítása. */
export function examScoreSummary(exam) {
  const total = (exam.answers || []).reduce((sum, a) => sum + (typeof a.score === "number" ? a.score : 0), 0);
  const answered = (exam.answers || []).filter((a) => typeof a.score === "number").length;
  const max = EXAM_MAX_SCORE;
  const pct = max ? (total / max) * 100 : 0;
  const passed = pct >= EXAM_PASS_PCT;
  let tier;
  if (pct < 60) tier = "Súlyosan elégtelen";
  else if (pct < 70) tier = "Elégtelen";
  else if (pct < 80) tier = "Nem megfelelő";
  else if (pct < 90) tier = "Sikeres";
  else if (pct < 95) tier = "Kiemelkedő";
  else tier = "Kiváló";
  const categories = EXAM_CATEGORIES.map((category) => {
    const categoryQuestions = EXAM_QUESTIONS.filter((q) => q.category === category);
    const questionIds = new Set(categoryQuestions.map((q) => q.id));
    const categoryAnswers = (exam.answers || []).filter((a) => questionIds.has(a.questionId));
    const categoryTotal = categoryAnswers.reduce((sum, a) => sum + (typeof a.score === "number" ? a.score : 0), 0);
    return {
      category,
      total: categoryTotal,
      max: categoryQuestions.length * 5,
      answered: categoryAnswers.filter((a) => typeof a.score === "number").length,
    };
  });
  const criticalErrors = (exam.answers || []).filter((a) => a.critical).length;
  return { total, max, pct, passed, tier, answered, totalQuestions: EXAM_QUESTIONS.length, categories, criticalErrors };
}

/* ---------- Belső Vizsgálati Rendszer -------------------------------------
   Formális belső vizsgálat (nem azonos az általános "Fegyelmi ügy"
   gyorsjegyzettel) — bejelentéstől a lezárásig végigvezetett ügymenet,
   saját státuszgéppel, kivizsgálóval, megállapításokkal és szankcióval. */
const DEFAULT_INVESTIGATION_CATEGORIES = ["Szolgálati mulasztás", "Fegyelemsértés", "Hatalommal való visszaélés", "Etikai vétség", "Biztonsági szabályszegés", "Árulás", "Titoksértés", "Korrupció", "Egyéb"];
/* A kategórialista adminfelületről bővíthető (nem fix kódba égetett
   lista) — lásd addInvestigationCategory / removeInvestigationCategory. */
export function getInvestigationCategories() {
  return read(KEYS.investigationCategories, DEFAULT_INVESTIGATION_CATEGORIES);
}
export function addInvestigationCategory(name, actorLabel) {
  const trimmed = (name || "").trim();
  if (!trimmed) return;
  const list = getInvestigationCategories();
  if (list.some((c) => c.toLowerCase() === trimmed.toLowerCase())) return;
  list.push(trimmed);
  write(KEYS.investigationCategories, list);
  logAudit(actorLabel, "Vizsgálati kategória hozzáadva", trimmed);
}
export function removeInvestigationCategory(name, actorLabel) {
  write(KEYS.investigationCategories, getInvestigationCategories().filter((c) => c !== name));
  logAudit(actorLabel, "Vizsgálati kategória törölve", name);
}
export const INVESTIGATION_SEVERITIES = ["Alacsony", "Közepes", "Súlyos", "Kritikus"];
export const INVESTIGATION_STATUSES = ["Bejelentve", "Vizsgálat alatt", "Felfüggesztve", "Lezárva – megalapozott", "Lezárva – nem megalapozott", "Elutasítva"];
export const INVESTIGATION_CLOSED_STATUSES = ["Lezárva – megalapozott", "Lezárva – nem megalapozott", "Elutasítva"];
export const INVESTIGATION_OUTCOMES = ["Nincs szankció", "Szóbeli figyelmeztetés", "Írásbeli figyelmeztetés", "Próbaidő / visszaminősítés", "Felfüggesztés", "Elbocsátás"];
export const INVESTIGATION_ORIGINS = ["Belső kezdeményezés", "Külső panasz"];

function nextInvestigationId() {
  const seq = Math.max(1, read(KEYS.nextInvestigationSeq, 1));
  return { id: `BV-${String(seq).padStart(3, "0")}`, seq };
}
export function getInvestigations() {
  return read(KEYS.investigations, []);
}
export function getInvestigation(id) {
  return getInvestigations().find((i) => i.id === id);
}
export function createInvestigation(fields, actorLabel) {
  const { id, seq } = nextInvestigationId();
  const now = new Date().toISOString();
  const investigation = {
    id,
    subjectUsssId: (fields.subjectUsssId || "").trim(),
    subjectName: (fields.subjectName || "").trim(),
    reportedBy: (fields.reportedBy || "").trim(),
    investigator: (fields.investigator || "").trim(),
    category: fields.category || getInvestigationCategories()[0],
    severity: fields.severity || INVESTIGATION_SEVERITIES[0],
    origin: INVESTIGATION_ORIGINS.includes(fields.origin) ? fields.origin : INVESTIGATION_ORIGINS[0],
    status: "Bejelentve",
    confidential: Boolean(fields.confidential),
    description: (fields.description || "").trim(),
    findings: "",
    outcome: "",
    linkedOps: [],
    attachments: [],
    openedAt: now,
    closedAt: null,
    createdBy: actorLabel || "Rendszer",
    createdAt: now,
    updatedAt: now,
    history: [{ at: now, by: actorLabel || "Rendszer", action: "Bejelentés rögzítve" }],
  };
  const list = getInvestigations();
  list.unshift(investigation);
  write(KEYS.investigations, list);
  write(KEYS.nextInvestigationSeq, seq + 1);
  logAudit(actorLabel, "Belső vizsgálat indítva", `${id} — ${investigation.subjectName || investigation.subjectUsssId || "ismeretlen érintett"}`);
  return investigation;
}
export function updateInvestigation(id, patch, actorLabel) {
  const list = getInvestigations();
  const inv = list.find((i) => i.id === id);
  if (!inv) return null;
  const changes = Object.entries(patch).filter(([key, value]) => value !== undefined && inv[key] !== value);
  changes.forEach(([key, value]) => { inv[key] = value; });
  if (changes.length) {
    const fieldLabels = { status: "Státusz", investigator: "Kivizsgáló", description: "Bejelentés leírása", findings: "Megállapítások", severity: "Súlyosság", category: "Kategória", origin: "Eredet", confidential: "Bizalmasság", reportedBy: "Bejelentő", subjectName: "Érintett neve", subjectUsssId: "Érintett azonosítója" };
    const label = changes.map(([key]) => fieldLabels[key] || key).join(", ");
    inv.updatedAt = new Date().toISOString();
    inv.history = inv.history || [];
    inv.history.push({ at: inv.updatedAt, by: actorLabel || "Rendszer", action: `${label} frissítve` });
    write(KEYS.investigations, list);
    logAudit(actorLabel, "Belső vizsgálat frissítve", `${id} — ${label}`);
  }
  return inv;
}
export function closeInvestigation(id, { status, outcome }, actorLabel) {
  if (!INVESTIGATION_CLOSED_STATUSES.includes(status)) return null;
  const list = getInvestigations();
  const inv = list.find((i) => i.id === id);
  if (!inv) return null;
  inv.status = status;
  inv.outcome = outcome || "";
  inv.closedAt = new Date().toISOString();
  inv.updatedAt = inv.closedAt;
  inv.history = inv.history || [];
  inv.history.push({ at: inv.closedAt, by: actorLabel || "Rendszer", action: `Vizsgálat lezárva — ${status}${outcome ? ` (${outcome})` : ""}` });
  write(KEYS.investigations, list);
  logAudit(actorLabel, "Belső vizsgálat lezárva", `${id} — ${status}${outcome ? ` · ${outcome}` : ""}`);
  return inv;
}
export function reopenInvestigation(id, actorLabel) {
  const list = getInvestigations();
  const inv = list.find((i) => i.id === id);
  if (!inv) return null;
  inv.status = "Vizsgálat alatt";
  inv.closedAt = null;
  inv.updatedAt = new Date().toISOString();
  inv.history = inv.history || [];
  inv.history.push({ at: inv.updatedAt, by: actorLabel || "Rendszer", action: "Vizsgálat újranyitva" });
  write(KEYS.investigations, list);
  logAudit(actorLabel, "Belső vizsgálat újranyitva", id);
  return inv;
}
export function deleteInvestigation(id, actorLabel) {
  const inv = getInvestigation(id);
  write(KEYS.investigations, getInvestigations().filter((i) => i.id !== id));
  logAudit(actorLabel, "Belső vizsgálat törölve", inv ? `${id} — ${inv.subjectName || inv.subjectUsssId}` : id);
}
/* Csatolmányok — mivel a rendszernek nincs szervere, nem fájlokat tárol,
   hanem külső helyen (Discord, Drive, Dropbox stb.) elérhető linkeket,
   pont úgy, ahogy a személyi profilkép is URL-ként van tárolva. */
export function addInvestigationAttachment(id, attachment, actorLabel) {
  const list = getInvestigations();
  const inv = list.find((i) => i.id === id);
  if (!inv) return;
  const label = (attachment.label || "").trim();
  const url = (attachment.url || "").trim();
  if (!label || !url) return;
  inv.attachments = inv.attachments || [];
  inv.attachments.push({ label, url });
  inv.updatedAt = new Date().toISOString();
  inv.history.push({ at: inv.updatedAt, by: actorLabel || "Rendszer", action: `Csatolmány hozzáadva: ${label}` });
  write(KEYS.investigations, list);
  logAudit(actorLabel, "Csatolmány hozzáadva belső vizsgálathoz", `${id} — ${label}`);
}
export function removeInvestigationAttachment(id, index, actorLabel) {
  const list = getInvestigations();
  const inv = list.find((i) => i.id === id);
  if (!inv || !inv.attachments || !inv.attachments[index]) return;
  const removed = inv.attachments[index];
  inv.attachments.splice(index, 1);
  inv.updatedAt = new Date().toISOString();
  inv.history.push({ at: inv.updatedAt, by: actorLabel || "Rendszer", action: `Csatolmány eltávolítva: ${removed.label}` });
  write(KEYS.investigations, list);
  logAudit(actorLabel, "Csatolmány eltávolítva belső vizsgálatból", `${id} — ${removed.label}`);
}

/* ---------- Fedett Műveletek (Covert Operations) --------------------------
   Engedélyezett, kódnevesített fedett/nyomozási műveletek — ki rendelte el,
   ki hajtja végre, mi a cél, milyen minősítésű. Külön a Belső Vizsgálati
   Rendszertől: az nem az USSS saját állományának fegyelmi ügye, hanem
   kifelé irányuló, proaktív nyomozati/felderítési tevékenység. */
/* Fedőnév-javaslat a cél/leírás szövege alapján — a rendszernek nincs
   szervere, ezért nem hívunk külső AI API-t (nyilvános repóban egy
   beégetett API-kulcs ellopható lenne), hanem helyben, kulcsszó-egyezés
   alapján választunk tematikusan illő nevet, "Operation "-előtaggal. Ha
   a leírásban nincs felismerhető téma, valódi, dokumentált történelmi
   hadműveleti fedőnevekre esik vissza — nem kitalált szavakra. */
const CODENAME_THEMES = [
  { keywords: ["korrupció", "megveszteget", "csalás", "sikkasztás", "visszaélés"], pool: ["Ledger", "Backhand", "Greenlight", "Kickback", "Hollow Purse"] },
  { keywords: ["árulás", "hazaárulás", "kém", "beépített", "informátor"], pool: ["Judas", "Double Cross", "False Flag", "Trojan Horse", "Sleeper"] },
  { keywords: ["csempész", "fegyver", "drog", "kábítószer"], pool: ["Contraband", "Blacktide", "Iron River", "Smokescreen", "Dead Drop"] },
  { keywords: ["emberrablás", "túsz", "elrabol"], pool: ["Ransom", "Silent Hostage", "Broken Chain", "Lockdown"] },
  { keywords: ["terror", "robbant", "bomba"], pool: ["Firebreak", "Trip Wire", "Blast Radius", "Deadline"] },
  { keywords: ["zsarol", "fenyeget"], pool: ["Coercion", "Pressure Point", "Iron Grip"] },
  { keywords: ["merénylet", "gyilkos", "likvidál"], pool: ["Nightfall", "Cold Trigger", "Last Rites"] },
  { keywords: ["hacker", "adatlopás", "kiber", "feltör"], pool: ["Backdoor", "Ghost Wire", "Firewall Breach"] },
  { keywords: ["pénzmos"], pool: ["Clean Slate", "Laundry Line", "Hollow Vault"] },
];
const DEFAULT_CODENAME_POOL = [
  "Overlord", "Torch", "Market Garden", "Neptune", "Mincemeat", "Fortitude", "Chastise",
  "Paperclip", "Mongoose", "Ivy Bells", "Eagle Claw", "Just Cause", "Urgent Fury",
  "Praying Mantis", "Golden Pheasant", "Nimrod", "Desert Shield", "Desert Storm",
  "Nifty Package", "El Dorado Canyon", "Uphold Democracy", "Cyclone", "Rolling Thunder",
];
export function suggestCodename(descriptionText) {
  const text = (descriptionText || "").toLowerCase();
  const matched = CODENAME_THEMES.filter((t) => t.keywords.some((k) => text.includes(k)));
  const pool = matched.length ? matched.flatMap((t) => t.pool) : DEFAULT_CODENAME_POOL;
  const name = pool[Math.floor(Math.random() * pool.length)];
  return `Operation ${name}`;
}
/* A tárolt fedőnév megjelenítésekor csak akkor teszünk elé "Operation "
   szót, ha a mentett érték maga még nem tartalmazza — így a régebbi,
   előtag nélkül mentett rekordok is helyesen jelennek meg, az újak
   (amik már a javaslatból vagy kézzel "Operation ..."-ként érkeztek)
   pedig nem duplázódnak. */
export function formatCodename(codename) {
  const name = (codename || "").trim();
  if (!name) return "—";
  return /^operation\b/i.test(name) ? name : `Operation ${name}`;
}

const DEFAULT_CO_CLASSIFICATIONS = ["Bizalmas", "Titkos", "Szigorúan titkos"];
export function getCovertOpClassifications() {
  return read(KEYS.covertOpClassifications, DEFAULT_CO_CLASSIFICATIONS);
}
export function addCovertOpClassification(name, actorLabel) {
  const trimmed = (name || "").trim();
  if (!trimmed) return;
  const list = getCovertOpClassifications();
  if (list.some((c) => c.toLowerCase() === trimmed.toLowerCase())) return;
  list.push(trimmed);
  write(KEYS.covertOpClassifications, list);
  logAudit(actorLabel, "Fedett műveleti minősítés hozzáadva", trimmed);
}
export function removeCovertOpClassification(name, actorLabel) {
  write(KEYS.covertOpClassifications, getCovertOpClassifications().filter((c) => c !== name));
  logAudit(actorLabel, "Fedett műveleti minősítés törölve", name);
}

export const CO_STATUSES = ["Tervezés alatt", "Aktív", "Felfüggesztve", "Lezárva – sikeres", "Lezárva – sikertelen", "Megszakítva"];
export const CO_CLOSED_STATUSES = ["Lezárva – sikeres", "Lezárva – sikertelen", "Megszakítva"];

function nextCovertOpId() {
  const seq = Math.max(1, read(KEYS.nextCovertOpSeq, 1));
  return { id: `OP-${String(seq).padStart(3, "0")}`, seq };
}
export function getCovertOps() {
  return read(KEYS.covertOps, []);
}
export function getCovertOp(id) {
  return getCovertOps().find((o) => o.id === id);
}
export function createCovertOp(fields, actorLabel) {
  const { id, seq } = nextCovertOpId();
  const now = new Date().toISOString();
  const op = {
    id,
    codename: (fields.codename || "").trim(),
    objective: (fields.objective || "").trim(),
    targetSubject: (fields.targetSubject || "").trim(),
    authorizedBy: (fields.authorizedBy || "").trim(),
    authorizedByRank: (fields.authorizedByRank || "").trim(),
    leadOperative: (fields.leadOperative || "").trim(),
    classification: fields.classification || getCovertOpClassifications()[0],
    status: "Tervezés alatt",
    operatives: [],
    subjects: [],
    subjectSeq: 0,
    attachments: [],
    report: "",
    startDate: fields.startDate || now.slice(0, 10),
    endDate: null,
    createdBy: actorLabel || "Rendszer",
    createdAt: now,
    updatedAt: now,
    history: [{ at: now, by: actorLabel || "Rendszer", action: "Művelet létrehozva" }],
  };
  const list = getCovertOps();
  list.unshift(op);
  write(KEYS.covertOps, list);
  write(KEYS.nextCovertOpSeq, seq + 1);
  logAudit(actorLabel, "Fedett művelet létrehozva", `${id} — Operation ${op.codename}`);
  return op;
}
export function updateCovertOp(id, patch, actorLabel) {
  const list = getCovertOps();
  const op = list.find((o) => o.id === id);
  if (!op) return null;
  const changes = Object.entries(patch).filter(([key, value]) => value !== undefined && op[key] !== value);
  changes.forEach(([key, value]) => { op[key] = value; });
  if (changes.length) {
    const fieldLabels = { status: "Státusz", objective: "Cél", targetSubject: "Célszemély/szervezet", authorizedBy: "Engedélyező", authorizedByRank: "Engedélyező rangja", leadOperative: "Művelet vezetője", classification: "Minősítés", report: "Jelentés", codename: "Fedőnév" };
    const label = changes.map(([key]) => fieldLabels[key] || key).join(", ");
    op.updatedAt = new Date().toISOString();
    op.history = op.history || [];
    op.history.push({ at: op.updatedAt, by: actorLabel || "Rendszer", action: `${label} frissítve` });
    write(KEYS.covertOps, list);
    logAudit(actorLabel, "Fedett művelet frissítve", `${id} — ${label}`);
  }
  return op;
}
export function addOperative(opId, operative, actorLabel) {
  const list = getCovertOps();
  const op = list.find((o) => o.id === opId);
  if (!op) return;
  const name = (operative.name || "").trim();
  if (!name) return;
  const codename = (operative.codename || "").trim();
  op.operatives = op.operatives || [];
  op.operatives.push({ usssId: (operative.usssId || "").trim(), name, codename });
  op.updatedAt = new Date().toISOString();
  op.history.push({ at: op.updatedAt, by: actorLabel || "Rendszer", action: `Végrehajtó hozzáadva: ${name}${codename ? ` — kódnév: ${codename}` : ""}` });
  write(KEYS.covertOps, list);
  logAudit(actorLabel, "Végrehajtó hozzáadva fedett művelethez", `${opId} — ${name}`);
}
export function removeOperative(opId, index, actorLabel) {
  const list = getCovertOps();
  const op = list.find((o) => o.id === opId);
  if (!op || !op.operatives || !op.operatives[index]) return;
  const removed = op.operatives[index];
  op.operatives.splice(index, 1);
  op.updatedAt = new Date().toISOString();
  op.history.push({ at: op.updatedAt, by: actorLabel || "Rendszer", action: `Végrehajtó eltávolítva: ${removed.name}` });
  write(KEYS.covertOps, list);
  logAudit(actorLabel, "Végrehajtó eltávolítva fedett műveletből", `${opId} — ${removed.name}`);
}
/* Gyanúsítottak/célszemélyek NATO-betűzéses jelöléssel (Subject Alpha,
   Subject Bravo, …) — valós fedett nyomozati gyakorlat, amikor a valódi
   kilétet (még) nem lehet vagy nem szabad rögzíteni. A jelölés a
   hozzáadás sorrendjéhez van kötve (subjectSeq), nem a tömbindexhez, így
   egy korábbi gyanúsított törlése nem nevezi át a többit. */
const NATO_ALPHABET = ["Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot", "Golf", "Hotel", "India", "Juliett", "Kilo", "Lima", "Mike", "November", "Oscar", "Papa", "Quebec", "Romeo", "Sierra", "Tango", "Uniform", "Victor", "Whiskey", "X-ray", "Yankee", "Zulu"];
export function addSubject(opId, { name, notes }, actorLabel) {
  const list = getCovertOps();
  const op = list.find((o) => o.id === opId);
  if (!op) return;
  const trimmedName = (name || "").trim();
  if (!trimmedName) return;
  op.subjects = op.subjects || [];
  op.subjectSeq = op.subjectSeq || 0;
  const label = `Subject ${NATO_ALPHABET[op.subjectSeq % NATO_ALPHABET.length]}`;
  op.subjectSeq += 1;
  op.subjects.push({ label, name: trimmedName, notes: (notes || "").trim() });
  op.updatedAt = new Date().toISOString();
  op.history.push({ at: op.updatedAt, by: actorLabel || "Rendszer", action: `Gyanúsított hozzáadva: ${label} — ${trimmedName}` });
  write(KEYS.covertOps, list);
  logAudit(actorLabel, "Gyanúsított hozzáadva fedett művelethez", `${opId} — ${label}: ${trimmedName}`);
}
export function removeSubject(opId, index, actorLabel) {
  const list = getCovertOps();
  const op = list.find((o) => o.id === opId);
  if (!op || !op.subjects || !op.subjects[index]) return;
  const removed = op.subjects[index];
  op.subjects.splice(index, 1);
  op.updatedAt = new Date().toISOString();
  op.history.push({ at: op.updatedAt, by: actorLabel || "Rendszer", action: `Gyanúsított eltávolítva: ${removed.label} — ${removed.name}` });
  write(KEYS.covertOps, list);
  logAudit(actorLabel, "Gyanúsított eltávolítva fedett műveletből", `${opId} — ${removed.label}`);
}
export function closeCovertOp(id, { status, report }, actorLabel) {
  if (!CO_CLOSED_STATUSES.includes(status)) return null;
  const list = getCovertOps();
  const op = list.find((o) => o.id === id);
  if (!op) return null;
  op.status = status;
  if (report !== undefined) op.report = report;
  op.endDate = new Date().toISOString().slice(0, 10);
  op.updatedAt = new Date().toISOString();
  op.history = op.history || [];
  op.history.push({ at: op.updatedAt, by: actorLabel || "Rendszer", action: `Művelet lezárva — ${status}` });
  write(KEYS.covertOps, list);
  logAudit(actorLabel, "Fedett művelet lezárva", `${id} — ${status}`);
  return op;
}
export function reopenCovertOp(id, actorLabel) {
  const list = getCovertOps();
  const op = list.find((o) => o.id === id);
  if (!op) return null;
  op.status = "Aktív";
  op.endDate = null;
  op.updatedAt = new Date().toISOString();
  op.history = op.history || [];
  op.history.push({ at: op.updatedAt, by: actorLabel || "Rendszer", action: "Művelet újranyitva" });
  write(KEYS.covertOps, list);
  logAudit(actorLabel, "Fedett művelet újranyitva", id);
  return op;
}
export function deleteCovertOp(id, actorLabel) {
  const op = getCovertOp(id);
  write(KEYS.covertOps, getCovertOps().filter((o) => o.id !== id));
  logAudit(actorLabel, "Fedett művelet törölve", op ? `${id} — Operation ${op.codename}` : id);
}
export function addCovertOpAttachment(id, attachment, actorLabel) {
  const list = getCovertOps();
  const op = list.find((o) => o.id === id);
  if (!op) return;
  const label = (attachment.label || "").trim();
  const url = (attachment.url || "").trim();
  if (!label || !url) return;
  op.attachments = op.attachments || [];
  op.attachments.push({ label, url });
  op.updatedAt = new Date().toISOString();
  op.history.push({ at: op.updatedAt, by: actorLabel || "Rendszer", action: `Csatolmány hozzáadva: ${label}` });
  write(KEYS.covertOps, list);
  logAudit(actorLabel, "Csatolmány hozzáadva fedett művelethez", `${id} — ${label}`);
}
export function removeCovertOpAttachment(id, index, actorLabel) {
  const list = getCovertOps();
  const op = list.find((o) => o.id === id);
  if (!op || !op.attachments || !op.attachments[index]) return;
  const removed = op.attachments[index];
  op.attachments.splice(index, 1);
  op.updatedAt = new Date().toISOString();
  op.history.push({ at: op.updatedAt, by: actorLabel || "Rendszer", action: `Csatolmány eltávolítva: ${removed.label}` });
  write(KEYS.covertOps, list);
  logAudit(actorLabel, "Csatolmány eltávolítva fedett műveletből", `${id} — ${removed.label}`);
}

/* Kereszthivatkozás Belső Vizsgálat ↔ Fedett Művelet között. A kapcsolat
   csak a vizsgálat oldalán tárolódik (inv.linkedOps), a fedett művelet
   oldalán egy visszakeresés (getInvestigationsLinkedToOp) mutatja meg —
   így egyetlen forrásból származik az igazság, nem tud szétcsúszni. */
export function linkCovertOp(investigationId, opId, actorLabel) {
  const list = getInvestigations();
  const inv = list.find((i) => i.id === investigationId);
  const op = getCovertOp(opId);
  if (!inv || !op) return;
  inv.linkedOps = inv.linkedOps || [];
  if (inv.linkedOps.includes(opId)) return;
  inv.linkedOps.push(opId);
  inv.updatedAt = new Date().toISOString();
  inv.history.push({ at: inv.updatedAt, by: actorLabel || "Rendszer", action: `Fedett művelet hozzárendelve: ${opId} — Operation ${op.codename}` });
  write(KEYS.investigations, list);
  logAudit(actorLabel, "Fedett művelet hozzárendelve vizsgálathoz", `${investigationId} ↔ ${opId}`);
}
export function unlinkCovertOp(investigationId, opId, actorLabel) {
  const list = getInvestigations();
  const inv = list.find((i) => i.id === investigationId);
  if (!inv) return;
  inv.linkedOps = (inv.linkedOps || []).filter((id) => id !== opId);
  inv.updatedAt = new Date().toISOString();
  inv.history.push({ at: inv.updatedAt, by: actorLabel || "Rendszer", action: `Fedett művelet kapcsolat megszüntetve: ${opId}` });
  write(KEYS.investigations, list);
  logAudit(actorLabel, "Fedett művelet kapcsolat megszüntetve", `${investigationId} ↔ ${opId}`);
}
export function getInvestigationsLinkedToOp(opId) {
  return getInvestigations().filter((i) => (i.linkedOps || []).includes(opId));
}

/* ---------- Global search ------------------------------------------------*/
export function globalSearch(query) {
  const q = query.trim().toLowerCase();
  if (!q) return { personnel: [], modules: [], protocols: [], locations: [], operations: [] };

  const personnel = getPersonnel().filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.usssId.toLowerCase().includes(q) ||
      p.position.toLowerCase().includes(q) ||
      Object.entries(p.modules || {}).some(([code, rec]) => {
        const st = moduleState(p, code);
        return code.toLowerCase() === q || st.label.toLowerCase().includes(q);
      })
  );
  const modules = MODULES.filter(
    (m) => m.code.toLowerCase().includes(q) || m.name.toLowerCase().includes(q)
  );
  const protocols = getProtocols().filter(
    (p) => p.id.toLowerCase().includes(q) || p.moduleCode.toLowerCase().includes(q)
  );
  const locations = getLocations().filter(
    (l) => l.name.toLowerCase().includes(q) || l.place.toLowerCase().includes(q)
  );
  const operations = getOperationRecords().filter((record) =>
    [record.id, record.title, record.type, record.owner, record.location, record.protectee, record.description].join(" ").toLowerCase().includes(q)
  );
  return { personnel, modules, protocols, locations, operations };
}
