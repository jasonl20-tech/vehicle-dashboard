import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Mail,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import PageHeader from "../components/ui/PageHeader";
import { fmtNumber, useApi } from "../lib/customerApi";
import {
  type NewsletterListResponse,
  type NewsletterRow,
  websiteNewsletterListUrl,
} from "../lib/websiteNewsletterApi";

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

function getForm(meta: unknown): { email: string | null; subject: string | null } {
  if (meta == null || typeof meta !== "object" || Array.isArray(meta)) {
    return { email: null, subject: null };
  }
  const form = (meta as Record<string, unknown>).form;
  if (form == null || typeof form !== "object" || Array.isArray(form)) {
    return { email: null, subject: null };
  }
  const f = form as Record<string, unknown>;
  const email =
    typeof f.email === "string" && f.email.includes("@")
      ? f.email.trim()
      : null;
  const subject =
    typeof f.subject === "string" && f.subject.trim()
      ? String(f.subject).trim()
      : null;
  return { email, subject };
}

function getRequestString(meta: unknown, key: string): string | null {
  if (meta == null || typeof meta !== "object" || Array.isArray(meta)) {
    return null;
  }
  const req = (meta as Record<string, unknown>).request;
  if (req == null || typeof req !== "object" || Array.isArray(req)) {
    return null;
  }
  const v = (req as Record<string, unknown>)[key];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function jsonPretty(x: unknown): string {
  try {
    return JSON.stringify(x, null, 2);
  } catch {
    return String(x);
  }
}

export default function NewsletterPage() {
  const [qIn, setQIn] = useState("");
  const [q, setQ] = useState("");
  const [offset, setOffset] = useState(0);
  const [activeFilter, setActiveFilter] = useState<"all" | "0" | "1">("all");
  const [detail, setDetail] = useState<NewsletterRow | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setQ(qIn), 400);
    return () => clearTimeout(t);
  }, [qIn]);

  useEffect(() => {
    setOffset(0);
  }, [q, activeFilter]);

  const url = useMemo(
    () =>
      websiteNewsletterListUrl({
        q,
        limit: PAGE_SIZE,
        offset,
        active: activeFilter,
      }),
    [q, offset, activeFilter],
  );
  const api = useApi<NewsletterListResponse>(url);

  const rows = api.data?.rows ?? [];
  const total = api.data?.total ?? 0;
  const limit = api.data?.limit ?? PAGE_SIZE;
  const atEnd = offset + rows.length >= total;
  const pageLabel =
    total === 0
      ? "0 / 0"
      : `${offset + 1}–${offset + rows.length} / ${fmtNumber(total)}`;

  return (
    <div>
      <PageHeader
        eyebrow="Kundenmanagement"
        title="Newsletter"
        description={
          <span>
            Anmeldungen aus der Tabelle{" "}
            <code className="font-mono text-[11.5px]">newsletter</code> (D1{" "}
            <code className="font-mono text-[11.5px]">website</code>) —{" "}
            <code className="font-mono text-[11px]">metadata</code> enthält{" "}
            <code className="font-mono text-[11px]">form</code> (E-Mail, Betreff) und{" "}
            <code className="font-mono text-[11px]">request</code> (IP, Land, …).
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
              placeholder="ID, E-Mail, Metadaten (JSON) …"
              value={qIn}
              onChange={(e) => setQIn(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="mb-0.5 block text-[10.5px] font-medium uppercase tracking-wider text-ink-400">
            Status
          </label>
          <div className="inline-flex overflow-hidden rounded-md border border-hair bg-white">
            {(
              [
                { id: "all" as const, label: "Alle" },
                { id: "1" as const, label: "Aktiv" },
                { id: "0" as const, label: "Inaktiv" },
              ] as const
            ).map((o, i) => (
              <button
                key={o.id}
                type="button"
                onClick={() => setActiveFilter(o.id)}
                className={`px-2.5 py-1.5 text-[12px] transition-colors ${
                  activeFilter === o.id
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

      {api.error && (
        <p className="mb-4 rounded border border-accent-rose/30 bg-accent-rose/5 px-3 py-2 text-[12.5px] text-accent-rose">
          {api.error}
        </p>
      )}

      <div className="overflow-x-auto rounded-md border border-hair">
        <table className="min-w-[900px] w-full text-left">
          <thead className="bg-paper">
            <tr>
              <th className={TH}>Zeit (UTC)</th>
              <th className={TH}>E-Mail</th>
              <th className={TH}>Betreff</th>
              <th className={TH}>IP</th>
              <th className={TH}>Land</th>
              <th className={TH}>Aktiv</th>
              <th className={TH} />
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
                  Keine Einträge. Tabelle leer oder Migration{" "}
                  <code className="text-[11px]">0003_newsletter.sql</code> noch
                  nicht angewendet.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const { email, subject } = getForm(r.metadata);
                const ip = getRequestString(r.metadata, "ip");
                const country = getRequestString(r.metadata, "country");
                return (
                  <tr key={r.id} className="hover:bg-ink-50/50">
                    <td className={`${TD} whitespace-nowrap text-ink-600`}>
                      {fmtWhen(r.created_at)}
                    </td>
                    <td className={TD}>
                      {email ? (
                        <a
                          href={`mailto:${email}`}
                          className="inline-flex max-w-[260px] items-center gap-1 truncate text-brand-600 hover:underline"
                        >
                          <Mail className="h-3 w-3 shrink-0" />
                          {email}
                        </a>
                      ) : (
                        <span className="text-ink-400">—</span>
                      )}
                    </td>
                    <td className={`${TD} max-w-[220px] truncate`} title={subject ?? ""}>
                      {subject ?? "—"}
                    </td>
                    <td className={`${TD} font-mono text-[11.5px]`}>
                      {ip || "—"}
                    </td>
                    <td className={TD}>{country || "—"}</td>
                    <td className={TD}>
                      {r.active ? (
                        <span className="text-brand-700">aktiv</span>
                      ) : (
                        <span className="text-ink-500">inaktiv</span>
                      )}
                    </td>
                    <td className={`${TD} text-right`}>
                      <button
                        type="button"
                        onClick={() => setDetail(r)}
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

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[12.5px] text-ink-600">
        <span className="tabular-nums">{pageLabel}</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={offset === 0 || api.loading}
            onClick={() => setOffset((o) => Math.max(0, o - limit))}
            className="inline-flex h-8 items-center gap-0.5 rounded-md border border-hair px-2 text-ink-700 enabled:hover:bg-ink-50 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
            Zurück
          </button>
          <button
            type="button"
            disabled={atEnd || api.loading}
            onClick={() => setOffset((o) => o + limit)}
            className="inline-flex h-8 items-center gap-0.5 rounded-md border border-hair px-2 text-ink-700 enabled:hover:bg-ink-50 disabled:opacity-40"
          >
            Weiter
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {detail && (
        <NewsletterDetailDialog row={detail} onClose={() => setDetail(null)} />
      )}
    </div>
  );
}

function NewsletterDetailDialog({
  row,
  onClose,
}: {
  row: NewsletterRow;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const { email, subject } = getForm(row.metadata);
  const ref = getRequestString(row.metadata, "referer");
  const ua = getRequestString(row.metadata, "userAgent");

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Newsletter-Eintrag"
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
              Newsletter
            </p>
            <p className="mt-0.5 truncate font-mono text-[12px] text-ink-700">
              {row.id}
            </p>
            <p className="text-[12px] text-ink-500">
              {fmtWhen(row.created_at)} UTC · {row.active ? "aktiv" : "inaktiv"}
            </p>
            {email && (
              <p className="mt-1 text-[12.5px] text-ink-800">
                <a
                  href={`mailto:${email}`}
                  className="text-brand-600 hover:underline"
                >
                  {email}
                </a>
                {subject && (
                  <span className="ml-2 text-ink-500">· {subject}</span>
                )}
              </p>
            )}
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
            Vollständige Metadaten (JSON)
          </h3>
          <pre className="mb-3 max-h-[min(60vh,480px)] overflow-auto rounded border border-hair bg-ink-50/50 p-2 font-mono text-[11.5px] text-ink-800">
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
