import {
  Filter,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { useOutletContext } from "react-router-dom";
import { useApi, fmtNumber } from "../lib/customerApi";
import type { DashboardOutletContext } from "../components/layout/dashboardOutletContext";
import {
  CRM_CUSTOMERS_API,
  type CrmCustomerRow,
  type CrmCustomersListResponse,
  crmCustomersListUrl,
} from "../lib/crmCustomersApi";
import { ISO2_COUNTRIES } from "../lib/iso2Countries";

const PAGE_SIZE = 100;
const TEXT_IN =
  "w-full min-w-0 rounded border border-hair bg-white px-2 py-1.5 text-[12.5px] text-ink-800 focus:border-ink-400 focus:outline-none";
const SELECT_IN =
  "w-full min-w-0 rounded border border-hair bg-white px-2 py-1.5 text-[12.5px] text-ink-800 focus:border-ink-400 focus:outline-none";
const SELECT_CELL =
  "w-full min-h-[2.5rem] min-w-0 border-0 border-black bg-white px-2 py-1.5 text-[12.5px] text-ink-800 focus:outline-none focus:ring-0";
const TH =
  "border border-black bg-ink-100 px-2 py-2 text-left text-[10px] font-medium uppercase tracking-[0.1em] text-ink-600";
const TD = "border border-black p-0 align-top";
const TD_TEXT =
  "min-h-[2.5rem] break-words px-2 py-1.5 text-[12.5px] text-ink-800";
const IN_CELL =
  "min-h-[2.5rem] w-full min-w-0 border-0 bg-white px-2 py-1.5 text-[12.5px] text-ink-800 focus:outline-none focus:ring-0";

function StandortSelect({
  value,
  onChange,
  ariaLabel,
  className: selectClassName = SELECT_IN,
}: {
  value: string;
  onChange: (v: string) => void;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <select
      className={selectClassName}
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

function fmtLocationDe(iso2: string | null | undefined): string {
  const s = (iso2 || "").trim().toUpperCase();
  if (!s) return "—";
  const c = ISO2_COUNTRIES.find((x) => x.iso2 === s);
  return c ? `${c.nameDe} (${c.iso2})` : s;
}

type CrmRowDraft = {
  id: string;
  email: string;
  company: string;
  status: string;
  location: string;
};

function rowToDraft(r: CrmCustomerRow): CrmRowDraft {
  return {
    id: r.id,
    email: r.email,
    company: r.company ?? "",
    status: r.status ?? "",
    location: (r.location ?? "").trim().toUpperCase(),
  };
}

function isDraftDirty(d: CrmRowDraft, r: CrmCustomerRow): boolean {
  return (
    d.email.trim() !== (r.email || "").trim() ||
    d.company.trim() !== (r.company || "").trim() ||
    d.status.trim() !== (r.status || "").trim() ||
    d.location.trim().toUpperCase() !== (r.location || "").trim().toUpperCase()
  );
}

function CrmTableRow({
  row,
  editing,
  draft,
  onField,
  onActivate,
}: {
  row: CrmCustomerRow;
  editing: boolean;
  draft: CrmRowDraft | null;
  onField: (patch: Partial<Pick<CrmRowDraft, "email" | "company" | "status" | "location">>) => void;
  onActivate: (row: CrmCustomerRow) => void;
}) {
  const d = draft && draft.id === row.id ? draft : null;
  const show = editing && d;

  const idShort =
    row.id.length > 12 ? `${row.id.slice(0, 8)}…` : row.id;

  return (
    <tr
      className={`${editing ? "bg-ink-100/50" : "hover:bg-ink-50/80"} cursor-pointer`}
      onClick={() => onActivate(row)}
    >
      <td className={`${TD} max-w-[120px] font-mono text-[11px] text-ink-600`}>
        <div className={TD_TEXT}>{idShort}</div>
      </td>
      <td
        className={TD}
        onClick={show ? (e) => e.stopPropagation() : undefined}
      >
        {show && d ? (
          <input
            type="email"
            className={IN_CELL}
            value={d.email}
            onChange={(e) => onField({ email: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            autoComplete="off"
          />
        ) : (
          <div className={TD_TEXT}>{row.email || "—"}</div>
        )}
      </td>
      <td
        className={TD}
        onClick={show ? (e) => e.stopPropagation() : undefined}
      >
        {show && d ? (
          <input
            type="text"
            className={IN_CELL}
            value={d.company}
            onChange={(e) => onField({ company: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            placeholder="Firma"
          />
        ) : (
          <div className={TD_TEXT}>{(row.company || "").trim() || "—"}</div>
        )}
      </td>
      <td
        className={TD}
        onClick={show ? (e) => e.stopPropagation() : undefined}
      >
        {show && d ? (
          <input
            type="text"
            className={IN_CELL}
            value={d.status}
            onChange={(e) => onField({ status: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            placeholder="Status"
          />
        ) : (
          <div className={TD_TEXT}>{(row.status || "").trim() || "—"}</div>
        )}
      </td>
      <td
        className={TD}
        onClick={show ? (e) => e.stopPropagation() : undefined}
      >
        {show && d ? (
          <StandortSelect
            value={d.location}
            onChange={(v) => onField({ location: v })}
            ariaLabel="Standort"
            className={SELECT_CELL}
          />
        ) : (
          <div className={TD_TEXT}>{fmtLocationDe(row.location)}</div>
        )}
      </td>
      <td className={`${TD} whitespace-nowrap`}>
        <div className={`${TD_TEXT} text-ink-500`}>{fmtWhen(row.created_at)}</div>
      </td>
    </tr>
  );
}

function useFilterClickOutside(
  filterOpen: boolean,
  setFilterOpen: (v: boolean) => void,
) {
  useEffect(() => {
    if (!filterOpen) return;
    let remove: (() => void) | undefined;
    const id = requestAnimationFrame(() => {
      const onDown = (e: MouseEvent) => {
        const t = e.target as HTMLElement;
        if (t.closest?.("[data-crm-filter]")) return;
        setFilterOpen(false);
      };
      document.addEventListener("mousedown", onDown);
      remove = () => document.removeEventListener("mousedown", onDown);
    });
    return () => {
      cancelAnimationFrame(id);
      remove?.();
    };
  }, [filterOpen, setFilterOpen]);
}

export default function KundenCrmPage() {
  const { setHeaderTrailing } = useOutletContext<DashboardOutletContext>();

  const [qIn, setQIn] = useState("");
  const [q, setQ] = useState("");
  const [statusF, setStatusF] = useState("");
  const [locationF, setLocationF] = useState("");

  const [draftStatus, setDraftStatus] = useState("");
  const [draftLocation, setDraftLocation] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);

  const [offset, setOffset] = useState(0);
  const [formErr, setFormErr] = useState("");
  const [rowErr, setRowErr] = useState<Record<string, string>>({});
  const [newEmail, setNewEmail] = useState("");
  const [newCompany, setNewCompany] = useState("");
  const [newStatus, setNewStatus] = useState("Neu");
  const [newLocation, setNewLocation] = useState("");
  const [adding, setAdding] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [rowDraft, setRowDraft] = useState<CrmRowDraft | null>(null);
  const [savingRow, setSavingRow] = useState(false);

  useFilterClickOutside(filterOpen, setFilterOpen);

  useEffect(() => {
    const t = setTimeout(() => setQ(qIn), 400);
    return () => clearTimeout(t);
  }, [qIn]);

  useEffect(() => {
    setOffset(0);
  }, [q, statusF, locationF]);

  const listUrl = useMemo(
    () =>
      crmCustomersListUrl({
        q,
        limit: PAGE_SIZE,
        offset,
        status: statusF || undefined,
        location: locationF || undefined,
      }),
    [q, offset, statusF, locationF],
  );

  const { data, error, loading, reload } = useApi<CrmCustomersListResponse>(
    listUrl,
  );

  const listRows = useMemo((): CrmCustomerRow[] => {
    if (!data) return [];
    if (Array.isArray(data.rows)) return data.rows;
    return [];
  }, [data]);

  const updateDraft = useCallback(
    (patch: Partial<Pick<CrmRowDraft, "email" | "company" | "status" | "location">>) => {
      setRowDraft((d) => (d ? { ...d, ...patch } : d));
    },
    [],
  );

  const saveDraft = useCallback(async () => {
    if (!rowDraft) return;
    setSavingRow(true);
    setRowErr((e) => {
      const n = { ...e };
      delete n[rowDraft.id];
      return n;
    });
    const id = rowDraft.id;
    try {
      const res = await fetch(CRM_CUSTOMERS_API, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: rowDraft.id,
          email: rowDraft.email.trim(),
          company: rowDraft.company.trim() || null,
          status: rowDraft.status.trim() || "Neu",
          location: rowDraft.location.trim()
            ? rowDraft.location.trim().toUpperCase()
            : null,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setRowErr((e) => ({
          ...e,
          [id]: j.error || `HTTP ${res.status}`,
        }));
        return;
      }
      setRowDraft(null);
      setEditingId(null);
      reload();
    } catch (e) {
      setRowErr((err) => ({
        ...err,
        [id]: (e as Error).message,
      }));
    } finally {
      setSavingRow(false);
    }
  }, [rowDraft, reload]);

  const discardDraft = useCallback(() => {
    setRowDraft(null);
    setEditingId(null);
  }, []);

  const handleRowClick = useCallback(
    (row: CrmCustomerRow) => {
      if (editingId === row.id) return;
      if (editingId) {
        const currentRow = listRows.find((r) => r.id === editingId);
        if (
          rowDraft &&
          currentRow &&
          isDraftDirty(rowDraft, currentRow)
        ) {
          return;
        }
      }
      setEditingId(row.id);
      setRowDraft(rowToDraft(row));
    },
    [editingId, rowDraft, listRows],
  );

  const rowDirty = useMemo(() => {
    if (!rowDraft || !editingId) return false;
    const r = listRows.find((x) => x.id === rowDraft.id);
    if (!r) return false;
    return isDraftDirty(rowDraft, r);
  }, [rowDraft, editingId, listRows]);

  useEffect(() => {
    if (!editingId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      if (!rowDraft) {
        setEditingId(null);
        return;
      }
      const r = listRows.find((x) => x.id === rowDraft.id);
      if (r && isDraftDirty(rowDraft, r)) {
        discardDraft();
      } else {
        setRowDraft(null);
        setEditingId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editingId, rowDraft, listRows, discardDraft]);

  const applyFilter = useCallback(() => {
    setStatusF(draftStatus.trim());
    setLocationF(draftLocation.trim().toUpperCase());
    setFilterOpen(false);
  }, [draftStatus, draftLocation]);

  const clearFilter = useCallback(() => {
    setDraftStatus("");
    setDraftLocation("");
    setStatusF("");
    setLocationF("");
    setFilterOpen(false);
  }, []);

  useEffect(() => {
    if (filterOpen) {
      setDraftStatus(statusF);
      setDraftLocation(locationF);
    }
  }, [filterOpen, statusF, locationF]);

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
      setNewOpen(false);
      reload();
    } catch (e) {
      setFormErr((e as Error).message);
    } finally {
      setAdding(false);
    }
  }, [newEmail, newCompany, newStatus, newLocation, reload]);

  const headerToolbar = useMemo(
    () => (
      <div className="flex min-w-0 w-full max-w-3xl flex-1 items-center justify-end gap-1.5">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md border border-white/[0.1] bg-white/[0.04] px-2 py-1">
          <Search className="h-3.5 w-3.5 shrink-0 text-night-500" />
          <input
            type="search"
            value={qIn}
            onChange={(e) => setQIn(e.target.value)}
            placeholder="E-Mail oder Firma"
            className="min-w-0 flex-1 border-0 bg-transparent text-[12.5px] text-white placeholder:text-night-500 focus:outline-none"
          />
        </div>
        <div className="relative" data-crm-filter>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setFilterOpen((o) => !o);
            }}
            className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border text-night-200 transition hover:bg-white/[0.08] hover:text-white ${
              statusF || locationF
                ? "border-brand-500/50 bg-brand-500/15 text-brand-200"
                : "border-white/[0.1] bg-white/[0.04]"
            }`}
            title="Filter"
            aria-expanded={filterOpen}
          >
            <Filter className="h-4 w-4" />
          </button>
          {filterOpen && (
            <div
              className="absolute right-0 top-full z-50 mt-1 w-72 max-w-[calc(100vw-1rem)] rounded-lg border border-white/[0.1] bg-night-800 p-3 shadow-xl"
              data-crm-filter
              onClick={(e) => e.stopPropagation()}
            >
              <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-night-500">
                Filter
              </p>
              <label className="mb-1 block text-[11px] text-night-400">Status (exakt)</label>
              <input
                type="text"
                className="mb-3 w-full rounded border border-white/[0.08] bg-night-900 px-2 py-1.5 text-[12.5px] text-white"
                value={draftStatus}
                onChange={(e) => setDraftStatus(e.target.value)}
                placeholder="z. B. Neu"
              />
              <label className="mb-1 block text-[11px] text-night-400">Standort (ISO-2)</label>
              <select
                className="mb-3 w-full rounded border border-white/[0.08] bg-night-900 px-2 py-1.5 text-[12.5px] text-white"
                value={draftLocation}
                onChange={(e) => setDraftLocation(e.target.value)}
                aria-label="Filter Standort"
              >
                <option value="">— alle —</option>
                {ISO2_COUNTRIES.map((c) => (
                  <option key={c.iso2} value={c.iso2}>
                    {c.nameDe} ({c.iso2})
                  </option>
                ))}
              </select>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={clearFilter}
                  className="rounded px-2 py-1 text-[12px] text-night-400 hover:text-white"
                >
                  Zurücksetzen
                </button>
                <button
                  type="button"
                  onClick={applyFilter}
                  className="rounded bg-white/10 px-2.5 py-1 text-[12.5px] text-white hover:bg-white/20"
                >
                  Anwenden
                </button>
              </div>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => reload()}
          disabled={loading}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/[0.1] bg-white/[0.04] text-night-200 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-50"
          title="Aktualisieren"
        >
          <RefreshCw
            className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
          />
        </button>
        <button
          type="button"
          onClick={() => {
            setFormErr("");
            setNewOpen(true);
          }}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/[0.1] bg-white/[0.04] text-night-200 transition hover:bg-white/[0.1] hover:text-white"
          title="Neuer Kunde"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    ),
    [
      qIn,
      filterOpen,
      draftStatus,
      draftLocation,
      statusF,
      locationF,
      loading,
      applyFilter,
      clearFilter,
      reload,
    ],
  );

  useLayoutEffect(() => {
    setHeaderTrailing(headerToolbar);
    return () => setHeaderTrailing(null);
  }, [setHeaderTrailing, headerToolbar]);

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
      {error && (
        <p className="shrink-0 border-b border-accent-rose/30 bg-accent-rose/10 px-3 py-1.5 text-[12.5px] text-accent-rose" role="alert">
          {error}
        </p>
      )}

      {data?.schemaWarning && (
        <p
          className="shrink-0 border-b border-accent-amber/40 bg-accent-amber/10 px-3 py-1.5 text-[12.5px] text-accent-amber"
          role="status"
        >
          {data.schemaWarning}
        </p>
      )}

      <div className="min-h-0 flex-1 overflow-auto border-b border-hair">
        <table className="w-full min-w-[640px] border-collapse border border-black text-left text-[12.5px]">
          <thead className="sticky top-0 z-10 bg-ink-100/95 backdrop-blur-sm">
            <tr>
              <th className={TH}>ID</th>
              <th className={TH}>E-Mail</th>
              <th className={TH}>Firma</th>
              <th className={TH}>Status</th>
              <th className={TH}>Standort</th>
              <th className={TH}>Angelegt</th>
            </tr>
          </thead>
          <tbody>
            {loading && listRows.length === 0 && !error && (
              <tr>
                <td
                  colSpan={6}
                  className="border border-black bg-white px-2 py-6 text-center text-ink-500"
                >
                  Wird geladen…
                </td>
              </tr>
            )}
            {listRows.map((row) => (
              <CrmTableRow
                key={row.id}
                row={row}
                editing={editingId === row.id}
                draft={rowDraft}
                onField={updateDraft}
                onActivate={handleRowClick}
              />
            ))}
            {listRows.length === 0 && !loading && !error && (
              <tr>
                <td
                  colSpan={6}
                  className="border border-black bg-white px-2 py-6 text-center text-ink-500"
                >
                  Keine Einträge
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {rowDirty && (
        <div
          className="pointer-events-auto fixed bottom-20 left-1/2 z-[80] w-[min(100vw-1.5rem,28rem)] -translate-x-1/2 px-2"
          role="dialog"
          aria-label="Nicht gespeicherte Änderungen"
        >
          <div className="flex flex-col items-stretch justify-center gap-2 rounded-sm border-2 border-black bg-white p-3 shadow-lg sm:flex-row sm:items-center sm:gap-3">
            <span className="shrink-0 text-center text-[12.5px] font-medium text-ink-800 sm:text-left">
              Ungespeicherte Änderungen
            </span>
            <div className="flex w-full min-w-0 justify-center gap-2 sm:justify-end">
              <button
                type="button"
                onClick={discardDraft}
                disabled={savingRow}
                className="min-w-0 flex-1 rounded-sm border-2 border-black bg-white px-3 py-2 text-[12.5px] text-ink-800 hover:bg-ink-100 disabled:opacity-50 sm:flex-initial"
              >
                Nicht speichern
              </button>
              <button
                type="button"
                onClick={saveDraft}
                disabled={savingRow}
                className="min-w-0 flex-1 rounded-sm border-2 border-black bg-ink-900 px-3 py-2 text-[12.5px] font-medium text-white hover:bg-ink-800 disabled:opacity-50 sm:flex-initial"
              >
                {savingRow ? "…" : "Speichern"}
              </button>
            </div>
          </div>
        </div>
      )}

      {(data != null || loading) && (
        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-hair bg-paper/90 px-2 py-1.5 text-[12px] text-ink-600 sm:px-3">
          <span className="min-w-0 truncate">
            {data && typeof data.total === "number" && (
              <>
                {fmtNumber(data.total)} insgesamt
                {data.total > 0
                  ? ` · ${offset + 1}–${Math.min(offset + PAGE_SIZE, data.total)}`
                  : ""}
                {loading && " · …"}
              </>
            )}
            {loading && !data && "Laden…"}
            {data && !Array.isArray(data.rows) && !error && !loading && (
              <span className="ml-1 text-accent-amber">(Antwort unerwartet)</span>
            )}
          </span>
          {data && data.total > PAGE_SIZE && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className="rounded border border-hair bg-white px-2 py-0.5 text-[12px] enabled:hover:bg-ink-50 disabled:opacity-40"
                disabled={offset < PAGE_SIZE}
                onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
              >
                Zurück
              </button>
              <button
                type="button"
                className="rounded border border-hair bg-white px-2 py-0.5 text-[12px] enabled:hover:bg-ink-50 disabled:opacity-40"
                disabled={offset + PAGE_SIZE >= data.total}
                onClick={() => setOffset((o) => o + PAGE_SIZE)}
              >
                Weiter
              </button>
            </div>
          )}
        </div>
      )}

      {Object.entries(rowErr).map(([id, m]) => (
        <p key={id} className="shrink-0 text-[12px] text-accent-rose" role="alert">
          {id}: {m}
        </p>
      ))}

      {newOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-4 sm:items-center"
          onClick={() => setNewOpen(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-lg rounded-lg border border-hair bg-paper p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="crm-new-title"
          >
            <h2 id="crm-new-title" className="text-sm font-semibold text-ink-800">
              Neuer Kunde
            </h2>
            <div className="mt-3 flex flex-col gap-2 sm:grid sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-0.5 block text-[11px] text-ink-500">E-Mail *</label>
                <input
                  type="email"
                  className={TEXT_IN}
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="mb-0.5 block text-[11px] text-ink-500">Firma</label>
                <input
                  type="text"
                  className={TEXT_IN}
                  value={newCompany}
                  onChange={(e) => setNewCompany(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-0.5 block text-[11px] text-ink-500">Status</label>
                <input
                  type="text"
                  className={TEXT_IN}
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-0.5 block text-[11px] text-ink-500">Standort (optional)</label>
                <StandortSelect
                  value={newLocation}
                  onChange={setNewLocation}
                  ariaLabel="Standort neuer Kunde"
                />
              </div>
            </div>
            {formErr && (
              <p className="mt-2 text-[12.5px] text-accent-rose" role="alert">
                {formErr}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setNewOpen(false)}
                className="rounded-md border border-hair bg-white px-3 py-1.5 text-[12.5px] text-ink-700 hover:bg-ink-50"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={create}
                disabled={adding}
                className="inline-flex h-8 items-center gap-1 rounded-md border border-ink-900 bg-ink-900 px-3 text-[12.5px] text-white hover:bg-ink-800 disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" />
                {adding ? "…" : "Anlegen"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
