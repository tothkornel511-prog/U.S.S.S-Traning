import {
  login, finalizeLogin, hasSuperAdminPin, setSuperAdminPin, verifySuperAdminPin,
  SUPER_ADMIN_ID, setSuperAdminCode, clearSuperAdminCode, clearSuperAdminPin,
} from "../auth.js?v=23";
import { getPerson } from "../store.js?v=81";
import { esc, sealMark, applyBranding } from "../utils.js?v=31";

export function renderLogin(root, onSuccess) {
  root.innerHTML = `
    <div class="global-classification"><span>U.S.S.S. // RESTRICTED SYSTEM — AUTHORIZED PERSONNEL ONLY</span></div>
    <div class="login-screen">
      <div class="login-watermark">${sealMark(1100)}</div>
      <div class="login-card">
        <div class="login-seal">${sealMark(74)}</div>
        <div class="login-title">U.S.S.S.</div>
        <div class="login-sub">Elit Kiképzési és Személyzeti Rendszer</div>
        <div id="login-error"></div>
        <form id="login-form" autocomplete="off">
          <div class="field">
            <label>Azonosító</label>
            <input type="text" id="usssId" name="usss-login-id" placeholder="USSS-004" autocomplete="new-password" autocapitalize="characters" autocorrect="off" spellcheck="false" data-lpignore="true" required />
          </div>
          <div class="field">
            <label>Hozzáférési kód</label>
            <input type="password" id="code" name="usss-login-code" placeholder="••••••••" autocomplete="new-password" data-lpignore="true" required />
          </div>
          <button type="submit" class="btn btn-gold btn-block">Belépés</button>
        </form>
        <div class="login-demo">
          Hozzáférés kizárólag a rendszergazda által kiadott azonosítóval és kóddal lehetséges.
        </div>
        ${hasSuperAdminPin() ? `<a href="#" id="forgot-super-admin" class="text-low small" style="display:block; text-align:center; margin-top:14px;">Elfelejtetted a Super Admin (${esc(SUPER_ADMIN_ID)}) kódját vagy PIN-jét?</a>` : ""}
      </div>
    </div>
  `;

  applyBranding(root.querySelector(".login-screen"), "hero-main");

  document.getElementById("forgot-super-admin")?.addEventListener("click", (e) => {
    e.preventDefault();
    if (!confirm(`Ez törli a jelenlegi Super Admin (${SUPER_ADMIN_ID}) belépési kódot és PIN-t EBBEN a böngészőben. A következő ${SUPER_ADMIN_ID} bejelentkezési kísérlet újra aktiválja a fiókot, teljesen új kóddal és PIN-nel — a régiek onnantól nem működnek. Csak akkor folytasd, ha te vagy a jogos tulajdonos, és tényleg elfelejtetted az adatokat. Biztosan folytatod?`)) return;
    clearSuperAdminCode();
    clearSuperAdminPin();
    renderLogin(root, onSuccess);
  });

  document.getElementById("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const usssId = document.getElementById("usssId").value;
    const code = document.getElementById("code").value;
    const result = await login(usssId, code);
    const errBox = document.getElementById("login-error");
    if (result.needsActivation) {
      renderActivationStep(root, onSuccess);
      return;
    }
    if (!result.ok) {
      errBox.innerHTML = `<div class="login-error">⚠ ${esc(result.error)}</div>`;
      return;
    }
    if (result.requiresPin) {
      renderPinStep(root, result.session, onSuccess);
      return;
    }
    onSuccess();
  });
}

