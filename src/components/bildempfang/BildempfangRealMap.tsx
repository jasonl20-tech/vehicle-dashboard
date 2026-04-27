import L from "leaflet";
import { useEffect, useMemo, useState } from "react";
import {
  CircleMarker,
  MapContainer,
  Polyline,
  TileLayer,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { BILDBEMPFANG_OCEAN_BG } from "../../lib/bildempfangMapTheme";
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
  for (const [, list] of by) {
    const hub = iso2Latlng(list[0]!.iso2);
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
};

/**
 * Vollbild-Kachel (Leaflet). Kein Zoom-+, keine Text-Overlays; OSM-Attribution
 * bleibt rechtlich im Leaflet-Standard-Widget (sehr klein).
 */
export default function BildempfangRealMap({ ipMarkers }: Props) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const points = useMemo(
    () => ipMarkers.map((m) => toLatLng(m)),
    [ipMarkers],
  );

  const spokeLines = useMemo(() => buildSpokeLines(ipMarkers), [ipMarkers]);

  if (!ready) {
    return (
      <div
        className="h-full min-h-0 w-full min-w-0 flex-1"
        style={{ backgroundColor: BILDBEMPFANG_OCEAN_BG }}
        aria-hidden
      />
    );
  }

  return (
    <div
      className="h-full min-h-0 w-full min-w-0 flex-1 overflow-hidden [&_.leaflet-control-attribution]:border-0 [&_.leaflet-control-attribution]:bg-transparent [&_.leaflet-control-attribution]:text-[9px] [&_.leaflet-control-attribution]:text-white/35 [&_.leaflet-control-attribution]:shadow-none"
      style={{ backgroundColor: BILDBEMPFANG_OCEAN_BG }}
    >
      <MapContainer
        className="!h-full !w-full"
        style={{ minHeight: "100%" }}
        center={[20, 0]}
        zoom={2}
        minZoom={2}
        maxZoom={18}
        scrollWheelZoom
        zoomControl={false}
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
              color: "rgba(248, 250, 252, 0.35)",
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
                color: "rgba(255,255,255,0.8)",
                weight: 1.2,
                fillOpacity: 0.88,
              }}
            />
          );
        })}
      </MapContainer>
    </div>
  );
}
