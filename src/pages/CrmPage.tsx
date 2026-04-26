import { ChevronLeft, ChevronRight, RefreshCw, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import PageHeader from "../components/ui/PageHeader";
import { fmtNumber, useApi } from "../lib/customerApi";
import {
  type CrmCustomerRow,
  type CrmCustomersListResponse,
  crmCustomersListUrl,
  parseAdditionalEmails,
} from "../lib/crmCustomersApi";

const PAGE_SIZE = 50;

const TH =
  "sticky top-0 z-[1] bg-paper/95 px-2 py-2.5 text-left text-[10px] font-medium uppercase tracking-[0.1em] text-ink-400 shadow-[0_1px_0_0_rgba(13,13,15,0.08)] backdrop-blur-sm";
const TD = "px-2 py-2 align-top text-[12.5px] text-ink-800 border-b border-hair/60";
const TEXT_IN =
  "w-full min-w-0 max-w-sm rounded border border-hair bg-white px-2.5 py-1.5 text-[12.5px] text-ink-800 focus:border-ink-400 focus:outline-none";

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
  }).format(new Date(t));
}

function emailStatusLabel(n: number): string {
  if (n === 0) return "0";
  return String(n);
}

export default function CrmPage() {
  const [qIn, setQIn] = useState("");
  const [q, setQ] = useState("");
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setQ(qIn), 400);
    return () => clearTimeout(t);
  }, [qIn]);

  useEffect(() => {
    setOffset(0);
  }, [q]);

  const url = useMemo(
    () => crmCustomersListUrl({ q, limit: PAGE_SIZE, offset }),
    [q, offset],
  );
  const api = useApi<CrmCustomersListResponse>(url);

  const rows = api.data?.rows ?? [];
  const total = api.data?.total ?? 0;
  const limit = api.data?.limit ?? PAGE_SIZE;
  const atEnd = offset + rows.length >= total;
  const pageLabel =
    total === 0
      ? "0 / 0"
      : `${offset + 1}–${offset + rows.length} / ${fmtNumber(total)}`;

  return (
    <div className="flex min-h-[calc(100dvh-7rem)] flex-col">
      <PageHeader
        eyebrow="Kundenmanagement"
        title="CRM"
        description={
          <span>
            Kundenstammdaten in D1, Binding <code className="text-[12.5px]">website</code>,
            Tabelle <code className="text-[12.5px]">crm_customers</code>.
          </span>
        }
        hideCalendarAndNotifications
      />

      <div
        className="flex min-h-0 flex-1 flex-col -mx-5 sm:-mx-10 lg:-mx-14"
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-hair/90 bg-paper/70 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hair/80 bg-paper/90 px-3 py-2.5 sm:px-4">
            <div className="relative min-w-0 max-w-md flex-1">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400"
                aria-hidden
              />
              <input
                className={TEXT_IN + " w-full pl-8"}
                placeholder="Suche: E-Mail, Firma, Notizen, Status, KV-Key…"
                value={qIn}
                onChange={(e) => setQIn(e.target.value)}
                aria-label="CRM durchsuchen"
              />
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => void api.reload()}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-hair/80 bg-white px-2.5 text-[12px] text-ink-600 transition hover:border-ink-300 hover:text-ink-900"
                title="Aktualisieren"
              >
                <RefreshCw
                  className={
                    "h-3.5 w-3.5 " + (api.loading ? " animate-spin" : "")
                  }
                />
                Neu laden
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto">
            {api.error && (
              <p className="p-4 text-[13px] text-accent-amber">
                {api.error}
              </p>
            )}
            <table className="w-full min-w-[1180px] border-collapse text-left">
              <thead>
                <tr>
                  <th className={TH}>ID</th>
                  <th className={TH}>Aktualisiert</th>
                  <th className={TH}>E-Mail</th>
                  <th className={TH}>Status</th>
                  <th className={TH}>E-Mail-Status</th>
                  <th className={TH}>Firma</th>
                  <th className={TH}>KV-Key</th>
                  <th className={TH}>Weitere E-Mails</th>
                  <th className={TH}>Notizen</th>
                </tr>
              </thead>
              <tbody>
                {api.loading && rows.length === 0 && (
                  <tr>
                    <td className={TD} colSpan={9}>
                      Lädt…
                    </td>
                  </tr>
                )}
                {!api.loading && rows.length === 0 && !api.error && (
                  <tr>
                    <td className={TD} colSpan={9}>
                      Keine Einträge. Tabelle in D1 leer oder Migration noch nicht
                      angewendet (siehe <code className="text-[11px]">d1/migrations/0001_crm_customers.sql</code>).
                    </td>
                  </tr>
                )}
                {rows.map((r: CrmCustomerRow) => {
                  const extra = parseAdditionalEmails(r.additional_emails);
                  return (
                    <tr key={r.id} className="hover:bg-paper/80">
                      <td className={TD + " max-w-[120px] break-all font-mono text-[10px] text-ink-500"}>
                        {r.id}
                      </td>
                      <td className={TD + " whitespace-nowrap text-ink-500"}>
                        {fmtWhen(r.updated_at || r.created_at)}
                      </td>
                      <td className={TD + " break-all font-mono text-[12px]"}>
                        {r.email}
                      </td>
                      <td className={TD + " whitespace-nowrap"}>{r.status}</td>
                      <td className={TD}>{emailStatusLabel(r.email_status)}</td>
                      <td className={TD + " break-words max-w-[200px]"}>
                        {r.business_name ?? "—"}
                      </td>
                      <td className={TD + " break-all font-mono text-[11px]"}>
                        {r.kv_key ?? "—"}
                      </td>
                      <td className={TD + " break-words max-w-[220px] text-ink-600"}>
                        {extra.length ? extra.join(", ") : "—"}
                      </td>
                      <td className={TD + " max-w-[min(32vw,360px)] break-words text-ink-600"}>
                        {r.notes?.trim() ? r.notes : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-hair/80 bg-paper/90 px-3 py-2 text-[12px] text-ink-500 sm:px-4">
            <span>{pageLabel}</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="inline-flex h-8 items-center rounded-md border border-hair/80 bg-white px-2 disabled:opacity-40"
                disabled={offset === 0}
                onClick={() => setOffset((o) => Math.max(0, o - limit))}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="inline-flex h-8 items-center rounded-md border border-hair/80 bg-white px-2 disabled:opacity-40"
                disabled={atEnd}
                onClick={() => setOffset((o) => o + limit)}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
