/**
 * Bild-Generierung „Auto erstellen" über kie.ai (nano-banana-2).
 * Ersetzt den toten Google-AI-Gateway-Weg.
 *
 * POST /api/databases/car-generate   → startet einen Generier-Auftrag, gibt
 *                                       { taskId } zurück.
 *   Body: { marke, modell, jahr, view, images?: string[] }
 *   images = optionale Referenz-Bild-URLs (für Bild→Bild / konsistente Ansichten).
 *
 * GET  /api/databases/car-generate?taskId=…  → Status pollen:
 *   { state: "waiting"|"success"|"fail", imageUrl?: string, error?: string }
 *
 * Nur für angemeldete Dashboard-Nutzer. Schlüssel: Pages-Secret KIE_API_KEY.
 */

import { getCurrentUser, jsonResponse, type AuthEnv } from "../../_lib/auth";
import {
  clearRegenLock,
  isRegenLocked,
  regenLockKey,
  setRegenLock,
} from "../../_lib/regenLock";

const KIE_BASE = "https://api.kie.ai/api/v1/jobs";
const KIE_UPLOAD = "https://kieai.redpandaai.co/api/file-base64-upload";
const MODEL = "nano-banana-2";

const INT_VIEWS = ["dashboard", "center_console"];
// Winkel der 8 Außen-Ansichten (Grad rund ums Auto). Referenzen werden nach
// Winkel-NÄHE zum Ziel gewählt — sonst würde z. B. fürs Heck aus Front-Ansichten
// generiert (die KI müsste das Heck erraten → falsch).
const VIEW_ANGLE: Record<string, number> = {
  front: 0,
  front_right: 45,
  right: 90,
  rear_right: 135,
  rear: 180,
  rear_left: 225,
  left: 270,
  front_left: 315,
};
/** Vorhandene Außen-Ansichten nach Winkel-Nähe zum Ziel sortieren (nächste zuerst). */
function extRefOrder(target: string, available: string[]): string[] {
  const ta = VIEW_ANGLE[target];
  if (ta === undefined) return available;
  const dist = (v: string) => {
    const d = Math.abs((VIEW_ANGLE[v] ?? 0) - ta);
    return Math.min(d, 360 - d);
  };
  return [...available].sort((a, b) => dist(a) - dist(b));
}
const KEY_RE = /^(?:source|scaled|shadow)\/[A-Za-z0-9_-]{8,64}$/;
const MAX_REFS = 4;

/** ArrayBuffer → base64 (in Chunks, sonst Stack-Überlauf bei großen Bildern). */
function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

/** Ein (gated) R2-Bild zu kie.ai hochladen → öffentliche URL für image_input. */
async function uploadKeyToKie(
  env: AuthEnv,
  key: string,
): Promise<string | null> {
  const bucket = env.vehicleimages;
  const apiKey = env.KIE_API_KEY;
  if (!bucket || !apiKey || !KEY_RE.test(key)) return null;
  const obj = await bucket.get(key);
  if (!obj) return null;
  const buf = await obj.arrayBuffer();
  // Referenzbilder brauchen keine 30 MB; Deckel klein halten (Worker-Speicher).
  if (buf.byteLength === 0 || buf.byteLength > 10_000_000) return null;
  const ct = obj.httpMetadata?.contentType || "image/jpeg";
  const r = await fetch(KIE_UPLOAD, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0",
    },
    body: JSON.stringify({
      base64Data: `data:${ct};base64,${toBase64(buf)}`,
      uploadPath: "vi-refs",
      fileName: `${key.replace(/\//g, "_")}`,
    }),
    signal: AbortSignal.timeout(15000),
  });
  const j = (await r.json().catch(() => ({}))) as {
    data?: { downloadUrl?: string; fileUrl?: string };
  };
  return j?.data?.downloadUrl || j?.data?.fileUrl || null;
}

/**
 * Vorhandene Ansichten desselben Autos (gleiche Farbe) als Referenz-URLs holen:
 * DB nach gerenderten Quell-Ansichten (≠ Ziel, gleiche Innen/Außen-Klasse)
 * abfragen → nach Priorität wählen → zu kie.ai hochladen. Best effort.
 */
