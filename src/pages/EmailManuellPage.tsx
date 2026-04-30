/**
 * Email manuell — Compose-Workflow für einmalige Mails.
 *
 * Schreibt einen `pending`-Job in `email_jobs` (siehe POST
 * /api/emails/jobs). Den Versand selbst übernimmt der externe Mail-
 * Worker — diese Seite triggert NICHT direkt den Versand.
 *
 * Workflow im Frontend:
 *  1) Empfänger-Adresse + (optional) Variablen-Map
 *  2) Template auswählen ODER Subject + Custom-HTML eingeben
 *  3) Optional: Geplanter Zeitpunkt + abweichende Absender-Adresse
 *  4) „Job anlegen" → 201, dann Link in die Email-Logs
 */
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ExternalLink,
  Eye,
  FileCode,
  Loader2,
  Mail,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  Variable as VariableIcon,
  Wand2,
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
  const [fromEmail, setFromEmail] = useState<string>("no-reply@vehicleimagery.com");
  const [showHtmlEditor, setShowHtmlEditor] = useState(false);

  // ---- API: Liste der Templates ----
  const templatesUrl = useMemo(() => emailTemplatesListUrl({ limit: 200 }), []);
  const templates = useApi<EmailTemplatesListResponse>(templatesUrl);

  // Vorschau für ausgewähltes Template (lädt nur on-demand)
  const previewUrl = templateId ? emailTemplateUrl(templateId) : null;
  const preview = useApi<EmailTemplate>(previewUrl);

  // ---- Submit-State ----
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<EmailJobFull | null>(null);

  // ---- Header-Toolbar (Reload Templates) ----
  const headerToolbar = useMemo(
    () => (
      <div className="flex min-w-0 w-full flex-1 items-center justify-end gap-1.5">
        <span className="hidden truncate text-[11.5px] tabular-nums text-night-500 sm:block">
          Job anlegen → externer Mail-Worker
        </span>
        <button
          type="button"
          onClick={() => templates.reload()}
          disabled={templates.loading}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/[0.1] bg-white/[0.04] text-night-200 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-50"
          title="Templates neu laden"
        >
          <RefreshCw
            className={`h-4 w-4 ${templates.loading ? "animate-spin" : ""}`}
          />
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

  const fillSuggestion = useCallback(
    (token: string) => {
      const key = token.replace(/^\{\{|\}\}$/g, "");
      setVariables((vs) => {
        if (vs.some((v) => v.key.trim() === key)) return vs;
        return [...vs, { key, value: "" }];
      });
    },
    [],
  );

  // ---- Validierung ----
  const recipientValid = EMAIL_RE.test(recipientEmail.trim());
  const hasTemplateOrBody =
    !!templateId || !!customBodyHtml.trim();
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
  }, []);

  // ---- UI ----
  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-y-auto bg-paper">
      {error && (
        <p
          className="shrink-0 border-b border-accent-rose/30 bg-accent-rose/10 px-4 py-1.5 text-[12.5px] text-accent-rose sm:px-6"
          role="alert"
        >
          <AlertCircle className="mr-1 inline h-3.5 w-3.5" />
          {error}
        </p>
      )}
      {templates.error && (
        <p
          className="shrink-0 border-b border-accent-amber/40 bg-accent-amber/10 px-4 py-1.5 text-[12.5px] text-accent-amber sm:px-6"
          role="status"
        >
          Templates: {templates.error}
        </p>
      )}

      {/* Erfolgsfall */}
      {submitted && (
        <div className="shrink-0 border-b border-emerald-500/30 bg-emerald-500/5 px-4 py-3 sm:px-6">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-emerald-800">
                Job angelegt — Mail-Worker übernimmt den Versand.
              </p>
              <p
                className="mt-0.5 truncate font-mono text-[11.5px] text-emerald-700/80"
                title={submitted.id}
              >
                {submitted.id}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Link
                  to={`/emails/logs?id=${encodeURIComponent(submitted.id)}`}
                  className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-white px-2.5 py-1 text-[12px] font-medium text-emerald-700 hover:bg-emerald-50"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Im Email-Log öffnen
                </Link>
                <button
                  type="button"
                  onClick={handleReset}
                  className="inline-flex items-center gap-1 rounded-md border border-hair bg-white px-2.5 py-1 text-[12px] text-ink-700 hover:bg-ink-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Weiteren Job anlegen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-4 px-3 py-4 sm:gap-6 sm:px-6 sm:py-6 lg:flex-row">
        {/* Linke Spalte: Form */}
        <div className="flex w-full min-w-0 flex-col gap-4 lg:flex-1">
          {/* Empfänger */}
          <Card title="Empfänger" icon={<Mail className="h-3.5 w-3.5" />}>
            <Row label="E-Mail-Adresse" required>
              <input
                type="email"
                inputMode="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                disabled={!!submitted}
                placeholder="empfaenger@example.com"
                className={`w-full rounded-md border px-2.5 py-1.5 text-[13px] text-ink-900 focus:outline-none ${
                  recipientEmail && !recipientValid
                    ? "border-rose-400 focus:border-rose-500"
                    : "border-hair focus:border-ink-400"
                } disabled:bg-ink-50/40`}
              />
              {recipientEmail && !recipientValid && (
                <p className="mt-1 text-[11px] text-rose-600">
                  Bitte eine gültige Adresse eingeben.
                </p>
              )}
            </Row>
            <Row label="Absender (optional)">
              <input
                type="email"
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                disabled={!!submitted}
                className="w-full rounded-md border border-hair px-2.5 py-1.5 text-[13px] text-ink-900 focus:border-ink-400 focus:outline-none disabled:bg-ink-50/40"
              />
              <p className="mt-1 text-[11px] text-ink-500">
                Standard: <code>no-reply@vehicleimagery.com</code>
              </p>
            </Row>
            <Row
              label="Geplant für (optional)"
              hint="UTC. Leer = sofort."
            >
              <div className="flex items-center gap-1.5 rounded-md border border-hair bg-white px-2 py-1.5">
                <Calendar className="h-3.5 w-3.5 text-ink-400" />
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  disabled={!!submitted}
                  className="min-w-0 flex-1 border-0 bg-transparent text-[13px] text-ink-900 focus:outline-none"
                />
                {scheduledAt && (
                  <button
                    type="button"
                    onClick={() => setScheduledAt("")}
                    disabled={!!submitted}
                    className="text-ink-400 hover:text-ink-700"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </Row>
          </Card>

          {/* Template / Body */}
          <Card title="Inhalt" icon={<FileCode className="h-3.5 w-3.5" />}>
            <Row
              label="Template"
              hint="Wähle ein Template ODER schreibe einen Custom-Body weiter unten."
            >
              <select
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                disabled={!!submitted || templates.loading}
                className="w-full rounded-md border border-hair bg-white px-2.5 py-1.5 text-[13px] text-ink-900 focus:border-ink-400 focus:outline-none disabled:bg-ink-50/40"
              >
                <option value="">— Kein Template —</option>
                {(templates.data?.rows ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.id} · {t.subject}
                  </option>
                ))}
              </select>
            </Row>

            <Row
              label="Custom Subject (optional)"
              hint="Überschreibt den Subject des Templates."
            >
              <input
                type="text"
                value={customSubject}
                onChange={(e) => setCustomSubject(e.target.value)}
                disabled={!!submitted}
                placeholder={
                  preview.data?.subject ||
                  "Wenn leer: Template-Subject verwenden"
                }
                className="w-full rounded-md border border-hair px-2.5 py-1.5 text-[13px] text-ink-900 focus:border-ink-400 focus:outline-none disabled:bg-ink-50/40"
              />
            </Row>

            <div className="mt-2">
              <button
                type="button"
                onClick={() => setShowHtmlEditor((v) => !v)}
                disabled={!!submitted}
                className="inline-flex items-center gap-1.5 rounded-md border border-hair bg-white px-2.5 py-1 text-[12px] text-ink-700 hover:bg-ink-50 disabled:opacity-50"
              >
                <Wand2 className="h-3.5 w-3.5" />
                {showHtmlEditor ? "Custom-HTML verbergen" : "Custom-HTML schreiben"}
              </button>
            </div>

            {showHtmlEditor && (
              <Row
                label="Custom Body HTML (optional)"
                hint="Wenn gesetzt, ersetzt das den Body des Templates. Variablen wie {{name}} werden vom Mail-Worker ersetzt."
              >
                <textarea
                  value={customBodyHtml}
                  onChange={(e) => setCustomBodyHtml(e.target.value)}
                  disabled={!!submitted}
                  rows={10}
                  placeholder="<p>Hallo {{name}},</p>"
                  spellCheck={false}
                  className="w-full rounded-md border border-hair bg-paper/40 px-2.5 py-1.5 font-mono text-[12px] text-ink-900 focus:border-ink-400 focus:outline-none disabled:bg-ink-50/40"
                />
              </Row>
            )}
          </Card>

          {/* Variablen */}
          <Card title="Variablen" icon={<VariableIcon className="h-3.5 w-3.5" />}>
            <p className="mb-2 text-[11.5px] text-ink-500">
              Diese Variablen werden mit der Empfängeradresse als
              <code className="mx-1 rounded bg-ink-50 px-1 py-0.5 font-mono text-[10.5px]">
                recipient_data
              </code>
              gespeichert. Der Mail-Worker ersetzt
              <code className="mx-1 rounded bg-ink-50 px-1 py-0.5 font-mono text-[10.5px]">
                {`{{key}}`}
              </code>
              im HTML-Body.
            </p>

            <div className="mb-2 flex flex-wrap gap-1">
              {EMAIL_TEMPLATE_VARIABLES.map((v) => (
                <button
                  key={v.token}
                  type="button"
                  onClick={() => fillSuggestion(v.token)}
                  disabled={!!submitted}
                  title={`${v.label} hinzufügen`}
                  className="rounded-md border border-hair bg-white px-1.5 py-0.5 font-mono text-[10.5px] text-ink-700 hover:bg-ink-50 disabled:opacity-50"
                >
                  {v.token}
                </button>
              ))}
            </div>

            <ul className="space-y-1.5">
              {variables.map((v, idx) => (
                <li
                  key={idx}
                  className="flex items-center gap-1.5"
                >
                  <input
                    type="text"
                    value={v.key}
                    onChange={(e) => updateVariable(idx, { key: e.target.value })}
                    disabled={!!submitted}
                    placeholder="key (z. B. name)"
                    className="w-32 shrink-0 rounded-md border border-hair px-2 py-1 font-mono text-[12px] text-ink-900 focus:border-ink-400 focus:outline-none disabled:bg-ink-50/40"
                  />
                  <input
                    type="text"
                    value={v.value}
                    onChange={(e) => updateVariable(idx, { value: e.target.value })}
                    disabled={!!submitted}
                    placeholder="Wert"
                    className="min-w-0 flex-1 rounded-md border border-hair px-2 py-1 text-[12px] text-ink-900 focus:border-ink-400 focus:outline-none disabled:bg-ink-50/40"
                  />
                  <button
                    type="button"
                    onClick={() => removeVariable(idx)}
                    disabled={!!submitted}
                    className="rounded-md border border-hair bg-white p-1 text-ink-500 hover:bg-ink-50 hover:text-ink-900 disabled:opacity-50"
                    title="Variable entfernen"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={addVariable}
              disabled={!!submitted}
              className="mt-2 inline-flex items-center gap-1 rounded-md border border-hair bg-white px-2 py-1 text-[11.5px] text-ink-700 hover:bg-ink-50 disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              Variable hinzufügen
            </button>
          </Card>

          {/* Submit */}
          {!submitted && (
            <div className="sticky bottom-0 -mx-3 mt-1 flex flex-col items-stretch gap-2 border-t border-hair bg-paper/95 px-3 py-3 backdrop-blur sm:-mx-6 sm:flex-row sm:items-center sm:justify-end sm:px-6">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="inline-flex items-center justify-center gap-1.5 rounded-md bg-ink-900 px-3 py-2 text-[13px] font-medium text-white transition hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {submitting ? "Wird angelegt…" : "Job anlegen"}
              </button>
            </div>
          )}
        </div>

        {/* Rechte Spalte: Vorschau */}
        <aside className="flex w-full min-w-0 shrink-0 flex-col gap-4 lg:w-[420px]">
          <Card
            title="Vorschau"
            icon={<Eye className="h-3.5 w-3.5" />}
          >
            {!templateId && !customBodyHtml.trim() && (
              <p className="py-6 text-center text-[12px] text-ink-400">
                Wähle ein Template oder schreibe einen Custom-Body, um eine
                Vorschau zu sehen.
              </p>
            )}

            {(templateId || customBodyHtml.trim()) && (
              <>
                <p className="mb-1 text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-500">
                  Subject
                </p>
                <p className="mb-3 truncate rounded-md border border-hair bg-paper/40 px-2 py-1.5 text-[12.5px] text-ink-900">
                  {customSubject.trim() ||
                    preview.data?.subject?.trim() ||
                    "—"}
                </p>

                <p className="mb-1 text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-500">
                  Body
                </p>
                <div className="relative max-h-[60vh] overflow-y-auto rounded-md border border-hair bg-white">
                  {preview.loading && templateId && !customBodyHtml.trim() ? (
                    <p className="flex items-center justify-center gap-1.5 py-6 text-[12px] text-ink-500">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Lade Template…
                    </p>
                  ) : (
                    <iframe
                      title="Email-Vorschau"
                      srcDoc={
                        customBodyHtml.trim() ||
                        preview.data?.body_html ||
                        ""
                      }
                      sandbox=""
                      className="h-[60vh] w-full border-0"
                    />
                  )}
                </div>
                <p className="mt-1.5 text-[11px] text-ink-400">
                  Variablen wie <code>{`{{name}}`}</code> werden hier nicht
                  ersetzt — das passiert erst beim Versand durch den
                  Mail-Worker.
                </p>
              </>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}

// ─── Kleine Bausteine ─────────────────────────────────────────────────

function Card({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-hair bg-white p-3 sm:p-4">
      <h2 className="mb-3 inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-ink-500">
        {icon}
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Row({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-[11.5px] font-medium text-ink-700">
        {label}
        {required && <span className="ml-0.5 text-rose-500">*</span>}
      </label>
      {children}
      {hint && (
        <p className="mt-1 text-[11px] leading-relaxed text-ink-500">{hint}</p>
      )}
    </div>
  );
}
