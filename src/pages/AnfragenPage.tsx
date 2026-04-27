import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Filter,
  Mail,
  MoreHorizontal,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { useOutletContext } from "react-router-dom";
import type { DashboardOutletContext } from "../components/layout/dashboardOutletContext";
import { fmtNumber, useApi } from "../lib/customerApi";
import {
  DASHBOARD_MAIN_INSET_X,
  DASH_TABLE_GRID,
  DASH_TD,
  DASH_TH,
} from "../lib/dashboardTableStyle";
import {
  type WebsiteSubmissionRow,
  type WebsiteSubmissionsListResponse,
  websiteSubmissionsListUrl,
} from "../lib/websiteSubmissionsApi";
import {
  type WebsiteTrialSubmissionsListResponse,
  websiteTrialSubmissionsListUrl,
} from "../lib/websiteTrialSubmissionsApi";

const PAGE_SIZE = 35;

const TH = `${DASH_TH} px-2 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.05em] text-ink-500`;
const TD = `${DASH_TD} px-2 py-2 align-top text-[12.5px] text-ink-800`;
const TABLE_CARD_WRAP = `min-h-0 overflow-x-auto border-b border-hair bg-gradient-to-b from-ink-50/25 via-white to-ink-50/20 py-2 sm:py-2.5 ${DASHBOARD_MAIN_INSET_X}`;
const TABLE_CARD =
  "w-full min-w-0 overflow-hidden rounded-xl border border-ink-200/70 bg-white shadow-sm shadow-ink-900/[0.06] ring-1 ring-ink-100/90 sm:rounded-2xl";
const FOOT_ROW = `mt-0 flex flex-wrap items-center justify-between gap-2 border-t border-hair bg-paper/90 py-1.5 text-[12.5px] text-ink-600 ${DASHBOARD_MAIN_INSET_X}`;

function fmtWhen(s: string | null | undefined): string {
  if (!s?.trim()) return "—";
  const raw = s.trim();
  const t = raw.includes("T")
    ? Date.parse(raw)
    : Date.parse(raw.replace(" ", "T") + "Z");
  if (isNaN(t)) return s;
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "UTC",
  }).format(new Date(t));
}

