import { lazy, Suspense, useMemo } from "react";
import { useApi } from "../lib/customerApi";
import {
  type ImageUrlIpBreakdownResponse,
  imageUrlRequestsIpBreakdownUrl,
} from "../lib/bildempfangIpApi";
import { buildIpMapMarkers } from "../lib/bildempfangMapMarkers";
import { BILDBEMPFANG_OCEAN_BG } from "../lib/bildempfangMapTheme";

const BildempfangRealMap = lazy(
  () => import("../components/bildempfang/BildempfangRealMap"),
);

/**
 * Bildempfang — full-screen Karte. Bewusst kein Header, keine Sidebar,
 * keine Toolbar: der Seitenname steht bereits im globalen
 * `DashboardHeader`, und alle Detail-Daten zur jeweiligen IP/Edge werden
 * direkt am Punkt per Leaflet-Popup angezeigt (siehe
 * `BildempfangRealMap`).
 */
export default function BildempfangPage() {
  const ipUrl = useMemo(() => imageUrlRequestsIpBreakdownUrl(), []);
  const ip = useApi<ImageUrlIpBreakdownResponse>(ipUrl);

  const ipMarkers = useMemo(
    () => buildIpMapMarkers(ip.data?.rows ?? []),
    [ip.data?.rows],
  );

  return (
    <div
      className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col"
      style={{ backgroundColor: BILDBEMPFANG_OCEAN_BG }}
    >
      <Suspense
        fallback={
          <div
            className="min-h-0 w-full min-w-0 flex-1"
            style={{ backgroundColor: BILDBEMPFANG_OCEAN_BG }}
            aria-hidden
          />
        }
      >
        <BildempfangRealMap ipMarkers={ipMarkers} />
      </Suspense>
    </div>
  );
}