async function resolveDbRefs(
  env: AuthEnv,
  id: {
    marke: string;
    modell: string;
    jahr: number;
    body: string;
    trim: string;
    farbe: string;
  },
  targetView: string,
): Promise<string[]> {
  const db = env.cardb;
  if (!db || !env.vehicleimages) return [];
  const interior = INT_VIEWS.includes(targetView);
  let rows: { results?: unknown[] };
  try {
    rows = await db
      .prepare(
        // NUR freigegebene (kontrolliert=1) Ansichten als Referenz — sonst
        // würden falsch generierte, noch offene Ansichten als Vorlage dienen
        // und den Fehler weitertragen.
        `SELECT "view" AS view, original_r2_key, r2_key
         FROM fahrzeugliste
         WHERE marke = ? AND modell = ? AND jahr = ? AND body = ? AND trim = ?
           AND farbe = ? AND transparent = 0 AND shadow = 0 AND "view" <> ?
           AND kontrolliert = 1 AND r2_key IS NOT NULL AND r2_key <> ''`,
      )
      .bind(id.marke, id.modell, id.jahr, id.body, id.trim, id.farbe, targetView)
      .all();
  } catch {
    return [];
  }
  const present = new Map<string, string>();
  for (const r of rows.results ?? []) {
    const o = r as Record<string, unknown>;
    const v = String(o.view ?? "");
    if (INT_VIEWS.includes(v) !== interior) continue; // Klasse muss passen
    const key =
      (o.original_r2_key ? String(o.original_r2_key) : "") ||
      (o.r2_key ? String(o.r2_key) : "");
    if (key && !present.has(v)) present.set(v, key);
  }
  const orderedViews = interior
    ? INT_VIEWS.filter((v) => present.has(v))
    : extRefOrder(targetView, [...present.keys()]);
  const keys: string[] = [];
  for (const v of orderedViews) {
    const k = present.get(v);
    if (k) keys.push(k);
    if (keys.length >= MAX_REFS) break;
  }
  // Uploads mit kleiner Nebenläufigkeit (2) — begrenzt Spitzen-Speicher. Best effort.
  const urls: string[] = [];
  for (let i = 0; i < keys.length; i += 2) {
    const batch = await Promise.all(
      keys.slice(i, i + 2).map((k) => uploadKeyToKie(env, k).catch(() => null)),
    );
    for (const u of batch) if (u) urls.push(u);
  }
  return urls;
}

const VIEW_DESC: Record<string, string> = {
  front: "directly from the front",
  rear: "directly from the rear",
  left: "from the left side as a clean profile shot",
  right: "from the right side as a clean profile shot",
  front_left: "from the front-left three-quarter angle",
  front_right: "from the front-right three-quarter angle",
  rear_left: "from the rear-left three-quarter angle",
  rear_right: "from the rear-right three-quarter angle",
  dashboard: "interior dashboard / cockpit from the driver's perspective",
  center_console: "interior center console as a close-up",
};

function buildPrompt(
  carName: string,
  view: string,
  hasRef: boolean,
  color: string,
): string {
  const viewDesc = VIEW_DESC[view] || VIEW_DESC.front_left;
  const interior = view === "dashboard" || view === "center_console";
  const bg = interior
    ? "Sharp, well-lit interior photograph. "
    : "Plain pure white seamless background, even soft studio lighting, no drop shadow, the whole vehicle fully in frame and centered. ";
  const paint = color ? ` finished in ${color} paint` : "";
  if (hasRef) {
    return (
      `Use the reference image(s) — they are other angles of the SAME car — to ` +
      `recreate that exact same vehicle (${carName || "this car"})${paint} as a ` +
      `clean studio product photo, viewed ${viewDesc}. ` +
      bg +
      "Photorealistic automotive catalog style. Keep the EXACT same body shape, " +
      "proportions, wheels, rims, lights, paint color and all details of the " +
      "reference car — only change the camera angle. Do not invent a different car."
    );
  }
  return (
    `Professional studio product photograph of a ${carName || "modern car"}` +
    `${paint}, viewed ${viewDesc}. ` +
    bg +
    "Photorealistic, automotive catalog style, accurate to the real vehicle."
  );
}

