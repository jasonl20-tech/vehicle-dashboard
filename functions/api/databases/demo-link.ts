/**
 * GET/POST/DELETE /api/databases/demo-link
 *
 * Admin-Verwaltung der Kunden-Demo-Links (nur angemeldete Dashboard-Nutzer;
 * reitet auf der bestehenden `/api/databases/*`-Freigabe der Car Database).
 *
 *  GET    → Liste aller Links (mit Status/Ablauf/Nutzung)
 *  POST   → neuen Link erzeugen { name, allowedColors[], featured[], showroom[], expiresInDays }
 *  DELETE ?token=… → Link sperren (revoke)
 */

import { getCurrentUser, jsonResponse, type AuthEnv } from "../../_lib/auth";
import {
  createDemoLink,
  listDemoLinks,
  revokeDemoLink,
  warmDemoLink,
} from "../../_lib/demoLinks";

export const onRequestGet: PagesFunction<AuthEnv> = async ({ request, env }) => {
  const user = await getCurrentUser(env, request);
  if (!user) return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  try {
    const links = await listDemoLinks(env);
    return jsonResponse({ links });
  } catch (e) {
    return jsonResponse(
      { error: (e as Error)?.message || "Demo-Links konnten nicht geladen werden." },
      { status: 500 },
    );
  }
};

export const onRequestPost: PagesFunction<AuthEnv> = async ({
  request,
  env,
  waitUntil,
}) => {
  const user = await getCurrentUser(env, request);
  if (!user) return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: "Ungültiger Body (JSON erwartet)." }, { status: 400 });
  }

  try {
    const res = await createDemoLink(env, {
      name: String(body.name ?? ""),
      allowedColors: body.allowedColors,
      featured: body.featured,
      showroom: body.showroom,
      expiresInDays: Number(body.expiresInDays) || 7,
      createdBy: user.id,
    });
    if (!res.ok) return jsonResponse({ error: res.error }, { status: 400 });
    // Wichtigste „Cover"-Bilder im Hintergrund vorwärmen (URL-Cache + CDN) →
    // schon der erste Kundenbesuch ist schnell. Best effort, blockiert die
    // Antwort nicht.
    waitUntil(warmDemoLink(env, res.link));
    return jsonResponse({ link: res.link });
  } catch (e) {
    return jsonResponse(
      { error: (e as Error)?.message || "Demo-Link konnte nicht erstellt werden." },
      { status: 500 },
    );
  }
};

export const onRequestDelete: PagesFunction<AuthEnv> = async ({ request, env }) => {
  const user = await getCurrentUser(env, request);
  if (!user) return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  const token = (new URL(request.url).searchParams.get("token") || "").trim();
  if (!token) return jsonResponse({ error: "token fehlt" }, { status: 400 });
  try {
    const ok = await revokeDemoLink(env, token);
    return jsonResponse({ ok });
  } catch (e) {
    return jsonResponse(
      { error: (e as Error)?.message || "Sperren fehlgeschlagen." },
      { status: 500 },
    );
  }
};
