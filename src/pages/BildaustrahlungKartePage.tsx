import {
  Bug,
  Check,
  Copy,
  Globe,
  Map as MapIcon,
  Search,
  Waypoints,
  X,
} from "lucide-react";
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
import {
  type BildaustrahlungArcsResponse,
  arcsFromCustomers,
  imageUrlRequestsCustomerArcsUrl,
} from "../lib/bildaustrahlungArcsApi";
import { iso2Name } from "../lib/iso2Countries";

const OverviewGlobe = lazy(() => import("../components/OverviewGlobe"));

type SidebarTab = "domains" | "streams";

/**
 * Bildaustrahlung-Karte: Choroplethen-Karte (2D/3D) + Sidebar mit
 * Domains/Streams. Das Layout wurde aufgeräumt:
 *  - Klarer Header mit Toolbar rechts
 *  - Karte links nimmt den Hauptbereich ein
 *  - Rechts feste Sidebar (Tabs „Domains" / „Streams")
 *  - Debug-Modal als sauberes Dialog-Pattern (Backdrop, Header, Footer)
 */
export default function BildaustrahlungKartePage() {
  const [apiDiagnose, setApiDiagnose] = useState(false);
  const [showArcs, setShowArcs] = useState(true);
  const geoUrl = useMemo(
    () => imageUrlRequestsGeoUrl({ diagnose: apiDiagnose }),
    [apiDiagnose],
  );
  const arcsUrl = useMemo(() => imageUrlRequestsCustomerArcsUrl(), []);
  const geo = useApi<ImageUrlRequestsGeoResponse>(geoUrl);
  const arcsApi = useApi<BildaustrahlungArcsResponse>(arcsUrl);
  const [view, setView] = useState<"2d" | "3d">("2d");
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<SidebarTab>("domains");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(
    null,
  );
  const [debugOpen, setDebugOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const data = geo.data;

  const arcCustomersAll = arcsApi.data?.customers ?? [];
  const visibleArcCustomers = useMemo(() => {
    if (!showArcs) return [];
    if (selectedCustomerId) {
      return arcCustomersAll.filter((c) => c.id === selectedCustomerId);
    }
    return arcCustomersAll;
  }, [arcCustomersAll, showArcs, selectedCustomerId]);
  const arcs = useMemo(
    () => arcsFromCustomers(visibleArcCustomers),
    [visibleArcCustomers],
  );

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

  const filteredCustomers = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return arcCustomersAll;
    return arcCustomersAll.filter((c) => {
      if (c.company?.toLowerCase().includes(t)) return true;
      if (c.email?.toLowerCase().includes(t)) return true;
      if (c.location?.toLowerCase().includes(t)) return true;
      return false;
    });
  }, [arcCustomersAll, q]);

  const debugJson = useMemo(
    () =>
      JSON.stringify(
        {
          geo: {
            requestUrl: geoUrl,
            loading: geo.loading,
            error: geo.error,
            data: geo.data,
          },
          arcs: {
            requestUrl: arcsUrl,
            loading: arcsApi.loading,
            error: arcsApi.error,
            data: arcsApi.data,
          },
        },
        null,
        2,
      ),
    [
      geoUrl,
      geo.loading,
      geo.error,
      geo.data,
      arcsUrl,
      arcsApi.loading,
      arcsApi.error,
      arcsApi.data,
    ],
  );

  const copyDebug = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(debugJson);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
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

  const totalRequests = geo.data?.total;

  const headerRight = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <button
        type="button"
        onClick={() => setShowArcs((v) => !v)}
        disabled={arcCustomersAll.length === 0}
        className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12px] font-medium transition disabled:opacity-50 ${
          showArcs && arcCustomersAll.length > 0
            ? "border-ink-900 bg-ink-900 text-white hover:bg-ink-800"
            : "border-hair bg-paper text-ink-700 hover:bg-hair/60 hover:text-ink-900"
        }`}
        aria-pressed={showArcs}
        title={
          arcCustomersAll.length === 0
            ? "Keine Kunden mit Standort + passender Domain gefunden"
            : "Bögen vom Kundenstandort zum Viewer-Land ein-/ausblenden"
        }
      >
        <Waypoints className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Streams
        <span className="rounded-sm bg-white/15 px-1 text-[10.5px] tabular-nums text-current">
          {arcs.length}
        </span>
      </button>
      <button
        type="button"
        onClick={() => setDebugOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-hair bg-paper px-2.5 py-1.5 text-[12px] font-medium text-ink-700 transition hover:bg-hair/60 hover:text-ink-900"
        aria-expanded={debugOpen}
        title="Roh-Response der APIs anzeigen"
      >
        <Bug className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Debug
      </button>
      <div className="inline-flex rounded-md border border-hair bg-paper p-0.5">
        <button
          type="button"
          onClick={() => setView("2d")}
          className={`inline-flex items-center gap-1.5 rounded-[4px] px-2.5 py-1 text-[12px] font-medium transition ${
            view === "2d"
              ? "bg-ink-900 text-white"
              : "text-ink-600 hover:bg-hair/80 hover:text-ink-900"
          }`}
          aria-pressed={view === "2d"}
        >
          <MapIcon className="h-3.5 w-3.5 shrink-0" />
          2D
        </button>
        <button
          type="button"
          onClick={() => setView("3d")}
          className={`inline-flex items-center gap-1.5 rounded-[4px] px-2.5 py-1 text-[12px] font-medium transition ${
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
    </div>
  );

  const summaryRight = (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-ink-500">
      {totalRequests != null ? (
        <>
          <span>
            <strong className="font-semibold text-ink-900 tabular-nums">
              {fmtNumber(totalRequests)}
            </strong>{" "}
            Requests
          </span>
          <span>
            <strong className="font-semibold text-ink-900 tabular-nums">
              {fmtNumber(geo.data?.domains?.length ?? 0)}
            </strong>{" "}
            Domains
          </span>
          <span>
            <strong className="font-semibold text-ink-900 tabular-nums">
              {fmtNumber(arcCustomersAll.length)}
            </strong>{" "}
            Streams
          </span>
        </>
      ) : geo.loading ? (
        <span>Lade Analytics …</span>
      ) : (
        <span>Keine Daten</span>
      )}
    </div>
  );

  return (
    <>
      <PageHeader
        eyebrow="Ansichten"
        title="Bildaustrahlung"
        description="Bild-URL-Requests pro Land und Domain (`image_url_requests`). Standard 90 Tage. Kunden-Streams verbinden den Kunden-Standort mit den Viewer-Ländern."
        rightSlot={
          <div className="flex flex-col items-end gap-2">
            {headerRight}
            {summaryRight}
          </div>
        }
      />

      {(geo.error ||
        (geo.data?.queryWarnings && geo.data.queryWarnings.length > 0)) && (
        <div className="mt-2 rounded-md border border-amber-200/70 bg-amber-50/70 px-3 py-2 text-[12px] text-amber-900">
          {geo.error && <span>{geo.error}</span>}
          {!geo.error &&
            geo.data?.queryWarnings &&
            geo.data.queryWarnings.length > 0 && (
              <span title={geo.data.queryWarnings.join(" | ")}>
                Hinweis: {geo.data.queryWarnings[0]?.slice(0, 220)}
              </span>
            )}
        </div>
      )}

      <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-stretch">
        {/* Karte links */}
        <div className="min-w-0 flex-1 lg:order-1">
          {view === "2d" ? (
            <OverviewMap2D
              data={data}
              loading={geo.loading}
              error={geo.error}
              copy={BILDAUSTRAHLUNG_CHOROPLETH_UI}
              arcs={arcs}
            />
          ) : (
            <Suspense
              fallback={
                <div className="grid min-h-[400px] place-items-center rounded-md border border-dashed border-hair bg-paper/60 text-[13px] text-ink-500">
                  3D-Ansicht wird geladen…
                </div>
              }
            >
              <OverviewGlobe
                data={data}
                loading={geo.loading}
                error={geo.error}
                copy={BILDAUSTRAHLUNG_CHOROPLETH_UI}
                arcs={arcs}
              />
            </Suspense>
          )}
        </div>

        {/* Sidebar rechts */}
        <aside className="w-full shrink-0 lg:order-2 lg:max-w-sm">
          {/* Tabs */}
          <div
            role="tablist"
            aria-label="Sidebar"
            className="flex border-b border-hair"
          >
            <TabButton
              active={tab === "domains"}
              onClick={() => setTab("domains")}
              label="Domains"
              count={filteredDomains.length}
            />
            <TabButton
              active={tab === "streams"}
              onClick={() => setTab("streams")}
              label="Streams"
              count={filteredCustomers.length}
            />
          </div>

          {/* Suche */}
          <div className="mt-3 flex items-center gap-2 rounded-md border border-hair bg-paper px-2 py-1.5">
            <Search
              className="h-3.5 w-3.5 shrink-0 text-ink-400"
              aria-hidden
            />
            <input
              type="search"
              value={q}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setQ(e.target.value)
              }
              placeholder={
                tab === "domains" ? "Domain filtern …" : "Kunde filtern …"
              }
              className="min-w-0 flex-1 bg-transparent text-[12.5px] text-ink-800 outline-none placeholder:text-ink-400"
              aria-label={tab === "domains" ? "Domains filtern" : "Kunden filtern"}
            />
          </div>

          {/* Inhalt */}
          {tab === "domains" ? (
            <ul
              className="mt-3 max-h-[min(50vh,420px)] divide-y divide-hair overflow-y-auto pr-0.5 lg:max-h-[min(85vh,720px)]"
              aria-label="Domain-Liste"
            >
              {geo.error && (
                <li className="px-1 py-2 text-[12.5px] text-accent-amber">
                  {geo.error}
                </li>
              )}
              {geo.loading && !geo.data && !geo.error && (
                <li className="px-1 py-2 text-[12.5px] text-ink-500">
                  Laden …
                </li>
              )}
              {geo.data && filteredDomains.length === 0 && (
                <li className="px-1 py-2 text-[12.5px] text-ink-500">
                  Keine Treffer
                </li>
              )}
              {filteredDomains.map((row) => (
                <li key={row.domain} className="min-w-0 py-2">
                  <div className="flex min-w-0 items-baseline justify-between gap-2">
                    <span
                      className="truncate font-mono text-[12px] text-ink-800"
                      title={row.domain}
                    >
                      {row.domain}
                    </span>
                    <span className="shrink-0 text-[12px] tabular-nums text-ink-500">
                      {fmtNumber(row.count)}
                    </span>
                  </div>
                  <div className="mt-1 h-1 w-full overflow-hidden rounded-sm bg-ink-50">
                    <div
                      className="h-full rounded-sm bg-[hsl(214_45%_48%)]"
                      style={{
                        width: `${(row.count / domainMax) * 100}%`,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-3">
              {selectedCustomerId && (
                <div className="mb-2 flex items-center justify-between text-[11.5px]">
                  <span className="text-ink-500">Bögen gefiltert.</span>
                  <button
                    type="button"
                    className="text-accent-blue underline decoration-dotted hover:text-ink-900"
                    onClick={() => setSelectedCustomerId(null)}
                  >
                    Auswahl aufheben
                  </button>
                </div>
              )}
              <ul
                className="max-h-[min(50vh,420px)] divide-y divide-hair overflow-y-auto pr-0.5 lg:max-h-[min(82vh,700px)]"
                aria-label="Kunden-Streams"
              >
                {arcsApi.error && (
                  <li className="px-1 py-2 text-[12.5px] text-accent-amber">
                    {arcsApi.error}
                  </li>
                )}
                {arcsApi.loading && !arcsApi.data && !arcsApi.error && (
                  <li className="px-1 py-2 text-[12.5px] text-ink-500">
                    Laden …
                  </li>
                )}
                {arcsApi.data && filteredCustomers.length === 0 && (
                  <li className="px-1 py-2 text-[12.5px] text-ink-500">
                    Keine Treffer
                  </li>
                )}
                {filteredCustomers.map((c) => {
                  const active = selectedCustomerId === c.id;
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedCustomerId((prev) =>
                            prev === c.id ? null : c.id,
                          )
                        }
                        className={`flex w-full min-w-0 flex-col items-start gap-0.5 px-1 py-2 text-left transition ${
                          active
                            ? "bg-ink-900/[0.04]"
                            : "hover:bg-ink-50"
                        }`}
                        aria-pressed={active}
                      >
                        <span className="block w-full truncate font-medium text-ink-900">
                          {c.company || c.email}
                        </span>
                        <span className="text-[11.5px] text-ink-500">
                          {iso2Name(c.location)} ({c.location}) →{" "}
                          {fmtNumber(c.viewersTotal)} Requests aus{" "}
                          {c.viewersCountryCount} Ländern
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </aside>
      </div>

      {/* Debug Modal */}
      {debugOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center p-4 sm:items-center sm:p-6"
          role="presentation"
        >
          <button
            type="button"
            className="absolute inset-0 bg-ink-900/40 backdrop-blur-[2px]"
            aria-label="Schließen"
            onClick={() => setDebugOpen(false)}
          />
          <div
            className="relative z-[81] flex max-h-[min(90vh,720px)] w-full max-w-3xl flex-col overflow-hidden rounded-md border border-hair bg-paper shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="bildaustrahlung-debug-title"
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-hair px-4 py-3">
              <div>
                <h2
                  id="bildaustrahlung-debug-title"
                  className="text-[14px] font-semibold text-ink-900"
                >
                  API-Response (Debug)
                </h2>
                <p className="mt-0.5 text-[11.5px] text-ink-500">
                  <strong className="text-ink-700">geo</strong>: Aggregat
                  (Domains + Länder) ·{" "}
                  <strong className="text-ink-700">arcs</strong>: Kunden mit
                  Standort + Domain → Country-Breakdown
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDebugOpen(false)}
                className="rounded-md p-1.5 text-ink-500 transition hover:bg-hair/80 hover:text-ink-900"
                aria-label="Schließen"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex shrink-0 items-center gap-3 border-b border-hair bg-paper/60 px-4 py-2">
              <label className="inline-flex items-center gap-1.5 text-[12px] text-ink-700">
                <input
                  type="checkbox"
                  checked={apiDiagnose}
                  onChange={(e) => setApiDiagnose(e.target.checked)}
                  className="rounded border-hair"
                />
                Volumen-Diagnose
              </label>
              <span className="ml-auto inline-flex items-center gap-1 text-[11.5px] text-ink-500">
                <span className="rounded-sm bg-ink-50 px-1.5 py-0.5 font-mono text-[11px]">
                  ESC
                </span>{" "}
                schließt
              </span>
              <button
                type="button"
                onClick={copyDebug}
                className="inline-flex items-center gap-1.5 rounded-md border border-hair bg-white px-2.5 py-1 text-[12px] font-medium text-ink-800 transition hover:bg-hair/60"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-accent-mint" />
                    Kopiert
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Kopieren
                  </>
                )}
              </button>
            </div>
            <pre className="m-0 max-h-[min(75vh,560px)] overflow-auto bg-ink-50/40 p-4 text-left text-[11.5px] leading-relaxed text-ink-800 [tab-size:2]">
              <code className="font-mono">{debugJson}</code>
            </pre>
          </div>
        </div>
      )}
    </>
  );
}

function TabButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`relative -mb-px inline-flex items-center gap-1.5 px-3 py-2 text-[12.5px] font-medium transition ${
        active
          ? "border-b-2 border-ink-900 text-ink-900"
          : "border-b-2 border-transparent text-ink-500 hover:text-ink-900"
      }`}
    >
      {label}
      <span className="rounded-sm bg-ink-50 px-1 py-px text-[10.5px] tabular-nums text-ink-600">
        {count}
      </span>
    </button>
  );
}
