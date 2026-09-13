/* ==========================================================================
   U.S.S.S. ELITE TRAINING SYSTEM — GITHUB UPLOAD PROXY (Cloudflare Worker)
   ==========================================================================
   Ez a fájl NEM része a statikus oldalnak — külön, a Cloudflare Workers
   szolgáltatásra telepítendő. A célja: a fájlfeltöltéseket (PDF/DOCX/kép)
   ne a böngésző localStorage-ában (base64, ~5 MB korlát), hanem valódi
   fájlként, a GitHub repóba commitolva tárolja.

   A GITHUB_TOKEN SOHA nincs ebben a fájlban vagy a publikus oldal kódjában —
   kizárólag a Cloudflare Worker titkosított "Secrets" tárolójában él,
   amit csak a Worker futásideje tud kiolvasni. Enélkül a proxy nélkül a
   token a nyilvánosan olvasható kliens-JS-ben lenne, amit bárki kiolvashatna
   és teljes írási hozzáférést szerezhetne a repóhoz.

   A WORKER_SECRET egy külön, jóval kisebb téttel bíró "belépő kód" — ez
   MEGJELENIK a publikus site JS-ében (kell, hogy a böngésző el tudja küldeni),
   de ez rendben van: még ha valaki ki is olvassa, azzal legfeljebb az
   uploads/ mappába tud fájlt feltölteni ezen a Workeren keresztül — nem fér
   hozzá a GITHUB_TOKEN-hez, és semmilyen más útvonalat/műveletet nem tud
   elérni. Ez a proxy lényege: a veszélyes, teljes hozzáférésű titkot
   (GITHUB_TOKEN) egy szűk, korlátozott képességre (csak uploads/ írás)
   cseréli le, amit már biztonságos nyilvánosan elérhetővé tenni.

   Telepítés: lásd a admin/README a repo gyökerében, vagy kérd a lépéseket. */

const OWNER = "tothkornel511-prog";
const REPO = "U.S.S.S-Traning";
const BRANCH = "main";
const ALLOWED_ORIGIN = "https://tothkornel511-prog.github.io";
const MAX_BASE64_LENGTH = 8 * 1024 * 1024; // ~6 MB nyers fájlméretnek felel meg

async function gh(githubToken, path, options = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      "Authorization": `Bearer ${githubToken}`,
      "Accept": "application/vnd.github+json",
      "User-Agent": "usss-training-worker",
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API ${path} failed (${res.status}): ${text}`);
  }
  return res.json();
}

/* A GitHub fine-grained personal access tokenek NEM támogatják a Git Data
   API-t (blob/tree/commit/ref közvetlen létrehozása) — csak a magasabb
   szintű Contents API-t (PUT /contents/{path}), ami egyetlen hívással
   commitol egy fájlt egyenesen a megadott branch-re. */
async function commitFile(githubToken, path, base64Content, message) {
  await gh(githubToken, `/repos/${OWNER}/${REPO}/contents/${path}`, {
    method: "PUT",
    body: JSON.stringify({ message, content: base64Content, branch: BRANCH }),
  });
  return path;
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Worker-Secret",
  };
}

/* A megosztott adatfájlok (pl. data/personnel.json) csak a data/ mappában,
   csak .json kiterjesztéssel írhatók — ez zárja ki, hogy ez az útvonal
   bármi mást felülírjon a repóban (pl. a Worker saját kódját). */
function isAllowedDataPath(path) {
  return typeof path === "string" && /^data\/[a-zA-Z0-9_-]+\.json$/.test(path);
}

async function handleUpload(githubToken, body) {
  const { filename, contentBase64 } = body || {};
  if (!filename || !contentBase64) {
    return new Response("Missing filename or contentBase64", { status: 400, headers: corsHeaders() });
  }
  if (contentBase64.length > MAX_BASE64_LENGTH) {
    return new Response("File too large", { status: 413, headers: corsHeaders() });
  }
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
  const path = `uploads/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safeName}`;
  try {
    await commitFile(githubToken, path, contentBase64, `Upload: ${safeName}`);
    const rawUrl = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${path}`;
    return new Response(JSON.stringify({ url: rawUrl, path }), {
      status: 200,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err && err.message || err) }), {
      status: 502,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
    });
  }
}

/* Megosztott, szerkeszthető adatfájlok (jelenleg: Állomány, Hozzáférési
   kódok) írása — a fájl olvasása bárki számára szabad (nyilvános repo,
   raw.githubusercontent.com, nem megy át a Workeren), csak az ÍRÁS megy
   ezen keresztül. "Utoljára írt nyer" logika: lekéri a fájl jelenlegi
   sha-ját (ha létezik), és azzal írja felül — ha közben más is írt volna,
   ez az egyszerű, kis csapatra tervezett rendszer nem észleli az
   ütközést, csak felülírja. */
async function handleDataPut(githubToken, body) {
  const { path, content } = body || {};
  if (!isAllowedDataPath(path) || content === undefined) {
    return new Response("Missing or invalid path/content", { status: 400, headers: corsHeaders() });
  }
  const json = JSON.stringify(content, null, 2);
  const base64Content = btoa(unescape(encodeURIComponent(json)));
  try {
    let sha;
    try {
      const existing = await gh(githubToken, `/repos/${OWNER}/${REPO}/contents/${path}?ref=${BRANCH}`);
      sha = existing.sha;
    } catch {
      sha = undefined; // a fájl még nem létezik — ez esetben létrehozzuk
    }
    await gh(githubToken, `/repos/${OWNER}/${REPO}/contents/${path}`, {
      method: "PUT",
      body: JSON.stringify({ message: `Update ${path}`, content: base64Content, branch: BRANCH, ...(sha ? { sha } : {}) }),
    });
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err && err.message || err) }), {
      status: 502,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
    });
  }
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: corsHeaders() });
    }
    const workerSecret = await env.WORKER_SECRET.get();
    if (request.headers.get("X-Worker-Secret") !== workerSecret) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders() });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response("Invalid JSON", { status: 400, headers: corsHeaders() });
    }

    const githubToken = await env.GITHUB_TOKEN.get();
    if (body && body.type === "data-put") {
      return handleDataPut(githubToken, body);
    }
    return handleUpload(githubToken, body);
  },
};
