/**
 * Email Logs — vertikale Timeline aller Email-Events.
 *
 * Quelle: `/api/emails/timeline` (Job-Lifecycle + Tracking, gemerged
 * und nach Datum DESC sortiert).
 *
 * Jedes Event ist ein einzelner Timeline-Eintrag. Mehrere Events pro
 * Job sind explizit gewünscht — die Job-ID + Empfänger sind in jeder
 * Karte verlinkt, ein Klick öffnet die Detail-Seite mit Charts.
 */
import {
  AlertCircle,
  ChevronDown,
  Clock,
  ExternalLink,
  Eye,
  Filter,
  Loader2,
  Mail,
  MousePointerClick,
  RefreshCw,
  Search,
  Send,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import type { DashboardOutletContext } from "../components/layout/dashboardOutletContext";
import { fmtNumber } from "../lib/customerApi";
import { parseTrackingMetadata } from "../lib/emailJobsApi";
import {
  emailTimelineUrl,
  type EmailTimelineEvent,
  type EmailTimelineKind,
  type EmailTimelineResponse,
} from "../lib/emailTimelineApi";

const PAGE_SIZE = 100;
const KIND_KEY = "ui.emailLogs.kind";
const STATUS_KEY = "ui.emailLogs.status";

const noopSetHeader: DashboardOutletContext["setHeaderTrailing"] = () => {};

// ─── Persistenz ──────────────────────────────────────────────────────

type StatusFilter = "" | "pending" | "processing" | "sent" | "failed";
type KindFilter = "" | EmailTimelineKind;

const KIND_VALUES: KindFilter[] = ["", "created", "sent", "failed", "open", "click"];
const STATUS_VALUES: StatusFilter[] = ["", "pending", "processing", "sent", "failed"];

function readKind(): KindFilter {
  if (typeof window === "undefined") return "";
  try {
    const v = window.localStorage.getItem(KIND_KEY) || "";
    return (KIND_VALUES as string[]).includes(v) ? (v as KindFilter) : "";
  } catch {
    return "";
  }
}
function writeKind(v: KindFilter): void {
  try {
    window.localStorage.setItem(KIND_KEY, v);
  } catch {
    // ignore
  }
}
function readStatus(): StatusFilter {
  if (typeof window === "undefined") return "";
  try {
    const v = window.localStorage.getItem(STATUS_KEY) || "";
    return (STATUS_VALUES as string[]).includes(v) ? (v as StatusFilter) : "";
  } catch {
    return "";
  }
}
function writeStatus(v: StatusFilter): void {
  try {
    window.localStorage.setItem(STATUS_KEY, v);
  } catch {
    // ignore
  }
}

// ─── Date Helpers ────────────────────────────────────────────────────

function parseTs(s: string | null | undefined): number | null {
  if (!s?.trim()) return null;
  const raw = s.trim();
  const t = raw.includes("T")
    ? Date.parse(raw)
    : Date.parse(raw.replace(" ", "T") + "Z");
  return Number.isNaN(t) ? null : t;
}

function fmtTime(s: string | null | undefined): string {
  const t = parseTs(s);
  if (t == null) return "—";
  return new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "UTC",
  }).format(new Date(t));
}

