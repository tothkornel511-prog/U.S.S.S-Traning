import {
  login, finalizeLogin, hasSuperAdminPin, setSuperAdminPin, verifySuperAdminPin,
  SUPER_ADMIN_ID, setSuperAdminCode,
} from "../auth.js?v=23";
import { getPerson } from "../store.js?v=65";
import { esc, sealMark, applyBranding } from "../utils.js?v=23";

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
        <form id="login-form">
          <div class="field">
            <label>Azonosító</label>
            <input type="text" id="usssId" placeholder="USSS-004" autocomplete="off" required />
          </div>
          <div class="field">
            <label>Hozzáférési kód</label>
            <input type="password" id="code" placeholder="••••••••" autocomplete="off" required />
          </div>
          <button type="submit" class="btn btn-gold btn-block">Belépés</button>
        </form>
        <div class="login-demo">
          Hozzáférés kizárólag a rendszergazda által kiadott azonosítóval és kóddal lehetséges.
        </div>
      </div>
    </div>
  `;

  applyBranding(root.querySelector(".login-screen"), "hero-main");

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
        <form id="activate-form">
          <div class="field"><label>Új belépési kód</label><input type="text" id="act-code" autocomplete="off" required minlength="4" autofocus /></div>
          <div class="field"><label>Belépési kód megerősítése</label><input type="text" id="act-code-confirm" autocomplete="off" required minlength="4" /></div>
          <div class="field"><label>Új PIN kód (min. 4 karakter)</label><input type="password" id="act-pin" autocomplete="off" required minlength="4" /></div>
          <div class="field"><label>PIN megerősítése</label><input type="password" id="act-pin-confirm" autocomplete="off" required minlength="4" /></div>
          <button type="submit" class="btn btn-gold btn-block">Fiók aktiválása</button>
        </form>
      </div>
    </div>
  `;
  applyBranding(root.querySelector(".login-screen"), "hero-main");

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
        <form id="pin-form">
          <div class="field">
            <label>${isNewPin ? "Új PIN kód (min. 4 karakter)" : "PIN kód"}</label>
            <input type="password" id="pin" placeholder="••••••" autocomplete="off" required minlength="4" autofocus />
          </div>
          ${isNewPin ? `<div class="field"><label>PIN megerősítése</label><input type="password" id="pin-confirm" placeholder="••••••" autocomplete="off" required minlength="4" /></div>` : ""}
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
