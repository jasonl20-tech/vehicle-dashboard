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
  type WebsiteSubmissionRow,
  type WebsiteSubmissionsListResponse,
  websiteSubmissionsListUrl,
} from "../lib/websiteSubmissionsApi";

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

function jsonPretty(x: unknown): string {
  try {
    return JSON.stringify(x, null, 2);
  } catch {
    return String(x);
  }
}

export default function AnfragenPage() {
  const [qIn, setQIn] = useState("");
  const [q, setQ] = useState("");
  const [offset, setOffset] = useState(0);
  const [spam, setSpam] = useState<"all" | "0" | "1">("all");
  const [detail, setDetail] = useState<WebsiteSubmissionRow | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setQ(qIn), 400);
    return () => clearTimeout(t);
  }, [qIn]);

  useEffect(() => {
    setOffset(0);
  }, [q, spam]);

  const url = useMemo(
    () => websiteSubmissionsListUrl({ q, limit: PAGE_SIZE, offset, spam }),
    [q, offset, spam],
  );
  const api = useApi<WebsiteSubmissionsListResponse>(url);

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
            {(
              [
                { id: "all" as const, label: "Alle" },
                { id: "0" as const, label: "Nur gültig" },
                { id: "1" as const, label: "Nur Spam" },
              ] as const
            ).map((o, i) => (
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

      {api.error && (
        <p className="mb-4 rounded border border-accent-rose/30 bg-accent-rose/5 px-3 py-2 text-[12.5px] text-accent-rose">
          {api.error}
        </p>
      )}

      <div className="overflow-x-auto rounded-md border border-hair">
        <table className="min-w-[900px] w-full text-left">
          <thead className="bg-paper">
            <tr>
              <th className={TH}>zeit (UTC)</th>
              <th className={TH}>formular</th>
              <th className={TH}>kontakt</th>
              <th className={TH}>ip</th>
              <th className={TH}>land</th>
              <th className={TH}>spam</th>
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
                    <td className={TD}>
                      {email ? (
                        <a
                          href={`mailto:${email}`}
                          className="inline-flex max-w-[240px] items-center gap-1 truncate text-brand-600 hover:underline"
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
