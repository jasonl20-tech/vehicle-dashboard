/**
 * Email Logs — einfache, suchbare Job-Tabelle.
 *
 * Quelle: `email_jobs` (read-only, vom externen Mail-Worker geschrieben)
 * mit Tracking-Aggregaten (Opens / Clicks pro Job) per LEFT JOIN auf
 * `email_tracking`. Klick auf eine Zeile öffnet die Detail-Seite
 * `/dashboard/emails/logs/:id` mit Timeline & Charts pro Job.
 */
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Eye,
  Loader2,
  Mail,
  MousePointerClick,
  RefreshCw,
  Search,
  Send,
  X,
} from "lucide-react";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import type { DashboardOutletContext } from "../components/layout/dashboardOutletContext";
import { CountUp, SkeletonRows } from "../components/Premium";
import { useApi } from "../lib/customerApi";
import {
  EMAIL_JOB_STATUSES,
  emailJobsListUrl,
  recipientSummary,
  statusBadge,
  type EmailJobRow,
  type EmailJobStatus,
  type EmailJobsListResponse,
} from "../lib/emailJobsApi";

const PAGE_SIZE = 200;
const STATUS_KEY = "ui.emailLogs.status";

const noopSetHeader: DashboardOutletContext["setHeaderTrailing"] = () => {};

function readStatus(): EmailJobStatus | "" {
  if (typeof window === "undefined") return "";
  try {
    const v = window.localStorage.getItem(STATUS_KEY) || "";
    return (EMAIL_JOB_STATUSES as readonly string[]).includes(v)
      ? (v as EmailJobStatus)
      : "";
  } catch {
    return "";
  }
}

function writeStatus(v: EmailJobStatus | ""): void {
  try {
    window.localStorage.setItem(STATUS_KEY, v);
  } catch {
    // ignore
  }
}

function fmtWhen(s: string | null | undefined): string {
  if (!s?.trim()) return "—";
  const raw = s.trim();
  const t = raw.includes("T")
    ? Date.parse(raw)
    : Date.parse(raw.replace(" ", "T") + "Z");
  if (Number.isNaN(t)) return s;
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(t));
}

function fmtRelative(s: string | null | undefined): string {
  if (!s?.trim()) return "—";
  const raw = s.trim();
  const t = raw.includes("T")
    ? Date.parse(raw)
    : Date.parse(raw.replace(" ", "T") + "Z");
  if (Number.isNaN(t)) return "—";
  const diff = Date.now() - t;
  const sec = Math.round(diff / 1000);
  if (sec < 60) return `vor ${sec}s`;
  if (sec < 3600) return `vor ${Math.round(sec / 60)} Min.`;
  if (sec < 86400) return `vor ${Math.round(sec / 3600)} Std.`;
  return `vor ${Math.round(sec / 86400)} Tagen`;
}

function StatusIcon({ status }: { status: string }) {
  const s = status.toLowerCase();
  if (s === "sent") return <CheckCircle2 className="h-3 w-3" />;
  if (s === "failed") return <AlertCircle className="h-3 w-3" />;
  if (s === "processing") return <Send className="h-3 w-3" />;
  if (s === "pending") return <Clock className="h-3 w-3" />;
  return <Mail className="h-3 w-3" />;
}

