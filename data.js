/* ==========================================================================
   U.S.S.S. ELITE TRAINING SYSTEM — SEED DATA
   Ez a fájl csak a kezdeti / alap adatokat tartalmazza.
   Minden futásidejű adat a localStorage-ban (lásd js/store.js) él tovább.
   ========================================================================== */

export const LEVELS = [
  { id: "0", label: "0 – Próbaidős", short: "0" },
  { id: "I", label: "I – Kadét", short: "I" },
  { id: "II", label: "II – Sofőr", short: "II" },
  { id: "III", label: "III – Őrszem", short: "III" },
  { id: "IV", label: "IV – Operátor", short: "IV" },
  { id: "V", label: "V – Elit / Parancsnok", short: "V" },
];

export const SERVICE_STATUSES = ["Újonc", "Aktív", "Inaktív", "Felfüggesztett"];

export const POSITIONS = [
  { group: "U.S.S.S.", items: ["U.S.S.S Director", "U.S.S.S Agent"] },
  {
    group: "Önkormányzat",
    items: [
      "President",
      "Vice President",
      "Chief Of Staff",
      "Secretary of Defense",
      "Secretary of Homeland Security",
      "Secretary of Development",
      "Secretary of Public Relations",
      "Secretary of Health",
      "Attorney General",
      "Judge",
      "Lawyer",
    ],
  },
];

/* Minden modul EGYSZER szerepel az adatbázisban (H, I, J is), a "levels" tömb
   mondja meg, mely képzési szinte(ke)n jelenik meg. "spec" = szinten kívüli. */
export const MODULES = [
  { code: "0",    name: "Belépés, betanulás és bázisrend",              levels: ["0"],         theory: true,  practical: false },

  { code: "A",    name: "Alapvető ismeretek",                            levels: ["I"],         theory: true,  practical: false },
  { code: "G1",   name: "Erőnléti oktatás – alapfok",                    levels: ["I"],         theory: false, practical: true  },
  { code: "K",    name: "Kommunikációs tréning",                         levels: ["I"],         theory: true,  practical: false },
  { code: "L",    name: "Kód használat",                                 levels: ["I"],         theory: true,  practical: false },
  { code: "R",    name: "Szolgálati rend és dokumentáció",               levels: ["I"],         theory: true,  practical: false },

  { code: "B1",   name: "Kormányzati járművek vezetése – alapismeretek", levels: ["II"],        theory: true,  practical: true  },
  { code: "E",    name: "Egészségügyi oktatás",                          levels: ["II"],        theory: true,  practical: false },
  { code: "F",    name: "Lőfegyver használat alapjai",                   levels: ["II"],        theory: true,  practical: true  },
  { code: "G2",   name: "Közelharci oktatás – alapfok",                  levels: ["II"],        theory: false, practical: true  },
  { code: "N",    name: "Jogi ismeretek és kényszerítő eszközök",        levels: ["II"],        theory: true,  practical: false },
  { code: "P",    name: "Titoktartás és információvédelem",              levels: ["II"],        theory: true,  practical: false },

  { code: "B2",   name: "Kormányzati járművek vezetése – emelt szint",   levels: ["III"],       theory: true,  practical: true  },
  { code: "C",    name: "Konvoj közlekedés",                             levels: ["III"],       theory: true,  practical: true  },
  { code: "F1",   name: "Utcai lövész vizsga",                           levels: ["III"],       theory: true,  practical: true  },
  { code: "G1H",  name: "Erőnléti oktatás – haladó fokozat",             levels: ["III"],       theory: false, practical: true  },
  { code: "G3",   name: "Mentális felkészülés",                         levels: ["III"],       theory: true,  practical: false },
  { code: "I",    name: "Kiképzés az éj leple alatt",                    levels: ["III", "V"],  theory: true,  practical: true  },
  { code: "M",    name: "Együttműködés más szervezetekkel",              levels: ["III"],       theory: true,  practical: false },

  { code: "D",    name: "Taktikai kiképzés",                             levels: ["IV"],        theory: true,  practical: true  },
  { code: "F2",   name: "Épületharc lövész vizsga",                      levels: ["IV"],        theory: true,  practical: true  },
  { code: "G2H",  name: "Közelharci oktatás – haladó fokozat",           levels: ["IV"],        theory: false, practical: true  },
  { code: "H",    name: "Helikopter pilóta képzés",                      levels: ["IV", "V"],   theory: true,  practical: true  },
  { code: "J",    name: "Ejtőernyős vizsga követelmények",               levels: ["IV", "V"],   theory: true,  practical: true  },
  { code: "O",    name: "Advance és rendezvénybiztosítás",               levels: ["IV"],        theory: true,  practical: false },
  { code: "S1",   name: "Vízi műveletek",                                levels: ["IV"],        theory: true,  practical: true  },
  { code: "T1",   name: "Tűzszerész ismeretek",                          levels: ["IV"],        theory: true,  practical: true  },

  { code: "F3",   name: "Légi egység lövész vizsga",                     levels: ["V"],         theory: true,  practical: true  },
  { code: "S2",   name: "Búvárképzés",                                   levels: ["V"],         theory: true,  practical: true  },
  { code: "T2",   name: "Víz alatti robbanószerkezet",                   levels: ["V"],         theory: true,  practical: true  },

  { code: "ADM",  name: "Önkormányzati adminisztráció",                  levels: ["SPEC"],      theory: true,  practical: false },
  { code: "LSNTA",name: "Adóhatósági szolgálat",                         levels: ["SPEC"],      theory: true,  practical: false },
];

