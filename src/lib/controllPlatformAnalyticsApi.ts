export const CONTROLL_PLATFORM_ANALYTICS_PATH =
  "/api/intern-analytics/controll-platform-action";

const ME_PING_PATH = "/api/me";

/**
 * Chromium: geschätzte Round-Trip-Zeit in ms (oft missing / 0 in Firefox, Safari, private mode).
 */
function clientNetworkRttFromConnectionApi(): number | undefined {
  if (typeof navigator === "undefined") return undefined;
  const nav = navigator as Navigator & {
    connection?: { rtt?: number; downlink?: number; effectiveType?: string };
  };
  const rtt = nav.connection?.rtt;
  if (typeof rtt === "number" && rtt > 0) return rtt;
  return undefined;
}

/**
 * Synthetische LATENCY analog zum Nutzer ↔ API (Session ist auf der Control Platform immer da).
 */
async function measureApiRoundTripMs(): Promise<number | undefined> {
  if (typeof performance === "undefined") return undefined;
  const t0 = performance.now();
  try {
    const res = await fetch(ME_PING_PATH, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });
    const ms = Math.round(performance.now() - t0);
    if (!res.ok) return undefined;
    return ms > 0 ? ms : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Feuert einen Analytics-Datenpunkt (serverseitig → Analytics Engine).
 * Blockiert die UI nicht; Fehler werden verschluckt.
 *
 * `blob7` / `clientRttMs`: bevorzugt echte Messung per `/api/me`-Ping, sonst
 * `navigator.connection.rtt`, falls der Browser das liefert.
 */
export function postControllPlatformAnalyticsFireAndForget(payload: {
  actionLabel: string;
  viewsModeLabel: string;
  imageKey: string | null;
  clientRttMs?: number;
  metaJson?: string | null;
}): void {
  void (async () => {
    const measured = await measureApiRoundTripMs();
    const fromConn = clientNetworkRttFromConnectionApi();
    const clientRttMs =
      payload.clientRttMs ?? measured ?? fromConn;

    const body = {
      actionLabel: payload.actionLabel,
      viewsModeLabel: payload.viewsModeLabel,
      imageKey: payload.imageKey,
      ...(clientRttMs != null && Number.isFinite(clientRttMs) ?
        { clientRttMs }
      : {}),
      metaJson: payload.metaJson ?? undefined,
    };

    try {
      await fetch(CONTROLL_PLATFORM_ANALYTICS_PATH, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      /* Analytics darf Steuerung nicht stören */
    }
  })();
}