export const onRequestPost: PagesFunction<AuthEnv> = async ({
  request,
  env,
}) => {
  const user = await getCurrentUser(env, request);
  if (!user) return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });

  const key = env.KIE_API_KEY;
  if (!key) {
    return jsonResponse(
      { error: "KIE_API_KEY fehlt (Pages → Settings → Environment, secret)." },
      { status: 503 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: "Ungültiger Request-Body." }, { status: 400 });
  }

  const marke = String(body.marke || "").trim();
  // Wörtlicher Modellname (wie in der DB gespeichert) für den DB-Match; die
  // `_`→Leerzeichen-Umwandlung ist NUR Prompt-Formatierung.
  const modellRaw = String(body.modell || "").trim();
  const modell = modellRaw.replace(/_/g, " ");
  const jahr = String(body.jahr || "").trim();
  // Body/Trim nur einbauen, wenn nicht der generische Standard (Basis/base).
  const carBody = String(body.body || "").trim();
  const carTrim = String(body.trim || "").trim();
  const farbe = String(body.farbe || "").trim();
  const extras = [carBody, carTrim].filter(
    (x) => x && !/^(basis|base)$/i.test(x),
  );
  const carName = [[marke, modell, jahr].filter(Boolean).join(" "), ...extras]
    .filter(Boolean)
    .join(", ");
  // Echte Farbe (nicht der generische Default) für den Prompt.
  const color =
    farbe && !/^(default|standard|na|none)$/i.test(farbe)
      ? farbe.replace(/_/g, " ")
      : "";
  const view = String(body.view || "front_left")
    .toLowerCase()
    .trim();

  // Sperre lösen — z. B. wenn die Generierung im Client fehlschlug/timeoutete,
  // damit die Ansicht nicht bis zum TTL-Ablauf blockiert bleibt.
  if (body.unlock === true) {
    if (env.cardb && view) {
      await clearRegenLock(
        env.cardb,
        regenLockKey(
          { marke, modell: modellRaw, jahr, body: carBody, trim: carTrim, farbe },
          view,
        ),
      );
    }
    return jsonResponse({ ok: true, unlocked: true });
  }

  // Optionale Referenz-Bild-URLs (für konsistente Folge-Ansichten). Nur http(s).
  const images = Array.isArray(body.images)
    ? (body.images as unknown[])
        .map((s) => String(s).trim())
        .filter((s) => /^https?:\/\//i.test(s))
        .slice(0, 6)
    : [];

  // useDbRefs=true (Nachgenerieren): vorhandene Ansichten desselben Autos aus
  // der DB als Referenz laden → konsistentes Ergebnis (gleiches Auto/Farbe).
  const useDbRefs = body.useDbRefs === true;
  const lockKey = useDbRefs
    ? regenLockKey(
        { marke, modell: modellRaw, jahr, body: carBody, trim: carTrim, farbe },
        view,
      )
    : "";
  // Doppel-Start verhindern: läuft für diese Ansicht schon eine Generierung?
  if (useDbRefs && env.cardb && (await isRegenLocked(env.cardb, lockKey))) {
    return jsonResponse(
      { error: "Diese Ansicht wird bereits neu generiert.", locked: true },
      { status: 409 },
    );
  }
  let dbRefs: string[] = [];
  if (useDbRefs && marke && modellRaw && jahr) {
    dbRefs = await resolveDbRefs(
      env,
      {
        marke,
        modell: modellRaw, // wörtlich für den DB-Match (Unterstriche erhalten)
        jahr: Number(jahr),
        body: carBody,
        trim: carTrim,
        farbe,
      },
      view,
    );
  }
  const refImages = [...new Set([...images, ...dbRefs])].slice(0, 6);

  const interior = view === "dashboard" || view === "center_console";
  const input: Record<string, unknown> = {
    prompt: buildPrompt(carName, view, refImages.length > 0, color),
    // Wie die Original-Bibliothek: 3:2 außen (Auto füllt das Bild), hohe
    // Auflösung (2K) und verlustfreies PNG statt niedrig aufgelöstem JPG.
    aspect_ratio: interior ? "4:3" : "3:2",
    resolution: "2K",
    output_format: "png",
  };
  if (refImages.length > 0) input.image_input = refImages;

  try {
    const r = await fetch(`${KIE_BASE}/createTask`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: MODEL, input }),
    });
    const j = (await r.json().catch(() => ({}))) as {
      code?: number;
      msg?: string;
      data?: { taskId?: string };
    };
    const taskId = j?.data?.taskId;
    if (!taskId) {
      return jsonResponse(
        { error: j?.msg || "kie.ai: createTask fehlgeschlagen." },
        { status: 502 },
      );
    }
    // Ansicht sperren (in Bearbeitung) — bis car-generate-save die Sperre löst.
    if (useDbRefs && env.cardb) await setRegenLock(env.cardb, lockKey);
    return jsonResponse({ ok: true, taskId, view });
  } catch (e) {
    return jsonResponse(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
};

export const onRequestGet: PagesFunction<AuthEnv> = async ({
  request,
  env,
}) => {
  const user = await getCurrentUser(env, request);
  if (!user) return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });

  const key = env.KIE_API_KEY;
  if (!key) {
    return jsonResponse({ error: "KIE_API_KEY fehlt." }, { status: 503 });
  }
  const taskId = (new URL(request.url).searchParams.get("taskId") || "").trim();
  if (!taskId) {
    return jsonResponse({ error: "taskId erforderlich." }, { status: 400 });
  }

  try {
    const r = await fetch(
      `${KIE_BASE}/recordInfo?taskId=${encodeURIComponent(taskId)}`,
      { headers: { Authorization: `Bearer ${key}` } },
    );
    const j = (await r.json().catch(() => ({}))) as {
      data?: {
        state?: string;
        resultJson?: string;
        failMsg?: string;
      };
    };
    const d = j?.data || {};
    const state = d.state || "waiting";
    let imageUrl: string | null = null;
    if (state === "success") {
      try {
        const rj = JSON.parse(d.resultJson || "{}") as {
          resultUrls?: string[];
        };
        imageUrl = rj.resultUrls?.[0] || null;
      } catch {
        /* keine URL */
      }
    }
    return jsonResponse({
      state,
      imageUrl,
      error: state === "fail" ? d.failMsg || "Generierung fehlgeschlagen." : null,
    });
  } catch (e) {
    return jsonResponse(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
};
