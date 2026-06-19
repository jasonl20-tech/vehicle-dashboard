import { ArrowLeft, ExternalLink, ImageIcon, Ruler, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import PageHeader from "../components/ui/PageHeader";
import { useApi } from "../lib/customerApi";
import {
  deleteVehicleImagery,
  putVehicleImageryActive,
  rescaleVehicleImagery,
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
  const navigate = useNavigate();
  const id = Number(raw);
  const oneUrl = useMemo(() => {
    if (!Number.isFinite(id) || id < 1) return null;
    return vehicleImageryOneUrl(id);
  }, [id]);
  const api = useApi<VehicleImageryOneResponse>(oneUrl);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [hoehe, setHoehe] = useState("1550");
  const [rescaling, setRescaling] = useState(false);
  const [rescaleMsg, setRescaleMsg] = useState<{
    kind: "ok" | "err";
    text: string;
  } | null>(null);

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

  const handleDelete = async () => {
    if (busy || deleting || !row) return;
    const label =
      `${row.marke ?? ""} ${row.modell ?? ""}`.trim() || `Eintrag ${id}`;
    const ok = window.confirm(
      `Fahrzeug „${label}" (id ${id}) wirklich löschen?\n\n` +
        `Alle Bilder werden aus dem Bucket (vehicleimagery-public) entfernt ` +
        `und der Eintrag aus der Datenbank gelöscht. ` +
        `Das kann nicht rückgängig gemacht werden.`,
    );
    if (!ok) return;
    // Zweite, genauere Bestätigung: die exakte ID muss eingetippt werden.
    const typed = window.prompt(
      `Letzte Bestätigung.\n\nZum endgültigen Löschen von „${label}" bitte die ID exakt eingeben:\n\n${id}`,
    );
    if (typed == null) return;
    if (typed.trim() !== String(id)) {
      setErr(
        `Löschen abgebrochen — „${typed.trim()}" stimmt nicht mit der ID ${id} überein.`,
      );
      return;
    }
    setErr(null);
    setDeleting(true);
    try {
      await deleteVehicleImagery(id);
      navigate("/dashboard/databases/production");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setDeleting(false);
    }
  };

  const handleRescale = async () => {
    if (rescaling || !row) return;
    const h = Math.round(Number(hoehe.trim()));
    if (!Number.isFinite(h) || h < 1000 || h > 3000) {
      setRescaleMsg({
        kind: "err",
        text: "Bitte eine Höhe zwischen 1000 und 3000 (mm) eingeben.",
      });
      return;
    }
    setRescaleMsg(null);
    setRescaling(true);
    try {
      const r = await rescaleVehicleImagery(id, h);
      const skipNote =
        r.skipped.length > 0 ? ` (${r.skipped.length} ohne Quellbild übersprungen)` : "";
      setRescaleMsg({
        kind: "ok",
        text:
          `${r.scheduled.length} Ansicht(en) werden mit Höhe ${r.hohe} neu skaliert${skipNote}. ` +
          `Sie erscheinen gleich in Kontrolle → Skalierung und müssen dort erst freigegeben werden, ` +
          `bevor sie die Produktionsbilder überschreiben.`,
      });
    } catch (e) {
      setRescaleMsg({
        kind: "err",
        text: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setRescaling(false);
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

          <div className="mb-6 -mt-2 flex flex-col items-end gap-2">
            <button
              type="button"
              disabled={deleting || busy}
              onClick={handleDelete}
              title="Löscht alle Bilder aus dem Bucket und den DB-Eintrag"
              className="inline-flex items-center gap-1.5 rounded-md border border-accent-rose/40 bg-accent-rose/5 px-3 py-1.5 text-[12.5px] font-medium text-accent-rose transition hover:bg-accent-rose/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {deleting ? "Wird gelöscht…" : "Auto löschen"}
            </button>
            <button
              type="button"
              disabled={deleting || busy}
              onClick={() => setEditing((v) => !v)}
              aria-expanded={editing}
              title="Bilder neu skalieren mit eigener Höhe"
              className="inline-flex items-center gap-1.5 rounded-md border border-hair bg-paper px-3 py-1.5 text-[12.5px] font-medium text-ink-700 transition hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Ruler className="h-3.5 w-3.5" />
              Bilder bearbeiten
            </button>
          </div>

          {editing && (
            <div className="mb-6 rounded-lg border border-hair bg-paper p-4">
              <h3 className="text-[13px] font-medium text-ink-800">
                Neu skalieren + Höhe
              </h3>
              <p className="mt-1 max-w-prose text-[12px] leading-relaxed text-ink-500">
                Skaliert die Außen-Ansichten mit einer eigenen Höhe neu (falls
                das Auto im Verhältnis zu groß/klein ist). Faustregel:{" "}
                <span className="font-medium text-ink-700">
                  kleinere Zahl = kleiner im Bild, größere Zahl = größer
                </span>{" "}
                (Standard 1550, Fahrzeughöhe in mm). Die neuen Bilder landen
                in <span className="font-medium text-ink-700">Kontrolle → Skalierung</span>{" "}
                und überschreiben die Produktion erst nach deiner Freigabe.
              </p>
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1 text-[11px] text-ink-500">
                  Höhe (mm)
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1000}
                    max={3000}
                    step={10}
                    value={hoehe}
                    onChange={(e) => setHoehe(e.target.value)}
                    disabled={rescaling}
                    className="w-32 rounded-md border border-hair bg-paper px-2 py-1.5 text-[13px] text-ink-900 focus:border-ink-600 focus:outline-none disabled:opacity-50"
                  />
                </label>
                <button
                  type="button"
                  disabled={rescaling}
                  onClick={handleRescale}
                  className="inline-flex items-center gap-1.5 rounded-md border border-brand-500/40 bg-brand-500/10 px-3 py-1.5 text-[12.5px] font-medium text-brand-700 transition hover:bg-brand-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Ruler className="h-3.5 w-3.5" />
                  {rescaling ? "Wird skaliert…" : "Neu skalieren"}
                </button>
              </div>
              {rescaleMsg && (
                <p
                  className={`mt-3 rounded border px-3 py-2 text-[12px] ${
                    rescaleMsg.kind === "ok"
                      ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700"
                      : "border-accent-rose/30 bg-accent-rose/5 text-accent-rose"
                  }`}
                >
                  {rescaleMsg.text}
                </p>
              )}
            </div>
          )}

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
