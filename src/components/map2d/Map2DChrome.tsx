import type { ChoroplethMapUi } from "../../lib/choroplethMapUi";
import { ANFRAGEN_CHOROPLETH_UI, mergeChoroplethUi } from "../../lib/choroplethMapUi";
import type { SubmissionsByCountryResponse } from "../../lib/overviewGlobeApi";

const defaultUi = ANFRAGEN_CHOROPLETH_UI;

type Props = {
  data: SubmissionsByCountryResponse | null;
  loading: boolean;
  error: string | null;
  /** Optional: Texte ersetzen (Bildaustrahlung vs. Anfragen). */
  copy?: Partial<ChoroplethMapUi>;
};

/**
 * Karten-„Rahmen“: Titel, Kennzahlen, Fehler/Loading (gleiche Rolle wie der Kopfbereich im 3D-Globus).
 */
export function Map2DChrome({ data, loading, error, copy }: Props) {
  const ui = mergeChoroplethUi(defaultUi, copy);
  return (
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
          <strong className="text-ink-800">{data.countryCount}</strong> Ländern
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
        <p className="mt-1 text-[12.5px] text-ink-500">Karte wird geladen…</p>
      )}
    </div>
  );
}

export function Map2DLegend({ copy }: { copy?: Partial<ChoroplethMapUi> }) {
  const ui = mergeChoroplethUi(defaultUi, copy);
  return (
    <div className="pointer-events-none absolute right-4 top-4 z-[500] max-w-[220px] rounded-md border border-hair/60 bg-paper/90 px-2.5 py-2 text-[11px] text-ink-500 shadow-sm backdrop-blur-sm">
      <p className="font-medium text-ink-600">{ui.legendTitle}</p>
      <p className="mt-0.5 leading-snug">{ui.legendBody}</p>
    </div>
  );
}
