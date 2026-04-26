import type { GlobeInstance } from "globe.gl";
import type { SubmissionsByCountryResponse } from "../lib/overviewGlobeApi";
import { Maximize2, Minus, Plus, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import countries from "world-countries";

/** ruhiger Ozean-Hintergrund (kein Satellitenbild) — three-globe Beispiel-Assets */
const EARTH_OCEAN =
  "https://cdn.jsdelivr.net/npm/three-globe@2.45.2/example/img/earth-water.png";

const COUNTRIES_GEOJSON_URL = "/globe/ne_110m_admin_0_countries.geojson";

type NeFeature = {
  type: "Feature";
  geometry: { type: string; coordinates: unknown };
  properties: { ISO_A2?: string; ADMIN?: string };
};

function filterNeFeatures(
  features: NeFeature[] | undefined,
): NeFeature[] {
  if (!features) return [];
  return features.filter((f) => {
    const iso = f.properties?.ISO_A2;
    return iso && iso !== "AQ" && iso !== "-99";
  });
}

type HexInput = { lat: number; lng: number; weight: number; iso: string };

const CCA2_TO_LL = (() => {
  const m = new Map<string, [number, number]>();
  for (const c of countries) {
    if (c.cca2 && c.latlng?.length === 2) {
      m.set(c.cca2, [c.latlng[0], c.latlng[1]]);
    }
  }
  return m;
})();

function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

/** Mint / eisblau (wenig) → tiefes Indigo (viel) – angelehnt an Live-View-ästhetik */
function colorForWeight(sumWeight: number, maxW: number, sideDim = 1): string {
  if (maxW <= 0 || sumWeight <= 0)
    return `rgba(200, 210, 225, ${0.35 * sideDim})`;
  const t = Math.min(1, sumWeight / maxW);
  return `rgb(${lerp(232, 55, t)}, ${lerp(245, 48, t)}, ${lerp(248, 150, t)})`;
}

/**
 * Länder zu vielen gewichteten Punkten mit leichtem Jitter, damit H3-Hexes
 * sichtbar extrudiert werden (ein Punkt = oft zu wenig Masse pro Zelle).
 */
function buildHexBinPoints(
  data: SubmissionsByCountryResponse | null,
): HexInput[] {
  if (!data?.byIso2 || !data.max) return [];
  const out: HexInput[] = [];
  for (const [iso, count] of Object.entries(data.byIso2)) {
    if (count <= 0) continue;
    const ll = CCA2_TO_LL.get(iso);
    if (!ll) continue;
    const [baseLat, baseLng] = ll;
    const n = Math.min(90, Math.max(5, Math.round(Math.cbrt(count) * 5.5)));
    const w = count / n;
    for (let i = 0; i < n; i++) {
      const a = (i * 2.618) % (Math.PI * 2);
      const ring = 0.2 + (i % 6) * 0.11;
      const jLat = Math.sin(a) * ring * 0.42;
      const jLng = Math.cos(a) * ring * 0.45;
      out.push({ lat: baseLat + jLat, lng: baseLng + jLng, weight: w, iso });
    }
  }
  return out;
}

function hexLabelFromBin(hex: {
  points: object[];
  sumWeight: number;
}): string {
  const p = hex.points[0] as HexInput | undefined;
  const iso = p?.iso ?? "…";
  return `${iso} · ≈ ${Math.round(hex.sumWeight)} Anfr.`;
}

export default function OverviewGlobe({
  data,
  loading,
  error,
}: {
  data: SubmissionsByCountryResponse | null;
  loading: boolean;
  error: string | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const maxWRef = useRef(1);
  const globeRef = useRef<GlobeInstance | null>(null);
  const [ready, setReady] = useState(false);
  const [countryPolys, setCountryPolys] = useState<NeFeature[] | null>(null);
  const hexPoints = useMemo(() => buildHexBinPoints(data), [data]);

  useEffect(() => {
    maxWRef.current = data?.max && data.max > 0 ? data.max : 1;
  }, [data?.max]);

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

      g.width(w)
        .height(h)
        .backgroundColor("rgba(0,0,0,0)")
        .globeImageUrl(EARTH_OCEAN)
        .lineHoverPrecision(0)
        .showGraticules(false)
        .showAtmosphere(true)
        .atmosphereColor("rgba(200, 215, 232, 0.28)")
        .atmosphereAltitude(0.18)
        .pointsData([])
        .polygonsData([])
        .polygonGeoJsonGeometry("geometry")
        .polygonAltitude(0.003)
        .polygonCapColor(() => "rgba(240, 244, 248, 0.96)")
        .polygonSideColor(() => "rgba(210, 220, 232, 0.85)")
        .polygonStrokeColor(() => "rgba(80, 95, 115, 0.92)")
        .polygonLabel((d) => {
          const p = (d as NeFeature).properties;
          return p?.ADMIN ? String(p.ADMIN) : "";
        })
        .polygonsTransitionDuration(300);

      g.hexBinPointsData([])
        .hexBinPointLat("lat")
        .hexBinPointLng("lng")
        .hexBinPointWeight("weight")
        .hexBinResolution(3)
        .hexMargin(0.18)
        .hexBinMerge(true)
        .hexAltitude(({ sumWeight }) => {
          const m = maxWRef.current;
          const t = m > 0 ? sumWeight / m : 0;
          return 0.02 + 0.18 * Math.sqrt(Math.min(1, t));
        })
        .hexTopColor(({ sumWeight }) =>
          colorForWeight(sumWeight, maxWRef.current, 1),
        )
        .hexSideColor(({ sumWeight }) =>
          colorForWeight(sumWeight, maxWRef.current, 0.72),
        )
        .hexLabel(hexLabelFromBin)
        .hexTopCurvatureResolution(4)
        .hexTransitionDuration(900)
        .enablePointerInteraction(true);

      g.pointOfView({ lat: 22, lng: 12, altitude: 2.35 }, 0);

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
    if (!g || !ready) return;
    g.hexBinPointsData(hexPoints);
  }, [hexPoints, ready]);

  useEffect(() => {
    const g = globeRef.current;
    if (!g || !ready || !countryPolys) return;
    g.polygonsData(countryPolys);
  }, [countryPolys, ready]);

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
          Anfragen nach Land
        </h2>
        <p className="mt-0.5 max-w-3xl text-[13px] text-ink-600">
          Kartografische Kugel mit Ländergrenzen; die Säulen (Hex) zeigen
          relative Anfragen (Nicht-Spam, Ländercode in Metadaten). Grenzen:
          Natural Earth 110m.
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

        <div className="pointer-events-none absolute right-4 top-4 z-10 max-w-[200px] rounded-md border border-hair/60 bg-paper/90 px-2.5 py-2 text-[11px] text-ink-500 shadow-sm backdrop-blur-sm">
          <p className="font-medium text-ink-600">Höhe &amp; Farbe</p>
          <p className="mt-0.5 leading-snug">≈ Anfragenvolumen im Hex-Feld</p>
        </div>
      </div>
    </div>
  );
}
