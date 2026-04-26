export const SUBMISSIONS_BY_COUNTRY_URL = "/api/website/submissions-by-country";

export type SubmissionsByCountryResponse = {
  byIso2: Record<string, number>;
  max: number;
  total: number;
  countryCount: number;
};
