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
  { group: "U.S.S.S.", items: ["U.S.S.S Director", "Oktatásvezető", "U.S.S.S Agent", "Terepügynök"] },
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
      "Campaign Manager",
      "Secretary of Health",
      "Secretary of Transportation",
      "Attorney General",
      "Judge",
      "Lawyer",
      "Jogász",
      "Administration",
    ],
  },
  { group: "Egyéb", items: ["Karbantartó"] },
];

/* Az önkormányzati/U.S.S.S. ranglétra sorrendje — erre rendezi a rendszer
   az Állomány listát és a Kiképzési Áttekintés mátrixot (lásd store.js
   RANK_ORDER/positionRankIndex). Aki nincs a listán (vagy nincs pozíciója),
   a sor végére kerül, név szerint ábécésorrendben. */
export const RANK_ORDER = [
  "President",
  "Vice President",
  "Chief Of Staff",
  "Secretary of Defense",
  "Secretary of Homeland Security",
  "Secretary of Development",
  "Secretary of Public Relations",
  "Campaign Manager",
  "Secretary of Health",
  "Secretary of Transportation",
  "Oktatásvezető",
  "U.S.S.S Director",
  "U.S.S.S Agent",
  "Terepügynök",
  "Attorney General",
  "Judge",
  "Lawyer",
  "Jogász",
  "Administration",
  "Karbantartó",
];

/* Minden modul EGYSZER szerepel az adatbázisban (H, I, J is), a "levels" tömb
   mondja meg, mely képzési szinte(ke)n jelenik meg. "spec" = szinten kívüli.
   Minden modulnak van elméleti ÉS gyakorlati vizsgája is. */
export const MODULES = [
  { code: "0",    name: "Belépés, betanulás és bázisrend",              levels: ["0"],         theory: true, practical: true },

  { code: "A",    name: "Alapvető ismeretek",                            levels: ["I"],         theory: true, practical: true },
  { code: "G1",   name: "Erőnléti oktatás – alapfok",                    levels: ["I"],         theory: true, practical: true },
  { code: "K",    name: "Kommunikációs tréning",                         levels: ["I"],         theory: true, practical: true },
  { code: "L",    name: "Kód használat",                                 levels: ["I"],         theory: true, practical: true },
  { code: "R",    name: "Szolgálati rend és dokumentáció",               levels: ["I"],         theory: true, practical: true },

  { code: "B1",   name: "Kormányzati járművek vezetése – alapismeretek", levels: ["II"],        theory: true, practical: true },
  { code: "E",    name: "Egészségügyi oktatás",                          levels: ["II"],        theory: true, practical: true },
  { code: "F",    name: "Lőfegyver használat alapjai",                   levels: ["II"],        theory: true, practical: true },
  { code: "G2",   name: "Közelharci oktatás – alapfok",                  levels: ["II"],        theory: true, practical: true },
  { code: "N",    name: "Jogi ismeretek és kényszerítő eszközök",        levels: ["II"],        theory: true, practical: true },
  { code: "P",    name: "Titoktartás és információvédelem",              levels: ["II"],        theory: true, practical: true },

  { code: "B2",   name: "Kormányzati járművek vezetése – emelt szint",   levels: ["III"],       theory: true, practical: true },
  { code: "C",    name: "Konvoj közlekedés",                             levels: ["III"],       theory: true, practical: true },
  { code: "F1",   name: "Utcai lövész vizsga",                           levels: ["III"],       theory: true, practical: true },
  { code: "G1H",  name: "Erőnléti oktatás – haladó fokozat",             levels: ["III"],       theory: true, practical: true },
  { code: "G3",   name: "Mentális felkészülés",                         levels: ["III"],       theory: true, practical: true },
  { code: "I1",   name: "Kiképzés az éj leple alatt",                    levels: ["III"],       theory: true, practical: true },
  { code: "M",    name: "Együttműködés más szervezetekkel",              levels: ["III"],       theory: true, practical: true },

  { code: "D",    name: "Taktikai kiképzés",                             levels: ["IV"],        theory: true, practical: true },
  { code: "F2",   name: "Épületharc lövész vizsga",                      levels: ["IV"],        theory: true, practical: true },
  { code: "G2H",  name: "Közelharci oktatás – haladó fokozat",           levels: ["IV"],        theory: true, practical: true },
  { code: "H1",   name: "Helikopter pilóta képzés",                      levels: ["IV"],        theory: true, practical: true },
  { code: "J1",   name: "Ejtőernyős vizsga követelmények",               levels: ["IV"],        theory: true, practical: true },
  { code: "O",    name: "Advance és rendezvénybiztosítás",               levels: ["IV"],        theory: true, practical: true },
  { code: "S1",   name: "Vízi műveletek",                                levels: ["IV"],        theory: true, practical: true },
  { code: "T1",   name: "Tűzszerész ismeretek",                          levels: ["IV"],        theory: true, practical: true },

  { code: "F3",   name: "Légi egység lövész vizsga",                     levels: ["V"],         theory: true, practical: true },
  { code: "H2",   name: "Helikopter pilóta képzés – ismételt / emelt szint", levels: ["V"],      theory: true, practical: true },
  { code: "I2",   name: "Kiképzés az éj leple alatt – ismételt",         levels: ["V"],          theory: true, practical: true },
  { code: "J2",   name: "Ejtőernyős vizsga követelmények – ismételt",    levels: ["V"],          theory: true, practical: true },
  { code: "S2",   name: "Búvárképzés",                                   levels: ["V"],         theory: true, practical: true },
  { code: "T2",   name: "Víz alatti robbanószerkezet",                   levels: ["V"],         theory: true, practical: true },

  { code: "ADM",  name: "Önkormányzati adminisztráció",                  levels: ["SPEC"],      theory: true, practical: true },
  { code: "LSNTA",name: "Adóhatósági szolgálat",                         levels: ["SPEC"],      theory: true, practical: true },

  { code: "GSD1", name: "Government Support Division – alapfokú egészségügyi kiképzés",  levels: ["SPEC"], theory: true, practical: true },
  { code: "GSD2", name: "Government Support Division – harctéri sebesültellátás",         levels: ["SPEC"], theory: true, practical: true },
  { code: "GSD3", name: "Government Support Division – speciális mentőorvosi kiképzés",   levels: ["SPEC"], theory: true, practical: true },
];

