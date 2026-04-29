/**
 * Folder-Operations.
 *
 *   GET  /api/assets/folders
 *     → { folders: { path, parent, count }[] }
 *     Liefert ALLE bekannten Folder (von Root abwärts), inklusive ihrer
 *     direkten Kinder-Anzahl. Reicht für einen Folder-Tree mit Lazy-
 *     Expansion.
 *
 *   POST /api/assets/folders   { path: "email/team" }
 *     → 201 mit dem neuen Folder-Marker
 *     Legt einen leeren Ordner an (D1-Eintrag mit kind='folder' ohne R2-
 *     Object). Ist der Ordner durch eine Datei sowieso schon "implizit"
 *     vorhanden, ist die Operation idempotent.
 */
import { getCurrentUser, jsonResponse, type AuthEnv } from "../../_lib/auth";
import {
  joinKey,
  normalizeFolder,
  requireBindings,
  rowToAsset,
  splitKey,
  tableMissingHint,
  type AssetRow,
} from "../../_lib/assets";

type DbRow = Omit<AssetRow, "url">;

/** Erzeugt aus `email/team/sub` die Liste aller übergeordneten Pfade
 *  (`email`, `email/team`, `email/team/sub`). */
function expandPaths(path: string): string[] {
  if (!path) return [];
  const parts = path.split("/");
  const out: string[] = [];
  let cur = "";
  for (const p of parts) {
    cur = cur ? `${cur}/${p}` : p;
    out.push(cur);
  }
  return out;
}

export const onRequestGet: PagesFunction<AuthEnv> = async ({
  request,
  env,
}) => {
  const user = await getCurrentUser(env, request);
  if (!user) {
    return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  }
  const fail = requireBindings(env);
  if (fail) return fail;

  try {
    // Ein Ordner ist entweder explizit als kind='folder'-Datensatz
    // angelegt, oder implizit durch mindestens eine Datei mit
    // folder=<pfad> präsent. Wir sammeln beide Quellen.
    const explicit = await env
      .website!.prepare(
        `SELECT id, key AS path FROM assets WHERE kind = 'folder' ORDER BY key`,
      )
      .all<{ id: number; path: string }>();

    const implicit = await env
      .website!.prepare(
        `SELECT DISTINCT folder AS path FROM assets WHERE folder != '' ORDER BY folder`,
      )
      .all<{ path: string }>();

    const pathSet = new Set<string>();
    const explicitIds = new Map<string, number>();
    for (const r of explicit.results ?? []) {
      if (r.path) {
        pathSet.add(r.path);
        explicitIds.set(r.path, r.id);
      }
    }
    for (const r of implicit.results ?? []) {
      if (r.path) {
        // Auch alle Eltern-Pfade zur Set hinzufügen, damit der
        // Tree konsistent ist (`email/team/sub` impliziert `email`
        // und `email/team`).
        for (const p of expandPaths(r.path)) pathSet.add(p);
      }
    }

    const paths = Array.from(pathSet).sort();
    // Pro Folder: Kinder-Anzahl (nur direkte Kinder)
    const counts = new Map<string, number>();
    if (paths.length > 0) {
      const placeholders = paths.map(() => "?").join(",");
      const { results } = await env
        .website!.prepare(
          `SELECT folder, COUNT(*) AS n
             FROM assets
            WHERE folder IN (${placeholders})
              AND name NOT IN ('.keep', '.placeholder')
            GROUP BY folder`,
        )
        .bind(...paths)
        .all<{ folder: string; n: number }>();
      for (const r of results ?? []) {
        counts.set(r.folder, r.n);
      }
    }

    const folders = paths.map((path) => {
      const { folder: parent, name } = splitKey(path);
      return {
        path,
        name,
        parent: parent || null,
        count: counts.get(path) ?? 0,
        id: explicitIds.get(path) ?? null,
      };
    });

    return jsonResponse({ folders });
  } catch (e) {
    const hint = tableMissingHint(e);
    return jsonResponse(
      { error: (e as Error).message, ...(hint ? { hint } : null) },
      { status: hint ? 503 : 500 },
    );
  }
};

