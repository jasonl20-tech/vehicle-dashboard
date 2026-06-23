/**
 * POST /api/databases/car-generate-test
 *
 * TEST-Endpoint: Bild→Bild-Generierung. Nimmt hochgeladene Referenzfotos eines
 * Autos (Base64) + eine Ziel-Ansicht und versucht über Workers AI
 * (google/nano-banana-2, AI-Gateway „default") unsere Studio-Ansicht zu
 * erzeugen. Gedacht für ältere Modelle, die die KI nicht kennt.
 *
 * WICHTIG: Es wird NICHTS gespeichert (kein R2, keine DB) — das Ergebnis wird
 * nur temporär als Data-URL zurückgegeben und im Frontend angezeigt.
 */

import { getCurrentUser, jsonResponse, type AuthEnv } from "../../_lib/auth";
import { getWorkersAiBinding } from "../../_lib/workersAiBinding";

const MODEL = "google/nano-banana-2";

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

function stripB64(s: string): string {
  return String(s).replace(/^data:[^,]+,/, "").trim();
}

export const onRequestPost: PagesFunction<AuthEnv> = async ({
  request,
  env,
}) => {
  const user = await getCurrentUser(env, request);
  if (!user) {
    return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const ai = getWorkersAiBinding(env);
  if (!ai) {
    return jsonResponse(
      { error: "Workers-AI-Bindung (`workersai`/`AI`) fehlt (Pages → Settings)." },
      { status: 503 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: "Ungültiger Request-Body." }, { status: 400 });
  }

  const images = Array.isArray(body.images)
    ? (body.images as unknown[])
        .map((s) => stripB64(String(s)))
        .filter(Boolean)
        .slice(0, 4)
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

  const aiInput = {
    prompt,
    image_input: images,
    aspect_ratio: "4:3",
    output_format: "png",
    resolution: "1K",
  };

  try {
    const resp = (await ai.run(MODEL, aiInput, {
      gateway: { id: "default" },
    })) as unknown;

    // Generiertes Bild defensiv extrahieren (Antwortform kann variieren).
    let b64 = "";
    if (typeof resp === "string") {
      b64 = resp;
    } else if (resp && typeof resp === "object") {
      const r = resp as Record<string, unknown>;
      const strKeys = ["image", "image_b64", "b64_json", "data"];
      for (const k of strKeys) {
        if (typeof r[k] === "string" && r[k]) {
          b64 = r[k] as string;
          break;
        }
      }
      if (!b64 && Array.isArray(r.images) && typeof r.images[0] === "string") {
        b64 = r.images[0] as string;
      }
      if (!b64 && Array.isArray(r.data) && r.data[0]) {
        const d0 = r.data[0] as Record<string, unknown>;
        if (typeof d0.b64_json === "string") b64 = d0.b64_json;
      }
    }

    if (b64) {
      return jsonResponse({
        ok: true,
        view,
        image: `data:image/png;base64,${stripB64(b64)}`,
      });
    }

    // Kein Bild gefunden → Rohantwort (gekürzt) zum Einordnen zurückgeben.
    return jsonResponse(
      {
        ok: false,
        view,
        error: "Kein Bild in der KI-Antwort gefunden.",
        rawKeys:
          resp && typeof resp === "object"
            ? Object.keys(resp as Record<string, unknown>)
            : typeof resp,
        raw: JSON.stringify(resp).slice(0, 800),
      },
      { status: 502 },
    );
  } catch (e) {
    return jsonResponse(
      { ok: false, view, error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
};
