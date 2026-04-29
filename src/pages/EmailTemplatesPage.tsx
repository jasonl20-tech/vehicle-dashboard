/**
 * Email-Templates: kombinierte Liste + visueller Editor in einem Split-View.
 *
 * Linke Spalte: Vorlagen-Liste (suchbar, einklappbar).
 * Rechte Spalte: gewählte Vorlage – mit zwei Bearbeitungsmodi:
 *   - "Builder": visueller Drag-and-Drop-Editor (Unlayer / react-email-editor)
 *   - "HTML":    rohe HTML-Body-Textarea für Custom-Mails
 *
 * Speicher-Strategie (ohne Schema-Wechsel):
 *   body_html in der DB enthält **vorne** einen unsichtbaren HTML-Kommentar
 *   mit dem Builder-Design-JSON (base64), gefolgt vom gerenderten HTML.
 *   Der externe Mail-Worker schickt body_html unverändert raus — Mail-
 *   Clients ignorieren HTML-Kommentare.
 *
 * Persistenz: aside-collapse + viewMode in localStorage.
 */
import {
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  Code2,
  Copy,
  LayoutGrid,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";
import type { DashboardOutletContext } from "../components/layout/dashboardOutletContext";
import type { EmailUnlayerEditorHandle } from "../components/emails/EmailUnlayerEditor";
import { useApi, fmtNumber } from "../lib/customerApi";
import {
  EMAIL_TEMPLATE_VARIABLES,
  createEmailTemplate,
  deleteEmailTemplate,
  emailTemplateUrl,
  emailTemplatesListUrl,
  updateEmailTemplate,
  type EmailTemplate,
  type EmailTemplatesListResponse,
} from "../lib/emailTemplatesApi";
import { embedDesign, extractDesign } from "../lib/unlayerDesign";

const EmailUnlayerEditor = lazy(
  () => import("../components/emails/EmailUnlayerEditor"),
);

const PAGE_SIZE = 200;
const ID_RE = /^[a-zA-Z0-9_.\-:]+$/;

const noopSetHeader: DashboardOutletContext["setHeaderTrailing"] = () => {};

const ASIDE_COLLAPSE_KEY = "ui.emailTemplates.asideCollapsed";
const VIEW_MODE_KEY = "ui.emailTemplates.viewMode";

type ViewMode = "builder" | "html";

function readAsideCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(ASIDE_COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeAsideCollapsed(v: boolean): void {
  try {
    window.localStorage.setItem(ASIDE_COLLAPSE_KEY, v ? "1" : "0");
  } catch {
    // bewusst leer
  }
}

function readViewMode(): ViewMode {
  if (typeof window === "undefined") return "builder";
  try {
    const v = window.localStorage.getItem(VIEW_MODE_KEY);
    return v === "html" ? "html" : "builder";
  } catch {
    return "builder";
  }
}

function writeViewMode(v: ViewMode): void {
  try {
    window.localStorage.setItem(VIEW_MODE_KEY, v);
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

export default function EmailTemplatesPage() {
  // Defensive gegen `undefined` (Fallback für verschachtelte Outlet-Layouts).
  const ctx = useOutletContext<DashboardOutletContext | undefined>();
  const setHeaderTrailing = ctx?.setHeaderTrailing ?? noopSetHeader;
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get("id") ?? "";

  // ---- Aside einklappbar ----
  const [asideCollapsed, setAsideCollapsed] = useState<boolean>(
    readAsideCollapsed,
  );
  const toggleAside = useCallback(() => {
    setAsideCollapsed((v) => {
      const next = !v;
      writeAsideCollapsed(next);
      return next;
    });
  }, []);

  // ---- Liste ----
  const [qIn, setQIn] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setQ(qIn), 250);
    return () => clearTimeout(t);
  }, [qIn]);

  const listUrl = useMemo(
    () => emailTemplatesListUrl({ q, limit: PAGE_SIZE }),
    [q],
  );
  const list = useApi<EmailTemplatesListResponse>(listUrl);

  // ---- Aktuell geladene Vorlage ----
  const oneUrl = selectedId ? emailTemplateUrl(selectedId) : null;
  const one = useApi<EmailTemplate>(oneUrl);

  const [subject, setSubject] = useState("");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  // ---- Builder / HTML-Modus ----
  const [viewMode, setViewMode] = useState<ViewMode>(readViewMode);
  /**
   * `htmlOnly` ist body_html ohne den UNLAYER_DESIGN-Marker — das ist,
   * was der HTML-Modus dem User zeigt und was beim direkten HTML-Save
   * geschickt wird (ggf. wieder mit Design-Marker versehen).
   */
  const [htmlOnly, setHtmlOnly] = useState("");
  /**
   * Letztes geladenes Builder-Design. Source-of-Truth wenn Builder aktiv
   * ist (in dem Fall liefert der Editor selbst den frischesten Stand).
   */
  const [design, setDesign] = useState<unknown | null>(null);

  useEffect(() => {
    if (!one.data) return;
    setSubject(one.data.subject);
    setSavedAt(one.data.updated_at);
    const { design: d, htmlWithoutMarker } = extractDesign(one.data.body_html);
    setHtmlOnly(htmlWithoutMarker);
    setDesign(d);
    setDirty(false);
  }, [one.data?.id, one.data?.updated_at]);

  // ---- Anlegen ----
  const [newOpen, setNewOpen] = useState(false);
  const [newId, setNewId] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [newCopyFrom, setNewCopyFrom] = useState("");
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState<string | null>(null);

  const idValid = newId.trim().length > 0 && ID_RE.test(newId.trim());

  const create = useCallback(async () => {
    if (!idValid) {
      setCreateErr("id darf nur a–z, A–Z, 0–9 und . _ - : enthalten");
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
      list.reload();
      setSearchParams({ id: created.id });
    } catch (e) {
      setCreateErr(e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  }, [idValid, newId, newSubject, newCopyFrom, list, setSearchParams]);

  // ---- Löschen ----
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);

  const onDeleteConfirmed = useCallback(async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    setDeleteErr(null);
    try {
      await deleteEmailTemplate(confirmDelete);
      const wasSelected = confirmDelete === selectedId;
      setConfirmDelete(null);
      list.reload();
      if (wasSelected) {
        setSearchParams({}, { replace: true });
      }
    } catch (e) {
      setDeleteErr(e instanceof Error ? e.message : String(e));
    } finally {
      setDeleting(false);
    }
  }, [confirmDelete, selectedId, list, setSearchParams]);

  // ---- Duplizieren ----
  const onDuplicate = useCallback(
    async (sourceId: string) => {
      const target = window.prompt(
        `Kopie von „${sourceId}“ — neue id eingeben:`,
        `${sourceId}_copy`,
      );
      if (!target) return;
      const trimmed = target.trim();
      if (!ID_RE.test(trimmed)) {
        window.alert("Ungültige id. Erlaubt: a–z, A–Z, 0–9 und . _ - :");
        return;
      }
      try {
        const created = await createEmailTemplate({
          id: trimmed,
          copy_from_id: sourceId,
        });
        list.reload();
        setSearchParams({ id: created.id });
      } catch (e) {
        window.alert(e instanceof Error ? e.message : String(e));
      }
    },
    [list, setSearchParams],
  );

  // ---- Speichern + Rename ----
  const editorRef = useRef<EmailUnlayerEditorHandle | null>(null);
  const htmlTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  /**
   * Sammelt den finalen body_html-String je nach aktivem Modus.
   *
   * - Builder: Editor liefert frisches HTML + Design via Callback. Wir
   *   verpacken Design vorne als HTML-Kommentar, und schicken alles als
   *   `body_html`.
   * - HTML: User-Textarea ist die Quelle. Wenn ein Builder-Design noch
   *   existiert (frühere Bearbeitung), behalten wir es — beim erneuten
   *   Öffnen im Builder-Modus ist das Design wieder da (das sichtbare
   *   HTML wurde direkt editiert, das Design ist evtl. nicht mehr deckungs-
   *   gleich → der User wird über ein Banner gewarnt).
   */
  const collectBodyHtml = useCallback(
    (cb: (final: string) => void) => {
      if (viewMode === "builder") {
        const ed = editorRef.current;
        if (!ed) {
          cb(embedDesign(design, htmlOnly || one.data?.body_html || ""));
          return;
        }
        ed.getResult(({ design: d, html }) => {
          cb(embedDesign(d ?? design, html || htmlOnly));
        });
        return;
      }
      // HTML-Modus
      cb(embedDesign(design, htmlOnly || one.data?.body_html || ""));
    },
    [viewMode, design, htmlOnly, one.data?.body_html],
  );

  const switchViewMode = useCallback(
    (next: ViewMode) => {
      setViewMode((prev) => {
        if (prev === next) return prev;
        if (prev === "builder" && next === "html") {
          // Builder → HTML: aktuellen Stand aus dem Editor ziehen
          const ed = editorRef.current;
          if (ed) {
            ed.getResult(({ design: d, html }) => {
              if (d) setDesign(d);
              if (typeof html === "string") setHtmlOnly(html);
            });
          }
        } else if (prev === "html" && next === "builder") {
          // HTML → Builder: Design wieder in Editor laden (falls vorhanden)
          editorRef.current?.loadDesign(design);
        }
        writeViewMode(next);
        return next;
      });
    },
    [design],
  );

  const onSave = useCallback(async () => {
    if (!one.data) return;
    setSaving(true);
    setSaveErr(null);
    collectBodyHtml(async (finalHtml) => {
      try {
        const updated = await updateEmailTemplate(one.data!.id, {
          subject: subject.trim() || one.data!.subject,
          body_html: finalHtml,
        });
        const { design: d, htmlWithoutMarker } = extractDesign(
          updated.body_html,
        );
        setSavedAt(updated.updated_at);
        setHtmlOnly(htmlWithoutMarker);
        setDesign(d);
        setDirty(false);
        list.reload();
      } catch (e) {
        setSaveErr(e instanceof Error ? e.message : String(e));
      } finally {
        setSaving(false);
      }
    });
  }, [one.data, subject, list, collectBodyHtml]);

  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  const onRename = useCallback(() => {
    if (!one.data) return;
    const next = renameValue.trim();
    if (!next || next === one.data.id) {
      setRenameOpen(false);
      return;
    }
    setSaving(true);
    setSaveErr(null);
    collectBodyHtml(async (finalHtml) => {
      try {
        const updated = await updateEmailTemplate(one.data!.id, {
          new_id: next,
          subject: subject.trim() || one.data!.subject,
          body_html: finalHtml,
        });
        const { design: d, htmlWithoutMarker } = extractDesign(
          updated.body_html,
        );
        setRenameOpen(false);
        setHtmlOnly(htmlWithoutMarker);
        setDesign(d);
        setDirty(false);
        list.reload();
        setSearchParams({ id: updated.id }, { replace: true });
      } catch (e) {
        setSaveErr(e instanceof Error ? e.message : String(e));
      } finally {
        setSaving(false);
      }
    });
  }, [one.data, renameValue, subject, list, setSearchParams, collectBodyHtml]);

  // ---- Variablen-Dropdown ----
  const [varOpen, setVarOpen] = useState(false);
  const insertVariable = useCallback(
    (token: string) => {
      setVarOpen(false);
      if (viewMode === "html") {
        const ta = htmlTextareaRef.current;
        if (ta) {
          const start = ta.selectionStart ?? ta.value.length;
          const end = ta.selectionEnd ?? ta.value.length;
          const next =
            ta.value.slice(0, start) + token + ta.value.slice(end);
          setHtmlOnly(next);
          requestAnimationFrame(() => {
            ta.focus();
            const pos = start + token.length;
            ta.setSelectionRange(pos, pos);
          });
        } else {
          setHtmlOnly((b) => b + token);
        }
        setDirty(true);
      } else {
        // Builder: Token wird in die Zwischenablage gelegt — der User
        // kann ihn dann in Text-Tools einfügen (oder die nativen
        // Merge-Tag-Pillen aus der Editor-Toolbar nutzen).
        editorRef.current?.insertMergeTag(token);
      }
    },
    [viewMode],
  );
  const insertVariableIntoSubject = useCallback((token: string) => {
    setVarOpen(false);
    setSubject((s) => `${s}${s ? " " : ""}${token}`);
    setDirty(true);
  }, []);

  useEffect(() => {
    if (!varOpen) return;
    const onDoc = () => setVarOpen(false);
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [varOpen]);

  // ⌘S / Ctrl+S Shortcut
  useEffect(() => {
    if (!one.data) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        onSave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [one.data, onSave]);

  // BeforeUnload-Warnung
  useEffect(() => {
    if (!dirty) return;
    const onBefore = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBefore);
    return () => window.removeEventListener("beforeunload", onBefore);
  }, [dirty]);

  // ---- Header-Toolbar ----
  const headerToolbar = useMemo(
    () => (
      <div className="flex min-w-0 w-full flex-1 items-center justify-end gap-1.5">
        {one.data && (
          <span className="hidden truncate text-[11.5px] tabular-nums text-night-500 sm:block">
            {savedAt ? `Gespeichert: ${fmtWhen(savedAt)}` : "—"}
            {dirty ? " · ungespeichert" : ""}
          </span>
        )}
        {one.data && (
          <div className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setVarOpen((o) => !o);
              }}
              className="inline-flex h-9 items-center gap-1 rounded-md border border-white/[0.1] bg-white/[0.04] px-2.5 text-[12.5px] text-night-200 transition hover:bg-white/[0.08] hover:text-white"
              title="Variable einfügen / kopieren"
            >
              {`{{var}}`}
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {varOpen && (
              <div
                className="absolute right-0 top-full z-50 mt-1 w-72 rounded-lg border border-white/[0.1] bg-night-800 p-1 shadow-xl"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
              >
                <p className="px-2 pb-1 pt-1 text-[10.5px] uppercase tracking-wider text-night-500">
                  {viewMode === "html"
                    ? "In HTML einfügen"
                    : "In Zwischenablage kopieren"}
                </p>
                <div className="max-h-72 overflow-y-auto">
                  {EMAIL_TEMPLATE_VARIABLES.map((v) => (
                    <button
                      key={v.token}
                      type="button"
                      onClick={() => insertVariable(v.token)}
                      className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-[12.5px] text-night-100 hover:bg-white/[0.06]"
                    >
                      <span className="font-mono text-night-100">{v.token}</span>
                      <span className="truncate text-[11.5px] text-night-400">
                        {v.label}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="mt-1 border-t border-white/[0.08] pt-1">
                  <p className="px-2 pb-1 pt-1 text-[10.5px] uppercase tracking-wider text-night-500">
                    In Betreff einfügen
                  </p>
                  <div className="grid grid-cols-2 gap-1 px-1 pb-1">
                    {EMAIL_TEMPLATE_VARIABLES.slice(0, 6).map((v) => (
                      <button
                        key={v.token}
                        type="button"
                        onClick={() => insertVariableIntoSubject(v.token)}
                        className="rounded px-2 py-1 text-left font-mono text-[11.5px] text-night-100 hover:bg-white/[0.06]"
                      >
                        {v.token}
                      </button>
                    ))}
                  </div>
                </div>
                {viewMode === "builder" && (
                  <p className="border-t border-white/[0.08] px-2 py-1.5 text-[10.5px] text-night-500">
                    Im Builder selbst kannst du Merge-Tags auch direkt aus
                    dem Text-Tool-Menü einfügen.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
        <button
          type="button"
          onClick={() => list.reload()}
          disabled={list.loading}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/[0.1] bg-white/[0.04] text-night-200 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-50"
          title="Liste aktualisieren"
        >
          <RefreshCw
            className={`h-4 w-4 ${list.loading || one.loading ? "animate-spin" : ""}`}
          />
        </button>
        <button
          type="button"
          onClick={() => {
            setCreateErr(null);
            setNewOpen(true);
          }}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/[0.1] bg-white/[0.04] text-night-200 transition hover:bg-white/[0.1] hover:text-white"
          title="Neue Vorlage"
        >
          <Plus className="h-4 w-4" />
        </button>
        {one.data && (
          <button
            type="button"
            onClick={onSave}
            disabled={saving || !one.data}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-white/15 bg-white px-3 text-[12.5px] font-medium text-ink-900 transition hover:bg-white/95 disabled:opacity-50"
            title="Speichern (⌘S)"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            {saving ? "Speichere…" : "Speichern"}
          </button>
        )}
      </div>
    ),
    [
      one.data,
      one.loading,
      savedAt,
      dirty,
      varOpen,
      viewMode,
      list.loading,
      saving,
      onSave,
      list,
      insertVariable,
      insertVariableIntoSubject,
    ],
  );

  useLayoutEffect(() => {
    setHeaderTrailing(headerToolbar);
    return () => setHeaderTrailing(null);
  }, [setHeaderTrailing, headerToolbar]);

  const rows = list.data?.rows ?? [];
  const total = list.data?.total ?? 0;

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
            title="Vorlagenliste einblenden"
            aria-label="Vorlagenliste einblenden"
            aria-expanded={false}
            className="group flex h-10 w-full shrink-0 items-center justify-center gap-1.5 border-b border-hair bg-ink-50 text-[11px] font-medium uppercase tracking-[0.12em] text-ink-700 transition hover:bg-ink-100 hover:text-ink-900 md:h-auto md:w-10 md:flex-col md:gap-2 md:border-b-0 md:border-r md:py-3 md:text-[10px]"
          >
            <ChevronsRight className="h-4 w-4 shrink-0" />
            <span className="md:[writing-mode:vertical-rl] md:[transform:rotate(180deg)]">
              Vorlagen
            </span>
          </button>
        ) : (
          <aside className="flex w-full shrink-0 flex-col border-b border-hair bg-white md:w-[300px] md:border-b-0 md:border-r">
            <div className="shrink-0 border-b border-hair p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-500">
                  Vorlagen
                </p>
                <button
                  type="button"
                  onClick={toggleAside}
                  title="Liste einklappen"
                  aria-label="Vorlagenliste einklappen"
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
                  placeholder="id oder Betreff…"
                  className="min-w-0 flex-1 border-0 bg-transparent text-[12.5px] text-ink-900 placeholder:text-ink-400 focus:outline-none"
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] tabular-nums text-ink-500">
                <span>
                  {fmtNumber(total)} Vorlagen
                  {q ? ` · ${rows.length} Treffer` : ""}
                </span>
                {list.loading && (
                  <Loader2 className="h-3 w-3 animate-spin" />
                )}
              </div>
            </div>
            <ul className="min-h-0 flex-1 divide-y divide-hair overflow-y-auto">
              {!list.loading && rows.length === 0 && (
                <li className="px-4 py-6 text-center text-[12.5px] text-ink-500">
                  Keine Vorlagen.{" "}
                  <button
                    type="button"
                    onClick={() => setNewOpen(true)}
                    className="text-ink-700 underline underline-offset-2 hover:text-ink-900"
                  >
                    Jetzt anlegen
                  </button>
                </li>
              )}
              {rows.map((r) => {
                const active = r.id === selectedId;
                return (
                  <li key={r.id}>
                    <div
                      className={`group flex w-full items-center gap-1.5 px-3 py-2 transition ${
                        active
                          ? "bg-ink-50/70"
                          : "hover:bg-ink-50/50"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setSearchParams({ id: r.id })}
                        className="flex min-w-0 flex-1 flex-col items-start text-left"
                      >
                        <span
                          className={`block max-w-full truncate font-mono text-[12px] ${
                            active ? "text-ink-900" : "text-ink-700"
                          }`}
                          title={r.id}
                        >
                          {r.id}
                        </span>
                        <span
                          className="mt-0.5 block max-w-full truncate text-[11.5px] text-ink-500"
                          title={r.subject}
                        >
                          {r.subject || "—"}
                        </span>
                      </button>
                      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100 [&>button]:h-6 [&>button]:w-6">
                        <button
                          type="button"
                          title="Duplizieren"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDuplicate(r.id);
                          }}
                          className="inline-flex items-center justify-center rounded text-ink-500 hover:bg-ink-100 hover:text-ink-800"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Löschen"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteErr(null);
                            setConfirmDelete(r.id);
                          }}
                          className="inline-flex items-center justify-center rounded text-ink-500 hover:bg-ink-100 hover:text-accent-rose"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </aside>
        )}

        {/* Rechter Bereich: Editor */}
        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          {selectedId ? (
            <>
              <div className="flex shrink-0 items-center gap-2 border-b border-hair bg-white px-3 py-2 sm:gap-3 sm:px-4">
                <button
                  type="button"
                  onClick={() => {
                    setRenameValue(selectedId);
                    setRenameOpen(true);
                  }}
                  className="group inline-flex min-w-0 items-center gap-1 rounded-md border border-transparent px-1.5 py-1 font-mono text-[12.5px] text-ink-700 hover:border-hair hover:bg-ink-50/60"
                  title="ID umbenennen"
                  disabled={!one.data}
                >
                  <span className="max-w-[20ch] truncate">{selectedId}</span>
                  <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-70" />
                </button>
                <span className="text-ink-400">›</span>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => {
                    setSubject(e.target.value);
                    setDirty(true);
                  }}
                  placeholder="Betreff der Email"
                  disabled={!one.data}
                  className="min-w-0 flex-1 rounded-md border border-hair bg-white px-2.5 py-1.5 text-[13px] text-ink-900 placeholder:text-ink-400 focus:border-ink-400 focus:outline-none disabled:opacity-60"
                />
              </div>
              <div className="flex shrink-0 items-center justify-between gap-2 border-b border-hair bg-paper/60 px-3 py-1.5 sm:px-4">
                <div
                  role="tablist"
                  aria-label="Bearbeitungsmodus"
                  className="inline-flex rounded-md border border-hair bg-white p-0.5"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={viewMode === "builder"}
                    onClick={() => switchViewMode("builder")}
                    disabled={!one.data}
                    className={`inline-flex items-center gap-1 rounded-[5px] px-2.5 py-1 text-[12px] font-medium transition disabled:opacity-50 ${
                      viewMode === "builder"
                        ? "bg-ink-900 text-white"
                        : "text-ink-600 hover:text-ink-900"
                    }`}
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                    Builder
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={viewMode === "html"}
                    onClick={() => switchViewMode("html")}
                    disabled={!one.data}
                    className={`inline-flex items-center gap-1 rounded-[5px] px-2.5 py-1 text-[12px] font-medium transition disabled:opacity-50 ${
                      viewMode === "html"
                        ? "bg-ink-900 text-white"
                        : "text-ink-600 hover:text-ink-900"
                    }`}
                  >
                    <Code2 className="h-3.5 w-3.5" />
                    HTML
                  </button>
                </div>
                <span className="text-[11px] tabular-nums text-ink-400">
                  {viewMode === "html"
                    ? `${htmlOnly.length.toLocaleString("de-DE")} Zeichen HTML`
                    : design
                      ? "Drag-and-Drop · Vorschau · Merge-Tags"
                      : "leeres Layout — links Block reinziehen"}
                </span>
              </div>
              {(one.error || saveErr) && (
                <p
                  className="shrink-0 border-b border-accent-rose/30 bg-accent-rose/10 px-3 py-1.5 text-[12.5px] text-accent-rose sm:px-5"
                  role="alert"
                >
                  {one.error || saveErr}
                </p>
              )}
              {viewMode === "html" && design != null && (
                <p
                  className="shrink-0 border-b border-accent-amber/30 bg-accent-amber/10 px-3 py-1.5 text-[11.5px] text-accent-amber sm:px-5"
                  role="status"
                >
                  Hinweis: Diese Vorlage hat einen Builder-Layout. Wenn du
                  hier direkt das HTML editierst, weicht es vom Builder-Stand
                  ab. Beim nächsten Speichern im Builder-Modus überschreibt
                  der Builder dein Custom-HTML wieder.
                </p>
              )}
              <div className="relative min-h-0 flex-1 bg-white">
                {one.loading && !one.data && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70">
                    <p className="inline-flex items-center gap-2 text-[12.5px] text-ink-500">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Lade Vorlage…
                    </p>
                  </div>
                )}
                {one.data && (
                  <>
                    {/*
                      Unlayer-Editor wird montiert sobald ein Template geladen
                      ist und bleibt montiert, auch wenn der HTML-Modus aktiv
                      ist — sonst würde der iframe jeden Tab-Switch neu laden.
                    */}
                    <div
                      className={
                        viewMode === "builder" ? "absolute inset-0" : "hidden"
                      }
                    >
                      <Suspense
                        fallback={
                          <div className="absolute inset-0 flex items-center justify-center">
                            <p className="inline-flex items-center gap-2 text-[12.5px] text-ink-500">
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              Builder wird geladen…
                            </p>
                          </div>
                        }
                      >
                        <EmailUnlayerEditor
                          key={one.data.id}
                          ref={editorRef}
                          initialDesign={design}
                          onDirtyChange={setDirty}
                        />
                      </Suspense>
                    </div>
                    {viewMode === "html" && (
                      <div className="absolute inset-0 flex flex-col bg-ink-900">
                        <textarea
                          ref={htmlTextareaRef}
                          value={htmlOnly}
                          onChange={(e) => {
                            setHtmlOnly(e.target.value);
                            setDirty(true);
                          }}
                          spellCheck={false}
                          className="min-h-0 w-full flex-1 resize-none border-0 bg-ink-900 p-4 font-mono text-[12.5px] leading-relaxed text-ink-100 placeholder:text-ink-500 focus:outline-none focus:ring-0"
                          placeholder="<table>… eigenes Email-HTML hier einfügen …</table>"
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-10 text-center">
              <p className="text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-400">
                Keine Vorlage ausgewählt
              </p>
              <p className="max-w-sm text-[13px] leading-relaxed text-ink-500">
                Wähle links eine Vorlage zum Bearbeiten oder lege eine neue an.
              </p>
              <button
                type="button"
                onClick={() => setNewOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-md bg-ink-900 px-3 py-1.5 text-[12.5px] font-medium text-white hover:bg-ink-800"
              >
                <Plus className="h-3.5 w-3.5" />
                Neue Vorlage
              </button>
            </div>
          )}
        </section>
      </div>

      {/* Anlegen-Modal */}
      {newOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-4 sm:items-center"
          onClick={() => !creating && setNewOpen(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-lg rounded-lg border border-hair bg-paper p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="tpl-new-title"
          >
            <h2
              id="tpl-new-title"
              className="text-sm font-semibold text-ink-800"
            >
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
                disabled={creating}
                onClick={() => setNewOpen(false)}
                className="rounded-md border border-hair bg-white px-3 py-1.5 text-[12.5px] text-ink-700 hover:bg-ink-50 disabled:opacity-50"
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

      {/* Löschen-Modal */}
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
            <h2
              id="tpl-del-title"
              className="text-sm font-semibold text-ink-800"
            >
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

      {/* Rename-Modal */}
      {renameOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-4 sm:items-center"
          onClick={() => !saving && setRenameOpen(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-md rounded-lg border border-hair bg-paper p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="tpl-rename-title"
          >
            <div className="mb-2 flex items-center justify-between">
              <h2
                id="tpl-rename-title"
                className="text-sm font-semibold text-ink-800"
              >
                ID umbenennen
              </h2>
              <button
                type="button"
                onClick={() => setRenameOpen(false)}
                className="rounded p-1 text-ink-400 hover:bg-ink-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-[12.5px] text-ink-500">
              Achtung: Der externe Mail-Worker referenziert die Vorlage über
              ihre id. Nach dem Umbenennen muss er ggf. angepasst werden.
            </p>
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              className="mt-3 w-full rounded border border-hair bg-white px-2 py-1.5 font-mono text-[12.5px] text-ink-900 focus:border-ink-400 focus:outline-none"
              autoFocus
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => setRenameOpen(false)}
                className="rounded-md border border-hair bg-white px-3 py-1.5 text-[12.5px] text-ink-700 hover:bg-ink-50 disabled:opacity-50"
              >
                Abbrechen
              </button>
              <button
                type="button"
                disabled={saving || !renameValue.trim()}
                onClick={onRename}
                className="inline-flex items-center gap-1 rounded-md border border-ink-900 bg-ink-900 px-3 py-1.5 text-[12.5px] font-medium text-white hover:bg-ink-800 disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                {saving ? "Speichere…" : "Umbenennen & Speichern"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
