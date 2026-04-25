import KundenApiPage from "./KundenApiPage";

/**
 * Wie Kunden-API, aber alle Oneauto-Key-Instanzen (zwei index1-Hashes, siehe
 * `getOneautoKeys` im Backend). Logik: `KundenApiPage` + `mode=oneauto`.
 */
export default function OneautoApiPage() {
  return (
    <KundenApiPage
      mode="oneauto"
      title="Oneauto API"
      eyebrow="API Analytics · Oneauto API"
    />
  );
}
