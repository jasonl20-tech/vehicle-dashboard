/**
 * Email-Jobs (Versand-Log) — API-Client.
 *
 * Backend-Routen (siehe `functions/api/emails/jobs.ts` + `[id].ts` + `[id]/events.ts`):
 *   GET  /api/emails/jobs              Liste mit Filter/Pagination + Tracking-Aggregate
 *   GET  /api/emails/jobs/<id>         einzelner Job inkl. raw HTML + Tracking-Summary
 *   GET  /api/emails/jobs/<id>/events  paginierte Tracking-Events eines Jobs
 *   POST /api/emails/jobs              Email manuell anlegen (pending → Mail-Worker)
 *
 * Mutation auf einem Job (Status, Retries, sent_at, …) erfolgt
 * ausschließlich vom externen Mail-Worker, nicht hier.
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
  recipient_email: string;
  /** Wird vom Mail-Worker beim Versand gesetzt — Dashboard schreibt nicht. */
  tracking_id: string | null;
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
  from_name: string | null;
  /** Anzahl `open`-Events, gesamt. */
  open_count: number;
  /** Anzahl `click`-Events, gesamt. */
  click_count: number;
  /** Distinct IPs, die geöffnet haben. */
  unique_open_count: number;
  /** Distinct IPs, die geklickt haben. */
  unique_click_count: number;
  first_open_at: string | null;
  last_event_at: string | null;
};

export type EmailJobTrackingSummary = {
  open_count: number;
  click_count: number;
  unique_open_count: number;
  unique_click_count: number;
  unique_ip_count: number;
  first_open_at: string | null;
  last_open_at: string | null;
  first_click_at: string | null;
  last_click_at: string | null;
  last_event_at: string | null;
  top_links: { link_url: string; count: number }[];
  top_countries: { country: string; count: number }[];
  top_cities: { city: string; country: string | null; count: number }[];
  events_by_day: { day: string; opens: number; clicks: number }[];
};

/** Voller Datensatz (Detail-Endpoint). */
export type EmailJobFull = {
  id: string;
  recipient_email: string;
  tracking_id: string | null;
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
  from_name: string | null;
  tracking: EmailJobTrackingSummary;
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

export function emailJobEventsUrl(
  id: string,
  opts: {
    q?: string;
    event_type?: "open" | "click" | "";
    limit?: number;
    offset?: number;
  } = {},
): string {
  const p = new URLSearchParams();
  if (opts.q) p.set("q", opts.q);
  if (opts.event_type) p.set("event_type", opts.event_type);
  if (opts.limit != null) p.set("limit", String(opts.limit));
  if (opts.offset != null) p.set("offset", String(opts.offset));
  const qs = p.toString();
  return `${EMAIL_JOBS_API}/${encodeURIComponent(id)}/events${
    qs ? `?${qs}` : ""
  }`;
}

// ─── Tracking-Events ───────────────────────────────────────────────────

export type EmailTrackingEventType = "open" | "click";

export type EmailTrackingEvent = {
  id: string;
  job_id: string;
  event_type: string;
  link_url: string | null;
  user_agent: string | null;
  ip_address: string | null;
  /** JSON-String, kann z. B. `{country, city, continent, timezone}` sein. */
  metadata: string | null;
  created_at: string | null;
};

export type EmailTrackingEventsResponse = {
  rows: EmailTrackingEvent[];
  total: number;
  limit: number;
  offset: number;
  eventCounts: Record<string, number>;
  hint?: string;
};

export type EmailTrackingMetadata = {
  country?: string;
  city?: string;
  continent?: string;
  timezone?: string;
  [k: string]: unknown;
};

export function parseTrackingMetadata(
  raw: string | null | undefined,
): EmailTrackingMetadata | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    if (v && typeof v === "object" && !Array.isArray(v)) {
      return v as EmailTrackingMetadata;
    }
  } catch {
    // ignore
  }
  return null;
}

// ─── Helpers ──────────────────────────────────────────────────────────

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
export function recipientSummary(
  raw: string | null | undefined,
  fallbackEmail?: string | null,
): string {
  const parsed = parseRecipientData(raw);
  if (!parsed) {
    if (fallbackEmail?.trim()) return fallbackEmail.trim();
    return raw?.trim() || "—";
  }
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
    fallbackEmail ||
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

// ─── Mutation: Email manuell anlegen ──────────────────────────────────

async function asJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // ignore
  }
  if (!res.ok) {
    const j = (json ?? {}) as { error?: string; hint?: string };
    const parts: string[] = [j.error || `HTTP ${res.status}`];
    if (j.hint) parts.push(`Hinweis: ${j.hint}`);
    throw new Error(parts.join(" • "));
  }
  return (json ?? null) as T;
}

export type CreateEmailJobInput = {
  recipient_email: string;
  /** Optional: Variablen für Template oder freie Daten. */
  recipient_data?: Record<string, unknown> | null;
  template_id?: string | null;
  custom_subject?: string | null;
  custom_body_html?: string | null;
  /** ISO oder `YYYY-MM-DD HH:MM:SS`. Wenn nicht gesetzt → sofort. */
  scheduled_at?: string | null;
  /** Default: `support@vehicleimagery.com`. */
  from_email?: string | null;
  from_name?: string | null;
};

export const DEFAULT_FROM_EMAIL = "support@vehicleimagery.com";

export async function createEmailJob(
  input: CreateEmailJobInput,
): Promise<EmailJobFull> {
  const payload: Record<string, unknown> = {
    recipient_email: input.recipient_email,
  };
  if (input.recipient_data != null) {
    payload.recipient_data = input.recipient_data;
  }
  if (input.template_id) payload.template_id = input.template_id;
  if (input.custom_subject) payload.custom_subject = input.custom_subject;
  if (input.custom_body_html) payload.custom_body_html = input.custom_body_html;
  if (input.scheduled_at) payload.scheduled_at = input.scheduled_at;
  if (input.from_email) payload.from_email = input.from_email;
  if (input.from_name) payload.from_name = input.from_name;

  const res = await fetch(EMAIL_JOBS_API, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return asJson<EmailJobFull>(res);
}
