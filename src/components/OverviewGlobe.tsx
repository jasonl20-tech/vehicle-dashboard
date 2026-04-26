import type { GlobeInstance } from "globe.gl";
import type { SubmissionsByCountryResponse } from "../lib/overviewGlobeApi";
import { useEffect, useMemo, useRef, useState } from "react";
import countries from "world-countries";

type GlobePoint = {
  lat: number;
  lng: number;
  count: number;
  iso: string;
  color: string;
  r: number;
  alt: number;
};

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

function colorForCount(c: number, max: number): string {
  if (c <= 0 || max <= 0) return "rgba(180, 188, 210, 0.45)";
  const t = Math.min(1, c / max);
  return `rgb(${lerp(235, 79, t)}, ${lerp(238, 70, t)}, ${lerp(252, 229, t)})`;
}

function buildPoints(data: SubmissionsByCountryResponse | null): GlobePoint[] {
  if (!data?.byIso2 || data.max <= 0) return [];
  const max = data.max;
  const out: GlobePoint[] = [];
  for (const [iso, count] of Object.entries(data.byIso2)) {
    if (count <= 0) continue;
    const ll = CCA2_TO_LL.get(iso);
    if (!ll) continue;
    const t = count / max;
    out.push({
      lat: ll[0],
      lng: ll[1],
      count,
      iso,
      color: colorForCount(count, max),
      r: 0.28 + 1.65 * Math.sqrt(t),
      alt: 0.012 + 0.045 * t,
    });
  }
  return out;
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
  const globeRef = useRef<GlobeInstance | null>(null);
  const [ready, setReady] = useState(false);
  const points = useMemo(() => buildPoints(data), [data]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let cancelled = false;
    let g: GlobeInstance | null = null;

    (async () => {
      const { default: Globe } = await import("globe.gl");
      if (cancelled || !containerRef.current) return;
      const w = containerRef.current.clientWidth || 520;
      const h = 380;
      g = new Globe(containerRef.current, {
        rendererConfig: { antialias: true, alpha: true },
        waitForGlobeReady: true,
        animateIn: true,
      });
      globeRef.current = g;
      g.width(w)
        .height(h)
        .backgroundColor("rgba(0,0,0,0)")
        .showGraticules(false)
        .showAtmosphere(true)
        .atmosphereColor("rgba(109, 82, 255, 0.22)")
        .atmosphereAltitude(0.18)
        .pointsData([])
        .pointLat("lat")
        .pointLng("lng")
        .pointColor("color")
        .pointRadius((d) => (d as GlobePoint).r)
        .pointAltitude((d) => (d as GlobePoint).alt)
        .pointResolution(8)
        .pointLabel((d) => {
          const p = d as GlobePoint;
          return `${p.iso}: ${p.count}`;
        });

      const ctrl = g.controls();
      ctrl.autoRotate = true;
      ctrl.autoRotateSpeed = 0.35;
      ctrl.enableDamping = true;
      ctrl.dampingFactor = 0.12;

      setReady(true);
    })();

    return () => {
      cancelled = true;
      if (g) {
        g._destructor();
      } else if (el) {
        el.innerHTML = "";
      }
      globeRef.current = null;
      setReady(false);
    };
  }, []);

  useEffect(() => {
    const g = globeRef.current;
    if (!g || !ready) return;
    g.pointsData(points);
  }, [points, ready]);

  useEffect(() => {
    if (!ready || !containerRef.current || !globeRef.current) return;
    const ro = new ResizeObserver(() => {
      const el = containerRef.current;
      if (!el || !globeRef.current) return;
      globeRef.current.width(el.clientWidth);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [ready]);

  return (
    <div className="rounded-lg border border-hair bg-paper/80 overflow-hidden">
      <div className="border-b border-hair px-4 py-3 sm:px-5">
        <h2 className="text-[12px] font-medium uppercase tracking-[0.12em] text-ink-400">
          Anfragen nach Land
        </h2>
        <p className="mt-0.5 text-[13px] text-ink-600">
          Größe und Farbe der Marker = relative Anzahl (nur Nicht-Spam) mit
          Ländercode in den Metadaten.
        </p>
        {data && !error && (
          <p className="mt-1 text-[12.5px] text-ink-500">
            Gesamt: <strong className="text-ink-800">{data.total}</strong> in{" "}
            <strong className="text-ink-800">{data.countryCount}</strong>{" "}
            Ländern
            {data.max > 0 && (
              <span>
                {" "}
                · Maximum: <strong className="text-ink-800">{data.max}</strong>
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
        ref={containerRef}
        className="relative min-h-[380px] w-full"
        style={{ minHeight: 380 }}
        aria-label="3D-Globus Anfragen"
      />
    </div>
  );
}
