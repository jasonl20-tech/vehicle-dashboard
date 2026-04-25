import KundenApiPage from "./KundenApiPage";

/**
 * Statistik für das Analytics-Engine-Dataset `api_analytics` im zweiten
 * Cloudflare-Konto (CF_ACCOUNT_ID_2 / CF_API_TOKEN_2). Gleiche UI und
 * Logik wie „Kunden API“, nur anderes Konto + Dataset-Name.
 */
export default function ApiAnalyticsPage() {
  return (
    <KundenApiPage
      binding="secondary"
      title="API Analytics"
      eyebrow="Analytics · API Analytics (Konto 2)"
    />
  );
}
