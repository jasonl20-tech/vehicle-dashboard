export const CRM_CUSTOMERS_API = "/api/crm/customers" as const;

export type CrmCustomerRow = {
  id: string;
  created_at: string;
  email: string;
  company: string;
  status: string;
};

export type CrmCustomersListResponse = {
  rows: CrmCustomerRow[];
  total: number;
  offset: number;
  limit: number;
};

export function crmCustomersListUrl(opts: {
  q?: string;
  limit?: number;
  offset?: number;
}): string {
  const p = new URLSearchParams();
  if (opts.q) p.set("q", opts.q);
  if (opts.limit != null) p.set("limit", String(opts.limit));
  if (opts.offset != null) p.set("offset", String(opts.offset));
  const qs = p.toString();
  return `${CRM_CUSTOMERS_API}${qs ? `?${qs}` : ""}`;
}
