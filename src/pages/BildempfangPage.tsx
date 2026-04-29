import { lazy, Suspense, useMemo } from "react";
import { useApi } from "../lib/customerApi";
import {
  type ImageUrlIpBreakdownResponse,
  imageUrlRequestsIpBreakdownUrl,
} from "../lib/bildempfangIpApi";
import { buildIpMapMarkers } from "../lib/bildempfangMapMarkers";
import { BILDBEMPFANG_OCEAN_BG } from "../lib/bildempfangMapTheme";

const BildempfangScene = lazy(
  () => import("../components/bildempfang/BildempfangScene"),
);

/**
 * Bildempfang — Vollbild-3D-Szene auf MapLibre + deck.gl.
 *
 * Bewusst kein zusätzlicher Header, keine Sidebar, keine Toolbar an der
 * Seite: der Seitenname steht schon im globalen `DashboardHeader`,
 * Detaildaten zur jeweiligen IP/Edge werden direkt am Punkt im
 * Click-Detail-Panel der Szene angezeigt (siehe `BildempfangScene`).
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
        <BildempfangScene ipMarkers={ipMarkers} />
      </Suspense>
    </div>
  );
}