function fmtDateLabel(s: string | null | undefined): string {
  const t = parseTs(s);
  if (t == null) return "Unbekannt";
  const d = new Date(t);
  const today = new Date();
  const ymdToday = `${today.getUTCFullYear()}-${today.getUTCMonth()}-${today.getUTCDate()}`;
  const ymdEvent = `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
  if (ymdToday === ymdEvent) return "Heute";
  // Yesterday?
  const yesterday = new Date(today.getTime() - 86_400_000);
  const ymdYst = `${yesterday.getUTCFullYear()}-${yesterday.getUTCMonth()}-${yesterday.getUTCDate()}`;
  if (ymdYst === ymdEvent) return "Gestern";
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

function fmtRelative(s: string | null | undefined): string {
  const t = parseTs(s);
  if (t == null) return "—";
  const diff = Date.now() - t;
  const sec = Math.round(diff / 1000);
  if (sec < 60) return `vor ${sec}s`;
  if (sec < 3600) return `vor ${Math.round(sec / 60)} Min.`;
  if (sec < 86400) return `vor ${Math.round(sec / 3600)} Std.`;
  return `vor ${Math.round(sec / 86400)} Tagen`;
}

// ─── Kind-Meta (Marker, Label) ───────────────────────────────────────

const KIND_META: Record<
  EmailTimelineKind,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    accent: string;
    pillBg: string;
    pillText: string;
  }
> = {
  created: {
    label: "angelegt",
    icon: Clock,
    accent: "bg-amber-500",
    pillBg: "bg-amber-50",
    pillText: "text-amber-700",
  },
  sent: {
    label: "versendet",
    icon: Send,
    accent: "bg-emerald-600",
    pillBg: "bg-emerald-50",
    pillText: "text-emerald-700",
  },
  failed: {
    label: "fehlgeschlagen",
    icon: AlertCircle,
    accent: "bg-rose-600",
    pillBg: "bg-rose-50",
    pillText: "text-rose-700",
  },
  open: {
    label: "geöffnet",
    icon: Eye,
    accent: "bg-emerald-500",
    pillBg: "bg-emerald-50",
    pillText: "text-emerald-700",
  },
  click: {
    label: "geklickt",
    icon: MousePointerClick,
    accent: "bg-sky-500",
    pillBg: "bg-sky-50",
    pillText: "text-sky-700",
  },
};

const KIND_FILTER_OPTIONS: { value: KindFilter; label: string }[] = [
  { value: "", label: "Alle" },
  { value: "sent", label: "Versendet" },
  { value: "open", label: "Opens" },
  { value: "click", label: "Clicks" },
  { value: "failed", label: "Fehler" },
  { value: "created", label: "Angelegt" },
];

const STATUS_FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "", label: "Alle" },
  { value: "sent", label: "Sent" },
  { value: "pending", label: "Pending" },
  { value: "processing", label: "Proc." },
  { value: "failed", label: "Failed" },
];

// ─── Page ────────────────────────────────────────────────────────────

export default function EmailLogsPage() {
  const ctx = useOutletContext<DashboardOutletContext | undefined>();
  const setHeaderTrailing = ctx?.setHeaderTrailing ?? noopSetHeader;
  const navigate = useNavigate();

  const [qIn, setQIn] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setQ(qIn), 250);
    return () => clearTimeout(t);
  }, [qIn]);

  const [kind, setKind] = useState<KindFilter>(readKind);
  useEffect(() => writeKind(kind), [kind]);

  const [status, setStatus] = useState<StatusFilter>(readStatus);
  useEffect(() => writeStatus(status), [status]);

  const [showStatusFilter, setShowStatusFilter] = useState(false);

  // Akkumulierter Event-Stream
  const [events, setEvents] = useState<EmailTimelineEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [trackingAvailable, setTrackingAvailable] = useState<boolean>(true);

  const filtersKey = useMemo(
    () => JSON.stringify({ q, kind, status }),
    [q, kind, status],
  );

  const loadPage = useCallback(
    async (offset: number, append: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const url = emailTimelineUrl({
          q,
          kind: kind || undefined,
          status: status || undefined,
          limit: PAGE_SIZE,
          offset,
        });
        const res = await fetch(url, { credentials: "include" });
        const json = (await res.json()) as Partial<EmailTimelineResponse> & {
          error?: string;
          hint?: string;
        };
        if (!res.ok) {
          throw new Error(
            [json.error ?? `HTTP ${res.status}`, json.hint && `Hinweis: ${json.hint}`]
              .filter(Boolean)
              .join(" • "),
          );
        }
        const rows = (json.rows ?? []) as EmailTimelineEvent[];
        setTotal(json.total ?? 0);
        setHint(json.hint ?? null);
        setTrackingAvailable(json.tracking_available !== false);
        setEvents((prev) => (append ? [...prev, ...rows] : rows));
      } catch (e) {
        setError((e as Error).message || String(e));
      } finally {
        setLoading(false);
      }
    },
    [q, kind, status],
  );

  // Reset bei Filter-Wechsel
  useEffect(() => {
    setEvents([]);
    setTotal(0);
    loadPage(0, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey]);

  const reload = useCallback(() => {
    setEvents([]);
    setTotal(0);
    loadPage(0, false);
  }, [loadPage]);

  const loadMore = useCallback(() => {
    if (loading) return;
    loadPage(events.length, true);
  }, [loading, loadPage, events.length]);

  const hasMore = events.length < total;

  const headerToolbar = useMemo(
    () => (
      <div className="flex min-w-0 w-full flex-1 items-center justify-end gap-1.5">
        <span className="hidden truncate text-[11.5px] tabular-nums text-night-500 md:block">
          Live-Feed · neueste oben
        </span>
        <div
          role="tablist"
          aria-label="Event-Typ"
          className="hidden items-center gap-0.5 rounded-md border border-white/[0.1] bg-white/[0.03] p-0.5 sm:inline-flex"
        >
          {KIND_FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value || "all"}
              type="button"
              role="tab"
              aria-selected={kind === opt.value}
              onClick={() => setKind(opt.value)}
              className={`rounded px-2 py-1 text-[11.5px] transition ${
                kind === opt.value
                  ? "bg-white text-ink-900"
                  : "text-night-300 hover:bg-white/[0.08] hover:text-white"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={reload}
          disabled={loading}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/[0.1] bg-white/[0.04] text-night-200 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-50"
          title="Neu laden"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>
    ),
    [kind, loading, reload],
  );

  useLayoutEffect(() => {
    setHeaderTrailing(headerToolbar);
    return () => setHeaderTrailing(null);
  }, [setHeaderTrailing, headerToolbar]);

  // Gruppierung nach Tag (visuelle Trenner)
  const groups = useMemo(() => {
    const out: { label: string; key: string; events: EmailTimelineEvent[] }[] = [];
    let currentKey = "";
    for (const ev of events) {
      const t = parseTs(ev.at);
      if (t == null) {
        if (currentKey !== "—unknown—") {
          currentKey = "—unknown—";
          out.push({ label: "Unbekannter Zeitpunkt", key: currentKey, events: [] });
        }
        out[out.length - 1].events.push(ev);
        continue;
      }
      const d = new Date(t);
      const dayKey = `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
      if (dayKey !== currentKey) {
        currentKey = dayKey;
        out.push({ label: fmtDateLabel(ev.at), key: dayKey, events: [] });
      }
      out[out.length - 1].events.push(ev);
    }
    return out;
  }, [events]);

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-paper">
      {error && (
        <p
          className="shrink-0 border-b border-rose-500/30 bg-rose-500/10 px-4 py-1.5 text-[12.5px] text-rose-700 sm:px-6"
          role="alert"
        >
          {error}
        </p>
      )}
      {hint && !error && (
        <p
          className="shrink-0 border-b border-amber-500/40 bg-amber-500/10 px-4 py-1.5 text-[12.5px] text-amber-700 sm:px-6"
          role="status"
        >
          {hint}
        </p>
      )}
      {!trackingAvailable && (
        <p
          className="shrink-0 border-b border-amber-500/40 bg-amber-500/10 px-4 py-1.5 text-[12.5px] text-amber-700 sm:px-6"
          role="status"
        >
          Tabelle <code className="font-mono text-[11px]">email_tracking</code>{" "}
          fehlt — Opens & Clicks werden nicht gezählt. Migration 0009 ausführen.
        </p>
      )}

      {/* Toolbar */}
      <div className="shrink-0 border-b border-hair bg-white px-3 py-2 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-hair bg-paper/60 px-2.5 py-1.5">
            <Search className="h-3.5 w-3.5 shrink-0 text-ink-400" />
            <input
              type="search"
              value={qIn}
              onChange={(e) => setQIn(e.target.value)}
              placeholder="Suche: Job-ID, Betreff, Empfänger, IP, URL, User-Agent…"
              className="min-w-0 flex-1 border-0 bg-transparent text-[13px] text-ink-900 placeholder:text-ink-400 focus:outline-none"
            />
            {qIn && (
              <button
                type="button"
                onClick={() => setQIn("")}
                className="text-ink-400 hover:text-ink-700"
                title="Suche leeren"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Mobile Kind-Filter */}
          <div className="grid w-full grid-cols-6 gap-1 sm:hidden">
            {KIND_FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value || "all"}
                type="button"
                onClick={() => setKind(opt.value)}
                className={`rounded px-1 py-1 text-[10.5px] transition ${
                  kind === opt.value
                    ? "bg-ink-900 text-white"
                    : "border border-hair bg-white text-ink-600 hover:text-ink-900"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Status-Filter (sekundär) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowStatusFilter((v) => !v)}
              className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[12px] transition ${
                status
                  ? "border-ink-900 bg-ink-900 text-white"
                  : "border-hair bg-white text-ink-600 hover:bg-ink-50"
              }`}
            >
              <Filter className="h-3 w-3" />
              Status
              {status && (
                <span className="rounded bg-white/20 px-1 text-[10px]">
                  {status}
                </span>
              )}
              <ChevronDown
                className={`h-3 w-3 transition-transform ${
                  showStatusFilter ? "rotate-180" : ""
                }`}
              />
            </button>
            {showStatusFilter && (
              <div className="absolute right-0 top-full z-10 mt-1 flex flex-col rounded-md border border-hair bg-white py-1 shadow-lg">
                {STATUS_FILTER_OPTIONS.map((opt) => (
                  <button
                    key={opt.value || "all"}
                    type="button"
                    onClick={() => {
                      setStatus(opt.value);
                      setShowStatusFilter(false);
                    }}
                    className={`px-3 py-1 text-left text-[12px] transition ${
                      status === opt.value
                        ? "bg-ink-50 font-medium text-ink-900"
                        : "text-ink-700 hover:bg-ink-50"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Counter */}
          <div className="flex items-center gap-3 text-[11.5px] tabular-nums text-ink-500">
            <span>
              <span className="text-ink-700">{fmtNumber(events.length)}</span>
              {total > events.length && (
                <span className="text-ink-400"> / {fmtNumber(total)}</span>
              )}{" "}
              Events
            </span>
            {loading && <Loader2 className="h-3 w-3 animate-spin" />}
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto max-w-4xl px-4 py-6 sm:px-8">
          {events.length === 0 && !loading && (
            <p className="rounded-md border border-dashed border-hair bg-white px-4 py-12 text-center text-[12.5px] text-ink-400">
              Keine Events für diese Filter.
            </p>
          )}

          {groups.map((g) => (
            <div key={g.key} className="mb-2">
              {/* Tages-Trenner */}
              <div className="sticky top-0 z-[5] -mx-2 flex items-center gap-2 bg-paper/95 py-2 backdrop-blur sm:-mx-4">
                <span className="text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-500">
                  {g.label}
                </span>
                <span className="h-px flex-1 bg-hair" />
                <span className="text-[10.5px] tabular-nums text-ink-400">
                  {g.events.length}{" "}
                  {g.events.length === 1 ? "Event" : "Events"}
                </span>
              </div>

              {/* Events des Tages */}
              <ol className="relative">
                <span
                  className="absolute left-[15px] top-0 bottom-0 w-px bg-hair"
                  aria-hidden
                />
                {g.events.map((ev) => (
                  <TimelineItem
                    key={ev.id}
                    ev={ev}
                    onOpen={() =>
                      navigate(`/emails/logs/${encodeURIComponent(ev.job_id)}`)
                    }
                  />
                ))}
              </ol>
            </div>
          ))}

          {/* Load-more */}
          <div className="pt-3 pb-12 text-center">
            {hasMore ? (
              <button
                type="button"
                onClick={loadMore}
                disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-md border border-hair bg-white px-4 py-2 text-[12.5px] font-medium text-ink-700 transition hover:bg-ink-50 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Lade…
                  </>
                ) : (
                  <>
                    Weitere {fmtNumber(Math.min(PAGE_SIZE, total - events.length))} Events laden
                    <ChevronDown className="h-3.5 w-3.5" />
                  </>
                )}
              </button>
            ) : events.length > 0 ? (
              <p className="text-[11px] text-ink-400">
                — Ende der Timeline —
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Timeline-Item ───────────────────────────────────────────────────

function TimelineItem({
  ev,
  onOpen,
}: {
  ev: EmailTimelineEvent;
  onOpen: () => void;
}) {
  const meta = KIND_META[ev.kind];
  const Icon = meta.icon;
  const subject =
    ev.custom_subject?.trim() ||
    (ev.template_id ? `Template: ${ev.template_id}` : "Ohne Betreff");
  const recipient = ev.recipient_email || "—";
  const trackingMeta = parseTrackingMetadata(ev.metadata);
  const geo = [trackingMeta?.city, trackingMeta?.country]
    .filter(Boolean)
    .join(", ");

  return (
    <li
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen();
      }}
      tabIndex={0}
      className="group relative flex cursor-pointer gap-3 py-2 pl-1 pr-1 focus:outline-none"
    >
      {/* Marker */}
      <div className="relative z-[1] flex h-[30px] w-[30px] shrink-0 items-center justify-center">
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-full text-white ring-4 ring-paper ${meta.accent}`}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>

      {/* Card */}
      <div className="min-w-0 flex-1 rounded-md border border-transparent bg-white/0 px-3 py-2 transition group-hover:border-hair group-hover:bg-white group-focus:border-ink-900 group-focus:bg-white">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10.5px] font-medium ${meta.pillBg} ${meta.pillText}`}
          >
            {meta.label}
          </span>
          <span
            className="text-[11.5px] tabular-nums text-ink-500"
            title={ev.at ?? ""}
          >
            {fmtTime(ev.at)} · {fmtRelative(ev.at)}
          </span>
          <span className="ml-auto inline-flex items-center gap-1 text-[10.5px] text-ink-400 transition group-hover:text-ink-700">
            Detail <ExternalLink className="h-3 w-3" />
          </span>
        </div>

        <p
          className="mt-1 truncate text-[13.5px] font-medium text-ink-900"
          title={subject}
        >
          {subject}
        </p>

        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11.5px] text-ink-600">
          <span
            className="inline-flex items-center gap-1 truncate font-mono"
            title={recipient}
          >
            <Mail className="h-3 w-3 text-ink-400" />
            {recipient}
          </span>
          <span
            className="truncate font-mono text-[10.5px] text-ink-400"
            title={ev.job_id}
          >
            #{ev.job_id.slice(0, 8)}
          </span>
        </div>

        {/* Kind-spezifische Zusatzzeile */}
        {ev.kind === "click" && ev.link_url && (
          <p
            className="mt-1 truncate text-[11.5px] text-sky-700"
            title={ev.link_url}
          >
            <a
              href={ev.link_url}
              className="hover:underline"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              {ev.link_url}
            </a>
          </p>
        )}
        {(ev.kind === "open" || ev.kind === "click") &&
          (ev.ip_address || geo) && (
            <p className="mt-0.5 truncate text-[10.5px] text-ink-500">
              {ev.ip_address && (
                <span className="font-mono">{ev.ip_address}</span>
              )}
              {ev.ip_address && geo && <span className="mx-1">·</span>}
              {geo && <span>{geo}</span>}
              {trackingMeta?.timezone && (
                <span className="ml-1 text-ink-400">
                  · {trackingMeta.timezone}
                </span>
              )}
            </p>
          )}
        {ev.kind === "failed" && ev.error_message && (
          <p
            className="mt-1 truncate font-mono text-[11px] text-rose-700"
            title={ev.error_message}
          >
            {ev.error_message}
          </p>
        )}
        {ev.kind === "created" &&
          ev.retries != null &&
          ev.retries > 0 && (
            <p className="mt-0.5 text-[10.5px] text-ink-500">
              {ev.retries}× wiederholt
            </p>
          )}
      </div>
    </li>
  );
}