const STATUS_FILTER_OPTIONS: {
  value: EmailJobStatus | "";
  label: string;
}[] = [
  { value: "", label: "Alle" },
  { value: "sent", label: "Gesendet" },
  { value: "failed", label: "Fehler" },
  { value: "pending", label: "Wartend" },
  { value: "processing", label: "Verarb." },
];

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

  const [status, setStatus] = useState<EmailJobStatus | "">(readStatus);
  useEffect(() => {
    writeStatus(status);
  }, [status]);

  const url = useMemo(
    () =>
      emailJobsListUrl({
        q,
        status: status || undefined,
        limit: PAGE_SIZE,
      }),
    [q, status],
  );
  const list = useApi<EmailJobsListResponse>(url);

  const headerToolbar = useMemo(
    () => (
      <div className="flex min-w-0 w-full flex-1 items-center justify-end gap-1.5">
        <span className="hidden truncate text-[11.5px] tabular-nums text-night-500 md:block">
          Read-only · vom Mail-Worker
        </span>
        <div
          role="tablist"
          aria-label="Status"
          className="hidden items-center gap-0.5 rounded-md border border-white/[0.1] bg-white/[0.03] p-0.5 sm:inline-flex"
        >
          {STATUS_FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value || "all"}
              type="button"
              role="tab"
              aria-selected={status === opt.value}
              onClick={() => setStatus(opt.value)}
              className={`rounded px-2 py-1 text-[11.5px] transition ${
                status === opt.value
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
          onClick={() => list.reload()}
          disabled={list.loading}
          className="press inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/[0.1] bg-white/[0.04] text-night-200 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-50"
          title="Neu laden"
        >
          <RefreshCw
            className={`h-4 w-4 ${list.loading ? "animate-spin" : ""}`}
          />
        </button>
      </div>
    ),
    [status, list],
  );

  useLayoutEffect(() => {
    setHeaderTrailing(headerToolbar);
    return () => setHeaderTrailing(null);
  }, [setHeaderTrailing, headerToolbar]);

  const rows = list.data?.rows ?? [];
  const total = list.data?.total ?? 0;
  const counts = list.data?.statusCounts ?? {};

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-paper">
      {list.error && (
        <p
          className="shrink-0 border-b border-rose-500/30 bg-rose-500/10 px-4 py-1.5 text-[12.5px] text-rose-700"
          role="alert"
        >
          {list.error}
        </p>
      )}
      {list.data?.hint && !list.error && (
        <p
          className="shrink-0 border-b border-amber-500/40 bg-amber-500/10 px-4 py-1.5 text-[12.5px] text-amber-700"
          role="status"
        >
          {list.data.hint}
        </p>
      )}

      {/* Toolbar */}
      <div className="shrink-0 glass-paper border-b border-hair px-3 py-2 sm:px-5 animate-fade-down">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-hair bg-paper/60 px-2.5 py-1.5 transition focus-within:border-ink-400 focus-within:bg-white focus-within:shadow-[0_0_0_3px_rgba(13,13,15,0.05)]">
            <Search className="h-3.5 w-3.5 shrink-0 text-ink-400 transition-colors group-focus-within:text-ink-700" />
            <input
              type="search"
              value={qIn}
              onChange={(e) => setQIn(e.target.value)}
              placeholder="Suche: id, Betreff, Empfänger, Fehler…"
              className="min-w-0 flex-1 border-0 bg-transparent text-[13px] text-ink-900 placeholder:text-ink-400 focus:outline-none"
            />
            {qIn && (
              <button
                type="button"
                onClick={() => setQIn("")}
                className="press text-ink-400 transition hover:text-ink-700"
                title="Suche leeren"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Mobile status filter */}
          <div className="grid w-full grid-cols-5 gap-1 sm:hidden">
            {STATUS_FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value || "all"}
                type="button"
                onClick={() => setStatus(opt.value)}
                className={`rounded px-1 py-1 text-[10.5px] transition ${
                  status === opt.value
                    ? "bg-ink-900 text-white"
                    : "border border-hair bg-white text-ink-600 hover:text-ink-900"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 text-[11.5px] tabular-nums text-ink-500">
            <span>
              <CountUp value={total} className="text-ink-700" /> gesamt
              {(q || status) && (
                <>
                  <span className="mx-1.5 text-ink-300">·</span>
                  <CountUp value={rows.length} className="text-ink-700" /> Treffer
                </>
              )}
            </span>
            {(["sent", "pending", "processing", "failed"] as const).map((s) => (
              <span key={s} className="hidden items-center md:inline-flex">
                <span
                  className={`mr-1 inline-block h-2 w-2 rounded-full ${
                    s === "sent"
                      ? "bg-emerald-500"
                      : s === "pending"
                        ? "bg-amber-500 animate-pulse-soft text-amber-500"
                        : s === "processing"
                          ? "bg-sky-500 animate-pulse-soft text-sky-500"
                          : "bg-rose-500"
                  }`}
                />
                <CountUp value={counts[s] ?? 0} />
              </span>
            ))}
            {list.loading && <Loader2 className="h-3 w-3 animate-spin" />}
          </div>
        </div>
      </div>

      {/* Tabelle */}
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full border-separate border-spacing-0 text-left text-[12.5px]">
          <thead className="sticky top-0 z-10 glass-paper bg-ink-50/95">
            <tr className="text-[10px] uppercase tracking-[0.12em] text-ink-500">
              <th className="border-b border-hair px-3 py-2 font-medium">Status</th>
              <th className="border-b border-hair px-3 py-2 font-medium">Wann</th>
              <th className="border-b border-hair px-3 py-2 font-medium">Empfänger</th>
              <th className="border-b border-hair px-3 py-2 font-medium">Betreff</th>
              <th className="border-b border-hair px-3 py-2 font-medium">Template</th>
              <th className="border-b border-hair px-3 py-2 text-right font-medium">
                <Eye className="inline h-3 w-3 -mt-0.5" /> Opens
              </th>
              <th className="border-b border-hair px-3 py-2 text-right font-medium">
                <MousePointerClick className="inline h-3 w-3 -mt-0.5" /> Clicks
              </th>
            </tr>
          </thead>
          <tbody className="stagger-children">
            {list.loading && rows.length === 0 && (
              <SkeletonRows count={8} cols={7} />
            )}
            {!list.loading && rows.length === 0 && (
              <tr className="animate-fade-up">
                <td
                  colSpan={7}
                  className="px-4 py-12 text-center text-[12.5px] text-ink-400"
                >
                  Keine Jobs für diese Filter.
                </td>
              </tr>
            )}
            {rows.map((r, idx) => (
              <Row
                key={r.id}
                row={r}
                index={idx}
                onOpen={() =>
                  navigate(`/dashboard/emails/logs/${encodeURIComponent(r.id)}`)
                }
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Row({
  row,
  index,
  onOpen,
}: {
  row: EmailJobRow;
  index: number;
  onOpen: () => void;
}) {
  const recipient = recipientSummary(row.recipient_data, row.recipient_email);
  const subject =
    row.custom_subject?.trim() ||
    (row.template_id ? `Template: ${row.template_id}` : "Ohne Betreff");
  const b = statusBadge(row.status);
  // Stagger nur für die ersten Zeilen, damit später hinzu-paginierte
  // Einträge nicht endlos verzögert ankommen.
  const delay = index < 24 ? `${index * 18}ms` : "0ms";
  return (
    <tr
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen();
      }}
      tabIndex={0}
      style={{ animationDelay: delay }}
      className="group accent-on-hover animate-fade-up cursor-pointer text-ink-700 transition-colors hover:bg-ink-50/60 focus:bg-ink-50/60 focus:outline-none"
    >
      <td className="border-b border-hair px-3 py-2 align-middle">
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10.5px] font-medium ${b.className}`}
        >
          <StatusIcon status={row.status} />
          {b.label}
        </span>
      </td>
      <td
        className="whitespace-nowrap border-b border-hair px-3 py-2 align-middle text-ink-700 tabular-nums"
        title={fmtWhen(row.created_at)}
      >
        {fmtRelative(row.sent_at || row.created_at)}
      </td>
      <td className="max-w-[18rem] border-b border-hair px-3 py-2 align-middle">
        <span
          className="block truncate font-mono text-[12px] text-ink-800"
          title={row.recipient_email}
        >
          {row.recipient_email || "—"}
        </span>
        <span
          className="block truncate text-[10.5px] text-ink-400"
          title={recipient}
        >
          {recipient !== row.recipient_email ? recipient : ""}
        </span>
      </td>
      <td className="max-w-[24rem] border-b border-hair px-3 py-2 align-middle">
        <span className="block truncate text-ink-800" title={subject}>
          {subject}
        </span>
        {row.error_message && (
          <span
            className="mt-0.5 block truncate text-[10.5px] text-rose-600"
            title={row.error_message}
          >
            {row.error_message}
          </span>
        )}
      </td>
      <td className="border-b border-hair px-3 py-2 align-middle">
        <span
          className="block max-w-[10rem] truncate font-mono text-[11.5px] text-ink-500"
          title={row.template_id ?? ""}
        >
          {row.template_id || "—"}
        </span>
      </td>
      <td className="border-b border-hair px-3 py-2 text-right align-middle tabular-nums text-emerald-700">
        {row.open_count > 0 ? <CountUp value={row.open_count} /> : "—"}
      </td>
      <td className="border-b border-hair px-3 py-2 text-right align-middle tabular-nums text-sky-700">
        {row.click_count > 0 ? <CountUp value={row.click_count} /> : "—"}
      </td>
    </tr>
  );
}
