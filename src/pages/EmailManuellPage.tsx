/**
 * Email manuell — One-off-Compose-Seite.
 *
 * Diese Seite ist absichtlich getrennt von der Vorlagen-Verwaltung: hier
 * baut man eine einmalige Mail (z. B. Support-Antwort, individuelle
 * Ansprache) und exportiert sie für den externen Mail-Worker, der das
 * tatsächliche Versenden übernimmt.
 *
 *  - Empfänger / Betreff oben in der Compose-Bar
 *  - Bestehende Vorlage als Startpunkt laden (Dropdown)
 *  - Builder oder Roh-HTML-Modus, identisch zur Templates-Seite
 *  - „HTML kopieren"  — gerendertes E-Mail-HTML in die Zwischenablage
 *  - „Mail-JSON kopieren" — kompletter Payload (to/subject/html) für den
 *    externen Versand-Worker
 *
 * Es gibt explizit *keinen* Speichern-Button: One-off-Mails sollen nicht
 * versehentlich in die Vorlagen-Tabelle rutschen.
 */
import {
  Check,
  Code2,
  Copy,
  FileText,
  LayoutGrid,
  Loader2,
  RefreshCw,
} from "lucide-react";
import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useOutletContext } from "react-router-dom";
import type { DashboardOutletContext } from "../components/layout/dashboardOutletContext";
import type { EmailBuilderHandle } from "../components/emails/builder/EmailBuilder";
import { makeDefaultDesign } from "../components/emails/builder/defaults";
import type { EmailDesign } from "../components/emails/builder/types";
import { useApi } from "../lib/customerApi";
import {
  EMAIL_TEMPLATE_VARIABLES,
  emailTemplateUrl,
  emailTemplatesListUrl,
  type EmailTemplate,
  type EmailTemplatesListResponse,
} from "../lib/emailTemplatesApi";
import {
  embedBuilderDesign,
  extractBuilderDesign,
} from "../lib/builderDesign";

const EmailBuilder = lazy(
  () => import("../components/emails/builder/EmailBuilder"),
);

const VIEW_MODE_KEY = "ui.emailManuell.viewMode";

type ViewMode = "builder" | "html";

const noopSetHeader: DashboardOutletContext["setHeaderTrailing"] = () => {};

function readViewMode(): ViewMode {
  if (typeof window === "undefined") return "builder";
  try {
    const v = window.localStorage.getItem(VIEW_MODE_KEY);
    if (v === "html" || v === "builder") return v;
  } catch {
    /* ignore */
  }
  return "builder";
}

function writeViewMode(v: ViewMode) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(VIEW_MODE_KEY, v);
  } catch {
    /* ignore */
  }
}

