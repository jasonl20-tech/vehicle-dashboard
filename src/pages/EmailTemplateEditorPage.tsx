import {
  ArrowLeft,
  ChevronDown,
  Loader2,
  Pencil,
  RefreshCw,
  Save,
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
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import type { DashboardOutletContext } from "../components/layout/dashboardOutletContext";
import type { EmailDesignerHandle } from "../components/emails/EmailDesigner";
import {
  EMAIL_TEMPLATE_VARIABLES,
  emailTemplateUrl,
  updateEmailTemplate,
  type EmailTemplate,
} from "../lib/emailTemplatesApi";
import { useApi } from "../lib/customerApi";

const EmailDesigner = lazy(() => import("../components/emails/EmailDesigner"));

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

export default function EmailTemplateEditorPage() {
  const { id: rawId = "" } = useParams<{ id: string }>();
  const id = decodeURIComponent(rawId);
  const navigate = useNavigate();
  const { setHeaderTrailing } = useOutletContext<DashboardOutletContext>();

  const url = id ? emailTemplateUrl(id) : null;
  const { data, error, loading, reload } = useApi<EmailTemplate>(url);

  const [subject, setSubject] = useState<string>("");
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState<string>("");

  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const designerRef = useRef<EmailDesignerHandle | null>(null);
  const [varOpen, setVarOpen] = useState(false);

  useEffect(() => {
    if (!data) return;
    setSubject(data.subject);
    setSavedAt(data.updated_at);
    setDirty(false);
  }, [data?.id, data?.updated_at]);

  const onSave = useCallback(async () => {
    if (!data) return;
    setSaving(true);
    setSaveErr(null);
    try {
      const html = designerRef.current?.getHtml() ?? data.body_html;
      const updated = await updateEmailTemplate(data.id, {
        subject: subject.trim() || data.subject,
        body_html: html,
      });
      setSavedAt(updated.updated_at);
      setDirty(false);
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [data, subject]);

  const onRename = useCallback(async () => {
    if (!data) return;
    const next = renameValue.trim();
    if (!next || next === data.id) {
      setRenameOpen(false);
      return;
    }
    setSaving(true);
    setSaveErr(null);
    try {
      const html = designerRef.current?.getHtml() ?? data.body_html;
      const updated = await updateEmailTemplate(data.id, {
        new_id: next,
        subject: subject.trim() || data.subject,
        body_html: html,
      });
      setRenameOpen(false);
      setDirty(false);
      navigate(`/emails/templates/${encodeURIComponent(updated.id)}`, {
        replace: true,
      });
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [data, renameValue, subject, navigate]);

  const insertVariable = useCallback((token: string) => {
    setVarOpen(false);
    designerRef.current?.insertHtml(token);
    setDirty(true);
  }, []);

  const insertVariableIntoSubject = useCallback((token: string) => {
    setVarOpen(false);
    setSubject((s) => `${s}${s ? " " : ""}${token}`);
    setDirty(true);
  }, []);

  // ⌘S / Ctrl+S zum Speichern
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        onSave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSave]);

  // Warnen vor verlorenen Änderungen
  useEffect(() => {
    if (!dirty) return;
    const onBefore = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBefore);
    return () => window.removeEventListener("beforeunload", onBefore);
  }, [dirty]);

  const headerToolbar = useMemo(
    () => (
      <div className="flex min-w-0 w-full flex-1 items-center justify-end gap-1.5">
        <span className="hidden truncate text-[11.5px] tabular-nums text-night-500 sm:block">
          {savedAt ? `Gespeichert: ${fmtWhen(savedAt)}` : "—"}
          {dirty ? " · ungespeichert" : ""}
        </span>
        <div className="relative">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setVarOpen((o) => !o);
            }}
            className="inline-flex h-9 items-center gap-1 rounded-md border border-white/[0.1] bg-white/[0.04] px-2.5 text-[12.5px] text-night-200 transition hover:bg-white/[0.08] hover:text-white"
            title="Variable einfügen"
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
                In Email-Body einfügen
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
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => reload()}
          disabled={loading}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/[0.1] bg-white/[0.04] text-night-200 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-50"
          title="Neu laden"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving || !data}
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
      </div>
    ),
    [
      savedAt,
      dirty,
      varOpen,
      loading,
      saving,
      data,
      onSave,
      reload,
      insertVariable,
      insertVariableIntoSubject,
    ],
  );

  useLayoutEffect(() => {
    setHeaderTrailing(headerToolbar);
    return () => setHeaderTrailing(null);
  }, [setHeaderTrailing, headerToolbar]);

  // Schließen des Variablen-Dropdowns bei Klick außerhalb
  useEffect(() => {
    if (!varOpen) return;
    const onDoc = () => setVarOpen(false);
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [varOpen]);

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-paper">
      <div className="flex shrink-0 items-center gap-2 border-b border-hair bg-white px-3 py-2 sm:gap-3 sm:px-5">
        <button
          type="button"
          onClick={() => navigate("/emails/templates")}
          className="inline-flex h-8 items-center gap-1 rounded-md border border-hair bg-white px-2 text-[12.5px] text-ink-700 hover:border-ink-300 hover:text-ink-900"
          title="Zurück zur Liste"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Liste</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setRenameValue(id);
            setRenameOpen(true);
          }}
          className="group inline-flex min-w-0 items-center gap-1 rounded-md border border-transparent px-1.5 py-1 font-mono text-[12.5px] text-ink-700 hover:border-hair hover:bg-ink-50/60"
          title="ID umbenennen"
        >
          <span className="truncate">{id}</span>
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
          className="min-w-0 flex-1 rounded-md border border-hair bg-white px-2.5 py-1.5 text-[13px] text-ink-900 placeholder:text-ink-400 focus:border-ink-400 focus:outline-none"
        />
      </div>

      {error && (
        <p
          className="shrink-0 border-b border-accent-rose/30 bg-accent-rose/10 px-3 py-1.5 text-[12.5px] text-accent-rose sm:px-5"
          role="alert"
        >
          {error}
        </p>
      )}
      {saveErr && (
        <p
          className="shrink-0 border-b border-accent-rose/30 bg-accent-rose/10 px-3 py-1.5 text-[12.5px] text-accent-rose sm:px-5"
          role="alert"
        >
          {saveErr}
        </p>
      )}

      <div className="relative min-h-0 flex-1">
        {loading && !data && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60">
            <p className="inline-flex items-center gap-2 text-[12.5px] text-ink-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Lade Vorlage…
            </p>
          </div>
        )}
        {data && (
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center">
                <p className="inline-flex items-center gap-2 text-[12.5px] text-ink-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Editor wird geladen…
                </p>
              </div>
            }
          >
            <EmailDesigner
              key={data.id}
              ref={designerRef}
              initialHtml={data.body_html}
              onDirtyChange={setDirty}
            />
          </Suspense>
        )}
      </div>

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
