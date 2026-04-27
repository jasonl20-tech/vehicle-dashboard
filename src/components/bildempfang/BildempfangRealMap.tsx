import L from "leaflet";
import { useEffect, useMemo, useState } from "react";
import {
  CircleMarker,
  MapContainer,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { IpMapMarker } from "../../lib/bildempfangMapMarkers";
import { iso2Latlng } from "../../lib/iso2Countries";

const TILE = {
  url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
};

function toLatLng(m: IpMapMarker): [number, number] {
  return [m.coordinates[1], m.coordinates[0]];
}

function MapResizeWatcher() {
  const map = useMap();
  useEffect(() => {
    const c = map.getContainer();
    const p = c.parentElement;
    if (!p) return;
    const ro = new ResizeObserver(() => {
      map.invalidateSize();
    });
    ro.observe(p);
    return () => ro.disconnect();
  }, [map]);
  return null;
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) {
      map.setView([20, 0], 2);
      return;
    }
    if (points.length === 1) {
      map.setView(points[0]!, 5);
      return;
    }
    const b = L.latLngBounds(points);
    map.fitBounds(b, { padding: [56, 56], maxZoom: 12 });
  }, [map, points]);
  return null;
}

function buildSpokeLines(
  markers: IpMapMarker[],
): [number, number][][] {
  const by = new Map<string, IpMapMarker[]>();
  for (const m of markers) {
    const a = by.get(m.iso2) ?? [];
    a.push(m);
    by.set(m.iso2, a);
  }
  const out: [number, number][][] = [];
  for (const [iso, list] of by) {
    const hub = iso2Latlng(iso);
    if (!hub) continue;
    const hubPos: [number, number] = [hub[0], hub[1]];
    for (const mk of list) {
      const p = toLatLng(mk);
      out.push([hubPos, p]);
    }
  }
  return out;
}

type Props = {
  ipMarkers: IpMapMarker[];
  /** Geo-API lädt (optional Anzeige) */
  geoLoading: boolean;
};

/**
 * Echte Kachel-Karte (Leaflet + OSM/CARTO Dark): Zoom, Pan, die gleichen
 * IP-Marker-Positionen wie in der SVG-Variante.
 */
export default function BildempfangRealMap({ ipMarkers, geoLoading }: Props) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const points = useMemo(
    () => ipMarkers.map((m) => toLatLng(m)),
    [ipMarkers],
  );

  const spokeLines = useMemo(() => buildSpokeLines(ipMarkers), [ipMarkers]);

  if (!ready) {
    return (
      <div className="flex h-[min(78vh,720px)] min-h-[480px] items-center justify-center rounded-xl border border-cyan-900/35 bg-slate-950 text-[13px] text-slate-500">
        Karten-Engine wird geladen…
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-cyan-900/40 bg-black shadow-lg ring-1 ring-white/5">
      {geoLoading && (
        <div className="pointer-events-none absolute left-3 top-3 z-[1000] rounded-md border border-white/10 bg-black/50 px-2 py-1 text-[11px] text-slate-300 backdrop-blur">
          Länder-Statistik …
        </div>
      )}
      <div className="h-[min(78vh,720px)] min-h-[480px] w-full [&_.leaflet-control-attribution]:bg-black/50 [&_.leaflet-control-attribution]:text-[10px] [&_.leaflet-control-attribution]:text-slate-500">
        <MapContainer
          className="h-full w-full min-h-[480px] rounded-xl"
          style={{ minHeight: 480 }}
          center={[20, 0]}
          zoom={2}
          minZoom={2}
          maxZoom={18}
          scrollWheelZoom
          worldCopyJump
        >
          <TileLayer url={TILE.url} attribution={TILE.attribution} />
          <MapResizeWatcher />
          <FitBounds points={points} />
          {spokeLines.map((pos) => (
            <Polyline
              key={`spoke-${pos[0]![0]}-${pos[0]![1]}-${pos[1]![0]}-${pos[1]![1]}`}
              positions={pos}
              pathOptions={{
                color: "rgba(248, 250, 252, 0.45)",
                weight: 1,
                lineCap: "round",
              }}
            />
          ))}
          {ipMarkers.map((m) => {
            const [lat, lng] = toLatLng(m);
            const pxR = Math.max(5, Math.min(22, m.r * 1.4));
            const fill = m.family === "v4" ? "#2d6cdf" : "#7c3aed";
            return (
              <CircleMarker
                key={m.key}
                center={[lat, lng]}
                radius={pxR}
                pathOptions={{
                  fillColor: fill,
                  color: "rgba(255,255,255,0.85)",
                  weight: 1.2,
                  fillOpacity: 0.85,
                }}
              >
                <Popup>
                  <div className="min-w-[180px] text-[12px] text-slate-800">
                    <p className="font-mono text-[11px] font-semibold">{m.title}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      Näherung: Land + Streuung (kein GeoIP pro Adresse in AE).
                    </p>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
}