/* Sorrend, ahogy egy adott szinten a modulokat mutatjuk (H/I/J duplikáció nélkül) */
export const LEVEL_MODULE_ORDER = {
  "0":   ["0"],
  "I":   ["A", "G1", "K", "L", "R"],
  "II":  ["B1", "E", "F", "G2", "N", "P"],
  "III": ["B2", "C", "F1", "G1H", "G3", "I", "M"],
  "IV":  ["D", "F2", "G2H", "H", "J", "O", "S1", "T1"],
  "V":   ["F3", "H", "I", "J", "S2", "T2"],
  "SPEC":["ADM", "LSNTA"],
};

/* Kezdeti állomány. A % értékek NEM végleges adatok — csak minta-kitöltés. */
export const PERSONNEL = [
  { usssId: "USSS-004", name: "Tyron Wolf",                  position: "U.S.S.S Director", level: "III", status: "Aktív"  },
  { usssId: "USSS-80",  name: "Oliver Smith",                position: "U.S.S.S Agent",    level: "III", status: "Aktív"  },
  { usssId: "USSS-91",  name: "Titus Long",                  position: "U.S.S.S Agent",    level: "II",  status: "Aktív"  },
  { usssId: "USSS-121", name: "Alexander Freamen",           position: "U.S.S.S Agent",    level: "I",   status: "Újonc"  },
  { usssId: "USSS-112", name: "Brian Sorrento",               position: "U.S.S.S Agent",    level: "IV",  status: "Aktív"  },
  { usssId: "USSS-119", name: "Dr. Rick Deckard",             position: "Secretary of Health", level: "II", status: "Aktív" },
  { usssId: "USSS-8",   name: "Günther Grün",                 position: "U.S.S.S Agent",    level: "V",   status: "Aktív"  },
  { usssId: "USSS-120", name: "Harrelson Grant",               position: "U.S.S.S Agent",    level: "0",   status: "Újonc"  },
  { usssId: "USSS-111", name: "Harvey Ross",                   position: "U.S.S.S Agent",    level: "III", status: "Aktív"  },
  { usssId: "USSS-124", name: "Jensen Walker",                 position: "U.S.S.S Agent",    level: "0",   status: "Újonc"  },
  { usssId: "USSS-92",  name: "John Smith",                    position: "U.S.S.S Agent",    level: "II",  status: "Inaktív" },
  { usssId: "USSS-107", name: "Matthew Willams",               position: "U.S.S.S Agent",    level: "I",   status: "Aktív"  },
  { usssId: "USSS-106", name: "Michel Smith",                  position: "U.S.S.S Agent",    level: "III", status: "Felfüggesztett" },
  { usssId: "USSS-123", name: "Valentino Rossi",                position: "U.S.S.S Agent",    level: "IV",  status: "Aktív"  },
  { usssId: "USSS-50",  name: "Henry Hudson",                   position: "U.S.S.S Director", level: "V",   status: "Aktív"  },
  { usssId: "USSS-98",  name: "Christoph Norbert Kleinemann",   position: "U.S.S.S Agent",    level: "II",  status: "Aktív"  },
  { usssId: "USSS-118", name: "Dominic Hayes",                  position: "U.S.S.S Agent",    level: "III", status: "Aktív"  },
  { usssId: "USSS-96",  name: "Dr. Hajas Ricsi",                position: "Attorney General",  level: "II", status: "Aktív"  },
  { usssId: "USSS-109", name: "Dr. Lakatos László",             position: "Judge",             level: "I",  status: "Aktív"  },
];

/* Kezdeti hozzáférési kódok (Admin később szerkesztheti / generálhatja) */
export const ACCESS_CODES = [
  { usssId: "USSS-004", code: "ELITE-2026", role: "ADMIN" },
  { usssId: "USSS-80",  code: "TRAIN-2026", role: "TRAINING" },
  { usssId: "USSS-91",  code: "VIEW-2026",  role: "VIEWER" },
];

export const PROTECTED_LOCATIONS = [
  {
    id: "LOC-001",
    name: "Government Building",
    place: "Los Santos, Downtown",
    description: "Az önkormányzat és a kormányzati vezetés elsődleges székhelye. Fokozott U.S.S.S. jelenlét.",
    image: "",
    x: 52, y: 46,
    entrances: [
      { name: "Main Entrance", x: 51, y: 44 },
      { name: "Staff Entrance", x: 55, y: 47 },
      { name: "Vehicle Entrance", x: 49, y: 49 },
    ],
    updatedBy: "USSS-004",
    updatedAt: "2026-08-10T10:00:00.000Z",
  },
  {
    id: "LOC-002",
    name: "Pillbox Medical Center",
    place: "Los Santos, Strawberry",
    description: "Kiemelt egészségügyi intézmény, sérült tisztviselők és VIP ellátása.",
    image: "",
    x: 46, y: 58,
    entrances: [
      { name: "Főbejárat", x: 46, y: 56 },
      { name: "Mentőbejárat", x: 48, y: 60 },
    ],
    updatedBy: "USSS-80",
    updatedAt: "2026-08-05T14:30:00.000Z",
  },
];

export const AUDIT_LOG_SEED = [
  {
    id: "AL-0001",
    timestamp: "2026-08-17T18:42:00.000Z",
    actor: "Training Officer",
    action: "Gyakorlati vizsga módosítva",
    detail: "Oliver Smith – F1: Sikertelen → Sikeres",
  },
  {
    id: "AL-0002",
    timestamp: "2026-08-16T09:15:00.000Z",
    actor: "Commander",
    action: "Szintlépés jóváhagyva",
    detail: "Dominic Hayes: III. szint → IV. szint",
  },
];
