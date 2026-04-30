/**
 * Globale Email-Tracking-Statistik — read-only API-Client.
 *
 * Backend: `functions/api/emails/tracking.ts`.
 */
import type { EmailTrackingEvent } from "./emailJobsApi";

export const EMAIL_TRACKING_API = "/api/emails/tracking" as const;

export type EmailTrackingTotals = {
  jobs_total: number;
  jobs_sent: number;
  jobs_with_open: number;
  jobs_with_click: number;
  opens_total: number;
  clicks_total: number;
  unique_open_jobs: number;
  unique_click_jobs: number;
  unique_ips: number;
  /** 0..1 — Anteil gesendeter Jobs mit ≥1 Open. */
  open_rate: number;
  /** 0..1 — Anteil gesendeter Jobs mit ≥1 Click. */
  click_rate: number;
  /** 0..1 — Click-to-Open-Rate (= unique_click_jobs / unique_open_jobs). */
  click_to_open_rate: number;
  first_open_at: string | null;
  last_event_at: string | null;
};

export type EmailTrackingByDay = { day: string; opens: number; clicks: number };
export type EmailTrackingByHour = {
  hour: number;
  opens: number;
  clicks: number;
};
export type EmailTrackingTopLink = { link_url: string; count: number };
export type EmailTrackingTopCountry = { country: string; count: number };
export type EmailTrackingTopCity = {
  city: string;
  country: string | null;
  count: number;
};
export type EmailTrackingTopJob = {
  id: string;
  custom_subject: string | null;
  recipient_email: string | null;
  template_id: string | null;
  opens: number;
  clicks: number;
};

export type EmailTrackingRecentEvent = EmailTrackingEvent & {
  custom_subject: string | null;
  recipient_email: string | null;
};

export type EmailTrackingResponse = {
  range: { from: string | null; to: string | null };
  totals: EmailTrackingTotals;
  by_day: EmailTrackingByDay[];
  by_hour: EmailTrackingByHour[];
  top_links: EmailTrackingTopLink[];
  top_countries: EmailTrackingTopCountry[];
  top_cities: EmailTrackingTopCity[];
  top_jobs: EmailTrackingTopJob[];
  recent_events: EmailTrackingRecentEvent[];
  hint?: string;
};

export type EmailTrackingOpts = {
  /** ISO-String oder `YYYY-MM-DD HH:MM:SS`. */
  from?: string | null;
  to?: string | null;
};

export function emailTrackingUrl(opts: EmailTrackingOpts = {}): string {
  const p = new URLSearchParams();
  if (opts.from) p.set("from", opts.from);
  if (opts.to) p.set("to", opts.to);
  const qs = p.toString();
  return `${EMAIL_TRACKING_API}${qs ? `?${qs}` : ""}`;
}