/* Sorrend, ahogy egy adott szinten a modulokat mutatjuk. A H/I/J modulok
   emelt szintű (V.) megismétlése önálló kóddal (H2/I2/J2) szerepel az
   alapszintű változattól (H1/I1/J1) elkülönítve — külön nyomon követett
   vizsgák, nem ugyanaz a rekord. */
export const LEVEL_MODULE_ORDER = {
  "0":   ["0"],
  "I":   ["A", "G1", "K", "L", "R"],
  "II":  ["B1", "E", "F", "G2", "N", "P"],
  "III": ["B2", "C", "F1", "G1H", "G3", "I1", "M"],
  "IV":  ["D", "F2", "G2H", "H1", "J1", "O", "S1", "T1"],
  "V":   ["F3", "H2", "I2", "J2", "S2", "T2"],
  "SPEC":["ADM", "LSNTA", "GSD1", "GSD2", "GSD3"],
};

/* Kezdeti állomány. Teljes visszaállítás: mindenki 0. szint (Próbaidős) /
   Újonc státusszal indul, semmilyen képzési előzmény nélkül — az admin
   innen állítja majd be egyénileg a tényleges szinteket és eredményeket. */
export const PERSONNEL = [
  { usssId: "USSS-004", name: "Tyron Wolf",                  position: "President",                      level: "0", status: "Újonc" },
  { usssId: "USSS-80",  name: "Oliver Smith",                position: "Secretary of Development",       level: "0", status: "Újonc" },
  { usssId: "USSS-91",  name: "Titus Long",                  position: "U.S.S.S Agent",      level: "0", status: "Újonc" },
  { usssId: "USSS-121", name: "Alexander Freamen",           position: "U.S.S.S Agent",      level: "0", status: "Újonc" },
  { usssId: "USSS-112", name: "Brian Sorrento",               position: "U.S.S.S Agent",      level: "0", status: "Újonc" },
  { usssId: "USSS-119", name: "Dr. Rick Deckard",             position: "U.S.S.S Agent",      level: "0", status: "Újonc" },
  { usssId: "USSS-8",   name: "Günther Grün",                 position: "U.S.S.S Agent",      level: "0", status: "Újonc" },
  { usssId: "USSS-120", name: "Harrelson Grant",               position: "U.S.S.S Agent",      level: "0", status: "Újonc" },
  { usssId: "USSS-111", name: "Harvey Ross",                   position: "U.S.S.S Agent",      level: "0", status: "Újonc" },
  { usssId: "USSS-124", name: "Jensen Walker",                 position: "U.S.S.S Agent",      level: "0", status: "Újonc" },
  { usssId: "USSS-92",  name: "John Smith",                    position: "U.S.S.S Agent",      level: "0", status: "Újonc" },
  { usssId: "USSS-107", name: "Matthew Willams",               position: "U.S.S.S Agent",      level: "0", status: "Újonc" },
  { usssId: "USSS-106", name: "Michel Smith",                  position: "U.S.S.S Agent",      level: "0", status: "Újonc" },
  { usssId: "USSS-123", name: "Valentino Rossi",                position: "U.S.S.S Agent",      level: "0", status: "Újonc" },
  { usssId: "USSS-50",  name: "Henry Hudson",                   position: "Lawyer",                        level: "0", status: "Újonc" },
  { usssId: "USSS-98",  name: "Christoph Norbert Kleinemann",   position: "Secretary of Homeland Security", level: "0", status: "Újonc" },
  { usssId: "USSS-118", name: "Dominic Hayes",                  position: "Oktatásvezető",       level: "0", status: "Újonc" },
  { usssId: "USSS-96",  name: "Dr. Hajas Ricsi",                position: "U.S.S.S Director",              level: "0", status: "Újonc" },
  { usssId: "USSS-109", name: "Dr. Lakatos László",             position: "Secretary of Health",           level: "0", status: "Újonc" },
];

