import type { SubmissionsByCountryResponse } from "./overviewGlobeApi";

export const IMAGE_URL_REQUESTS_GEO_URL =
  "/api/intern-analytics/image-url-requests-geo" as const;

export type ImageUrlRequestsGeoResponse = SubmissionsByCountryResponse & {
  domains: { domain: string; count: number }[];
  range: { from: string; to: string };
  engine: {
    name: string;
    mode: "dedicated" | "filter";
    binding: "primary" | "secondary";
  };
  queryWarnings?: string[];
};
