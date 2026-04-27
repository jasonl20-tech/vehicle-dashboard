import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ListFilter,
  Mail,
  MoreHorizontal,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PageHeader from "../components/ui/PageHeader";
import { fmtNumber, useApi } from "../lib/customerApi";
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

const TEXT_IN =
  "w-full min-w-0 rounded border border-hair bg-white px-2 py-1.5 text-[12.5px] text-ink-800 focus:border-ink-400 focus:outline-none";
const TH = "px-2 py-2 text-left text-[10px] font-medium uppercase tracking-[0.1em] text-ink-400";
const TD = "px-2 py-2 align-top text-[12.5px] text-ink-800";

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
  const filterWrapRef = useRef<HTMLDivElement>(null);
  const [detail, setDetail] = useState<WebsiteSubmissionRow | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setQ(qIn), 400);
    return () => clearTimeout(t);
  }, [qIn]);

  useEffect(() => {
    setOffset(0);
  }, [q, spam]);

  useEffect(() => {
    if (!filterOpen) return;
    const onDoc = (e: MouseEvent) => {
      const el = filterWrapRef.current;
      if (el && !el.contains(e.target as Node)) setFilterOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFilterOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
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

  /** Wenig inhalt: Block (Suche + Tabelle) vertikal in der Fläche zentrieren. */
  const shouldCenterBlock =
    isTrial && !api.loading && (total === 0 || total <= 16);

  const SPAM_OPTIONS = (
    [
      { id: "all" as const, label: "Alle" },
      { id: "0" as const, label: "Nur gültig" },
      { id: "1" as const, label: "Nur Spam" },
    ] as const
  );

  const errBannerClass = (indent: "trial" | "prod") =>
    `mb-2 rounded border border-accent-rose/30 bg-accent-rose/5 py-2 text-[12.5px] text-accent-rose ${
      indent === "trial" ? "" : "px-3"
    }`;

  const footerTw = (variant: "trial" | "prod") =>
    `mt-0 flex flex-wrap items-center justify-between gap-2 text-[12.5px] ${
      variant === "trial"
        ? "border-t border-slate-200/90 bg-paper py-2.5 text-slate-600"
        : "border border-t-0 border-hair bg-paper text-ink-600 rounded-b-md px-2 py-2"
    }`;

  const paginationControls = (variant: "trial" | "prod") => (
    <div className="flex items-center gap-1">
      <button
        type="button"
        disabled={offset === 0 || api.loading}
        onClick={() => setOffset((o) => Math.max(0, o - limit))}
        className={
          variant === "trial"
            ? "inline-flex h-8 items-center gap-0.5 rounded-md border border-slate-200 bg-white px-2.5 text-slate-700 shadow-sm enabled:hover:bg-slate-50 disabled:opacity-40"
            : "inline-flex h-8 items-center gap-0.5 rounded-md border border-hair px-2 text-ink-700 enabled:hover:bg-ink-50 disabled:opacity-40"
        }
      >
        <ChevronLeft className="h-4 w-4" />
        Zurück
      </button>
      <button
        type="button"
        disabled={atEnd || api.loading}
        onClick={() => setOffset((o) => o + limit)}
        className={
          variant === "trial"
            ? "inline-flex h-8 items-center gap-0.5 rounded-md border border-slate-200 bg-white px-2.5 text-slate-700 shadow-sm enabled:hover:bg-slate-50 disabled:opacity-40"
            : "inline-flex h-8 items-center gap-0.5 rounded-md border border-hair px-2 text-ink-700 enabled:hover:bg-ink-50 disabled:opacity-40"
        }
      >
        Weiter
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );

  const productionTableBlock = (
    <>
      {api.error && <p className={errBannerClass("prod")}>{api.error}</p>}

      <div className="w-full min-w-0 overflow-x-auto rounded-md border border-hair bg-paper">
        <table className="w-full min-w-[900px] table-auto text-left">
          <thead className="bg-ink-50/80">
            <tr>
              <th className={`${TH} w-[11rem] px-2 py-2`}>zeit (UTC)</th>
              <th className={TH}>formular</th>
              <th className={TH}>kontakt</th>
              <th className={`${TH} w-36`}>ip</th>
              <th className={`${TH} w-20`}>land</th>
              <th className={`${TH} w-20`}>spam</th>
              <th className={`${TH} w-20 text-right`} />
            </tr>
          </thead>
          <tbody className="divide-y divide-hair">
            {api.loading && rows.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-2 py-10 text-center text-[13px] text-ink-400"
                >
                  Laden…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-2 py-10 text-center text-[13px] text-ink-500"
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
                  <tr key={r.id} className="hover:bg-ink-50/50">
                    <td className={`${TD} whitespace-nowrap text-ink-600`}>
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

      <div className={footerTw("prod")}>
        <span className="tabular-nums">{pageLabel}</span>
        {paginationControls("prod")}
      </div>
    </>
  );

  const trialTableBlock = (
    <>
      {api.error && <p className={errBannerClass("trial")}>{api.error}</p>}

      <div className="w-full min-w-0 overflow-x-auto bg-paper">
        <table className="w-full min-w-[900px] border-collapse text-left">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/90">
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500 sm:px-4">
                Eingang
              </th>
              <th className="px-2 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500 sm:pl-0">
                Kontakt
              </th>
              <th className="px-2 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500 sm:pl-0">
                Formular
              </th>
              <th className="px-2 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500 sm:pl-0">
                Herkunft
              </th>
              <th className="px-2 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500 sm:pl-0">
                Status
              </th>
              <th className="w-12 px-2 py-2.5 sm:pr-4" />
            </tr>
          </thead>
          <tbody>
            {api.loading && rows.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-12 text-center text-[13px] text-slate-400 sm:px-4"
                >
                  Laden…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-12 text-center text-[13px] text-slate-500 sm:px-4"
                >
                  Keine Test-Einsendungen (Tabelle leer oder Migration fehlt).
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
                    className="border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/90"
                  >
                    <td className="px-3 py-3 align-top sm:px-4">
                      <p className="line-clamp-1 text-[13px] font-medium text-slate-900">
                        {leadTitle}
                      </p>
                      <p className="mt-0.5 text-[11.5px] text-slate-500">
                        {fmtWhenShort(r.created_at)}
                      </p>
                    </td>
                    <td className="px-2 py-3 align-top sm:pl-0">
                      {email ? (
                        <a
                          href={`mailto:${email}`}
                          className="line-clamp-1 break-all text-[13px] font-medium text-blue-600 hover:underline"
                        >
                          {email}
                        </a>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                      {name && name !== email && (
                        <p className="mt-0.5 line-clamp-1 text-[11.5px] text-slate-500">
                          {name}
                        </p>
                      )}
                    </td>
                    <td className="px-2 py-3 align-top sm:pl-0">
                      <p className="line-clamp-1 text-[13px] font-medium text-slate-800">
                        {r.form_tag}
                      </p>
                      <p className="mt-0.5 line-clamp-1 text-[11.5px] text-slate-500">
                        {companyLine || "—"}
                      </p>
                    </td>
                    <td className="px-2 py-3 align-top sm:pl-0">
                      <p className="line-clamp-1 text-[13px] text-slate-800">
                        {country || "—"}
                      </p>
                      <p className="mt-0.5 line-clamp-1 font-mono text-[11.5px] text-slate-500">
                        {ip || "—"}
                      </p>
                    </td>
                    <td className="px-2 py-3 align-top sm:pl-0">
                      {r.spam ? (
                        <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[11.5px] font-medium text-amber-900 ring-1 ring-amber-200/80">
                          Spam
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[11.5px] font-medium text-emerald-800 ring-1 ring-emerald-200/80">
                          Gültig
                        </span>
                      )}
                    </td>
                    <td className="px-1 py-3 text-right align-top sm:pr-3">
                      <button
                        type="button"
                        onClick={() => setDetail(r as WebsiteSubmissionRow)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
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

      <div className={footerTw("trial")}>
        <span className="tabular-nums text-slate-600">{pageLabel}</span>
        {paginationControls("trial")}
      </div>
    </>
  );

  const tableBlock = isTrial ? trialTableBlock : productionTableBlock;

  const resFrom = total === 0 ? 0 : offset + 1;
  const resTo = offset + rows.length;

  const trialSearchBar = (
    <div className="w-full border-b border-slate-200/80 bg-paper/95 py-3">
      <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            className="h-10 w-full min-w-0 rounded-lg border border-slate-200 bg-slate-50/90 pl-9 pr-3 text-[13px] text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200/80"
            placeholder="Suchen"
            value={qIn}
            onChange={(e) => setQIn(e.target.value)}
            aria-label="Suche"
          />
        </div>
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 sm:justify-end sm:gap-3">
          <p className="shrink-0 text-sm tabular-nums text-slate-500">
            Zeige {String(resFrom).padStart(2, "0")}–{String(resTo).padStart(2, "0")} von {fmtNumber(total)}
          </p>
          <div className="flex items-center gap-2">
            <div className="relative shrink-0" ref={filterWrapRef}>
              <button
                type="button"
                onClick={() => setFilterOpen((v) => !v)}
                title="Filter"
                aria-expanded={filterOpen}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
              >
                <ListFilter className="h-4 w-4 text-slate-500" />
                Alle Filter
              </button>
              {filterOpen && (
                <div
                  className="absolute right-0 z-40 mt-1.5 w-[min(100vw-2rem,16rem)] rounded-lg border border-slate-200 bg-white p-2 shadow-lg"
                  role="menu"
                >
                  <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-slate-400">
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
                            ? "bg-slate-900 text-white"
                            : "text-slate-700 hover:bg-slate-50"
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
              title="Aktualisieren"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${api.loading ? "animate-spin" : ""}`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (isTrial) {
    return (
      <div className="flex w-full min-h-0 min-w-0 flex-1 flex-col">
        {shouldCenterBlock ? (
          <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col justify-center">
            {trialSearchBar}
            <div className="w-full min-w-0 shrink-0">{tableBlock}</div>
          </div>
        ) : (
          <>
            {trialSearchBar}
            <div className="min-h-0 w-full min-w-0 flex-1 overflow-y-auto">
              {tableBlock}
            </div>
          </>
        )}

        {detail && (
          <SubmissionDetailDialog row={detail} onClose={() => setDetail(null)} />
        )}
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Kundenmanagement"
        title="Anfragen"
        description={
          <span>
            Einsendungen aus dem Formular-Backend (D1{" "}
            <code className="font-mono text-[11.5px]">website</code>, Tabelle{" "}
            <code className="font-mono text-[11.5px]">submissions</code>).
          </span>
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-full min-w-[200px] max-w-[400px]">
          <label className="mb-0.5 block text-[10.5px] font-medium uppercase tracking-wider text-ink-400">
            Suche
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
            <input
              type="search"
              className={`${TEXT_IN} pl-8`}
              placeholder="Begriffe (alle müssen vorkommen), E-Mail, Formular, …"
              value={qIn}
              onChange={(e) => setQIn(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="mb-0.5 block text-[10.5px] font-medium uppercase tracking-wider text-ink-400">
            Spam
          </label>
          <div className="inline-flex overflow-hidden rounded-md border border-hair bg-white">
            {SPAM_OPTIONS.map((o, i) => (
              <button
                key={o.id}
                type="button"
                onClick={() => setSpam(o.id)}
                className={`px-2.5 py-1.5 text-[12px] transition-colors ${
                  spam === o.id
                    ? "bg-ink-900 text-white"
                    : "text-ink-600 hover:bg-ink-50"
                } ${i > 0 ? "border-l border-hair" : ""}`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={() => api.reload()}
          title="Aktualisieren"
          className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-md border border-hair text-ink-500 hover:bg-ink-50"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${api.loading ? "animate-spin" : ""}`}
          />
        </button>
      </div>

      {tableBlock}

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
