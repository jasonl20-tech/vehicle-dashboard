import { Plus, RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "../components/ui/PageHeader";
import { useApi, fmtNumber } from "../lib/customerApi";
import {
  CRM_CUSTOMERS_API,
  type CrmCustomerRow,
  type CrmCustomersListResponse,
  crmCustomersListUrl,
} from "../lib/crmCustomersApi";
import { ISO2_COUNTRIES } from "../lib/iso2Countries";

const PAGE_SIZE = 50;
const TEXT_IN =
  "w-full min-w-0 rounded border border-hair bg-white px-2 py-1.5 text-[12.5px] text-ink-800 focus:border-ink-400 focus:outline-none";
const SELECT_IN =
  "w-full min-w-0 rounded border border-hair bg-white px-2 py-1.5 text-[12.5px] text-ink-800 focus:border-ink-400 focus:outline-none";
const TH = "px-2 py-2 text-left text-[10px] font-medium uppercase tracking-[0.1em] text-ink-400";
const TH_TR = "px-2 py-2 text-right text-[10px] font-medium uppercase tracking-[0.1em] text-ink-400";
const TD = "px-2 py-2 align-top text-[12.5px] text-ink-800";

function StandortSelect({
  value,
  onChange,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  ariaLabel: string;
}) {
  return (
    <select
      className={SELECT_IN}
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      aria-label={ariaLabel}
    >
      <option value="">— kein Standort —</option>
      {ISO2_COUNTRIES.map((c) => (
        <option key={c.iso2} value={c.iso2}>
          {c.nameDe} ({c.iso2})
        </option>
      ))}
    </select>
  );
}

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
    timeZone: "UTC",
  }).format(new Date(t));
}

function RowEditor({
  row,
  onSaved,
  onError,
}: {
  row: CrmCustomerRow;
  onSaved: () => void;
  onError: (m: string) => void;
}) {
  const [email, setEmail] = useState(row.email);
  const [company, setCompany] = useState(row.company);
  const [status, setStatus] = useState(row.status);
  const [location, setLocation] = useState(row.location);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEmail(row.email);
    setCompany(row.company);
    setStatus(row.status);
    setLocation(row.location);
  }, [row.id, row.email, row.company, row.status, row.location]);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch(CRM_CUSTOMERS_API, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: row.id,
          email: email.trim(),
          company: company.trim() || null,
          status: status.trim() || "Neu",
          location: location.trim() ? location.trim().toUpperCase() : null,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        onError(j.error || `HTTP ${res.status}`);
        return;
      }
      onSaved();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }, [row.id, email, company, status, location, onSaved, onError]);

  return (
    <tr>
      <td className={`${TD} max-w-[100px] font-mono text-[11px] text-ink-500`}>
        {row.id.length > 12 ? `${row.id.slice(0, 8)}…` : row.id}
      </td>
      <td className={TD}>
        <input
          type="email"
          className={TEXT_IN}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="off"
        />
      </td>
      <td className={TD}>
        <input
          type="text"
          className={TEXT_IN}
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          placeholder="Firma"
        />
      </td>
      <td className={TD}>
        <input
          type="text"
          className={TEXT_IN}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          placeholder="z. B. Neu"
        />
      </td>
      <td className={TD}>
        <StandortSelect
          value={location}
          onChange={setLocation}
          ariaLabel="Standort des Kunden"
        />
      </td>
      <td className={`${TD} whitespace-nowrap text-ink-500`}>
        {fmtWhen(row.created_at)}
      </td>
      <td className={`${TD} text-right`}>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded border border-hair bg-white px-2 py-1 text-[11.5px] text-ink-700 hover:bg-ink-50 disabled:opacity-50"
        >
          {saving ? "…" : "Speichern"}
        </button>
      </td>
    </tr>
  );
}

