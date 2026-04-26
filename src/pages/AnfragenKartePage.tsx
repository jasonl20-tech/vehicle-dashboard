import OverviewGlobe from "../components/OverviewGlobe";
import PageHeader from "../components/ui/PageHeader";
import { useApi } from "../lib/customerApi";
import {
  type SubmissionsByCountryResponse,
  SUBMISSIONS_BY_COUNTRY_URL,
} from "../lib/overviewGlobeApi";

export default function AnfragenKartePage() {
  const submissionsByCountry = useApi<SubmissionsByCountryResponse>(
    SUBMISSIONS_BY_COUNTRY_URL,
  );

  return (
    <>
      <PageHeader
        eyebrow="Ansichten"
        title="Anfragen Karte"
        description="Anfragen nach Land – stärkere Einsendungen erscheinen blauer."
      />
      <div className="mt-6">
        <OverviewGlobe
          data={submissionsByCountry.data}
          loading={submissionsByCountry.loading}
          error={submissionsByCountry.error}
        />
      </div>
    </>
  );
}
