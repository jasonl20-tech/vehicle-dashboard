/**
 * Die Bibliothek liefert keine eigenen Typen; minimale Deklarationen für unsere Nutzung.
 */
declare module "react-simple-maps" {
  import type * as React from "react";

  export type RsmGeography = {
    rsmKey: string;
    svgPath: string;
    properties: Record<string, unknown>;
  };

  export const ComposableMap: React.FC<
    React.PropsWithChildren<{
      width?: number;
      height?: number;
      projection?: string;
      projectionConfig?: Record<string, unknown>;
      className?: string;
      role?: string;
      "aria-label"?: string;
    }>
  >;

  export const Geographies: React.FC<{
    geography: string | object;
    className?: string;
    children: (ctx: { geographies: RsmGeography[] }) => React.ReactNode;
  }>;

  export const Geography: React.FC<{
    geography: RsmGeography;
    style?: {
      default?: React.CSSProperties;
      hover?: React.CSSProperties;
      pressed?: React.CSSProperties;
    };
    title?: string;
  }>;

  export const ZoomableGroup: React.FC<
    React.PropsWithChildren<{
      center?: [number, number];
      zoom?: number;
      minZoom?: number;
      maxZoom?: number;
      filterZoomEvent?: (event: unknown) => boolean;
    }>
  >;
}
