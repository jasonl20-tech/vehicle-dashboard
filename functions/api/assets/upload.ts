/**
 * Asset-Upload.
 *
 *   POST /api/assets/upload  (multipart/form-data)
 *     Felder:
 *       - file        (Pflicht, eine Datei)
 *       - folder      (optional, default "")
 *       - name        (optional, sonst aus file.name abgeleitet)
 *       - alt_text    (optional)
 *       - description (optional)
 *       - overwrite   (optional, "1" überschreibt eine existierende Datei)
 *     → 201 mit voller Asset-Zeile
 *
 * Ablauf:
 *   1. Auth-Check, Binding-Check.
 *   2. FormData parsen, name/folder validieren.
 *   3. Bei Konflikt (key existiert) → 409, außer overwrite=1.
 *   4. Bytes nach R2 schreiben (`env.assets.put(key, body, {…})`).
 *   5. D1-Eintrag schreiben oder UPDATEn.
 *
 * Fehler-Modi:
 *   - R2-Put schlägt fehl → keine D1-Änderung, 502.
 *   - D1-Insert schlägt fehl → R2-Object wird wieder gelöscht (best-effort).
 */
import { getCurrentUser, jsonResponse, type AuthEnv } from "../../_lib/auth";
import {
  MAX_FILE_BYTES,
  joinKey,
  normalizeFolder,
  normalizeName,
  requireBindings,
  rowToAsset,
  tableMissingHint,
  type AssetRow,
} from "../../_lib/assets";

type DbRow = Omit<AssetRow, "url">;

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

  const ctype = request.headers.get("content-type") || "";
  if (!ctype.toLowerCase().includes("multipart/form-data")) {
    return jsonResponse(
      { error: "Erwarte multipart/form-data" },
      { status: 400 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch (e) {
    return jsonResponse(
      { error: `FormData konnte nicht gelesen werden: ${(e as Error).message}` },
      { status: 400 },
    );
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return jsonResponse(
      { error: "Feld `file` fehlt oder ist keine Datei" },
      { status: 400 },
    );
  }
  if (file.size <= 0) {
    return jsonResponse({ error: "Leere Datei" }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return jsonResponse(
      {
        error: `Datei zu groß: ${file.size} Bytes (Limit ${MAX_FILE_BYTES})`,
      },
      { status: 413 },
    );
  }

  let folder: string;
  try {
    folder = normalizeFolder((form.get("folder") as string | null) ?? "");
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, { status: 400 });
  }

  const overrideName = (form.get("name") as string | null) ?? "";
  const altText = ((form.get("alt_text") as string | null) ?? "").trim();
  const description = ((form.get("description") as string | null) ?? "").trim();
  const overwrite = (form.get("overwrite") as string | null) === "1";

  let name: string;
  try {
    name = normalizeName(overrideName.trim() || file.name);
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, { status: 400 });
  }

  const key = joinKey(folder, name);
  const contentType = file.type || "application/octet-stream";

  try {
    // Konflikt-Check: existiert die Key bereits?
    const existing = await env
      .website!.prepare("SELECT id FROM assets WHERE key = ? LIMIT 1")
      .bind(key)
      .first<{ id: number }>();
    if (existing && !overwrite) {
      return jsonResponse(
        {
          error: `Datei \`${key}\` existiert bereits`,
          hint: "Setze overwrite=1, um zu überschreiben — oder benenne die Datei um.",
          key,
        },
        { status: 409 },
      );
    }

    // R2: Bytes schreiben
    const bytes = await file.arrayBuffer();
    let putOk = false;
    try {
      await env.assets!.put(key, bytes, {
        httpMetadata: {
          contentType,
          // Lange Cache-Zeit, da die Custom-Domain keine Versionierung hat —
          // bei Updates auf dieselbe Datei sieht der Browser Stale-Cache,
          // bis er neu lädt. Für Bilder im Email-Kontext ok.
          cacheControl: "public, max-age=31536000, immutable",
        },
        customMetadata: {
          uploadedBy: String(user.id),
          originalName: file.name.slice(0, 255),
        },
      });
      putOk = true;
    } catch (e) {
      return jsonResponse(
        {
          error: `R2-Upload fehlgeschlagen: ${(e as Error).message || String(e)}`,
        },
        { status: 502 },
      );
    }

    // D1-Eintrag (Insert oder Update)
    try {
      if (existing) {
        await env
          .website!.prepare(
            `UPDATE assets SET
               folder = ?,
               name = ?,
               size = ?,
               content_type = ?,
               kind = 'file',
               alt_text = ?,
               description = ?,
               uploaded_by = ?,
               updated_at = CURRENT_TIMESTAMP
             WHERE key = ?`,
          )
          .bind(
            folder,
            name,
            file.size,
            contentType,
            altText || null,
            description || null,
            user.id,
            key,
          )
          .run();
      } else {
        await env
          .website!.prepare(
            `INSERT INTO assets (
               key, folder, name, size, content_type, kind,
               alt_text, description, uploaded_by, uploaded_at, updated_at
             ) VALUES (?, ?, ?, ?, ?, 'file', ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          )
          .bind(
            key,
            folder,
            name,
            file.size,
            contentType,
            altText || null,
            description || null,
            user.id,
          )
          .run();
      }
    } catch (e) {
      // D1-Insert kaputt → R2-Object best-effort wieder löschen.
      if (putOk && !existing) {
        try {
          await env.assets!.delete(key);
        } catch {
          // ignore
        }
      }
      const hint = tableMissingHint(e);
      return jsonResponse(
        {
          error: `D1-Insert fehlgeschlagen: ${(e as Error).message}`,
          ...(hint ? { hint } : null),
        },
        { status: hint ? 503 : 500 },
      );
    }

    const row = await env
      .website!.prepare(
        `SELECT id, key, folder, name, size, content_type, kind, alt_text, description,
                uploaded_by, uploaded_at, updated_at
           FROM assets WHERE key = ? LIMIT 1`,
      )
      .bind(key)
      .first<DbRow>();

    if (!row) {
      return jsonResponse({ error: "Eintrag nicht gefunden nach Insert" }, {
        status: 500,
      });
    }
    return jsonResponse(rowToAsset(env, row), { status: 201 });
  } catch (e) {
    const hint = tableMissingHint(e);
    return jsonResponse(
      {
        error: (e as Error).message || String(e),
        ...(hint ? { hint } : null),
      },
      { status: hint ? 503 : 500 },
    );
  }
};
