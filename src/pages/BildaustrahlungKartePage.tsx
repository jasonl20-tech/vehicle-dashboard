import { Bug, Globe, Map, Search, X } from "lucide-react";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
} from "react";
import OverviewMap2D from "../components/OverviewMap2D";
import PageHeader from "../components/ui/PageHeader";
import { BILDAUSTRAHLUNG_CHOROPLETH_UI } from "../lib/choroplethMapUi";
import { useApi, fmtNumber } from "../lib/customerApi";
import {
  type ImageUrlRequestsGeoResponse,
  imageUrlRequestsGeoUrl,
} from "../lib/bildaustrahlungGeoApi";

const OverviewGlobe = lazy(() => import("../components/OverviewGlobe"));

export default function BildaustrahlungKartePage() {
  const [apiDiagnose, setApiDiagnose] = useState(false);
  const geoUrl = useMemo(
    () => imageUrlRequestsGeoUrl({ diagnose: apiDiagnose }),
    [apiDiagnose],
  );
  const geo = useApi<ImageUrlRequestsGeoResponse>(geoUrl);
  const [view, setView] = useState<"2d" | "3d">("2d");
  const [q, setQ] = useState("");
  const [debugOpen, setDebugOpen] = useState(false);

  const data = geo.data;

  const domainMax = useMemo(() => {
    const dom = geo.data?.domains ?? [];
    if (dom.length === 0) return 1;
    return Math.max(1, ...dom.map((x) => x.count));
  }, [geo.data?.domains]);

  const filteredDomains = useMemo(() => {
    const dom = geo.data?.domains ?? [];
    const t = q.trim().toLowerCase();
    if (!t) return dom;
    return dom.filter((d) => d.domain.toLowerCase().includes(t));
  }, [geo.data?.domains, q]);

  const debugJson = useMemo(
    () =>
      JSON.stringify(
        {
          requestUrl: geoUrl,
          loading: geo.loading,
          error: geo.error,
          data: geo.data,
        },
        null,
        2,
      ),
    [geoUrl, geo.loading, geo.error, geo.data],
  );

  const copyDebug = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(debugJson);
    } catch {
      /* ignore */
    }
  }, [debugJson]);

  useEffect(() => {
    if (!debugOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDebugOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [debugOpen]);

  const viewToggle = (
    <div className="inline-flex rounded-lg border border-hair bg-paper p-0.5 shadow-sm">
      <button
        type="button"
        onClick={() => setView("2d")}
        className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] font-medium transition ${
          view === "2d"
            ? "bg-ink-900 text-white"
            : "text-ink-600 hover:bg-hair/80 hover:text-ink-900"
        }`}
        aria-pressed={view === "2d"}
      >
        <Map className="h-3.5 w-3.5 shrink-0" />
        2D
      </button>
      <button
        type="button"
        onClick={() => setView("3d")}
        className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] font-medium transition ${
          view === "3d"
            ? "bg-ink-900 text-white"
            : "text-ink-600 hover:bg-hair/80 hover:text-ink-900"
        }`}
        aria-pressed={view === "3d"}
      >
        <Globe className="h-3.5 w-3.5 shrink-0" />
        3D
      </button>
    </div>
  );

  const headerRight = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <button
        type="button"
        onClick={() => setDebugOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-hair bg-paper px-3 py-1.5 text-[12.5px] font-medium text-ink-700 shadow-sm transition hover:bg-hair/60 hover:text-ink-900"
        aria-expanded={debugOpen}
        title="Roh-Response der Geo-API anzeigen"
      >
        <Bug className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Debug
      </button>
      {viewToggle}
    </div>
  );

  return (
    <>
      <PageHeader
        eyebrow="Ansichten"
        title="Bildaustrahlung"
        description="Bild-URL-Requests (Analytics `image_url_requests`): Länder in `blob3`, Kunden-Domains in `index1`. 2D- oder 3D-Karte + Domain-Agenda (Standard 90 Tage, Zeitraum per `from`/`to` in der API anpassbar)."
        rightSlot={headerRight}
      />

      {geo.data?.queryWarnings && geo.data.queryWarnings.length > 0 && (
        <p className="mb-2 text-[12.5px] text-accent-amber" role="status">
          Hinweis: {geo.data.queryWarnings[0].slice(0, 200)}
        </p>
      )}

      <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-stretch">
        <aside className="w-full shrink-0 lg:order-2 lg:max-w-sm lg:pl-1">
          <div className="border-b border-hair/80 pb-2">
            <h2 className="text-[12px] font-medium uppercase tracking-[0.1em] text-ink-400">
              Kunden-Domains (index1)
            </h2>
            <p className="mt-0.5 text-[11.5px] text-ink-500">
              Alle Domains im Zeitraum, nach Volumen sortiert. Balken: Anteil
              am Maximum in der Liste.
            </p>
            <div className="mt-2 flex items-center gap-2 rounded-md border border-hair/90 bg-paper px-2 py-1.5">
              <Search className="h-3.5 w-3.5 shrink-0 text-ink-400" aria-hidden />
              <input
                type="search"
                value={q}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setQ(e.target.value)
                }
                placeholder="Filter …"
                className="min-w-0 flex-1 bg-transparent text-[12.5px] text-ink-800 outline-none placeholder:text-ink-400"
                aria-label="Domains filtern"
              />
            </div>
          </div>
          <ul
            className="mt-2 max-h-[min(50vh,420px)] space-y-2 overflow-y-auto pr-0.5 text-[12.5px] lg:max-h-[min(85vh,720px)]"
            aria-label="Domain-Liste"
          >
            {geo.error && (
              <li className="text-accent-amber">{geo.error}</li>
            )}
            {geo.loading && !geo.data && !geo.error && (
              <li className="text-ink-500">Laden …</li>
            )}
            {geo.data && filteredDomains.length === 0 && (
              <li className="text-ink-500">Keine Treffer</li>
            )}
            {filteredDomains.map((row) => (
              <li key={row.domain} className="min-w-0">
                <div className="flex min-w-0 items-baseline justify-between gap-2">
                  <span
                    className="truncate font-mono text-[12px] text-ink-800"
                    title={row.domain}
                  >
                    {row.domain}
                  </span>
                  <span className="shrink-0 tabular-nums text-ink-500">
                    {fmtNumber(row.count)}
                  </span>
                </div>
                <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-sm bg-ink-100/90">
                  <div
                    className="h-full rounded-sm bg-[hsl(214_45%_48%)]"
                    style={{ width: `${(row.count / domainMax) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </aside>

        <div className="min-w-0 flex-1 lg:order-1">
          {view === "2d" ? (
            <OverviewMap2D
              data={data}
              loading={geo.loading}
              error={geo.error}
              copy={BILDAUSTRAHLUNG_CHOROPLETH_UI}
            />
          ) : (
            <Suspense
              fallback={
                <div className="grid min-h-[400px] place-items-center rounded-xl border border-hair border-dashed bg-paper/60 text-[13px] text-ink-500">
                  3D-Ansicht wird geladen…
                </div>
              }
            >
              <OverviewGlobe
                data={data}
                loading={geo.loading}
                error={geo.error}
                copy={BILDAUSTRAHLUNG_CHOROPLETH_UI}
              />
            </Suspense>
          )}
        </div>
      </div>

      {debugOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center p-4 sm:items-center sm:p-6"
          role="presentation"
        >
          <button
            type="button"
            className="absolute inset-0 bg-ink-900/50 backdrop-blur-[2px]"
            aria-label="Schließen"
            onClick={() => setDebugOpen(false)}
          />
          <div
            className="relative z-[81] flex max-h-[min(90vh,720px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-hair bg-paper shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="bildaustrahlung-debug-title"
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-hair px-4 py-3">
              <h2
                id="bildaustrahlung-debug-title"
                className="text-[14px] font-semibold text-ink-900"
              >
                API-Response (Debug)
              </h2>
              <div className="flex items-center gap-2">
                <label className="inline-flex max-w-[min(100%,11rem)] items-center gap-1.5 text-[12px] text-ink-600">
                  <input
                    type="checkbox"
                    checked={apiDiagnose}
                    onChange={(e) => setApiDiagnose(e.target.checked)}
                    className="rounded border-hair"
                  />
                  Volumen-Diagnose
                </label>
                <button
                  type="button"
                  onClick={copyDebug}
                  className="rounded-md border border-hair bg-paper px-2.5 py-1.5 text-[12px] font-medium text-ink-700 transition hover:bg-hair/70"
                >
                  Kopieren
                </button>
                <button
                  type="button"
                  onClick={() => setDebugOpen(false)}
                  className="rounded-md p-1.5 text-ink-500 transition hover:bg-hair/80 hover:text-ink-900"
                  aria-label="Schließen"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <p className="shrink-0 border-b border-hair/80 px-4 py-2 text-[11.5px] text-ink-500">
              In <code className="text-ink-700">data.stats</code>: pro Quelle
              Zeilen nach GROUP BY; &quot;Volumen-Diagnose&quot; lädt{" "}
              <code className="text-ink-700">volumeInRange</code> (SUM im Zeitraum
              fürs Dataset). 0 + leere Karte = kein passendes{" "}
              <code className="text-ink-700">dataset</code> / falscher Modus;{" "}
              <code className="text-ink-700">sampleRejectedBlob3</code> ={" "}
              <code className="text-ink-700">blob3</code> ist nicht ISO-2.
            </p>
            <pre className="m-0 max-h-[min(75vh,600px)] overflow-auto p-4 text-left text-[11.5px] leading-relaxed text-ink-800 [tab-size:2]">
              <code className="font-mono text-[11.5px]">{debugJson}</code>
            </pre>
          </div>
        </div>
      )}
    </>
  );
}
