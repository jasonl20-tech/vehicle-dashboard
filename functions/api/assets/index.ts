/**
 * Asset-Listen-Endpoint — direkt gegen R2.
 *
 *   GET /api/assets?folder=&q=&limit=&offset=&sort=
 *     → { rows, total, limit, offset, folder, public_base }
 *
 * Verhalten:
 *   - Ohne `q`: listet die DIREKTEN Kinder von `folder` (delimited list).
 *     Sub-Folders erscheinen als `kind:"folder"`-Einträge.
 *   - Mit `q`: rekursive Suche über alle Schlüssel mit Prefix `folder`,
 *     filtert nach Substring (case-insensitive) im Namen.
 *   - `sort`: "newest" (default, nach `uploaded`), "name", "size".
 *   - `limit`/`offset`: clientseitige Slicing-Parameter (R2 paginiert
 *     intern selbst über cursor).
 *
 * Hinweis: R2 liefert pro Aufruf max. 1000 Objekte. `_lib/assets.ts:
 * listAllUnderPrefix` paginiert bis 5000, was für Email-Asset-Mengen
 * mehr als ausreicht. Sollte das ausgereizt werden, gibt's eine `next`-
 * Marke im Response (TODO falls nötig).
 */
import { getCurrentUser, jsonResponse, type AuthEnv } from "../../_lib/auth";
import {
  ASSETS_DEFAULT_PUBLIC_BASE,
  HIDDEN_NAMES,
  isHidden,
  listAllUnderPrefix,
  normalizeFolder,
  publicBase,
  r2ObjectToAsset,
  requireAssetsBucket,
  splitKey,
  syntheticFolder,
  type AssetRow,
} from "../../_lib/assets";

const MAX_LIMIT = 500;
const DEFAULT_LIMIT = 200;

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

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim().toLowerCase();
  let folder = "";
  try {
    folder = normalizeFolder(url.searchParams.get("folder") || "");
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, { status: 400 });
  }
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(
      1,
      Number(url.searchParams.get("limit") || DEFAULT_LIMIT) || DEFAULT_LIMIT,
    ),
  );
  const offset = Math.max(
    0,
    Number(url.searchParams.get("offset") || 0) || 0,
  );
  const sortKey = url.searchParams.get("sort") || "newest";

  const prefix = folder ? `${folder}/` : "";

  try {
    const rows: AssetRow[] = [];

    if (q) {
      // Rekursiv durchsuchen
      const { objects } = await listAllUnderPrefix(bucket, prefix);
      for (const obj of objects) {
        const { name } = splitKey(obj.key);
        if (isHidden(name)) continue;
        if (!name.toLowerCase().includes(q)) continue;
        rows.push(r2ObjectToAsset(env, obj));
      }
    } else {
      // Nur direkte Kinder
      const { objects, delimitedPrefixes } = await listAllUnderPrefix(
        bucket,
        prefix,
        { delimiter: "/" },
      );

      // Files
      for (const obj of objects) {
        const { name } = splitKey(obj.key);
        if (isHidden(name)) continue;
        rows.push(r2ObjectToAsset(env, obj));
      }

      // Folders aus delimitedPrefixes
      for (const p of delimitedPrefixes) {
        const path = p.replace(/\/+$/, "");
        if (!path) continue;
        rows.push(syntheticFolder(env, path));
      }
    }

    // Sortierung
    rows.sort((a, b) => {
      // Folders immer oben
      if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
      if (sortKey === "name") {
        return a.name.localeCompare(b.name, "de", { sensitivity: "base" });
      }
      if (sortKey === "size") {
        return b.size - a.size;
      }
      // newest
      return b.uploaded_at.localeCompare(a.uploaded_at);
    });

    const total = rows.length;
    const sliced = rows.slice(offset, offset + limit);

    return jsonResponse({
      rows: sliced,
      total,
      limit,
      offset,
      folder,
      public_base: publicBase(env) || ASSETS_DEFAULT_PUBLIC_BASE,
      hidden: Array.from(HIDDEN_NAMES),
    });
  } catch (e) {
    return jsonResponse(
      { error: (e as Error).message || String(e) },
      { status: 500 },
    );
  }
};
