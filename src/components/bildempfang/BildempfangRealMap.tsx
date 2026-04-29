import L from "leaflet";
import { Fragment, useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "./BildempfangMap.css";
import { BILDBEMPFANG_OCEAN_BG } from "../../lib/bildempfangMapTheme";
import type { IpMapMarker } from "../../lib/bildempfangMapMarkers";
import { iataToLatLng } from "../../lib/iataEdgeCodes";
import { msToRgbaGloss, msToRgbTriple } from "../../lib/bildempfangMsColor";
import { iso2Name } from "../../lib/iso2Countries";
import {
  parseVehicleFromImagePath,
  summarizeUserAgent,
} from "../../lib/bildempfangVehicleFromPath";

const TILE = {
  // Sehr dunkler, label-freier Tile-Layer — der CSS-Filter
  // (`.bm-map .leaflet-tile-pane`) drückt den Look noch weiter ins
  // Schwarz-Cyan ab.
  url: "https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png",
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
};

function toLatLng(m: IpMapMarker): [number, number] {
  return [m.coordinates[1], m.coordinates[0]];
}

/**
 * Diskretisiert eine quadratische Bézier-Kurve zwischen zwei
 * Map-Punkten. Wir setzen den Kontrollpunkt senkrecht zur Verbindung,
 * damit die Linien als sanfte Bögen erscheinen — deutlich
 * Watch-Dogs-/Palantir-mäßiger als gerade Strecken.
 */
function curvedPath(
  start: [number, number],
  end: [number, number],
  curvature = 0.22,
): [number, number][] {
  const [lat1, lng1] = start;
  const [lat2, lng2] = end;
  const dLat = lat2 - lat1;
  const dLng = lng2 - lng1;
  const dist = Math.sqrt(dLat * dLat + dLng * dLng);
  if (dist < 1e-4) return [start, end];
  const mLat = (lat1 + lat2) / 2;
  const mLng = (lng1 + lng2) / 2;
  // Senkrecht zur Verbindung — leicht „nach Norden" verschoben, damit
  // die Bögen visuell einheitlich auf dieselbe Seite ausschlagen.
  const sign = dLng >= 0 ? 1 : -1;
  const pLat = (-dLng / dist) * sign;
  const pLng = (dLat / dist) * sign;
  const offset = dist * curvature;
  const cLat = mLat + pLat * offset;
  const cLng = mLng + pLng * offset;
  const n = 28;
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    const lat = u * u * lat1 + 2 * u * t * cLat + t * t * lat2;
    const lng = u * u * lng1 + 2 * u * t * cLng + t * t * lng2;
    pts.push([lat, lng]);
  }
  return pts;
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

/**
 * Größe des IP-Cores in CSS-Pixeln, abgeleitet aus dem
 * Marker-Aura-Radius. Wir bleiben absichtlich kompakt: der
 * Pulse-Ping skaliert auf ~4×, der Glow erweitert das visuell weiter.
 */
function ipCoreSize(m: IpMapMarker): number {
  const base = m.r ?? 4;
  return Math.round(Math.min(20, Math.max(8, 6 + base)));
}

function makeIpDivIcon(m: IpMapMarker): L.DivIcon {
  const size = ipCoreSize(m);
  const rgb = msToRgbTriple(m.avgMs);
  return L.divIcon({
    className: "bm-ip-icon",
    html: `<div class="bm-ip" style="--bm-color:${rgb};--bm-size:${size}px;">
      <span class="bm-ip__ping" aria-hidden></span>
      <span class="bm-ip__ping bm-ip__ping--delayed" aria-hidden></span>
      <span class="bm-ip__core" aria-hidden></span>
    </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function makeEdgeDivIcon(code: string): L.DivIcon {
  return L.divIcon({
    className: "bm-edge-icon",
    html: `<div class="bm-edge">
      <span class="bm-edge__pulse" aria-hidden></span>
      <span class="bm-edge__pulse bm-edge__pulse--delayed" aria-hidden></span>
      <span class="bm-edge__ring-static" aria-hidden></span>
      <span class="bm-edge__reticle" aria-hidden></span>
      <span class="bm-edge__core" aria-hidden></span>
      <span class="bm-edge__label">${code.replace(/[^A-Z0-9]/gi, "")}</span>
    </div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

type Props = {
  ipMarkers: IpMapMarker[];
};

export default function BildempfangRealMap({ ipMarkers }: Props) {
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
      out.push({
        key: m.key,
        positions: curvedPath(b, el),
        ms: m.avgMs,
      });
    }
    return out;
  }, [ipMarkers]);

  const edgeSites = useMemo(() => {
    type Site = {
      code: string;
      pos: [number, number];
      requests: number;
      ipCount: number;
    };
    const map = new Map<string, Site>();
    for (const m of ipMarkers) {
      if (!m.edgeCode) continue;
      const ll = iataToLatLng(m.edgeCode);
      if (!ll) continue;
      const cur = map.get(m.edgeCode);
      if (!cur) {
        map.set(m.edgeCode, {
          code: m.edgeCode,
          pos: ll,
          requests: m.count,
          ipCount: 1,
        });
      } else {
        cur.requests += m.count;
        cur.ipCount += 1;
      }
    }
    return Array.from(map.values());
  }, [ipMarkers]);

  const edgePoints = useMemo(
    () => edgeSites.map((s) => s.pos),
    [edgeSites],
  );

  // DivIcons memoisieren, sonst rebauen wir bei jedem Render — und
  // verlieren CSS-Animations-State + Performance.
  const ipIcons = useMemo(() => {
    const map = new Map<string, L.DivIcon>();
    for (const m of ipMarkers) map.set(m.key, makeIpDivIcon(m));
    return map;
  }, [ipMarkers]);

  const edgeIcons = useMemo(() => {
    const map = new Map<string, L.DivIcon>();
    for (const s of edgeSites) map.set(s.code, makeEdgeDivIcon(s.code));
    return map;
  }, [edgeSites]);

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
      className="bm-map relative h-full min-h-0 w-full min-w-0 flex-1 overflow-hidden"
      style={{ backgroundColor: BILDBEMPFANG_OCEAN_BG }}
    >
      <MapContainer
        className="!h-full !w-full bg-transparent"
        style={{ minHeight: "100%", background: "transparent" }}
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
        <FitBounds points={points} edgePoints={edgePoints} />

        {/* Datenfluss-Linien Edge ↔ IP (animated dash) */}
        {edgeLines.map((line) => {
          const { line: c, glow } = msToRgbaGloss(line.ms, msRange);
          return (
            <Fragment key={line.key}>
              <Polyline
                positions={line.positions}
                pathOptions={{
                  interactive: false,
                  color: glow,
                  weight: 12,
                  lineCap: "round",
                  lineJoin: "round",
                  opacity: 0.7,
                }}
              />
              <Polyline
                positions={line.positions}
                className="bm-flow"
                pathOptions={{
                  interactive: false,
                  color: c,
                  weight: 1.6,
                  lineCap: "round",
                  lineJoin: "round",
                  opacity: 0.95,
                }}
              />
            </Fragment>
          );
        })}

        {/* Cloudflare-Edge-PoPs (orange) als animierte Reticle-Marker */}
        {edgeSites.map((s) => {
          const icon = edgeIcons.get(s.code);
          if (!icon) return null;
          return (
            <Marker key={`edge-${s.code}`} position={s.pos} icon={icon}>
              <Popup className="bildempfang-popup" maxWidth={320}>
                <div className="px-3 py-2.5 text-[12px] leading-relaxed text-white">
                  <div className="font-mono text-[13px] font-semibold tracking-widest text-[rgb(255,180,90)]">
                    PoP · {s.code}
                  </div>
                  <div className="mt-0.5 text-[11px] text-night-300">
                    Cloudflare-Edge — bedient diesen Bereich
                  </div>
                  <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 border-t border-white/10 pt-2 text-[11.5px]">
                    <dt className="text-night-400">IPs</dt>
                    <dd className="font-mono tabular-nums">{s.ipCount}</dd>
                    <dt className="text-night-400">Requests</dt>
                    <dd className="font-mono tabular-nums">{s.requests}</dd>
                  </dl>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* IP-Marker mit Sonar-Pings + Click-Popup */}
        {ipMarkers.map((m) => {
          const icon = ipIcons.get(m.key);
          if (!icon) return null;
          return (
            <Marker
              key={m.key}
              position={toLatLng(m)}
              icon={icon}
              keyboard={false}
            >
              <Popup className="bildempfang-popup" maxWidth={360}>
                <IpDetailsPopup marker={m} />
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}

function IpDetailsPopup({ marker }: { marker: IpMapMarker }) {
  const vehicle = parseVehicleFromImagePath(marker.imagePath);
  const ua = summarizeUserAgent(marker.userAgent);
  const status = marker.status || "—";
  const statusBadgeColor =
    status === "valid"
      ? "bg-[rgba(34,211,238,0.18)] text-[rgb(125,225,238)] border-[rgba(34,211,238,0.45)]"
      : status === "expired"
        ? "bg-[rgba(217,70,239,0.18)] text-[rgb(228,150,245)] border-[rgba(217,70,239,0.45)]"
        : status === "none"
          ? "bg-white/[0.06] text-night-300 border-white/[0.15]"
          : "bg-white/[0.06] text-night-300 border-white/[0.15]";
  return (
    <div className="px-3 py-2.5 text-[12px] leading-relaxed text-white">
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <div
            className="truncate font-mono text-[12.5px] font-semibold"
            title={marker.ip}
          >
            {marker.ip}
          </div>
          <div className="text-[11px] text-night-300">
            {iso2Name(marker.iso2) || marker.iso2 || "—"}{" "}
            <span className="ml-0.5">({marker.iso2})</span> ·{" "}
            {marker.family.toUpperCase()} ·{" "}
            <span className="tabular-nums">{marker.count} Requests</span>
          </div>
        </div>
        <span
          className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider ${statusBadgeColor}`}
          title="blob8 · Key-Status"
        >
          {status}
        </span>
      </div>

      <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 border-t border-white/10 pt-2 text-[11.5px]">
        <dt className="text-night-400">Antwortzeit</dt>
        <dd className="font-mono tabular-nums">
          {marker.avgMs != null ? (
            <>
              {Math.round(marker.avgMs)} ms
              <span className="ml-1 text-[10.5px] text-night-500">
                Ø double2
              </span>
            </>
          ) : (
            "—"
          )}
        </dd>

        <dt className="text-night-400">Edge / PoP</dt>
        <dd className="font-mono">
          {marker.edgeCode ? (
            <span className="text-[rgb(255,180,90)]">{marker.edgeCode}</span>
          ) : (
            "—"
          )}
        </dd>

        <dt className="text-night-400">Fahrzeug</dt>
        <dd className="min-w-0">
          {vehicle ? (
            <>
              <span className="font-medium">{vehicle.brand}</span>{" "}
              <span className="text-night-300">{vehicle.model}</span>
            </>
          ) : (
            <span className="text-night-500">— aus URL nicht lesbar</span>
          )}
        </dd>

        <dt className="text-night-400">Browser</dt>
        <dd className="min-w-0 break-words">{ua}</dd>

        <dt className="self-start text-night-400">Bildpfad</dt>
        <dd className="min-w-0 break-all font-mono text-[10.5px] text-night-300">
          {marker.imagePath || "—"}
        </dd>
      </dl>
    </div>
  );
}
