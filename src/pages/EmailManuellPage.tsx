/**
 * Email manuell — Compose-Window im Stil eines Mail-Clients.
 *
 * Schreibt einen `pending`-Job in `email_jobs` (siehe POST
 * /api/emails/jobs). Den Versand selbst inkl. `tracking_id`-Vergabe
 * übernimmt der externe Mail-Worker.
 *
 * Layout-Idee (Gmail / Apple-Mail-artig):
 *   - Oberhalb: Kompakte Header-Felder (To · From · Subject · Template)
 *   - Body-Bereich: Vorschau-Iframe direkt in der Mitte (das ist das
 *     „Schreibblatt") — bei aktivem Custom-HTML-Modus klappt unten
 *     der HTML-Editor auf
 *   - Rechte schmale Sidebar: Variablen + geplanter Zeitpunkt
 *   - Footer-Bar: Aktionen (Senden / Reset)
 */
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Code2,
  ExternalLink,
  Eye,
  Loader2,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  X,
} from "lucide-react";
import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { Link, useOutletContext } from "react-router-dom";
import type { DashboardOutletContext } from "../components/layout/dashboardOutletContext";
import { useApi } from "../lib/customerApi";
import {
  EMAIL_TEMPLATE_VARIABLES,
  emailTemplatesListUrl,
  emailTemplateUrl,
  type EmailTemplate,
  type EmailTemplatesListResponse,
} from "../lib/emailTemplatesApi";
import {
  DEFAULT_FROM_EMAIL,
  createEmailJob,
  type CreateEmailJobInput,
  type EmailJobFull,
} from "../lib/emailJobsApi";

const noopSetHeader: DashboardOutletContext["setHeaderTrailing"] = () => {};

const EMAIL_RE = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

type Variable = { key: string; value: string };

const DEFAULT_VARS: Variable[] = [
  { key: "name", value: "" },
  { key: "company", value: "" },
];

