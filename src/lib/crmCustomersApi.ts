export const CRM_CUSTOMERS_API = "/api/crm/customers" as const;

export type CrmCustomerRow = {
  id: string;
  created_at: string;
  email: string;
  company: string;
  status: string;
  /** ISO-3166-Alpha-2, leerer String wenn nicht gesetzt. */
  standort: string;
};

export type CrmCustomersListResponse = {
  rows: CrmCustomerRow[];
  total: number;
  offset: number;
  limit: number;
  /** Vorhanden, wenn `customers.standort` noch nicht existiert. */
  schemaWarning?: string;
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
