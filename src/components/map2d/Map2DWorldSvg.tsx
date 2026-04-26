import {
  anfragenKarteMap2DModel,
  getMap2DGeographyStyles,
} from "../../config/anfragenKarteMap2DModel";
import type { SubmissionsByCountryResponse } from "../../lib/overviewGlobeApi";
import { countForFeature } from "../../lib/requestsChoropleth";
import type { NeFeature, NeFeatureCollection } from "../../lib/anfragenKarteGeo";
import { useEffect, useRef, useState } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Sphere,
  ZoomableGroup,
} from "react-simple-maps";

const m = anfragenKarteMap2DModel.svg;

type Props = {
  geo: NeFeatureCollection;
  data: SubmissionsByCountryResponse | null;
  /** Änderung = Neuzeichnen der Länderfarben. */
  dataKey: string;
};

export default function Map2DWorldSvg({ geo, data, dataKey }: Props) {
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

  return (
    <div
      ref={wrapRef}
      className="h-[min(72vh,720px)] w-full min-h-[480px] md:min-h-[560px] [&_svg.rsm-svg]:h-auto [&_svg.rsm-svg]:w-full"
    >
      <ComposableMap
        width={dims.w}
        height={dims.h}
        projection={m.projection}
        projectionConfig={m.projectionConfig}
        className="text-ink-400"
        role="img"
        aria-label="Anfragen nach Land, SVG-Weltkarte"
      >
        <ZoomableGroup
          center={m.zoom.center}
          zoom={m.zoom.zoom}
          minZoom={m.zoom.minZoom}
          maxZoom={m.zoom.maxZoom}
        >
          <Sphere
            id="anfragen-ocean"
            fill={m.ocean.fill}
            stroke={m.ocean.stroke}
            strokeWidth={m.ocean.strokeWidth}
          />
          <Geographies key={dataKey} geography={geo}>
            {({ geographies }) =>
              geographies.map((g) => {
                const p = g.properties as NeFeature["properties"] | undefined;
                const iso = p?.ISO_A2;
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
        </ZoomableGroup>
      </ComposableMap>
    </div>
  );
}
