import {
  anfragenKarteMap2DModel,
  getMap2DGeographyStyles,
} from "../../config/anfragenKarteMap2DModel";
import type { SubmissionsByCountryResponse } from "../../lib/overviewGlobeApi";
import { countForFeature } from "../../lib/requestsChoropleth";
import {
  type NeFeature,
  type NeFeatureCollection,
  effectiveNeIso2,
} from "../../lib/anfragenKarteGeo";
import type { BildaustrahlungArc } from "../../lib/bildaustrahlungArcsApi";
import { iso2Latlng, iso2Name } from "../../lib/iso2Countries";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Line,
  Marker,
  ZoomableGroup,
} from "react-simple-maps";

const m = anfragenKarteMap2DModel.svg;

type Props = {
  geo: NeFeatureCollection;
  data: SubmissionsByCountryResponse | null;
  /** Änderung = Neuzeichnen der Länderfarben. */
  dataKey: string;
  /** Bögen vom Kundenstandort zum Viewer-Land. */
  arcs?: BildaustrahlungArc[];
};

type ArcLine = {
  key: string;
  from: [number, number];
  to: [number, number];
  weight: number;
  title: string;
};

type ArcMarker = {
  key: string;
  coordinates: [number, number];
  kind: "from" | "to";
  iso2: string;
  title: string;
};

function buildArcGeometry(arcs: BildaustrahlungArc[] | undefined): {
  lines: ArcLine[];
  markers: ArcMarker[];
} {
  if (!arcs || arcs.length === 0) return { lines: [], markers: [] };
  const lines: ArcLine[] = [];
  const markers = new Map<string, ArcMarker>();
  for (const a of arcs) {
    const from = iso2Latlng(a.fromIso2);
    const toLl = iso2Latlng(a.toIso2);
    if (!from || !toLl) continue;
    lines.push({
      key: `${a.customerId}|${a.fromIso2}|${a.toIso2}`,
      from: [from[1], from[0]],
      to: [toLl[1], toLl[0]],
      weight: Math.max(0.05, Math.min(1, a.weight)),
      title: `${a.company || a.domain} — ${iso2Name(a.fromIso2)} → ${iso2Name(
        a.toIso2,
      )}: ${a.count}`,
    });
    const fromKey = `from:${a.fromIso2}`;
    if (!markers.has(fromKey)) {
      markers.set(fromKey, {
        key: fromKey,
        coordinates: [from[1], from[0]],
        kind: "from",
        iso2: a.fromIso2,
        title: `${iso2Name(a.fromIso2)} (Kundensitz)`,
      });
    }
    const toKey = `to:${a.toIso2}`;
    if (!markers.has(toKey)) {
      markers.set(toKey, {
        key: toKey,
        coordinates: [toLl[1], toLl[0]],
        kind: "to",
        iso2: a.toIso2,
        title: `${iso2Name(a.toIso2)} (Viewer)`,
      });
    }
  }
  return { lines, markers: Array.from(markers.values()) };
}

export default function Map2DWorldSvg({ geo, data, dataKey, arcs }: Props) {
  const [dims, setDims] = useState({ w: 900, h: 480 });
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) {
        setDims({
          w: Math.floor(width),
          h: Math.floor(Math.max(320, height)),
        });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const paper = m.canvasClassName ?? "bg-[#f2f4f7]";
  const projectionConfig = useMemo(
    () => ({
      scale: Math.max(120, dims.w * m.scaleFactor),
      center: m.projectionConfigStatic.center,
    }),
    [dims.w, m.scaleFactor, m.projectionConfigStatic.center],
  );

  const { lines: arcLines, markers: arcMarkers } = useMemo(
    () => buildArcGeometry(arcs),
    [arcs],
  );

  return (
    <div
      ref={wrapRef}
      className={`h-[min(72vh,720px)] w-full min-h-[480px] md:min-h-[560px] [&_svg.rsm-svg]:h-auto [&_svg.rsm-svg]:w-full ${paper}`}
    >
      <ComposableMap
        width={dims.w}
        height={dims.h}
        projection={m.projection}
        projectionConfig={projectionConfig}
        className="text-ink-400"
        role="img"
        aria-label="Anfragen nach Land, flache 2D-Länderkarte (SVG)"
      >
        <ZoomableGroup
          center={m.zoom.center}
          zoom={m.zoom.zoom}
          minZoom={m.zoom.minZoom}
          maxZoom={m.zoom.maxZoom}
          filterZoomEvent={(d3Event) => {
            if (!d3Event || typeof d3Event !== "object") return false;
            const t = (d3Event as { type?: string }).type;
            if (t === "wheel") return true;
            const e = d3Event as { ctrlKey?: boolean; button?: number };
            return !e.ctrlKey && !e.button;
          }}
        >
          <Geographies key={dataKey} geography={geo}>
            {({ geographies }) =>
              geographies.map((g) => {
                const p = g.properties as NeFeature["properties"] | undefined;
                const iso = effectiveNeIso2(p);
                const name = p?.ADMIN ? String(p.ADMIN) : (iso ?? "");
                const c = countForFeature(data, iso);
                const title =
                  c > 0
                    ? `${name} – ${c} Anfrage${c === 1 ? "" : "n"}`
                    : name;
                return (
                  <Geography
                    key={g.rsmKey}
                    geography={g}
                    title={title}
                    style={getMap2DGeographyStyles(data, iso)}
                  />
                );
              })
            }
          </Geographies>

          {arcLines.length > 0 && (
            <g
              className="pointer-events-none"
              aria-label="Bogenlinien Kunden-Standort zu Viewer-Land"
            >
              {arcLines.map((ln) => (
                <Line
                  key={ln.key}
                  from={ln.from}
                  to={ln.to}
                  stroke="hsl(214 60% 35%)"
                  strokeWidth={0.4 + 1.6 * ln.weight}
                  strokeOpacity={0.18 + 0.55 * ln.weight}
                  fill="none"
                />
              ))}
            </g>
          )}

          {arcMarkers.length > 0 && (
            <g aria-label="Marker Kunden + Viewer">
              {arcMarkers.map((mk) => (
                <Marker key={mk.key} coordinates={mk.coordinates}>
                  <title>{mk.title}</title>
                  <circle
                    r={mk.kind === "from" ? 3.6 : 2.2}
                    fill={
                      mk.kind === "from"
                        ? "rgb(214,33,82)"
                        : "rgb(45,108,223)"
                    }
                    stroke="white"
                    strokeWidth={mk.kind === "from" ? 1.1 : 0.8}
                    opacity={0.95}
                  />
                </Marker>
              ))}
            </g>
          )}
        </ZoomableGroup>
      </ComposableMap>
    </div>
  );
}
