/**
 * Einzel-Asset-Operationen — Schlüssel via Query-Param `?key=`,
 * weil R2-Keys Slashes enthalten und Pages-Functions Pfad-Parameter
 * mit Slashes nicht zuverlässig durchreichen.
 *
 *   GET    /api/assets/item?key=email/banner.png         → Asset-Zeile
 *   PATCH  /api/assets/item?key=email/banner.png
 *          { name?, folder?, alt_text?, description? }    → 200 mit neuem Asset
 *          (Bei `name`/`folder`-Änderung wird in R2 per copy+delete
 *          umgezogen.)
 *   DELETE /api/assets/item?key=email/banner.png         → 204
 *
 * Datei-Metadaten (`alt_text`, `description`, `uploaded_by`) leben in
 * R2 customMetadata. R2 kennt keine Metadata-Patches — Änderungen werden
 * durch Re-Upload (Stream get → put mit gleichen Bytes + neuer Metadata)
 * realisiert.
 */
import { getCurrentUser, jsonResponse, type AuthEnv } from "../../_lib/auth";
import {
  buildCustomMetadata,
  joinKey,
  normalizeFolder,
  normalizeName,
  r2ObjectToAsset,
  requireAssetsBucket,
  splitKey,
} from "../../_lib/assets";

function readKey(url: URL): string {
  const k = (url.searchParams.get("key") || "").trim();
  return k.replace(/^\/+/, "");
}

export const onRequestGet: PagesFunction<AuthEnv> = async ({
  request,
  env,
}) => {
  const user = await getCurrentUser(env, request);
  if (!user) {
    return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  }
  const bucketOrErr = requireAssetsBucket(env);
  if (bucketOrErr instanceof Response) return bucketOrErr;
  const bucket = bucketOrErr;

  const key = readKey(new URL(request.url));
  if (!key) {
    return jsonResponse({ error: "key fehlt" }, { status: 400 });
  }
  try {
    const obj = await bucket.head(key);
    if (!obj) {
      return jsonResponse({ error: "Asset nicht gefunden" }, { status: 404 });
    }
    return jsonResponse(r2ObjectToAsset(env, obj));
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, { status: 500 });
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
}) => {
  const user = await getCurrentUser(env, request);
  if (!user) {
    return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  }
  const bucketOrErr = requireAssetsBucket(env);
  if (bucketOrErr instanceof Response) return bucketOrErr;
  const bucket = bucketOrErr;

  const key = readKey(new URL(request.url));
  if (!key) {
    return jsonResponse({ error: "key fehlt" }, { status: 400 });
  }
  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return jsonResponse({ error: "Ungültige JSON-Anfrage" }, { status: 400 });
  }

  try {
    // Aktuelles Object holen
    const cur = await bucket.head(key);
    if (!cur) {
      return jsonResponse({ error: "Asset nicht gefunden" }, { status: 404 });
    }

    // Neuer Key bestimmen
    const { folder: curFolder, name: curName } = splitKey(key);
    let newName = curName;
    let newFolder = curFolder;
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
    const newKey = joinKey(newFolder, newName);
    const keyChanged = newKey !== key;

    if (keyChanged) {
      const conflict = await bucket.head(newKey);
      if (conflict) {
        return jsonResponse(
          { error: `Datei \`${newKey}\` existiert bereits` },
          { status: 409 },
        );
      }
    }

    // Metadata berechnen — wir mergen mit bestehenden customMetadata,
    // damit Felder, die nicht im Patch sind, erhalten bleiben.
    const baseMeta = cur.customMetadata ?? {};
    const updatedMeta = buildCustomMetadata(
      {
        altText: body.alt_text === undefined ? undefined : body.alt_text,
        description:
          body.description === undefined ? undefined : body.description,
      },
      baseMeta,
    );

    // Body lesen (um zu re-uploaden) — nur wenn key wechselt ODER
    // Metadata sich ändert. Wenn nichts ändert, antworten wir direkt.
    const metaChanged =
      JSON.stringify(updatedMeta) !== JSON.stringify(baseMeta);
    if (!keyChanged && !metaChanged) {
      return jsonResponse(r2ObjectToAsset(env, cur));
    }

    const obj = await bucket.get(key);
    if (!obj) {
      return jsonResponse(
        { error: "Asset zwischenzeitlich verschwunden" },
        { status: 404 },
      );
    }

    // Neu schreiben (entweder unter altem oder neuem Key)
    const written = await bucket.put(newKey, obj.body, {
      httpMetadata: cur.httpMetadata,
      customMetadata: updatedMeta,
    });
    if (!written) {
      return jsonResponse(
        { error: "R2-Update fehlgeschlagen" },
        { status: 502 },
      );
    }

    if (keyChanged) {
      try {
        await bucket.delete(key);
      } catch {
        // best-effort — wenn delete fehlschlägt, lebt das alte Object
        // weiter, der neue Key existiert aber bereits korrekt.
      }
    }

    return jsonResponse(r2ObjectToAsset(env, written));
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, { status: 500 });
  }
};

export const onRequestDelete: PagesFunction<AuthEnv> = async ({
  request,
  env,
}) => {
  const user = await getCurrentUser(env, request);
  if (!user) {
    return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  }
  const bucketOrErr = requireAssetsBucket(env);
  if (bucketOrErr instanceof Response) return bucketOrErr;
  const bucket = bucketOrErr;

  const key = readKey(new URL(request.url));
  if (!key) {
    return jsonResponse({ error: "key fehlt" }, { status: 400 });
  }

  try {
    const cur = await bucket.head(key);
    if (!cur) {
      return jsonResponse({ error: "Asset nicht gefunden" }, { status: 404 });
    }
    await bucket.delete(key);
    return new Response(null, { status: 204 });
  } catch (e) {
    return jsonResponse(
      { error: `R2-Delete fehlgeschlagen: ${(e as Error).message}` },
      { status: 502 },
    );
  }
};
