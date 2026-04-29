import { ArrowLeft, Search } from "lucide-react";
import { useMemo, useState, type ChangeEvent } from "react";
import type { IpMapMarker } from "../../lib/bildempfangMapMarkers";
import { iso2Name } from "../../lib/iso2Countries";
import { fmtNumber } from "../../lib/customerApi";
import {
  parseVehicleFromImagePath,
  summarizeUserAgent,
} from "../../lib/bildempfangVehicleFromPath";

type Props = {
  markers: IpMapMarker[];
  selected: IpMapMarker | null;
  onSelect: (m: IpMapMarker | null) => void;
  loading: boolean;
};

/**
 * Permanente rechte Sidebar für die Bildempfang-Karte: zeigt eine
 * suchbare Tabelle der Top-IPs, oder bei Auswahl die volle
 * Analytic-Auswertung des einzelnen Markers.
 *
 * Wir rendern bewusst keinen `position: absolute`/Overlay mehr, damit
 * globale Overlays (Cmd+K-Palette) zuverlässig darüber liegen.
 */
export default function BildempfangSidebar({
  markers,
  selected,
  onSelect,
  loading,
}: Props) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return markers;
    return markers.filter((m) => {
      if (m.ip.toLowerCase().includes(t)) return true;
      if (m.iso2.toLowerCase().includes(t)) return true;
      const c = iso2Name(m.iso2)?.toLowerCase() ?? "";
      if (c.includes(t)) return true;
      const v = parseVehicleFromImagePath(m.imagePath);
      if (v) {
        if (v.brand.toLowerCase().includes(t)) return true;
        if (v.model.toLowerCase().includes(t)) return true;
      }
      return false;
    });
  }, [markers, q]);

  return (
    <aside className="flex w-full max-w-[420px] shrink-0 flex-col border-l border-hair bg-paper md:w-[420px]">
      {selected ? (
        <SelectedDetail marker={selected} onBack={() => onSelect(null)} />
      ) : (
        <>
          <div className="flex shrink-0 flex-col gap-2 border-b border-hair px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[12.5px] font-semibold text-ink-900">
                IPs &amp; Requests
              </h2>
              <span className="text-[11px] tabular-nums text-ink-500">
                {fmtNumber(filtered.length)} / {fmtNumber(markers.length)}
              </span>
            </div>
            <label className="relative flex items-center">
              <Search
                className="pointer-events-none absolute left-2 h-3.5 w-3.5 text-ink-400"
                aria-hidden
              />
              <input
                type="search"
                value={q}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setQ(e.target.value)
                }
                placeholder="IP, Land oder Fahrzeug filtern …"
                className="w-full rounded-md border border-hair bg-white px-2 py-1.5 pl-7 text-[12.5px] text-ink-900 outline-none placeholder:text-ink-400 focus:border-ink-900/40"
                aria-label="IP-Liste filtern"
              />
            </label>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading && markers.length === 0 ? (
              <p className="px-4 py-3 text-[12.5px] text-ink-500">
                Lade Analytics …
              </p>
            ) : filtered.length === 0 ? (
              <p className="px-4 py-3 text-[12.5px] text-ink-500">
                Keine Treffer.
              </p>
            ) : (
              <ul className="divide-y divide-hair">
                {filtered.slice(0, 200).map((m) => {
                  const v = parseVehicleFromImagePath(m.imagePath);
                  return (
                    <li key={m.key}>
                      <button
                        type="button"
                        onClick={() => onSelect(m)}
                        className="flex w-full items-start gap-2 px-4 py-2.5 text-left transition hover:bg-ink-50"
                      >
                        <span
                          className="mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{
                            backgroundColor: m.signalColor,
                            boxShadow: "0 0 6px rgba(0,0,0,0.15)",
                          }}
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex min-w-0 items-baseline justify-between gap-2">
                            <span
                              className="truncate font-mono text-[12px] text-ink-900"
                              title={m.ip}
                            >
                              {m.ip}
                            </span>
                            <span className="shrink-0 rounded-sm bg-ink-50 px-1 py-px text-[10.5px] uppercase tracking-wider text-ink-600">
                              {m.iso2}
                            </span>
                          </span>
                          <span className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-[11.5px] text-ink-500">
                            <span>{iso2Name(m.iso2) || m.iso2}</span>
                            {m.avgMs != null && (
                              <span className="tabular-nums">
                                {Math.round(m.avgMs)} ms
                              </span>
                            )}
                            {v && (
                              <span className="truncate text-ink-700">
                                {v.brand} · {v.model}
                              </span>
                            )}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {filtered.length > 200 && (
              <p className="border-t border-hair px-4 py-2 text-[11px] text-ink-500">
                + {fmtNumber(filtered.length - 200)} weitere — Suche eingrenzen
                für gezielte Auswahl.
              </p>
            )}
          </div>
        </>
      )}
    </aside>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-hair/70 px-4 py-2.5">
      <dt className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink-500">
        {label}
      </dt>
      <dd className="mt-1 text-[13px] text-ink-900">{children}</dd>
    </div>
  );
}

function SelectedDetail({
  marker,
  onBack,
}: {
  marker: IpMapMarker;
  onBack: () => void;
}) {
  const vehicle = parseVehicleFromImagePath(marker.imagePath);
  const uaShort = summarizeUserAgent(marker.userAgent);
  return (
    <>
      <div className="flex shrink-0 items-center gap-2 border-b border-hair px-4 py-2.5">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] text-ink-700 transition hover:bg-ink-50 hover:text-ink-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Zurück zur Liste
        </button>
        <span
          className="ml-auto inline-block h-3 w-3 rounded-full"
          style={{
            backgroundColor: marker.signalColor,
            boxShadow: "0 0 8px rgba(0,0,0,0.18)",
          }}
          aria-hidden
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <Row label="IP">
          <span className="font-mono">{marker.ip}</span>
        </Row>
        <Row label="Land">
          {iso2Name(marker.iso2) || marker.iso2 || "—"}{" "}
          <span className="ml-1 text-[11px] tabular-nums text-ink-500">
            ({marker.iso2})
          </span>
        </Row>
        <Row label="Mittlere Antwortzeit">
          {marker.avgMs != null ? (
            <>
              <span className="font-mono tabular-nums">
                {Math.round(marker.avgMs)} ms
              </span>
              <span className="ml-2 text-[11px] text-ink-500">
                grün = gut · rot = langsam
              </span>
            </>
          ) : (
            "—"
          )}
        </Row>
        <Row label="Edge / Stream (PoP)">
          <span className="font-mono">{marker.edgeCode || "—"}</span>
        </Row>
        <Row label="Fahrzeug (aus URL)">
          {vehicle ? (
            <>
              <span className="font-medium">{vehicle.brand}</span>{" "}
              <span className="text-ink-700">{vehicle.model}</span>
            </>
          ) : (
            <span className="text-ink-500">Kein Fahrzeug aus Pfad lesbar</span>
          )}
        </Row>
        <Row label="Gerät / Browser">
          <span>{uaShort}</span>
          {marker.userAgent && marker.userAgent.length > 80 && (
            <pre className="mt-2 max-h-32 overflow-y-auto whitespace-pre-wrap rounded-md border border-hair bg-paper p-2 text-[11px] leading-snug text-ink-600">
              {marker.userAgent}
            </pre>
          )}
        </Row>
        <Row label="Bildpfad">
          {marker.imagePath ? (
            <span className="break-all font-mono text-[11.5px] text-ink-700">
              {marker.imagePath}
            </span>
          ) : (
            <span className="text-ink-500">—</span>
          )}
        </Row>
      </div>
    </>
  );
}
