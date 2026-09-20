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
  RECRUITMENT_QUESTIONS, EXAM_QUESTIONS, EXAM_CATEGORIES, EXAM_CATEGORY_CRITERIA, RANK_ORDER,
} from "./data.js?v=29";

/* v7: Roxwood/Cayo Perico eltávolítva, csak Los Santos térkép maradt. */
const NS = "usss_ets_v7_";

/* ---------- Megosztott adat-szinkronizálás (Állomány, Hozzáférési kódok) --
   Ezek a legkorábban helyben (localStorage-ban, csak az adott böngészőben)
   tárolt adatok voltak, ami azt jelentette, hogy egy admin által hozzáadott
   új ember/kód csak az Ő eszközén létezett — máshonnan senki sem tudott vele
   bejelentkezni. Mostantól ez a két adatkör GitHub-on, egy publikus repóban
   tárolt JSON fájlként (data/personnel.json, data/access-codes.json) él:
   OLVASÁS bárhonnan, közvetlenül, hitelesítés nélkül (nyilvános fájl); ÍRÁS
   a már meglévő GitHub Worker proxin keresztül (lásd utils.js
   uploadFileToGitHub — ugyanaz a WORKER_SECRET, ugyanaz a szűk, csak
   uploads/ és data/*.json írására korlátozott képesség).
   ŐSZINTÉN: ez "utoljára ír nyer" szinkron, nincs ütközés-feloldás — ha két
   admin szinte egyszerre módosít, az egyik felülírhatja a másikét. Egy kis
   csapatnak ez elfogadható korlát, valódi többfelhasználós adatbázisnak nem
   helyettesítője. */
const GH_WORKER_URL = "https://u-s-s-s-traning.tothkornel511.workers.dev/";
const GH_WORKER_SECRET = "Bhq751orJyX0wqHR8fC0Adt_J29YdF23";
const GH_DATA_RAW_BASE = "https://raw.githubusercontent.com/tothkornel511-prog/U.S.S.S-Traning/main/data/";

