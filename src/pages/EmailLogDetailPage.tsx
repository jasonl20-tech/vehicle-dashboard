/**
 * Email-Log — Detailseite eines einzelnen Jobs.
 *
 * Route: /emails/logs/:id
 *
 * Layout (vertikal, ohne „Bubble"-Boxen):
 *   1) Kopf mit Status, Subject, Empfänger, Buttons (zurück / kopieren)
 *   2) Stamm-Daten als flache Definition-Liste
 *   3) Tracking-Verlauf als großer Recharts-AreaChart (opens vs. clicks
 *      pro Tag)
 *   4) Top-Listen (Links / Länder / Städte) als flache Bar-Grids
 *   5) Empfänger-JSON + (optional) Custom-HTML-Body
 *   6) Vertikale Timeline mit jedem Event (created/sent/failed/open/click)
 *      für genau diesen Job — geladen via `/api/emails/timeline?job_id=…`.
 */
import {
  AlertCircle,
  ArrowLeft,
  ChevronDown,
  Clock,
  Code2,
  Copy,
  ExternalLink,
  Eye,
  Loader2,
  Mail,
  MousePointerClick,
  RefreshCw,
  Send,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DashboardOutletContext } from "../components/layout/dashboardOutletContext";
import { useOutletContext } from "react-router-dom";
import { CountUp } from "../components/Premium";
import { fmtNumber, useApi } from "../lib/customerApi";
import {
  emailJobUrl,
  parseRecipientData,
  parseTrackingMetadata,
  statusBadge,
  type EmailJobFull,
} from "../lib/emailJobsApi";
import {
  emailTimelineUrl,
  type EmailTimelineEvent,
  type EmailTimelineKind,
  type EmailTimelineResponse,
} from "../lib/emailTimelineApi";

const noopSetHeader: DashboardOutletContext["setHeaderTrailing"] = () => {};
const TIMELINE_PAGE_SIZE = 200;

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
  if (sec < 60) return `vor ${sec}s`;
  if (sec < 3600) return `vor ${Math.round(sec / 60)} Min.`;
  if (sec < 86400) return `vor ${Math.round(sec / 3600)} Std.`;
  return `vor ${Math.round(sec / 86400)} Tagen`;
}

