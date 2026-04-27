import { useMemo } from "react";
import OverviewMap2D from "../components/OverviewMap2D";
import PageHeader from "../components/ui/PageHeader";
import {
  BILDBEMPFANG_CHOROPLETH_UI,
} from "../lib/choroplethMapUi";
import { fmtNumber, useApi } from "../lib/customerApi";
import {
  imageUrlRequestsGeoUrl,
} from "../lib/bildaustrahlungGeoApi";
import type { ImageUrlRequestsGeoResponse } from "../lib/bildaustrahlungGeoApi";
import {
  type ImageUrlIpBreakdownResponse,
  imageUrlRequestsIpBreakdownUrl,
} from "../lib/bildempfangIpApi";
import { buildIpMapMarkers } from "../lib/bildempfangMapMarkers";
import { iso2Name } from "../lib/iso2Countries";

export default function BildempfangPage() {
  const geoUrl = useMemo(() => imageUrlRequestsGeoUrl(), []);
  const ipUrl = useMemo(() => imageUrlRequestsIpBreakdownUrl(), []);
  const geo = useApi<ImageUrlRequestsGeoResponse>(geoUrl);
  const ip = useApi<ImageUrlIpBreakdownResponse>(ipUrl);

  const ipMarkers = useMemo(
    () => buildIpMapMarkers(ip.data?.rows ?? []),
    [ip.data?.rows],
  );

  return (
    <div>
      <PageHeader
        eyebrow="Ansichten"
        title="Bildempfang"
        description="Wo Bild-URL-Anfragen herkommen: Länder-Choropleth (wie in der Bildaustrahlung) plus Aufschlüsselung der Client-IPs (IPv4/IPv6) aus der Analytics Engine. Punkt-Positionen sind Näherungen nach Land, nicht Straßenebene."
      />

      <div className="mb-3 flex flex-wrap gap-4 text-[13px] text-ink-600">
        {ip.data && (
          <ul className="flex flex-wrap gap-3">
            <li>
              <span className="text-ink-500">IPv4 (Anteile):</span>{" "}
              <strong className="text-ink-800">{fmtNumber(ip.data.totals.v4)}</strong>
            </li>
            <li>
              <span className="text-ink-500">IPv6 (Anteile):</span>{" "}
              <strong className="text-ink-800">{fmtNumber(ip.data.totals.v6)}</strong>
            </li>
            {ip.data.totals.nonIp > 0 && (
              <li>
                <span className="text-ink-500">Nicht-IP in Spalte:</span>{" "}
                <strong className="text-ink-800">{fmtNumber(ip.data.totals.nonIp)}</strong>
              </li>
            )}
            <li>
              <span className="text-ink-500">Zeile Quelle IP:</span>{" "}
              <code className="rounded border border-hair bg-ink-50 px-1.5 font-mono text-[12px]">
                {ip.data.engine.ipColumn}
              </code>
            </li>
          </ul>
        )}
        {ip.loading && <span className="text-ink-500">IP-Auswertung…</span>}
      </div>

      {ip.data?.hint && (
        <p className="mb-3 rounded-md border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-[12.5px] text-amber-950">
          {ip.data.hint}
        </p>
      )}

      {ip.error && (
        <p className="mb-3 rounded-md border border-accent-amber/40 bg-accent-amber/5 px-3 py-2 text-[12.5px] text-ink-800">
          IP-Detail-API: {ip.error} Die Länderkarte kann trotzdem sichtbar sein, falls die Geo-API liefert.
        </p>
      )}

      <OverviewMap2D
        data={geo.data}
        loading={geo.loading}
        error={geo.error}
        copy={BILDBEMPFANG_CHOROPLETH_UI}
        ipMarkers={ipMarkers}
        tacticalMap
      />

      {ip.data && (
        <div className="mt-6 min-w-0">
          <h2 className="text-[12px] font-medium uppercase tracking-[0.12em] text-ink-400">
            IP-Auswertung (Top {Math.min(80, ip.data.rows.length)} von{" "}
            {fmtNumber(ip.data.rows.length)})
          </h2>
          <div className="mt-2 overflow-x-auto rounded-lg border border-hair">
            <table className="w-full min-w-[640px] border-collapse text-left text-[12.5px]">
              <thead className="bg-ink-50/80">
                <tr>
                  <th className="px-2 py-2 font-medium text-ink-500">IP</th>
                  <th className="px-2 py-2 font-medium text-ink-500">Typ</th>
                  <th className="px-2 py-2 font-medium text-ink-500">Land</th>
                  <th className="px-2 py-2 text-right font-medium text-ink-500">
                    Anteile
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hair">
                {ip.data.rows.slice(0, 80).map((r) => (
                  <tr key={`${r.ip}|${r.iso2}`} className="hover:bg-ink-50/40">
                    <td className="px-2 py-1.5 font-mono text-[12px] text-ink-800">
                      {r.ip}
                    </td>
                    <td className="px-2 py-1.5">
                      {r.family === "v4" && (
                        <span className="inline-flex rounded bg-blue-100 px-1.5 py-0.5 text-[11px] font-medium text-blue-900">
                          IPv4
                        </span>
                      )}
                      {r.family === "v6" && (
                        <span className="inline-flex rounded bg-violet-100 px-1.5 py-0.5 text-[11px] font-medium text-violet-900">
                          IPv6
                        </span>
                      )}
                      {r.family === "unknown" && (
                        <span className="text-ink-500">—</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-ink-700">
                      {iso2Name(r.iso2)}{" "}
                      <span className="text-ink-400">({r.iso2})</span>
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-ink-800">
                      {fmtNumber(r.count)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {ip.data?.queryWarnings && ip.data.queryWarnings.length > 0 && (
        <p className="mt-2 text-[11.5px] text-ink-500">
          Hinweise Engine: {ip.data.queryWarnings.slice(0, 3).join(" · ")}
        </p>
      )}
    </div>
  );
}
