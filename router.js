/* ==========================================================================
   U.S.S.S. ELITE TRAINING SYSTEM — ROUTER
   Egyszerű hash-alapú router, hogy a rendszer statikus GitHub Pages
   hosztingon is működjön szerveroldali route-olás nélkül.
   ========================================================================== */

const routes = [];

export function registerRoute(pattern, handler) {
  // pattern e.g. "/personnel/:id"
  const paramNames = [];
  const regex = new RegExp(
    "^" +
      pattern.replace(/:[^/]+/g, (m) => {
        paramNames.push(m.slice(1));
        return "([^/]+)";
      }) +
      "$"
  );
  routes.push({ regex, paramNames, handler });
}

export function navigate(path) {
  window.location.hash = path;
}

export function currentPath() {
  return window.location.hash.replace(/^#/, "") || "/dashboard";
}

export function resolve() {
  const path = currentPath();
  for (const r of routes) {
    const match = path.match(r.regex);
    if (match) {
      const params = {};
      r.paramNames.forEach((name, i) => (params[name] = decodeURIComponent(match[i + 1])));
      return { handler: r.handler, params, path };
    }
  }
  return null;
}

export function startRouter(onChange) {
  window.addEventListener("hashchange", onChange);
  onChange();
}
