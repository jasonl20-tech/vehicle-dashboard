import { Globe, Map } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import OverviewMap2D from "../components/OverviewMap2D";
import PageHeader from "../components/ui/PageHeader";
import { useApi } from "../lib/customerApi";
import {
  type SubmissionsByCountryResponse,
  SUBMISSIONS_BY_COUNTRY_URL,
} from "../lib/overviewGlobeApi";

const OverviewGlobe = lazy(() => import("../components/OverviewGlobe"));

export default function AnfragenKartePage() {
  const submissionsByCountry = useApi<SubmissionsByCountryResponse>(
    SUBMISSIONS_BY_COUNTRY_URL,
  );
  const [view, setView] = useState<"2d" | "3d">("2d");

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

  return (
    <>
      <PageHeader
        eyebrow="Ansichten"
        title="Anfragen Karte"
        description="Standard: 2D mit OpenStreetmap. 3D-Globus optional — gleiche Farb­logik (mehr Anfragen = blauer)."
        rightSlot={viewToggle}
      />
      <div className="mt-6">
        {view === "2d" ? (
          <OverviewMap2D
            data={submissionsByCountry.data}
            loading={submissionsByCountry.loading}
            error={submissionsByCountry.error}
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
              data={submissionsByCountry.data}
              loading={submissionsByCountry.loading}
              error={submissionsByCountry.error}
            />
          </Suspense>
        )}
      </div>
    </>
  );
}
