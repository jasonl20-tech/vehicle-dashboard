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
 *   6) Suchbare, paginierte Events-Tabelle (Open / Click)
 */
import {
  ArrowLeft,
  Code2,
  Copy,
  ExternalLink,
  Eye,
  Loader2,
  Mail,
  MousePointerClick,
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
import { fmtNumber, useApi } from "../lib/customerApi";
import {
  emailJobUrl,
  emailJobEventsUrl,
  parseRecipientData,
  parseTrackingMetadata,
  statusBadge,
  type EmailJobFull,
  type EmailTrackingEvent,
  type EmailTrackingEventsResponse,
} from "../lib/emailJobsApi";

const noopSetHeader: DashboardOutletContext["setHeaderTrailing"] = () => {};
const EVENTS_PAGE_SIZE = 200;

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

function fmtWhenSeconds(s: string | null | undefined): string {
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
    second: "2-digit",
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
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/[0.1] bg-white/[0.04] text-night-200 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-50"
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
      <header className="border-b border-hair bg-white px-4 py-5 sm:px-8">
        <div className="flex items-start gap-3">
          <span
            className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${b.className}`}
          >
            <Mail className="h-3 w-3" />
            {b.label}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[20px] font-semibold tracking-tight text-ink-900">
              {subject}
            </h1>
            <p className="mt-0.5 truncate font-mono text-[11.5px] text-ink-400" title={j.id}>
              {j.id}
            </p>
          </div>
          <CopyButton value={j.id} title="ID kopieren" />
        </div>

        {/* Flache Stamm-Daten — kein Card-Look */}
        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 text-[12.5px] sm:grid-cols-4 lg:grid-cols-6">
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
            <span className="tabular-nums">{fmtNumber(tr.open_count)}</span>
            {tr.unique_open_count !== tr.open_count && (
              <span className="ml-1 text-[10.5px] text-ink-400">
                · {fmtNumber(tr.unique_open_count)} unique
              </span>
            )}
          </DT>
          <DT label="Clicks" tone="sky">
            <span className="tabular-nums">{fmtNumber(tr.click_count)}</span>
            {tr.unique_click_count !== tr.click_count && (
              <span className="ml-1 text-[10.5px] text-ink-400">
                · {fmtNumber(tr.unique_click_count)} unique
              </span>
            )}
          </DT>
          <DT label="Distinct IPs">{fmtNumber(tr.unique_ip_count)}</DT>
        </dl>

        {j.error_message && (
          <p className="mt-4 border-l-2 border-rose-500 bg-rose-500/5 px-3 py-2 font-mono text-[12px] text-rose-700">
            {j.error_message}
          </p>
        )}
      </header>

      {/* Verlauf */}
      <section className="border-b border-hair bg-white px-4 py-5 sm:px-8">
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
        <section className="border-b border-hair bg-white px-4 py-5 sm:px-8">
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
      <section className="border-b border-hair bg-white px-4 py-5 sm:px-8">
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

      {/* Events */}
      <section className="border-b border-hair bg-white px-4 py-5 sm:px-8">
        <SectionHeading title="Events" subtitle="Pixel-Opens & Click-Events" />
        <EventsTable jobId={j.id} />
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
    <div className="min-w-0">
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
      <ul className="space-y-1.5">
        {items.map((it, idx) => (
          <li key={`${it.label}-${idx}`}>
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
                {fmtNumber(it.count)}
              </span>
            </div>
            <div className="mt-1 h-px w-full overflow-hidden bg-ink-100">
              <div
                className="h-full bg-ink-700"
                style={{ width: `${(it.count / max) * 100}%`, height: 2 }}
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

// ─── Events-Tabelle ──────────────────────────────────────────────────

function EventsTable({ jobId }: { jobId: string }) {
  const [qIn, setQIn] = useState("");
  const [q, setQ] = useState("");
  const [eventType, setEventType] = useState<"" | "open" | "click">("");
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setQ(qIn), 300);
    return () => clearTimeout(t);
  }, [qIn]);

  useEffect(() => {
    setOffset(0);
  }, [q, eventType, jobId]);

  const url = useMemo(
    () =>
      emailJobEventsUrl(jobId, {
        q,
        event_type: eventType,
        limit: EVENTS_PAGE_SIZE,
        offset,
      }),
    [jobId, q, eventType, offset],
  );
  const events = useApi<EmailTrackingEventsResponse>(url);
  const rows = events.data?.rows ?? [];
  const counts = events.data?.eventCounts ?? {};
  const total = events.data?.total ?? 0;

  return (
    <div className="mt-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3 text-[11.5px] tabular-nums text-ink-500">
          <span className="inline-flex items-center gap-1">
            <Eye className="h-3 w-3 text-emerald-600" />
            {fmtNumber(counts.open ?? 0)}
          </span>
          <span className="inline-flex items-center gap-1">
            <MousePointerClick className="h-3 w-3 text-sky-600" />
            {fmtNumber(counts.click ?? 0)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex items-center gap-1.5 rounded-md border border-hair bg-white px-2.5 py-1">
            <Search className="h-3.5 w-3.5 shrink-0 text-ink-400" />
            <input
              type="search"
              value={qIn}
              onChange={(e) => setQIn(e.target.value)}
              placeholder="IP, Land, URL, UA…"
              className="w-44 min-w-0 border-0 bg-transparent text-[12px] text-ink-900 placeholder:text-ink-400 focus:outline-none"
            />
            {qIn && (
              <button
                type="button"
                onClick={() => setQIn("")}
                className="text-ink-400 hover:text-ink-700"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="inline-flex items-center gap-0.5 rounded-md border border-hair bg-white p-0.5">
            {[
              { v: "" as const, l: "Alle" },
              { v: "open" as const, l: "Open" },
              { v: "click" as const, l: "Click" },
            ].map((opt) => (
              <button
                key={opt.v || "all"}
                type="button"
                onClick={() => setEventType(opt.v)}
                className={`rounded px-2 py-0.5 text-[11.5px] transition ${
                  eventType === opt.v
                    ? "bg-ink-900 text-white"
                    : "text-ink-600 hover:bg-ink-50 hover:text-ink-900"
                }`}
              >
                {opt.l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {events.error && (
        <p className="mb-2 border-l-2 border-rose-500 bg-rose-500/5 px-3 py-2 text-[12px] text-rose-700">
          {events.error}
        </p>
      )}

      <table className="w-full border-separate border-spacing-0 text-left text-[12px]">
        <thead className="text-[10px] uppercase tracking-[0.12em] text-ink-500">
          <tr>
            <th className="border-b border-hair px-2 py-2 font-medium">Wann</th>
            <th className="border-b border-hair px-2 py-2 font-medium">Typ</th>
            <th className="border-b border-hair px-2 py-2 font-medium">Geo</th>
            <th className="border-b border-hair px-2 py-2 font-medium">IP</th>
            <th className="border-b border-hair px-2 py-2 font-medium">URL / User-Agent</th>
          </tr>
        </thead>
        <tbody>
          {events.loading && rows.length === 0 && (
            <tr>
              <td colSpan={5} className="px-3 py-6 text-center text-ink-500">
                <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />
                Lade…
              </td>
            </tr>
          )}
          {!events.loading && rows.length === 0 && (
            <tr>
              <td colSpan={5} className="px-3 py-6 text-center text-ink-400">
                Keine Events.
              </td>
            </tr>
          )}
          {rows.map((ev) => (
            <EventRow key={ev.id} ev={ev} />
          ))}
        </tbody>
      </table>

      {total > rows.length && (
        <div className="mt-2 flex items-center justify-between text-[11.5px] text-ink-500">
          <span className="tabular-nums">
            {fmtNumber(rows.length)} / {fmtNumber(total)} Events
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setOffset((v) => Math.max(0, v - EVENTS_PAGE_SIZE))}
              disabled={offset === 0}
              className="rounded-md border border-hair bg-white px-2 py-0.5 text-[11.5px] text-ink-700 hover:bg-ink-50 disabled:opacity-50"
            >
              ◀
            </button>
            <button
              type="button"
              onClick={() =>
                setOffset((v) =>
                  v + EVENTS_PAGE_SIZE >= total ? v : v + EVENTS_PAGE_SIZE,
                )
              }
              disabled={offset + EVENTS_PAGE_SIZE >= total}
              className="rounded-md border border-hair bg-white px-2 py-0.5 text-[11.5px] text-ink-700 hover:bg-ink-50 disabled:opacity-50"
            >
              ▶
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function EventRow({ ev }: { ev: EmailTrackingEvent }) {
  const meta = parseTrackingMetadata(ev.metadata);
  const geo = [meta?.city, meta?.country].filter(Boolean).join(", ") || "—";
  const isClick = ev.event_type === "click";
  return (
    <tr>
      <td
        className="whitespace-nowrap border-b border-hair px-2 py-1.5 align-top text-ink-700 tabular-nums"
        title={ev.created_at ?? ""}
      >
        {fmtWhenSeconds(ev.created_at)}
      </td>
      <td className="border-b border-hair px-2 py-1.5 align-top">
        {isClick ? (
          <span className="inline-flex items-center gap-1 text-sky-700">
            <MousePointerClick className="h-3 w-3" /> click
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-emerald-700">
            <Eye className="h-3 w-3" /> open
          </span>
        )}
      </td>
      <td className="whitespace-nowrap border-b border-hair px-2 py-1.5 align-top text-ink-700">
        {geo}
        {meta?.timezone && (
          <span className="ml-1 text-[10.5px] text-ink-400">· {meta.timezone}</span>
        )}
      </td>
      <td className="whitespace-nowrap border-b border-hair px-2 py-1.5 align-top font-mono text-[11.5px] text-ink-600">
        {ev.ip_address || "—"}
      </td>
      <td className="border-b border-hair px-2 py-1.5 align-top">
        {isClick && ev.link_url ? (
          <a
            href={ev.link_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex max-w-md items-center gap-1 truncate text-ink-800 hover:underline"
            title={ev.link_url}
          >
            <ExternalLink className="h-3 w-3 shrink-0" />
            <span className="truncate">{ev.link_url}</span>
          </a>
        ) : (
          <span
            className="block max-w-md truncate text-[11.5px] text-ink-500"
            title={ev.user_agent || "—"}
          >
            {ev.user_agent || "—"}
          </span>
        )}
      </td>
    </tr>
  );
}
