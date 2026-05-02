import { ArrowLeft, ExternalLink, ImageIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import PageHeader from "../components/ui/PageHeader";
import { useApi } from "../lib/customerApi";
import {
  putVehicleImageryActive,
  type VehicleImageryOneResponse,
  vehicleImageryOneUrl,
} from "../lib/vehicleImageryPublicApi";
import { buildVehicleImageUrl, parseViewTokens } from "../lib/vehicleImageryUrl";

function fmtWhen(s: string | null | undefined): string {
  if (!s?.trim()) return "—";
  const t = s.includes("T")
    ? Date.parse(s)
    : Date.parse(s.replace(" ", "T") + "Z");
  if (isNaN(t)) return s;
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(t));
}

export default function ProductionVehicleDetailPage() {
  const { id: raw } = useParams();
  const id = Number(raw);
  const oneUrl = useMemo(() => {
    if (!Number.isFinite(id) || id < 1) return null;
    return vehicleImageryOneUrl(id);
  }, [id]);
  const api = useApi<VehicleImageryOneResponse>(oneUrl);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const row = api.data?.row;
  const cdnBase = (api.data?.cdnBase || "https://bildurl.vehicleimagery.com").replace(
    /\/$/,
    "",
  );
  const imageUrlQuery = api.data?.imageUrlQuery ?? "";
  const views = row ? parseViewTokens(row.views) : [];

  const toggleActive = async () => {
    if (busy || !row) return;
    setErr(null);
    setBusy(true);
    try {
      const next: 0 | 1 = row.active === 1 ? 0 : 1;
      await putVehicleImageryActive(id, next);
      await api.reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (!Number.isFinite(id) || id < 1) {
    return (
      <div>
        <PageHeader
          eyebrow="Datenbanken"
          title="Ungültige Adresse"
          description="keine gültige Eintrags-ID in der URL."
        />
        <Link
          to="/dashboard/databases/production"
          className="text-[13px] text-brand-600 hover:underline"
        >
          ← Zurück zur Übersicht
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <Link
          to="/dashboard/databases/production"
          className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-600 hover:text-ink-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Zurück zur Übersicht
        </Link>
      </div>

      <PageHeader
        eyebrow="Datenbanken"
        title={
          row
            ? `${row.marke ?? "—"} ${row.modell ?? ""}`.trim() || `Eintrag ${id}`
            : api.loading
              ? "Laden…"
              : "Eintrag"
        }
        description={
          row ? (
            <span className="text-ink-600">
              id <span className="font-mono">{row.id}</span> · {row.jahr ?? "—"} ·{" "}
              {row.body} / {row.trim} / {row.farbe} · genehmigt{" "}
              <span className="font-mono">
                {row.genehmigt === 1 ? "1" : "0"}
              </span>
            </span>
          ) : null
        }
      />

      {api.error && !row && (
        <p className="mb-4 text-[13px] text-accent-rose">{api.error}</p>
      )}
      {err && (
        <p className="mb-4 rounded border border-accent-rose/30 bg-accent-rose/5 px-3 py-2 text-[12.5px] text-accent-rose">
          {err}
        </p>
      )}

      {row && (
        <>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-hair bg-paper px-4 py-3">
            <div className="min-w-0 text-[12.5px] text-ink-600">
              <span className="text-ink-500">Aktiv-Status</span>
              <span className="mx-2">·</span>
              <span>Stand: {fmtWhen(row.last_updated)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[12.5px] text-ink-500">
                {row.active === 1 ? "Aktiv" : "Inaktiv"}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={row.active === 1}
                disabled={busy}
                onClick={toggleActive}
                className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                  row.active === 1 ? "bg-brand-500" : "bg-ink-200"
                } ${busy ? "opacity-50" : ""}`}
              >
                <span
                  className={`pointer-events-none absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                    row.active === 1 ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>

          <h2 className="mb-3 text-[12px] font-medium uppercase tracking-[0.12em] text-ink-400">
            Bilder
          </h2>
          {views.length === 0 ? (
            <p className="text-[13px] text-ink-500">
              Keine Ansichten — Feld{" "}
              <code className="font-mono text-ink-600">views</code> leer.
            </p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {views.map((v) => {
                const href = buildVehicleImageUrl(
                  cdnBase,
                  row,
                  v,
                  imageUrlQuery,
                );
                return (
                  <li
                    key={v}
                    className="overflow-hidden rounded-lg border border-hair bg-ink-50/40"
                  >
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block border-b border-hair bg-paper p-1.5 text-[10.5px] text-brand-600 hover:underline"
                    >
                      <span className="font-mono break-all">{v}</span>
                      <ExternalLink className="ml-1 inline h-2.5 w-2.5" />
                    </a>
                    <div className="grid place-items-center p-2">
                      <img
                        src={href}
                        alt={v}
                        loading="lazy"
                        className="max-h-48 w-full object-contain"
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <p className="mt-4 flex items-start gap-1.5 text-[10.5px] text-ink-500">
            <ImageIcon className="mt-0.5 h-3 w-3 shrink-0" />
            <span>
              CDN: <code className="font-mono text-ink-600">{cdnBase}</code>
            </span>
          </p>
        </>
      )}

      {api.loading && !row && !api.error && (
        <p className="text-[13px] text-ink-500">Laden…</p>
      )}
    </div>
  );
}
