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
} from "./data.js?v=5";

/* v5: Dominic Hayes pozíciója Oktatásvezető + garantált újra-seedelés. */
const NS = "usss_ets_v5_";
const KEYS = {
  personnel: NS + "personnel",
  accessCodes: NS + "access_codes",
  locations: NS + "locations",
  districts: NS + "districts",
  protocols: NS + "protocols",
  auditLog: NS + "audit_log",
  seeded: NS + "seeded",
  nextProtocol: NS + "next_protocol_seq",
};

/* Elméleti vizsgánál ez alatt a százalék alatt a modul nem számít teljesítettnek. */
export const THEORY_PASS_THRESHOLD = 80;

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
  if (read(KEYS.seeded, false)) return;
  write(KEYS.personnel, seedPersonnel());
  write(KEYS.accessCodes, ACCESS_CODES);
  write(KEYS.locations, PROTECTED_LOCATIONS);
  write(KEYS.districts, DISTRICTS);
  write(KEYS.protocols, []);
  write(KEYS.auditLog, AUDIT_LOG_SEED);
  write(KEYS.nextProtocol, 1);
  write(KEYS.seeded, true);
}

export function resetAllData() {
  Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
  seedIfNeeded();
}

/* ---------- Static reference data ------------------------------------ */
export const ref = { LEVELS, SERVICE_STATUSES, POSITIONS, MODULES, LEVEL_MODULE_ORDER, MAPS };

export function mapById(id) {
  return MAPS.find((m) => m.id === id) || MAPS[0];
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
  p.modules[code].examiner = examiner || "";
  p.modules[code].history = p.modules[code].history || [];
  if (theory !== null && theory !== undefined) {
    p.modules[code].history.push({
      date: new Date(theoryDate || Date.now()).toISOString(),
      type: "theory",
      theory,
      result: theory >= THEORY_PASS_THRESHOLD ? "pass" : "fail",
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
  p.modules[code].history = p.modules[code].history || [];
  p.modules[code].history.push({
    date: new Date().toISOString(),
    type: "practical",
    theory: p.modules[code].theory,
    result,
    ...extra,
  });
  savePersonnel(list);
  logAudit(actorLabel, "Gyakorlati vizsga rögzítve",
    `${p.name} – ${code}: ${prev || "—"} → ${result}${extra.protocolId ? ` (${extra.protocolId})` : ""}`);
  checkLevelUpEligibility(p, actorLabel);
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
  if (idx >= 0) list[idx] = { ...list[idx], ...stamped };
  else list.push({ id: loc.id || uid("LOC"), entrances: [], ...stamped });
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
  else list.push({ id: uid("D"), ...district });
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
