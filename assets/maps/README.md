# Térképképek

Ide kell feltölteni a nagyfelbontású térképeket, pontosan ezekkel a fájlnevekkel
(a `js/data.js`-ben lévő `MAPS` tömb ezekre az útvonalakra mutat):

| Fájl | Térkép |
|---|---|
| `los-santos.jpg` | Los Santos & Blaine County |
| `roxwood.jpg` | Roxwood |
| `cayo-perico.jpg` | Cayo Perico |

Amíg egy fájl hiányzik, a Térkép oldal és a Védett helyszínek térkép-előnézete
egy sötét placeholder felületen jeleníti meg a pöttyöket és körzet-feliratokat —
tehát a funkció ezek nélkül is tesztelhető, csak a valós háttérkép hiányzik.

A GitHub webes felületén: **Add file → Upload files**, húzd be a 3 képet ebbe
a `assets/maps/` mappába pontosan ezekkel a nevekkel, majd Commit. Nincs
szükség kódmódosításra — a rendszer automatikusan felismeri őket.

Ha más fájlnevet/formátumot szeretnél (pl. `.png`, vagy külön kép a hó
alatti/éjszakai variánshoz), szólj, és frissítem a `MAPS` bejegyzéseket.
