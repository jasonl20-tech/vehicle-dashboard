import {
  Bookmark,
  ChevronDown,
  ExternalLink,
  FileText,
  Loader2,
  Plus,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  formatAssetTypeLabel,
  isImage as isImageAsset,
  listAssets,
  uploadAsset,
  updateAsset,
  type Asset,
} from "../../lib/assetsApi";
import { CMS_ASSETS_FOLDER, CMS_ROOT } from "../../lib/cmsAccess";

/** ISO- oder AE-Timestamp → „vor X Tagen“ ( Asset-API liefert ISO). */
function safeFmtRelative(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const diff = Date.now() - d.getTime();
  const sec = Math.round(diff / 1000);
  if (sec < 60) return `vor ${sec} s`;
  const min = Math.round(sec / 60);
  if (min < 60) return `vor ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `vor ${h} h`;
  const days = Math.round(h / 24);
  if (days < 45) return `vor ${days} T`;
  const months = Math.round(days / 30);
  return `vor ${months} Mon`;
}

const PAGE_SIZE = 20;

function readImageDimensions(file: File): Promise<{ w?: number; h?: number }> {
  if (!file.type.startsWith("image/")) return Promise.resolve({});
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({});
    };
    img.src = url;
  });
}

function displayName(a: Asset): string {
  const t = a.title?.trim();
  if (t) return t;
  const n = a.name?.trim();
  if (n && n !== ".keep") return n;
  return "Ohne Titel";
}

function userInitials(name: string | null | undefined): string {
  if (!name?.trim()) return "?";
  const p = name.trim().split(/\s+/);
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

/**
 * CMS-Medienliste — Contentful-inspirierte Tabelle unter {@link CMS_ASSETS_FOLDER}/.
 */
export default function CmsMediaPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [qInput, setQInput] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [sort, setSort] = useState<"newest" | "name" | "size">("newest");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Asset[]>([]);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(qInput.trim()), 280);
    return () => window.clearTimeout(t);
  }, [qInput]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await listAssets({
        folder: debouncedQ ? undefined : CMS_ASSETS_FOLDER,
        q: debouncedQ || undefined,
        sort,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      setRows(r.rows);
      setTotal(r.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [debouncedQ, sort, page]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(0);
  }, [debouncedQ, sort]);

  const filesOnly = useMemo(
    () =>
      rows.filter(
        (a) =>
          a.kind === "file" && a.name !== ".keep" && !a.key.endsWith("/.keep"),
      ),
    [rows],
  );

  const onPickFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        const dims = await readImageDimensions(file);
        await uploadAsset({
          file,
          folder: CMS_ASSETS_FOLDER,
          status: "draft",
          img_w: dims.w,
          img_h: dims.h,
        });
      }
      await load();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const setStatus = async (asset: Asset, cms_status: "draft" | "published") => {
    try {
      const updated = await updateAsset(asset.id, { cms_status });
      setRows((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    } catch (e) {
      window.alert(e instanceof Error ? e.message : String(e));
    }
  };

  const maxPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllPage = () => {
    const ids = filesOnly.map((a) => a.id);
    const allOn = ids.length > 0 && ids.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOn) for (const id of ids) next.delete(id);
      else for (const id of ids) next.add(id);
      return next;
    });
  };

  return (
    <div className="flex min-h-[calc(100vh-6rem)] flex-col bg-[#f4f5f7] pb-10">
      <div className="border-b border-[#e8eaed] bg-white px-4 py-4 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="font-display text-[26px] font-semibold tracking-tighter2 text-[#1a1a1a]">
            Alle
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#dadce0] bg-white px-3 text-[13px] font-medium text-[#5f6368] opacity-80"
              disabled
              title="Demnächst"
            >
              <Bookmark className="h-4 w-4" />
              Ansicht
              <ChevronDown className="h-4 w-4 opacity-60" />
            </button>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              multiple
              accept="image/*,video/*,.pdf,.svg"
              onChange={(e) => void onPickFiles(e.target.files)}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
              className="inline-flex h-9 items-center gap-1 rounded-lg bg-[#0366d6] px-3 text-[13px] font-semibold text-white shadow-sm hover:bg-[#0256b9] disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Asset hinzufügen
              <ChevronDown className="h-4 w-4 opacity-80" />
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-stretch gap-2">
          <div className="relative min-w-[16rem] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#80868b]" />
            <input
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              placeholder="Assets durchsuchen…"
              className="h-10 w-full rounded-lg border border-[#dadce0] bg-[#f8f9fa] pl-10 pr-3 text-[14px] text-[#1a1a1a] outline-none focus:border-[#0366d6]"
            />
          </div>
          <button
            type="button"
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border border-[#dadce0] bg-white px-3 text-[13px] font-medium text-[#5f6368] opacity-70"
            disabled
            title="Demnächst"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filter
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {[
            "Erstellt von mir",
            "Tags",
            "Taxonomie",
            "Status",
            "Locale",
          ].map((label) => (
            <button
              key={label}
              type="button"
              disabled
              className="rounded-full border border-dashed border-[#dadce0] bg-white px-3 py-1 text-[12px] text-[#80868b]"
            >
              + {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-4 mt-4 flex flex-wrap items-center justify-between gap-3 lg:mx-8">
        <label className="inline-flex items-center gap-2 text-[13px] text-[#5f6368]">
          <span className="whitespace-nowrap">Sortieren</span>
          <select
            value={sort}
            onChange={(e) =>
              setSort(e.target.value as "newest" | "name" | "size")
            }
            className="rounded-lg border border-[#dadce0] bg-white px-2 py-1.5 text-[13px]"
          >
            <option value="newest">Neueste zuerst</option>
            <option value="name">Name (A–Z)</option>
            <option value="size">Größe</option>
          </select>
        </label>
        <p className="text-[13px] text-[#5f6368]">
          {total} {total === 1 ? "Asset" : "Assets"}
        </p>
      </div>

      <div className="mx-4 mt-2 overflow-hidden rounded-xl border border-[#e8eaed] bg-white shadow-sm lg:mx-8">
        {error ? (
          <p className="p-6 text-[14px] text-rose-700">{error}</p>
        ) : loading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-[#5f6368]">
            <Loader2 className="h-5 w-5 animate-spin" />
            Laden …
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-[13px]">
              <thead>
                <tr className="border-b border-[#e8eaed] bg-[#fafbfc] text-[11px] font-semibold uppercase tracking-wide text-[#80868b]">
                  <th className="w-10 px-3 py-3">
                    <input
                      type="checkbox"
                      className="rounded border-hair"
                      checked={
                        filesOnly.length > 0 &&
                        filesOnly.every((a) => selected.has(a.id))
                      }
                      onChange={toggleSelectAllPage}
                      aria-label="Alle auf dieser Seite"
                    />
                  </th>
                  <th className="px-3 py-3">Name</th>
                  <th className="px-3 py-3">Abmessungen</th>
                  <th className="px-3 py-3">Typ</th>
                  <th className="px-3 py-3">Aktualisiert</th>
                  <th className="px-3 py-3">Von</th>
                  <th className="px-3 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {filesOnly.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-12 text-center text-[#5f6368]"
                    >
                      Keine Assets unter{" "}
                      <code className="rounded bg-[#f1f3f4] px-1">
                        {CMS_ASSETS_FOLDER}/
                      </code>
                      . Über „Asset hinzufügen“ hochladen.
                    </td>
                  </tr>
                ) : (
                  filesOnly.map((a) => (
                    <tr
                      key={a.id}
                      className="border-b border-[#f1f3f4] hover:bg-[#f8f9fa]/80"
                    >
                      <td className="px-3 py-2.5 align-middle">
                        <input
                          type="checkbox"
                          className="rounded border-hair"
                          checked={selected.has(a.id)}
                          onChange={() => toggleSelect(a.id)}
                          aria-label={displayName(a)}
                        />
                      </td>
                      <td className="max-w-[min(28rem,40vw)] px-3 py-2.5 align-middle">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md border border-[#e8eaed] bg-[#f4f5f7]">
                            {isImageAsset(a) ? (
                              <img
                                src={a.url}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-[#80868b]">
                                <FileText className="h-5 w-5" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex min-w-0 items-center gap-1.5">
                              <Link
                                to={`${CMS_ROOT}/media/${a.id}`}
                                className="truncate font-medium text-[#0366d6] hover:underline"
                              >
                                {displayName(a)}
                              </Link>
                              <a
                                href={a.url}
                                target="_blank"
                                rel="noreferrer"
                                className="shrink-0 rounded p-0.5 text-[#80868b] hover:bg-[#f1f3f4] hover:text-[#0366d6]"
                                title="Öffentliche URL"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            </div>
                            <p className="truncate font-mono text-[11px] text-[#80868b]">
                              {a.key}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 align-middle text-[#3c4043]">
                        {a.width != null && a.height != null
                          ? `${a.width}px × ${a.height}px`
                          : "—"}
                      </td>
                      <td className="px-3 py-2.5 align-middle text-[#3c4043]">
                        {formatAssetTypeLabel(a)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 align-middle text-[#5f6368]">
                        {safeFmtRelative(a.updated_at ?? a.uploaded_at)}
                      </td>
                      <td className="px-3 py-2.5 align-middle">
                        <div className="flex items-center gap-2">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#e8f0fe] text-[10px] font-bold text-[#1967d2]">
                            {userInitials(a.uploaded_by_name)}
                          </span>
                          <span className="max-w-[140px] truncate text-[#3c4043]">
                            {a.uploaded_by_name ?? "—"}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 align-middle">
                        <select
                          value={a.cms_status}
                          onChange={(e) =>
                            void setStatus(
                              a,
                              e.target.value as "draft" | "published",
                            )
                          }
                          className={`max-w-[11rem] rounded-md border px-2 py-1 text-[12px] font-semibold ${
                            a.cms_status === "published"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                              : "border-amber-200 bg-amber-50 text-amber-950"
                          }`}
                        >
                          <option value="draft">Entwurf</option>
                          <option value="published">Veröffentlicht</option>
                        </select>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && total > PAGE_SIZE ? (
          <div className="flex items-center justify-end gap-2 border-t border-[#e8eaed] px-4 py-3">
            <button
              type="button"
              disabled={page <= 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="rounded-lg border border-[#dadce0] bg-white px-3 py-1.5 text-[12px] font-medium hover:bg-[#f8f9fa] disabled:opacity-40"
            >
              Zurück
            </button>
            <button
              type="button"
              disabled={page >= maxPage}
              onClick={() => setPage((p) => Math.min(maxPage, p + 1))}
              className="rounded-lg border border-[#dadce0] bg-white px-3 py-1.5 text-[12px] font-medium hover:bg-[#f8f9fa] disabled:opacity-40"
            >
              Weiter
            </button>
          </div>
        ) : null}
      </div>

      <p className="mx-4 mt-6 text-center text-[12px] text-[#80868b] lg:mx-8">
        Vollständiger Ordner-Browser:{" "}
        <Link
          to="/dashboard/databases/assets"
          className="font-medium text-[#0366d6] hover:underline"
        >
          Asset-Manager
        </Link>
        · Dateien liegen in R2 unter{" "}
        <code className="rounded bg-ink-100 px-1">{CMS_ASSETS_FOLDER}/</code>
      </p>
    </div>
  );
}