function renderActivationStep(root, onSuccess) {
  root.innerHTML = `
    <div class="global-classification"><span>U.S.S.S. // RESTRICTED SYSTEM — AUTHORIZED PERSONNEL ONLY</span></div>
    <div class="login-screen">
      <div class="login-watermark">${sealMark(1100)}</div>
      <div class="login-card">
        <div class="login-seal">${sealMark(74)}</div>
        <div class="login-title">U.S.S.S.</div>
        <div class="login-sub">Super Admin fiók első aktiválása</div>
        <div id="activate-error"></div>
        <p class="text-mid small mb-2">Ez a fiók (${esc(SUPER_ADMIN_ID)}) ezen a böngészőn még nincs aktiválva. Állíts be egy csak általad ismert belépési kódot és PIN kódot — ezentúl kizárólag ezek fognak működni, a korábbi belépési kód többé nem érvényes.</p>
        <p class="text-mid small mb-2" style="color:var(--orange, #d98b3f)">Ha ezt nem te kezdeményezted most, valaki más próbálja aktiválni a fiókodat — zárd be az oldalt, és ne add meg itt semmilyen adatot.</p>
        <form id="activate-form" autocomplete="off">
          <div class="field"><label>Új belépési kód</label><input type="text" id="act-code" name="usss-new-code" autocomplete="new-password" autocapitalize="off" autocorrect="off" spellcheck="false" data-lpignore="true" required minlength="4" autofocus /></div>
          <div class="field"><label>Belépési kód megerősítése</label><input type="text" id="act-code-confirm" name="usss-new-code-confirm" autocomplete="new-password" autocapitalize="off" autocorrect="off" spellcheck="false" data-lpignore="true" required minlength="4" /></div>
          <div class="field"><label>Új PIN kód (min. 4 karakter)</label><input type="password" id="act-pin" name="usss-new-pin" autocomplete="new-password" data-lpignore="true" required minlength="4" /></div>
          <div class="field"><label>PIN megerősítése</label><input type="password" id="act-pin-confirm" name="usss-new-pin-confirm" autocomplete="new-password" data-lpignore="true" required minlength="4" /></div>
          <div id="act-match-hint" class="text-low small" style="min-height:16px; margin-top:-8px; margin-bottom:8px;"></div>
          <button type="submit" class="btn btn-gold btn-block">Fiók aktiválása</button>
        </form>
      </div>
    </div>
  `;
  applyBranding(root.querySelector(".login-screen"), "hero-main");

  const matchHint = document.getElementById("act-match-hint");
  function updateMatchHint() {
    const code = document.getElementById("act-code").value.trim();
    const codeConfirm = document.getElementById("act-code-confirm").value.trim();
    const pin = document.getElementById("act-pin").value;
    const pinConfirm = document.getElementById("act-pin-confirm").value;
    if (codeConfirm && code !== codeConfirm) {
      matchHint.innerHTML = `<span style="color:var(--orange, #d98b3f)">⚠ A belépési kód még nem egyezik a megerősítéssel — ha ezt a böngésző töltötte ki automatikusan, töröld ki és írd be kézzel.</span>`;
    } else if (pinConfirm && pin !== pinConfirm) {
      matchHint.innerHTML = `<span style="color:var(--orange, #d98b3f)">⚠ A PIN még nem egyezik a megerősítéssel.</span>`;
    } else {
      matchHint.innerHTML = "";
    }
  }
  ["act-code", "act-code-confirm", "act-pin", "act-pin-confirm"].forEach((id) =>
    document.getElementById(id).addEventListener("input", updateMatchHint)
  );

  document.getElementById("activate-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errBox = document.getElementById("activate-error");
    const code = document.getElementById("act-code").value.trim();
    const codeConfirm = document.getElementById("act-code-confirm").value.trim();
    const pin = document.getElementById("act-pin").value;
    const pinConfirm = document.getElementById("act-pin-confirm").value;
    if (code !== codeConfirm) {
      errBox.innerHTML = `<div class="login-error">⚠ A két belépési kód nem egyezik.</div>`;
      return;
    }
    if (pin !== pinConfirm) {
      errBox.innerHTML = `<div class="login-error">⚠ A két PIN nem egyezik.</div>`;
      return;
    }
    await setSuperAdminCode(code);
    await setSuperAdminPin(pin);
    const person = getPerson(SUPER_ADMIN_ID);
    finalizeLogin({
      usssId: SUPER_ADMIN_ID,
      role: "ADMIN",
      sections: [],
      name: person ? person.name : SUPER_ADMIN_ID,
      loginAt: new Date().toISOString(),
    });
    onSuccess();
  });
}

function renderPinStep(root, session, onSuccess) {
  const isNewPin = !hasSuperAdminPin();
  root.innerHTML = `
    <div class="global-classification"><span>U.S.S.S. // RESTRICTED SYSTEM — AUTHORIZED PERSONNEL ONLY</span></div>
    <div class="login-screen">
      <div class="login-watermark">${sealMark(1100)}</div>
      <div class="login-card">
        <div class="login-seal">${sealMark(74)}</div>
        <div class="login-title">U.S.S.S.</div>
        <div class="login-sub">${isNewPin ? "Kétlépcsős azonosítás beállítása" : "Kétlépcsős azonosítás"}</div>
        <div id="pin-error"></div>
        ${isNewPin ? `<p class="text-mid small mb-2">Ez a Super Admin fiók (${esc(session.usssId)}) még nincs kétlépcsős azonosítással védve. Állíts be egy PIN kódot — ezt mostantól minden belépéskor be kell írnod az azonosító+kód után.</p>` : ""}
        <form id="pin-form" autocomplete="off">
          <div class="field">
            <label>${isNewPin ? "Új PIN kód (min. 4 karakter)" : "PIN kód"}</label>
            <input type="password" id="pin" name="usss-pin" placeholder="••••••" autocomplete="new-password" data-lpignore="true" required minlength="4" autofocus />
          </div>
          ${isNewPin ? `<div class="field"><label>PIN megerősítése</label><input type="password" id="pin-confirm" name="usss-pin-confirm" placeholder="••••••" autocomplete="new-password" data-lpignore="true" required minlength="4" /></div>` : ""}
          <button type="submit" class="btn btn-gold btn-block">${isNewPin ? "PIN beállítása és belépés" : "Belépés"}</button>
        </form>
        <div class="login-demo">
          A PIN csak ebben a böngészőben van eltárolva (kódolt formában), és nem helyettesíti a valódi szerveroldali hitelesítést.
        </div>
      </div>
    </div>
  `;
  applyBranding(root.querySelector(".login-screen"), "hero-main");

  document.getElementById("pin-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errBox = document.getElementById("pin-error");
    const pin = document.getElementById("pin").value;
    if (isNewPin) {
      const confirmPin = document.getElementById("pin-confirm").value;
      if (pin !== confirmPin) {
        errBox.innerHTML = `<div class="login-error">⚠ A két PIN nem egyezik.</div>`;
        return;
      }
      await setSuperAdminPin(pin);
      finalizeLogin(session);
      onSuccess();
      return;
    }
    const ok = await verifySuperAdminPin(pin);
    if (!ok) {
      errBox.innerHTML = `<div class="login-error">⚠ Érvénytelen PIN kód.</div>`;
      return;
    }
    finalizeLogin(session);
    onSuccess();
  });
}
