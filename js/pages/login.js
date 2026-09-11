import { login } from "../auth.js?v=20";
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

  document.getElementById("login-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const usssId = document.getElementById("usssId").value;
    const code = document.getElementById("code").value;
    const result = login(usssId, code);
    const errBox = document.getElementById("login-error");
    if (!result.ok) {
      errBox.innerHTML = `<div class="login-error">⚠ ${esc(result.error)}</div>`;
      return;
    }
    onSuccess();
  });
}
