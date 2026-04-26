export const CRM_CUSTOMERS_API = "/api/website/crm-customers";
export const CRM_CUSTOMERS_SYNC_API = "/api/website/crm-customers/sync";

export type CrmCustomerRow = {
  id: string;
  created_at: string;
  updated_at: string;
  email: string;
  status: string;
  email_status: number;
  business_name: string | null;
  kv_key: string | null;
  additional_emails: string;
  notes: string | null;
};

export type CrmCustomersListResponse = {
  rows: CrmCustomerRow[];
  total: number;
  offset: number;
  limit: number;
};

export function crmCustomersListUrl(p: {
  q: string;
  limit: number;
  offset: number;
}): string {
  const u = new URL(CRM_CUSTOMERS_API, "http://_");
  if (p.q.trim()) u.searchParams.set("q", p.q.trim());
  u.searchParams.set("limit", String(p.limit));
  u.searchParams.set("offset", String(p.offset));
  return `${u.pathname}${u.search}`;
}

export type CrmSyncResponse = {
  ok: boolean;
  inserted: number;
  insertedFromKv: number;
  insertedFromSubmissions: number;
  skippedKvWithoutEmail: number;
  skippedSubmissionWithoutEmail: number;
  skippedAlreadyInCrm: number;
  submissionsScanned: number;
};

export async function postCrmSync(): Promise<CrmSyncResponse> {
  const res = await fetch(CRM_CUSTOMERS_SYNC_API, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  const json = (await res.json().catch(() => ({}))) as CrmSyncResponse & {
    error?: string;
  };
  if (!res.ok) {
    throw new Error(json.error || `Sync HTTP ${res.status}`);
  }
  return json;
}

export function parseAdditionalEmails(json: string | null | undefined): string[] {
  if (!json?.trim()) return [];
  try {
    const v = JSON.parse(json) as unknown;
    if (Array.isArray(v)) {
      return v.filter((x): x is string => typeof x === "string" && x.includes("@"));
    }
    return [];
  } catch {
    return [];
  }
}
