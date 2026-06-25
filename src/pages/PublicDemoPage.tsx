import { type ReactNode, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import CarDatabaseDemoPage, { type DemoMode } from "./CarDatabaseDemoPage";
import { fetchDemoPublicConfig } from "../lib/demoLinksApi";
import { Logo } from "../components/brand/Logo";

/**
 * Öffentliche Hülle für einen Kunden-Demo-Link (`/d/:token`) — läuft OHNE
 * Dashboard-Login. Lädt die Link-Konfiguration über den öffentlichen Endpoint
 * und rendert die Demo-Seite im eingeschränkten Demo-Modus. Ungültig/abgelaufen
 * → saubere Hinweis-Seite.
 */

type State =
  | { phase: "loading" }
  | { phase: "invalid" }
  | { phase: "ready"; demo: DemoMode; name: string };

export default function PublicDemoPage() {
  const { token = "" } = useParams();
  const [state, setState] = useState<State>({ phase: "loading" });

  useEffect(() => {
    let alive = true;
    setState({ phase: "loading" });
    fetchDemoPublicConfig(token).then((cfg) => {
      if (!alive) return;
      if (!cfg.ok) {
        setState({ phase: "invalid" });
        return;
      }
      setState({
        phase: "ready",
        name: cfg.name,
        demo: {
          token,
          allowedColors: cfg.allowedColors,
          featured: cfg.featured,
          showroom: cfg.showroom,
        },
      });
    });
    return () => {
      alive = false;
    };
  }, [token]);

  if (state.phase === "loading") {
    return <Centered>Demo wird geladen …</Centered>;
  }
  if (state.phase === "invalid") {
    return (
      <Centered title="Link nicht verfügbar">
        Dieser Demo-Link ist ungültig, gesperrt oder abgelaufen. Bitte fordere
        einen neuen Link an.
      </Centered>
    );
  }

  return (
    <div className="min-h-screen bg-paper">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <CarDatabaseDemoPage demo={state.demo} />
        <p className="mt-4 text-center text-[11px] text-ink-400">
          Vehicleimagery · Demo-Zugang{state.name ? ` · ${state.name}` : ""}
        </p>
      </div>
    </div>
  );
}

function Centered({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-screen place-items-center bg-paper px-6 text-center">
      <div className="max-w-md">
        <Logo className="mx-auto mb-5 h-5 w-auto text-ink-900" />
        {title && (
          <h1 className="mb-1.5 text-[18px] font-semibold text-ink-900">
            {title}
          </h1>
        )}
        <p className="text-[13px] leading-relaxed text-ink-500">{children}</p>
      </div>
    </div>
  );
}
