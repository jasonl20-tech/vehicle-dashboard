/**
 * CMS-Medien: redaktionelle Metadaten in D1 (`cms_assets`), Binärdaten in R2.
 */
import { normalizeCmsAssetStatus, type AssetRow } from "./assets";

export type CmsAssetDbRow = {
  id: string;
  r2_key: string;
  title: string | null;
  description: string | null;
  alt_text: string | null;
  original_filename: string | null;
  content_type: string | null;
  size_bytes: number | null;
  width: number | null;
  height: number | null;
  status: string;
  locale: string;
  created_at: string;
  updated_at: string;
  last_updated_by: string | null;
};

/** Redaktionelle Felder aus D1 in die API-Zeile legen (D1 gewinnt, wenn eine Zeile existiert). */
export function mergeAssetRowWithCmsDb(
  base: AssetRow,
  row: CmsAssetDbRow | null,
): AssetRow {
  if (!row) return base;
  const st = normalizeCmsAssetStatus(row.status);
  return {
    ...base,
    title: row.title,
    description: row.description,
    alt_text: row.alt_text,
    cms_status: st,
    width: row.width != null && row.width > 0 ? row.width : base.width,
    height: row.height != null && row.height > 0 ? row.height : base.height,
    updated_at: row.updated_at || base.updated_at,
    content_type:
      row.content_type && row.content_type.trim()
        ? row.content_type
        : base.content_type,
  };
}

export async function fetchCmsAssetsByR2Keys(
  db: D1Database,
  keys: string[],
): Promise<Map<string, CmsAssetDbRow>> {
  const out = new Map<string, CmsAssetDbRow>();
  const uniq = [...new Set(keys.filter(Boolean))];
  const chunkSize = 80;
  for (let i = 0; i < uniq.length; i += chunkSize) {
    const chunk = uniq.slice(i, i + chunkSize);
    if (!chunk.length) continue;
    const ph = chunk.map(() => "?").join(",");
    const res = await db
      .prepare(`SELECT * FROM cms_assets WHERE r2_key IN (${ph})`)
      .bind(...chunk)
      .all<CmsAssetDbRow>();
    for (const r of res.results ?? []) {
      out.set(r.r2_key, r);
    }
  }
  return out;
}

/**
 * Nach R2-Upload: CMS-Zeile anlegen oder bei overwrite derselbe `r2_key` aktualisieren.
 */
export async function upsertCmsAssetAfterUpload(
  db: D1Database,
  input: {
    r2_key: string;
    title: string | null;
    description: string | null;
    alt_text: string | null;
    original_filename: string | null;
    content_type: string | null;
    size_bytes: number;
    width: number | null;
    height: number | null;
    status: "draft" | "published";
    locale?: string;
    last_updated_by: string | null;
  },
): Promise<void> {
  const id = crypto.randomUUID();
  const locale = input.locale ?? "de-DE";
  await db
    .prepare(
      `INSERT INTO cms_assets (
        id, r2_key, title, description, alt_text, original_filename,
        content_type, size_bytes, width, height, status, locale, last_updated_by,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(r2_key) DO UPDATE SET
        title = excluded.title,
        description = excluded.description,
        alt_text = excluded.alt_text,
        original_filename = excluded.original_filename,
        content_type = excluded.content_type,
        size_bytes = excluded.size_bytes,
        width = excluded.width,
        height = excluded.height,
        status = excluded.status,
        locale = excluded.locale,
        last_updated_by = excluded.last_updated_by,
        updated_at = datetime('now')`,
    )
    .bind(
      id,
      input.r2_key,
      input.title,
      input.description,
      input.alt_text,
      input.original_filename,
      input.content_type,
      input.size_bytes,
      input.width,
      input.height,
      input.status,
      locale,
      input.last_updated_by,
    )
    .run();
}

