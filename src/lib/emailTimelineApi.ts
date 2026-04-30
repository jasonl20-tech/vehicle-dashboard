/**
 * Email-Timeline — Live-Feed aller Email-Events.
 *
 * Backend: GET /api/emails/timeline — siehe
 * `functions/api/emails/timeline.ts`.
 *
 * Ein Eintrag ist entweder ein Job-Lifecycle-Event (`created` / `sent`
 * / `failed`) oder ein Tracking-Event (`open` / `click`).
 */

const API = "/api/emails/timeline";

export type EmailTimelineKind =
  | "created"
  | "sent"
  | "failed"
  | "open"
  | "click";

export type EmailTimelineEvent = {
  /** Stabile Event-ID. Tracking-Events behalten ihre `id`; Job-Events
   *  haben `job:<id>:<kind>`. */
  id: string;
  kind: EmailTimelineKind;
  at: string | null;
  job_id: string;
  recipient_email: string | null;
  custom_subject: string | null;
  template_id: string | null;
  status: string;
  link_url: string | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: string | null;
  error_message: string | null;
  retries: number | null;
};

export type EmailTimelineResponse = {
  rows: EmailTimelineEvent[];
  total: number;
  limit: number;
  offset: number;
  tracking_available: boolean;
  hint?: string;
};

export type EmailTimelineOpts = {
  q?: string;
  kind?: EmailTimelineKind | "";
  status?: "pending" | "processing" | "sent" | "failed" | "";
  from?: string | null;
  to?: string | null;
  /** Optional: nur Events für diesen Job (Detail-Seite). */
  job_id?: string | null;
  limit?: number;
  offset?: number;
};

export function emailTimelineUrl(opts: EmailTimelineOpts = {}): string {
  const u = new URL(API, "http://x");
  if (opts.q?.trim()) u.searchParams.set("q", opts.q.trim());
  if (opts.kind) u.searchParams.set("kind", opts.kind);
  if (opts.status) u.searchParams.set("status", opts.status);
  if (opts.from) u.searchParams.set("from", opts.from);
  if (opts.to) u.searchParams.set("to", opts.to);
  if (opts.job_id) u.searchParams.set("job_id", opts.job_id);
  if (opts.limit != null) u.searchParams.set("limit", String(opts.limit));
  if (opts.offset != null) u.searchParams.set("offset", String(opts.offset));
  return `${u.pathname}${u.search}`;
}
