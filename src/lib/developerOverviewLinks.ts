import { pathDirectlyAllowed } from "./routeAccess";

export const DEVELOPER_HUB_PATH = "/developer" as const;

/** Schnellzugriffe für die Developer-Übersicht (Ziele im Dashboard). */
export const DEVELOPER_OVERVIEW_LINKS: readonly { label: string; to: string }[] =
  [
    {
      label: "Produktions-Datenbank",
      to: "/dashboard/databases/production",
    },
    {
      label: "Produktions-Images",
      to: "/dashboard/databases/production-images",
    },
    { label: "Datenbank-Status", to: "/dashboard/databases/status" },
    { label: "Assets", to: "/dashboard/databases/assets" },
    { label: "Prompts", to: "/dashboard/systeme/prompts" },
    {
      label: "Blockierte Fahrzeuge",
      to: "/dashboard/systeme/blockierte-fahrzeuge",
    },
    { label: "Mapping", to: "/dashboard/systeme/mapping" },
    { label: "Kunden API", to: "/dashboard/analytics/kunden-api" },
    { label: "Oneauto API", to: "/dashboard/analytics/oneauto-api" },
    {
      label: "Skalierungs-Worker (Logs)",
      to: "/dashboard/logs/skalierungs-worker",
    },
    {
      label: "Generierungs-Worker (Logs)",
      to: "/dashboard/logs/generierungs-worker",
    },
  ];

export function mayAccessDeveloperHub(pfade: readonly string[]): boolean {
  return DEVELOPER_OVERVIEW_LINKS.some((l) =>
    pathDirectlyAllowed(l.to, pfade),
  );
}
