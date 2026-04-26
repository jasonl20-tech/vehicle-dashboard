export const WEBSITE_SUBMISSIONS_API = "/api/website/submissions";

export type WebsiteSubmissionRow = {
  id: string;
  created_at: string;
  form_tag: string;
  payload: unknown;
  metadata: unknown;
  spam: boolean;
};

export type WebsiteSubmissionsListResponse = {
  rows: WebsiteSubmissionRow[];
  total: number;
  offset: number;
  limit: number;
};

export function websiteSubmissionsListUrl(p: {
  q: string;
  limit: number;
  offset: number;
  spam: "all" | "0" | "1";
}): string {
  const u = new URL(WEBSITE_SUBMISSIONS_API, "https://x");
  u.searchParams.set("limit", String(p.limit));
  u.searchParams.set("offset", String(p.offset));
  if (p.q.trim()) u.searchParams.set("q", p.q.trim());
  if (p.spam !== "all") u.searchParams.set("spam", p.spam);
  return u.pathname + u.search;
}