export default function EmailManuellPage() {
  const ctx = useOutletContext<DashboardOutletContext | undefined>();
  const setHeaderTrailing = ctx?.setHeaderTrailing ?? noopSetHeader;

  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>(() => readViewMode());
  const [initialDesign, setInitialDesign] = useState<EmailDesign | null>(null);
  const [loadFromId, setLoadFromId] = useState<string>("");
  const [loadingTpl, setLoadingTpl] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const builderRef = useRef<EmailBuilderHandle | null>(null);

  useEffect(() => {
    writeViewMode(viewMode);
  }, [viewMode]);

  // Initiales leeres Design für den Builder
  useEffect(() => {
    if (initialDesign) return;
    setInitialDesign(makeDefaultDesign());
  }, [initialDesign]);

  // Liste vorhandener Vorlagen für „Vorlage laden"-Dropdown
  const list = useApi<EmailTemplatesListResponse>(
    emailTemplatesListUrl({ limit: 200 }),
  );

  /**
   * Aktuell gerendertes HTML zusammenbauen — analog Templates-Page:
   * Builder-Design wird als unsichtbarer HTML-Kommentar mit eingebettet,
   * damit ein späteres Re-Open das Design wieder rekonstruieren kann.
   */
  const computeHtmlFromBuilder = useCallback((): string => {
    const handle = builderRef.current;
    if (!handle) return bodyHtml;
    const design = handle.getDesign();
    const rendered = handle.getEmailHtml();
    return embedBuilderDesign(design, rendered);
  }, [bodyHtml]);

  const buildOutgoingHtml = useCallback((): string => {
    if (viewMode === "builder") return computeHtmlFromBuilder();
    return bodyHtml;
  }, [viewMode, bodyHtml, computeHtmlFromBuilder]);

  const buildPayload = useCallback(() => {
    const html = buildOutgoingHtml();
    return {
      to: to
        .split(/[,;\s]+/)
        .map((s) => s.trim())
        .filter(Boolean),
      subject: subject.trim(),
      body_html: html,
    };
  }, [to, subject, buildOutgoingHtml]);

  // Vorlage laden
  const onLoadTemplate = useCallback(
    async (id: string) => {
      if (!id) return;
      setLoadingTpl(true);
      setLoadError(null);
      try {
        const res = await fetch(emailTemplateUrl(id), {
          credentials: "include",
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(j.error || `HTTP ${res.status}`);
        }
        const tpl = (await res.json()) as EmailTemplate;
        if (!subject) setSubject(tpl.subject ?? "");
        const extracted = extractBuilderDesign(tpl.body_html ?? "");
        setBodyHtml(extracted.htmlWithoutMarker || tpl.body_html || "");
        const next = extracted.design ?? makeDefaultDesign();
        setInitialDesign(next);
        builderRef.current?.replaceDesign(next);
      } catch (e) {
        setLoadError(
          e instanceof Error ? e.message : "Konnte Vorlage nicht laden",
        );
      } finally {
        setLoadingTpl(false);
      }
    },
    [subject],
  );

  // Reset (leerer Editor)
  const onReset = useCallback(() => {
    if (
      !window.confirm(
        "Compose-Editor leeren? Alle Eingaben (Empfänger, Betreff, Body) gehen verloren.",
      )
    ) {
      return;
    }
    setTo("");
    setSubject("");
    setBodyHtml("");
    setLoadFromId("");
    setLoadError(null);
    const fresh = makeDefaultDesign();
    setInitialDesign(fresh);
    builderRef.current?.replaceDesign(fresh);
  }, []);

  // Zwischenablage helpers
  const [copyHint, setCopyHint] = useState<string | null>(null);
  const flashCopy = useCallback((label: string) => {
    setCopyHint(label);
    window.setTimeout(() => setCopyHint(null), 1600);
  }, []);

  const copyHtml = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(buildOutgoingHtml());
      flashCopy("HTML kopiert");
    } catch {
      flashCopy("Kopieren fehlgeschlagen");
    }
  }, [buildOutgoingHtml, flashCopy]);

  const copyJson = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(
        JSON.stringify(buildPayload(), null, 2),
      );
      flashCopy("Mail-JSON kopiert");
    } catch {
      flashCopy("Kopieren fehlgeschlagen");
    }
  }, [buildPayload, flashCopy]);

  const insertVariable = useCallback(
    (token: string) => {
      if (viewMode === "builder") {
        builderRef.current?.insertVariable(token);
      } else {
        setBodyHtml((h) => `${h}${token}`);
      }
    },
    [viewMode],
  );

  // Header-Trailing: Aktionen rechts in der Topbar
  const headerTrailing = useMemo(
    () => (
      <div className="flex flex-wrap items-center gap-2">
        <span className="hidden text-[11.5px] text-ink-500 sm:inline">
          Versand erfolgt durch externen Worker.
        </span>
        {copyHint && (
          <span
            className="inline-flex items-center gap-1 rounded-md border border-accent-mint/40 bg-accent-mint/10 px-2 py-1 text-[11.5px] font-medium text-accent-mint"
            role="status"
          >
            <Check className="h-3 w-3" />
            {copyHint}
          </span>
        )}
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1.5 rounded-md border border-hair bg-paper px-2.5 py-1.5 text-[12.5px] font-medium text-ink-700 transition hover:bg-hair/60 hover:text-ink-900"
          title="Compose-Editor leeren"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Leeren
        </button>
        <button
          type="button"
          onClick={copyJson}
          className="inline-flex items-center gap-1.5 rounded-md border border-hair bg-paper px-2.5 py-1.5 text-[12.5px] font-medium text-ink-700 transition hover:bg-hair/60 hover:text-ink-900"
          title="Mail-Payload (to/subject/body_html) als JSON in die Zwischenablage"
        >
          <Copy className="h-3.5 w-3.5" />
          Mail-JSON
        </button>
        <button
          type="button"
          onClick={copyHtml}
          className="inline-flex items-center gap-1.5 rounded-md border border-ink-900 bg-ink-900 px-3 py-1.5 text-[12.5px] font-medium text-white transition hover:bg-ink-800"
          title="Gerendertes HTML in die Zwischenablage"
        >
          <Copy className="h-3.5 w-3.5" />
          HTML kopieren
        </button>
      </div>
    ),
    [copyHint, copyHtml, copyJson, onReset],
  );

  useEffect(() => {
    setHeaderTrailing(headerTrailing);
    return () => setHeaderTrailing(null);
  }, [setHeaderTrailing, headerTrailing]);

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col">
      {/* Compose-Bar */}
      <div className="shrink-0 border-b border-hair bg-paper">
        <div className="grid gap-x-3 gap-y-2 px-5 py-3 sm:px-8 md:grid-cols-[auto_minmax(0,1fr)_auto]">
          <div className="grid grid-cols-[80px_minmax(0,1fr)] items-center gap-x-3 md:col-span-2">
            <label
              htmlFor="email-manuell-to"
              className="text-[11.5px] font-medium uppercase tracking-wider text-ink-500"
            >
              An
            </label>
            <input
              id="email-manuell-to"
              type="text"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="empfaenger@beispiel.de — mehrere mit Komma trennen"
              className="w-full rounded-md border border-hair bg-white px-2.5 py-1.5 text-[13px] outline-none focus:border-ink-900/40"
              autoComplete="off"
            />
            <label
              htmlFor="email-manuell-subject"
              className="text-[11.5px] font-medium uppercase tracking-wider text-ink-500"
            >
              Betreff
            </label>
            <input
              id="email-manuell-subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Betreffzeile (Variablen wie {{name}} sind erlaubt)"
              className="w-full rounded-md border border-hair bg-white px-2.5 py-1.5 text-[13px] outline-none focus:border-ink-900/40"
              autoComplete="off"
            />
          </div>

          <div className="flex items-end justify-end gap-2">
            <div className="flex flex-col items-stretch">
              <label
                htmlFor="email-manuell-tpl"
                className="text-[11.5px] font-medium uppercase tracking-wider text-ink-500"
              >
                Vorlage als Start
              </label>
              <div className="mt-0.5 flex items-center gap-1.5">
                <select
                  id="email-manuell-tpl"
                  value={loadFromId}
                  onChange={(e) => setLoadFromId(e.target.value)}
                  className="min-w-[200px] rounded-md border border-hair bg-white px-2 py-1.5 text-[13px] outline-none focus:border-ink-900/40"
                  disabled={list.loading}
                >
                  <option value="">— Vorlage wählen —</option>
                  {(list.data?.rows ?? []).map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.id} {r.subject ? `· ${r.subject}` : ""}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => onLoadTemplate(loadFromId)}
                  disabled={!loadFromId || loadingTpl}
                  className="inline-flex items-center gap-1.5 rounded-md border border-hair bg-paper px-2.5 py-1.5 text-[12.5px] font-medium text-ink-700 transition hover:bg-hair/60 disabled:opacity-50"
                >
                  {loadingTpl ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <FileText className="h-3.5 w-3.5" />
                  )}
                  Laden
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Variablen-Chips + Mode-Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hair px-5 py-2 sm:px-8">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wider text-ink-500">
              Variablen:
            </span>
            {EMAIL_TEMPLATE_VARIABLES.map((v) => (
              <button
                key={v.token}
                type="button"
                onClick={() => insertVariable(v.token)}
                className="inline-flex items-center gap-1 rounded-md border border-hair bg-paper px-2 py-0.5 text-[11.5px] font-mono text-ink-800 transition hover:border-ink-900 hover:bg-ink-900 hover:text-white"
                title={v.label}
              >
                {v.token}
              </button>
            ))}
          </div>
          <div className="inline-flex rounded-md border border-hair bg-paper p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("builder")}
              className={`inline-flex items-center gap-1.5 rounded-[4px] px-2.5 py-1 text-[12px] font-medium transition ${
                viewMode === "builder"
                  ? "bg-ink-900 text-white"
                  : "text-ink-600 hover:bg-hair/80 hover:text-ink-900"
              }`}
              aria-pressed={viewMode === "builder"}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Builder
            </button>
            <button
              type="button"
              onClick={() => setViewMode("html")}
              className={`inline-flex items-center gap-1.5 rounded-[4px] px-2.5 py-1 text-[12px] font-medium transition ${
                viewMode === "html"
                  ? "bg-ink-900 text-white"
                  : "text-ink-600 hover:bg-hair/80 hover:text-ink-900"
              }`}
              aria-pressed={viewMode === "html"}
            >
              <Code2 className="h-3.5 w-3.5" />
              HTML
            </button>
          </div>
        </div>

        {loadError && (
          <p className="border-t border-hair bg-amber-50 px-5 py-2 text-[12.5px] text-amber-900 sm:px-8">
            {loadError}
          </p>
        )}
      </div>

      {/* Editor-Area */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {viewMode === "builder" ? (
          initialDesign ? (
            <Suspense
              fallback={
                <div className="grid h-full place-items-center text-[13px] text-ink-500">
                  Editor wird geladen …
                </div>
              }
            >
              <EmailBuilder
                ref={builderRef}
                initialDesign={initialDesign}
                onChange={() => {
                  // Builder hält State; wir lesen on-demand per `getEmailHtml()`.
                }}
              />
            </Suspense>
          ) : (
            <div className="grid h-full place-items-center text-[13px] text-ink-500">
              Editor wird vorbereitet …
            </div>
          )
        ) : (
          <div className="flex h-full min-h-0 flex-col">
            <textarea
              value={bodyHtml}
              onChange={(e) => setBodyHtml(e.target.value)}
              spellCheck={false}
              className="min-h-0 flex-1 resize-none border-0 bg-paper px-5 py-4 font-mono text-[12.5px] leading-relaxed text-ink-900 outline-none sm:px-8"
              placeholder="<!-- Roh-HTML der Mail -->"
            />
            <p className="shrink-0 border-t border-hair bg-paper/60 px-5 py-2 text-[11.5px] text-ink-500 sm:px-8">
              Hinweis: Im HTML-Modus wird kein Builder-Design eingebettet —
              das HTML wird unverändert kopiert / im Mail-JSON exportiert.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