export default function EmailLogDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const ctx = useOutletContext<DashboardOutletContext | undefined>();
  const setHeaderTrailing = ctx?.setHeaderTrailing ?? noopSetHeader;

  const url = id ? emailJobUrl(id) : null;
  const job = useApi<EmailJobFull>(url);

  const headerToolbar = useMemo(
    () => (
      <div className="flex min-w-0 w-full flex-1 items-center justify-end gap-1.5">
        <Link
          to="/emails/logs"
          className="inline-flex items-center gap-1 rounded-md border border-white/[0.1] bg-white/[0.04] px-2.5 py-1.5 text-[12px] text-night-200 transition hover:bg-white/[0.08] hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Zurück zur Liste
        </Link>
        <button
          type="button"
          onClick={() => job.reload()}
          disabled={job.loading}
          className="press inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/[0.1] bg-white/[0.04] text-night-200 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-50"
          title="Neu laden"
        >
          <RefreshCw className={`h-4 w-4 ${job.loading ? "animate-spin" : ""}`} />
        </button>
      </div>
    ),
    [job],
  );

  useLayoutEffect(() => {
    setHeaderTrailing(headerToolbar);
    return () => setHeaderTrailing(null);
  }, [setHeaderTrailing, headerToolbar]);

  if (!id) {
    navigate("/emails/logs", { replace: true });
    return null;
  }

  if (job.loading && !job.data) {
    return (
      <div className="flex h-full items-center justify-center bg-paper">
        <p className="inline-flex items-center gap-2 text-[12.5px] text-ink-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Lade Job…
        </p>
      </div>
    );
  }

  if (job.error) {
    return (
      <div className="flex h-full items-center justify-center bg-paper px-6">
        <div className="max-w-md text-center">
          <p className="rounded-md border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-[12.5px] text-rose-700">
            {job.error}
          </p>
          <Link
            to="/emails/logs"
            className="mt-4 inline-flex items-center gap-1 rounded-md border border-hair bg-white px-3 py-1.5 text-[12.5px] text-ink-700 hover:bg-ink-50"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Zurück zur Liste
          </Link>
        </div>
      </div>
    );
  }

  if (!job.data) return null;
  const j = job.data;
  const tr = j.tracking;
  const recipient = parseRecipientData(j.recipient_data);
  const recipientPretty = recipient
    ? JSON.stringify(recipient, null, 2)
    : (j.recipient_data ?? "");
  const subject =
    j.custom_subject?.trim() ||
    (j.template_id ? `Template: ${j.template_id}` : "Ohne Betreff");
  const b = statusBadge(j.status);

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-y-auto bg-paper">
      {/* Header */}
      <header className="aurora-backdrop relative overflow-hidden border-b border-hair px-4 py-6 sm:px-8 sm:py-7 animate-fade-down">
        <div className="flex items-start gap-3">
          <span
            className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${b.className}`}
          >
            <Mail className="h-3 w-3" />
            {b.label}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[22px] font-semibold tracking-tight text-ink-900">
              {subject}
            </h1>
            <p className="mt-0.5 truncate font-mono text-[11.5px] text-ink-400" title={j.id}>
              {j.id}
            </p>
          </div>
          <CopyButton value={j.id} title="ID kopieren" />
        </div>

        {/* Flache Stamm-Daten — kein Card-Look */}
        <dl className="stagger-children mt-5 grid grid-cols-2 gap-x-6 gap-y-3 text-[12.5px] sm:grid-cols-4 lg:grid-cols-6">
          <DT label="Empfänger" mono>
            {j.recipient_email || "—"}
          </DT>
          <DT label="Absender" mono>
            {j.from_name ? `${j.from_name} <${j.from_email}>` : j.from_email}
          </DT>
          <DT label="Template" mono>
            {j.template_id ? (
              <Link
                to={`/emails/templates?id=${encodeURIComponent(j.template_id)}`}
                className="inline-flex items-center gap-1 text-ink-800 hover:underline"
              >
                {j.template_id}
                <ExternalLink className="h-3 w-3 text-ink-400" />
              </Link>
            ) : (
              "—"
            )}
          </DT>
          <DT label="Erstellt" title={fmtWhen(j.created_at)}>
            {fmtRelative(j.created_at)}
          </DT>
          <DT label="Geplant" title={fmtWhen(j.scheduled_at)}>
            {fmtRelative(j.scheduled_at)}
          </DT>
          <DT label="Gesendet" title={fmtWhen(j.sent_at)}>
            {fmtRelative(j.sent_at)}
          </DT>
          <DT label="Tracking-ID" mono>
            {j.tracking_id || "—"}
          </DT>
          <DT label="Retries">{j.retries > 0 ? `${j.retries}×` : "—"}</DT>
          <DT label="Custom Body">
            {j.custom_body_html
              ? `${j.custom_body_html.length.toLocaleString("de-DE")} Zeichen`
              : "—"}
          </DT>
          <DT label="Opens" tone="emerald">
            <CountUp value={tr.open_count} className="tabular-nums" />
            {tr.unique_open_count !== tr.open_count && (
              <span className="ml-1 text-[10.5px] text-ink-400">
                · <CountUp value={tr.unique_open_count} /> unique
              </span>
            )}
          </DT>
          <DT label="Clicks" tone="sky">
            <CountUp value={tr.click_count} className="tabular-nums" />
            {tr.unique_click_count !== tr.click_count && (
              <span className="ml-1 text-[10.5px] text-ink-400">
                · <CountUp value={tr.unique_click_count} /> unique
              </span>
            )}
          </DT>
          <DT label="Distinct IPs">
            <CountUp value={tr.unique_ip_count} />
          </DT>
        </dl>

        {j.error_message && (
          <p className="mt-4 border-l-2 border-rose-500 bg-rose-500/5 px-3 py-2 font-mono text-[12px] text-rose-700">
            {j.error_message}
          </p>
        )}
      </header>

      {/* Verlauf */}
      <section className="border-b border-hair bg-white px-4 py-5 sm:px-8 animate-fade-up">
        <SectionHeading
          title="Verlauf"
          subtitle="Opens & Clicks pro Tag"
          right={
            <div className="flex items-center gap-3 text-[11px] text-ink-500">
              {tr.first_open_at && (
                <span>Erste Öffnung · {fmtWhen(tr.first_open_at)}</span>
              )}
              {tr.last_event_at && (
                <span>Letztes Event · {fmtRelative(tr.last_event_at)}</span>
              )}
            </div>
          }
        />
        <div className="mt-3">
          <DayChart points={tr.events_by_day} />
        </div>
      </section>

      {/* Top-Listen */}
      {(tr.top_links.length > 0 ||
        tr.top_countries.length > 0 ||
        tr.top_cities.length > 0) && (
        <section className="border-b border-hair bg-white px-4 py-5 sm:px-8 animate-fade-up">
          <SectionHeading title="Auswertung" subtitle="Top Links · Länder · Städte" />
          <div className="mt-3 grid grid-cols-1 gap-x-8 gap-y-6 lg:grid-cols-3">
            {tr.top_links.length > 0 && (
              <FlatTopList
                title="Top Links"
                items={tr.top_links.map((l) => ({
                  label: l.link_url,
                  count: l.count,
                  href: l.link_url,
                }))}
              />
            )}
            {tr.top_countries.length > 0 && (
              <FlatTopList
                title="Top Länder"
                items={tr.top_countries.map((c) => ({
                  label: c.country,
                  count: c.count,
                }))}
              />
            )}
            {tr.top_cities.length > 0 && (
              <FlatTopList
                title="Top Städte"
                items={tr.top_cities.map((c) => ({
                  label: c.country ? `${c.city} · ${c.country}` : c.city,
                  count: c.count,
                }))}
              />
            )}
          </div>
        </section>
      )}

      {/* Empfänger-Daten */}
      <section className="border-b border-hair bg-white px-4 py-5 sm:px-8 animate-fade-up">
        <div className="flex items-center justify-between gap-2">
          <SectionHeading title="Empfänger / Variablen" subtitle="recipient_data (JSON)" />
          <CopyButton value={recipientPretty} title="JSON kopieren" />
        </div>
        <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words border-l-2 border-hair bg-ink-50/40 px-3 py-2 font-mono text-[11.5px] leading-relaxed text-ink-900">
          {recipientPretty || "—"}
        </pre>
      </section>

      {/* Custom Body */}
      {j.custom_body_html && <CustomBodySection html={j.custom_body_html} />}

      {/* Timeline */}
      <section className="border-b border-hair bg-white px-4 py-5 sm:px-8 animate-fade-up">
        <SectionHeading
          title="Timeline"
          subtitle="Lifecycle + jedes Open/Click chronologisch"
        />
        <JobTimeline jobId={j.id} />
      </section>

      <footer className="px-4 py-4 text-[11.5px] text-ink-400 sm:px-8">
        Read-only. Status, Retries, Versand und tracking_id werden vom externen
        Mail-Worker gepflegt; Tracking-Events kommen vom Pixel-/Click-Worker.
      </footer>
    </div>
  );
}

// ─── Bausteine ───────────────────────────────────────────────────────

function SectionHeading({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div>
        <h2 className="text-[13px] font-semibold tracking-tight text-ink-900">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-0.5 text-[11.5px] text-ink-500">{subtitle}</p>
        )}
      </div>
      {right}
    </div>
  );
}

function DT({
  label,
  children,
  mono = false,
  title,
  tone,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
  title?: string;
  tone?: "emerald" | "sky";
}) {
  const toneClass =
    tone === "emerald"
      ? "text-emerald-700"
      : tone === "sky"
        ? "text-sky-700"
        : "text-ink-900";
  return (
    <div className="min-w-0 animate-fade-up">
      <dt className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink-400">
        {label}
      </dt>
      <dd
        className={`mt-0.5 truncate ${
          mono ? "font-mono text-[12px]" : "text-[12.5px]"
        } ${toneClass}`}
        title={title}
      >
        {children}
      </dd>
    </div>
  );
}

function CopyButton({ value, title }: { value: string; title: string }) {
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

function DayChart({
  points,
}: {
  points: { day: string; opens: number; clicks: number }[];
}) {
  const data = points.map((p) => ({
    day: p.day,
    label: p.day.slice(5).replace("-", "."),
    opens: p.opens,
    clicks: p.clicks,
  }));
  if (data.length === 0) {
    return (
      <p className="border-l-2 border-hair bg-ink-50/40 px-3 py-6 text-[12px] text-ink-400">
        Noch keine Tracking-Events.
      </p>
    );
  }
  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
          <defs>
            <linearGradient id="gOpens" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(165 55% 42%)" stopOpacity={0.55} />
              <stop offset="100%" stopColor="hsl(165 55% 42%)" stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="gClicks" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(214 75% 52%)" stopOpacity={0.55} />
              <stop offset="100%" stopColor="hsl(214 75% 52%)" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="hsl(220 14% 92%)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={{ stroke: "hsl(220 14% 90%)" }}
            tick={{ fontSize: 11, fill: "hsl(220 8% 45%)" }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "hsl(220 8% 45%)" }}
            allowDecimals={false}
            width={32}
          />
          <Tooltip
            contentStyle={{
              fontSize: 12,
              borderRadius: 6,
              border: "1px solid hsl(220 14% 90%)",
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} iconSize={8} />
          <Area
            type="monotone"
            dataKey="opens"
            stroke="hsl(165 55% 42%)"
            fill="url(#gOpens)"
            name="Opens"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="clicks"
            stroke="hsl(214 75% 52%)"
            fill="url(#gClicks)"
            name="Clicks"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function FlatTopList({
  title,
  items,
}: {
  title: string;
  items: { label: string; count: number; href?: string }[];
}) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <div>
      <h3 className="mb-2 text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-500">
        {title}
      </h3>
      <ul className="stagger-children space-y-1.5">
        {items.map((it, idx) => (
          <li key={`${it.label}-${idx}`} className="animate-fade-up">
            <div className="flex items-center justify-between gap-2 text-[12.5px]">
              {it.href ? (
                <a
                  href={it.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate text-ink-800 hover:underline"
                  title={it.label}
                >
                  {it.label}
                </a>
              ) : (
                <span className="truncate text-ink-800" title={it.label}>
                  {it.label}
                </span>
              )}
              <span className="shrink-0 tabular-nums text-ink-600">
                <CountUp value={it.count} />
              </span>
            </div>
            <div className="mt-1 h-px w-full overflow-hidden bg-ink-100">
              <div
                className="animate-bar-grow h-full bg-ink-700"
                style={{
                  width: `${(it.count / max) * 100}%`,
                  height: 2,
                  animationDelay: `${idx * 50}ms`,
                }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CustomBodySection({ html }: { html: string }) {
  const [showRaw, setShowRaw] = useState(false);
  return (
    <section className="border-b border-hair bg-white px-4 py-5 sm:px-8">
      <div className="flex items-center justify-between gap-2">
        <SectionHeading
          title="Custom Body"
          subtitle={`${html.length.toLocaleString("de-DE")} Zeichen HTML`}
        />
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowRaw((v) => !v)}
            className="inline-flex items-center gap-1 rounded-md border border-hair bg-white px-2 py-1 text-[11.5px] text-ink-700 hover:bg-ink-50"
          >
            <Code2 className="h-3 w-3" />
            {showRaw ? "Vorschau anzeigen" : "Raw anzeigen"}
          </button>
          <CopyButton value={html} title="HTML kopieren" />
        </div>
      </div>
      <div className="mt-3 overflow-hidden border-l-2 border-hair">
        {showRaw ? (
          <pre className="max-h-[40vh] overflow-auto whitespace-pre-wrap break-all bg-ink-900 px-3 py-2 font-mono text-[11.5px] leading-relaxed text-ink-100">
            {html}
          </pre>
        ) : (
          <iframe
            title="Email-Vorschau"
            srcDoc={html}
            sandbox=""
            className="h-[60vh] w-full border-0 bg-white"
          />
        )}
      </div>
    </section>
  );
}

// ─── Job-Timeline ────────────────────────────────────────────────────

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

const KIND_FILTER: { value: "" | EmailTimelineKind; label: string }[] = [
  { value: "", label: "Alle" },
  { value: "open", label: "Opens" },
  { value: "click", label: "Clicks" },
  { value: "sent", label: "Versendet" },
  { value: "failed", label: "Fehler" },
  { value: "created", label: "Angelegt" },
];

function fmtTimelineTime(s: string | null | undefined): string {
  if (!s?.trim()) return "—";
  const raw = s.trim();
  const t = raw.includes("T")
    ? Date.parse(raw)
    : Date.parse(raw.replace(" ", "T") + "Z");
  if (Number.isNaN(t)) return s;
  return new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "UTC",
  }).format(new Date(t));
}

function fmtTimelineDateLabel(s: string | null | undefined): string {
  if (!s?.trim()) return "Unbekannt";
  const raw = s.trim();
  const t = raw.includes("T")
    ? Date.parse(raw)
    : Date.parse(raw.replace(" ", "T") + "Z");
  if (Number.isNaN(t)) return raw;
  const d = new Date(t);
  const today = new Date();
  const sameDay = (a: Date, b: Date) =>
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate();
  if (sameDay(d, today)) return "Heute";
  const yesterday = new Date(today.getTime() - 86_400_000);
  if (sameDay(d, yesterday)) return "Gestern";
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

function dayKey(s: string | null | undefined): string {
  if (!s?.trim()) return "—unknown—";
  const raw = s.trim();
  const t = raw.includes("T")
    ? Date.parse(raw)
    : Date.parse(raw.replace(" ", "T") + "Z");
  if (Number.isNaN(t)) return raw;
  const d = new Date(t);
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
}

function JobTimeline({ jobId }: { jobId: string }) {
  const [kind, setKind] = useState<"" | EmailTimelineKind>("");
  const [events, setEvents] = useState<EmailTimelineEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtersKey = useMemo(
    () => JSON.stringify({ jobId, kind }),
    [jobId, kind],
  );

  const loadPage = useCallback(
    async (offset: number, append: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const url = emailTimelineUrl({
          job_id: jobId,
          kind: kind || undefined,
          limit: TIMELINE_PAGE_SIZE,
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
        setEvents((prev) => (append ? [...prev, ...rows] : rows));
      } catch (e) {
        setError((e as Error).message || String(e));
      } finally {
        setLoading(false);
      }
    },
    [jobId, kind],
  );

  useEffect(() => {
    setEvents([]);
    setTotal(0);
    loadPage(0, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey]);

  const loadMore = useCallback(() => {
    if (loading) return;
    loadPage(events.length, true);
  }, [loading, loadPage, events.length]);

  const hasMore = events.length < total;

  // Counter pro Kind (über alle bisher geladenen Events)
  const counts = useMemo(() => {
    const m: Record<EmailTimelineKind, number> = {
      created: 0,
      sent: 0,
      failed: 0,
      open: 0,
      click: 0,
    };
    for (const ev of events) m[ev.kind] = (m[ev.kind] ?? 0) + 1;
    return m;
  }, [events]);

  // Gruppierung nach Tag
  const groups = useMemo(() => {
    const out: { label: string; key: string; events: EmailTimelineEvent[] }[] =
      [];
    let currentKey = "";
    for (const ev of events) {
      const k = dayKey(ev.at);
      if (k !== currentKey) {
        currentKey = k;
        out.push({ label: fmtTimelineDateLabel(ev.at), key: k, events: [] });
      }
      out[out.length - 1].events.push(ev);
    }
    return out;
  }, [events]);

  return (
    <div className="mt-3">
      {/* Toolbar */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3 text-[11.5px] tabular-nums text-ink-500">
          <span className="inline-flex items-center gap-1">
            <Eye className="h-3 w-3 text-emerald-600" />
            {fmtNumber(counts.open)}
          </span>
          <span className="inline-flex items-center gap-1">
            <MousePointerClick className="h-3 w-3 text-sky-600" />
            {fmtNumber(counts.click)}
          </span>
          {counts.failed > 0 && (
            <span className="inline-flex items-center gap-1 text-rose-700">
              <AlertCircle className="h-3 w-3" />
              {fmtNumber(counts.failed)}
            </span>
          )}
        </div>
        <div className="inline-flex items-center gap-0.5 rounded-md border border-hair bg-white p-0.5">
          {KIND_FILTER.map((opt) => (
            <button
              key={opt.value || "all"}
              type="button"
              onClick={() => setKind(opt.value)}
              className={`rounded px-2 py-0.5 text-[11.5px] transition ${
                kind === opt.value
                  ? "bg-ink-900 text-white"
                  : "text-ink-600 hover:bg-ink-50 hover:text-ink-900"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="mb-2 border-l-2 border-rose-500 bg-rose-500/5 px-3 py-2 text-[12px] text-rose-700">
          {error}
        </p>
      )}

      {events.length === 0 && !loading && (
        <p className="border-l-2 border-hair bg-ink-50/40 px-3 py-6 text-[12px] text-ink-400">
          Noch keine Events für diesen Job.
        </p>
      )}

      {/* Timeline */}
      {groups.map((g) => (
        <div key={g.key} className="mb-1">
          <div className="flex items-center gap-2 py-2">
            <span className="text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-500">
              {g.label}
            </span>
            <span className="h-px flex-1 bg-hair" />
            <span className="text-[10.5px] tabular-nums text-ink-400">
              {g.events.length}{" "}
              {g.events.length === 1 ? "Event" : "Events"}
            </span>
          </div>
          <ol className="relative">
            <span
              className="absolute left-[15px] top-0 bottom-0 w-px bg-hair"
              aria-hidden
            />
            {g.events.map((ev, idx) => (
              <TimelineItem key={ev.id} ev={ev} index={idx} />
            ))}
          </ol>
        </div>
      ))}

      {/* Load more / Footer */}
      <div className="pt-3 pb-2 text-center">
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
                Weitere {fmtNumber(
                  Math.min(TIMELINE_PAGE_SIZE, total - events.length),
                )}{" "}
                Events laden
                <ChevronDown className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        ) : events.length > 0 ? (
          <p className="text-[11px] text-ink-400">— Ende der Timeline —</p>
        ) : null}
      </div>
    </div>
  );
}

