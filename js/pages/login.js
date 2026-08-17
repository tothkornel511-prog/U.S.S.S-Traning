import { login } from "../auth.js";
import { esc } from "../utils.js";

export function renderLogin(root, onSuccess) {
  root.innerHTML = `
    <div class="login-screen">
      <div class="login-card">
        <div class="login-seal">U</div>
        <div class="login-title">U.S.S.S.</div>
        <div class="login-sub">Elite Training &amp; Personnel System</div>
        <div id="login-error"></div>
        <form id="login-form">
          <div class="field">
            <label>User ID</label>
            <input type="text" id="usssId" placeholder="USSS-004" autocomplete="off" required />
          </div>
          <div class="field">
            <label>Access Code</label>
            <input type="password" id="code" placeholder="••••••••" autocomplete="off" required />
          </div>
          <button type="submit" class="btn btn-gold btn-block">Belépés</button>
        </form>
        <div class="login-demo">
          Teszt hozzáférés — Admin: <code>USSS-004</code> / <code>ELITE-2026</code><br/>
          Training: <code>USSS-80</code> / <code>TRAIN-2026</code> &nbsp;·&nbsp;
          Viewer: <code>USSS-91</code> / <code>VIEW-2026</code>
        </div>
      </div>
    </div>
  `;

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
