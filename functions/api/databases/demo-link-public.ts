/**
 * GET /api/databases/demo-link-public?token=dl_…
 *
 * ÖFFENTLICH (in der Middleware von der Session-Pflicht ausgenommen). Liefert die
 * Konfiguration eines gültigen Demo-Links (Name, Ablauf, erlaubte Farben +
 * Fahrzeug-Snapshot), damit die öffentliche Demo-Seite `/d/:token` ohne Login
 * rendern kann. Ungültig/abgelaufen/gesperrt → `{ ok: false }` (HTTP 200, damit
 * die Seite eine saubere „Link abgelaufen"-Meldung zeigen kann).
 */

import { jsonResponse, type AuthEnv } from "../../_lib/auth";
import { getValidDemoLink } from "../../_lib/demoLinks";

export const onRequestGet: PagesFunction<AuthEnv> = async ({ request, env }) => {
  const token = (new URL(request.url).searchParams.get("token") || "").trim();
  let cfg = null;
  try {
    cfg = await getValidDemoLink(env, token);
  } catch {
    cfg = null;
  }
  if (!cfg) {
    return jsonResponse({ ok: false, reason: "invalid_or_expired" });
  }
  return jsonResponse({
    ok: true,
    name: cfg.name,
    expiresAt: cfg.expiresAt,
    allowedColors: cfg.allowedColors,
    featured: cfg.featured,
    showroom: cfg.showroom,
  });
};
