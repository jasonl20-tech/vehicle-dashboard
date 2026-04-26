export const WEBSITE_NEWSLETTER_API = "/api/website/newsletter";

export type NewsletterRow = {
  id: string;
  created_at: string;
  metadata: unknown;
  active: boolean;
};

export type NewsletterListResponse = {
  rows: NewsletterRow[];
  total: number;
  offset: number;
  limit: number;
};

export function websiteNewsletterListUrl(p: {
  q: string;
  limit: number;
  offset: number;
  active: "all" | "0" | "1";
}): string {
  const u = new URL(WEBSITE_NEWSLETTER_API, "https://x");
  u.searchParams.set("limit", String(p.limit));
  u.searchParams.set("offset", String(p.offset));
  if (p.q.trim()) u.searchParams.set("q", p.q.trim());
  if (p.active !== "all") u.searchParams.set("active", p.active);
  return u.pathname + u.search;
}
