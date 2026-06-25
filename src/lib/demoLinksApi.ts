/**
 * Frontend-Helfer für Demo-Links: Admin-Verwaltung (erstellen/auflisten/sperren)
 * + öffentliches Laden der Link-Konfiguration für `/d/:token`.
 */

import type { DemoCar } from "./demoCars";

export const DEMO_LINK_ADMIN = "/api/databases/demo-link";
export const DEMO_LINK_PUBLIC = "/api/databases/demo-link-public";

export type DemoLink = {
  token: string;
  name: string;
  allowedColors: string[];
  featured: DemoCar[];
  showroom: DemoCar[];
  status: "active" | "revoked";
  createdAt: number;
  expiresAt: number;
};

export type DemoLinkListItem = DemoLink & {
  hitsToday: number;
  lastUsedAt: number | null;
  expired: boolean;
};

export type DemoPublicConfig =
  | {
      ok: true;
      name: string;
      expiresAt: number;
      allowedColors: string[];
      featured: DemoCar[];
      showroom: DemoCar[];
    }
  | { ok: false; reason?: string };

/** Vollständige, teilbare Demo-URL aus einem Token. */
export function demoLinkUrl(token: string): string {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/d/${token}`;
}

export async function listDemoLinks(): Promise<DemoLinkListItem[]> {
  const r = await fetch(DEMO_LINK_ADMIN, { credentials: "include" });
  const j = (await r.json().catch(() => ({}))) as {
    links?: DemoLinkListItem[];
    error?: string;
  };
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
  return j.links ?? [];
}

export async function createDemoLink(input: {
  name: string;
  allowedColors: string[];
  featured: DemoCar[];
  showroom: DemoCar[];
  expiresInDays: number;
}): Promise<DemoLink> {
  const r = await fetch(DEMO_LINK_ADMIN, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const j = (await r.json().catch(() => ({}))) as {
    link?: DemoLink;
    error?: string;
  };
  if (!r.ok || !j.link) throw new Error(j.error || `HTTP ${r.status}`);
  return j.link;
}

export async function revokeDemoLink(token: string): Promise<void> {
  const r = await fetch(
    `${DEMO_LINK_ADMIN}?token=${encodeURIComponent(token)}`,
    { method: "DELETE", credentials: "include" },
  );
  if (!r.ok) {
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error || `HTTP ${r.status}`);
  }
}

/** Öffentlich (ohne Login) — lädt die Konfiguration eines Demo-Links. */
export async function fetchDemoPublicConfig(
  token: string,
): Promise<DemoPublicConfig> {
  try {
    const r = await fetch(
      `${DEMO_LINK_PUBLIC}?token=${encodeURIComponent(token)}`,
    );
    const j = (await r.json().catch(() => ({}))) as DemoPublicConfig;
    if (!r.ok) return { ok: false, reason: "error" };
    return j;
  } catch {
    return { ok: false, reason: "network" };
  }
}
