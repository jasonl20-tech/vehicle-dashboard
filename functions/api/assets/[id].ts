/**
 * Asset-Einzeloperationen.
 *
 *   GET    /api/assets/:id  → vollständige Zeile
 *   PATCH  /api/assets/:id  { name?, folder?, alt_text?, description? }
 *                          → 200 mit aktualisierter Zeile
 *                          (Bei `name`/`folder`-Änderung wird der R2-Key
 *                          mit `copy + delete` migriert.)
 *   DELETE /api/assets/:id  → 204 (löscht D1 + R2)
 */
import { getCurrentUser, jsonResponse, type AuthEnv } from "../../_lib/auth";
import {
  joinKey,
  normalizeFolder,
  normalizeName,
  requireBindings,
  rowToAsset,
  tableMissingHint,
  type AssetRow,
} from "../../_lib/assets";

type DbRow = Omit<AssetRow, "url">;

function paramId(params: Record<string, string | string[] | undefined>): number {
  const v = params.id;
  const s = typeof v === "string" ? v : Array.isArray(v) ? v[0] : "";
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

async function loadById(env: AuthEnv, id: number): Promise<DbRow | null> {
  return await env
    .website!.prepare(
      `SELECT id, key, folder, name, size, content_type, kind, alt_text, description,
              uploaded_by, uploaded_at, updated_at
         FROM assets WHERE id = ? LIMIT 1`,
    )
    .bind(id)
    .first<DbRow>();
}

export const onRequestGet: PagesFunction<AuthEnv> = async ({
  request,
  env,
  params,
}) => {
  const user = await getCurrentUser(env, request);
  if (!user) {
    return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  }
  const fail = requireBindings(env);
  if (fail) return fail;
  const id = paramId(params);
  if (!id) return jsonResponse({ error: "id fehlt" }, { status: 400 });

  try {
    const row = await loadById(env, id);
    if (!row) {
      return jsonResponse({ error: "Asset nicht gefunden" }, { status: 404 });
    }
    return jsonResponse(rowToAsset(env, row));
  } catch (e) {
    const hint = tableMissingHint(e);
    return jsonResponse(
      { error: (e as Error).message, ...(hint ? { hint } : null) },
      { status: hint ? 503 : 500 },
    );
  }
};

type PatchBody = {
  name?: string;
  folder?: string;
  alt_text?: string | null;
  description?: string | null;
};

export const onRequestPatch: PagesFunction<AuthEnv> = async ({
  request,
  env,
  params,
}) => {
  const user = await getCurrentUser(env, request);
  if (!user) {
    return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  }
  const fail = requireBindings(env);
  if (fail) return fail;
  const id = paramId(params);
  if (!id) return jsonResponse({ error: "id fehlt" }, { status: 400 });

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return jsonResponse({ error: "Ungültige JSON-Anfrage" }, { status: 400 });
  }

  try {
    const cur = await loadById(env, id);
    if (!cur) {
      return jsonResponse({ error: "Asset nicht gefunden" }, { status: 404 });
    }

    let newName = cur.name;
    let newFolder = cur.folder;
    if (typeof body.name === "string") {
      try {
        newName = normalizeName(body.name);
      } catch (e) {
        return jsonResponse({ error: (e as Error).message }, { status: 400 });
      }
    }
    if (typeof body.folder === "string") {
      try {
        newFolder = normalizeFolder(body.folder);
      } catch (e) {
        return jsonResponse({ error: (e as Error).message }, { status: 400 });
      }
    }

    const altText =
      body.alt_text === undefined
        ? cur.alt_text
        : typeof body.alt_text === "string"
          ? body.alt_text.trim() || null
          : null;
    const description =
      body.description === undefined
        ? cur.description
        : typeof body.description === "string"
          ? body.description.trim() || null
          : null;

    const newKey = joinKey(newFolder, newName);
    const keyChanged = newKey !== cur.key;

    if (keyChanged) {
      // Konflikt-Check
      const exists = await env
        .website!.prepare("SELECT id FROM assets WHERE key = ? LIMIT 1")
        .bind(newKey)
        .first<{ id: number }>();
      if (exists) {
        return jsonResponse(
          { error: `Datei \`${newKey}\` existiert bereits` },
          { status: 409 },
        );
      }

      if (cur.kind === "file") {
        // R2: copy + delete (R2 hat kein "rename"). Für sehr große
        // Dateien wäre hier Multipart-Copy schöner, für unsere
        // 25-MB-Schwelle ist GET+PUT akzeptabel.
        const obj = await env.assets!.get(cur.key);
        if (!obj) {
          // Source verschwunden — nur D1-Eintrag aktualisieren.
        } else {
          await env.assets!.put(newKey, obj.body, {
            httpMetadata: obj.httpMetadata,
            customMetadata: obj.customMetadata,
          });
          try {
            await env.assets!.delete(cur.key);
          } catch {
            // ignore — best effort
          }
        }
      }
    }

    await env
      .website!.prepare(
        `UPDATE assets SET
           key = ?, folder = ?, name = ?, alt_text = ?, description = ?,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
      )
      .bind(newKey, newFolder, newName, altText, description, id)
      .run();

    const row = await loadById(env, id);
    if (!row) {
      return jsonResponse(
        { error: "Asset verschwunden nach Update" },
        { status: 500 },
      );
    }
    return jsonResponse(rowToAsset(env, row));
  } catch (e) {
    const hint = tableMissingHint(e);
    return jsonResponse(
      { error: (e as Error).message, ...(hint ? { hint } : null) },
      { status: hint ? 503 : 500 },
    );
  }
};

export const onRequestDelete: PagesFunction<AuthEnv> = async ({
  request,
  env,
  params,
}) => {
  const user = await getCurrentUser(env, request);
  if (!user) {
    return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  }
  const fail = requireBindings(env);
  if (fail) return fail;
  const id = paramId(params);
  if (!id) return jsonResponse({ error: "id fehlt" }, { status: 400 });

  try {
    const cur = await loadById(env, id);
    if (!cur) {
      return jsonResponse({ error: "Asset nicht gefunden" }, { status: 404 });
    }

    // Ordner-Marker: D1-Eintrag löschen, kein R2-Delete nötig (kein Object).
    if (cur.kind === "folder") {
      // Beim Löschen eines Ordners: nur erlauben, wenn er leer ist
      // (Kinder mit folder=cur.key oder folder STARTS WITH cur.key/).
      const keyPrefix = cur.key + "/";
      const childCount =
        (
          await env
            .website!.prepare(
              `SELECT COUNT(*) AS n FROM assets
                 WHERE id != ? AND (folder = ? OR folder LIKE ?)`,
            )
            .bind(id, cur.key, `${keyPrefix}%`)
            .first<{ n: number }>()
        )?.n ?? 0;
      if (childCount > 0) {
        return jsonResponse(
          {
            error: `Ordner \`${cur.key}\` ist nicht leer (${childCount} Einträge)`,
            hint: "Lösche oder verschiebe zuerst alle Dateien aus diesem Ordner.",
          },
          { status: 409 },
        );
      }
      await env
        .website!.prepare("DELETE FROM assets WHERE id = ?")
        .bind(id)
        .run();
      return new Response(null, { status: 204 });
    }

    // Datei: erst R2 löschen, dann D1.
    try {
      await env.assets!.delete(cur.key);
    } catch (e) {
      return jsonResponse(
        {
          error: `R2-Delete fehlgeschlagen: ${(e as Error).message}`,
        },
        { status: 502 },
      );
    }
    await env
      .website!.prepare("DELETE FROM assets WHERE id = ?")
      .bind(id)
      .run();
    return new Response(null, { status: 204 });
  } catch (e) {
    const hint = tableMissingHint(e);
    return jsonResponse(
      { error: (e as Error).message, ...(hint ? { hint } : null) },
      { status: hint ? 503 : 500 },
    );
  }
};