/* Kezdeti hozzáférési kódok (Admin később szerkesztheti / generálhatja / visszavonhatja).
   A Super Admin fiók (USSS-118) SZÁNDÉKOSAN nincs itt — annak belépési kódját
   és PIN-jét kizárólag hash-elve, a böngésző localStorage-ában tároljuk (lásd
   js/auth.js), hogy ne szerepeljen plaintextként ebben a publikusan olvasható
   forrásfájlban. */
export const ACCESS_CODES = [
  { usssId: "USSS-004", code: "3MVD-9GHC", role: "ADMIN" },    // Tyron Wolf
  { usssId: "USSS-98",  code: "5PLZ-8XWQ", role: "TRAINING" }, // Christoph Norbert Kleinemann
];

/* Elérhető GTA térkép a Védett helyszínekhez / Térkép oldalhoz. Amíg az
   "image" útvonalon nincs fájl, a térkép-nézet erről tájékoztat, de a
   pöttyök/körzetek attól még szerkeszthetők egy sötét placeholder felületen. */
export const MAPS = [
  { id: "los-santos",  name: "Los Santos & Blaine County", image: "assets/maps/los-santos.webp" },
];

/* Körzet-feliratok a Térkép oldalon. Kezdeti, hozzávetőleges pozíciók —
   admin/training a Térkép oldalon a térképre kattintva pontosíthatja. */
export const DISTRICTS = [
  { id: "D-001", map: "los-santos", name: "Downtown",       x: 51, y: 78 },
  { id: "D-002", map: "los-santos", name: "Vinewood",       x: 47, y: 72 },
  { id: "D-003", map: "los-santos", name: "Rockford Hills", x: 44, y: 75 },
  { id: "D-004", map: "los-santos", name: "Del Perro",      x: 38, y: 76 },
  { id: "D-005", map: "los-santos", name: "La Mesa",        x: 55, y: 76 },
  { id: "D-006", map: "los-santos", name: "Sandy Shores",   x: 62, y: 45 },
  { id: "D-007", map: "los-santos", name: "Paleto Bay",     x: 55, y: 15 },
  { id: "D-008", map: "los-santos", name: "Grapeseed",      x: 66, y: 22 },
  { id: "D-009", map: "los-santos", name: "Chumash",        x: 20, y: 55 },
];

