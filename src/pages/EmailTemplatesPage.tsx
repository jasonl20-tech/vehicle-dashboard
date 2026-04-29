import {
  ChevronRight,
  Copy,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import PageHeader from "../components/ui/PageHeader";
import { useApi, fmtNumber } from "../lib/customerApi";
import {
  createEmailTemplate,
  deleteEmailTemplate,
  emailTemplatesListUrl,
  type EmailTemplatesListResponse,
} from "../lib/emailTemplatesApi";

const PAGE_SIZE = 100;
const ID_RE = /^[a-zA-Z0-9_.\-:]+$/;

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

function fmtBytes(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export default function EmailTemplatesPage() {
  const navigate = useNavigate();

  const [qIn, setQIn] = useState("");
  const [q, setQ] = useState("");
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setQ(qIn), 300);
    return () => clearTimeout(t);
  }, [qIn]);

  useEffect(() => {
    setOffset(0);
  }, [q]);

  const listUrl = useMemo(
    () => emailTemplatesListUrl({ q, limit: PAGE_SIZE, offset }),
    [q, offset],
  );
  const { data, error, loading, reload } =
    useApi<EmailTemplatesListResponse>(listUrl);

  const [newOpen, setNewOpen] = useState(false);
  const [newId, setNewId] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [newCopyFrom, setNewCopyFrom] = useState<string>("");
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState<string | null>(null);

  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);

  const idValid = newId.trim().length > 0 && ID_RE.test(newId.trim());
  const create = useCallback(async () => {
    if (!idValid) {
      setCreateErr(
        "id darf nur a–z, A–Z, 0–9 und . _ - : enthalten",
      );
      return;
    }
    setCreating(true);
    setCreateErr(null);
    try {
      const created = await createEmailTemplate({
        id: newId.trim(),
        subject: newSubject.trim() || undefined,
        copy_from_id: newCopyFrom.trim() || undefined,
      });
      setNewId("");
      setNewSubject("");
      setNewCopyFrom("");
      setNewOpen(false);
      navigate(`/emails/templates/${encodeURIComponent(created.id)}`);
    } catch (e) {
      setCreateErr(e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  }, [idValid, newId, newSubject, newCopyFrom, navigate]);

  const onDuplicate = useCallback(
    async (sourceId: string) => {
      const proposal = `${sourceId}_copy`;
      const target = window.prompt(
        `Kopie von „${sourceId}“ — neue id eingeben:`,
        proposal,
      );
      if (!target) return;
      const trimmed = target.trim();
      if (!ID_RE.test(trimmed)) {
        window.alert(
          "Ungültige id. Erlaubt: a–z, A–Z, 0–9 und . _ - :",
        );
        return;
      }
      try {
        const created = await createEmailTemplate({
          id: trimmed,
          copy_from_id: sourceId,
        });
        navigate(`/emails/templates/${encodeURIComponent(created.id)}`);
      } catch (e) {
        window.alert(e instanceof Error ? e.message : String(e));
      }
    },
    [navigate],
  );

  const onDeleteConfirmed = useCallback(async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    setDeleteErr(null);
    try {
      await deleteEmailTemplate(confirmDelete);
      setConfirmDelete(null);
      reload();
    } catch (e) {
      setDeleteErr(e instanceof Error ? e.message : String(e));
    } finally {
      setDeleting(false);
    }
  }, [confirmDelete, reload]);

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;

  return (
    <>
      <PageHeader
        eyebrow="Emails"
        title="Email Templates"
        hideCalendarAndNotifications
        description={
          <>
            Vorlagen für transaktionale &amp; Marketing-Mails. Werden vom
            externen Mail-Worker beim Versand aus dieser Tabelle gelesen.
            Variablen wie{" "}
            <span className="font-mono text-[12.5px] text-ink-700">{`{{name}}`}</span>{" "}
            werden zur Laufzeit ersetzt.
          </>
        }
        rightSlot={
          <>
            <button
              type="button"
              onClick={reload}
              disabled={loading}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-hair bg-white text-ink-500 transition-colors hover:border-ink-300 hover:text-ink-800 disabled:opacity-50"
              title="Aktualisieren"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
              />
            </button>
            <button
              type="button"
              onClick={() => {
                setCreateErr(null);
                setNewOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-md bg-ink-900 px-3 py-1.5 text-[12.5px] font-medium text-white hover:bg-ink-800"
            >
              <Plus className="h-3.5 w-3.5" />
              Neue Vorlage
            </button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-ink-200/85 bg-white px-2.5 py-1.5 shadow-sm ring-1 ring-black/[0.05]">
          <Search className="h-3.5 w-3.5 shrink-0 text-ink-400" />
          <input
            type="search"
            value={qIn}
            onChange={(e) => setQIn(e.target.value)}
            placeholder="Nach id oder Betreff suchen…"
            className="min-w-0 flex-1 border-0 bg-transparent text-[12.5px] text-ink-900 placeholder:text-ink-400 focus:outline-none"
          />
        </div>
        {data && (
          <span className="text-[11.5px] tabular-nums text-ink-500">
            {fmtNumber(total)} insgesamt
            {q ? ` · ${rows.length} Treffer` : ""}
          </span>
        )}
      </div>

      {error && (
        <p
          className="mb-4 border-l-2 border-accent-rose px-3 py-2 text-[12.5px] text-accent-rose"
          role="alert"
        >
          {error}
        </p>
      )}

      {data?.hint && !error && (
        <p
          className="mb-4 border-l-2 border-accent-amber px-3 py-2 text-[12.5px] text-accent-amber"
          role="status"
        >
          {data.hint}
        </p>
      )}

      <div className="overflow-hidden rounded-xl border border-ink-200/70 bg-white shadow-sm shadow-ink-900/[0.06] ring-1 ring-ink-100/90">
        <table className="w-full border-collapse text-[12.5px]">
          <thead className="bg-gradient-to-b from-ink-50/95 to-ink-100/90">
            <tr className="text-left text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-500">
              <th className="px-4 py-2.5">id</th>
              <th className="px-4 py-2.5">Betreff</th>
              <th className="px-4 py-2.5 text-right">Größe</th>
              <th className="px-4 py-2.5 text-right">Aktualisiert</th>
              <th className="px-4 py-2.5 text-right">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-10 text-center text-[12.5px] text-ink-500"
                >
                  Wird geladen…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && !error && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-10 text-center text-[12.5px] text-ink-500"
                >
                  Keine Vorlagen.{" "}
                  <button
                    type="button"
                    className="text-ink-700 underline underline-offset-2 hover:text-ink-900"
                    onClick={() => setNewOpen(true)}
                  >
                    Jetzt anlegen
                  </button>
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr
                key={r.id}
                className="cursor-pointer border-t border-hair transition-colors hover:bg-ink-50/60"
                onClick={() =>
                  navigate(`/emails/templates/${encodeURIComponent(r.id)}`)
                }
              >
                <td className="px-4 py-2.5 align-middle font-mono text-[12px] text-ink-800">
                  <span className="block max-w-[28ch] truncate" title={r.id}>
                    {r.id}
                  </span>
                </td>
                <td className="px-4 py-2.5 align-middle text-ink-800">
                  <span
                    className="block max-w-[60ch] truncate"
                    title={r.subject}
                  >
                    {r.subject || "—"}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right align-middle tabular-nums text-ink-500">
                  {fmtBytes(r.length)}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right align-middle tabular-nums text-ink-500">
                  {fmtWhen(r.updated_at)}
                </td>
                <td
                  className="whitespace-nowrap px-4 py-2.5 text-right align-middle"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      title="Duplizieren"
                      onClick={() => onDuplicate(r.id)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-hair bg-white text-ink-500 transition hover:border-ink-300 hover:text-ink-800"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Löschen"
                      onClick={() => {
                        setDeleteErr(null);
                        setConfirmDelete(r.id);
                      }}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-hair bg-white text-ink-500 transition hover:border-accent-rose/60 hover:text-accent-rose"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <Link
                      to={`/emails/templates/${encodeURIComponent(r.id)}`}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-hair bg-white text-ink-500 transition hover:border-ink-300 hover:text-ink-800"
                      title="Bearbeiten"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data && data.total > PAGE_SIZE && (
        <div className="mt-3 flex items-center justify-end gap-1.5 text-[12px] text-ink-600">
          <span className="mr-2 tabular-nums">
            {offset + 1}–{Math.min(offset + PAGE_SIZE, data.total)} /{" "}
            {fmtNumber(data.total)}
          </span>
          <button
            type="button"
            className="rounded border border-hair bg-white px-2 py-0.5 enabled:hover:bg-ink-50 disabled:opacity-40"
            disabled={offset < PAGE_SIZE}
            onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
          >
            Zurück
          </button>
          <button
            type="button"
            className="rounded border border-hair bg-white px-2 py-0.5 enabled:hover:bg-ink-50 disabled:opacity-40"
            disabled={offset + PAGE_SIZE >= data.total}
            onClick={() => setOffset((o) => o + PAGE_SIZE)}
          >
            Weiter
          </button>
        </div>
      )}

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
            aria-labelledby="tpl-new-title"
          >
            <h2 id="tpl-new-title" className="text-sm font-semibold text-ink-800">
              Neue Vorlage
            </h2>
            <p className="mt-1 text-[12px] text-ink-500">
              Die <span className="font-mono">id</span> wird vom Mail-Worker zum
              Auswählen verwendet (z. B.{" "}
              <span className="font-mono">trial_followup_1</span>).
            </p>
            <div className="mt-3 space-y-3">
              <label className="block">
                <span className="mb-1 block text-[11px] uppercase tracking-[0.12em] text-ink-500">
                  id *
                </span>
                <input
                  type="text"
                  value={newId}
                  onChange={(e) => setNewId(e.target.value)}
                  placeholder="trial_followup_1"
                  className="w-full rounded border border-hair bg-white px-2 py-1.5 font-mono text-[12.5px] text-ink-900 focus:border-ink-400 focus:outline-none"
                  autoFocus
                />
                {!idValid && newId.length > 0 && (
                  <span className="mt-1 block text-[11.5px] text-accent-rose">
                    Erlaubt: a–z, A–Z, 0–9 und . _ - :
                  </span>
                )}
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] uppercase tracking-[0.12em] text-ink-500">
                  Betreff
                </span>
                <input
                  type="text"
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  placeholder="Optional – kann später bearbeitet werden"
                  className="w-full rounded border border-hair bg-white px-2 py-1.5 text-[12.5px] text-ink-900 focus:border-ink-400 focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] uppercase tracking-[0.12em] text-ink-500">
                  Aus Vorlage kopieren (optional)
                </span>
                <select
                  value={newCopyFrom}
                  onChange={(e) => setNewCopyFrom(e.target.value)}
                  className="w-full rounded border border-hair bg-white px-2 py-1.5 text-[12.5px] text-ink-900 focus:border-ink-400 focus:outline-none"
                >
                  <option value="">— leer starten —</option>
                  {rows.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.id} — {r.subject}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {createErr && (
              <p className="mt-3 text-[12.5px] text-accent-rose" role="alert">
                {createErr}
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
                disabled={creating || !idValid}
                className="inline-flex items-center gap-1 rounded-md border border-ink-900 bg-ink-900 px-3 py-1.5 text-[12.5px] font-medium text-white hover:bg-ink-800 disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" />
                {creating ? "Anlegen…" : "Anlegen & Bearbeiten"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-4 sm:items-center"
          onClick={() => !deleting && setConfirmDelete(null)}
          role="presentation"
        >
          <div
            className="w-full max-w-md rounded-lg border border-hair bg-paper p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="tpl-del-title"
          >
            <h2 id="tpl-del-title" className="text-sm font-semibold text-ink-800">
              Vorlage löschen?
            </h2>
            <p className="mt-2 text-[12.5px] text-ink-600">
              <span className="font-mono">{confirmDelete}</span> wird endgültig
              gelöscht. Mails, die diese id verwenden, schlagen danach fehl.
            </p>
            {deleteErr && (
              <p className="mt-3 text-[12.5px] text-accent-rose" role="alert">
                {deleteErr}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setConfirmDelete(null)}
                className="rounded-md border border-hair bg-white px-3 py-1.5 text-[12.5px] text-ink-700 hover:bg-ink-50 disabled:opacity-50"
              >
                Abbrechen
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={onDeleteConfirmed}
                className="inline-flex items-center gap-1 rounded-md border border-accent-rose bg-accent-rose px-3 py-1.5 text-[12.5px] font-medium text-white hover:bg-accent-rose/90 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {deleting ? "Lösche…" : "Endgültig löschen"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
