import L from "leaflet";
import type { LeafletMouseEvent } from "leaflet";
import { Fragment, useEffect, useMemo, useState } from "react";
import {
  CircleMarker,
  MapContainer,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { BILDBEMPFANG_OCEAN_BG } from "../../lib/bildempfangMapTheme";
import type { IpMapMarker } from "../../lib/bildempfangMapMarkers";
import { iataToLatLng } from "../../lib/iataEdgeCodes";
import { msToRgbaGloss } from "../../lib/bildempfangMsColor";
import { iso2Name } from "../../lib/iso2Countries";
import {
  parseVehicleFromImagePath,
  summarizeUserAgent,
} from "../../lib/bildempfangVehicleFromPath";

const TILE = {
  url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
};

/**
 * Cloudflare-Brand-Orange für die Edge-PoPs auf der Karte. Wir benutzen
 * zwei Töne: einen helleren Fill und einen kräftigen Strokefür den
 * Kontrast auf dunklem Tile-Layer.
 */
const EDGE_FILL = "rgba(243, 130, 31, 0.55)";
const EDGE_STROKE = "rgba(255, 162, 67, 0.95)";
const EDGE_GLOW = "rgba(243, 130, 31, 0.18)";

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
};

/**
 * Vollbild-Leaflet-Karte für den Bildempfang. Die UI ist bewusst
 * minimal: kein eigener Header, keine Sidebar — alle Detail-Infos
 * werden direkt am Marker per Popup angezeigt.
 *
 * Dargestellt werden:
 *  - IP-Marker (Größe ∝ Volumen, Farbe ∝ Latenz double2)
 *  - Cloudflare-Edge-PoPs (`blob9`) als orange Kreise inkl. IATA-Label
 *  - Verbindungslinien IP ↔ Edge (Farbe ∝ Latenz)
 *  - Klick auf einen IP-Marker: Popup mit allen verfügbaren Feldern
 *    (Status `blob8`, UA `blob5`, Pfad `blob1`/`index2`,
 *    Fahrzeug aus URL, Antwortzeit `double2`, Edge `blob9`).
 */
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
      out.push({ key: m.key, positions: [b, el], ms: m.avgMs });
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
      className="h-full min-h-0 w-full min-w-0 flex-1 overflow-hidden [&_.leaflet-control-attribution]:border-0 [&_.leaflet-control-attribution]:bg-transparent [&_.leaflet-control-attribution]:text-[9px] [&_.leaflet-control-attribution]:text-white/35 [&_.leaflet-control-attribution]:shadow-none [&_.leaflet-popup-content-wrapper]:rounded-lg [&_.leaflet-popup-content-wrapper]:bg-night-900/95 [&_.leaflet-popup-content-wrapper]:text-white [&_.leaflet-popup-content-wrapper]:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.6)] [&_.leaflet-popup-tip]:!bg-night-900/95 [&_.leaflet-popup-content]:m-0 [&_.leaflet-popup-content]:min-w-[260px]"
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
        <FitBounds points={points} edgePoints={edgePoints} />

        {/* Verbindungslinien Edge ↔ IP (Farbe ∝ Latenz) */}
        {edgeLines.map((line) => {
          const { line: c, glow } = msToRgbaGloss(line.ms, msRange);
          return (
            <Fragment key={line.key}>
              <Polyline
                positions={line.positions}
                pathOptions={{
                  interactive: false,
                  color: glow,
                  weight: 10,
                  lineCap: "round",
                  lineJoin: "round",
                  opacity: 1,
                }}
              />
              <Polyline
                positions={line.positions}
                pathOptions={{
                  interactive: false,
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

        {/* Cloudflare-Edge-PoPs (orange) mit Tooltip-Label */}
        {edgeSites.map((s) => (
          <Fragment key={`edge-${s.code}`}>
            <CircleMarker
              center={s.pos}
              radius={11}
              pathOptions={{
                interactive: false,
                fillColor: EDGE_GLOW,
                color: "transparent",
                weight: 0,
                fillOpacity: 1,
              }}
            />
            <CircleMarker
              center={s.pos}
              radius={6}
              pathOptions={{
                fillColor: EDGE_FILL,
                color: EDGE_STROKE,
                weight: 1.4,
                fillOpacity: 0.95,
              }}
            >
              <Tooltip
                direction="top"
                offset={[0, -6]}
                opacity={1}
                permanent={false}
                className="!rounded-md !border-0 !bg-night-900/95 !px-2 !py-1 !text-[11px] !text-white"
              >
                <div className="text-[11px] font-mono">
                  <div className="font-semibold">
                    Cloudflare PoP · {s.code}
                  </div>
                  <div className="text-night-300">
                    {s.ipCount} IPs · {s.requests} Requests
                  </div>
                </div>
              </Tooltip>
            </CircleMarker>
          </Fragment>
        ))}

        {/* IP-Marker mit Click-Popup */}
        {ipMarkers.map((m) => {
          const [lat, lng] = toLatLng(m);
          const col = m.signalColor;
          const hitR = Math.max(16, m.auraRadius);
          const stop = (e: LeafletMouseEvent) => {
            L.DomEvent.stopPropagation(e);
          };
          return (
            <Fragment key={m.key}>
              <CircleMarker
                center={[lat, lng]}
                radius={m.auraRadius}
                pathOptions={{
                  interactive: false,
                  fillColor: col,
                  color: "transparent",
                  weight: 0,
                  fillOpacity: 0.2,
                }}
              />
              <CircleMarker
                center={[lat, lng]}
                radius={hitR}
                className="bildempfang-ip-hit"
                eventHandlers={{ click: stop }}
                pathOptions={{
                  fillColor: col,
                  color: "transparent",
                  weight: 0,
                  fillOpacity: 0.08,
                }}
              >
                <Popup
                  closeButton
                  autoPan
                  maxWidth={360}
                  className="bildempfang-popup"
                >
                  <IpDetailsPopup marker={m} />
                </Popup>
              </CircleMarker>
              <CircleMarker
                center={[lat, lng]}
                radius={5}
                className="bildempfang-ip-hit"
                eventHandlers={{ click: stop }}
                pathOptions={{
                  fillColor: col,
                  color: "rgba(255,255,255,0.8)",
                  weight: 1.1,
                  fillOpacity: 0.95,
                }}
              >
                <Popup
                  closeButton
                  autoPan
                  maxWidth={360}
                  className="bildempfang-popup"
                >
                  <IpDetailsPopup marker={m} />
                </Popup>
              </CircleMarker>
            </Fragment>
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
      ? "bg-accent-mint/25 text-accent-mint"
      : status === "expired"
        ? "bg-accent-rose/25 text-accent-rose"
        : status === "none"
          ? "bg-white/10 text-night-300"
          : "bg-white/10 text-night-300";
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
          className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider ${statusBadgeColor}`}
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
        <dd className="font-mono">{marker.edgeCode || "—"}</dd>

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
