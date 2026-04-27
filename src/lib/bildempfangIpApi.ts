import { IMAGE_URL_REQUESTS_GEO_DAYS } from "./bildaustrahlungGeoApi";

const PATH = "/api/intern-analytics/image-url-requests-ip-breakdown" as const;

export type ImageUrlIpRow = {
  ip: string;
  iso2: string;
  count: number;
  family: "v4" | "v6" | "unknown";
};

export type ImageUrlIpBreakdownResponse = {
  range: { from: string; to: string };
  days: number;
  engine: {
    name: string;
    modesTried: string[];
    accounts: string;
    ipColumn: string;
  };
  rows: ImageUrlIpRow[];
  totals: {
    v4: number;
    v6: number;
    nonIp: number;
    uniqueIpRows: number;
    requests: number;
  };
  hint?: string;
  queryWarnings?: string[];
  error?: string;
  details?: string[];
};

export function imageUrlRequestsIpBreakdownUrl(
  options: { days?: number } = {},
): string {
  const days = options.days ?? IMAGE_URL_REQUESTS_GEO_DAYS;
  return `${PATH}?${new URLSearchParams({ days: String(days) }).toString()}`;
}
