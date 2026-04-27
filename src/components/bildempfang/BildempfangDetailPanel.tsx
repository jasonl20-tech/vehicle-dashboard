import { X } from "lucide-react";
import type { IpMapMarker } from "../../lib/bildempfangMapMarkers";
import {
  parseVehicleFromImagePath,
  summarizeUserAgent,
} from "../../lib/bildempfangVehicleFromPath";
import { BILDBEMPFANG_OCEAN_BG } from "../../lib/bildempfangMapTheme";

type Props = {
  marker: IpMapMarker | null;
  onClose: () => void;
};

export default function BildempfangDetailPanel({ marker, onClose }: Props) {
  if (!marker) return null;

  const vehicle = parseVehicleFromImagePath(marker.imagePath);
  const uaShort = summarizeUserAgent(marker.userAgent);

  return (
    <aside
      className="pointer-events-auto absolute inset-y-0 right-0 z-[1000] flex w-full max-w-[400px] flex-col border-l border-white/[0.08] shadow-2xl"
      style={{
        backgroundColor: "rgba(18,18,18,0.94)",
        backdropFilter: "blur(10px)",
      }}
    >
      <div
        className="flex h-12 shrink-0 items-center justify-between border-b border-white/[0.07] px-4"
        style={{ backgroundColor: BILDBEMPFANG_OCEAN_BG }}
      >
        <h2 className="truncate text-sm font-semibold text-white">IP-Details</h2>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-night-300 transition hover:bg-white/[0.08] hover:text-white"
          aria-label="Schließen"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 text-[13px] text-night-200">
        <dl className="space-y-4">
          <div>
            <dt className="text-[10px] font-medium uppercase tracking-wider text-night-500">
              IP
            </dt>
            <dd className="mt-0.5 font-mono text-[14px] text-white">{marker.ip}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-medium uppercase tracking-wider text-night-500">
              Land
            </dt>
            <dd className="mt-0.5">{marker.iso2}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-medium uppercase tracking-wider text-night-500">
              Mittlere Antwortzeit
            </dt>
            <dd className="mt-0.5">
              {marker.avgMs != null ? (
                <>
                  <span className="font-mono tabular-nums text-white">
                    {Math.round(marker.avgMs)} ms
                  </span>
                  <span className="ml-2 text-night-500">
                    (grün = gut, rot = langsam)
                  </span>
                </>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-medium uppercase tracking-wider text-night-500">
              Edge / Stream
            </dt>
            <dd className="mt-0.5 font-mono text-white">
              {marker.edgeCode || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-medium uppercase tracking-wider text-night-500">
              Fahrzeug (aus URL)
            </dt>
            <dd className="mt-0.5">
              {vehicle ? (
                <>
                  <span className="text-white">{vehicle.brand}</span>{" "}
                  <span className="text-night-300">{vehicle.model}</span>
                </>
              ) : (
                <span className="text-night-500">Kein Fahrzeug aus Pfad lesbar</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-medium uppercase tracking-wider text-night-500">
              Gerät / Browser
            </dt>
            <dd className="mt-0.5 break-words">
              <span className="text-night-300">{uaShort}</span>
              {marker.userAgent && marker.userAgent.length > 80 ? (
                <pre className="mt-2 max-h-32 overflow-y-auto whitespace-pre-wrap rounded-md border border-white/[0.06] bg-black/30 p-2 text-[11px] leading-snug text-night-400">
                  {marker.userAgent}
                </pre>
              ) : null}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-medium uppercase tracking-wider text-night-500">
              Bildpfad
            </dt>
            <dd className="mt-0.5 break-all font-mono text-[11px] text-night-400">
              {marker.imagePath || "—"}
            </dd>
          </div>
        </dl>
      </div>
    </aside>
  );
}
