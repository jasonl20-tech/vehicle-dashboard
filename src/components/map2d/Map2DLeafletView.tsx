import {
  anfragenKarteMap2DModel,
  getMap2DChoroplethPathOptions,
} from "../../config/anfragenKarteMap2DModel";
import type { SubmissionsByCountryResponse } from "../../lib/overviewGlobeApi";
import { countForFeature } from "../../lib/requestsChoropleth";
import { escapeHtml } from "../../lib/escapeHtml";
import type { NeFeature, NeFeatureCollection } from "../../lib/anfragenKarteGeo";
import { useCallback, useEffect } from "react";
import { GeoJSON, MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const m = anfragenKarteMap2DModel;

type Props = {
  geo: NeFeatureCollection;
  data: SubmissionsByCountryResponse | null;
  dataKey: string;
};

function FitBounds({ data }: { data: NeFeatureCollection | null }) {
  const map = useMap();
  const apply = useCallback(() => {
    if (!data?.features.length) {
      map.setView(m.fitFallback.center, m.fitFallback.zoom);
      return;
    }
    const layer = L.geoJSON(data);
    const b = layer.getBounds();
    if (b.isValid()) {
      map.fitBounds(b, {
        padding: m.fitBounds.padding,
        maxZoom: m.fitBounds.maxZoom,
      });
    } else {
      map.setView(m.fitFallback.center, m.fitFallback.zoom);
    }
  }, [data, map]);

  useEffect(() => {
    apply();
  }, [apply]);

  return null;
}

export default function Map2DLeafletView({ geo, data, dataKey }: Props) {
  return (
    <div className="h-[min(72vh,720px)] w-full min-h-[480px] md:min-h-[560px] [&_.leaflet-container]:z-0">
      <MapContainer
        center={m.view.center}
        zoom={m.view.zoom}
        minZoom={m.view.minZoom}
        maxZoom={m.view.maxZoom}
        className="h-full w-full rounded-b-xl"
        scrollWheelZoom={m.view.scrollWheelZoom}
        worldCopyJump={m.view.worldCopyJump}
      >
        <TileLayer attribution={m.tile.attribution} url={m.tile.url} />
        <GeoJSON
          key={dataKey}
          data={geo}
          style={(f) => {
            if (!f) return { fillOpacity: 0, weight: 0, opacity: 0 };
            const p = f.properties as NeFeature["properties"];
            return getMap2DChoroplethPathOptions(data, p?.ISO_A2);
          }}
          onEachFeature={(f, layer) => {
            if (!f) return;
            const p = f.properties as NeFeature["properties"];
            const name = p?.ADMIN
              ? String(p.ADMIN)
              : (p?.ISO_A2 ?? "");
            const c = countForFeature(data, p?.ISO_A2);
            if (c > 0) {
              layer.bindPopup(
                `<div style="min-width:120px"><strong>${escapeHtml(
                  name,
                )}</strong><br/>${c} Anfrage${c === 1 ? "" : "n"}</div>`,
              );
            } else {
              layer.bindPopup(
                `<div><strong>${escapeHtml(name)}</strong></div>`,
              );
            }
          }}
        />
        <FitBounds data={geo} />
      </MapContainer>
    </div>
  );
}
