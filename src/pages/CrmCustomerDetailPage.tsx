import { ArrowLeft, RefreshCw } from "lucide-react";
import { useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import PageHeader from "../components/ui/PageHeader";
import { useApi } from "../lib/customerApi";
import {
  type CrmCustomerOneResponse,
  crmCustomerDetailUrl,
  parseAdditionalEmails,
} from "../lib/crmCustomersApi";

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
  }).format(new Date(t));
}

const DL = "grid grid-cols-1 gap-1 sm:grid-cols-[140px_1fr] sm:gap-3";
const DT = "text-[11px] font-medium uppercase tracking-[0.08em] text-ink-400 sm:pt-0.5";
const DD = "min-w-0 break-words text-[13.5px] text-ink-800";

export default function CrmCustomerDetailPage() {
  const { customerId: idParam } = useParams();
  const navigate = useNavigate();
  const id = idParam ? decodeURIComponent(idParam) : "";

  const url = id ? crmCustomerDetailUrl(id) : null;
  const api = useApi<CrmCustomerOneResponse>(url);

  const row = api.data?.row;
  const extra = row ? parseAdditionalEmails(row.additional_emails) : [];

  useEffect(() => {
    if (!id) navigate("/kunden/crm", { replace: true });
  }, [id, navigate]);

  return (
    <>
      <PageHeader
        eyebrow="Kundenmanagement"
        title={row ? row.email : "CRM – Kontakt"}
        hideCalendarAndNotifications
        description="Alle Felder zu diesem Datensatz in D1 (website / crm_customers)."
        rightSlot={
          <button
            type="button"
            onClick={() => void api.reload()}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-hair bg-white text-ink-500 transition-colors hover:border-ink-300 hover:text-ink-800"
            title="Aktualisieren"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${api.loading ? "animate-spin" : ""}`}
            />
          </button>
        }
      />

      <p className="mb-6">
        <Link
          to="/kunden/crm"
          className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-600 transition-colors hover:text-ink-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Zurück zur CRM-Übersicht
        </Link>
      </p>

      {api.error && (
        <p className="mb-4 rounded-md border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-[13px] text-amber-900">
          {api.error}
        </p>
      )}

      {api.loading && !row && !api.error && (
        <p className="text-[13px] text-ink-500">Lade Kontakt…</p>
      )}

      {row && (
        <div className="max-w-3xl space-y-6 rounded-xl border border-hair/90 bg-paper/80 p-5 shadow-sm">
          <div className={DL}>
            <div className={DT}>ID</div>
            <div className={DD + " font-mono text-[12px] text-ink-600"}>
              {row.id}
            </div>
            <div className={DT}>E-Mail</div>
            <div className={DD}>{row.email}</div>
            <div className={DT}>Angelegt</div>
            <div className={DD + " text-ink-600"}>
              {fmtWhen(row.created_at)}
            </div>
            <div className={DT}>Aktualisiert</div>
            <div className={DD + " text-ink-600"}>
              {fmtWhen(row.updated_at)}
            </div>
            <div className={DT}>Status</div>
            <div className={DD}>{row.status}</div>
            <div className={DT}>E-Mail-Status</div>
            <div className={DD}>{String(row.email_status)}</div>
            <div className={DT}>Firma</div>
            <div className={DD}>{row.business_name?.trim() ? row.business_name : "—"}</div>
            <div className={DT}>KV-Key (API-Key)</div>
            <div className={DD}>
              {row.kv_key?.trim() ? (
                <code className="break-all text-[12px]">{row.kv_key}</code>
              ) : (
                <span className="text-ink-400">Nicht verknüpft</span>
              )}
            </div>
            <div className={DT}>Weitere E-Mails</div>
            <div className={DD + " text-ink-700"}>
              {extra.length ? extra.join(", ") : "—"}
            </div>
            <div className={DT}>Notizen</div>
            <div className={DD + " whitespace-pre-wrap text-ink-700"}>
              {row.notes?.trim() ? row.notes : "—"}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
