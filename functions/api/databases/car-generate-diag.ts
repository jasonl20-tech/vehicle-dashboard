/**
 * GET /api/databases/car-generate-diag?key=<CAR_DB_API_KEY>
 *
 * TEMPORÄR — Diagnose: prüft, ob die Workers-AI-Bindung google/nano-banana-2
 * über das AI-Gateway „default" erreichbar ist. Gibt die rohe Antwortstruktur
 * (oder den Fehler) zurück. Gesichert über den internen CAR_DB_API_KEY, damit
 * es nicht offen missbraucht werden kann. Speichert nichts.
 */

import { jsonResponse, type AuthEnv } from "../../_lib/auth";
import { getWorkersAiBinding } from "../../_lib/workersAiBinding";

export const onRequestGet: PagesFunction<AuthEnv> = async ({ request, env }) => {
  const url = new URL(request.url);
  if (!env.CAR_DB_API_KEY || url.searchParams.get("key") !== env.CAR_DB_API_KEY) {
    return jsonResponse({ error: "forbidden" }, { status: 403 });
  }
  const ai = getWorkersAiBinding(env);
  if (!ai) return jsonResponse({ error: "no AI binding" }, { status: 503 });

  const withGateway = url.searchParams.get("gw") !== "0";
  const t0 = Date.now();
  try {
    const resp = (await ai.run(
      "google/nano-banana-2",
      {
        prompt:
          "studio product photo of a silver sedan car, front-left three-quarter view, plain white background",
        aspect_ratio: "4:3",
        output_format: "png",
        resolution: "1K",
      },
      withGateway ? { gateway: { id: "default" } } : undefined,
    )) as unknown;
    const ms = Date.now() - t0;
    const isObj = resp && typeof resp === "object";
    return jsonResponse({
      ok: true,
      ms,
      gateway: withGateway,
      type: typeof resp,
      keys: isObj ? Object.keys(resp as Record<string, unknown>) : null,
      sample: JSON.stringify(resp).slice(0, 400),
    });
  } catch (e) {
    return jsonResponse(
      {
        ok: false,
        ms: Date.now() - t0,
        gateway: withGateway,
        error: e instanceof Error ? e.message : String(e),
        name: e instanceof Error ? e.name : typeof e,
      },
      { status: 502 },
    );
  }
};
