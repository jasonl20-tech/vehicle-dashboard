import type { SubmissionsByCountryResponse } from "../lib/overviewGlobeApi";
import {
  countForFeature,
  leafletChoroplethPathOptions,
} from "../lib/requestsChoropleth";
import { useCallback, useEffect, useState } from "react";
import { GeoJSON, MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const COUNTRIES_GEOJSON_URL = "/globe/ne_110m_admin_0_countries.geojson";

type NeFeature = {
  type: "Feature";
  geometry: { type: string; coordinates: unknown };
  properties: { ISO_A2?: string; ADMIN?: string };
};

type FC = { type: "FeatureCollection"; features: NeFeature[] };

function filterToFc(features: NeFeature[] | undefined): FC {
  const list =
    features?.filter((f) => {
      const iso = f.properties?.ISO_A2;
      return iso && iso !== "AQ" && iso !== "-99";
    }) ?? [];
  return { type: "FeatureCollection", features: list };
}

function FitBounds({ data }: { data: FC | null }) {
  const map = useMap();
  const onReady = useCallback(() => {
    if (!data?.features.length) {
      map.setView([20, 10], 2);
      return;
    }
    const layer = L.geoJSON(data);
    const b = layer.getBounds();
    if (b.isValid()) {
      map.fitBounds(b, { padding: [28, 28], maxZoom: 4 });
    } else {
      map.setView([20, 10], 2);
    }
  }, [data, map]);

  useEffect(() => {
    onReady();
  }, [onReady]);
  return null;
}

export default function OverviewMap2D({
  data,
  loading,
  error,
}: {
  data: SubmissionsByCountryResponse | null;
  loading: boolean;
  error: string | null;
}) {
  const [geo, setGeo] = useState<FC | null>(null);

  useEffect(() => {
    let ok = true;
    fetch(COUNTRIES_GEOJSON_URL)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<{ features?: NeFeature[] }>;
      })
      .then((gj) => {
        if (ok) setGeo(filterToFc(gj.features));
      })
      .catch(() => {
        if (ok) setGeo({ type: "FeatureCollection", features: [] });
      });
    return () => {
      ok = false;
    };
  }, []);

  const dataKey = `${data?.total ?? 0}-${data?.max ?? 0}`;

  return (
    <div className="relative overflow-hidden rounded-xl border border-hair bg-gradient-to-b from-paper to-[#eef3f6]">
      <div className="border-b border-hair/80 bg-paper/90 px-4 py-3 sm:px-6 sm:py-4">
        <h2 className="text-[12px] font-medium uppercase tracking-[0.12em] text-ink-400">
          Anfragen nach Land
        </h2>
        <p className="mt-0.5 max-w-3xl text-[13px] text-ink-600">
          2D-Karte: je mehr Anfragen, desto blauer (Nicht-Spam, Ländercode in
          Metadaten). Grenzen: Natural Earth 110m. Kacheln: OpenStreetMap.
        </p>
        {data && !error && (
          <p className="mt-1.5 text-[12.5px] text-ink-500">
            Gesamt: <strong className="text-ink-800">{data.total}</strong> in{" "}
            <strong className="text-ink-800">{data.countryCount}</strong>{" "}
            Ländern
            {data.max > 0 && (
              <span>
                {" "}
                · stärkstes Land:{" "}
                <strong className="text-ink-800">{data.max}</strong>
              </span>
            )}
          </p>
        )}
        {error && (
          <p className="mt-1 text-[12.5px] text-accent-amber">{error}</p>
        )}
        {loading && !data && !error && (
          <p className="mt-1 text-[12.5px] text-ink-500">Karte wird geladen…</p>
        )}
      </div>

      <div
        className="relative w-full"
        style={{ minHeight: "min(72vh, 720px)" }}
      >
        {geo && geo.features.length > 0 ? (
          <div className="h-[min(72vh,720px)] w-full min-h-[480px] md:min-h-[560px] [&_.leaflet-container]:z-0">
            <MapContainer
              center={[24, 10]}
              zoom={2}
              minZoom={1}
              maxZoom={10}
              className="h-full w-full rounded-b-xl"
              scrollWheelZoom
              worldCopyJump
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>-Mitwirkende'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <GeoJSON
                key={dataKey}
                data={geo}
                style={(f) => {
                  if (!f) return { fillOpacity: 0, weight: 0, opacity: 0 };
                  const p = f.properties as NeFeature["properties"];
                  return leafletChoroplethPathOptions(data, p?.ISO_A2);
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
        ) : (
          <div
            className="grid h-[min(72vh,720px)] min-h-[480px] place-items-center text-[13px] text-ink-500"
            role="status"
          >
            Geodaten werden geladen…
          </div>
        )}

        <div className="pointer-events-none absolute right-4 top-4 z-[500] max-w-[220px] rounded-md border border-hair/60 bg-paper/90 px-2.5 py-2 text-[11px] text-ink-500 shadow-sm backdrop-blur-sm">
          <p className="font-medium text-ink-600">Farbskala</p>
          <p className="mt-0.5 leading-snug">
            Hell = wenig/kein Volumen · Dunkelblau = hoher Anteil (relativ zu
            „stärkstem Land“)
          </p>
        </div>
      </div>
    </div>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
