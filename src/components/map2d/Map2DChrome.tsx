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
  /** Command-Center-Optik (Bildempfang). */
  tactical?: boolean;
};

/**
 * Karten-„Rahmen“: Titel, Kennzahlen, Fehler/Loading (gleiche Rolle wie der Kopfbereich im 3D-Globus).
 */
export function Map2DChrome({ data, loading, error, copy, tactical }: Props) {
  const ui = mergeChoroplethUi(defaultUi, copy);
  return (
    <div
      className={
        tactical
          ? "border-b border-cyan-900/30 bg-slate-950/85 px-4 py-3 sm:px-6 sm:py-4"
          : "border-b border-hair/80 bg-paper/90 px-4 py-3 sm:px-6 sm:py-4"
      }
    >
      <h2
        className={
          tactical
            ? "text-[12px] font-medium uppercase tracking-[0.12em] text-cyan-500/80"
            : "text-[12px] font-medium uppercase tracking-[0.12em] text-ink-400"
        }
      >
        {ui.cardTitle}
      </h2>
      <p
        className={
          tactical
            ? "mt-0.5 max-w-3xl text-[13px] text-slate-300"
            : "mt-0.5 max-w-3xl text-[13px] text-ink-600"
        }
      >
        {ui.cardDescription}
      </p>
      {data && !error && (
        <p
          className={
            tactical
              ? "mt-1.5 text-[12.5px] text-slate-400"
              : "mt-1.5 text-[12.5px] text-ink-500"
          }
        >
          Gesamt:{" "}
          <strong className={tactical ? "text-slate-100" : "text-ink-800"}>
            {data.total}
          </strong>{" "}
          in{" "}
          <strong className={tactical ? "text-slate-100" : "text-ink-800"}>
            {data.countryCount}
          </strong>{" "}
          Ländern
          {data.max > 0 && (
            <span>
              {" "}
              · stärkstes Land:{" "}
              <strong className={tactical ? "text-slate-100" : "text-ink-800"}>
                {data.max}
              </strong>
            </span>
          )}
        </p>
      )}
      {error && (
        <p
          className={
            tactical
              ? "mt-1 text-[12.5px] text-amber-400"
              : "mt-1 text-[12.5px] text-accent-amber"
          }
        >
          {error}
        </p>
      )}
      {loading && !data && !error && (
        <p
          className={
            tactical
              ? "mt-1 text-[12.5px] text-slate-500"
              : "mt-1 text-[12.5px] text-ink-500"
          }
        >
          Karte wird geladen…
        </p>
      )}
    </div>
  );
}

export function Map2DLegend({
  copy,
  tactical,
}: {
  copy?: Partial<ChoroplethMapUi>;
  tactical?: boolean;
}) {
  const ui = mergeChoroplethUi(defaultUi, copy);
  return (
    <div
      className={
        tactical
          ? "pointer-events-none absolute right-4 top-4 z-[500] max-w-[240px] rounded-md border border-cyan-800/50 bg-slate-950/90 px-2.5 py-2 text-[11px] text-slate-400 shadow-md backdrop-blur-sm"
          : "pointer-events-none absolute right-4 top-4 z-[500] max-w-[220px] rounded-md border border-hair/60 bg-paper/90 px-2.5 py-2 text-[11px] text-ink-500 shadow-sm backdrop-blur-sm"
      }
    >
      <p
        className={
          tactical
            ? "font-medium text-cyan-200/90"
            : "font-medium text-ink-600"
        }
      >
        {ui.legendTitle}
      </p>
      <p className="mt-0.5 leading-snug">{ui.legendBody}</p>
    </div>
  );
}
