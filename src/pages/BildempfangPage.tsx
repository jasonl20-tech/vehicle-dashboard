import { lazy, Suspense, useMemo, useState } from "react";
import BildempfangSidebar from "../components/bildempfang/BildempfangSidebar";
import { useApi } from "../lib/customerApi";
import {
  type ImageUrlIpBreakdownResponse,
  imageUrlRequestsIpBreakdownUrl,
} from "../lib/bildempfangIpApi";
import { buildIpMapMarkers, type IpMapMarker } from "../lib/bildempfangMapMarkers";
import { BILDBEMPFANG_OCEAN_BG } from "../lib/bildempfangMapTheme";
import PageHeader from "../components/ui/PageHeader";
import { fmtNumber } from "../lib/customerApi";

const BildempfangRealMap = lazy(
  () => import("../components/bildempfang/BildempfangRealMap"),
);

/**
 * Bildempfang-Seite: Karte + permanente Analytic-Sidebar.
 * Anders als zuvor wird kein Vollbild-Overlay mehr genutzt — die Page
 * verhält sich wie jede andere Dashboard-Page (Header oben + Inhalt
 * darunter), damit globale Overlays wie die Cmd+K-Palette zuverlässig
 * darüber landen.
 */
export default function BildempfangPage() {
  const ipUrl = useMemo(() => imageUrlRequestsIpBreakdownUrl(), []);
  const ip = useApi<ImageUrlIpBreakdownResponse>(ipUrl);
  const [selected, setSelected] = useState<IpMapMarker | null>(null);

  const ipMarkers = useMemo(
    () => buildIpMapMarkers(ip.data?.rows ?? []),
    [ip.data?.rows],
  );

  const totals = ip.data?.totals;
  const summaryRight = (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-ink-500">
      {totals ? (
        <>
          <span>
            <strong className="font-semibold text-ink-900 tabular-nums">
              {fmtNumber(totals.uniqueIpRows)}
            </strong>{" "}
            IPs
          </span>
          <span>
            <strong className="font-semibold text-ink-900 tabular-nums">
              {fmtNumber(totals.requests)}
            </strong>{" "}
            Requests
          </span>
          <span className="tabular-nums">
            v4 {fmtNumber(totals.v4)} · v6 {fmtNumber(totals.v6)}
          </span>
        </>
      ) : ip.loading ? (
        <span>Lade Analytics …</span>
      ) : (
        <span>Keine Daten</span>
      )}
    </div>
  );

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col">
      <div className="border-b border-hair px-5 pb-3 pt-4 sm:px-8">
        <PageHeader
          eyebrow="Ansichten"
          title="Bildempfang"
          description="Bild-URL-Requests pro Client-IP und Land (Analytics Engine `image_url_requests`). Ein Klick auf einen Marker öffnet die Detail-Analyse rechts."
          rightSlot={summaryRight}
        />
        {ip.error && (
          <p className="mt-2 text-[12.5px] text-accent-amber" role="status">
            {ip.error}
          </p>
        )}
        {ip.data?.queryWarnings && ip.data.queryWarnings.length > 0 && (
          <p
            className="mt-2 text-[12px] text-ink-500"
            title={ip.data.queryWarnings.join(" | ")}
          >
            Hinweis: {ip.data.queryWarnings[0]?.slice(0, 220)}
          </p>
        )}
      </div>

      <div className="flex min-h-0 w-full min-w-0 flex-1">
        <div
          className="relative flex min-h-0 min-w-0 flex-1 flex-col"
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
            <BildempfangRealMap
              ipMarkers={ipMarkers}
              selectedKey={selected?.key ?? null}
              onSelect={setSelected}
            />
          </Suspense>
        </div>
        <BildempfangSidebar
          markers={ipMarkers}
          selected={selected}
          onSelect={setSelected}
          loading={ip.loading}
        />
      </div>
    </div>
  );
}
