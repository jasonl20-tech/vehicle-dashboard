export type OverviewDwm = { day: number; week: number; month: number };

export type OverviewDailyPoint = {
  /** ISO-Datum (UTC), Format `YYYY-MM-DD`. */
  date: string;
  n: number;
};

export type OverviewStatsResponse = {
  website: {
    submissions: OverviewDwm;
    trialSubmissions: OverviewDwm;
    newsletter: OverviewDwm;
  };
  openControllingJobs: number;
  activeKeys: { productive: number; test: number } | null;
  /**
   * 30-Tage-Zeitreihen pro Quelle. Lückenfüllung im Backend, also immer
   * 30 Punkte (auch wenn Werte 0 sind).
   */
  daily?: {
    submissions: OverviewDailyPoint[];
    trialSubmissions: OverviewDailyPoint[];
    newsletter: OverviewDailyPoint[];
  };
};

export const OVERVIEW_STATS_URL = "/api/overview/stats";
