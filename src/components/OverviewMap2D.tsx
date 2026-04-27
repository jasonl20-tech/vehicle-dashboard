import Map2DWorldSvg from "./map2d/Map2DWorldSvg";
import { Map2DChrome, Map2DLegend } from "./map2d/Map2DChrome";
import { anfragenKarteMap2DModel } from "../config/anfragenKarteMap2DModel";
import type { ChoroplethMapUi } from "../lib/choroplethMapUi";
import type { SubmissionsByCountryResponse } from "../lib/overviewGlobeApi";
import type { IpMapMarker } from "../lib/bildempfangMapMarkers";
import type { BildaustrahlungArc } from "../lib/bildaustrahlungArcsApi";
import {
  COUNTRIES_GEOJSON_URL,
  toFeatureCollection,
  type NeFeature,
  type NeFeatureCollection,
} from "../lib/anfragenKarteGeo";
import { useEffect, useState } from "react";

/**
 * 2D-Ansicht: Komposition aus {@link Map2DChrome} + {@link Map2DLeafletView}.
 * Konfiguration: `../config/anfragenKarteMap2DModel.ts`, geteilte Farben: `../lib/requestsChoropleth`.
 */
export default function OverviewMap2D({
  data,
  loading,
  error,
  copy,
  arcs,
  ipMarkers,
  tacticalMap = false,
}: {
  data: SubmissionsByCountryResponse | null;
  loading: boolean;
  error: string | null;
  copy?: Partial<ChoroplethMapUi>;
  /** Bögen vom Kundenstandort zum Viewer-Land (Bildaustrahlung). */
  arcs?: BildaustrahlungArc[];
  /** Optional: IP-Marker (Bildempfang). */
  ipMarkers?: IpMapMarker[];
  /**
   * Dunkle taktische Karte, hoher Zoom, Städte-Labels, rote IP-Zonen, weiße
   * Spoken — nur sinnvoll mit `ipMarkers` (Bildempfang).
   */
  tacticalMap?: boolean;
}) {
  const empty =
    copy?.emptyGeoText ?? anfragenKarteMap2DModel.ui.emptyGeoText;
  const [geo, setGeo] = useState<NeFeatureCollection | null>(null);

  useEffect(() => {
    let ok = true;
    fetch(COUNTRIES_GEOJSON_URL)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<{ features?: NeFeature[] }>;
      })
      .then((gj) => {
        if (ok) setGeo(toFeatureCollection(gj.features));
      })
      .catch(() => {
        if (ok) setGeo({ type: "FeatureCollection", features: [] });
      });
    return () => {
      ok = false;
    };
  }, []);

  const dataKey = `${data?.total ?? 0}-${data?.max ?? 0}-ip${ipMarkers?.length ?? 0}`;

  return (
    <div
      className={
        tacticalMap
          ? "relative overflow-hidden rounded-xl border border-cyan-900/40 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950"
          : "relative overflow-hidden rounded-xl border border-hair bg-gradient-to-b from-paper to-[#eef3f6]"
      }
    >
      <Map2DChrome
        data={data}
        loading={loading}
        error={error}
        copy={copy}
        tactical={tacticalMap}
      />

      <div
        className="relative w-full"
        style={{ minHeight: tacticalMap ? "min(80vh, 860px)" : "min(72vh, 720px)" }}
      >
        {geo && geo.features.length > 0 ? (
          <Map2DWorldSvg
            geo={geo}
            data={data}
            dataKey={dataKey}
            arcs={arcs}
            ipMarkers={ipMarkers}
            tacticalMode={tacticalMap}
          />
        ) : (
          <div
            className={
              tacticalMap
                ? "grid h-[min(80vh,860px)] min-h-[520px] place-items-center text-[13px] text-slate-500"
                : "grid h-[min(72vh,720px)] min-h-[480px] place-items-center text-[13px] text-ink-500"
            }
            role="status"
          >
            {empty}
          </div>
        )}

        <Map2DLegend copy={copy} tactical={tacticalMap} />
      </div>
    </div>
  );
}
