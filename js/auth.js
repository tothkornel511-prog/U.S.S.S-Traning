/* ==========================================================================
   U.S.S.S. ELITE TRAINING SYSTEM — HITELESÍTÉS
   Kódos belépés (User ID + Access Code). A jelenlegi verzió kliensoldali
   ellenőrzést végez a localStorage-ban tárolt kódok alapján — ezt a
   későbbi backend integráció során valódi szerveroldali auth váltja fel
   (lásd a lenti "TODO backend" jelzéseket).
   ========================================================================== */

import { findAccessCode, getPerson } from "./store.js?v=57";

const SESSION_KEY = "usss_ets_v1_session";

/* Ez az egyetlen fiók, amely mindig teljes hozzáféréssel rendelkezik,
   függetlenül attól, hogy mit tárol az access-code lista — mindenki más
   (Admin szerepkörrel is!) csak azokhoz a "szobákhoz" (menüpontokhoz) fér
   hozzá, amit ehhez a fiókhoz kifejezetten hozzárendeltek. */
export const SUPER_ADMIN_ID = "USSS-118";

export const ROLES = {
  ADMIN: { label: "Admin", level: 3 },
  TRAINING: { label: "Oktatásvezető", level: 2 },
  VIEWER: { label: "Megfigyelő", level: 1 },
};

export function login(usssId, code) {
  // TODO backend: cserélje le egy /auth/login API hívásra.
  const entry = findAccessCode(usssId.trim(), code.trim());
  if (!entry) return { ok: false, error: "Érvénytelen azonosító vagy hozzáférési kód." };
  const person = getPerson(entry.usssId);
  const session = {
    usssId: entry.usssId,
    role: entry.role,
    sections: entry.sections || [],
    name: person ? person.name : entry.usssId,
    loginAt: new Date().toISOString(),
  };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return { ok: true, session };
}

export function logout() {
  sessionStorage.removeItem(SESSION_KEY);
}

export function currentSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function isAuthenticated() {
  return !!currentSession();
}

export function isSuperAdmin() {
  const s = currentSession();
  return !!s && s.usssId === SUPER_ADMIN_ID;
}

export function hasRole(minRole) {
  const s = currentSession();
  if (!s) return false;
  if (s.usssId === SUPER_ADMIN_ID) return true;
  const min = ROLES[minRole]?.level ?? 99;
  const mine = ROLES[s.role]?.level ?? 0;
  return mine >= min;
}

/* Szobánkénti (menüpontonkénti) hozzáférés — lásd SUPER_ADMIN_ID. A "dashboard"
   mindenki számára elérhető, aki be tud jelentkezni. */
export function hasSection(sectionId) {
  const s = currentSession();
  if (!s) return false;
  if (sectionId === "dashboard") return true;
  if (s.usssId === SUPER_ADMIN_ID) return true;
  return (s.sections || []).includes(sectionId);
}

export function actorLabel() {
  const s = currentSession();
  if (!s) return "Ismeretlen";
  return `${s.name} (${ROLES[s.role]?.label || s.role})`;
}
