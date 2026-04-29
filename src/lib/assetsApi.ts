/**
 * Frontend-Client für die Asset-Manager-API
 * (`functions/api/assets/*`).
 *
 * Public-URLs werden vom Server bereits in jeder Asset-Zeile (`url`)
 * mitgeliefert, basierend auf `assets.vehicleimagery.com`.
 */

export const ASSETS_API = "/api/assets" as const;

export type Asset = {
  id: number;
  key: string;
  folder: string;
  name: string;
  size: number;
  content_type: string;
  kind: "file" | "folder";
  alt_text: string | null;
  description: string | null;
  uploaded_by: number | null;
  uploaded_at: string;
  updated_at: string;
  /** Öffentliche URL (Custom-Domain auf den R2-Bucket). */
  url: string;
};

export type AssetListResponse = {
  rows: Asset[];
  total: number;
  limit: number;
  offset: number;
  folder: string;
  public_base: string;
};

export type AssetFolder = {
  path: string;
  name: string;
  parent: string | null;
  count: number;
  /** Wenn der Ordner explizit als Marker existiert (für Delete) */
  id: number | null;
};

export type AssetFoldersResponse = {
  folders: AssetFolder[];
};

async function asJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // ignore
  }
  if (!res.ok) {
    const j = (json ?? {}) as { error?: string; hint?: string };
    const parts: string[] = [j.error || `HTTP ${res.status}`];
    if (j.hint) parts.push(`Hinweis: ${j.hint}`);
    throw new Error(parts.join(" • "));
  }
  return (json ?? null) as T;
}

export function listAssetsUrl(opts: {
  folder?: string;
  q?: string;
  limit?: number;
  offset?: number;
  sort?: "newest" | "name" | "size";
}): string {
  const p = new URLSearchParams();
  if (opts.folder !== undefined) p.set("folder", opts.folder);
  if (opts.q) p.set("q", opts.q);
  if (opts.limit != null) p.set("limit", String(opts.limit));
  if (opts.offset != null) p.set("offset", String(opts.offset));
  if (opts.sort) p.set("sort", opts.sort);
  const qs = p.toString();
  return `${ASSETS_API}${qs ? `?${qs}` : ""}`;
}

export async function listAssets(opts: {
  folder?: string;
  q?: string;
  limit?: number;
  offset?: number;
  sort?: "newest" | "name" | "size";
}): Promise<AssetListResponse> {
  const res = await fetch(listAssetsUrl(opts), {
    credentials: "include",
  });
  return asJson<AssetListResponse>(res);
}

export async function listFolders(): Promise<AssetFoldersResponse> {
  const res = await fetch(`${ASSETS_API}/folders`, {
    credentials: "include",
  });
  return asJson<AssetFoldersResponse>(res);
}

export async function createFolder(path: string): Promise<Asset> {
  const res = await fetch(`${ASSETS_API}/folders`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });
  return asJson<Asset>(res);
}

export async function uploadAsset(input: {
  file: File;
  folder?: string;
  name?: string;
  alt_text?: string;
  description?: string;
  overwrite?: boolean;
  /** Optional: Progress-Callback (XHR fallback). */
  onProgress?: (loaded: number, total: number) => void;
  signal?: AbortSignal;
}): Promise<Asset> {
  const fd = new FormData();
  fd.append("file", input.file);
  if (input.folder !== undefined) fd.append("folder", input.folder);
  if (input.name) fd.append("name", input.name);
  if (input.alt_text) fd.append("alt_text", input.alt_text);
  if (input.description) fd.append("description", input.description);
  if (input.overwrite) fd.append("overwrite", "1");

  if (input.onProgress) {
    return await uploadWithProgress(fd, input.onProgress, input.signal);
  }
  const res = await fetch(`${ASSETS_API}/upload`, {
    method: "POST",
    credentials: "include",
    body: fd,
    signal: input.signal,
  });
  return asJson<Asset>(res);
}

function uploadWithProgress(
  fd: FormData,
  onProgress: (loaded: number, total: number) => void,
  signal?: AbortSignal,
): Promise<Asset> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${ASSETS_API}/upload`);
    xhr.withCredentials = true;
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) onProgress(ev.loaded, ev.total);
    };
    xhr.onerror = () => reject(new Error("Netzwerkfehler beim Upload"));
    xhr.onabort = () => reject(new Error("Upload abgebrochen"));
    xhr.onload = () => {
      const text = xhr.responseText;
      let json: unknown = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        // ignore
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(json as Asset);
      } else {
        const j = (json ?? {}) as { error?: string; hint?: string };
        const parts: string[] = [j.error || `HTTP ${xhr.status}`];
        if (j.hint) parts.push(`Hinweis: ${j.hint}`);
        reject(new Error(parts.join(" • ")));
      }
    };
    if (signal) {
      if (signal.aborted) {
        xhr.abort();
        return;
      }
      signal.addEventListener("abort", () => xhr.abort(), { once: true });
    }
    xhr.send(fd);
  });
}

export async function updateAsset(
  id: number,
  patch: {
    name?: string;
    folder?: string;
    alt_text?: string | null;
    description?: string | null;
  },
): Promise<Asset> {
  const res = await fetch(`${ASSETS_API}/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return asJson<Asset>(res);
}

export async function deleteAsset(id: number): Promise<void> {
  const res = await fetch(`${ASSETS_API}/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as {
      error?: string;
      hint?: string;
    };
    const parts: string[] = [j.error || `HTTP ${res.status}`];
    if (j.hint) parts.push(`Hinweis: ${j.hint}`);
    throw new Error(parts.join(" • "));
  }
}

/** Liefert true, wenn der Content-Type ein Bild ist. */
export function isImage(asset: { content_type: string }): boolean {
  return asset.content_type.startsWith("image/");
}

/** Liefert true, wenn der Content-Type Video ist. */
export function isVideo(asset: { content_type: string }): boolean {
  return asset.content_type.startsWith("video/");
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
