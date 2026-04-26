export type OverviewDwm = { day: number; week: number; month: number };

export type OverviewStatsResponse = {
  website: {
    submissions: OverviewDwm;
    trialSubmissions: OverviewDwm;
    newsletter: OverviewDwm;
  };
  openControllingJobs: number;
  activeKeys: { productive: number; test: number } | null;
};

export const OVERVIEW_STATS_URL = "/api/overview/stats";
