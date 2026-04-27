import { lazy, Suspense, useMemo } from "react";
import { useApi } from "../lib/customerApi";
import {
  type ImageUrlIpBreakdownResponse,
  imageUrlRequestsIpBreakdownUrl,
} from "../lib/bildempfangIpApi";
import { buildIpMapMarkers } from "../lib/bildempfangMapMarkers";

const BildempfangRealMap = lazy(
  () => import("../components/bildempfang/BildempfangRealMap"),
);

/**
 * Vollbild: nur Karte. Daten werden still im Hintergrund geladen.
 */
export default function BildempfangPage() {
  const ipUrl = useMemo(() => imageUrlRequestsIpBreakdownUrl(), []);
  const ip = useApi<ImageUrlIpBreakdownResponse>(ipUrl);

  const ipMarkers = useMemo(
    () => buildIpMapMarkers(ip.data?.rows ?? []),
    [ip.data?.rows],
  );

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col bg-black">
      <Suspense
        fallback={<div className="min-h-0 w-full min-w-0 flex-1 bg-black" aria-hidden />}
      >
        <BildempfangRealMap ipMarkers={ipMarkers} />
      </Suspense>
    </div>
  );
}
