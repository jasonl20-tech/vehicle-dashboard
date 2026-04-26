/**
 * D1: Mapping-Tabellen (env.mapping), siehe `functions/api/mapping.ts`.
 */
export const MAPPING_API = "/api/mapping";

export const MAPPING_TABLE_OPTIONS = [
  { id: "manufacture_mapping" as const, label: "Hersteller" },
  { id: "model_mapping" as const, label: "Modelle" },
  { id: "color_mapping" as const, label: "Farben" },
  { id: "body_mapping" as const, label: "Karosserie" },
  { id: "trim_mapping" as const, label: "Trims" },
] as const;

export type MappingTableId = (typeof MAPPING_TABLE_OPTIONS)[number]["id"];

export type MappingListResponse = {
  table: string;
  rows: Record<string, unknown>[];
  total: number;
  limit: number;
  offset: number;
  q: string | null;
};

export function mappingListUrl(
  table: string,
  opts?: { q?: string; limit?: number; offset?: number },
): string {
  const u = new URL(MAPPING_API, "https://x");
  u.searchParams.set("table", table);
  if (opts?.q) u.searchParams.set("q", opts.q);
  if (opts?.limit != null) u.searchParams.set("limit", String(opts.limit));
  if (opts?.offset != null) u.searchParams.set("offset", String(opts.offset));
  return u.pathname + u.search;
}

export async function postMappingRow(
  table: MappingTableId,
  row: Record<string, unknown>,
): Promise<{ row: Record<string, unknown> }> {
  const res = await fetch(MAPPING_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ table, row }),
  });
  const j = (await res.json().catch(() => ({}))) as { error?: string; row?: Record<string, unknown> };
  if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
  if (!j.row) throw new Error("Ungültige Antwort");
  return { row: j.row };
}

export async function putMappingRow(
  table: MappingTableId,
  id: number,
  row: Record<string, unknown>,
): Promise<void> {
  const res = await fetch(MAPPING_API, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ table, id, row }),
  });
  const j = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
}

export async function deleteMappingRow(
  table: MappingTableId,
  id: number,
): Promise<void> {
  const u = new URL(MAPPING_API, "https://x");
  u.searchParams.set("table", table);
  u.searchParams.set("id", String(id));
  const res = await fetch(u.pathname + u.search, {
    method: "DELETE",
    credentials: "include",
  });
  const j = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
}

export function asStr(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return String(v);
}
