import { actorLabel } from "../auth.js?v=20";
import { esc, toast } from "../utils.js?v=20";

const SATCOM_URL = "https://bluedragon2satcom.replit.app/";

export function renderSatcom(container) {
  container.innerHTML = `<div class="classification-strip">U.S.S.S. PARANCSNOKI KÖZPONT · SATCOM</div>
    <div class="command-page-head satcom-head"><div><div class="eyebrow">BIZTONSÁGOS KOMMUNIKÁCIÓ / KÜLSŐ RENDSZER</div><h2>Blue Dragon 2 SATCOM</h2><p class="text-low small">Offline kiberkommunikációs és üzenetvédelmi rendszer · külső szolgáltatás.</p></div><span class="satcom-status">KÜLSŐ KAPCSOLAT</span></div>
    <div class="grid grid-2"><section class="card"><div class="card-title">Kapcsolati végpont</div><div class="satcom-endpoint">${esc(SATCOM_URL)}</div><div class="flex gap-1 mt-2"><a class="btn btn-gold" href="${SATCOM_URL}" target="_blank" rel="noopener noreferrer">SATCOM megnyitása</a><button class="btn" id="copy-satcom-url">Cím másolása</button></div><p class="text-low small mt-2">A Blue Dragon 2 külön, külső alkalmazás. Az U.S.S.S. rendszer nem másolja át a kulcsokat, üzeneteket vagy a titkosítási folyamatot.</p></section>
+    <section class="card"><div class="card-title">Használati rend</div><div class="satcom-rule"><strong>1.</strong><span>A külső SATCOM-rendszerben kezeld a titkosított üzeneteket és kulcsokat.</span></div><div class="satcom-rule"><strong>2.</strong><span>Szolgálati kulcs cseréjét csak jogosult vezető rendelje el.</span></div><div class="satcom-rule"><strong>3.</strong><span>Kulcsot, jelszót vagy visszafejtett üzenetet ne rögzíts az U.S.S.S. nyilvántartásban.</span></div><div class="satcom-rule"><strong>4.</strong><span>Elérhetetlenség esetén használj vezető által kijelölt tartalék kommunikációs csatornát.</span></div></section></div>
+    <section class="card mt-2"><div class="card-title">Integrációs megjegyzés</div><p class="satcom-note">A jelenlegi végpont külső Replit-alkalmazás. Az U.S.S.S. Command Center innen biztonságosan megnyitja, de a külső rendszer adatkezeléséért és rendelkezésre állásáért nem felel.</p><div class="text-low small">Megnyitotta: ${esc(actorLabel())}</div></section>`;
+  document.getElementById("copy-satcom-url").addEventListener("click", async () => {
+    await navigator.clipboard?.writeText(SATCOM_URL);
+    toast("SATCOM-cím másolva");
+  });
+}