export async function deleteCmsAssetsByR2Keys(
  db: D1Database,
  keys: string[],
): Promise<void> {
  const uniq = [...new Set(keys.filter(Boolean))];
  const chunkSize = 80;
  for (let i = 0; i < uniq.length; i += chunkSize) {
    const chunk = uniq.slice(i, i + chunkSize);
    const ph = chunk.map(() => "?").join(",");
    await db
      .prepare(`DELETE FROM cms_assets WHERE r2_key IN (${ph})`)
      .bind(...chunk)
      .run();
  }
}

export async function deleteCmsAssetByR2Key(
  db: D1Database,
  r2_key: string,
): Promise<void> {
  await deleteCmsAssetsByR2Keys(db, [r2_key]);
}

/** Nach PATCH / Rename: CMS-Zeile aktualisieren oder aus R2-Zeile anlegen. */
export async function upsertCmsAssetAfterPatch(
  db: D1Database,
  opts: {
    old_r2_key: string;
    new_r2_key: string;
    asset: AssetRow;
    /** Nur gesetzte Keys überschreiben (PATCH-Semantik). */
    patch: {
      title?: string | null;
      alt_text?: string | null;
      description?: string | null;
      cms_status?: "draft" | "published";
      width?: number | null;
      height?: number | null;
    };
    last_updated_by: string | null;
  },
): Promise<void> {
  const cur = await db
    .prepare(`SELECT * FROM cms_assets WHERE r2_key = ?`)
    .bind(opts.old_r2_key)
    .first<CmsAssetDbRow>();

  const nextTitle =
    opts.patch.title !== undefined
      ? opts.patch.title
      : cur
        ? cur.title
        : opts.asset.title;
  const nextAlt =
    opts.patch.alt_text !== undefined
      ? opts.patch.alt_text
      : cur
        ? cur.alt_text
        : opts.asset.alt_text;
  const nextDesc =
    opts.patch.description !== undefined
      ? opts.patch.description
      : cur
        ? cur.description
        : opts.asset.description;
  const nextStatus =
    opts.patch.cms_status !== undefined
      ? opts.patch.cms_status
      : cur
        ? normalizeCmsAssetStatus(cur.status)
        : opts.asset.cms_status;
  const nextW =
    opts.patch.width !== undefined
      ? opts.patch.width
      : cur
        ? cur.width
        : opts.asset.width;
  const nextH =
    opts.patch.height !== undefined
      ? opts.patch.height
      : cur
        ? cur.height
        : opts.asset.height;

  const w =
    nextW != null && Number(nextW) > 0 ? Math.round(Number(nextW)) : null;
  const h =
    nextH != null && Number(nextH) > 0 ? Math.round(Number(nextH)) : null;

  if (cur) {
    await db
      .prepare(
        `UPDATE cms_assets SET
          r2_key = ?,
          title = ?,
          description = ?,
          alt_text = ?,
          status = ?,
          width = ?,
          height = ?,
          content_type = ?,
          size_bytes = ?,
          original_filename = COALESCE(original_filename, ?),
          last_updated_by = ?,
          updated_at = datetime('now')
        WHERE r2_key = ?`,
      )
      .bind(
        opts.new_r2_key,
        nextTitle,
        nextDesc,
        nextAlt,
        nextStatus,
        w,
        h,
        opts.asset.content_type,
        opts.asset.size,
        splitName(opts.asset.name),
        opts.last_updated_by,
        opts.old_r2_key,
      )
      .run();
    return;
  }

  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO cms_assets (
        id, r2_key, title, description, alt_text, original_filename,
        content_type, size_bytes, width, height, status, locale, last_updated_by,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'de-DE', ?, datetime('now'))`,
    )
    .bind(
      id,
      opts.new_r2_key,
      nextTitle,
      nextDesc,
      nextAlt,
      splitName(opts.asset.name),
      opts.asset.content_type,
      opts.asset.size,
      w,
      h,
      nextStatus,
      opts.last_updated_by,
    )
    .run();
}

function splitName(name: string): string | null {
  return name || null;
}
