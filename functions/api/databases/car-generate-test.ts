/**
 * POST /api/databases/car-generate-test
 *
 * TEST-Endpoint: Bild→Bild-Generierung über kie.ai (nano-banana-2) — derselbe
 * funktionierende Weg wie „Auto erstellen" (der tote Workers-AI-Gateway-Weg
 * wurde ersetzt). Nimmt hochgeladene Referenzfotos (Data-URL/Base64) + eine
 * Ziel-Ansicht, lädt sie temporär zu kie.ai hoch und startet die Generierung.
 * Gibt eine `taskId` zurück; der Fortschritt wird über
 * `GET /api/databases/car-generate?taskId=…` gepollt (gleiche kie.ai-Task).
 *
 * WICHTIG: Es wird bei UNS NICHTS gespeichert (kein R2, keine DB, kein Cache).
 * Das Ergebnis ist eine temporäre kie.ai-URL, die im Frontend nur ANGEZEIGT
 * wird. (Die Referenzfotos liegen für die Generierung kurzzeitig bei kie.ai.)
 */

import { getCurrentUser, jsonResponse, type AuthEnv } from "../../_lib/auth";

const KIE_BASE = "https://api.kie.ai/api/v1/jobs";
const KIE_UPLOAD = "https://kieai.redpandaai.co/api/file-base64-upload";
const MODEL = "nano-banana-2";

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

/** Data-URL/Base64 zu kie.ai hochladen → öffentliche URL für image_input.
 *  Rein temporär bei kie.ai; bei uns wird nichts gespeichert. */
async function uploadToKie(
  apiKey: string,
  dataUrl: string,
  idx: number,
): Promise<string | null> {
  const b64 = dataUrl.startsWith("data:")
    ? dataUrl
    : `data:image/png;base64,${dataUrl}`;
  try {
    const r = await fetch(KIE_UPLOAD, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0",
      },
      body: JSON.stringify({
        base64Data: b64,
        uploadPath: "vi-test-refs",
        fileName: `ref_${idx}.png`,
      }),
      signal: AbortSignal.timeout(20000),
    });
    const j = (await r.json().catch(() => ({}))) as {
      data?: { downloadUrl?: string; fileUrl?: string };
    };
    return j?.data?.downloadUrl || j?.data?.fileUrl || null;
  } catch {
    return null;
  }
}

export const onRequestPost: PagesFunction<AuthEnv> = async ({
  request,
  env,
}) => {
  const user = await getCurrentUser(env, request);
  if (!user) {
    return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const apiKey = env.KIE_API_KEY;
  if (!apiKey) {
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

  // Referenzfotos (Data-URL/Base64). Für den Test bis zu 6 nutzen.
  const images = Array.isArray(body.images)
    ? (body.images as unknown[])
        .map((s) => String(s).trim())
        .filter(Boolean)
        .slice(0, 6)
    : [];
  if (images.length === 0) {
    return jsonResponse(
      { error: "Mindestens ein Referenzbild nötig." },
      { status: 400 },
    );
  }

  const view = String(body.view || "front_left").toLowerCase();
  const viewDesc = VIEW_DESC[view] || VIEW_DESC.front_left;
  const marke = String(body.marke || "").trim();
  const modell = String(body.modell || "").trim().replace(/_/g, " ");
  const jahr = String(body.jahr || "").trim();
  const carName = [marke, modell, jahr].filter(Boolean).join(" ");
  const interior = view === "dashboard" || view === "center_console";

  const prompt =
    `Use the uploaded reference photos of ${carName || "this exact car"} to recreate the SAME vehicle ` +
    `as a clean studio product photo, viewed ${viewDesc}. ` +
    (interior
      ? "Sharp, well-lit interior photograph. "
      : "Plain pure white seamless background, even soft studio lighting, no drop shadow, the whole vehicle fully in frame and centered. ") +
    "Photorealistic, automotive catalog style. Keep the exact body shape, proportions, wheels, lights and details of the reference car. " +
    "Do not invent a different car.";

  // 1) Referenzfotos zu kie.ai hochladen (image_input braucht URLs). Kleine
  //    Nebenläufigkeit (2) begrenzt den Spitzen-Speicher. Bei uns nichts gespeichert.
  const refUrls: string[] = [];
  for (let i = 0; i < images.length; i += 2) {
    const batch = await Promise.all(
      images.slice(i, i + 2).map((img, k) => uploadToKie(apiKey, img, i + k)),
    );
    for (const u of batch) if (u) refUrls.push(u);
  }
  if (refUrls.length === 0) {
    return jsonResponse(
      { ok: false, view, error: "Referenzfotos konnten nicht verarbeitet werden." },
      { status: 502 },
    );
  }

  // 2) Generier-Auftrag starten → taskId zurück (Fortschritt pollt das Frontend
  //    über car-generate?taskId=…). NICHTS wird bei uns gespeichert.
  try {
    const r = await fetch(`${KIE_BASE}/createTask`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        input: {
          prompt,
          image_input: refUrls,
          aspect_ratio: interior ? "4:3" : "3:2",
          resolution: "1K",
          output_format: "png",
        },
      }),
    });
    const j = (await r.json().catch(() => ({}))) as {
      msg?: string;
      data?: { taskId?: string };
    };
    const taskId = j?.data?.taskId;
    if (!taskId) {
      return jsonResponse(
        { ok: false, view, error: j?.msg || "kie.ai: createTask fehlgeschlagen." },
        { status: 502 },
      );
    }
    return jsonResponse({ ok: true, taskId, view });
  } catch (e) {
    return jsonResponse(
      { ok: false, view, error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
};
