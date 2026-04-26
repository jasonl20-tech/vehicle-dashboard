import type { SubmissionsByCountryResponse } from "./overviewGlobeApi";

const IMAGE_URL_REQUESTS_GEO_PATH =
  "/api/intern-analytics/image-url-requests-geo" as const;

/** Standard-Zeitraum in Tagen (muss mit Backend `DEFAULT_DAYS` passen). */
export const IMAGE_URL_REQUESTS_GEO_DAYS = 90 as const;

export const IMAGE_URL_REQUESTS_GEO_URL = `${IMAGE_URL_REQUESTS_GEO_PATH}?days=${IMAGE_URL_REQUESTS_GEO_DAYS}` as const;

export type ImageUrlRequestsGeoResponse = SubmissionsByCountryResponse & {
  domains: { domain: string; count: number }[];
  range: { from: string; to: string };
  engine: {
    name: string;
    mode: "dedicated" | "filter";
    accounts: "all" | "primary" | "secondary";
    days: number;
  };
  queryWarnings?: string[];
};
