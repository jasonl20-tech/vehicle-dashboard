/**
 * Folder-Operationen — abgeleitet aus den R2-Object-Keys.
 *
 *   GET    /api/assets/folders
 *     → { folders: { path, name, parent, count }[] }
 *     Listet alle bekannten Ordnerpfade. Ein Ordner existiert, sobald
 *     mindestens ein Objekt mit dem entsprechenden Prefix vorliegt
 *     (inkl. der `<folder>/.keep`-Marker für leere Ordner).
 *
 *   POST   /api/assets/folders   { path: "email/team" }
 *     → 201 mit dem Marker-Asset (`<folder>/.keep`)
 *     Legt einen leeren Ordner an, indem ein 0-Byte-Marker
 *     `<path>/.keep` mit `customMetadata.foldermarker=1` hochgeladen
 *     wird. Idempotent — falls der Marker schon existiert.
 *
 *   DELETE /api/assets/folders?path=email/team&recursive=1
 *     → 204
 *     Ohne `recursive=1`: nur möglich, wenn der Ordner leer ist
 *     (max. der `.keep`-Marker drin). Mit `recursive=1`: löscht ALLE
 *     Objekte unter dem Prefix.
 */
import { getCurrentUser, jsonResponse, type AuthEnv } from "../../_lib/auth";
import {
  FOLDER_MARKER,
  buildCustomMetadata,
  isHidden,
  joinKey,
  listAllUnderPrefix,
  normalizeFolder,
  r2ObjectToAsset,
  requireAssetsBucket,
  splitKey,
} from "../../_lib/assets";

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
  const bucketOrErr = requireAssetsBucket(env);
  if (bucketOrErr instanceof Response) return bucketOrErr;
  const bucket = bucketOrErr;

  try {
    // Wir listen ALLE Objekte (paginiert intern bis 5000) und leiten die
    // Folder-Struktur aus den Keys ab. Für Email-Asset-Mengen ausreichend.
    const { objects } = await listAllUnderPrefix(bucket, "");

    const pathSet = new Set<string>();
    const directCounts = new Map<string, number>();

    for (const obj of objects) {
      const { folder, name } = splitKey(obj.key);
      if (folder) {
        for (const p of expandPaths(folder)) pathSet.add(p);
      }
      // Direkt-Kinder zählen (Marker ausnehmen)
      if (folder && !isHidden(name)) {
        directCounts.set(folder, (directCounts.get(folder) ?? 0) + 1);
      }
    }

    const paths = Array.from(pathSet).sort();
    const folders = paths.map((path) => {
      const { folder: parent, name } = splitKey(path);
      return {
        path,
        name,
        parent: parent || null,
        count: directCounts.get(path) ?? 0,
      };
    });

    return jsonResponse({ folders });
  } catch (e) {
    return jsonResponse(
      { error: (e as Error).message || String(e) },
      { status: 500 },
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
  const bucketOrErr = requireAssetsBucket(env);
  if (bucketOrErr instanceof Response) return bucketOrErr;
  const bucket = bucketOrErr;

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
    const markerKey = joinKey(path, FOLDER_MARKER);
    const existing = await bucket.head(markerKey);
    if (existing) {
      return jsonResponse(r2ObjectToAsset(env, existing));
    }
    const written = await bucket.put(markerKey, new Uint8Array(0), {
      httpMetadata: {
        contentType: "text/plain",
        cacheControl: "no-store",
      },
      customMetadata: buildCustomMetadata({
        folderMarker: true,
        uploadedBy: user.id,
      }),
    });
    if (!written) {
      return jsonResponse(
        { error: "Folder-Marker konnte nicht angelegt werden" },
        { status: 502 },
      );
    }
    return jsonResponse(r2ObjectToAsset(env, written), { status: 201 });
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

  const url = new URL(request.url);
  let path: string;
  try {
    path = normalizeFolder(url.searchParams.get("path") || "");
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, { status: 400 });
  }
  if (!path) {
    return jsonResponse({ error: "path fehlt" }, { status: 400 });
  }
  const recursive = url.searchParams.get("recursive") === "1";

  try {
    // Alle Keys unter dem Prefix sammeln
    const prefix = `${path}/`;
    const { objects } = await listAllUnderPrefix(bucket, prefix);
    const realChildren = objects.filter((o) => {
      const { name } = splitKey(o.key);
      return !isHidden(name);
    });

    if (realChildren.length > 0 && !recursive) {
      return jsonResponse(
        {
          error: `Ordner \`${path}\` ist nicht leer (${realChildren.length} Datei${realChildren.length === 1 ? "" : "en"})`,
          hint: "Setze recursive=1, um den Ordner mit allen Inhalten zu löschen.",
        },
        { status: 409 },
      );
    }

    // Alle Objekte (auch Marker) unter dem Prefix löschen
    const keys = objects.map((o) => o.key);
    if (keys.length > 0) {
      // R2 hat einen Bulk-Delete: `bucket.delete(keys: string[])`.
      await bucket.delete(keys);
    }
    return new Response(null, { status: 204 });
  } catch (e) {
    return jsonResponse(
      { error: `Folder-Delete fehlgeschlagen: ${(e as Error).message}` },
      { status: 502 },
    );
  }
};
