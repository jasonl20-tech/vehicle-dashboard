import type { SubmissionsByCountryResponse } from "./overviewGlobeApi";

const IMAGE_URL_REQUESTS_GEO_PATH =
  "/api/intern-analytics/image-url-requests-geo" as const;

/** Standard-Zeitraum in Tagen (muss mit Backend `DEFAULT_DAYS` passen). */
export const IMAGE_URL_REQUESTS_GEO_DAYS = 90 as const;

export function imageUrlRequestsGeoUrl(
  options: { days?: number; diagnose?: boolean } = {},
): string {
  const days = options.days ?? IMAGE_URL_REQUESTS_GEO_DAYS;
  const p = new URLSearchParams({ days: String(days) });
  if (options.diagnose) p.set("diagnose", "1");
  return `${IMAGE_URL_REQUESTS_GEO_PATH}?${p.toString()}`;
}

export const IMAGE_URL_REQUESTS_GEO_URL = imageUrlRequestsGeoUrl();

export type ImageUrlRequestsGeoResponse = SubmissionsByCountryResponse & {
  domains: { domain: string; count: number }[];
  range: { from: string; to: string };
  engine: {
    name: string;
    mode: "auto" | "dedicated" | "filter";
    modesTried?: ("filter" | "dedicated")[];
    accounts: "all" | "primary" | "secondary";
    days: number;
  };
  stats: {
    perSource: {
      binding: "primary" | "secondary";
      mode: "filter" | "dedicated";
      fromTable: string;
      countryGroupRows: number;
      domainGroupRows: number;
      volumeInRange?: number;
      datasetsTopFiltered?: { dataset: string; count: number }[];
      errors?: string[];
    }[];
    countryGroupsTotal: number;
    domainGroupsTotal: number;
    countryGroupsRejected: number;
    sampleRejectedBlob3: string[];
    hint?: string;
  };
  queryWarnings?: string[];
};
