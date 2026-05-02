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
  Bug,
  Maximize2,
  Minus,
  Plus,
  RefreshCw,
  Compass,
} from "lucide-react";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  ImageUrlIpBreakdownAttempt,
  ImageUrlIpBreakdownResponse,
} from "../../lib/bildempfangIpApi";
import { APPLE_MONO_STACK } from "../../lib/appleFontStacks";
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
  /** Roh-Response von `/image-url-requests-ip-breakdown` für das Debug-Panel. */
  apiResponse?: ImageUrlIpBreakdownResponse | null;
  apiError?: string | null;
  apiLoading?: boolean;
  apiUrl?: string;
};

export default function BildempfangScene({
  ipMarkers,
  apiResponse,
  apiError,
  apiLoading,
  apiUrl,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [viewState, setViewState] = useState<MapViewState>(INITIAL_VIEW);
  const [selected, setSelected] = useState<IpMapMarker | null>(null);
  const [tripTime, setTripTime] = useState(0);
  const [debugOpen, setDebugOpen] = useState(false);

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
      // Säulen kompakter: 120 km Basis-Höhe, bis 1.500 km — die Welt-
      // Übersicht bleibt lesbar, ohne dass alles wie ein Wall wirkt.
      const elevation = 120_000 + 1_400_000 * t;
      return {
        marker: m,
        position: [m.coordinates[0], m.coordinates[1]],
        color: [r, g, b, 230],
        haloColor: [r, g, b, 90],
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

  // ---------- Zoom-abhängige Geometrie -----------------------------------
  // Damit Säulen bei Welt-Zoom sichtbar sind und beim Reinzoomen nicht zum
  // Wand-Block werden, skalieren wir Radius und Höhe mit `2^(refZoom - z)`.
  const zoomScale = useMemo(() => {
    const z = viewState.zoom ?? INITIAL_VIEW.zoom ?? 1.5;
    const refZoom = 2.5;
    return Math.pow(2, refZoom - z);
  }, [viewState.zoom]);

  const colRadius = useMemo(
    () => Math.min(140_000, Math.max(700, 60_000 * zoomScale)),
    [zoomScale],
  );
  const colElevationScale = useMemo(
    () => Math.min(1.6, Math.max(0.05, zoomScale)),
    [zoomScale],
  );
  const haloRadius = useMemo(
    () => Math.min(220_000, Math.max(2000, 80_000 * zoomScale)),
    [zoomScale],
  );
  const edgeHaloRadius = useMemo(
    () => Math.min(280_000, Math.max(4000, 110_000 * zoomScale)),
    [zoomScale],
  );
  const edgeCoreRadius = useMemo(
    () => Math.min(60_000, Math.max(700, 22_000 * zoomScale)),
    [zoomScale],
  );

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
      getRadius: haloRadius,
      radiusMinPixels: 3,
      radiusMaxPixels: 18,
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
      getFillColor: [EDGE_PRIMARY.r, EDGE_PRIMARY.g, EDGE_PRIMARY.b, 55],
      getRadius: edgeHaloRadius,
      radiusMinPixels: 8,
      radiusMaxPixels: 30,
      stroked: true,
      getLineColor: [EDGE_PRIMARY.r, EDGE_PRIMARY.g, EDGE_PRIMARY.b, 220],
      getLineWidth: 1500,
      lineWidthMinPixels: 1,
      pickable: false,
    });

    const edgeCoreLayer = new ScatterplotLayer<EdgeSite>({
      id: "bg-edge-core",
      data: edgeSites,
      getPosition: (s) => [s.pos[1], s.pos[0]],
      getFillColor: [EDGE_PRIMARY.r, EDGE_PRIMARY.g, EDGE_PRIMARY.b, 255],
      getRadius: edgeCoreRadius,
      radiusMinPixels: 2,
      radiusMaxPixels: 6,
      stroked: false,
      pickable: false,
    });

    const columnLayer = new ColumnLayer<ColumnDatum>({
      id: "bg-ip-cols",
      data: columnData,
      diskResolution: 22,
      radius: colRadius,
      radiusUnits: "meters",
      extruded: true,
      pickable: true,
      autoHighlight: true,
      highlightColor: [255, 255, 255, 60],
      elevationScale: colElevationScale,
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
  }, [
    columnData,
    arcData,
    tripData,
    edgeSites,
    tripTime,
    colRadius,
    colElevationScale,
    haloRadius,
    edgeHaloRadius,
    edgeCoreRadius,
  ]);

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
        <button
          type="button"
          className="bg-scene__btn"
          aria-label="Debug-Logs anzeigen"
          aria-pressed={debugOpen}
          onClick={() => setDebugOpen((v) => !v)}
          style={
            debugOpen
              ? {
                  background: "rgba(34, 211, 238, 0.18)",
                  borderColor: "rgba(34, 211, 238, 0.7)",
                  color: "#e6fbff",
                }
              : undefined
          }
        >
          <Bug className="h-4 w-4" />
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

      {/* Debug-Panel — zeigt Engine-Versuche, Errors, Sample-Row, SQL-Preview. */}
      {debugOpen && (
        <DebugPanel
          response={apiResponse ?? null}
          error={apiError ?? null}
          loading={!!apiLoading}
          url={apiUrl}
          ipMarkersCount={ipMarkers.length}
          edgeSitesCount={edgeSites.length}
          zoom={viewState.zoom ?? 0}
          onClose={() => setDebugOpen(false)}
        />
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

function DebugPanel({
  response,
  error,
  loading,
  url,
  ipMarkersCount,
  edgeSitesCount,
  zoom,
  onClose,
}: {
  response: ImageUrlIpBreakdownResponse | null;
  error: string | null;
  loading: boolean;
  url?: string;
  ipMarkersCount: number;
  edgeSitesCount: number;
  zoom: number;
  onClose: () => void;
}) {
  const attempts: ImageUrlIpBreakdownAttempt[] =
    response?.debug?.attempts ?? [];
  const sample = (response?.rows ?? [])[0];

  const copyJson = () => {
    try {
      const text = JSON.stringify(
        { url, error, response },
        null,
        2,
      );
      void navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  };

  return (
    <aside
      className="bg-detail"
      role="dialog"
      aria-label="Debug-Logs"
      style={{
        right: 60,
        width: 460,
        maxWidth: "calc(100% - 80px)",
        maxHeight: "calc(100% - 28px)",
        overflow: "auto",
      }}
    >
      <div className="bg-detail__head">
        <div className="min-w-0">
          <div className="bg-detail__title">Debug · Bildempfang</div>
          <div className="bg-detail__sub">
            {loading
              ? "lädt…"
              : error
                ? `Error: ${error}`
                : "API-Antwort + Engine-Versuche"}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="bg-detail__close"
            aria-label="JSON kopieren"
            title="JSON kopieren"
            onClick={copyJson}
            style={{ width: "auto", padding: "0 8px", fontSize: 11 }}
          >
            JSON
          </button>
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

      <div style={{ padding: "10px 14px 4px" }}>
        <DebugSection title="Übersicht">
          <DebugKV
            entries={[
              ["URL", url ?? "—"],
              ["Loading", loading ? "true" : "false"],
              ["Error", error ?? "—"],
              ["IP-Marker (Frontend)", String(ipMarkersCount)],
              ["Edges (Frontend)", String(edgeSitesCount)],
              ["Zoom (View)", zoom.toFixed(2)],
            ]}
          />
        </DebugSection>

        {response?.engine && (
          <DebugSection title="Engine">
            <DebugKV
              entries={[
                ["Dataset", response.engine.name],
                ["Modes geprüft", response.engine.modesTried.join(", ")],
                ["Accounts", response.engine.accounts],
                ["IP-Spalte", response.engine.ipColumn],
                ["Range", response.range
                  ? `${response.range.from} → ${response.range.to}`
                  : "—"],
                ["Days", response.days != null ? String(response.days) : "—"],
              ]}
            />
          </DebugSection>
        )}

        {response?.totals && (
          <DebugSection title="Totals">
            <DebugKV
              entries={[
                ["IPv4 Requests", String(response.totals.v4)],
                ["IPv6 Requests", String(response.totals.v6)],
                ["non-IP Requests", String(response.totals.nonIp)],
                ["Eindeutige IP-Zeilen", String(response.totals.uniqueIpRows)],
                ["Total Requests", String(response.totals.requests)],
              ]}
            />
          </DebugSection>
        )}

        {response?.hint && (
          <DebugSection title="Hint">
            <div
              style={{
                fontSize: 11,
                color: "rgba(255, 220, 130, 0.92)",
                background: "rgba(255, 200, 90, 0.08)",
                border: "1px solid rgba(255, 200, 90, 0.25)",
                borderRadius: 4,
                padding: "6px 8px",
                lineHeight: 1.45,
              }}
            >
              {response.hint}
            </div>
          </DebugSection>
        )}

        {response?.queryWarnings && response.queryWarnings.length > 0 && (
          <DebugSection title="Query-Warnings">
            <ul
              style={{
                fontSize: 11,
                lineHeight: 1.5,
                color: "rgba(255, 200, 110, 0.95)",
                margin: 0,
                paddingLeft: 16,
              }}
            >
              {response.queryWarnings.map((w, i) => (
                <li
                  key={i}
                  style={{ wordBreak: "break-word", marginBottom: 4 }}
                >
                  {w}
                </li>
              ))}
            </ul>
          </DebugSection>
        )}

        {sample && (
          <DebugSection title="Sample-Row (erste IP, vom Backend gesehen)">
            <pre
              style={{
                margin: 0,
                fontFamily: APPLE_MONO_STACK,
                fontSize: 10.5,
                lineHeight: 1.4,
                color: "rgba(186, 232, 240, 0.85)",
                background: "rgba(0,0,0,0.35)",
                border: "1px solid rgba(34,211,238,0.18)",
                borderRadius: 4,
                padding: "6px 8px",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {JSON.stringify(sample, null, 2)}
            </pre>
          </DebugSection>
        )}

        <DebugSection
          title={`SQL-Versuche (${attempts.length})`}
          subtitle="Erste OK-Variante hat gewonnen — alle davorigen Errors sind hier dokumentiert."
        >
          {attempts.length === 0 && (
            <div
              style={{ fontSize: 11, color: "rgba(186, 232, 240, 0.5)" }}
            >
              Keine Versuche aufgezeichnet (Backend hat nichts geliefert).
            </div>
          )}
          {attempts.map((a, i) => (
            <div
              key={i}
              style={{
                marginBottom: 8,
                border: `1px solid ${a.ok ? "rgba(34,211,238,0.25)" : "rgba(217,70,239,0.4)"}`,
                background: a.ok
                  ? "rgba(34,211,238,0.05)"
                  : "rgba(217,70,239,0.06)",
                borderRadius: 4,
                padding: "6px 8px",
                fontSize: 11,
                lineHeight: 1.4,
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  alignItems: "baseline",
                }}
              >
                <span
                  style={{
                    fontFamily: APPLE_MONO_STACK,
                    fontWeight: 600,
                    color: a.ok ? "rgb(125,225,238)" : "rgb(228,150,245)",
                    letterSpacing: "0.04em",
                  }}
                >
                  {a.ok ? "OK" : "FAIL"} · {a.builder}
                </span>
                <span style={{ color: "rgba(186,232,240,0.6)" }}>
                  source={a.source} · mode={a.mode} · rows={a.rows}
                </span>
              </div>
              {a.error && (
                <div
                  style={{
                    marginTop: 4,
                    color: "rgb(245, 175, 235)",
                    wordBreak: "break-word",
                  }}
                >
                  {a.error}
                </div>
              )}
              {a.sample && (
                <div
                  style={{
                    marginTop: 4,
                    color: "rgba(186,232,240,0.85)",
                    fontFamily: APPLE_MONO_STACK,
                    fontSize: 10,
                    wordBreak: "break-word",
                  }}
                >
                  sample: {a.sample}
                </div>
              )}
              <details style={{ marginTop: 4 }}>
                <summary
                  style={{
                    cursor: "pointer",
                    color: "rgba(186,232,240,0.5)",
                    fontSize: 10.5,
                  }}
                >
                  SQL anzeigen
                </summary>
                <pre
                  style={{
                    margin: "4px 0 0",
                    fontFamily: APPLE_MONO_STACK,
                    fontSize: 10,
                    color: "rgba(186, 232, 240, 0.75)",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {a.sqlPreview}
                </pre>
              </details>
            </div>
          ))}
        </DebugSection>

        {response?.details && response.details.length > 0 && (
          <DebugSection title="Details (502)">
            <ul
              style={{
                fontSize: 11,
                lineHeight: 1.5,
                color: "rgb(245,175,235)",
                margin: 0,
                paddingLeft: 16,
              }}
            >
              {response.details.map((d, i) => (
                <li
                  key={i}
                  style={{ wordBreak: "break-word", marginBottom: 4 }}
                >
                  {d}
                </li>
              ))}
            </ul>
          </DebugSection>
        )}
      </div>
    </aside>
  );
}

function DebugSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: 12 }}>
      <div
        style={{
          fontFamily: APPLE_MONO_STACK,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "rgba(34, 211, 238, 0.85)",
          marginBottom: 4,
        }}
      >
        {title}
      </div>
      {subtitle && (
        <div
          style={{
            fontSize: 11,
            color: "rgba(186,232,240,0.55)",
            marginBottom: 6,
            lineHeight: 1.4,
          }}
        >
          {subtitle}
        </div>
      )}
      {children}
    </section>
  );
}

function DebugKV({ entries }: { entries: [string, string][] }) {
  return (
    <dl
      style={{
        display: "grid",
        gridTemplateColumns: "auto minmax(0, 1fr)",
        gap: "4px 12px",
        margin: 0,
        fontSize: 11,
      }}
    >
      {entries.map(([k, v], i) => (
        <Fragment key={i}>
          <dt style={{ color: "rgba(186,232,240,0.55)" }}>{k}</dt>
          <dd
            style={{
              margin: 0,
              color: "rgba(186,232,240,0.95)",
              fontFamily: APPLE_MONO_STACK,
              wordBreak: "break-word",
            }}
          >
            {v}
          </dd>
        </Fragment>
      ))}
    </dl>
  );
}
