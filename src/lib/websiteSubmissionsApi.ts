export const WEBSITE_SUBMISSIONS_API = "/api/website/submissions";

export type WebsiteSubmissionRow = {
  id: string;
  created_at: string;
  form_tag: string;
  payload: unknown;
  metadata: unknown;
  spam: boolean;
  erledigt: boolean;
};

export type WebsiteSubmissionsListResponse = {
  rows: WebsiteSubmissionRow[];
  total: number;
  offset: number;
  limit: number;
};

export type AnfragenAnsicht = "offen" | "alle";

export function websiteSubmissionsListUrl(p: {
  q: string;
  limit: number;
  offset: number;
  spam: "all" | "0" | "1";
  /** Standard: nur nicht erledigte (`erledigt = 0`) */
  ansicht?: AnfragenAnsicht;
}): string {
  const u = new URL(WEBSITE_SUBMISSIONS_API, "https://x");
  u.searchParams.set("limit", String(p.limit));
  u.searchParams.set("offset", String(p.offset));
  u.searchParams.set("ansicht", p.ansicht ?? "offen");
  if (p.q.trim()) u.searchParams.set("q", p.q.trim());
  if (p.spam !== "all") u.searchParams.set("spam", p.spam);
  return u.pathname + u.search;
}

/** `erledigt` in D1 setzen (0/1). */
export async function patchWebsiteSubmissionErledigt(
  params: { trial: boolean; id: string; erledigt: boolean },
): Promise<void> {
  const url = params.trial
    ? "/api/website/trial-submissions"
    : WEBSITE_SUBMISSIONS_API;
  const res = await fetch(url, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: params.id,
      erledigt: params.erledigt ? 1 : 0,
    }),
  });
  const j = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    throw new Error(j.error || `HTTP ${res.status}`);
  }
}