export default function KundenCrmPage() {
  const [qIn, setQIn] = useState("");
  const [q, setQ] = useState("");
  const [offset, setOffset] = useState(0);
  const [formErr, setFormErr] = useState("");
  const [rowErr, setRowErr] = useState<Record<string, string>>({});
  const [newEmail, setNewEmail] = useState("");
  const [newCompany, setNewCompany] = useState("");
  const [newStatus, setNewStatus] = useState("Neu");
  const [newLocation, setNewLocation] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setQ(qIn), 400);
    return () => clearTimeout(t);
  }, [qIn]);

  useEffect(() => {
    setOffset(0);
  }, [q]);

  const listUrl = useMemo(
    () => crmCustomersListUrl({ q, limit: PAGE_SIZE, offset }),
    [q, offset],
  );

  const { data, error, loading, reload } = useApi<CrmCustomersListResponse>(
    listUrl,
  );

  const listRows = useMemo((): CrmCustomerRow[] => {
    if (!data) return [];
    if (Array.isArray(data.rows)) return data.rows;
    return [];
  }, [data]);

  const create = useCallback(async () => {
    setFormErr("");
    const email = newEmail.trim();
    if (!email || !email.includes("@")) {
      setFormErr("Gültige E-Mail eingeben");
      return;
    }
    setAdding(true);
    try {
      const res = await fetch(CRM_CUSTOMERS_API, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          company: newCompany.trim() || undefined,
          status: newStatus.trim() || "Neu",
          location: newLocation.trim()
            ? newLocation.trim().toUpperCase()
            : undefined,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setFormErr(j.error || `HTTP ${res.status}`);
        return;
      }
      setNewEmail("");
      setNewCompany("");
      setNewStatus("Neu");
      setNewLocation("");
      reload();
    } catch (e) {
      setFormErr((e as Error).message);
    } finally {
      setAdding(false);
    }
  }, [newEmail, newCompany, newStatus, newLocation, reload]);

  const onRowSaved = useCallback(() => {
    reload();
  }, [reload]);

  return (
    <>
      <PageHeader
        eyebrow="Kundenmanagement"
        title="CRM"
        description="Kundenstammdaten: Tabelle `customers` in derselben D1-DB wie Anfragen/Newsletter (Binding `website`) — E-Mail, Firma, Status. Neuer Eintrag unten."
      />

      {error && (
        <p className="mb-3 text-[12.5px] text-accent-rose" role="alert">
          {error}
        </p>
      )}

      {data?.schemaWarning && (
        <p
          className="mb-3 rounded border border-accent-amber/40 bg-accent-amber/10 px-2.5 py-1.5 text-[12.5px] text-accent-amber"
          role="status"
        >
          {data.schemaWarning}
        </p>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex min-w-[200px] max-w-md flex-1 items-center gap-2 rounded-md border border-hair bg-white px-2 py-1.5">
          <Search className="h-3.5 w-3.5 shrink-0 text-ink-400" />
          <input
            type="search"
            value={qIn}
            onChange={(e) => setQIn(e.target.value)}
            placeholder="Suche: E-Mail oder Firma"
            className="min-w-0 flex-1 border-0 bg-transparent text-[12.5px] outline-none"
          />
        </div>
        <button
          type="button"
          onClick={reload}
          disabled={loading}
          className="inline-flex h-8 items-center gap-1 rounded-md border border-hair bg-white px-2.5 text-[12.5px] text-ink-700 hover:bg-ink-50 disabled:opacity-50"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
          />
          Aktualisieren
        </button>
      </div>

      <p className="mb-2 text-[12.5px] text-ink-500">
        {data != null && typeof data.total === "number" && (
          <>
            {fmtNumber(data.total)} Einträge insgesamt
            {loading && " · "}
          </>
        )}
        {loading && "Laden…"}
        {data && !Array.isArray(data.rows) && !error && !loading && (
          <span className="ml-1 text-accent-amber">
            API-Antwort unerwartet (kein <code>rows</code>).
          </span>
        )}
      </p>

      <div className="mb-6 overflow-x-auto rounded-md border border-hair">
        <table className="w-full min-w-[700px] border-collapse text-left text-[12.5px]">
          <thead>
            <tr className="border-b border-hair bg-ink-50/60">
              <th className={TH}>ID</th>
              <th className={TH}>E-Mail</th>
              <th className={TH}>Firma</th>
              <th className={TH}>Status</th>
              <th className={TH}>Standort</th>
              <th className={TH}>Angelegt</th>
              <th className={TH_TR}>Aktion</th>
            </tr>
          </thead>
          <tbody>
            {loading && listRows.length === 0 && !error && (
              <tr>
                <td colSpan={7} className="px-2 py-6 text-center text-ink-500">
                  Kundendaten werden geladen…
                </td>
              </tr>
            )}
            {listRows.map((row) => (
              <RowEditor
                key={row.id}
                row={row}
                onSaved={onRowSaved}
                onError={(m) =>
                  setRowErr((e) => ({ ...e, [row.id]: m }))
                }
              />
            ))}
            {listRows.length === 0 && !loading && !error && (
              <tr>
                <td colSpan={7} className="px-2 py-6 text-center text-ink-500">
                  Keine Einträge
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {listRows.map((row) =>
        rowErr[row.id] ? (
          <p
            key={`e-${row.id}`}
            className="mb-1 text-[12px] text-accent-rose"
            role="alert"
          >
            {row.id}: {rowErr[row.id]}
          </p>
        ) : null,
      )}

      {data && data.total > PAGE_SIZE && (
        <div className="mb-6 flex items-center justify-center gap-2 text-[12.5px] text-ink-600">
          <button
            type="button"
            className="rounded border border-hair bg-white px-2 py-1 enabled:hover:bg-ink-50 disabled:opacity-40"
            disabled={offset < PAGE_SIZE}
            onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
          >
            Zurück
          </button>
          <span>
            {offset + 1}–{Math.min(offset + PAGE_SIZE, data.total)} /{" "}
            {data.total}
          </span>
          <button
            type="button"
            className="rounded border border-hair bg-white px-2 py-1 enabled:hover:bg-ink-50 disabled:opacity-40"
            disabled={offset + PAGE_SIZE >= data.total}
            onClick={() => setOffset((o) => o + PAGE_SIZE)}
          >
            Weiter
          </button>
        </div>
      )}

      <div className="border-t border-hair/80 pt-5">
        <h2 className="text-[12px] font-medium uppercase tracking-[0.1em] text-ink-400">
          Neuer Kunde
        </h2>
        <div className="mt-2 flex max-w-2xl flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-0 flex-1">
            <label className="mb-0.5 block text-[11px] text-ink-500">
              E-Mail *
            </label>
            <input
              type="email"
              className={TEXT_IN}
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="min-w-0 flex-1 sm:max-w-xs">
            <label className="mb-0.5 block text-[11px] text-ink-500">
              Firma
            </label>
            <input
              type="text"
              className={TEXT_IN}
              value={newCompany}
              onChange={(e) => setNewCompany(e.target.value)}
            />
          </div>
          <div className="w-full min-w-0 sm:max-w-[160px]">
            <label className="mb-0.5 block text-[11px] text-ink-500">
              Status
            </label>
            <input
              type="text"
              className={TEXT_IN}
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
            />
          </div>
          <div className="w-full min-w-0 sm:max-w-[220px]">
            <label className="mb-0.5 block text-[11px] text-ink-500">
              Standort (optional)
            </label>
            <StandortSelect
              value={newLocation}
              onChange={setNewLocation}
              ariaLabel="Standort des neuen Kunden"
            />
          </div>
          <button
            type="button"
            onClick={create}
            disabled={adding}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-hair bg-ink-900 px-3 text-[12.5px] text-white hover:bg-ink-800 disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            Anlegen
          </button>
        </div>
        {formErr && (
          <p className="mt-2 text-[12.5px] text-accent-rose" role="alert">
            {formErr}
          </p>
        )}
      </div>
    </>
  );
}