export default function EmailManuellPage() {
  const ctx = useOutletContext<DashboardOutletContext | undefined>();
  const setHeaderTrailing = ctx?.setHeaderTrailing ?? noopSetHeader;

  // ---- Form-State ----
  const [recipientEmail, setRecipientEmail] = useState("");
  const [templateId, setTemplateId] = useState<string>("");
  const [customSubject, setCustomSubject] = useState("");
  const [customBodyHtml, setCustomBodyHtml] = useState("");
  const [variables, setVariables] = useState<Variable[]>(DEFAULT_VARS);
  const [scheduledAt, setScheduledAt] = useState<string>("");
  const [fromEmail, setFromEmail] = useState<string>(DEFAULT_FROM_EMAIL);
  const [fromName, setFromName] = useState<string>("VehicleImagery");
  const [showHtmlEditor, setShowHtmlEditor] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // ---- API: Liste der Templates ----
  const templatesUrl = useMemo(() => emailTemplatesListUrl({ limit: 200 }), []);
  const templates = useApi<EmailTemplatesListResponse>(templatesUrl);

  // Vorschau für ausgewähltes Template
  const previewUrl = templateId ? emailTemplateUrl(templateId) : null;
  const preview = useApi<EmailTemplate>(previewUrl);

  // ---- Submit-State ----
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<EmailJobFull | null>(null);

  const headerToolbar = useMemo(
    () => (
      <div className="flex min-w-0 w-full flex-1 items-center justify-end gap-1.5">
        <span className="hidden truncate text-[11.5px] tabular-nums text-night-500 md:block">
          Erstellt einen `pending`-Job · externer Mail-Worker versendet
        </span>
        <button
          type="button"
          onClick={() => templates.reload()}
          disabled={templates.loading}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/[0.1] bg-white/[0.04] text-night-200 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-50"
          title="Templates neu laden"
        >
          <RefreshCw className={`h-4 w-4 ${templates.loading ? "animate-spin" : ""}`} />
        </button>
      </div>
    ),
    [templates],
  );

  useLayoutEffect(() => {
    setHeaderTrailing(headerToolbar);
    return () => setHeaderTrailing(null);
  }, [setHeaderTrailing, headerToolbar]);

  // ---- Variablen-Helper ----
  const addVariable = useCallback(() => {
    setVariables((vs) => [...vs, { key: "", value: "" }]);
  }, []);
  const removeVariable = useCallback((idx: number) => {
    setVariables((vs) => vs.filter((_, i) => i !== idx));
  }, []);
  const updateVariable = useCallback(
    (idx: number, patch: Partial<Variable>) => {
      setVariables((vs) =>
        vs.map((v, i) => (i === idx ? { ...v, ...patch } : v)),
      );
    },
    [],
  );

  const fillSuggestion = useCallback((token: string) => {
    const key = token.replace(/^\{\{|\}\}$/g, "");
    setVariables((vs) => {
      if (vs.some((v) => v.key.trim() === key)) return vs;
      return [...vs, { key, value: "" }];
    });
  }, []);

  // ---- Validierung ----
  const recipientValid = EMAIL_RE.test(recipientEmail.trim());
  const hasTemplateOrBody = !!templateId || !!customBodyHtml.trim();
  const canSubmit =
    recipientValid && hasTemplateOrBody && !submitting && !submitted;

  const handleSubmit = useCallback(async () => {
    setError(null);
    if (!recipientValid) {
      setError("Bitte eine gültige Empfänger-Adresse eingeben.");
      return;
    }
    if (!hasTemplateOrBody) {
      setError("Wähle ein Template oder schreibe einen Custom-Body.");
      return;
    }

    const recipient_data: Record<string, unknown> = {
      email: recipientEmail.trim(),
    };
    for (const v of variables) {
      const k = v.key.trim();
      if (!k) continue;
      recipient_data[k] = v.value;
    }

    const input: CreateEmailJobInput = {
      recipient_email: recipientEmail.trim(),
      recipient_data,
      template_id: templateId || null,
      custom_subject: customSubject.trim() || null,
      custom_body_html: customBodyHtml.trim() || null,
      scheduled_at: scheduledAt
        ? scheduledAt.replace("T", " ") + ":00"
        : null,
      from_email: fromEmail.trim() || null,
      from_name: fromName.trim() || null,
    };

    setSubmitting(true);
    try {
      const job = await createEmailJob(input);
      setSubmitted(job);
    } catch (e) {
      setError((e as Error)?.message || String(e));
    } finally {
      setSubmitting(false);
    }
  }, [
    recipientValid,
    hasTemplateOrBody,
    recipientEmail,
    variables,
    templateId,
    customSubject,
    customBodyHtml,
    scheduledAt,
    fromEmail,
    fromName,
  ]);

  const handleReset = useCallback(() => {
    setSubmitted(null);
    setError(null);
    setRecipientEmail("");
    setVariables(DEFAULT_VARS);
    setTemplateId("");
    setCustomSubject("");
    setCustomBodyHtml("");
    setScheduledAt("");
    setShowHtmlEditor(false);
  }, []);

  const previewHtml = customBodyHtml.trim() || preview.data?.body_html || "";
  const previewSubject =
    customSubject.trim() || preview.data?.subject?.trim() || "";

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-paper">
      {/* Top Notification Bars */}
      {error && (
        <p
          className="shrink-0 border-b border-rose-500/30 bg-rose-500/10 px-4 py-1.5 text-[12.5px] text-rose-700 sm:px-8"
          role="alert"
        >
          <AlertCircle className="mr-1 inline h-3.5 w-3.5" />
          {error}
        </p>
      )}
      {templates.error && (
        <p
          className="shrink-0 border-b border-amber-500/40 bg-amber-500/10 px-4 py-1.5 text-[12.5px] text-amber-700 sm:px-8"
          role="status"
        >
          Templates: {templates.error}
        </p>
      )}

      {submitted ? (
        <SuccessPanel job={submitted} onReset={handleReset} />
      ) : (
        <>
          {/* Compose-Header (Mail-Client-Style) */}
          <div className="shrink-0 border-b border-hair bg-white">
            {/* From */}
            <FieldRow label="Von">
              <input
                type="text"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                placeholder="Anzeigename (optional)"
                className="w-44 min-w-0 border-0 bg-transparent text-[13px] text-ink-900 placeholder:text-ink-400 focus:outline-none"
              />
              <span className="mx-1 text-ink-300">·</span>
              <input
                type="email"
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                className="min-w-0 flex-1 border-0 bg-transparent font-mono text-[13px] text-ink-900 placeholder:text-ink-400 focus:outline-none"
              />
            </FieldRow>

            {/* To */}
            <FieldRow
              label="An"
              required
              warn={recipientEmail.length > 0 && !recipientValid}
            >
              <input
                type="email"
                inputMode="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="empfaenger@example.com"
                className="min-w-0 flex-1 border-0 bg-transparent font-mono text-[14px] text-ink-900 placeholder:text-ink-400 focus:outline-none"
                autoFocus
              />
              {recipientEmail.length > 0 && !recipientValid && (
                <span className="text-[11px] text-rose-600">ungültig</span>
              )}
            </FieldRow>

            {/* Template */}
            <FieldRow label="Vorlage">
              <select
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                disabled={templates.loading}
                className="min-w-0 flex-1 border-0 bg-transparent text-[13px] text-ink-900 focus:outline-none"
              >
                <option value="">— Keine —</option>
                {(templates.data?.rows ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.id} · {t.subject}
                  </option>
                ))}
              </select>
              {templateId && (
                <Link
                  to={`/emails/templates?id=${encodeURIComponent(templateId)}`}
                  className="ml-2 inline-flex items-center text-ink-400 hover:text-ink-700"
                  title="Template öffnen"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              )}
            </FieldRow>

            {/* Subject */}
            <FieldRow label="Betreff">
              <input
                type="text"
                value={customSubject}
                onChange={(e) => setCustomSubject(e.target.value)}
                placeholder={
                  preview.data?.subject || "Betreff (überschreibt Template)"
                }
                className="min-w-0 flex-1 border-0 bg-transparent text-[14px] font-medium text-ink-900 placeholder:text-ink-400 focus:outline-none"
              />
            </FieldRow>

            {/* Advanced (Geplanter Zeitpunkt + Toggles) */}
            <div className="flex flex-wrap items-center gap-3 px-4 py-2 text-[12px] sm:px-6">
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="inline-flex items-center gap-1 text-ink-500 hover:text-ink-900"
              >
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${
                    showAdvanced ? "rotate-180" : ""
                  }`}
                />
                Erweitert
              </button>
              {showAdvanced && (
                <>
                  <div className="inline-flex items-center gap-1.5 rounded-md border border-hair bg-white px-2 py-1">
                    <Calendar className="h-3.5 w-3.5 text-ink-400" />
                    <input
                      type="datetime-local"
                      value={scheduledAt}
                      onChange={(e) => setScheduledAt(e.target.value)}
                      className="min-w-0 border-0 bg-transparent text-[12.5px] text-ink-900 focus:outline-none"
                      title="Geplant für (UTC)"
                    />
                    {scheduledAt && (
                      <button
                        type="button"
                        onClick={() => setScheduledAt("")}
                        className="text-ink-400 hover:text-ink-700"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowHtmlEditor((v) => !v)}
                    className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[12px] transition ${
                      showHtmlEditor
                        ? "border-ink-900 bg-ink-900 text-white"
                        : "border-hair bg-white text-ink-700 hover:bg-ink-50"
                    }`}
                  >
                    <Code2 className="h-3.5 w-3.5" />
                    Custom HTML
                  </button>
                  <span className="text-[11px] text-ink-400">
                    Geplant in UTC · leer = sofort
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Body — Vorschau + (optional) HTML-Editor + rechte Sidebar */}
          <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
            {/* Mitte: Body */}
            <div className="flex min-h-0 flex-1 flex-col bg-white">
              {!hasTemplateOrBody ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
                  <Eye className="h-8 w-8 text-ink-300" />
                  <p className="text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-400">
                    Keine Vorlage · kein Custom-Body
                  </p>
                  <p className="max-w-sm text-[13px] leading-relaxed text-ink-500">
                    Wähle oben eine Vorlage oder aktiviere unter „Erweitert"
                    den Custom-HTML-Modus, um die Mail zu schreiben.
                  </p>
                </div>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col">
                  {/* Subject-Mini-Preview */}
                  {previewSubject && (
                    <div className="shrink-0 border-b border-hair bg-ink-50/40 px-6 py-2 text-[12px] text-ink-500">
                      Betreff:{" "}
                      <span className="text-ink-800">{previewSubject}</span>
                    </div>
                  )}
                  {showHtmlEditor ? (
                    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
                      <textarea
                        value={customBodyHtml}
                        onChange={(e) => setCustomBodyHtml(e.target.value)}
                        spellCheck={false}
                        placeholder={"<p>Hallo {{name}},</p>\n<p>…</p>"}
                        className="min-h-0 flex-1 resize-none border-0 border-b border-hair bg-paper/40 px-4 py-3 font-mono text-[12.5px] leading-relaxed text-ink-900 focus:outline-none lg:w-1/2 lg:border-b-0 lg:border-r"
                      />
                      <div className="min-h-[40vh] flex-1 lg:w-1/2">
                        {preview.loading && templateId && !customBodyHtml.trim() ? (
                          <p className="flex items-center justify-center gap-1.5 py-10 text-[12px] text-ink-500">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Lade Template…
                          </p>
                        ) : (
                          <iframe
                            title="Email-Vorschau"
                            srcDoc={previewHtml}
                            sandbox=""
                            className="h-full w-full border-0 bg-white"
                          />
                        )}
                      </div>
                    </div>
                  ) : preview.loading && templateId && !customBodyHtml.trim() ? (
                    <p className="flex flex-1 items-center justify-center gap-1.5 text-[12px] text-ink-500">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Lade Template…
                    </p>
                  ) : (
                    <iframe
                      title="Email-Vorschau"
                      srcDoc={previewHtml}
                      sandbox=""
                      className="min-h-0 flex-1 border-0 bg-white"
                    />
                  )}
                </div>
              )}
            </div>

            {/* Rechte Sidebar: Variablen */}
            <aside className="hidden w-[300px] shrink-0 flex-col border-l border-hair bg-paper/60 lg:flex">
              <div className="shrink-0 border-b border-hair px-4 py-3">
                <h3 className="text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-500">
                  Variablen
                </h3>
                <p className="mt-1 text-[11.5px] leading-relaxed text-ink-500">
                  Werden als <code className="font-mono text-[10.5px]">recipient_data</code>{" "}
                  gespeichert. Der Mail-Worker ersetzt{" "}
                  <code className="font-mono text-[10.5px]">{`{{key}}`}</code> im
                  Body.
                </p>
              </div>

              <div className="shrink-0 border-b border-hair px-4 py-3">
                <p className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-ink-400">
                  Bekannte Tokens
                </p>
                <div className="flex flex-wrap gap-1">
                  {EMAIL_TEMPLATE_VARIABLES.map((v) => (
                    <button
                      key={v.token}
                      type="button"
                      onClick={() => fillSuggestion(v.token)}
                      title={v.label}
                      className="rounded border border-hair bg-white px-1.5 py-0.5 font-mono text-[10.5px] text-ink-700 hover:bg-ink-50"
                    >
                      {v.token}
                    </button>
                  ))}
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
                <ul className="space-y-1.5">
                  {variables.map((v, idx) => (
                    <li key={idx} className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={v.key}
                        onChange={(e) => updateVariable(idx, { key: e.target.value })}
                        placeholder="key"
                        className="w-24 shrink-0 rounded border border-hair bg-white px-1.5 py-1 font-mono text-[11.5px] text-ink-900 focus:border-ink-400 focus:outline-none"
                      />
                      <input
                        type="text"
                        value={v.value}
                        onChange={(e) => updateVariable(idx, { value: e.target.value })}
                        placeholder="Wert"
                        className="min-w-0 flex-1 rounded border border-hair bg-white px-1.5 py-1 text-[11.5px] text-ink-900 focus:border-ink-400 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => removeVariable(idx)}
                        className="text-ink-400 hover:text-ink-700"
                        title="Entfernen"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={addVariable}
                  className="mt-2 inline-flex items-center gap-1 rounded border border-hair bg-white px-1.5 py-1 text-[11px] text-ink-700 hover:bg-ink-50"
                >
                  <Plus className="h-3 w-3" />
                  Variable
                </button>
              </div>
            </aside>
          </div>

          {/* Mobile-Variablen (nur bei kleinem Screen) */}
          <details className="shrink-0 border-t border-hair bg-white lg:hidden">
            <summary className="cursor-pointer px-4 py-2 text-[12px] text-ink-700">
              Variablen ({variables.length})
            </summary>
            <div className="border-t border-hair px-4 py-3">
              <div className="mb-2 flex flex-wrap gap-1">
                {EMAIL_TEMPLATE_VARIABLES.map((v) => (
                  <button
                    key={v.token}
                    type="button"
                    onClick={() => fillSuggestion(v.token)}
                    className="rounded border border-hair bg-white px-1.5 py-0.5 font-mono text-[10.5px] text-ink-700 hover:bg-ink-50"
                  >
                    {v.token}
                  </button>
                ))}
              </div>
              <ul className="space-y-1.5">
                {variables.map((v, idx) => (
                  <li key={idx} className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={v.key}
                      onChange={(e) => updateVariable(idx, { key: e.target.value })}
                      placeholder="key"
                      className="w-24 shrink-0 rounded border border-hair bg-white px-1.5 py-1 font-mono text-[11.5px] text-ink-900 focus:outline-none"
                    />
                    <input
                      type="text"
                      value={v.value}
                      onChange={(e) => updateVariable(idx, { value: e.target.value })}
                      placeholder="Wert"
                      className="min-w-0 flex-1 rounded border border-hair bg-white px-1.5 py-1 text-[11.5px] text-ink-900 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => removeVariable(idx)}
                      className="text-ink-400 hover:text-ink-700"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={addVariable}
                className="mt-2 inline-flex items-center gap-1 rounded border border-hair bg-white px-1.5 py-1 text-[11px] text-ink-700 hover:bg-ink-50"
              >
                <Plus className="h-3 w-3" />
                Variable
              </button>
            </div>
          </details>

          {/* Footer-Bar */}
          <div className="shrink-0 border-t border-hair bg-white px-4 py-3 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11.5px] text-ink-500">
                {recipientValid ? (
                  <>
                    <CheckCircle2 className="mr-1 inline h-3 w-3 text-emerald-500" />
                    bereit · {scheduledAt ? "geplant" : "wird sofort übergeben"}
                  </>
                ) : (
                  <>Empfänger fehlt</>
                )}
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleReset}
                  className="inline-flex items-center gap-1 rounded-md border border-hair bg-white px-2.5 py-1.5 text-[12px] text-ink-700 hover:bg-ink-50"
                >
                  Zurücksetzen
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  className="inline-flex items-center justify-center gap-1.5 rounded-md bg-ink-900 px-3 py-1.5 text-[13px] font-medium text-white transition hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  {submitting
                    ? "Wird angelegt…"
                    : scheduledAt
                      ? "Job planen"
                      : "Jetzt versenden"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Bausteine ───────────────────────────────────────────────────────

function FieldRow({
  label,
  required,
  warn,
  children,
}: {
  label: string;
  required?: boolean;
  warn?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`flex items-center gap-3 border-b border-hair px-4 py-2.5 sm:px-6 ${
        warn ? "bg-rose-500/5" : ""
      }`}
    >
      <span className="w-12 shrink-0 text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-400">
        {label}
        {required && <span className="ml-0.5 text-rose-500">*</span>}
      </span>
      <div className="flex min-w-0 flex-1 items-center gap-2">{children}</div>
    </div>
  );
}

function SuccessPanel({
  job,
  onReset,
}: {
  job: EmailJobFull;
  onReset: () => void;
}) {
  return (
    <div className="flex h-full flex-1 items-center justify-center bg-white px-6 py-10">
      <div className="max-w-md text-center">
        <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-700">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <h2 className="mt-4 text-[18px] font-semibold text-ink-900">
          Job angelegt
        </h2>
        <p className="mt-1 text-[13px] text-ink-500">
          Der externe Mail-Worker übernimmt jetzt den Versand und vergibt
          die <code className="font-mono text-[11px]">tracking_id</code>.
        </p>
        <p
          className="mt-3 truncate font-mono text-[11.5px] text-ink-400"
          title={job.id}
        >
          {job.id}
        </p>
        <p className="mt-1 truncate text-[12.5px] text-ink-700" title={job.recipient_email}>
          → {job.recipient_email}
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <Link
            to={`/emails/logs/${encodeURIComponent(job.id)}`}
            className="inline-flex items-center gap-1 rounded-md border border-hair bg-white px-3 py-1.5 text-[12.5px] text-ink-700 hover:bg-ink-50"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Im Email-Log öffnen
          </Link>
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1 rounded-md bg-ink-900 px-3 py-1.5 text-[12.5px] font-medium text-white hover:bg-ink-800"
          >
            <Plus className="h-3.5 w-3.5" />
            Weitere Mail
          </button>
        </div>
      </div>
    </div>
  );
}