export const PROTECTED_LOCATIONS = [
  {
    id: "LOC-001",
    name: "Government Building",
    place: "Los Santos, Downtown",
    map: "los-santos",
    description: "Az önkormányzat és a kormányzati vezetés elsődleges székhelye. Fokozott U.S.S.S. jelenlét.",
    image: "",
    x: 52, y: 46,
    entrances: [
      { name: "Főbejárat", x: 51, y: 44 },
      { name: "Személyzeti bejárat", x: 55, y: 47 },
      { name: "Járműbejárat", x: 49, y: 49 },
    ],
    updatedBy: "USSS-004",
    updatedAt: "2026-08-10T10:00:00.000Z",
  },
  {
    id: "LOC-002",
    name: "Pillbox Medical Center",
    place: "Los Santos, Strawberry",
    map: "los-santos",
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

/* Teljes visszaállítás: nincs korábbi vizsga- vagy szintlépés-esemény. */
export const AUDIT_LOG_SEED = [];

/* Felvételi kérdésbank — admin felületről bővíthető/törölhető
   (Felvételi oldal). Kezdeti, általános interjúkérdések. */
export const RECRUITMENT_QUESTIONS = [
  { id: "Q-001", text: "Miért szeretnél csatlakozni az U.S.S.S.-hez?" },
  { id: "Q-002", text: "Van korábbi tapasztalatod rendvédelmi vagy katonai jellegű szerepjátékban?" },
  { id: "Q-003", text: "Hogyan reagálnál egy váratlan konfliktushelyzetre szolgálat közben?" },
  { id: "Q-004", text: "Mennyi időt tudsz aktívan a szolgálatra fordítani hetente?" },
  { id: "Q-005", text: "Miért gondolod, hogy alkalmas vagy erre a pozícióra?" },
  { id: "Q-006", text: "Volt már fegyelmi problémád korábbi szervezetnél / frakciónál? Ha igen, mi történt?" },
];

/* ==========================================================================
   FELVÉTELI VIZSGA — 40 kérdéses, IC-alapú, oktatásvezető által pontozott
   szóbeli vizsga kérdésbankja. Kizárólag a vizsgáztató látja (a jelölt nem
   fér hozzá a weboldalhoz). Kérdésenként 0–5 pont, összesen 200 pont,
   80% (160 pont) a felvételi minimum — lásd store.js EXAM_MAX_SCORE/
   EXAM_PASS_PCT. Az "tips" az elfogadhatósági támpont (ugyanaz, amire a
   kategória-értékelés is pontoz, lásd EXAM_CATEGORY_CRITERIA), a "watch"
   (ha van) a "Mit figyeljek?" kiegészítő útmutató. Minden kérdés konkrét,
   végigjátszható szituációra épül — szándékosan nincs elvont, "levegőben
   lógó" véleménykérdés, még a "Személyes/Motiváció" kategóriában sem: ott
   is egy konkrét helyzetet vagy emléket kell felidézni/elképzelni. */
export const EXAM_CATEGORIES = [
  "I. SZEMÉLYES / MOTIVÁCIÓ",
  "II. VÉDETT SZEMÉLY MELLETT",
  "III. KOMOLYABB SZITUÁCIÓK",
  "IV. GÉPJÁRMŰVES SZOLGÁLAT",
  "V. RENDEZVÉNY / TÖMEG",
  "VI. CSAPATMUNKA / DÖNTÉSHOZATAL",
];

const EXAM_QUESTION_TEXTS = [
  ["I. SZEMÉLYES / MOTIVÁCIÓ", [
    "Egy barátja megkérdezi, miért vállal egy ilyen kockázatos, megterhelő szolgálatot, amikor kényelmesebb munkát is találhatna. Mit válaszolna neki, konkrétan?",
    "Mesélje el egy konkrét élményét vagy pillanatát, ami miatt úgy döntött, hogy pont ezt a szolgálatot választja.",
    "Az oktatásvezető megkérdezi, milyen konkrét tapasztalata vagy tulajdonsága bizonyítja, hogy alkalmas erre a feladatra. Mondjon egy példát.",
    "Egy újonc megkérdezi, mi különbözteti meg a jó testőrt egy átlagos szolgálattevőtől. Milyen konkrét példával magyarázná el neki?",
    "Idézzen fel egy konkrét helyzetet, amikor az egyik erőssége ténylegesen hasznosnak bizonyult egy nehéz pillanatban.",
    "Mondjon egy konkrét esetet, amikor szembesült egy saját hiányosságával vagy hibájával, és hogyan kezdett el rajta dolgozni.",
    "Egy felettese szolgálat közben, mások előtt kritizálja a döntését, amit Ön szerint nem is volt rossz. Hogyan reagálna abban a pillanatban?",
    "Egy hosszú, eseménytelen szolgálat végén elfárad, és éppen senki sem ellenőrzi a munkáját. Mit jelent Önnek ilyenkor a fegyelem — mit tenne?",
    "Az első önálló szolgálata során rájön, hogy egyetlen figyelmetlen pillanat is végzetes lehetne a védett személy számára. Hogyan élné meg ezt a felelősséget, és mit tenne emiatt másképp?",
    "Szolgálat közben egy apró, de észrevehető hibát vét, amit Önön kívül senki más nem vett észre. Mit tesz?",
  ]],
  ["II. VÉDETT SZEMÉLY MELLETT", [
    "Megérkeznek a védett személlyel egy hivatalos eseményre. Többen várják Önöket a bejáratnál, és első ránézésre nem látja át teljesen a környéket. Mit csinál, mielőtt a védett személy kiszállna?",
    "A védett személy be szeretne menni egy étterembe, de Ön úgy látja, hogy bent nagyon nagy a tömeg, és nehéz lenne megfelelően biztosítani. Mit tenne?",
    "Egy civil folyamatosan a védett személy közelében marad, és láthatóan figyeli őt. Ön mit tenne?",
    "A védett személy menet közben hirtelen megváltoztatja a programját, és egy olyan helyre szeretne menni, amiről Ön előzetesen nem tudott. Hogyan reagálna?",
    "Egy civil egyszerűen odalépne a védett személyhez, hogy beszéljen vele. Hogyan kezelné a helyzetet?",
    "A védett személy azt mondja Önnek, hogy ne álljon ilyen közel hozzá, mert zavarja. Mit tenne?",
  ]],
  ["III. KOMOLYABB SZITUÁCIÓK", [
    "A védett személy mellett van, amikor hirtelen lövés dördül. Nem tudja, honnan jött. Mihez kezd elsőként?",
    "Egy férfi elővesz egy fegyvert a védett személy közelében. Mi a teendője?",
    "A védett személy megsérül egy támadás során, de Ön még nem látja biztonságosnak a környéket. Hogyan járna el?",
    "Egy személy agresszívan közeledik a védett személy felé, közben pedig folyamatosan fenyegetőzik. Mit tesz?",
    "Egy rendezvényen valaki átjut a biztosításon, és egyenesen a védett személy felé indul. Hogyan reagálna?",
    "A védett személy összeveszik egy civillel, és azt mondja Önnek, hogy hagyja, hadd rendezze le vele. Mit tenne?",
    "Veszélyes helyzet alakul ki, de a védett személy nem akar elmenni a helyszínről. Hogyan győzné meg arról, hogy távozzon?",
    "Egy helyzet közben az egyik kollégája megsérül, miközben a védett személy még mindig veszélyben van. Mit csinálna?",
  ]],
  ["IV. GÉPJÁRMŰVES SZOLGÁLAT", [
    "Indulás előtt Önnek kell biztosítania, hogy a védett személy rendben el tudjon indulni. Mit ellenőrizne?",
    "A védett személlyel odaérnek az autóhoz, de egy ismeretlen ember közvetlenül a jármű mellett áll. Mit tesz?",
    "Útközben kiderül, hogy az eredeti útvonalon nem lehet továbbhaladni. Hogyan oldaná meg a helyzetet?",
    "A védett személy menet közben közli, hogy mégsem oda szeretne menni, ahová eredetileg indultak. Mit tenne?",
    "A védett személy autója lerobban egy forgalmas helyen. Mihez kezd?",
    "Egy több járműből álló kísérés során elveszíti a kapcsolatot az egyik kísérőautóval. Hogyan jár el?",
  ]],
  ["V. RENDEZVÉNY / TÖMEG", [
    "Egy nagyobb rendezvényre érkeznek, ahol már a bejáratnál nagy tömeg várja a védett személyt. Hogyan oldaná meg az érkezést?",
    "A tömeg hirtelen megindul a védett személy felé. Mihez kezd?",
    "A védett személy közelében két ember összeverekszik, és közben egyre többen gyűlnek köréjük. Hogyan kezeli a helyzetet?",
    "A rendezvény végén ki kell vinni a védett személyt, de a megbeszélt kijáratnál akkora tömeg van, hogy nem lehet biztonságosan kijutni. Mit tesz?",
    "A védett személy beszédet tart, amikor valaki folyamatosan próbál közelebb kerülni hozzá a tömegen keresztül. Hogyan reagálna?",
  ]],
  ["VI. CSAPATMUNKA / DÖNTÉSHOZATAL", [
    "Észreveszi, hogy az egyik kollégája nem figyel megfelelően a védett személyre. Mit tesz?",
    "A felettese nincs a helyszínen, közben pedig olyan helyzet alakul ki, amiben azonnal döntenie kell. Hogyan jár el?",
    "Egy másik frakció munkatársa odajön, és megpróbálja megmondani Önnek, hogyan végezze a védett személy biztosítását. Mit válaszolna neki?",
    "Ön és a kollégája nem értenek egyet abban, hogyan kellene biztosítani a védett személyt. Hogyan oldaná meg a nézeteltérést?",
    "Szolgálat közben hibázik, és emiatt kialakul egy komolyabb helyzet. Mit tesz közvetlenül utána?",
  ]],
];

export const EXAM_CATEGORY_CRITERIA = {
  "I. SZEMÉLYES / MOTIVÁCIÓ": ["felelősségtudat", "önismeret és fejlődési készség", "fegyelem", "nyugodt kommunikáció", "szolgálati motiváció"],
  "II. VÉDETT SZEMÉLY MELLETT": ["előzetes környezetfelmérés", "a védett személy elsőbbsége", "távolság és hozzáférés kontrollja", "diszkrét kommunikáció", "alternatív terv"],
  "III. KOMOLYABB SZITUÁCIÓK": ["azonnali védelem és kivonás", "veszélyforrás felismerése", "segítség és csapat koordinálása", "arányos intézkedés", "nem üldözéssel kezdi"],
  "IV. GÉPJÁRMŰVES SZOLGÁLAT": ["jármű és környezet ellenőrzése", "útvonal- és kockázatterv", "biztonságos beszállás", "rádiókommunikáció", "konvoj együtt tartása"],
  "V. RENDEZVÉNY / TÖMEG": ["bejárat és kijárat felmérése", "tömeg mozgásának felismerése", "védett személy elkülönítése", "csapatpozíciók és kommunikáció", "deeszkaláció"],
  "VI. CSAPATMUNKA / DÖNTÉSHOZATAL": ["önálló, felelős döntés", "parancsnoki lánc tisztelete", "egyértelmű kommunikáció", "együttműködés", "hiba vállalása és jelentése"],
};

export const EXAM_QUESTIONS = EXAM_QUESTION_TEXTS.flatMap(([category, texts]) =>
  texts.map((text, index) => ({
    id: `Q${String(EXAM_QUESTION_TEXTS.slice(0, EXAM_QUESTION_TEXTS.findIndex(([name]) => name === category)).reduce((sum, [, items]) => sum + items.length, 0) + index + 1).padStart(2, "0")}`,
    num: EXAM_QUESTION_TEXTS.slice(0, EXAM_QUESTION_TEXTS.findIndex(([name]) => name === category)).reduce((sum, [, items]) => sum + items.length, 0) + index + 1,
    category,
    text,
    tips: EXAM_CATEGORY_CRITERIA[category],
  }))
);