function pickEmail(payload: unknown): string | null {
  if (payload == null || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const o = payload as Record<string, unknown>;
  const e = o.email;
  if (typeof e === "string" && e.includes("@")) return e.trim();
  return null;
}

function pickName(payload: unknown): string | null {
  if (payload == null || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const o = payload as Record<string, unknown>;
  for (const k of ["name", "Name", "fullName", "subject"]) {
    const v = o[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function pickMetaString(meta: unknown, key: string): string | null {
  if (meta == null || typeof meta !== "object" || Array.isArray(meta)) {
    return null;
  }
  const v = (meta as Record<string, unknown>)[key];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** Firma/Domain-ähnliche Felder im Payload (Referenz: Company + Unterzeile). */
function pickPayloadCompanyOrDomain(payload: unknown): string | null {
  if (payload == null || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const o = payload as Record<string, unknown>;
  for (const k of [
    "company",
    "Company",
    "firma",
    "Firma",
    "domain",
    "Domain",
    "website",
    "Website",
  ]) {
    const v = o[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

/** Kompakte Uhrzeit für Tabellen-„Untertitel“ (de-DE, UTC). */
function fmtWhenShort(s: string | null | undefined): string {
  if (!s?.trim()) return "—";
  const raw = s.trim();
  const t = raw.includes("T")
    ? Date.parse(raw)
    : Date.parse(raw.replace(" ", "T") + "Z");
  if (isNaN(t)) return raw;
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(t));
}

function jsonPretty(x: unknown): string {
  try {
    return JSON.stringify(x, null, 2);
  } catch {
    return String(x);
  }
}

type AnfragenVariant = "production" | "trial";

export default function AnfragenPage({
  variant = "production",
}: {
  /** `trial` = D1-Tabelle `trial_submissions` (Test Anfragen). */
  variant?: AnfragenVariant;
} = {}) {
  const isTrial = variant === "trial";
  const [qIn, setQIn] = useState("");
  const [q, setQ] = useState("");
  const [offset, setOffset] = useState(0);
  const [spam, setSpam] = useState<"all" | "0" | "1">("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [detail, setDetail] = useState<WebsiteSubmissionRow | null>(null);
  const { setHeaderTrailing } = useOutletContext<DashboardOutletContext>();

  useEffect(() => {
    const t = setTimeout(() => setQ(qIn), 400);
    return () => clearTimeout(t);
  }, [qIn]);

  useEffect(() => {
    setOffset(0);
  }, [q, spam]);

  useEffect(() => {
    if (!filterOpen) return;
    let remove: (() => void) | undefined;
    const id = requestAnimationFrame(() => {
      const onDoc = (e: MouseEvent) => {
        const t = e.target as HTMLElement;
        if (t.closest?.("[data-anfragen-filter]")) return;
        setFilterOpen(false);
      };
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") setFilterOpen(false);
      };
      document.addEventListener("mousedown", onDoc);
      window.addEventListener("keydown", onKey);
      remove = () => {
        document.removeEventListener("mousedown", onDoc);
        window.removeEventListener("keydown", onKey);
      };
    });
    return () => {
      cancelAnimationFrame(id);
      remove?.();
    };
  }, [filterOpen]);

  const closeFilters = useCallback(() => setFilterOpen(false), []);

  const url = useMemo(
    () =>
      isTrial
        ? websiteTrialSubmissionsListUrl({
            q,
            limit: PAGE_SIZE,
            offset,
            spam,
          })
        : websiteSubmissionsListUrl({ q, limit: PAGE_SIZE, offset, spam }),
    [q, offset, spam, isTrial],
  );
  const api = useApi<
    WebsiteSubmissionsListResponse | WebsiteTrialSubmissionsListResponse
  >(url);

  const rows = api.data?.rows ?? [];
  const total = api.data?.total ?? 0;
  const limit = api.data?.limit ?? PAGE_SIZE;
  const atEnd = offset + rows.length >= total;
  const pageLabel =
    total === 0
      ? "0 / 0"
      : `${offset + 1}–${offset + rows.length} / ${fmtNumber(total)}`;

  const SPAM_OPTIONS = (
    [
      { id: "all" as const, label: "Alle" },
      { id: "0" as const, label: "Nur gültig" },
      { id: "1" as const, label: "Nur Spam" },
    ] as const
  );

  const errBannerClass = `mb-2 rounded border border-accent-rose/30 bg-accent-rose/5 py-2 text-[12.5px] text-accent-rose ${DASHBOARD_MAIN_INSET_X}`;

  const paginationControls = (
    <div className="flex items-center gap-1">
      <button
        type="button"
        disabled={offset === 0 || api.loading}
        onClick={() => setOffset((o) => Math.max(0, o - limit))}
        className="inline-flex h-8 items-center gap-0.5 rounded-md border border-ink-200/90 bg-white px-2.5 text-[12.5px] text-ink-800 shadow-sm enabled:hover:bg-ink-50 disabled:opacity-40"
      >
        <ChevronLeft className="h-4 w-4" />
        Zurück
      </button>
      <button
        type="button"
        disabled={atEnd || api.loading}
        onClick={() => setOffset((o) => o + limit)}
        className="inline-flex h-8 items-center gap-0.5 rounded-md border border-ink-200/90 bg-white px-2.5 text-[12.5px] text-ink-800 shadow-sm enabled:hover:bg-ink-50 disabled:opacity-40"
      >
        Weiter
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );

  const headerToolbar = useMemo(
    () => (
      <div className="flex min-w-0 w-full flex-1 items-center justify-end gap-1.5">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-ink-200/85 bg-white px-2.5 py-1.5 shadow-sm ring-1 ring-black/[0.05]">
          <Search className="h-3.5 w-3.5 shrink-0 text-ink-400" />
          <input
            type="search"
            value={qIn}
            onChange={(e) => setQIn(e.target.value)}
            placeholder={
              isTrial ? "Suchen" : "Begriffe, E-Mail, Formular …"
            }
            className="min-w-0 flex-1 border-0 bg-transparent text-[12.5px] text-ink-900 placeholder:text-ink-400 focus:outline-none"
            aria-label="Suche"
          />
        </div>
        <div className="relative" data-anfragen-filter>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setFilterOpen((o) => !o);
            }}
            className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border text-night-200 transition hover:bg-white/[0.08] hover:text-white ${
              spam !== "all"
                ? "border-brand-500/50 bg-brand-500/15 text-brand-200"
                : "border-white/[0.1] bg-white/[0.04]"
            }`}
            title="Spam-Filter"
            aria-expanded={filterOpen}
          >
            <Filter className="h-4 w-4" />
          </button>
          {filterOpen && (
            <div
              className="absolute right-0 top-full z-50 mt-1 w-[min(100vw-1rem,16rem)] rounded-lg border border-white/[0.1] bg-night-800 p-3 shadow-xl"
              data-anfragen-filter
              onClick={(e) => e.stopPropagation()}
            >
              <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-night-500">
                Spam
              </p>
              <div className="flex flex-col gap-1">
                {SPAM_OPTIONS.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => {
                      setSpam(o.id);
                      closeFilters();
                    }}
                    className={`rounded-md px-2 py-1.5 text-left text-[12.5px] ${
                      spam === o.id
                        ? "bg-white/15 text-white"
                        : "text-night-200 hover:bg-white/10"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => api.reload()}
          disabled={api.loading}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/[0.1] bg-white/[0.04] text-night-200 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-50"
          title="Aktualisieren"
        >
          <RefreshCw
            className={`h-4 w-4 ${api.loading ? "animate-spin" : ""}`}
          />
        </button>
      </div>
    ),
    [qIn, filterOpen, spam, isTrial, api.loading, closeFilters],
  );

  useLayoutEffect(() => {
    setHeaderTrailing(headerToolbar);
    return () => setHeaderTrailing(null);
  }, [setHeaderTrailing, headerToolbar]);

  const productionTableBlock = (
    <>
      {api.error && <p className={errBannerClass}>{api.error}</p>}

      <div className={TABLE_CARD_WRAP}>
        <div className={TABLE_CARD}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-left">
              <thead className="sticky top-0 z-10 bg-gradient-to-b from-ink-50/95 to-ink-100/90 shadow-[0_1px_0_0_rgba(15,15,15,0.05)]">
                <tr>
                  <th className={`${TH} w-[11rem]`}>zeit (UTC)</th>
                  <th className={TH}>formular</th>
                  <th className={TH}>kontakt</th>
                  <th className={`${TH} w-36`}>ip</th>
                  <th className={`${TH} w-20`}>land</th>
                  <th className={`${TH} w-20`}>spam</th>
                  <th className={`${TH} w-20 text-right`} />
                </tr>
              </thead>
              <tbody>
                {api.loading && rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className={`${DASH_TABLE_GRID} bg-white/90 px-2 py-10 text-center text-[13px] text-ink-400`}
                    >
                      Laden…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className={`${DASH_TABLE_GRID} bg-white/90 px-2 py-10 text-center text-[13px] text-ink-500`}
                    >
                      Keine Einsendungen.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => {
                    const email = pickEmail(r.payload);
                    const name = pickName(r.payload);
                    const ip = pickMetaString(r.metadata, "ip");
                    const country = pickMetaString(r.metadata, "country");
                    return (
                      <tr
                        key={r.id}
                        className="even:bg-ink-50/[0.45] transition-colors hover:bg-ink-100/70"
                      >
                        <td
                          className={`${TD} whitespace-nowrap text-ink-600`}
                        >
                      {fmtWhen(r.created_at)}
                    </td>
                    <td className={TD}>
                      <span className="inline-block rounded border border-hair bg-ink-50/80 px-1.5 py-0.5 text-[11.5px]">
                        {r.form_tag}
                      </span>
                    </td>
                    <td className={`${TD} min-w-0`}>
                      {email ? (
                        <a
                          href={`mailto:${email}`}
                          className="inline-flex max-w-full items-center gap-1 truncate text-brand-600 hover:underline"
                        >
                          <Mail className="h-3 w-3 shrink-0" />
                          {email}
                        </a>
                      ) : (
                        <span className="text-ink-400">—</span>
                      )}
                      {name && name !== email && (
                        <div className="mt-0.5 line-clamp-1 text-[11.5px] text-ink-500">
                          {name}
                        </div>
                      )}
                    </td>
                    <td className={`${TD} font-mono text-[11.5px]`}>
                      {ip || "—"}
                    </td>
                    <td className={TD}>{country || "—"}</td>
                    <td className={TD}>
                      {r.spam ? (
                        <span className="text-accent-amber">Spam</span>
                      ) : (
                        <span className="text-brand-700">ok</span>
                      )}
                    </td>
                    <td className={`${TD} text-right`}>
                      <button
                        type="button"
                        onClick={() => setDetail(r as WebsiteSubmissionRow)}
                        className="text-[12px] text-brand-600 hover:underline"
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
          </div>
        </div>
      </div>

      <div className={FOOT_ROW}>
        <span className="tabular-nums">{pageLabel}</span>
        {paginationControls}
      </div>
    </>
  );

  const trialTableBlock = (
    <>
      {api.error && <p className={errBannerClass}>{api.error}</p>}

      <div className={TABLE_CARD_WRAP}>
        <div className={TABLE_CARD}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-left">
              <thead className="sticky top-0 z-10 bg-gradient-to-b from-ink-50/95 to-ink-100/90 shadow-[0_1px_0_0_rgba(15,15,15,0.05)]">
                <tr>
                  <th className={`${TH} min-w-[10rem] sm:px-3`}>Eingang</th>
                  <th className={TH}>Kontakt</th>
                  <th className={TH}>Formular</th>
                  <th className={TH}>Herkunft</th>
                  <th className={TH}>Status</th>
                  <th className={`${TH} w-12 text-right`} />
                </tr>
              </thead>
              <tbody>
                {api.loading && rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className={`${DASH_TABLE_GRID} bg-white/90 px-2 py-12 text-center text-[13px] text-ink-400 sm:px-4`}
                    >
                      Laden…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className={`${DASH_TABLE_GRID} bg-white/90 px-2 py-12 text-center text-[13px] text-ink-500 sm:px-4`}
                    >
                      Keine Test-Einsendungen (Tabelle leer oder Migration
                      fehlt).
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => {
                    const email = pickEmail(r.payload);
                    const name = pickName(r.payload);
                    const companyLine = pickPayloadCompanyOrDomain(r.payload);
                    const ip = pickMetaString(r.metadata, "ip");
                    const country = pickMetaString(r.metadata, "country");
                    const leadTitle =
                      name && name !== email
                        ? name
                        : email || name || "—";
                    return (
                      <tr
                        key={r.id}
                        className="even:bg-ink-50/[0.45] transition-colors hover:bg-ink-100/70"
                      >
                        <td className={`${TD} sm:px-3`}>
                          <p className="line-clamp-1 text-[13px] font-medium text-ink-900">
                            {leadTitle}
                          </p>
                          <p className="mt-0.5 text-[11.5px] text-ink-500">
                            {fmtWhenShort(r.created_at)}
                          </p>
                        </td>
                        <td className={TD}>
                          {email ? (
                            <a
                              href={`mailto:${email}`}
                              className="line-clamp-1 break-all text-[13px] font-medium text-brand-600 hover:underline"
                            >
                              {email}
                            </a>
                          ) : (
                            <span className="text-ink-400">—</span>
                          )}
                          {name && name !== email && (
                            <p className="mt-0.5 line-clamp-1 text-[11.5px] text-ink-500">
                              {name}
                            </p>
                          )}
                        </td>
                        <td className={TD}>
                          <p className="line-clamp-1 text-[13px] font-medium text-ink-800">
                            {r.form_tag}
                          </p>
                          <p className="mt-0.5 line-clamp-1 text-[11.5px] text-ink-500">
                            {companyLine || "—"}
                          </p>
                        </td>
                        <td className={TD}>
                          <p className="line-clamp-1 text-[13px] text-ink-800">
                            {country || "—"}
                          </p>
                          <p className="mt-0.5 line-clamp-1 font-mono text-[11.5px] text-ink-500">
                            {ip || "—"}
                          </p>
                        </td>
                        <td className={TD}>
                          {r.spam ? (
                            <span className="inline-flex rounded-md border border-amber-200/80 bg-amber-50 px-2 py-0.5 text-[11.5px] font-medium text-amber-900">
                              Spam
                            </span>
                          ) : (
                            <span className="inline-flex rounded-md border border-emerald-200/80 bg-emerald-50 px-2 py-0.5 text-[11.5px] font-medium text-emerald-800">
                              Gültig
                            </span>
                          )}
                        </td>
                        <td className={`${TD} text-right`}>
                          <button
                            type="button"
                            onClick={() => setDetail(r as WebsiteSubmissionRow)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-500 transition hover:bg-ink-100 hover:text-ink-800"
                            title="Details"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className={FOOT_ROW}>
        <span className="tabular-nums">{pageLabel}</span>
        {paginationControls}
      </div>
    </>
  );

  const tableBlock = isTrial ? trialTableBlock : productionTableBlock;

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
        {tableBlock}
      </div>
      {detail && (
        <SubmissionDetailDialog row={detail} onClose={() => setDetail(null)} />
      )}
    </div>
  );
}

function SubmissionDetailDialog({
  row,
  onClose,
}: {
  row: WebsiteSubmissionRow;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const ref = pickMetaString(row.metadata, "referer");
  const ua = pickMetaString(row.metadata, "userAgent");

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Einsendung"
    >
      <button
        type="button"
        className="absolute inset-0 bg-night-900/40 backdrop-blur-sm"
        aria-label="Schließen"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[min(92vh,900px)] w-full max-w-[640px] flex-col overflow-hidden rounded-t-lg border border-hair bg-paper shadow-2xl sm:rounded-lg">
        <div className="flex items-center justify-between gap-2 border-b border-hair px-4 py-3">
          <div className="min-w-0">
            <p className="text-[10.5px] font-medium uppercase tracking-wider text-ink-400">
              {row.form_tag}
            </p>
            <p className="mt-0.5 truncate font-mono text-[12px] text-ink-700">
              {row.id}
            </p>
            <p className="text-[12px] text-ink-500">
              {fmtWhen(row.created_at)} UTC · {row.spam ? "Spam" : "Gültig"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-md border border-hair"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <h3 className="mb-1 text-[10.5px] font-medium uppercase tracking-wider text-ink-400">
            Inhalt (payload)
          </h3>
          <pre className="mb-4 max-h-48 overflow-auto rounded border border-hair bg-ink-50/50 p-2 font-mono text-[11.5px] text-ink-800">
            {jsonPretty(row.payload)}
          </pre>
          <h3 className="mb-1 text-[10.5px] font-medium uppercase tracking-wider text-ink-400">
            Technische Metadaten
          </h3>
          <pre className="mb-3 max-h-56 overflow-auto rounded border border-hair bg-ink-50/50 p-2 font-mono text-[11.5px] text-ink-800">
            {jsonPretty(row.metadata)}
          </pre>
          {ref && (
            <p className="text-[12px] text-ink-600">
              <span className="text-ink-400">Referer: </span>
              <a
                href={ref}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all text-brand-600 hover:underline"
              >
                {ref}
                <ExternalLink className="ml-0.5 inline h-3 w-3" />
              </a>
            </p>
          )}
          {ua && (
            <p className="mt-2 line-clamp-3 text-[11px] text-ink-500" title={ua}>
              User-Agent: {ua}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
