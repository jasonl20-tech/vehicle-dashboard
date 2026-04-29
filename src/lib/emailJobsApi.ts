/**
 * Email-Jobs (Versand-Log) — read-only API-Client.
 *
 * Backend-Routen (siehe `functions/api/emails/jobs.ts`):
 *   GET /api/emails/jobs       Liste mit Filter/Pagination
 *   GET /api/emails/jobs/<id>  einzelner Job inkl. raw `custom_body_html`
 *
 * Bewusst sind hier KEINE Mutations-Funktionen exportiert.
 * Email-Jobs werden ausschließlich vom externen Mail-Worker geschrieben.
 */
export const EMAIL_JOBS_API = "/api/emails/jobs" as const;

/** Erlaubte Status-Werte (Server validiert dasselbe Set). */
export const EMAIL_JOB_STATUSES = [
  "pending",
  "processing",
  "sent",
  "failed",
] as const;
export type EmailJobStatus = (typeof EMAIL_JOB_STATUSES)[number];

/** Zeile in der Liste. `custom_body_html` wird hier nur als Länge gemeldet. */
export type EmailJobRow = {
  id: string;
  recipient_data: string;
  template_id: string | null;
  custom_subject: string | null;
  custom_body_html_length: number;
  status: string;
  error_message: string | null;
  retries: number;
  scheduled_at: string | null;
  sent_at: string | null;
  created_at: string | null;
  from_email: string;
};

/** Voller Datensatz (Detail-Endpoint). */
export type EmailJobFull = {
  id: string;
  recipient_data: string;
  template_id: string | null;
  custom_subject: string | null;
  custom_body_html: string | null;
  status: string;
  error_message: string | null;
  retries: number;
  scheduled_at: string | null;
  sent_at: string | null;
  created_at: string | null;
  from_email: string;
};

export type EmailJobsListResponse = {
  rows: EmailJobRow[];
  total: number;
  limit: number;
  offset: number;
  /** `{ pending: 12, sent: 1500, failed: 3 }` für die aktuelle Filter-Menge. */
  statusCounts: Partial<Record<EmailJobStatus, number>> & Record<string, number>;
  hint?: string;
};

export type EmailJobsListOpts = {
  q?: string;
  status?: EmailJobStatus | "";
  template_id?: string;
  /** ISO-String oder `YYYY-MM-DD`. Inklusive. */
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
};

export function emailJobsListUrl(opts: EmailJobsListOpts = {}): string {
  const p = new URLSearchParams();
  if (opts.q) p.set("q", opts.q);
  if (opts.status) p.set("status", opts.status);
  if (opts.template_id) p.set("template_id", opts.template_id);
  if (opts.from) p.set("from", opts.from);
  if (opts.to) p.set("to", opts.to);
  if (opts.limit != null) p.set("limit", String(opts.limit));
  if (opts.offset != null) p.set("offset", String(opts.offset));
  const qs = p.toString();
  return `${EMAIL_JOBS_API}${qs ? `?${qs}` : ""}`;
}

export function emailJobUrl(id: string): string {
  return `${EMAIL_JOBS_API}/${encodeURIComponent(id)}`;
}

/**
 * Recipient-JSON sicher parsen. Wenn der Worker ein nicht-JSON-Feld
 * abgelegt hat, geben wir `null` zurück, damit das UI das im Detail
 * weiter als raw String anzeigen kann.
 */
export function parseRecipientData(raw: string | null | undefined):
  | Record<string, unknown>
  | unknown[]
  | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    if (v && (typeof v === "object")) {
      return v as Record<string, unknown> | unknown[];
    }
    return null;
  } catch {
    return null;
  }
}

/** Hübsche Anzeige für das Empfänger-Feld in der Liste. */
export function recipientSummary(raw: string | null | undefined): string {
  const parsed = parseRecipientData(raw);
  if (!parsed) return raw?.trim() || "—";
  if (Array.isArray(parsed)) {
    return parsed.length === 1 && typeof parsed[0] === "string"
      ? (parsed[0] as string)
      : `${parsed.length} Empfänger`;
  }
  const obj = parsed as Record<string, unknown>;
  const email =
    (typeof obj.email === "string" && obj.email) ||
    (typeof obj.to === "string" && obj.to) ||
    (typeof obj.recipient === "string" && obj.recipient) ||
    null;
  const name =
    (typeof obj.name === "string" && obj.name) ||
    (typeof obj.first_name === "string" && obj.first_name) ||
    null;
  if (email && name) return `${name} · ${email}`;
  if (email) return email;
  if (name) return name;
  return raw?.trim() || "—";
}

/** Tailwind-Tokens für Status-Badges. */
export function statusBadge(status: string): {
  label: string;
  className: string;
} {
  const s = status.toLowerCase();
  switch (s) {
    case "sent":
      return {
        label: "Gesendet",
        className:
          "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
      };
    case "failed":
      return {
        label: "Fehlgeschlagen",
        className:
          "border-rose-500/30 bg-rose-500/10 text-rose-700",
      };
    case "processing":
      return {
        label: "Wird verarbeitet",
        className:
          "border-sky-500/30 bg-sky-500/10 text-sky-700",
      };
    case "pending":
      return {
        label: "Wartend",
        className:
          "border-amber-500/30 bg-amber-500/10 text-amber-700",
      };
    default:
      return {
        label: status || "—",
        className: "border-hair bg-ink-50 text-ink-700",
      };
  }
}
