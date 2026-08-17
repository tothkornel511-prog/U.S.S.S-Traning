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
} from "./data.js?v=18";

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
    write(KEYS.seeded, true);
  }
  applyPositionPatch();
  applyHijSplitPatch();
  applyTheoryFillPatch();
  applyLocationIdFixPatch();
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

/* ---------- Global search ------------------------------------------------*/
export function globalSearch(query) {
  const q = query.trim().toLowerCase();
  if (!q) return { personnel: [], modules: [], protocols: [], locations: [] };

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
  return { personnel, modules, protocols, locations };
}