async function pushSharedDataToGithub(filename, content) {
  try {
    const res = await fetch(GH_WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Worker-Secret": GH_WORKER_SECRET },
      body: JSON.stringify({ type: "data-put", path: `data/${filename}`, content }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function fetchSharedData(filename) {
  try {
    const res = await fetch(`${GH_DATA_RAW_BASE}${filename}?_=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/* App-indításkor hívva (lásd app.js) — még az első render ELŐTT lefut, hogy
   a felhasználó rögtön a legfrissebb, mindenki számára közös Állományt és
   Hozzáférési kódokat lássa, ne a saját böngészőjében esetleg elavult
   helyi másolatot. Ha a hálózati kérés sikertelen (nincs net, GitHub le van),
   csendben megmarad a helyi (localStorage-beli) másolat — ez a "működik
   internet nélkül is" tartalék. */
export async function syncSharedDataFromGithub() {
  const [personnel, accessCodes, instructorData] = await Promise.all([
    fetchSharedData("personnel.json"),
    fetchSharedData("access-codes.json"),
    fetchSharedData("instructors.json"),
  ]);
  if (Array.isArray(personnel)) write(KEYS.personnel, personnel);
  if (Array.isArray(accessCodes)) write(KEYS.accessCodes, accessCodes);
  if (instructorData && Array.isArray(instructorData.instructors)) write(KEYS.instructors, instructorData.instructors);
  if (instructorData && instructorData.moduleInstructors && typeof instructorData.moduleInstructors === "object") {
    write(KEYS.moduleInstructors, instructorData.moduleInstructors);
  }
}
/* Az Oktatók adatai (nyilvántartás + modulonkénti szabad szöveg mező) egy
   közös data/instructors.json fájlba mentődnek, ugyanúgy háttérben,
   ugyanazzal a Worker-rel, mint az Állomány — lásd a fenti bekezdést. */
function pushInstructorsShared() {
  pushSharedDataToGithub("instructors.json", {
    instructors: read(KEYS.instructors, []),
    moduleInstructors: read(KEYS.moduleInstructors, {}),
  });
}
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
  trainingPlans: NS + "training_plans",
  nextTrainingPlan: NS + "next_training_plan_seq",
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
  channelCategories: NS + "ch_categories",
  channelDocs: NS + "ch_docs",
  channelQuestions: NS + "ch_questions",
  trainingCategories: NS + "tc_categories",
  trainingFiles: NS + "tc_files",
  medicalRecords: NS + "medical_records",
  medicalIntervals: NS + "medical_intervals",
  instructors: NS + "instructors",
  moduleInstructors: NS + "module_instructors",
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
    write(KEYS.trainingPlans, []);
    write(KEYS.nextTrainingPlan, 1);
    write(KEYS.instructors, []);
    write(KEYS.moduleInstructors, {});
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
  applyTrainingPlansSeedPatch();
  applyInvestigationSeedPatch();
  applyTrainingPlanMultiModulePatch();
  applyChannelsToDocEngineMigration();
  applyTrainingCenterSeedPatch();
  applyTrainingCenterRankCategoriesPatch();
  applyInstructorsSeedPatch();
  applyPositionCatalogPatch();
}

/* Célzott, ismételten lefuttatható kiegészítés: az önkormányzati ranglétra
   bővült (Campaign Manager, Secretary of Transportation, Administration) —
   ez pótolja be a korábban már seedelt böngészőknél a hiányzó pozíciókat a
   választható listában. addPosition() eleve idempotens (névre nézve nem
   duplikál), ezért bátran hívható minden indításkor. */
function applyPositionCatalogPatch() {
  POSITIONS.forEach((g) => g.items.forEach((name) => {
    if (!getPositions().includes(name)) addPosition(name, g.group, "Rendszer");
  }));
}

/* Célzott seedelés: az Oktatók nyilvántartás — korábban telepített
   böngészőknél a fenti "seeded" blokk már lefutott, így ez pótolja be a
   hiányzó kulcsot. Szándékosan ÜRES listával indul (lásd data.js-hez
   hasonlóan: nincs előre kitöltött oktató egyik modulnál sem — ezt az
   admin/oktatásvezető tölti fel manuálisan). */
function applyInstructorsSeedPatch() {
  if (read(KEYS.instructors, null) === null) {
    write(KEYS.instructors, []);
  }
  if (read(KEYS.moduleInstructors, null) === null) {
    write(KEYS.moduleInstructors, {});
  }
}

/* Célzott seedelés: a Training Center (kategorizált fájlkönyvtár) modul —
   csak a Super Admin számára elérhető. A kategóriák a tényleges fokozati
   rendszert (ref.LEVELS) követik, ugyanazt, amit a Kiképzési Áttekintés is
   használ — nem egy külön, témák szerinti listát. */
const TRAINING_CATEGORY_SEED = [
  ...LEVELS.map((l) => l.label),
  "Önkormányzati adminisztráció",
  "Adóhatósági szolgálat (LSNTA)",
];
/* Korábbi alapértelmezett listák — csak azért kellenek még, hogy felismerjük
   és lecseréljük azokon a böngészőkön, ahol már lefutott egy régebbi seed,
   de még nem került bele valódi tartalom (fájl). */
const OLD_TOPIC_TRAINING_CATEGORY_SEED = [
  "Alapvető ismeretek", "Kommunikáció", "Rádióhasználat", "Védelem", "Sofőri képzés",
  "Taktikai képzés", "Védett személyek", "Védett helyszínek", "Konvoj", "Vészhelyzetek",
  "Erőhasználat", "Fegyverismeret", "Egyéb oktatási anyagok",
];
const OLD_RANK_ONLY_TRAINING_CATEGORY_SEED = [...LEVELS.map((l) => l.label), "Adminisztráció"];
function applyTrainingCenterSeedPatch() {
  if (read(KEYS.trainingCategories, null) === null) {
    write(KEYS.trainingCategories, []);
    write(KEYS.trainingFiles, []);
  }
  if (read(KEYS.trainingCategories, []).length === 0) {
    TRAINING_CATEGORY_SEED.forEach((name) => createTrainingCategory(name, "Rendszer"));
  }
}
function replaceUntouchedTrainingCategories(oldSeed) {
  const names = read(KEYS.trainingCategories, []).map((c) => c.name);
  const isUntouched = names.length === oldSeed.length && oldSeed.every((n) => names.includes(n));
  const hasAnyContent = read(KEYS.trainingFiles, []).length > 0;
  if (isUntouched && !hasAnyContent) {
    write(KEYS.trainingCategories, []);
    TRAINING_CATEGORY_SEED.forEach((name) => createTrainingCategory(name, "Rendszer"));
    return true;
  }
  return false;
}
function applyTrainingCenterRankCategoriesPatch() {
  replaceUntouchedTrainingCategories(OLD_TOPIC_TRAINING_CATEGORY_SEED) ||
    replaceUntouchedTrainingCategories(OLD_RANK_ONLY_TRAINING_CATEGORY_SEED);
}
/* Egyszeri migráció: a korábbi, egyszerű "Csatornák" funkciót (szabadon
   elnevezett szobák bejegyzésekkel) felváltotta a gazdagabb kategória→
   dokumentum rendszer. Az üres (bejegyzés nélküli) régi csatornák nevét
   átmentjük új, üres kategóriaként, hogy a korábban már elvégzett
   elnevezési munka (pl. "Vizsga anyagok") ne vesszen el — valódi tartalmú
   (bejegyzést tartalmazó) régi csatornát viszont szándékosan nem mentünk
   át automatikusan, mert a két adatmodell (bejegyzés vs. dokumentum) nem
   feleltethető meg egy az egyben egymásnak. */
function applyChannelsToDocEngineMigration() {
  const oldChannelsKey = NS + "channels";
  const oldPostsKey = NS + "channel_posts";
  const raw = localStorage.getItem(oldChannelsKey);
  if (raw === null) return;
  let oldChannels = [];
  let oldPosts = [];
  try { oldChannels = JSON.parse(raw) || []; } catch { oldChannels = []; }
  try { oldPosts = JSON.parse(localStorage.getItem(oldPostsKey) || "[]") || []; } catch { oldPosts = []; }
  const existingNames = getChannelCategories().map((c) => c.name);
  oldChannels.forEach((ch) => {
    const hasPosts = oldPosts.some((p) => p.channelId === ch.id);
    if (!hasPosts && ch.name && !existingNames.includes(ch.name)) {
      createChannelCategory(ch.name, "Rendszer (migrálva)");
    }
  });
  localStorage.removeItem(oldChannelsKey);
  localStorage.removeItem(oldPostsKey);
}

/* Célzott seedelés: a Kiképzési tervek (training plans) modul új
   localStorage-kulcsokat vezet be, amiket egy már korábban seedelt böngésző
   még nem ismer — ez a patch pótolja őket, minden mást érintetlenül hagyva. */
function applyTrainingPlansSeedPatch() {
  if (read(KEYS.trainingPlans, null) === null) {
    write(KEYS.trainingPlans, []);
    write(KEYS.nextTrainingPlan, 1);
  }
}

/* Célzott migráció: a kiképzési terveknél egy tervhez mostantól több modul
   is rendelhető (moduleCodes tömb) az eddigi egyetlen moduleCode helyett,
   és több jegyzőkönyv is kapcsolható (protocolIds tömb) az eddigi egyetlen
   protocolId helyett. Ez a régebbi terveket alakítja át, adatvesztés nélkül. */
function applyTrainingPlanMultiModulePatch() {
  const list = read(KEYS.trainingPlans, []);
  let changed = false;
  list.forEach((p) => {
    if (!p.moduleCodes) {
      p.moduleCodes = p.moduleCode ? [p.moduleCode] : [];
      changed = true;
    }
    if (!p.protocolIds) {
      p.protocolIds = p.protocolId ? [p.protocolId] : [];
      changed = true;
    }
  });
  if (changed) write(KEYS.trainingPlans, list);
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

/* ---------- Adatmentés / visszaállítás (fejlesztői eszköz) --------------
   Mivel minden adat a böngésző localStorage-ában él, ez az egyetlen védelem
   egy véletlen "böngésző-adatok törlése" vagy géphiba ellen. Csak a rendszer
   saját (usss_ets előtagú) kulcsait exportálja/importálja. */
const STORAGE_PREFIX = "usss_ets";

function allOwnKeys() {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    // A super_admin_ előtagú kulcsok (belépési kód / PIN hash) biztonsági
    // anyagok, nem alkalmazásadatok — se export/backup, se a tárhely-riport
    // ne tartalmazza őket.
    if (key && key.startsWith(STORAGE_PREFIX) && !key.includes("_super_admin_")) keys.push(key);
  }
  return keys;
}

export function exportAllData() {
  const data = {};
  allOwnKeys().forEach((key) => { data[key] = localStorage.getItem(key); });
  return { exportedAt: new Date().toISOString(), app: "usss-elite-training", data };
}

export function importAllData(payload, actorLabel) {
  if (!payload || typeof payload !== "object" || typeof payload.data !== "object") return false;
  const entries = Object.entries(payload.data).filter(([key]) => key.startsWith(STORAGE_PREFIX));
  if (!entries.length) return false;
  entries.forEach(([key, value]) => localStorage.setItem(key, value));
  logAudit(actorLabel, "Adat-visszaállítás importból", `${entries.length} kulcs`);
  return true;
}

const STORAGE_LABELS = {
  personnel: "Állomány", access_codes: "Hozzáférési kódok", locations: "Védett helyszínek",
  districts: "Térkép-körzetek", positions: "Pozíciók", protocols: "Jegyzőkönyvek",
  audit_log: "Eseménynapló", training_plans: "Kiképzési tervek", recruitment_questions: "Felvételi kérdésbank",
  applicants: "Jelentkezők", exams: "Felvételi vizsgák", operations: "Command Center rekordok",
  readiness: "Készültségi állapot", investigations: "Belső vizsgálatok", covert_ops: "Fedett műveletek",
  medical_records: "Orvosi bejegyzések", medical_intervals: "Orvosi időközök",
};
export function getStorageReport() {
  const all = allOwnKeys().map((key) => {
    const value = localStorage.getItem(key) || "";
    const suffix = key.replace(/^usss_ets(_v\d+)?_/, "");
    return { key, label: STORAGE_LABELS[suffix], bytes: new Blob([value]).size };
  });
  const known = all.filter((i) => i.label);
  const unknown = all.filter((i) => !i.label);
  const items = known.sort((a, b) => b.bytes - a.bytes);
  if (unknown.length) {
    items.push({ key: "misc", label: `Egyéb rendszerjelzők (${unknown.length} db)`, bytes: unknown.reduce((s, i) => s + i.bytes, 0) });
  }
  const total = all.reduce((sum, i) => sum + i.bytes, 0);
  return { items, total };
}

/* ---------- Static reference data ------------------------------------ */
export const ref = { LEVELS, SERVICE_STATUSES, MODULES, LEVEL_MODULE_ORDER, MAPS };

/* ---------- Szobánkénti hozzáférés (menüpontok / "rooms") ---------------
   Egyetlen forrás mind a navigációhoz (app.js), mind az admin felület
   jogosultság-kezelő űrlapjához (admin.js) — így a kettő sosem futhat szét.
   Az id egyben az útvonal is ("/" + id), a "dashboard" mindenkinek jár.
   A Training Center és a Csatornák SZÁNDÉKOSAN nincs ebben a listában —
   ezeket senkinek nem lehet kiosztani, kizárólag a Super Admin (USSS-118)
   éri el őket (lásd app.js onRouteChange és a channels.js / training-center.js
   saját isSuperAdmin() ellenőrzését). */
export const SECTIONS = [
  { id: "dashboard", label: "Vezérlőpult", icon: "◈", group: "Áttekintés" },
  { id: "personnel", label: "Állomány", icon: "☰", group: "Állomány & Képzés" },
  { id: "matrix", label: "Kiképzési Áttekintés", icon: "▦", group: "Állomány & Képzés" },
  { id: "instructors", label: "Oktatók", icon: "🎖", group: "Állomány & Képzés" },
  { id: "plans", label: "Kiképzési tervek", icon: "✎", group: "Állomány & Képzés" },
  { id: "protocols", label: "Jegyzőkönyvek", icon: "▤", group: "Állomány & Képzés" },
  { id: "recruitment", label: "Felvételi", icon: "✎", group: "Állomány & Képzés" },
  { id: "medical", label: "Orvosi alkalmasság", icon: "✚", group: "Állomány & Képzés" },
  { id: "locations", label: "Védett helyszínek", icon: "◆", group: "Objektumok" },
  { id: "map", label: "Térkép", icon: "⛶", group: "Objektumok" },
  { id: "readiness", label: "Készültségi rendszer", icon: "◉", group: "Vezetői irányítás" },
  { id: "operations/reports", label: "Jelentések", icon: "▤", group: "Parancsnoki Központ" },
  { id: "operations/threats", label: "Fenyegetésértékelés", icon: "△", group: "Parancsnoki Központ" },
  { id: "operations/events", label: "Események", icon: "◈", group: "Parancsnoki Központ" },
  { id: "operations/assignments", label: "Feladatok", icon: "▣", group: "Parancsnoki Központ" },
  { id: "operations/protectees", label: "Védett személyek", icon: "◆", group: "Parancsnoki Központ" },
  { id: "operations/escorts", label: "Kísérések", icon: "↗", group: "Parancsnoki Központ" },
  { id: "operations/advance", label: "Előzetes helyszínfelmérés", icon: "⌖", group: "Parancsnoki Központ" },
  { id: "operations/protection-levels", label: "Védelmi fokozatok", icon: "◉", group: "Parancsnoki Központ" },
  { id: "operations/protective-plans", label: "Védelmi tervek", icon: "⬡", group: "Parancsnoki Központ" },
  { id: "operations/intelligence", label: "Védelmi információk", icon: "⌁", group: "Parancsnoki Központ" },
  { id: "investigations", label: "Belső Vizsgálatok", icon: "⚖", group: "Parancsnoki Központ" },
  { id: "covert-ops", label: "Fedett Műveletek", icon: "◐", group: "Parancsnoki Központ" },
  { id: "operations/government", label: "Kormányzati névjegyzék", icon: "⌂", group: "Parancsnoki Központ" },
  { id: "operations/succession", label: "Elnöki öröklési sorrend", icon: "Ⅰ", group: "Parancsnoki Központ" },
  { id: "operations/calendar", label: "Naptár", icon: "▦", group: "Parancsnoki Központ" },
  { id: "operations/notifications", label: "Értesítések", icon: "◌", group: "Parancsnoki Központ" },
  { id: "admin", label: "Adminisztráció", icon: "⚙", group: "Rendszer" },
];

/* ---------- Márka-képek (branding) — admin felületről cserélhető ---------
   Minden "slot"-hoz van egy alapértelmezett, a repóba mentett kép; az admin
   ezt felülírhatja localStorage-ba mentett base64 képpel a Fejlesztés fülön.
   A CSS a --brand-img egyéni tulajdonságot olvassa (var(--brand-img,
   url(alapértelmezett))), a JS csak akkor állítja be inline stílusként, ha
   van felülírás — így override nélkül minden a statikus fájlt mutatja. */
export const MAX_BRANDING_BYTES = 700 * 1024;
export const BRANDING_SLOTS = [
  { id: "hero-main", label: "Fő háttérkép", usage: "Bejelentkező képernyő, teljes alkalmazás háttere", file: "hero-command.jpg" },
  { id: "hero-dashboard", label: "Vezérlőpult hero", usage: "Vezérlőpult fejléc", file: "hero-dashboard.jpg" },
  { id: "hero-command-ops", label: "Parancsnoki Központ hero", usage: "Command Center oldalak fejléce", file: "hero-command-ops.jpg" },
  { id: "hero-training", label: "Kiképzés hero (tervek)", usage: "Kiképzési tervek oldal fejléce", file: "hero-training.jpg" },
  { id: "hero-training-single", label: "Kiképzési Áttekintés hero", usage: "Kiképzési Áttekintés oldal fejléce", file: "hero-training-single.jpg" },
  { id: "hero-covert", label: "Fedett műveletek hero", usage: "Fedett Műveletek oldal fejléce", file: "hero-covert.jpg" },
  { id: "hero-investigations", label: "Belső Vizsgálatok hero", usage: "Belső Vizsgálatok oldal fejléce", file: "hero-investigations.jpg" },
  { id: "hero-recruitment", label: "Felvételi hero", usage: "Felvételi oldal fejléce", file: "hero-recruitment.jpg" },
  { id: "brand-strip", label: "Márka-sáv", usage: "Vezérlőpult záró sávja", file: "strip-brand-2.jpg" },
];
function brandingKey(id) {
  return NS + "branding_" + id;
}
export function getBrandingOverride(id) {
  return read(brandingKey(id), null);
}
export function getBrandingUrl(id) {
  const override = getBrandingOverride(id);
  if (override) return override;
  const slot = BRANDING_SLOTS.find((s) => s.id === id);
  return slot ? `assets/branding/${slot.file}` : "";
}
export function setBrandingOverride(id, dataUrl, actorLabel) {
  if (!write(brandingKey(id), dataUrl)) return false;
  logAudit(actorLabel, "Márka-kép cserélve", id);
  return true;
}
export function clearBrandingOverride(id, actorLabel) {
  localStorage.removeItem(brandingKey(id));
  logAudit(actorLabel, "Márka-kép visszaállítva alapértelmezettre", id);
}

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

/* Ranglétra szerinti sorrend (lásd data.js RANK_ORDER) — egyszerű, egyetlen
   .sort() hívás, nincs külön tárolt sorrend-mező: aki nincs a listán, a
   végére kerül, azon belül név szerint. Ugyanaz fut mindenhol (Állomány,
   Kiképzési Áttekintés), ezért csak itt van definiálva. */
export function positionRankIndex(position) {
  const i = RANK_ORDER.indexOf(position);
  return i === -1 ? RANK_ORDER.length : i;
}
export function sortByRank(list) {
  return [...list].sort((a, b) =>
    positionRankIndex(a.position) - positionRankIndex(b.position) || a.name.localeCompare(b.name, "hu")
  );
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
export function allModulesFlat() {
  return [
    ...new Map(
      Object.entries(LEVEL_MODULE_ORDER).flatMap(([, codes]) => codes).map((c) => [c, moduleByCode(c)])
    ).values(),
  ];
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
  const ok = write(KEYS.personnel, list);
  if (ok) pushSharedDataToGithub("personnel.json", list); // háttérben, nem várjuk meg
  return ok;
}
/* Fényképek is base64-ként kerülnek a localStorage-ba, ezért itt is
   szigorú méretkorlát kell (lásd MAX_ATTACHMENT_BYTES fentebb a tervek
   mellékleteinél ugyanígy) — sok kép esetén könnyen megtelhet a tárhely. */
export const MAX_PHOTO_BYTES = 400 * 1024;

export function upsertPerson(person, actorLabel) {
  const list = getPersonnel();
  const idx = list.findIndex((p) => p.usssId === person.usssId);
  if (idx >= 0) {
    const previous = list[idx];
    list[idx] = { ...previous, ...person };
    if (!savePersonnel(list)) return false;
    logAudit(actorLabel, "Profil frissítve", `${person.name || previous.name} (${person.usssId})`);
  } else {
    list.push({
      modules: {}, notes: "", photo: "", probationLifted: false,
      levelUpEligible: false, createdAt: new Date().toISOString(), ...person,
    });
    if (!savePersonnel(list)) return false;
    logAudit(actorLabel, "Új személy felvéve", `${person.name} (${person.usssId})`);
  }
  return true;
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
  pushSharedDataToGithub("access-codes.json", list); // háttérben, nem várjuk meg
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

/* ---------- Kiképzési tervek (Training Plans) --------------------------
   Egy jövőbeli oktatás/vizsga előzetes megtervezése: cél, résztvevők,
   oktató, időpont — még mielőtt ténylegesen megtörténne és jegyzőkönyv
   (protocol) készülne róla. A terv és a jegyzőkönyv szándékosan külön
   nyilvántartás: a terv "mit szeretnénk", a jegyzőkönyv "mi történt". */
export const PLAN_STATUSES = ["TERVEZETT", "FOLYAMATBAN", "LEZÁRVA", "TÖRÖLVE"];

/* A mellékletek base64-ként kerülnek a localStorage-ba (nincs szerver), ezért
   szigorú méret- és darabszám-korlát kell, különben megtelik a böngésző
   tárhelye, és a MENTÉS AZ EGÉSZ ALKALMAZÁSBAN elkezd hibázni. */
export const MAX_ATTACHMENT_BYTES = 3 * 1024 * 1024;
export const MAX_ATTACHMENTS_PER_PLAN = 6;
export const ALLOWED_ATTACHMENT_EXT = [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".png", ".jpg", ".jpeg"];

export function getTrainingPlans() {
  return read(KEYS.trainingPlans, []);
}
export function getTrainingPlan(id) {
  return getTrainingPlans().find((p) => p.id === id);
}
function nextTrainingPlanId() {
  const year = new Date().getFullYear();
  const seq = read(KEYS.nextTrainingPlan, 1);
  return { id: `KT-${year}-${String(seq).padStart(3, "0")}`, seq };
}
export function createTrainingPlan(data, actorLabel) {
  const { id, seq } = nextTrainingPlanId();
  const now = new Date().toISOString();
  const plan = {
    id,
    title: (data.title || "").trim(),
    moduleCodes: [...new Set(data.moduleCodes || [])].filter(Boolean),
    plannedDate: data.plannedDate || "",
    location: (data.location || "").trim(),
    instructor: (data.instructor || "").trim(),
    participants: data.participants || [], // [usssId, ...]
    objectives: (data.objectives || "").trim(),
    status: data.status || "TERVEZETT",
    notes: (data.notes || "").trim(),
    attachments: (data.attachments || []).slice(0, MAX_ATTACHMENTS_PER_PLAN), // [{id, name, type, size, dataUrl, uploadedBy, uploadedAt}]
    protocolIds: [],
    createdBy: actorLabel || "Rendszer",
    createdAt: now,
    updatedAt: now,
    history: [{ at: now, by: actorLabel || "Rendszer", action: "Terv létrehozva" }],
  };
  const list = getTrainingPlans();
  list.unshift(plan);
  if (!write(KEYS.trainingPlans, list)) return null;
  write(KEYS.nextTrainingPlan, seq + 1);
  logAudit(actorLabel, "Kiképzési terv létrehozva", `${id} — ${plan.title}`);
  return plan;
}
export function updateTrainingPlan(id, patch, actorLabel) {
  const list = getTrainingPlans();
  const plan = list.find((p) => p.id === id);
  if (!plan) return null;
  const previous = JSON.parse(JSON.stringify(plan));
  const changes = Object.entries(patch).filter(([key, value]) => value !== undefined && plan[key] !== value);
  changes.forEach(([key, value]) => { plan[key] = value; });
  if (plan.attachments) plan.attachments = plan.attachments.slice(0, MAX_ATTACHMENTS_PER_PLAN);
  plan.updatedAt = new Date().toISOString();
  plan.history = plan.history || [];
  if (changes.length) plan.history.push({ at: plan.updatedAt, by: actorLabel || "Rendszer", action: changes.map(([key]) => key).join(", ") + " módosítva" });
  if (!write(KEYS.trainingPlans, list)) {
    Object.assign(plan, previous);
    return null;
  }
  if (changes.length) logAudit(actorLabel, "Kiképzési terv módosítva", `${id} — ${changes.map(([key]) => key).join(", ")}`);
  return plan;
}
export function deleteTrainingPlan(id, actorLabel) {
  write(KEYS.trainingPlans, getTrainingPlans().filter((p) => p.id !== id));
  logAudit(actorLabel, "Kiképzési terv törölve", id);
}
export function linkTrainingPlanProtocol(id, protocolId, actorLabel) {
  const plan = getTrainingPlan(id);
  if (!plan) return null;
  const protocolIds = [...new Set([...(plan.protocolIds || []), protocolId])];
  return updateTrainingPlan(id, { status: "LEZÁRVA", protocolIds }, actorLabel);
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
export const EXAM_TARGET_MINUTES = 30;

export function getExamQuestions() {
  return EXAM_QUESTIONS;
}
export function getExamCategories() {
  return EXAM_CATEGORIES;
}
/* Kategóriánként 4-5 konkrét, a kérdésekhez illő értékelési szempont (ezek
   ugyanazok, amiket "Elfogadhatósági támpont"-ként a kérdéseknél is látni) —
   ezekre pontoz az oktatásvezető KATEGÓRIÁNKÉNT EGYSZER, nem soronként. */
export function getExamCategoryCriteria(category) {
  return EXAM_CATEGORY_CRITERIA[category] || [];
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
    categoryScores: {}, // { [category]: { [criterion]: 1-5 } }
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
  if (!a) { a = { questionId, score: null, note: "", critical: false, skipped: false }; exam.answers.push(a); }
  const previousScore = a.score;
  if (patch.score !== undefined) a.score = patch.score;
  if (patch.note !== undefined) a.note = patch.note;
  if (patch.critical !== undefined) a.critical = Boolean(patch.critical);
  if (patch.skipped !== undefined) a.skipped = Boolean(patch.skipped);
  write(KEYS.exams, list);
  if (actorLabel && patch.score !== undefined && previousScore !== patch.score) {
    logAudit(actorLabel, "Vizsgapont módosítva", `${examId} · ${questionId}: ${previousScore ?? "—"} → ${patch.score}`);
  }
}
export function setExamCategoryScore(examId, category, criterion, score) {
  const list = getExams();
  const exam = list.find((e) => e.id === examId);
  if (!exam) return;
  exam.categoryScores = exam.categoryScores || {};
  exam.categoryScores[category] = exam.categoryScores[category] || {};
  if (score === "" || score === null || score === undefined) {
    delete exam.categoryScores[category][criterion];
  } else {
    exam.categoryScores[category][criterion] = Math.max(1, Math.min(5, Number(score)));
  }
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

/* Pontszám, százalék, min. 80% eredmény és minőségi sáv kiszámítása.
   A "kihagyva" jelölésű kérdéseket a rendszer teljesen figyelmen kívül
   hagyja — sem a pontszámba, sem a maximumba nem számítanak bele, mintha
   fel sem tették volna őket (pl. mert a helyzet nem volt értelmezhető
   az adott jelöltnél). */
export function examScoreSummary(exam) {
  const skippedIds = new Set((exam.answers || []).filter((a) => a.skipped).map((a) => a.questionId));
  const scorableCount = EXAM_QUESTIONS.length - skippedIds.size;
  const total = (exam.answers || []).reduce((sum, a) => sum + (!a.skipped && typeof a.score === "number" ? a.score : 0), 0);
  const answered = (exam.answers || []).filter((a) => !a.skipped && typeof a.score === "number").length;
  const max = scorableCount * 5;
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
    const categoryQuestions = EXAM_QUESTIONS.filter((q) => q.category === category && !skippedIds.has(q.id));
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
  return { total, max, pct, passed, tier, answered, totalQuestions: scorableCount, skippedCount: skippedIds.size, categories, criticalErrors };
}

/* Rendszer által automatikusan javasolt felvételi döntés — a pontszám,
   a kritikus hibák és a kategória-értékelés átlaga alapján. Ez CSAK
   javaslat: sosem írja felül automatikusan a vizsgáztató saját
   döntését (exam.recommendation), az exam.js egy külön "Javaslat
   elfogadása" gombbal engedi átvenni, ha a vizsgáztató egyetért vele. */
export function examSuggestedRecommendation(exam) {
  const s = examScoreSummary(exam);
  const criteriaScores = Object.values(exam.categoryScores || {}).flatMap((c) => Object.values(c));
  const criteriaAvg = criteriaScores.length ? criteriaScores.reduce((sum, n) => sum + n, 0) / criteriaScores.length : null;

  if (s.criticalErrors > 0) {
    return { value: "rejected", label: "Nem ajánlott", reason: `${s.criticalErrors} kritikus hiba történt a vizsga során — ez önmagában kizáró ok.` };
  }
  if (!s.passed) {
    return { value: "rejected", label: "Nem ajánlott", reason: `A teljesítmény (${s.pct.toFixed(1)}%) a ${EXAM_PASS_PCT}%-os felvételi minimum alatt van.` };
  }
  if (criteriaAvg !== null && criteriaAvg < 3) {
    return { value: "conditional", label: "Feltételesen ajánlott", reason: `A kategória-értékelés átlaga alacsony (${criteriaAvg.toFixed(1)} / 5) a sikeres vizsgapontszám ellenére — érdemes külön megnézni.` };
  }
  if (s.pct < 85) {
    return { value: "conditional", label: "Feltételesen ajánlott", reason: `Éppen csak sikeres teljesítmény (${s.pct.toFixed(1)}%) — megfontolandó egy visszakérdezés vagy próbaidő.` };
  }
  return {
    value: "recommended",
    label: "Felvételre ajánlott",
    reason: `Sikeres vizsga (${s.pct.toFixed(1)}%), nincs kritikus hiba${criteriaAvg !== null ? `, jó kategória-értékelés (${criteriaAvg.toFixed(1)} / 5)` : ""}.`,
  };
}

/* Eltelt idő percben — vizsga közben "most"-ig, lezárt vizsgánál a
   lezárás időpontjáig. A cél max. EXAM_TARGET_MINUTES (30 perc). */
export function examElapsedMinutes(exam) {
  const start = new Date(exam.startedAt).getTime();
  const end = exam.endedAt ? new Date(exam.endedAt).getTime() : Date.now();
  return Math.max(0, (end - start) / 60000);
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
/* Csatolmányok — a rendszernek nincs szervere, ezért kétféle csatolmány létezik:
   1) "upload": a fájl ténylegesen feltöltve, Base64-ként a böngésző localStorage-ában tárolva
      (FileReader.readAsDataURL) — méretkorlátozott, mert a localStorage kvóta böngészőnként ~5-10MB.
   2) "link": külső helyen (Discord, Drive, Dropbox stb.) elérhető hivatkozás,
      pont úgy, ahogy a személyi profilkép is URL-ként van tárolva.
   Kép típusú csatolmányok (mindkét fajta) előnézeti miniatűrként jelennek meg. */
export const ATTACHMENT_MAX_UPLOAD_BYTES = 3 * 1024 * 1024;
const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|avif|svg|bmp)(\?.*)?$/i;
export function isImageAttachment(a) {
  if (!a || !a.url) return false;
  if (a.url.startsWith("data:image/")) return true;
  return IMAGE_EXT_RE.test(a.url);
}
export function formatFileSize(bytes) {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
export function addInvestigationAttachment(id, attachment, actorLabel) {
  const list = getInvestigations();
  const inv = list.find((i) => i.id === id);
  if (!inv) return;
  const label = (attachment.label || "").trim();
  const url = (attachment.url || "").trim();
  if (!label || !url) return;
  inv.attachments = inv.attachments || [];
  inv.attachments.push({ label, url, kind: attachment.kind === "upload" ? "upload" : "link", size: attachment.size || null });
  inv.updatedAt = new Date().toISOString();
  inv.history.push({ at: inv.updatedAt, by: actorLabel || "Rendszer", action: `Csatolmány hozzáadva: ${label}${attachment.kind === "upload" ? " (feltöltve)" : ""}` });
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
  op.attachments.push({ label, url, kind: attachment.kind === "upload" ? "upload" : "link", size: attachment.size || null });
  op.updatedAt = new Date().toISOString();
  op.history.push({ at: op.updatedAt, by: actorLabel || "Rendszer", action: `Csatolmány hozzáadva: ${label}${attachment.kind === "upload" ? " (feltöltve)" : ""}` });
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

/* ---------- Csatornák (Channels) — kategóriák → dokumentumok → kérdések --
   Gazdag, szabadon szerkeszthető tartalom-rendszer: az admin maga hozza
   létre a kategóriákat (pl. "Vizsga anyagok"), majd bennük dokumentumokat
   ír (cím, leírás, formázott szöveg, borítókép, galéria, kapcsolódó
   kérdések), automatikus mentéssel. Kizárólag a Super Admin éri el — lásd
   app.js route-védelme. Ugyanaz a szerver nélküli, localStorage-alapú
   korlát vonatkozik rá, mint minden más modulra. */
export const CHANNEL_DOC_STATUSES = ["Piszkozat", "Belső", "Publikált", "Archivált"];

export function getChannelCategories() {
  return read(KEYS.channelCategories, []);
}
export function getChannelCategory(id) {
  return getChannelCategories().find((c) => c.id === id);
}
export function createChannelCategory(name, actorLabel) {
  const trimmed = (name || "").trim();
  if (!trimmed) return null;
  const slug = trimmed.toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "csatorna";
  const list = getChannelCategories();
  let id = slug, n = 2;
  while (list.some((c) => c.id === id)) id = `${slug}-${n++}`;
  const category = { id, name: trimmed, createdBy: actorLabel || "Rendszer", createdAt: new Date().toISOString() };
  list.push(category);
  write(KEYS.channelCategories, list);
  logAudit(actorLabel, "Csatorna létrehozva", trimmed);
  return category;
}
export function renameChannelCategory(id, name, actorLabel) {
  const trimmed = (name || "").trim();
  if (!trimmed) return;
  const list = getChannelCategories();
  const cat = list.find((c) => c.id === id);
  if (!cat) return;
  const oldName = cat.name;
  cat.name = trimmed;
  write(KEYS.channelCategories, list);
  logAudit(actorLabel, "Csatorna átnevezve", `${oldName} → ${trimmed}`);
}
export function deleteChannelCategory(id, actorLabel) {
  const category = getChannelCategory(id);
  write(KEYS.channelCategories, getChannelCategories().filter((c) => c.id !== id));
  const docs = getChannelDocs(id);
  docs.forEach((doc) => deleteChannelDoc(doc.id, actorLabel));
  logAudit(actorLabel, "Csatorna törölve", category?.name || id);
}

function getAllChannelDocs() {
  return read(KEYS.channelDocs, []);
}
export function getChannelDocs(categoryId) {
  return getAllChannelDocs()
    .filter((d) => d.categoryId === categoryId)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}
export function getChannelDoc(id) {
  return getAllChannelDocs().find((d) => d.id === id);
}
export function createChannelDoc(categoryId, data, actorLabel) {
  const now = new Date().toISOString();
  const doc = {
    id: uid("CHD"),
    categoryId,
    title: (data.title || "Névtelen dokumentum").trim(),
    description: (data.description || "").trim(),
    content: (data.content || "").trim(),
    coverImage: data.coverImage || null,
    gallery: (data.gallery || []).slice(0, 20),
    status: CHANNEL_DOC_STATUSES.includes(data.status) ? data.status : "Piszkozat",
    createdBy: actorLabel || "Rendszer",
    createdAt: now,
    updatedBy: actorLabel || "Rendszer",
    updatedAt: now,
  };
  const list = getAllChannelDocs();
  list.push(doc);
  if (!write(KEYS.channelDocs, list)) return null;
  logAudit(actorLabel, "Csatorna-dokumentum létrehozva", doc.title);
  return doc;
}
export function updateChannelDoc(id, patch, actorLabel) {
  const list = getAllChannelDocs();
  const doc = list.find((d) => d.id === id);
  if (!doc) return null;
  const previous = JSON.parse(JSON.stringify(doc));
  Object.entries(patch).forEach(([key, value]) => { if (value !== undefined) doc[key] = value; });
  doc.updatedAt = new Date().toISOString();
  doc.updatedBy = actorLabel || "Rendszer";
  if (!write(KEYS.channelDocs, list)) {
    Object.assign(doc, previous);
    return null;
  }
  return doc;
}
export function deleteChannelDoc(id, actorLabel) {
  const doc = getChannelDoc(id);
  write(KEYS.channelDocs, getAllChannelDocs().filter((d) => d.id !== id));
  write(KEYS.channelQuestions, read(KEYS.channelQuestions, []).filter((q) => q.docId !== id));
  logAudit(actorLabel, "Csatorna-dokumentum törölve", doc?.title || id);
}

function getAllChannelQuestions() {
  return read(KEYS.channelQuestions, []);
}
export function getChannelQuestions(docId) {
  return getAllChannelQuestions().filter((q) => q.docId === docId);
}
export function createChannelQuestion(docId, data, actorLabel) {
  const question = {
    id: uid("CHQ"),
    docId,
    question: (data.question || "").trim(),
    options: (data.options || []).map((o) => (o || "").trim()).filter(Boolean),
    correctAnswer: (data.correctAnswer || "").trim(),
    explanation: (data.explanation || "").trim(),
    createdAt: new Date().toISOString(),
  };
  if (!question.question) return null;
  const list = getAllChannelQuestions();
  list.push(question);
  write(KEYS.channelQuestions, list);
  logAudit(actorLabel, "Csatorna-kérdés létrehozva", question.question.slice(0, 60));
  return question;
}
export function updateChannelQuestion(id, patch, actorLabel) {
  const list = getAllChannelQuestions();
  const q = list.find((x) => x.id === id);
  if (!q) return null;
  Object.entries(patch).forEach(([key, value]) => { if (value !== undefined) q[key] = value; });
  write(KEYS.channelQuestions, list);
  return q;
}
export function deleteChannelQuestion(id, actorLabel) {
  write(KEYS.channelQuestions, getAllChannelQuestions().filter((q) => q.id !== id));
  logAudit(actorLabel, "Csatorna-kérdés törölve", id);
}

/* ---------- Training Center — kategorizált fájlkönyvtár -------------------
   Egyszerű: kategóriák (a tényleges fokozati rendszert követve, lásd
   ref.LEVELS), bennük fájlok (feltöltve vagy külső linkként) — nincs
   kézzel írt dokumentum-szerkesztő, csak feltöltés és megnyitás (lásd
   utils.js previewAttachment: PDF/DOCX egyaránt közvetlenül, nagyban,
   új fülön nyílik meg, letöltés nélkül). Kizárólag a Super Admin éri el. */
export function getTrainingCategories() {
  return read(KEYS.trainingCategories, []);
}
export function getTrainingCategory(id) {
  return getTrainingCategories().find((c) => c.id === id);
}
export function createTrainingCategory(name, actorLabel) {
  const trimmed = (name || "").trim();
  if (!trimmed) return null;
  const slug = trimmed.toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "kategoria";
  const list = getTrainingCategories();
  let id = slug, n = 2;
  while (list.some((c) => c.id === id)) id = `${slug}-${n++}`;
  const category = { id, name: trimmed, createdBy: actorLabel || "Rendszer", createdAt: new Date().toISOString() };
  list.push(category);
  write(KEYS.trainingCategories, list);
  logAudit(actorLabel, "Training Center kategória létrehozva", trimmed);
  return category;
}
export function renameTrainingCategory(id, name, actorLabel) {
  const trimmed = (name || "").trim();
  if (!trimmed) return;
  const list = getTrainingCategories();
  const cat = list.find((c) => c.id === id);
  if (!cat) return;
  const oldName = cat.name;
  cat.name = trimmed;
  write(KEYS.trainingCategories, list);
  logAudit(actorLabel, "Training Center kategória átnevezve", `${oldName} → ${trimmed}`);
}
export function deleteTrainingCategory(id, actorLabel) {
  const category = getTrainingCategory(id);
  write(KEYS.trainingCategories, getTrainingCategories().filter((c) => c.id !== id));
  write(KEYS.trainingFiles, getAllTrainingFiles().filter((f) => f.categoryId !== id));
  logAudit(actorLabel, "Training Center kategória törölve", category?.name || id);
}

function getAllTrainingFiles() {
  return read(KEYS.trainingFiles, []);
}
export function getTrainingFiles(categoryId) {
  return getAllTrainingFiles()
    .filter((f) => f.categoryId === categoryId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}
export function createTrainingFile(categoryId, data, actorLabel) {
  const label = (data.label || "").trim();
  const url = (data.url || "").trim();
  if (!label || !url) return null;
  const file = {
    id: uid("TF"),
    categoryId,
    label,
    url,
    kind: data.kind === "upload" ? "upload" : "link",
    size: data.size || null,
    createdBy: actorLabel || "Rendszer",
    createdAt: new Date().toISOString(),
  };
  const list = getAllTrainingFiles();
  list.push(file);
  if (!write(KEYS.trainingFiles, list)) return null;
  logAudit(actorLabel, "Training Center fájl feltöltve", label);
  return file;
}
export function deleteTrainingFile(id, actorLabel) {
  const file = getAllTrainingFiles().find((f) => f.id === id);
  write(KEYS.trainingFiles, getAllTrainingFiles().filter((f) => f.id !== id));
  logAudit(actorLabel, "Training Center fájl törölve", file?.label || id);
}

/* ---------- Oktatók (modulonkénti egyetlen oktató + nyilvántartás) --------
   Két, szándékosan különálló adatkör:
   1) moduleInstructors: modulkódonként EGY szabad szöveg (lásd
      getModuleInstructor/setModuleInstructor) — ez lehet egy konkrét személy
      neve, VAGY egy szerepkör-jellegű megnevezés (pl. "Mindenkori LSNTA
      vezető"), ezért nem korlátozzuk a nyilvántartásban szereplő nevekre;
      a UI csak javaslatként (datalist) ajánlja fel a már felvett oktatókat.
   2) instructors: a lenti "Oktatói nyilvántartás" — egy-egy konkrét oktató
      neve/rangja + mely modulokat tanítja (jelölőnégyzetes lista). Ez a
      TÉNYLEGES forrás a legtöbb modul oktatójának megjelenítéséhez (lásd
      getInstructorsForModule) — csak az 1) pontban felsorolt kivételes
      kódoknál (ADM/LSNTA/GSD) él párhuzamosan, külön szabad szöveg.
   Mindkettő üresen indul — nincs előre kitöltött oktató sehol. Mindkettő
   szinkronizálódik GitHub-ra (data/instructors.json), ugyanúgy, mint az
   Állomány — lásd pushInstructorsShared / syncSharedDataFromGithub. */
export function getModuleInstructorMap() {
  return read(KEYS.moduleInstructors, {});
}
export function getModuleInstructor(code) {
  return getModuleInstructorMap()[code] || "";
}
export function setModuleInstructor(code, text, actorLabel) {
  const map = getModuleInstructorMap();
  const trimmed = (text || "").trim();
  if (trimmed) map[code] = trimmed; else delete map[code];
  write(KEYS.moduleInstructors, map);
  pushInstructorsShared();
  logAudit(actorLabel, "Modul oktatója frissítve", `${code}: ${trimmed || "— törölve —"}`);
}

export function getInstructors() {
  return read(KEYS.instructors, []).slice().sort((a, b) => a.name.localeCompare(b.name, "hu"));
}
export function getInstructor(id) {
  return read(KEYS.instructors, []).find((i) => i.id === id);
}
export function getInstructorsForModule(code) {
  return getInstructors().filter((i) => (i.modules || []).includes(code));
}
export function createInstructor(data, actorLabel) {
  const name = (data.name || "").trim();
  if (!name) return null;
  const instructor = {
    id: uid("INS"),
    name,
    rank: (data.rank || "").trim(),
    modules: Array.isArray(data.modules) ? [...new Set(data.modules)] : [],
    createdBy: actorLabel || "Rendszer",
    createdAt: new Date().toISOString(),
  };
  const list = read(KEYS.instructors, []);
  list.push(instructor);
  if (!write(KEYS.instructors, list)) return null;
  pushInstructorsShared();
  logAudit(actorLabel, "Oktató felvéve", name);
  return instructor;
}
export function updateInstructor(id, data, actorLabel) {
  const list = read(KEYS.instructors, []);
  const instructor = list.find((i) => i.id === id);
  if (!instructor) return null;
  if (data.name !== undefined) instructor.name = (data.name || "").trim() || instructor.name;
  if (data.rank !== undefined) instructor.rank = (data.rank || "").trim();
  if (data.modules !== undefined) instructor.modules = Array.isArray(data.modules) ? [...new Set(data.modules)] : [];
  write(KEYS.instructors, list);
  pushInstructorsShared();
  logAudit(actorLabel, "Oktató adatai módosítva", instructor.name);
  return instructor;
}
export function deleteInstructor(id, actorLabel) {
  const instructor = getInstructor(id);
  write(KEYS.instructors, read(KEYS.instructors, []).filter((i) => i.id !== id));
  pushInstructorsShared();
  logAudit(actorLabel, "Oktató törölve", instructor?.name || id);
}

/* ---------- Orvosi alkalmasság --------------------------------------------
   Fokozatonként admin által beállítható időköz — VAGY hétben, VAGY hónapban
   (bármelyik fokozatnál külön eldönthető, pl. az alacsonyabb fokozatoknál
   gyakoribb, hetekben megadott ellenőrzés is értelmes lehet). Amikor
   valakinél rögzítesz egy elvégzett orvosi vizsgálatot, a rendszer az Ő
   AKKORI fokozata alapján számolja ki és véglegesen eltárolja a bejegyzésen
   a következő esedékességet (egy utólagos fokozatváltás nem írja át a már
   rögzített, korábbi bejegyzések esedékességét — csak a KÖVETKEZŐ vizsgálat
   rögzítésekor számol az akkor érvényes fokozattal/időközzel). */
const DEFAULT_MEDICAL_INTERVAL = { amount: 12, unit: "month" };
export function getMedicalIntervals() {
  const stored = read(KEYS.medicalIntervals, null);
  const intervals = {};
  LEVELS.forEach((l) => {
    const entry = stored?.[l.id];
    // Visszamenőleges kompatibilitás: a korábbi verzió sima számot (hónapot)
    // tárolt objektum helyett — azt itt {amount, unit:"month"} alakra hozzuk.
    if (typeof entry === "number") intervals[l.id] = { amount: entry, unit: "month" };
    else if (entry && typeof entry === "object") intervals[l.id] = entry;
    else intervals[l.id] = { ...DEFAULT_MEDICAL_INTERVAL };
  });
  return intervals;
}
export function setMedicalInterval(levelId, amount, unit, actorLabel) {
  const intervals = getMedicalIntervals();
  const safeUnit = unit === "week" ? "week" : "month";
  const safeAmount = Math.max(1, Number(amount) || DEFAULT_MEDICAL_INTERVAL.amount);
  intervals[levelId] = { amount: safeAmount, unit: safeUnit };
  write(KEYS.medicalIntervals, intervals);
  logAudit(actorLabel, "Orvosi időköz módosítva", `${levelId} fokozat → ${safeAmount} ${safeUnit === "week" ? "hét" : "hónap"}`);
}

/* Tisztán UTC-ben számol, hogy elkerülje az "new Date(string)" (UTC-ként
   értelmezett) és a helyi időzóna szerint módosító setter-ek keverése
   miatti, időzóna-függő egy napos csúszást a dátumban. */
function addInterval(dateStr, amount, unit) {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (unit === "week") {
    return new Date(Date.UTC(y, m - 1, d + amount * 7)).toISOString().slice(0, 10);
  }
  return new Date(Date.UTC(y, m - 1 + amount, d)).toISOString().slice(0, 10);
}

function getAllMedicalRecords() {
  return read(KEYS.medicalRecords, []);
}
export function getMedicalRecords(usssId) {
  return getAllMedicalRecords()
    .filter((r) => r.usssId === usssId)
    .sort((a, b) => new Date(b.examDate) - new Date(a.examDate));
}
export function getLatestMedicalRecord(usssId) {
  return getMedicalRecords(usssId)[0] || null;
}
export function createMedicalRecord(usssId, data, actorLabel) {
  const person = getPerson(usssId);
  if (!person) return null;
  const examDate = data.examDate || new Date().toISOString().slice(0, 10);
  const intervals = getMedicalIntervals();
  const interval = intervals[person.level] || DEFAULT_MEDICAL_INTERVAL;
  const record = {
    id: uid("MED"),
    usssId,
    examDate,
    nextDueDate: addInterval(examDate, interval.amount, interval.unit),
    levelAtExam: person.level,
    examinedBy: (data.examinedBy || "").trim(),
    notes: (data.notes || "").trim(),
    createdBy: actorLabel || "Rendszer",
    createdAt: new Date().toISOString(),
  };
  const list = getAllMedicalRecords();
  list.push(record);
  if (!write(KEYS.medicalRecords, list)) return null;
  logAudit(actorLabel, "Orvosi vizsgálat rögzítve", `${person.name} (${usssId}) — ${examDate}`);
  return record;
}
export function deleteMedicalRecord(id, actorLabel) {
  const record = getAllMedicalRecords().find((r) => r.id === id);
  write(KEYS.medicalRecords, getAllMedicalRecords().filter((r) => r.id !== id));
  logAudit(actorLabel, "Orvosi bejegyzés törölve", record ? `${record.usssId} — ${record.examDate}` : id);
}
/* Állapot: "nincs-adat" (soha nem volt rögzítve), "lejart" (a következő
   esedékesség már elmúlt), "hamarosan" (30 napon belül esedékes), "rendben". */
export function medicalStatusFor(usssId) {
  const latest = getLatestMedicalRecord(usssId);
  if (!latest) return "nincs-adat";
  const dueInDays = (new Date(latest.nextDueDate) - new Date(new Date().toISOString().slice(0, 10))) / (1000 * 60 * 60 * 24);
  if (dueInDays < 0) return "lejart";
  if (dueInDays <= 30) return "hamarosan";
  return "rendben";
}

/* ---------- Global search ------------------------------------------------*/
export function globalSearch(query) {
  const q = query.trim().toLowerCase();
  if (!q) return { personnel: [], modules: [], protocols: [], locations: [], operations: [], plans: [] };

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
  const plans = getTrainingPlans().filter((p) =>
    [p.id, p.title, ...(p.moduleCodes || []), p.instructor, p.location].join(" ").toLowerCase().includes(q)
  );
  return { personnel, modules, protocols, locations, operations, plans };
}
