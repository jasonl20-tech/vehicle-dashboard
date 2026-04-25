import KundenApiPage from "./KundenApiPage";

/**
 * Identische Statistik wie die Kunden-API-Seite, aber gefiltert auf den
 * Oneauto-Key (index1 = e6dd0c88a1486d7aeb2d0e7a6423ac31). Logik liegt
 * in `KundenApiPage`, hier setzen wir nur den Mode + Header-Texte.
 */
export default function OneautoApiPage() {
  return (
    <KundenApiPage
      mode="oneauto"
      title="Oneauto API"
      eyebrow="Analytics · Oneauto API"
    />
  );
}
