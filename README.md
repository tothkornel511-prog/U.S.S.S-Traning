# U.S.S.S. ELITE TRAINING & PERSONNEL MANAGEMENT SYSTEM

United States Secret Service – Training & Personnel Management (GTA V / FiveM RP)

Prémium, fekete–arany, kormányzati hangulatú, teljesen statikus webalkalmazás,
amely GitHub Pages-en fut. Nincs build-lépés, nincs szerver — tiszta HTML/CSS/
vanilla JS ES modulokkal, localStorage adatréteggel.

## Funkciók

- Kódos belépés (User ID + Access Code), 3 szerepkör: **Admin / Training / Viewer**
- **Dashboard** — állomány, jegyzőkönyvek, helyszínek gyors áttekintése
- **Állomány** — szűrhető/kereshető személyi lista, teljes profil (elméleti/gyakorlati
  vizsgák, vizsgatörténet, próbaidő-számítás, szintlépés jóváhagyás)
- **Training Matrix** — vízszintesen görgethető mátrix, minden személy × minden modul,
  színkódolt állapotokkal (🔴/🟡/🟢), cellára kattintva megnyílik a modul részlete
- **Oktatási jegyzőkönyvek** — automatikus azonosító (TR-2026-001…), résztvevők,
  amelyek a személyek képzési előzményébe is bekerülnek
- **Védett helyszínek** — leírás, bejáratok, nagyítható/panozható térkép-előnézet
- **Térkép** — külön oldal Los Santos / Roxwood / Cayo Perico térképekkel, az
  összes regisztrált védett helyszínnel és szerkeszthető körzet-feliratokkal
  (lásd `assets/maps/README.md` a térképképek feltöltéséhez)
- **Adminisztráció** — hozzáférés-kezelés, kódgenerálás, audit log

Elméleti vizsgánál **80% alatt a modul nem számít teljesítettnek** — a
rendszer minden próbálkozást (elméleti és gyakorlati is) elment, és a
profilon/modul-részletben megszámolja a sikeres/sikertelen vizsgák számát.

## Helyi futtatás

Bármilyen statikus fájlszerver megfelel, pl.:

```bash
cd U.S.S.S-Traning
python3 -m http.server 8000
# majd nyisd meg: http://localhost:8000
```

(Common: `npx serve .` is működik.)

## Hozzáférések

A kezdeti hozzáférési kódok nincsenek a README-ben feltüntetve — ez egy
publikus repó, a kódokat a rendszergazda tartja nyilván. Az Adminisztráció →
Hozzáférések oldalon bármikor módosíthatók, új kód generálható, vagy a
hozzáférés visszavonható.

## Projektstruktúra

```
index.html
css/style.css
js/
  app.js        – belépési pont, shell, router-kötés, globális kereső
  router.js     – egyszerű hash-router
  auth.js       – bejelentkezés, szerepkör-ellenőrzés
  store.js      – adatréteg (localStorage), üzleti logika (modul-állapot,
                  készenlét %, próbaidő-számítás, szintlépés, vizsgastatisztika stb.)
  data.js       – kezdeti minta-adatok (32 modul, állomány, pozíciók, térképek…)
  utils.js      – UI segédfüggvények (escape, toast, modal, dátum-formázás, pecsét-SVG)
  mapview.js    – újrafelhasználható nagyítható/panozható térkép-komponens
  pages/        – oldalankénti render-modulok (a map.js a Térkép oldal)
assets/maps/    – ide kerülnek a térképképek (lásd assets/maps/README.md)
```

## Adatkezelés / későbbi backend

A `js/store.js` teljesen el van választva a felülettől: minden adatművelet
(`getPersonnel`, `upsertPerson`, `setModuleTheory`, `createProtocol` stb.) egy
tiszta függvény, amely jelenleg `localStorage`-t olvas/ír. Egy valódi backend
bevezetésekor csak ezeket a függvényeket kell API-hívásokra cserélni — a `pages/`
és a UI-kód változatlan maradhat.

`js/auth.js` kliensoldali kódellenőrzést végez — ezt egy valódi backend
autentikációra kell cserélni éles/versenyképes RP-környezetben, mivel a
kódok jelenleg a böngésző oldalán, localStorage-ban tárolódnak.

## GitHub Pages üzembe helyezés

1. Töltsd fel ennek a mappának a **teljes tartalmát** a
   `https://github.com/tothkornel511-prog/U.S.S.S-Traning` repó gyökerébe
   (vagy `git push` — lásd lent).
2. A repó **Settings → Pages** menüjében válaszd: *Deploy from a branch*,
   branch: `main`, mappa: `/ (root)`.
3. Néhány perc múlva elérhető lesz itt:
   `https://tothkornel511-prog.github.io/U.S.S.S-Traning/`

### Git parancsok (ha helyi klónból dolgozol)

```bash
git clone https://github.com/tothkornel511-prog/U.S.S.S-Traning.git
cd U.S.S.S-Traning
# másold be ennek a csomagnak a tartalmát ide, majd:
git add .
git commit -m "U.S.S.S. Elite Training System — kezdeti verzió"
git push origin main
```

## Fontos megjegyzés a mintaadatokról

A `js/data.js`-ben szereplő nevek, pozíciók, szintek és %-os eredmények
**minta-adatok**, nem véglegesek. Az Admin felületen (Állomány → Szerkeszt,
Adminisztráció) mindegyik szabadon módosítható, és a teljes végleges
névsor/modul-adat később is beilleszthető ugyanide.
