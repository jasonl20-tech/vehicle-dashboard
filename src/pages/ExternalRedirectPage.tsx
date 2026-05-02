import { useEffect } from "react";

/**
 * Interner Pfad → externer Service. Wir leiten erst nach erfolgreicher
 * Sicherheitsstufen-Prüfung (ProtectedRoute) weiter.
 */
export default function ExternalRedirectPage({ href }: { href: string }) {
  useEffect(() => {
    window.location.replace(href);
  }, [href]);

  return (
    <div className="grid min-h-screen place-items-center bg-paper text-[12px] uppercase tracking-[0.18em] text-ink-400">
      Weiterleitung …
    </div>
  );
}
