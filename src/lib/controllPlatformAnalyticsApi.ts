export const CONTROLL_PLATFORM_ANALYTICS_PATH =
  "/api/intern-analytics/controll-platform-action";

function clientNetworkRttMs(): number | undefined {
  if (typeof navigator === "undefined") return undefined;
  const nav = navigator as Navigator & {
    connection?: { rtt?: number };
  };
  const rtt = nav.connection?.rtt;
  if (typeof rtt === "number" && rtt > 0) return rtt;
  return undefined;
}

/**
 * Feuert einen Analytics-Datenpunkt (serverseitig → Analytics Engine).
 * Blockiert die UI nicht; Fehler werden verschluckt.
 */
export function postControllPlatformAnalyticsFireAndForget(payload: {
  actionLabel: string;
  viewsModeLabel: string;
  imageKey: string | null;
  clientRttMs?: number;
  metaJson?: string | null;
}): void {
  const body = {
    actionLabel: payload.actionLabel,
    viewsModeLabel: payload.viewsModeLabel,
    imageKey: payload.imageKey,
    clientRttMs: payload.clientRttMs ?? clientNetworkRttMs(),
    metaJson: payload.metaJson ?? undefined,
  };
  void fetch(CONTROLL_PLATFORM_ANALYTICS_PATH, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {});
}
