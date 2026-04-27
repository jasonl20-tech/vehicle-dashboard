import L from "leaflet";
import { Fragment, useEffect, useMemo, useState } from "react";
import {
  CircleMarker,
  MapContainer,
  Polyline,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { BILDBEMPFANG_OCEAN_BG } from "../../lib/bildempfangMapTheme";
import type { IpMapMarker } from "../../lib/bildempfangMapMarkers";
import { iataToLatLng } from "../../lib/iataEdgeCodes";
import { msToRgbaGloss } from "../../lib/bildempfangMsColor";
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

function MapClickDeselect({ onDeselect }: { onDeselect: () => void }) {
  useMapEvents({
    click: () => onDeselect(),
  });
  return null;
}

function FitBounds({
  points,
  edgePoints,
}: {
  points: [number, number][];
  edgePoints: [number, number][];
}) {
  const map = useMap();
  const all = useMemo(
    () => [...points, ...edgePoints],
    [points, edgePoints],
  );
  useEffect(() => {
    if (all.length === 0) {
      map.setView([20, 0], 2);
      return;
    }
    if (all.length === 1) {
      map.setView(all[0]!, 5);
      return;
    }
    const b = L.latLngBounds(all);
    map.fitBounds(b, { padding: [56, 80], maxZoom: 12 });
  }, [map, all]);
  return null;
}

type Props = {
  ipMarkers: IpMapMarker[];
  selectedKey: string | null;
  onSelect: (m: IpMapMarker | null) => void;
};

export default function BildempfangRealMap({
  ipMarkers,
  selectedKey,
  onSelect,
}: Props) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const points = useMemo(
    () => ipMarkers.map((m) => toLatLng(m)),
    [ipMarkers],
  );

  const msRange = useMemo(() => {
    const mss = ipMarkers
      .map((m) => m.avgMs)
      .filter((v): v is number => v != null && v > 0);
    if (mss.length === 0) return { lo: 20, hi: 900 };
    return { lo: Math.min(...mss), hi: Math.max(...mss) };
  }, [ipMarkers]);

  const edgeLines = useMemo(() => {
    const out: {
      key: string;
      positions: [number, number][];
      ms: number | null;
    }[] = [];
    for (const m of ipMarkers) {
      if (!m.edgeCode) continue;
      const el = iataToLatLng(m.edgeCode);
      if (!el) continue;
      const b = toLatLng(m);
      out.push({ key: m.key, positions: [b, el], ms: m.avgMs });
    }
    return out;
  }, [ipMarkers]);

  const edgeSites = useMemo(() => {
    const seen = new Set<string>();
    const sites: { code: string; pos: [number, number] }[] = [];
    for (const m of ipMarkers) {
      if (!m.edgeCode) continue;
      if (seen.has(m.edgeCode)) continue;
      const ll = iataToLatLng(m.edgeCode);
      if (!ll) continue;
      seen.add(m.edgeCode);
      sites.push({ code: m.edgeCode, pos: ll });
    }
    return sites;
  }, [ipMarkers]);

  const edgePoints = useMemo(
    () => edgeSites.map((s) => s.pos),
    [edgeSites],
  );

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
        <MapClickDeselect onDeselect={() => onSelect(null)} />
        <FitBounds points={points} edgePoints={edgePoints} />
        {edgeLines.map((line) => {
          const { line: c, glow } = msToRgbaGloss(line.ms, msRange);
          return (
            <Fragment key={line.key}>
              <Polyline
                key={`${line.key}-glow`}
                positions={line.positions}
                pathOptions={{
                  color: glow,
                  weight: 10,
                  lineCap: "round",
                  lineJoin: "round",
                  opacity: 1,
                }}
              />
              <Polyline
                key={`${line.key}-line`}
                positions={line.positions}
                pathOptions={{
                  color: c,
                  weight: 1.8,
                  lineCap: "round",
                  lineJoin: "round",
                  opacity: 0.95,
                }}
              />
            </Fragment>
          );
        })}
        {ipMarkers.map((m) => {
          const [lat, lng] = toLatLng(m);
          const isSel = m.key === selectedKey;
          const col = m.signalColor;
          return (
            <Fragment key={m.key}>
              <CircleMarker
                key={`${m.key}-aura`}
                center={[lat, lng]}
                radius={m.auraRadius + (isSel ? 4 : 0)}
                pathOptions={{
                  fillColor: col,
                  color: "transparent",
                  weight: 0,
                  fillOpacity: isSel ? 0.28 : 0.2,
                }}
              />
              <CircleMarker
                key={`${m.key}-dot`}
                center={[lat, lng]}
                radius={isSel ? 6 : 4}
                eventHandlers={{
                  click: (e) => {
                    if (e.originalEvent) {
                      L.DomEvent.stopPropagation(e.originalEvent);
                    }
                    onSelect(m);
                  },
                }}
                pathOptions={{
                  fillColor: col,
                  color: isSel ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.8)",
                  weight: isSel ? 2.2 : 1.1,
                  fillOpacity: 0.95,
                }}
              />
            </Fragment>
          );
        })}
        {edgeSites.map((s) => (
          <CircleMarker
            key={`edge-${s.code}`}
            center={s.pos}
            radius={5}
            pathOptions={{
              fillColor: "rgba(250, 204, 21, 0.5)",
              color: "rgba(250, 204, 21, 0.85)",
              weight: 1.2,
              fillOpacity: 0.55,
            }}
          />
        ))}
      </MapContainer>
    </div>
  );
}
