import type { GlobeInstance } from "globe.gl";
import {
  ANFRAGEN_CHOROPLETH_UI,
  mergeChoroplethUi,
  type ChoroplethMapUi,
} from "../lib/choroplethMapUi";
import type { SubmissionsByCountryResponse } from "../lib/overviewGlobeApi";
import {
  COUNTRIES_GEOJSON_URL,
  effectiveNeIso2,
  filterNeFeatures,
  type NeFeature,
} from "../lib/anfragenKarteGeo";
import { countryBlues, countForFeature } from "../lib/requestsChoropleth";
import type { BildaustrahlungArc } from "../lib/bildaustrahlungArcsApi";
import { iso2Latlng, iso2Name } from "../lib/iso2Countries";
import { Maximize2, Minus, Plus, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ArcDatum = {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  altitude: number;
  color: [string, string];
  weight: number;
  label: string;
};

/**
 * Einfarbiges 2:1-Textur-Bild (kein Foto, kein water-Mask-Asset).
 */
function solidGlobeTextureDataUrl(
  color: string,
  w = 1024,
  h = 512,
): string {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (ctx) {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, h);
  }
  return c.toDataURL("image/png");
}

export default function OverviewGlobe({
  data,
  loading,
  error,
  copy,
  arcs,
}: {
  data: SubmissionsByCountryResponse | null;
  loading: boolean;
  error: string | null;
  copy?: Partial<ChoroplethMapUi>;
  /**
   * Bögen vom Kundenstandort zum Viewer-Land. Wenn gesetzt, wird die
   * `arcsData`-API von globe.gl benutzt; Auto-Rotate wird gedrosselt, damit
   * Linien gut ablesbar sind.
   */
  arcs?: BildaustrahlungArc[];
}) {
  const ui = mergeChoroplethUi(ANFRAGEN_CHOROPLETH_UI, copy);
  const countLabelRef = useRef(ui.globeCountLabel);
  useEffect(() => {
    countLabelRef.current = ui.globeCountLabel;
  }, [ui.globeCountLabel]);
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const dataRef = useRef<SubmissionsByCountryResponse | null>(null);
  const globeRef = useRef<GlobeInstance | null>(null);
  const [ready, setReady] = useState(false);
  const [countryPolys, setCountryPolys] = useState<NeFeature[] | null>(null);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  /**
   * Arcs in das von globe.gl erwartete Schema bringen. Punkte mit
   * unbekannter ISO-2 (kein latlng) werden ausgesiebt.
   */
  const arcData: ArcDatum[] = useMemo(() => {
    if (!arcs || arcs.length === 0) return [];
    const out: ArcDatum[] = [];
    for (const a of arcs) {
      const from = iso2Latlng(a.fromIso2);
      const toLl = iso2Latlng(a.toIso2);
      if (!from || !toLl) continue;
      const w = Math.max(0.05, Math.min(1, a.weight));
      const tag = `${a.company || a.domain} (${a.fromIso2} → ${a.toIso2})`;
      out.push({
        startLat: from[0],
        startLng: from[1],
        endLat: toLl[0],
        endLng: toLl[1],
        altitude: 0.18 + 0.32 * w,
        color: ["rgba(214,33,82,0.85)", "rgba(45,108,223,0.85)"],
        weight: w,
        label: `${tag}: ${a.count} Requests · ${iso2Name(a.toIso2)}`,
      });
    }
    return out;
  }, [arcs]);

  useEffect(() => {
    let ok = true;
    fetch(COUNTRIES_GEOJSON_URL)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<{ features?: NeFeature[] }>;
      })
      .then((gj) => {
        if (ok) setCountryPolys(filterNeFeatures(gj.features));
      })
      .catch(() => {
        if (ok) setCountryPolys([]);
      });
    return () => {
      ok = false;
    };
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let cancelled = false;
    let g: GlobeInstance | null = null;

    (async () => {
      const { default: Globe } = await import("globe.gl");
      if (cancelled || !containerRef.current) return;
      const parent = containerRef.current;
      const w = parent.clientWidth || 900;
      const h = Math.max(parent.clientHeight, 500);

      g = new Globe(parent, {
        rendererConfig: { antialias: true, alpha: true },
        waitForGlobeReady: true,
        animateIn: true,
      });
      globeRef.current = g;

      const mapBase = solidGlobeTextureDataUrl("#b9d4ec");

      g.width(w)
        .height(h)
        .backgroundColor("rgba(0,0,0,0)")
        .globeImageUrl(mapBase)
        .lineHoverPrecision(0)
        .showGraticules(false)
        .showAtmosphere(true)
        .atmosphereColor("rgba(200, 215, 232, 0.28)")
        .atmosphereAltitude(0.18)
        .pointsData([])
        .polygonsData([])
        .polygonGeoJsonGeometry("geometry")
        .polygonAltitude(0.003)
        .polygonCapColor((d) => {
          const f = d as NeFeature;
          const iso = effectiveNeIso2(f.properties);
          const cur = dataRef.current;
          const max = cur?.max && cur.max > 0 ? cur.max : 0;
          const c = countForFeature(cur, iso);
          return countryBlues(c, max).cap;
        })
        .polygonSideColor((d) => {
          const f = d as NeFeature;
          const iso = f.properties.ISO_A2;
          const cur = dataRef.current;
          const max = cur?.max && cur.max > 0 ? cur.max : 0;
          const c = countForFeature(cur, iso);
          return countryBlues(c, max).side;
        })
        .polygonStrokeColor((d) => {
          const f = d as NeFeature;
          const iso = effectiveNeIso2(f.properties);
          const cur = dataRef.current;
          const max = cur?.max && cur.max > 0 ? cur.max : 0;
          const c = countForFeature(cur, iso);
          return countryBlues(c, max).stroke;
        })
        .polygonLabel((d) => {
          const f = d as NeFeature;
          const iso = effectiveNeIso2(f.properties);
          const name = f.properties.ADMIN
            ? String(f.properties.ADMIN)
            : (iso ?? "");
          const cur = dataRef.current;
          const c = countForFeature(cur, iso);
          if (c > 0) return `${name} — ${c} ${countLabelRef.current}`;
          return name;
        })
        .polygonsTransitionDuration(400)
        .enablePointerInteraction(true);

      g.pointOfView({ lat: 22, lng: 12, altitude: 2.35 }, 0);

      // Arcs sind initial leer – Daten kommen via Effekt unten.
      g.arcsData([])
        .arcStartLat((d: object) => (d as ArcDatum).startLat)
        .arcStartLng((d: object) => (d as ArcDatum).startLng)
        .arcEndLat((d: object) => (d as ArcDatum).endLat)
        .arcEndLng((d: object) => (d as ArcDatum).endLng)
        .arcColor((d: object) => (d as ArcDatum).color)
        .arcAltitude((d: object) => (d as ArcDatum).altitude)
        .arcStroke((d: object) => 0.25 + 0.55 * (d as ArcDatum).weight)
        .arcDashLength(0.4)
        .arcDashGap(0.1)
        .arcDashAnimateTime(2200)
        .arcLabel((d: object) => (d as ArcDatum).label)
        .arcsTransitionDuration(400);

      const ctrl = g.controls();
      ctrl.autoRotate = true;
      ctrl.autoRotateSpeed = 0.32;
      ctrl.enableDamping = true;
      ctrl.dampingFactor = 0.1;
      ctrl.rotateSpeed = 0.4;

      setReady(true);
    })();

    return () => {
      cancelled = true;
      if (g) g._destructor();
      else if (el) el.innerHTML = "";
      globeRef.current = null;
      setReady(false);
    };
  }, []);

  useEffect(() => {
    const g = globeRef.current;
    if (!g || !ready || !countryPolys) return;
    g.polygonsData([...countryPolys]);
  }, [data, countryPolys, ready]);

  useEffect(() => {
    const g = globeRef.current;
    if (!g || !ready) return;
    g.arcsData(arcData);
    const ctrl = g.controls();
    if (ctrl) {
      ctrl.autoRotateSpeed = arcData.length > 0 ? 0.16 : 0.32;
    }
  }, [arcData, ready]);

  useEffect(() => {
    if (!ready || !containerRef.current || !globeRef.current) return;
    const ro = new ResizeObserver(() => {
      const box = containerRef.current;
      const glob = globeRef.current;
      if (!box || !glob) return;
      glob.width(box.clientWidth);
      glob.height(Math.max(box.clientHeight, 400));
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [ready]);

  const zoom = useCallback((factor: number) => {
    const g = globeRef.current;
    if (!g) return;
    const cur = g.pointOfView();
    const a = (cur.altitude ?? 2.4) * factor;
    g.pointOfView(
      { lat: cur.lat, lng: cur.lng, altitude: Math.min(5, Math.max(1.1, a)) },
      300,
    );
  }, []);

  const resetPov = useCallback(() => {
    globeRef.current?.pointOfView(
      { lat: 20, lng: 10, altitude: 2.35 },
      1100,
    );
  }, []);

  const goFullscreen = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void el.requestFullscreen();
    }
  }, []);

  return (
    <div
      ref={wrapRef}
      className="relative overflow-hidden rounded-xl border border-hair bg-gradient-to-b from-paper to-[#eef3f6]"
    >
      <div className="border-b border-hair/80 bg-paper/90 px-4 py-3 sm:px-6 sm:py-4">
        <h2 className="text-[12px] font-medium uppercase tracking-[0.12em] text-ink-400">
          {ui.cardTitle}
        </h2>
        <p className="mt-0.5 max-w-3xl text-[13px] text-ink-600">
          {ui.cardDescription}
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
          <p className="mt-1 text-[12.5px] text-ink-500">Globus wird geladen…</p>
        )}
      </div>

      <div className="relative w-full" style={{ minHeight: "min(72vh, 720px)" }}>
        <div
          ref={containerRef}
          className="h-[min(72vh,720px)] w-full min-h-[480px] md:min-h-[560px]"
          aria-label="3D-Globus Anfragen"
        />
        {ready && (
          <div className="pointer-events-auto absolute bottom-4 left-4 z-20 flex items-center gap-1 rounded-lg border border-hair/80 bg-paper/95 p-1 shadow-sm backdrop-blur-sm">
            <button
              type="button"
              className="rounded-md p-2 text-ink-600 transition hover:bg-hair/60 hover:text-ink-900"
              aria-label="Hineinzoomen"
              onClick={() => zoom(0.88)}
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="rounded-md p-2 text-ink-600 transition hover:bg-hair/60 hover:text-ink-900"
              aria-label="Herauszoomen"
              onClick={() => zoom(1.12)}
            >
              <Minus className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="rounded-md p-2 text-ink-600 transition hover:bg-hair/60 hover:text-ink-900"
              aria-label="Ansicht zurücksetzen"
              onClick={resetPov}
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="rounded-md p-2 text-ink-600 transition hover:bg-hair/60 hover:text-ink-900"
              aria-label="Vollbild"
              onClick={goFullscreen}
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="pointer-events-none absolute right-4 top-4 z-10 max-w-[220px] rounded-md border border-hair/60 bg-paper/90 px-2.5 py-2 text-[11px] text-ink-500 shadow-sm backdrop-blur-sm">
          <p className="font-medium text-ink-600">{ui.legendTitle}</p>
          <p className="mt-0.5 leading-snug">{ui.legendBody}</p>
        </div>
      </div>
    </div>
  );
}
