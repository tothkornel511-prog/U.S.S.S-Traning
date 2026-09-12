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

async function gh(env, path, options = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      "Authorization": `Bearer ${env.GITHUB_TOKEN}`,
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

/* A GitHub Contents API (PUT /contents/{path}) kb. 1 MB-ig megbízható;
   ennél nagyobb (nálunk akár ~4 MB base64-es) fájlokhoz a Git Data API-t
   kell használni: blob → tree → commit → ref frissítés, ugyanaz, amit a
   `git add && git commit` is csinál a háttérben. */
async function commitFile(env, path, base64Content, message) {
  const blob = await gh(env, `/repos/${OWNER}/${REPO}/git/blobs`, {
    method: "POST",
    body: JSON.stringify({ content: base64Content, encoding: "base64" }),
  });
  const ref = await gh(env, `/repos/${OWNER}/${REPO}/git/refs/heads/${BRANCH}`);
  const baseCommit = await gh(env, `/repos/${OWNER}/${REPO}/git/commits/${ref.object.sha}`);
  const tree = await gh(env, `/repos/${OWNER}/${REPO}/git/trees`, {
    method: "POST",
    body: JSON.stringify({
      base_tree: baseCommit.tree.sha,
      tree: [{ path, mode: "100644", type: "blob", sha: blob.sha }],
    }),
  });
  const commit = await gh(env, `/repos/${OWNER}/${REPO}/git/commits`, {
    method: "POST",
    body: JSON.stringify({ message, tree: tree.sha, parents: [ref.object.sha] }),
  });
  await gh(env, `/repos/${OWNER}/${REPO}/git/refs/heads/${BRANCH}`, {
    method: "PATCH",
    body: JSON.stringify({ sha: commit.sha }),
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

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: corsHeaders() });
    }
    if (request.headers.get("X-Worker-Secret") !== env.WORKER_SECRET) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders() });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response("Invalid JSON", { status: 400, headers: corsHeaders() });
    }
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
      await commitFile(env, path, contentBase64, `Upload: ${safeName}`);
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
  },
};
