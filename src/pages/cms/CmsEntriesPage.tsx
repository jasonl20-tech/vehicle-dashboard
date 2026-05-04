import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  Filter,
  Pencil,
  Plus,
  Search,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CMS_ROOT } from "../../lib/cmsAccess";
import {
  CMS_CONTENT_MODELS_API,
  CMS_CONTENTS_API,
  contentEntryListLabel,
  extractContentTitle,
  type CmsContentsListResponse,
  type CmsContentModelsListResponse,
  statusLabelDe,
} from "../../lib/cmsApi";
import { useApi } from "../../lib/customerApi";

function fmtEntryDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("de-DE", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function fmtScheduleSubline(
  iso: string | null | undefined,
  statusRaw: string,
): string | null {
  if (!iso?.trim()) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const fmt = fmtEntryDate(iso);
  if (t > Date.now()) {
    if (statusRaw === "published") return `Veröffentlichung geplant: ${fmt}`;
    return `Öffentlich ab: ${fmt}`;
  }
  return `Termin: ${fmt}`;
}

type SortKey = "name" | "type" | "updated" | "lastBy" | "status";

function SortColHead({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
  className = "",
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  dir: "asc" | "desc";
  onSort: (k: SortKey) => void;
  className?: string;
}) {
  const active = activeKey === sortKey;
  return (
    <th
      scope="col"
      className={className}
      aria-sort={
        active ? (dir === "asc" ? "ascending" : "descending") : "none"
      }
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex min-h-9 w-full min-w-0 items-center gap-1 rounded-md px-1 py-1 text-left font-semibold text-inherit transition hover:bg-black/[0.04] hover:text-ink-800"
      >
        <span>{label}</span>
        {active ? (
          dir === "asc" ? (
            <ArrowUp className="h-3.5 w-3.5 shrink-0 text-[#1a73e8]" aria-hidden />
          ) : (
            <ArrowDown className="h-3.5 w-3.5 shrink-0 text-[#1a73e8]" aria-hidden />
          )
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 shrink-0 text-ink-300" aria-hidden />
        )}
      </button>
    </th>
  );
}

export default function CmsEntriesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const modelFromUrl = (searchParams.get("content_model_id") || "").trim();
  const qFromUrl = (searchParams.get("q") || "").trim();
  const isZuletztView = searchParams.get("view") === "zuletzt";

  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "updated",
    dir: "desc",
  });
  const [qInput, setQInput] = useState(() => searchParams.get("q") || "");
  const [viewOpen, setViewOpen] = useState(false);
  const viewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQInput(searchParams.get("q") || "");
  }, [searchParams]);

  useEffect(() => {
    const h = setTimeout(() => {
      setSearchParams(
        (prev) => {
          const cur = (prev.get("q") || "").trim();
          const next = qInput.trim();
          if (next === cur) return prev;
          const p = new URLSearchParams(prev);
          if (next) p.set("q", next);
          else p.delete("q");
          return p;
        },
        { replace: true },
      );
    }, 350);
    return () => clearTimeout(h);
  }, [qInput, setSearchParams]);

  const onSortColumn = useCallback((key: SortKey) => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "updated" ? "desc" : "asc" },
    );
  }, []);

  useEffect(() => {
    function close(e: MouseEvent) {
      if (!viewRef.current?.contains(e.target as Node)) setViewOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const applyModelFilter = useCallback(
    (modelId: string) => {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          if (modelId) p.set("content_model_id", modelId);
          else p.delete("content_model_id");
          return p;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const applySearch = useCallback(() => {
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        const t = qInput.trim();
        if (t) p.set("q", t);
        else p.delete("q");
        return p;
      },
      { replace: true },
    );
  }, [qInput, setSearchParams]);

  const modelsUrl = `${CMS_CONTENT_MODELS_API}?limit=500`;
  const models = useApi<CmsContentModelsListResponse>(modelsUrl);

  const sortedModels = useMemo(() => {
    const rows = models.data?.rows ?? [];
    return [...rows].sort((a, b) =>
      a.key.localeCompare(b.key, "de", { sensitivity: "base" }),
    );
  }, [models.data?.rows]);

  const contentsUrl = useMemo(() => {
    const p = new URLSearchParams({ limit: "200" });
    if (qFromUrl) p.set("q", qFromUrl);
    if (modelFromUrl) p.set("content_model_id", modelFromUrl);
    if (isZuletztView) p.set("updated_by_me", "1");
    return `${CMS_CONTENTS_API}?${p}`;
  }, [qFromUrl, modelFromUrl, isZuletztView]);

  const contents = useApi<CmsContentsListResponse>(contentsUrl);

  const modelKeyById = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of models.data?.rows ?? []) {
      m.set(r.id, r.key);
    }
    return m;
  }, [models.data?.rows]);

  const rows = useMemo(() => {
    const list = contents.data?.rows ?? [];
    return list.map((r) => {
      let payload: unknown = null;
      try {
        payload = JSON.parse(r.payload_json) as unknown;
      } catch {
        payload = null;
      }
      const title = extractContentTitle(payload);
      const statusRaw = r.status.trim().toLowerCase();
      return {
        id: r.id,
        title,
        listLabel: contentEntryListLabel(title, r.id),
        type:
          modelKeyById.get(r.content_model_id) ??
          r.content_model_id.slice(0, 8),
        locale: r.locale,
        updatedAt: r.updated_at,
        updatedLabel: fmtEntryDate(r.updated_at),
        lastBy: r.last_updated_by?.trim() || "—",
        lastUpdaterProfilbild: r.last_updater_profilbild ?? null,
        scheduledPublishAt: r.scheduled_publish_at,
        scheduleSubline: fmtScheduleSubline(r.scheduled_publish_at, statusRaw),
        state: statusLabelDe(r.status),
        statusRaw,
      };
    });
  }, [contents.data?.rows, modelKeyById]);

  const sortedRows = useMemo(() => {
    const { key, dir } = sort;
    const mult = dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      let v = 0;
      switch (key) {
        case "name":
          v = a.listLabel.localeCompare(b.listLabel, "de", {
            sensitivity: "base",
          });
          break;
        case "type":
          v = a.type.localeCompare(b.type, "de", { sensitivity: "base" });
          break;
        case "updated":
          v = a.updatedAt.localeCompare(b.updatedAt);
          break;
        case "lastBy":
          v = a.lastBy.localeCompare(b.lastBy, "de", { sensitivity: "base" });
          break;
        case "status": {
          const sa = `${a.statusRaw}\n${a.scheduledPublishAt ?? ""}`;
          const sb = `${b.statusRaw}\n${b.scheduledPublishAt ?? ""}`;
          v = sa.localeCompare(sb, "de");
          break;
        }
        default:
          return 0;
      }
      if (v !== 0) return v * mult;
      return a.id.localeCompare(b.id);
    });
  }, [rows, sort]);

  const loading = models.loading || contents.loading;
  const errMsg = useMemo(() => {
    const parts = [models.error, contents.error].filter(
      (x): x is string => Boolean(x && String(x).trim()),
    );
    return parts.length ? parts.join("\n") : null;
  }, [models.error, contents.error]);

  return (
    <div className="w-full">
      <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-ink-900 lg:text-[26px]">
            {isZuletztView ? "Zuletzt bearbeitet" : "Alle Inhalte"}
          </h1>
          {isZuletztView ? (
            <p className="mt-1 text-[13px] text-ink-500">
              Einträge, die du zuletzt gespeichert hast.
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative" ref={viewRef}>
            <button
              type="button"
              onClick={() => setViewOpen((v) => !v)}
              className="inline-flex items-center gap-1 rounded-md border border-[#dadce0] bg-white px-3 py-2 text-[12px] font-medium text-ink-800 hover:bg-[#f8f9fa]"
            >
              Ansicht
              <ChevronDown
                className={`h-4 w-4 text-ink-500 ${viewOpen ? "rotate-180" : ""}`}
              />
            </button>
            {viewOpen ? (
              <div className="absolute right-0 z-20 mt-1 w-48 rounded-lg border border-[#dadce0] bg-white py-1 shadow-lg">
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-[12px] text-ink-800 hover:bg-[#f1f3f4]"
                  onClick={() => setViewOpen(false)}
                >
                  Standardansicht
                </button>
              </div>
            ) : null}
          </div>
          <Link
            to={`${CMS_ROOT}/entries/new`}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#1a73e8] px-4 py-2 text-[12.5px] font-medium text-white shadow-sm hover:bg-[#1557b0]"
          >
            <Plus className="h-4 w-4" />
            Eintrag hinzufügen
          </Link>
        </div>
      </header>

      {errMsg ? (
        <pre className="mb-4 whitespace-pre-wrap rounded-lg border border-rose-200 bg-rose-50/80 px-3 py-2 font-sans text-[13px] text-rose-900">
          {errMsg}
        </pre>
      ) : null}

      <div className="mb-4 rounded-lg border border-[#dadce0] bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:gap-4">
          <div className="min-w-0 flex-1 lg:max-w-[220px]">
            <label
              htmlFor="cms-filter-model"
              className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-500"
            >
              Content-Typ
            </label>
            <select
              id="cms-filter-model"
              value={modelFromUrl}
              onChange={(e) => applyModelFilter(e.target.value)}
              disabled={Boolean(errMsg) || models.loading}
              className="w-full rounded-md border border-[#dadce0] bg-white px-3 py-2 text-[13px] text-ink-900 outline-none focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8]/30 disabled:opacity-50"
            >
              <option value="">Alle Typen</option>
              {sortedModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.key}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-0 flex-[2]">
            <label
              htmlFor="cms-search"
              className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-500"
            >
              Suche
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <input
                id="cms-search"
                type="search"
                value={qInput}
                onChange={(e) => setQInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applySearch();
                }}
                placeholder="Einträge durchsuchen …"
                disabled={Boolean(errMsg)}
                className="w-full rounded-md border border-[#dadce0] bg-white py-2 pl-9 pr-3 text-[13px] text-ink-800 placeholder:text-ink-400 focus:border-[#1a73e8] focus:outline-none focus:ring-1 focus:ring-[#1a73e8]/30 disabled:opacity-50"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={applySearch}
            disabled={Boolean(errMsg)}
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-[#dadce0] bg-white px-4 py-2 text-[12.5px] font-medium text-ink-800 hover:bg-[#f8f9fa] disabled:opacity-50 lg:mb-0"
          >
            <Filter className="h-4 w-4 text-ink-500" />
            Filter
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 border-t border-[#f1f3f4] pt-4">
          <button
            type="button"
            disabled
            title="Demnächst"
            className="inline-flex items-center rounded-full border border-dashed border-[#dadce0] bg-[#f8f9fa] px-2.5 py-1 text-[11.5px] text-ink-400"
          >
            + Von mir erstellt
          </button>
          <button
            type="button"
            disabled
            title="Demnächst"
            className="inline-flex items-center rounded-full border border-dashed border-[#dadce0] bg-[#f8f9fa] px-2.5 py-1 text-[11.5px] text-ink-400"
          >
            + Status
          </button>
          <button
            type="button"
            disabled
            title="Demnächst"
            className="inline-flex items-center rounded-full border border-dashed border-[#dadce0] bg-[#f8f9fa] px-2.5 py-1 text-[11.5px] text-ink-400"
          >
            + Locale
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-[#dadce0] bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-[#e8eaed] px-4 py-2.5">
          <p className="text-[12px] text-ink-500">
            {loading ? "Laden …" : `${rows.length} Einträge`}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[13px]">
            <thead className="border-b border-[#e8eaed] bg-[#fafafa] text-[11px] font-semibold uppercase tracking-wide text-ink-500">
              <tr>
                <th className="w-10 px-3 py-3" aria-label="Auswahl">
                  <span className="sr-only">Auswahl</span>
                </th>
                <SortColHead
                  label="Name"
                  sortKey="name"
                  activeKey={sort.key}
                  dir={sort.dir}
                  onSort={onSortColumn}
                  className="px-3 py-3 normal-case"
                />
                <th className="hidden w-[7rem] px-3 py-3 text-right sm:table-cell normal-case">
                  Aktion
                </th>
                <SortColHead
                  label="Content-Typ"
                  sortKey="type"
                  activeKey={sort.key}
                  dir={sort.dir}
                  onSort={onSortColumn}
                  className="hidden px-3 py-3 normal-case sm:table-cell"
                />
                <SortColHead
                  label="Aktualisiert"
                  sortKey="updated"
                  activeKey={sort.key}
                  dir={sort.dir}
                  onSort={onSortColumn}
                  className="hidden px-3 py-3 normal-case md:table-cell"
                />
                <SortColHead
                  label="Zuletzt von"
                  sortKey="lastBy"
                  activeKey={sort.key}
                  dir={sort.dir}
                  onSort={onSortColumn}
                  className="hidden px-3 py-3 normal-case lg:table-cell"
                />
                <SortColHead
                  label="Status"
                  sortKey="status"
                  activeKey={sort.key}
                  dir={sort.dir}
                  onSort={onSortColumn}
                  className="px-3 py-3 normal-case"
                />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f3f4]">
              {sortedRows.map((r) => (
                <tr key={r.id} className="transition hover:bg-[#f8f9fa]/80">
                  <td className="px-3 py-3 align-middle">
                    <input
                      type="checkbox"
                      disabled
                      title="Mehrfachaktionen folgen"
                      className="h-4 w-4 rounded border-[#dadce0] text-[#1a73e8] disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Zeile auswählen"
                    />
                  </td>
                  <td className="max-w-[240px] px-3 py-3 align-middle">
                    <Link
                      to={`${CMS_ROOT}/entries/${r.id}/edit`}
                      className="group inline-flex max-w-full flex-col gap-0.5 rounded-md py-0.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#1a73e8]"
                    >
                      <span className="inline-flex min-h-[1.25rem] items-center gap-1.5 break-words text-[13px] font-medium text-[#1a73e8] group-hover:underline">
                        <Pencil
                          className="h-3.5 w-3.5 shrink-0 opacity-70 group-hover:opacity-100"
                          aria-hidden
                        />
                        {r.listLabel}
                      </span>
                      <span className="block text-[11px] text-ink-400 sm:hidden">
                        {r.type} · {r.locale}
                      </span>
                    </Link>
                  </td>
                  <td className="hidden px-3 py-3 align-middle sm:table-cell">
                    <Link
                      to={`${CMS_ROOT}/entries/${r.id}/edit`}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-[12px] font-medium text-[#1a73e8] hover:bg-[#e8f0fe] hover:underline"
                    >
                      <Pencil className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      Bearbeiten
                    </Link>
                  </td>
                  <td className="hidden px-3 py-3 align-middle text-ink-700 sm:table-cell">
                    <span title={r.locale}>{r.type}</span>
                  </td>
                  <td className="hidden px-3 py-3 align-middle text-ink-600 md:table-cell">
                    <time dateTime={r.updatedAt}>{r.updatedLabel}</time>
                  </td>
                  <td className="hidden px-3 py-3 align-middle text-ink-600 lg:table-cell">
                    <span className="inline-flex min-w-0 max-w-full items-center gap-2">
                      <span className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full bg-[#e8eaed] ring-1 ring-[#dadce0]">
                        {r.lastUpdaterProfilbild ? (
                          <img
                            src={r.lastUpdaterProfilbild}
                            alt=""
                            className="h-full w-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center bg-[#e8f0fe] text-[10px] font-semibold text-[#1967d2]">
                            {(r.lastBy === "—" ? "?" : r.lastBy).slice(0, 1).toUpperCase()}
                          </span>
                        )}
                      </span>
                      <span className="truncate max-w-[140px]" title={r.lastBy}>
                        {r.lastBy}
                      </span>
                    </span>
                  </td>
                  <td className="px-3 py-3 align-middle">
                    <div className="flex flex-col gap-0.5">
                      <span
                        className={
                          r.statusRaw === "published"
                            ? "inline-flex w-fit rounded-full bg-[#e6f4ea] px-2.5 py-0.5 text-[11.5px] font-medium text-[#137333]"
                            : r.statusRaw === "archived"
                              ? "inline-flex w-fit rounded-full bg-ink-100 px-2.5 py-0.5 text-[11.5px] font-medium text-ink-600"
                              : r.statusRaw === "scheduled"
                                ? "inline-flex w-fit rounded-full bg-[#e8f0fe] px-2.5 py-0.5 text-[11.5px] font-medium text-[#1967d2]"
                                : "inline-flex w-fit rounded-full bg-[#fef7e0] px-2.5 py-0.5 text-[11.5px] font-medium text-[#b06000]"
                        }
                      >
                        {r.state}
                      </span>
                      {r.scheduleSubline ? (
                        <span className="text-[10.5px] leading-snug text-ink-500">
                          {r.scheduleSubline}
                        </span>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && rows.length === 0 && !errMsg ? (
          <p className="px-4 py-10 text-center text-[13px] text-ink-500">
            {isZuletztView
              ? "Keine Einträge, die du zuletzt bearbeitet hast — oder sie erscheinen hier erst nach dem nächsten Speichern."
              : "Keine Einträge für die aktuelle Auswahl."}
          </p>
        ) : null}
      </div>
    </div>
  );
}