type PostBody = { path?: string };

export const onRequestPost: PagesFunction<AuthEnv> = async ({
  request,
  env,
}) => {
  const user = await getCurrentUser(env, request);
  if (!user) {
    return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  }
  const fail = requireBindings(env);
  if (fail) return fail;

  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return jsonResponse({ error: "Ungültige JSON-Anfrage" }, { status: 400 });
  }

  let path: string;
  try {
    path = normalizeFolder(body.path ?? "");
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, { status: 400 });
  }
  if (!path) {
    return jsonResponse(
      { error: "path darf nicht leer sein" },
      { status: 400 },
    );
  }

  try {
    // Existiert bereits ein Folder-Marker oder eine Datei in diesem Ordner?
    const existsMarker = await env
      .website!.prepare(
        "SELECT id FROM assets WHERE kind = 'folder' AND key = ? LIMIT 1",
      )
      .bind(path)
      .first<{ id: number }>();
    if (existsMarker) {
      const row = await env
        .website!.prepare(
          `SELECT id, key, folder, name, size, content_type, kind, alt_text,
                  description, uploaded_by, uploaded_at, updated_at
             FROM assets WHERE id = ? LIMIT 1`,
        )
        .bind(existsMarker.id)
        .first<DbRow>();
      if (row) return jsonResponse(rowToAsset(env, row));
    }

    const { folder: parent, name } = splitKey(path);
    await env
      .website!.prepare(
        `INSERT INTO assets (
           key, folder, name, size, content_type, kind, uploaded_by, uploaded_at, updated_at
         ) VALUES (?, ?, ?, 0, 'inode/directory', 'folder', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      )
      .bind(path, parent, name, user.id)
      .run();

    // Marker in R2 anlegen (nicht zwingend, hilft aber bei direkter
    // R2-Inspektion). Wir legen `<path>/.keep` mit 0-Bytes an. Dieser
    // Marker hat KEINEN D1-Eintrag und wird vom Listing-Filter
    // ausgeblendet (HIDDEN_NAMES enthält `.keep`).
    try {
      await env.assets!.put(joinKey(path, ".keep"), new Uint8Array(0), {
        httpMetadata: { contentType: "text/plain" },
        customMetadata: { folderMarker: "1" },
      });
    } catch {
      // R2 nicht erreichbar → der D1-Eintrag reicht; Folder ist trotzdem
      // sichtbar im Browser.
    }

    const row = await env
      .website!.prepare(
        `SELECT id, key, folder, name, size, content_type, kind, alt_text,
                description, uploaded_by, uploaded_at, updated_at
           FROM assets WHERE key = ? LIMIT 1`,
      )
      .bind(path)
      .first<DbRow>();
    if (!row) {
      return jsonResponse(
        { error: "Folder verschwunden nach Insert" },
        { status: 500 },
      );
    }
    return jsonResponse(rowToAsset(env, row), { status: 201 });
  } catch (e) {
    const msg = (e as Error).message;
    if (msg && (msg.includes("UNIQUE") || msg.includes("unique"))) {
      // Race-Bedingung: gleichzeitig angelegt — wir werten es als idempotent.
      const row = await env
        .website!.prepare(
          `SELECT id, key, folder, name, size, content_type, kind, alt_text,
                  description, uploaded_by, uploaded_at, updated_at
             FROM assets WHERE key = ? LIMIT 1`,
        )
        .bind(path)
        .first<DbRow>();
      if (row) return jsonResponse(rowToAsset(env, row));
    }
    const hint = tableMissingHint(e);
    return jsonResponse(
      { error: msg, ...(hint ? { hint } : null) },
      { status: hint ? 503 : 500 },
    );
  }
};
