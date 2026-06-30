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

const KIE_BASE = "https://api.kie.ai/api/v1/jobs";
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

function buildPrompt(
  carName: string,
  view: string,
  hasRef: boolean,
): string {
  const viewDesc = VIEW_DESC[view] || VIEW_DESC.front_left;
  const interior = view === "dashboard" || view === "center_console";
  const bg = interior
    ? "Sharp, well-lit interior photograph. "
    : "Plain pure white seamless background, even soft studio lighting, no drop shadow, the whole vehicle fully in frame and centered. ";
  if (hasRef) {
    return (
      `Use the reference image(s) to recreate the SAME exact vehicle ` +
      `(${carName || "this car"}) as a clean studio product photo, viewed ${viewDesc}. ` +
      bg +
      "Photorealistic automotive catalog style. Keep the exact body shape, proportions, " +
      "wheels, lights and details of the reference car. Do not invent a different car."
    );
  }
  return (
    `Professional studio product photograph of a ${carName || "modern car"}, ` +
    `viewed ${viewDesc}. ` +
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
  const modell = String(body.modell || "")
    .trim()
    .replace(/_/g, " ");
  const jahr = String(body.jahr || "").trim();
  // Body/Trim nur einbauen, wenn nicht der generische Standard (Basis/base).
  const carBody = String(body.body || "").trim();
  const carTrim = String(body.trim || "").trim();
  const extras = [carBody, carTrim].filter(
    (x) => x && !/^(basis|base)$/i.test(x),
  );
  const carName = [[marke, modell, jahr].filter(Boolean).join(" "), ...extras]
    .filter(Boolean)
    .join(", ");
  const view = String(body.view || "front_left")
    .toLowerCase()
    .trim();

  // Optionale Referenz-Bild-URLs (für konsistente Folge-Ansichten). Nur http(s).
  const images = Array.isArray(body.images)
    ? (body.images as unknown[])
        .map((s) => String(s).trim())
        .filter((s) => /^https?:\/\//i.test(s))
        .slice(0, 6)
    : [];

  const interior = view === "dashboard" || view === "center_console";
  const input: Record<string, unknown> = {
    prompt: buildPrompt(carName, view, images.length > 0),
    aspect_ratio: interior ? "4:3" : "16:9",
    resolution: "1K",
    output_format: "jpg",
  };
  if (images.length > 0) input.image_input = images;

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
