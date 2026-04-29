import DeckGL from "@deck.gl/react";
import { MapView, type MapViewState } from "@deck.gl/core";
import {
  ArcLayer,
  BitmapLayer,
  ColumnLayer,
  ScatterplotLayer,
} from "@deck.gl/layers";
import { TileLayer, TripsLayer } from "@deck.gl/geo-layers";
import {
  Activity,
  Maximize2,
  Minus,
  Plus,
  RefreshCw,
  Compass,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { IpMapMarker } from "../../lib/bildempfangMapMarkers";
import { iataToLatLng } from "../../lib/iataEdgeCodes";
import {
  EDGE_PRIMARY,
  msToRgbArray,
} from "../../lib/bildempfangMsColor";
import { iso2Name } from "../../lib/iso2Countries";
import {
  parseVehicleFromImagePath,
  summarizeUserAgent,
} from "../../lib/bildempfangVehicleFromPath";
import "./BildempfangScene.css";

/**
 * Bildempfang — 3D-„Big-Screen"-Szene direkt mit deck.gl (ohne
 * MapLibre dazwischen, weil deck.gl seine eigene `MapView` mitbringt
 * und die Tile-Logik via `TileLayer` selbst übernimmt — ein Stack weniger
 * der schiefgehen kann).
 *
 * Layer-Reihenfolge (von unten nach oben):
 *   1) `TileLayer`       — CARTO-Dark-Raster-Tiles als Basemap.
 *   2) `ScatterplotLayer`— Halo unter jedem IP (gleiche Latenz-Farbe,
 *                          niedrige Alpha).
 *   3) `ArcLayer`        — gebogene Edge → IP Verbindung (statisch, dezent).
 *   4) `TripsLayer`      — animierter Daten-Puls (Cloudflare-Orange).
 *   5) `ScatterplotLayer`— Cloudflare-Edge-PoP-Halo + Core (orange).
 *   6) `ColumnLayer`     — IPs als 3D-Säulen (Höhe = log(Requests),
 *                          Farbe = Cyan→Violet→Magenta-Latenz).
 *
 * Die Welt-Übersicht (Zoom ~1.5, Pitch 45°) zeigt sofort alle Säulen
 * dank `radiusMinPixels` an Halo + Edge-Glows. Per Drag rotiert man, mit
 * Strg/Pinch ändert man Pitch, Scroll zoomt rein bis auf Stadtebene.
 */

const TILE_URLS = [
  "https://a.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png",
  "https://b.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png",
  "https://c.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png",
];

const INITIAL_VIEW: MapViewState = {
  longitude: 14,
  latitude: 30,
  zoom: 1.55,
  pitch: 45,
  bearing: -8,
  maxPitch: 75,
  minZoom: 0.5,
  maxZoom: 18,
};

type EdgeSite = {
  code: string;
  pos: [number, number]; // [lat, lng]
  requests: number;
  ipCount: number;
};

type ColumnDatum = {
  marker: IpMapMarker;
  position: [number, number];
  color: [number, number, number, number];
  haloColor: [number, number, number, number];
  elevation: number;
};

type ArcDatum = {
  src: [number, number];
  tgt: [number, number];
  colorSrc: [number, number, number, number];
  colorTgt: [number, number, number, number];
  ms: number | null;
};

type TripDatum = {
  path: [number, number, number][];
  timestamps: number[];
  color: [number, number, number];
};

const TRIP_LOOP_MS = 4500;
const TRIP_SEGMENTS = 24;

function buildBezierPath(
  src: [number, number],
  tgt: [number, number],
  arcHeight: number,
): [number, number, number][] {
  const [lng1, lat1] = src;
  const [lng2, lat2] = tgt;
  const dLng = lng2 - lng1;
  const dLat = lat2 - lat1;
  const dist = Math.sqrt(dLng * dLng + dLat * dLat);
  const cLng = (lng1 + lng2) / 2;
  const cLat = (lat1 + lat2) / 2;
  const cAlt = Math.max(40_000, dist * 22_000 + arcHeight);
  const points: [number, number, number][] = [];
  for (let i = 0; i <= TRIP_SEGMENTS; i++) {
    const t = i / TRIP_SEGMENTS;
    const u = 1 - t;
    const lng = u * u * lng1 + 2 * u * t * cLng + t * t * lng2;
    const lat = u * u * lat1 + 2 * u * t * cLat + t * t * lat2;
    const alt = u * u * 0 + 2 * u * t * cAlt + t * t * 0;
    points.push([lng, lat, alt]);
  }
  return points;
}

function buildTimestamps(): number[] {
  const out: number[] = [];
  for (let i = 0; i <= TRIP_SEGMENTS; i++) {
    out.push((i / TRIP_SEGMENTS) * TRIP_LOOP_MS);
  }
  return out;
}

type Props = {
  ipMarkers: IpMapMarker[];
};

export default function BildempfangScene({ ipMarkers }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [viewState, setViewState] = useState<MapViewState>(INITIAL_VIEW);
  const [selected, setSelected] = useState<IpMapMarker | null>(null);
  const [tripTime, setTripTime] = useState(0);

  // Animations-Loop für TripsLayer.currentTime — flüssiger Daten-Puls.
  useEffect(() => {
    let raf = 0;
    let active = true;
    const loop = (t: number) => {
      if (!active) return;
      setTripTime(t % TRIP_LOOP_MS);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      active = false;
      cancelAnimationFrame(raf);
    };
  }, []);

  // ---------- Datenaufbereitung -----------------------------------------
  const msRange = useMemo(() => {
    const mss = ipMarkers
      .map((m) => m.avgMs)
      .filter((v): v is number => v != null && v > 0);
    if (mss.length === 0) return { lo: 20, hi: 900 };
    return { lo: Math.min(...mss), hi: Math.max(...mss) };
  }, [ipMarkers]);

  const maxCount = useMemo(
    () => Math.max(1, ...ipMarkers.map((m) => m.count)),
    [ipMarkers],
  );

  const columnData: ColumnDatum[] = useMemo(() => {
    const logMax = Math.log(1 + maxCount);
    return ipMarkers.map((m) => {
      const [r, g, b] = msToRgbArray(m.avgMs, msRange);
      const t = Math.log(1 + m.count) / Math.max(0.0001, logMax);
      const elevation = 220_000 + 2_300_000 * t;
      return {
        marker: m,
        position: [m.coordinates[0], m.coordinates[1]],
        color: [r, g, b, 235],
        haloColor: [r, g, b, 110],
        elevation,
      };
    });
  }, [ipMarkers, msRange, maxCount]);

  const edgeSites: EdgeSite[] = useMemo(() => {
    const map = new Map<string, EdgeSite>();
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

  const arcData: ArcDatum[] = useMemo(() => {
    const out: ArcDatum[] = [];
    for (const m of ipMarkers) {
      if (!m.edgeCode) continue;
      const e = iataToLatLng(m.edgeCode);
      if (!e) continue;
      const [r, g, b] = msToRgbArray(m.avgMs, msRange);
      out.push({
        src: [e[1], e[0]], // [lng, lat]
        tgt: [m.coordinates[0], m.coordinates[1]],
        colorSrc: [EDGE_PRIMARY.r, EDGE_PRIMARY.g, EDGE_PRIMARY.b, 220],
        colorTgt: [r, g, b, 220],
        ms: m.avgMs,
      });
    }
    return out;
  }, [ipMarkers, msRange]);

  const tripData: TripDatum[] = useMemo(() => {
    const ts = buildTimestamps();
    const out: TripDatum[] = [];
    for (const m of ipMarkers) {
      if (!m.edgeCode) continue;
      const e = iataToLatLng(m.edgeCode);
      if (!e) continue;
      const path = buildBezierPath(
        [e[1], e[0]],
        [m.coordinates[0], m.coordinates[1]],
        60_000,
      );
      out.push({
        path,
        timestamps: ts,
        color: [EDGE_PRIMARY.r, EDGE_PRIMARY.g, EDGE_PRIMARY.b],
      });
    }
    return out;
  }, [ipMarkers]);

  // ---------- Layer-Bau --------------------------------------------------
  const layers = useMemo(() => {
    // CARTO-Dark-Raster-Tiles als Basemap.
    const tileLayer = new TileLayer({
      id: "bg-tiles",
      data: TILE_URLS,
      minZoom: 0,
      maxZoom: 19,
      tileSize: 256,
      maxRequests: 6,
      renderSubLayers: (props) => {
        // `bbox` enthält die geografischen Grenzen jedes geladenen
        // Tiles — daraus baut `BitmapLayer` das eigentliche Bild.
        const tile = props.tile as {
          bbox: { west: number; south: number; east: number; north: number };
        };
        const { west, south, east, north } = tile.bbox;
        return new BitmapLayer({
          id: `${props.id}-bitmap`,
          image: props.data as unknown as string,
          bounds: [west, south, east, north],
          opacity: 0.78,
          tintColor: [185, 215, 240],
          desaturate: 0.35,
        });
      },
    });

    const haloLayer = new ScatterplotLayer<ColumnDatum>({
      id: "bg-ip-halo",
      data: columnData,
      getPosition: (d) => d.position,
      getFillColor: (d) => d.haloColor,
      getRadius: 90000,
      radiusMinPixels: 6,
      radiusMaxPixels: 36,
      stroked: false,
      filled: true,
      pickable: false,
    });

    const arcLayer = new ArcLayer<ArcDatum>({
      id: "bg-arcs",
      data: arcData,
      getSourcePosition: (d) => d.src,
      getTargetPosition: (d) => d.tgt,
      getSourceColor: (d) => d.colorSrc,
      getTargetColor: (d) => d.colorTgt,
      getWidth: 1.2,
      getHeight: 0.55,
      greatCircle: false,
      pickable: false,
      opacity: 0.55,
    });

    const tripsLayer = new TripsLayer<TripDatum>({
      id: "bg-trips",
      data: tripData,
      getPath: (d) => d.path,
      getTimestamps: (d) => d.timestamps,
      getColor: (d) => d.color,
      opacity: 0.95,
      widthMinPixels: 2,
      widthMaxPixels: 4,
      jointRounded: true,
      capRounded: true,
      fadeTrail: true,
      trailLength: 1100,
      currentTime: tripTime,
    });

    const edgeHaloLayer = new ScatterplotLayer<EdgeSite>({
      id: "bg-edge-halo",
      data: edgeSites,
      getPosition: (s) => [s.pos[1], s.pos[0]],
      getFillColor: [EDGE_PRIMARY.r, EDGE_PRIMARY.g, EDGE_PRIMARY.b, 70],
      getRadius: 130000,
      radiusMinPixels: 16,
      radiusMaxPixels: 48,
      stroked: true,
      getLineColor: [EDGE_PRIMARY.r, EDGE_PRIMARY.g, EDGE_PRIMARY.b, 230],
      getLineWidth: 2200,
      lineWidthMinPixels: 1.2,
      pickable: false,
    });

    const edgeCoreLayer = new ScatterplotLayer<EdgeSite>({
      id: "bg-edge-core",
      data: edgeSites,
      getPosition: (s) => [s.pos[1], s.pos[0]],
      getFillColor: [EDGE_PRIMARY.r, EDGE_PRIMARY.g, EDGE_PRIMARY.b, 255],
      getRadius: 30000,
      radiusMinPixels: 4,
      radiusMaxPixels: 8,
      stroked: false,
      pickable: false,
    });

    const columnLayer = new ColumnLayer<ColumnDatum>({
      id: "bg-ip-cols",
      data: columnData,
      diskResolution: 22,
      radius: 55000,
      radiusUnits: "meters",
      extruded: true,
      pickable: true,
      autoHighlight: true,
      highlightColor: [255, 255, 255, 60],
      elevationScale: 1,
      getPosition: (d) => d.position,
      getFillColor: (d) => d.color,
      getElevation: (d) => d.elevation,
      material: {
        ambient: 0.6,
        diffuse: 0.7,
        shininess: 60,
        specularColor: [255, 255, 255],
      },
      onClick: (info) => {
        const obj = info.object as ColumnDatum | undefined;
        if (obj) setSelected(obj.marker);
      },
    });

    return [
      tileLayer,
      haloLayer,
      arcLayer,
      tripsLayer,
      edgeHaloLayer,
      edgeCoreLayer,
      columnLayer,
    ];
  }, [columnData, arcData, tripData, edgeSites, tripTime]);

  // ---------- Toolbar-Aktionen ------------------------------------------
  const zoomBy = useCallback((delta: number) => {
    setViewState((v) => ({
      ...v,
      zoom: Math.min(18, Math.max(0.5, (v.zoom ?? 1.5) + delta)),
      transitionDuration: 280,
    }));
  }, []);

  const resetView = useCallback(() => {
    setViewState({ ...INITIAL_VIEW, transitionDuration: 900 } as MapViewState);
  }, []);

  const toNorth = useCallback(() => {
    setViewState((v) => ({ ...v, bearing: 0, transitionDuration: 600 }));
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void el.requestFullscreen();
    }
  }, []);

  // ---------- Render -----------------------------------------------------
  return (
    <div ref={wrapRef} className="bg-scene">
      <DeckGL
        viewState={viewState}
        onViewStateChange={(e) => setViewState(e.viewState as MapViewState)}
        controller={{ dragRotate: true, touchRotate: true }}
        views={new MapView({ id: "map", repeat: true })}
        layers={layers}
        style={{ position: "absolute", inset: "0" }}
        getCursor={({ isDragging, isHovering }) =>
          isDragging ? "grabbing" : isHovering ? "pointer" : "default"
        }
      />
      <div className="bg-scene__overlay" aria-hidden />

      {/* HUD */}
      <div className="bg-scene__hud">
        <div className="bg-scene__hud-row">
          <span className="bg-scene__hud-dot" aria-hidden />
          <span>Bildempfang · Live</span>
        </div>
        <div className="bg-scene__hud-row">
          <span className="bg-scene__hud-key">IPs</span>
          <span className="bg-scene__hud-val">{ipMarkers.length}</span>
          <span className="bg-scene__hud-key">· Edges</span>
          <span className="bg-scene__hud-val">{edgeSites.length}</span>
          <span className="bg-scene__hud-key">· Reqs</span>
          <span className="bg-scene__hud-val">
            {ipMarkers.reduce((a, b) => a + b.count, 0)}
          </span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-scene__toolbar">
        <button
          type="button"
          className="bg-scene__btn"
          aria-label="Zoom hinein"
          onClick={() => zoomBy(0.8)}
        >
          <Plus className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="bg-scene__btn"
          aria-label="Zoom hinaus"
          onClick={() => zoomBy(-0.8)}
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="bg-scene__btn"
          aria-label="Norden ausrichten"
          onClick={toNorth}
        >
          <Compass className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="bg-scene__btn"
          aria-label="Ansicht zurücksetzen"
          onClick={resetView}
        >
          <RefreshCw className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="bg-scene__btn"
          aria-label="Vollbild"
          onClick={toggleFullscreen}
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>

      {/* Legende */}
      <div className="bg-scene__legend">
        <span style={{ color: "rgba(186,232,240,0.55)" }}>Latenz</span>
        <span className="bg-scene__legend-bar" />
        <span style={{ color: "rgba(186,232,240,0.55)" }}>schnell → langsam</span>

        <span style={{ color: "rgba(186,232,240,0.55)" }}>Edge-PoP</span>
        <span className="bg-scene__legend-edge" />
        <span style={{ color: "rgba(186,232,240,0.55)" }}>Cloudflare</span>
      </div>

      {/* Detail-Panel rechts */}
      {selected && (
        <DetailPanel marker={selected} onClose={() => setSelected(null)} />
      )}

      {/* Empty-Hinweis, wenn keine Marker */}
      {ipMarkers.length === 0 && (
        <div
          className="bg-scene__hud-row absolute"
          style={{
            left: "50%",
            top: "48%",
            transform: "translate(-50%, -50%)",
            zIndex: 11,
          }}
        >
          <Activity className="h-3.5 w-3.5" aria-hidden />
          <span>Warte auf Live-Daten…</span>
        </div>
      )}
    </div>
  );
}

function DetailPanel({
  marker,
  onClose,
}: {
  marker: IpMapMarker;
  onClose: () => void;
}) {
  const vehicle = parseVehicleFromImagePath(marker.imagePath);
  const ua = summarizeUserAgent(marker.userAgent);
  const status = marker.status || "—";
  const badgeClass =
    status === "valid"
      ? "bg-detail__badge bg-detail__badge--valid"
      : status === "expired"
        ? "bg-detail__badge bg-detail__badge--expired"
        : "bg-detail__badge bg-detail__badge--neutral";
  return (
    <aside className="bg-detail" role="dialog" aria-label="IP Details">
      <div className="bg-detail__head">
        <div className="min-w-0">
          <div className="bg-detail__title" title={marker.ip}>
            {marker.ip}
          </div>
          <div className="bg-detail__sub">
            {iso2Name(marker.iso2) || marker.iso2 || "—"}{" "}
            <span>({marker.iso2})</span> · {marker.family.toUpperCase()} ·{" "}
            <span className="tabular-nums">{marker.count} Requests</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={badgeClass} title="blob8 · Key-Status">
            {status}
          </span>
          <button
            type="button"
            className="bg-detail__close"
            aria-label="Schließen"
            onClick={onClose}
          >
            ×
          </button>
        </div>
      </div>
      <dl className="bg-detail__grid">
        <dt>Antwortzeit</dt>
        <dd className="bg-detail__mono tabular-nums">
          {marker.avgMs != null ? `${Math.round(marker.avgMs)} ms` : "—"}
        </dd>

        <dt>Edge / PoP</dt>
        <dd className="bg-detail__mono">
          {marker.edgeCode ? (
            <span className="bg-detail__edge-code">{marker.edgeCode}</span>
          ) : (
            "—"
          )}
        </dd>

        <dt>Fahrzeug</dt>
        <dd>
          {vehicle ? (
            <>
              <span style={{ fontWeight: 600 }}>{vehicle.brand}</span>{" "}
              <span style={{ color: "rgba(186,232,240,0.7)" }}>
                {vehicle.model}
              </span>
            </>
          ) : (
            <span style={{ color: "rgba(186,232,240,0.5)" }}>
              — aus URL nicht lesbar
            </span>
          )}
        </dd>

        <dt>Browser</dt>
        <dd>{ua}</dd>

        <dt>Bildpfad</dt>
        <dd className="bg-detail__mono" style={{ fontSize: "10.5px" }}>
          {marker.imagePath || "—"}
        </dd>
      </dl>
    </aside>
  );
}