function TimelineItem({
  ev,
  index,
}: {
  ev: EmailTimelineEvent;
  index: number;
}) {
  const meta = KIND_META[ev.kind];
  const Icon = meta.icon;
  const trackingMeta = parseTrackingMetadata(ev.metadata);
  const geo = [trackingMeta?.city, trackingMeta?.country]
    .filter(Boolean)
    .join(", ");

  const delay = index < 12 ? `${index * 30}ms` : "0ms";
  return (
    <li
      style={{ animationDelay: delay }}
      className="animate-fade-up relative flex gap-3 py-1.5 pl-1 pr-1"
    >
      {/* Marker */}
      <div className="relative z-[1] flex h-[30px] w-[30px] shrink-0 items-center justify-center">
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-full text-white ring-4 ring-white ${meta.accent}`}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>

      {/* Card */}
      <div className="min-w-0 flex-1 px-3 py-1.5">
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
            {fmtTimelineTime(ev.at)}
          </span>
        </div>

        {/* Kind-spezifische Zusatzzeile */}
        {ev.kind === "click" && ev.link_url && (
          <p
            className="mt-1 truncate text-[12.5px] text-sky-700"
            title={ev.link_url}
          >
            <a
              href={ev.link_url}
              className="inline-flex items-center gap-1 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="h-3 w-3 shrink-0" />
              {ev.link_url}
            </a>
          </p>
        )}
        {(ev.kind === "open" || ev.kind === "click") &&
          (ev.ip_address || geo || trackingMeta?.timezone) && (
            <p className="mt-0.5 truncate text-[11px] text-ink-500">
              {ev.ip_address && (
                <span className="font-mono">{ev.ip_address}</span>
              )}
              {ev.ip_address && (geo || trackingMeta?.timezone) && (
                <span className="mx-1">·</span>
              )}
              {geo && <span>{geo}</span>}
              {trackingMeta?.timezone && (
                <span className="ml-1 text-ink-400">
                  · {trackingMeta.timezone}
                </span>
              )}
            </p>
          )}
        {(ev.kind === "open" || ev.kind === "click") && ev.user_agent && (
          <p
            className="mt-0.5 max-w-2xl truncate text-[10.5px] text-ink-400"
            title={ev.user_agent}
          >
            {ev.user_agent}
          </p>
        )}
        {ev.kind === "failed" && ev.error_message && (
          <p
            className="mt-1 truncate font-mono text-[11.5px] text-rose-700"
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
