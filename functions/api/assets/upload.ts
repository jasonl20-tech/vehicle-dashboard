/**
 * Asset-Upload — schreibt direkt in den R2-Bucket `env.assets`.
 *
 *   POST /api/assets/upload  (multipart/form-data)
 *     Felder:
 *       - file        (Pflicht)
 *       - folder      (optional, default "")
 *       - name        (optional, sonst aus file.name abgeleitet)
 *       - alt_text    (optional → customMetadata)
 *       - description (optional → customMetadata)
 *       - overwrite   (optional, "1" überschreibt einen existierenden Key)
 *     → 201 mit der vollständigen Asset-Zeile
 */
import { getCurrentUser, jsonResponse, type AuthEnv } from "../../_lib/auth";
import {
  MAX_FILE_BYTES,
  buildCustomMetadata,
  joinKey,
  normalizeFolder,
  normalizeName,
  r2ObjectToAsset,
  requireAssetsBucket,
} from "../../_lib/assets";

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
      {
        error: `FormData konnte nicht gelesen werden: ${(e as Error).message}`,
      },
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
      { error: `Datei zu groß: ${file.size} B (Limit ${MAX_FILE_BYTES})` },
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
    if (!overwrite) {
      const existing = await bucket.head(key);
      if (existing) {
        return jsonResponse(
          {
            error: `Datei \`${key}\` existiert bereits`,
            hint: "Setze overwrite=1, um zu überschreiben — oder benenne die Datei um.",
            key,
          },
          { status: 409 },
        );
      }
    }

    const customMetadata = buildCustomMetadata({
      altText: altText || undefined,
      description: description || undefined,
      uploadedBy: user.id,
      originalName: file.name,
    });

    const written = await bucket.put(key, file.stream(), {
      httpMetadata: {
        contentType,
        // Lange Cache-Zeit, da die Custom-Domain keine Versionierung hat —
        // bei Updates auf dieselbe Datei muss ggf. der CDN-Cache gepurged
        // werden. Für Email-Bilder im Normalfall OK.
        cacheControl: "public, max-age=31536000, immutable",
      },
      customMetadata,
    });

    if (!written) {
      return jsonResponse(
        { error: "R2-Upload schlug fehl (kein Object zurückgegeben)" },
        { status: 502 },
      );
    }

    return jsonResponse(r2ObjectToAsset(env, written), { status: 201 });
  } catch (e) {
    return jsonResponse(
      { error: (e as Error).message || String(e) },
      { status: 500 },
    );
  }
};
