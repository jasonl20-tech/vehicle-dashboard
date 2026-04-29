/**
 * Email Logs (Versand-Log) — STRIKT READ-ONLY.
 *
 * Quelle: Tabelle `email_jobs` in `env.website` (Cloudflare D1).
 * Geschrieben wird sie ausschließlich vom externen Mail-Worker; das
 * Dashboard zeigt sie nur an. Es gibt bewusst keine Bearbeitungs-,
 * Lösch- oder Retry-Aktionen in dieser UI.
 *
 * Layout: SplitView analog zu Customer Keys / Email Templates.
 *  - Links: kollabierbare Liste mit Suche, Status-Filter und Statistik-
 *    Kacheln, scrollbar.
 *  - Rechts: Detail-Panel mit allen Feldern, Recipient-JSON pretty-
 *    formatted, optional rohem `custom_body_html` als `<pre>`-Block.
 *
 * Persistenz: aside-collapse + Status-Filter in localStorage.
 */
import {
  AlertCircle,
  CheckCircle2,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  Code2,
  Copy,
  ExternalLink,
  Loader2,
  Mail,
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
import { useOutletContext, useSearchParams } from "react-router-dom";
import type { DashboardOutletContext } from "../components/layout/dashboardOutletContext";
import { useApi, fmtNumber } from "../lib/customerApi";
import {
  EMAIL_JOB_STATUSES,
  emailJobUrl,
  emailJobsListUrl,
  parseRecipientData,
  recipientSummary,
  statusBadge,
  type EmailJobFull,
  type EmailJobStatus,
  type EmailJobsListResponse,
} from "../lib/emailJobsApi";

const PAGE_SIZE = 200;
const ASIDE_KEY = "ui.emailLogs.asideCollapsed";
const STATUS_KEY = "ui.emailLogs.status";

const noopSetHeader: DashboardOutletContext["setHeaderTrailing"] = () => {};

function readAsideCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(ASIDE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeAsideCollapsed(v: boolean): void {
  try {
    window.localStorage.setItem(ASIDE_KEY, v ? "1" : "0");
  } catch {
    // bewusst leer
  }
}

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
    // bewusst leer
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
    year: "numeric",
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
  if (sec < 0) {
    const inSec = -sec;
    if (inSec < 60) return `in ${inSec}s`;
    if (inSec < 3600) return `in ${Math.round(inSec / 60)} Min.`;
    if (inSec < 86400) return `in ${Math.round(inSec / 3600)} Std.`;
    return `in ${Math.round(inSec / 86400)} Tagen`;
  }
  if (sec < 60) return `vor ${sec}s`;
  if (sec < 3600) return `vor ${Math.round(sec / 60)} Min.`;
  if (sec < 86400) return `vor ${Math.round(sec / 3600)} Std.`;
  return `vor ${Math.round(sec / 86400)} Tagen`;
}

function StatusIcon({ status }: { status: string }) {
  const s = status.toLowerCase();
  if (s === "sent") return <CheckCircle2 className="h-3.5 w-3.5" />;
  if (s === "failed") return <AlertCircle className="h-3.5 w-3.5" />;
  if (s === "processing") return <Send className="h-3.5 w-3.5" />;
  if (s === "pending") return <Clock className="h-3.5 w-3.5" />;
  return <Mail className="h-3.5 w-3.5" />;
}

function StatusPill({ status }: { status: string }) {
  const b = statusBadge(status);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10.5px] font-medium ${b.className}`}
    >
      <StatusIcon status={status} />
      {b.label}
    </span>
  );
}

const STATUS_FILTER_OPTIONS: {
  value: EmailJobStatus | "";
  label: string;
}[] = [
  { value: "", label: "Alle" },
  { value: "sent", label: "Gesendet" },
  { value: "failed", label: "Fehlgeschlagen" },
  { value: "pending", label: "Wartend" },
  { value: "processing", label: "Verarbeitung" },
];

export default function EmailLogsPage() {
  const ctx = useOutletContext<DashboardOutletContext | undefined>();
  const setHeaderTrailing = ctx?.setHeaderTrailing ?? noopSetHeader;
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get("id") ?? "";

  // ---- Aside collapsible ----
  const [asideCollapsed, setAsideCollapsed] =
    useState<boolean>(readAsideCollapsed);
  const toggleAside = useCallback(() => {
    setAsideCollapsed((v) => {
      const next = !v;
      writeAsideCollapsed(next);
      return next;
    });
  }, []);

  // ---- Filter ----
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

  const listUrl = useMemo(
    () =>
      emailJobsListUrl({
        q,
        status: status || undefined,
        limit: PAGE_SIZE,
      }),
    [q, status],
  );
  const list = useApi<EmailJobsListResponse>(listUrl);

  // ---- Selektierter Job (lädt Detail mit raw HTML) ----
  const detailUrl = selectedId ? emailJobUrl(selectedId) : null;
  const detail = useApi<EmailJobFull>(detailUrl);

  // ---- Header-Toolbar (Reload + Status-Filter) ----
  const headerToolbar = useMemo(
    () => (
      <div className="flex min-w-0 w-full flex-1 items-center justify-end gap-1.5">
        <span className="hidden truncate text-[11.5px] tabular-nums text-night-500 sm:block">
          Read-only · vom Mail-Worker geschrieben
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
          onClick={() => {
            list.reload();
            if (detailUrl) detail.reload();
          }}
          disabled={list.loading || detail.loading}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/[0.1] bg-white/[0.04] text-night-200 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-50"
          title="Neu laden"
        >
          <RefreshCw
            className={`h-4 w-4 ${list.loading || detail.loading ? "animate-spin" : ""}`}
          />
        </button>
      </div>
    ),
    [status, list, detail, detailUrl],
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
          className="shrink-0 border-b border-accent-rose/30 bg-accent-rose/10 px-3 py-1.5 text-[12.5px] text-accent-rose sm:px-5"
          role="alert"
        >
          {list.error}
        </p>
      )}
      {list.data?.hint && !list.error && (
        <p
          className="shrink-0 border-b border-accent-amber/40 bg-accent-amber/10 px-3 py-1.5 text-[12.5px] text-accent-amber sm:px-5"
          role="status"
        >
          {list.data.hint}
        </p>
      )}

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {asideCollapsed ? (
          <button
            type="button"
            onClick={toggleAside}
            title="Liste einblenden"
            aria-label="Email-Logs Liste einblenden"
            aria-expanded={false}
            className="group flex h-10 w-full shrink-0 items-center justify-center gap-1.5 border-b border-hair bg-ink-50 text-[11px] font-medium uppercase tracking-[0.12em] text-ink-700 transition hover:bg-ink-100 hover:text-ink-900 md:h-auto md:w-10 md:flex-col md:gap-2 md:border-b-0 md:border-r md:py-3 md:text-[10px]"
          >
            <ChevronsRight className="h-4 w-4 shrink-0" />
            <span className="md:[writing-mode:vertical-rl] md:[transform:rotate(180deg)]">
              Logs
            </span>
          </button>
        ) : (
          <aside className="flex w-full shrink-0 flex-col border-b border-hair bg-white md:w-[360px] md:border-b-0 md:border-r">
            <div className="shrink-0 border-b border-hair p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-500">
                  Email Logs
                </p>
                <button
                  type="button"
                  onClick={toggleAside}
                  title="Liste einklappen"
                  aria-label="Email-Logs Liste einklappen"
                  aria-expanded
                  className="hidden h-6 w-6 items-center justify-center rounded text-ink-400 transition hover:bg-ink-100 hover:text-ink-700 md:inline-flex"
                >
                  <ChevronsLeft className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-hair bg-paper/60 px-2.5 py-1.5">
                <Search className="h-3.5 w-3.5 shrink-0 text-ink-400" />
                <input
                  type="search"
                  value={qIn}
                  onChange={(e) => setQIn(e.target.value)}
                  placeholder="id, Betreff, Empfänger…"
                  className="min-w-0 flex-1 border-0 bg-transparent text-[12.5px] text-ink-900 placeholder:text-ink-400 focus:outline-none"
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

              {/* Status-Filter — auch im Aside (für Mobile + zur Sicherheit) */}
              <div className="mt-2 grid grid-cols-5 gap-1 sm:hidden">
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

              {/* Status-Statistik */}
              <div className="mt-2 grid grid-cols-4 gap-1.5">
                {(
                  [
                    { key: "sent", label: "Gesendet" },
                    { key: "pending", label: "Wartend" },
                    { key: "processing", label: "Verarb." },
                    { key: "failed", label: "Fehler" },
                  ] as { key: EmailJobStatus; label: string }[]
                ).map((s) => (
                  <div
                    key={s.key}
                    className="rounded-md border border-hair bg-paper/40 px-2 py-1.5"
                    title={`${s.label}: ${fmtNumber(counts[s.key] ?? 0)}`}
                  >
                    <p className="text-[9.5px] uppercase tracking-[0.14em] text-ink-500">
                      {s.label}
                    </p>
                    <p className="mt-0.5 text-[14px] font-semibold tabular-nums text-ink-900">
                      {fmtNumber(counts[s.key] ?? 0)}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-2 flex items-center justify-between text-[11px] tabular-nums text-ink-500">
                <span>
                  {fmtNumber(total)} Jobs
                  {q || status ? ` · ${rows.length} Treffer` : ""}
                </span>
                {list.loading && <Loader2 className="h-3 w-3 animate-spin" />}
              </div>
            </div>

            <ul className="min-h-0 flex-1 divide-y divide-hair overflow-y-auto">
              {!list.loading && rows.length === 0 && (
                <li className="px-4 py-8 text-center text-[12.5px] text-ink-500">
                  Keine Jobs für diese Filter.
                </li>
              )}
              {rows.map((r) => {
                const active = r.id === selectedId;
                const recipient = recipientSummary(r.recipient_data);
                const subject =
                  r.custom_subject?.trim() ||
                  (r.template_id
                    ? `Template: ${r.template_id}`
                    : "Ohne Betreff");
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => setSearchParams({ id: r.id })}
                      className={`flex w-full items-start gap-2 px-3 py-2 text-left transition ${
                        active ? "bg-ink-50/70" : "hover:bg-ink-50/50"
                      }`}
                    >
                      <span className="mt-0.5 shrink-0">
                        <StatusPill status={r.status} />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span
                          className={`block max-w-full truncate text-[12.5px] ${
                            active
                              ? "font-medium text-ink-900"
                              : "text-ink-800"
                          }`}
                          title={subject}
                        >
                          {subject}
                        </span>
                        <span
                          className="mt-0.5 block max-w-full truncate text-[11.5px] text-ink-500"
                          title={recipient}
                        >
                          {recipient}
                        </span>
                        <span className="mt-1 flex items-center gap-2 text-[10.5px] tabular-nums text-ink-400">
                          <span title={fmtWhen(r.created_at)}>
                            {fmtRelative(r.sent_at || r.created_at)}
                          </span>
                          {r.template_id && (
                            <span
                              className="truncate font-mono"
                              title={`Template: ${r.template_id}`}
                            >
                              · {r.template_id}
                            </span>
                          )}
                          {r.retries > 0 && (
                            <span
                              className="text-accent-amber"
                              title={`${r.retries} Wiederholungen`}
                            >
                              · ⟳ {r.retries}
                            </span>
                          )}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>
        )}

        {/* Rechter Bereich: Detail */}
        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          {selectedId ? (
            <DetailPanel
              loading={detail.loading}
              error={detail.error}
              job={detail.data}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-10 text-center">
              <Mail className="h-8 w-8 text-ink-300" />
              <p className="text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-400">
                Kein Job ausgewählt
              </p>
              <p className="max-w-sm text-[13px] leading-relaxed text-ink-500">
                Wähle links einen Job, um die Empfänger-Daten, den Status
                und ggf. den rohen Email-Body einzusehen. Bearbeiten ist
                hier nicht möglich — die Tabelle wird ausschließlich vom
                externen Mail-Worker gepflegt.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

// ─── Detail-Panel ────────────────────────────────────────────────────

function DetailPanel({
  loading,
  error,
  job,
}: {
  loading: boolean;
  error: string | null;
  job: EmailJobFull | null;
}) {
  const [showRawBody, setShowRawBody] = useState(false);

  if (loading && !job) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="inline-flex items-center gap-2 text-[12.5px] text-ink-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Lade Job…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <p
          className="rounded-lg border border-accent-rose/30 bg-accent-rose/10 px-4 py-3 text-[12.5px] text-accent-rose"
          role="alert"
        >
          {error}
        </p>
      </div>
    );
  }

  if (!job) return null;

  const recipient = parseRecipientData(job.recipient_data);
  const recipientPretty = recipient
    ? JSON.stringify(recipient, null, 2)
    : (job.recipient_data ?? "");

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto bg-paper">
      {/* Header */}
      <div className="shrink-0 border-b border-hair bg-white px-4 py-3 sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={job.status} />
              {job.retries > 0 && (
                <span
                  className="inline-flex items-center gap-1 rounded-full border border-accent-amber/30 bg-accent-amber/10 px-1.5 py-0.5 text-[10.5px] font-medium text-accent-amber"
                  title="Anzahl Wiederholungen"
                >
                  ⟳ {job.retries}× wiederholt
                </span>
              )}
            </div>
            <h2 className="mt-1.5 truncate text-[16px] font-semibold text-ink-900">
              {job.custom_subject?.trim() ||
                (job.template_id ? `Template: ${job.template_id}` : "Ohne Betreff")}
            </h2>
            <p
              className="mt-0.5 truncate font-mono text-[11.5px] text-ink-500"
              title={job.id}
            >
              {job.id}
            </p>
          </div>
          <CopyButton value={job.id} title="ID kopieren" />
        </div>
      </div>

      {/* Felder-Grid */}
      <div className="grid shrink-0 grid-cols-1 gap-x-6 gap-y-3 border-b border-hair bg-white px-4 py-4 sm:grid-cols-2 sm:px-6">
        <Field label="Von" value={job.from_email || "—"} mono />
        <Field
          label="Template"
          value={job.template_id || "—"}
          mono
          extra={
            job.template_id ? (
              <a
                href={`/emails/templates?id=${encodeURIComponent(job.template_id)}`}
                className="ml-1 inline-flex items-center text-ink-500 hover:text-ink-900"
                title="Template öffnen"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : null
          }
        />
        <Field label="Erstellt" value={fmtWhen(job.created_at)} />
        <Field label="Geplant" value={fmtWhen(job.scheduled_at)} />
        <Field label="Gesendet" value={fmtWhen(job.sent_at)} />
        <Field
          label="Custom HTML-Body"
          value={
            job.custom_body_html
              ? `${job.custom_body_html.length.toLocaleString("de-DE")} Zeichen`
              : "—"
          }
        />
      </div>

      {/* Fehler */}
      {job.error_message && (
        <div className="shrink-0 border-b border-accent-rose/20 bg-accent-rose/5 px-4 py-3 sm:px-6">
          <p className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-accent-rose">
            Fehler
          </p>
          <pre className="mt-1.5 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md border border-accent-rose/20 bg-white/60 p-2.5 font-mono text-[11.5px] leading-relaxed text-ink-900">
            {job.error_message}
          </pre>
        </div>
      )}

      {/* Empfänger-Daten */}
      <div className="shrink-0 border-b border-hair bg-white px-4 py-3 sm:px-6">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-500">
            Empfänger / Variablen
          </p>
          <CopyButton value={recipientPretty} title="JSON kopieren" />
        </div>
        <pre className="mt-1.5 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-md border border-hair bg-paper/40 p-2.5 font-mono text-[11.5px] leading-relaxed text-ink-900">
          {recipientPretty || "—"}
        </pre>
      </div>

      {/* Custom Body HTML — optional, da potenziell groß */}
      {job.custom_body_html && (
        <div className="border-b border-hair bg-white px-4 py-3 sm:px-6">
          <div className="flex items-center justify-between gap-2">
            <p className="inline-flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-500">
              <Code2 className="h-3 w-3" />
              Custom Body (HTML)
            </p>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowRawBody((v) => !v)}
                className="rounded-md border border-hair bg-white px-2 py-1 text-[11.5px] text-ink-700 hover:bg-ink-50"
              >
                {showRawBody ? "Ausblenden" : "Raw anzeigen"}
              </button>
              <CopyButton value={job.custom_body_html} title="HTML kopieren" />
            </div>
          </div>
          {showRawBody && (
            <pre className="mt-1.5 max-h-[40vh] overflow-auto whitespace-pre-wrap break-all rounded-md border border-hair bg-ink-900 p-2.5 font-mono text-[11.5px] leading-relaxed text-ink-100">
              {job.custom_body_html}
            </pre>
          )}
        </div>
      )}

      {/* Footer-Hinweis */}
      <div className="px-4 py-3 text-[11.5px] text-ink-400 sm:px-6">
        Diese Ansicht ist read-only. Status, Retries und Versand werden
        ausschließlich vom externen Mail-Worker gepflegt.
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  mono = false,
  extra,
}: {
  label: string;
  value: string;
  mono?: boolean;
  extra?: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-500">
        {label}
      </p>
      <p
        className={`mt-0.5 truncate text-[12.5px] text-ink-900 ${
          mono ? "font-mono" : ""
        }`}
        title={value}
      >
        {value}
        {extra}
      </p>
    </div>
  );
}

function CopyButton({
  value,
  title,
}: {
  value: string;
  title: string;
}) {
  const [copied, setCopied] = useState(false);
  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignore
    }
  }, [value]);
  return (
    <button
      type="button"
      onClick={onCopy}
      title={title}
      className="inline-flex h-7 items-center gap-1 rounded-md border border-hair bg-white px-2 text-[11.5px] text-ink-700 transition hover:bg-ink-50 hover:text-ink-900"
    >
      <Copy className="h-3 w-3" />
      {copied ? "Kopiert" : "Kopieren"}
    </button>
  );
}
