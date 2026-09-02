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
  { group: "U.S.S.S.", items: ["U.S.S.S Director", "Oktatásvezető", "U.S.S.S Agent"] },
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
  "SPEC":["ADM", "LSNTA"],
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

/* Kezdeti hozzáférési kódok (Admin később szerkesztheti / generálhatja / visszavonhatja) */
export const ACCESS_CODES = [
  { usssId: "USSS-118", code: "kornel08002", role: "ADMIN" },  // Dominic Hayes
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
   FELVÉTELI VIZSGA — 30 kérdéses, IC-alapú, oktatásvezető által pontozott
   szóbeli vizsga kérdésbankja. Kizárólag a vizsgáztató látja (a jelölt nem
   fér hozzá a weboldalhoz). Kérdésenként 0–5 pont, összesen 150 pont,
   80% (120 pont) a felvételi minimum. Az "tips" az elfogadhatósági
   támpont, a "watch" (ha van) a "Mit figyeljek?" kiegészítő útmutató.
   ========================================================================== */
export const EXAM_CATEGORIES = [
  "I. MOTIVÁCIÓ ÉS SZOLGÁLATI SZEMLÉLET",
  "II. VÉDETT SZEMÉLY BIZTOSÍTÁSA",
  "III. VÉSZHELYZETEK",
  "IV. KONVOJ",
  "V. RÁDIÓ ÉS KOMMUNIKÁCIÓ",
  "VI. DISZKRÉCIÓ",
  "VII. ERŐALKALMAZÁS",
  "VIII. PARANCSNOKI LÁNC",
  "IX. HELYZETFELISMERÉS",
  "X. KOMPLEX FELVÉTELI HELYZETEK",
];

export const EXAM_QUESTIONS = [
  { id: "Q01", num: 1, category: EXAM_CATEGORIES[0],
    text: "Miért szeretne az United States Secret Service állományába jelentkezni?",
    tips: ["komoly motiváció", "szolgálat", "felelősségvállalás", "emberek védelme", "hosszú távú elköteleződés"],
    watch: "Ne a konkrét megfogalmazást figyeld. A gondolkodás legyen komoly. A „fegyvert akarok”, „jó a rang” vagy „menő a frakció” önmagában gyenge válasz." },
  { id: "Q02", num: 2, category: EXAM_CATEGORIES[0],
    text: "Ön szerint mi egy Secret Service Agent legfontosabb feladata?",
    tips: ["védett személy biztonsága", "megelőzés", "veszélyek felismerése", "professzionális szolgálat", "csapatmunka"],
    watch: "Érti-e, hogy a szolgálat elsődlegesen nem az elfogásról vagy a fegyverhasználatról szól." },
  { id: "Q03", num: 3, category: EXAM_CATEGORIES[0],
    text: "Milyen tulajdonságokkal kell rendelkeznie egy jó Agentnek?",
    tips: ["fegyelem", "megbízhatóság", "türelem", "kommunikáció", "helyzetfelismerés", "önkontroll", "felelősségtudat"] },

  { id: "Q04", num: 4, category: EXAM_CATEGORIES[1],
    text: "Ön egy védett személyt kísér egy zsúfolt rendezvényen. Mire figyel elsősorban?",
    tips: ["környezet folyamatos figyelése", "védett személy helyzetének kontrollja", "potenciális veszélyek felismerése", "kommunikáció a csapattal", "menekítési lehetőség ismerete"],
    watch: "A jelölt ne csak azt mondja, hogy „nézem a tömeget”. Tudja megindokolni, mit keres és miért." },
  { id: "Q05", num: 5, category: EXAM_CATEGORIES[1],
    text: "Egy civil folyamatosan közeledik a védett személyhez, de nem agresszív. Mit tesz?",
    tips: ["nyugodt fellépés", "távolság fenntartása", "kommunikáció", "helyzet felmérése", "szükség esetén további intézkedés"],
    watch: "Ne legyen indokolatlanul agresszív." },
  { id: "Q06", num: 6, category: EXAM_CATEGORIES[1],
    text: "A védett személy egy olyan épületbe akar bemenni, amelyet Ön nem tart biztonságosnak. Mit tesz?",
    tips: ["veszély jelzése", "védett személy biztonságának előtérbe helyezése", "vezető / biztosításvezető értesítése", "alternatív lehetőség keresése", "nem hagyja figyelmen kívül a kockázatot"] },
  { id: "Q07", num: 7, category: EXAM_CATEGORIES[1],
    text: "A védett személy nem akarja követni a biztonsági utasítást, mert siet. Mit tesz?",
    tips: ["nyugodt kommunikáció", "a kockázat ismertetése", "nem hagyja figyelmen kívül a veszélyt", "szükség esetén vezető bevonása", "biztonsági protokoll fenntartása"] },

  { id: "Q08", num: 8, category: EXAM_CATEGORIES[2],
    text: "Lövéshez hasonló hangot hall a védett személy közelében. Mi az első reakciója?",
    tips: ["védett személy azonnali biztosítása", "veszélyből való kivonás", "kommunikáció", "helyzetfelmérés", "megfelelő segítség kérése"],
    watch: "A jelölt ne az elkövető üldözésével kezdjen." },
  { id: "Q09", num: 9, category: EXAM_CATEGORIES[2],
    text: "Egy rendezvényen hirtelen pánik tör ki. A védett személyt tömeg veszi körül. Mit tesz?",
    tips: ["védett személy kontrollálása", "biztonságos útvonal keresése", "csapattársak koordinálása", "nyugodt kommunikáció", "veszélyes terület elhagyása"] },
  { id: "Q10", num: 10, category: EXAM_CATEGORIES[2],
    text: "A védett személy megsérül egy támadás során. Mi a prioritása?",
    tips: ["védett személy biztonsága", "veszélyből kivonás", "orvosi segítség", "további veszély elhárítása", "kommunikáció"] },
  { id: "Q11", num: 11, category: EXAM_CATEGORIES[2],
    text: "Egy kollégája megsérül, miközben a védett személy még veszélyben van. Hogyan dönt?",
    tips: ["védett személy biztonságának elsődlegessége", "segítség kérése", "sérült kolléga támogatásának megszervezése", "nem hagyja figyelmen kívül a kollégát"] },
  { id: "Q12", num: 12, category: EXAM_CATEGORIES[2],
    text: "Egy támadó elmenekül, miközben a védett személy már biztonságban van. Mit tesz?",
    tips: ["helyzet újraértékelése", "jelentés", "helyszín biztosítása", "szükség esetén üldözés / elfogás megszervezése", "nem hagyja felügyelet nélkül a védett személyt"] },

  { id: "Q13", num: 13, category: EXAM_CATEGORIES[3],
    text: "Ön konvojban dolgozik. Miért fontos a megfelelő rádiókommunikáció?",
    tips: ["koordináció", "információ gyors átadása", "veszélyek jelzése", "útvonalváltoztatás", "egységek összehangolása"] },
  { id: "Q14", num: 14, category: EXAM_CATEGORIES[3],
    text: "A konvoj előtt egy gyanús jármű halad, amely folyamatosan változtatja a sebességét. Mit tesz?",
    tips: ["megfigyelés", "információ továbbítása", "nem pánikol", "távolság kezelése", "szükség esetén útvonal módosítása"] },
  { id: "Q15", num: 15, category: EXAM_CATEGORIES[3],
    text: "A konvoj egyik járműve meghibásodik. Mi a teendő?",
    tips: ["rádiókommunikáció", "konvoj biztonságának fenntartása", "védett személy prioritása", "helyzethez megfelelő döntés", "nem hagyják kontroll nélkül a konvojt"] },
  { id: "Q16", num: 16, category: EXAM_CATEGORIES[3],
    text: "A konvojt támadás éri. Mi az elsődleges cél?",
    tips: ["védett személy biztonságba helyezése", "koordináció", "megfelelő menekítési döntés", "kommunikáció", "csak ezután az elkövetők kezelése"] },

  { id: "Q17", num: 17, category: EXAM_CATEGORIES[4],
    text: "Mit jelent Önnek a rádiófegyelem?",
    tips: ["rövid", "érthető", "lényegre törő", "szolgálati célú", "felesleges beszéd kerülése"] },
  { id: "Q18", num: 18, category: EXAM_CATEGORIES[4],
    text: "Egy veszélyhelyzet közben mindenki egyszerre akar rádiózni. Mit tesz?",
    tips: ["nyugodt kommunikáció", "fontos információ elsőbbsége", "rövid rádióadás", "csatorna felszabadítása", "parancsnoki utasítás követése"] },
  { id: "Q19", num: 19, category: EXAM_CATEGORIES[4],
    text: "Hogyan jelentene rádión egy védett személyt érintő azonnali veszélyt?",
    tips: ["hol", "mi történt", "milyen veszély", "védett személy állapota", "milyen segítség szükséges"],
    watch: "Nem szükséges szó szerint ugyanazt a mondatot használni." },

  { id: "Q20", num: 20, category: EXAM_CATEGORIES[5],
    text: "Egy barátja megkérdezi, hol tartózkodik egy védett személy. Ön tudja a választ. Mit mond?",
    tips: ["nem adja ki", "szolgálati információ", "titoktartás", "illetéktelennek nem ad információt"] },
  { id: "Q21", num: 21, category: EXAM_CATEGORIES[5],
    text: "Egy kollégája egy szolgálati eseményről civilek előtt beszél. Mit tesz?",
    tips: ["jelzi a problémát", "nem kapcsolódik be", "szükség esetén jelenti a vezetőnek", "szolgálati információt nem oszt meg"] },

  { id: "Q22", num: 22, category: EXAM_CATEGORIES[6],
    text: "Mikor indokolt az erő alkalmazása?",
    tips: ["szükségesség", "arányosság", "aktuális veszély", "helyzethez igazodó intézkedés", "nem büntetésként alkalmaz erőt"] },
  { id: "Q23", num: 23, category: EXAM_CATEGORIES[6],
    text: "Egy személy elfut Ön elől, de nem jelent közvetlen veszélyt. Automatikusan fegyvert használ?",
    tips: ["nem automatikusan", "helyzetfelmérés", "veszélyesség vizsgálata", "megfelelő intézkedési mód", "arányosság"] },

  { id: "Q24", num: 24, category: EXAM_CATEGORIES[7],
    text: "Mit tesz, ha egy magasabb rangú Agent olyan döntést hoz, amellyel Ön nem ért egyet?",
    tips: ["szolgálati fegyelem", "megfelelő kommunikáció", "nem kezd konfliktust", "megfelelő csatornán jelzi aggályát"] },
  { id: "Q25", num: 25, category: EXAM_CATEGORIES[7],
    text: "Mit tesz, ha egy felettese olyan utasítást ad, amelyről Ön úgy gondolja, hogy súlyosan szabályellenes?",
    tips: ["nem hajt végre vakon szabályellenes utasítást", "jelzi az aggályt", "megfelelő vezetői csatornát használ", "nem önbíráskodik"] },
  { id: "Q26", num: 26, category: EXAM_CATEGORIES[7],
    text: "Miért fontos a parancsnoki lánc?",
    tips: ["egyértelmű felelősség", "gyors döntéshozatal", "koordináció", "szervezeti fegyelem", "káosz elkerülése"] },

  { id: "Q27", num: 27, category: EXAM_CATEGORIES[8],
    text: "Egy kormányzati épület előtt egy személy hosszú ideje ugyanazt a bejáratot figyeli. Mit tesz?",
    tips: ["megfigyelés", "információgyűjtés", "megfelelő jelentés", "helyzet ellenőrzése", "nem intézkedik indokolatlanul pusztán gyanú alapján"] },
  { id: "Q28", num: 28, category: EXAM_CATEGORIES[8],
    text: "Egy védett helyszínen őrizetlen csomagot talál. Mi a teendő?",
    tips: ["nem nyúl hozzá", "terület biztosítása", "megfelelő személyek értesítése", "védett személy távol tartása", "további utasítások követése"] },

  { id: "Q29", num: 29, category: EXAM_CATEGORIES[9],
    text: "Ön egy védett személyt kísér egy épületből egy gépjárműhöz. Egy személy kiabálni kezd, miközben egy másik gyorsan közeledik Önök felé. Mit tesz?",
    tips: ["két különböző helyzet felismerése", "védett személy biztosítása", "közeledő személy megfigyelése", "megfelelő kommunikáció", "szükség esetén azonnali kivonás", "nem pánikol"] },
  { id: "Q30", num: 30, category: EXAM_CATEGORIES[9],
    text: "A parancsnok FULL ALERT-et rendel el. Ön mit változtatna meg a szolgálatában?",
    tips: ["fokozott figyelem", "biztosítás megerősítése", "rádiófegyelem", "utasítások szigorúbb követése", "veszélyek fokozott figyelése", "egységek koordinációja", "védett személy biztonságának fokozott kezelése"] },
];
