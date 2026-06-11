import { ArrowLeft, Check, Loader2, Plus, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../components/ui/PageHeader";
import {
  createVehicleImageryControlling,
  type CreateVehicleResponse,
  getVehicleImageryControllingFacets,
  type VehicleImageryFacets,
} from "../lib/vehicleImageryPublicApi";

const TEXT_IN =
  "w-full min-w-0 rounded border border-hair bg-white px-2 py-1.5 text-[12.5px] text-ink-800 focus:border-ink-400 focus:outline-none";
const LABEL =
  "mb-0.5 block text-[10.5px] font-medium uppercase tracking-wider text-ink-400";

const EXTERIOR_VIEWS = [
  "front",
  "rear",
  "left",
  "right",
  "front_left",
  "front_right",
  "rear_left",
  "rear_right",
] as const;
const INTERIOR_VIEWS = ["dashboard", "center_console"] as const;

/**
 * Parst eine Jahr-Eingabe in eine sortierte, deduplizierte Jahresliste.
 * Erlaubt: „2024", „2020-2024" (Bereich), „2020, 2022" / „2020 2022" (Liste)
 * und Mischungen wie „2018, 2020-2022, 2024".
 */
function parseYears(input: string): { years: number[]; error: string | null } {
  const normalized = input.replace(/\s*-\s*/g, "-");
  const tokens = normalized
    .split(/[,\s]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  const out = new Set<number>();
  for (const tok of tokens) {
    const range = tok.match(/^(\d{4})-(\d{4})$/);
    if (range) {
      let a = Number(range[1]);
      let b = Number(range[2]);
      if (a > b) [a, b] = [b, a];
      if (b - a > 50) return { years: [], error: `Bereich zu groß: ${tok}` };
      for (let y = a; y <= b; y++) out.add(y);
    } else if (/^\d{4}$/.test(tok)) {
      out.add(Number(tok));
    } else {
      return { years: [], error: `Ungültiger Eintrag: „${tok}"` };
    }
  }
  const years = [...out].sort((a, b) => a - b);
  if (years.length > 40) return { years, error: "Maximal 40 Jahrgänge." };
  return { years, error: null };
}

type FieldMode = "text" | "select";

export default function VehicleCreatePage() {
  const [facets, setFacets] = useState<VehicleImageryFacets | null>(null);

  const [markeMode, setMarkeMode] = useState<FieldMode>("text");
  const [modellMode, setModellMode] = useState<FieldMode>("text");

  const [marke, setMarke] = useState("");
  const [modell, setModell] = useState("");
  const [jahr, setJahr] = useState("");
  const [body, setBody] = useState("Basis");
  const [trim, setTrim] = useState("base");
  const [farbe, setFarbe] = useState("default");
  const [resolution, setResolution] = useState("default");
  const [format, setFormat] = useState("png");

  const [views, setViews] = useState<Set<string>>(
    () => new Set<string>(EXTERIOR_VIEWS),
  );

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateVehicleResponse | null>(null);

  useEffect(() => {
    let alive = true;
    getVehicleImageryControllingFacets()
      .then((f) => alive && setFacets(f))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const markeOptions = facets?.markes ?? [];
  const modellOptions = useMemo(() => {
    if (!facets) return [];
    if (marke && facets.modellsByMarke[marke]) {
      return facets.modellsByMarke[marke];
    }
    return [...new Set(Object.values(facets.modellsByMarke).flat())].sort();
  }, [facets, marke]);

  const yearsParsed = useMemo(() => parseYears(jahr), [jahr]);

  const toggleView = (v: string) =>
    setViews((prev) => {
      const next = new Set(prev);
      if (next.has(v)) next.delete(v);
      else next.add(v);
      return next;
    });

  const resetForm = () => {
    setResult(null);
    setError(null);
    setMarke("");
    setModell("");
    setJahr("");
    setBody("Basis");
    setTrim("base");
    setFarbe("default");
    setResolution("default");
    setFormat("png");
    setViews(new Set<string>(EXTERIOR_VIEWS));
  };

  const submit = async () => {
    setError(null);
    if (!marke.trim() || !modell.trim()) {
      setError("Marke und Modell sind erforderlich.");
      return;
    }
    if (yearsParsed.error) {
      setError(`Jahr: ${yearsParsed.error}`);
      return;
    }
    if (yearsParsed.years.length === 0) {
      setError("Mindestens ein Jahr angeben (z. B. 2024 oder 2020-2024).");
      return;
    }
    if (views.size === 0) {
      setError("Mindestens eine Ansicht wählen.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await createVehicleImageryControlling({
        marke: marke.trim(),
        modell: modell.trim(),
        jahre: yearsParsed.years.map(String),
        body: body.trim() || "Basis",
        trim: trim.trim() || "base",
        farbe: farbe.trim() || "default",
        resolution: resolution.trim() || "default",
        format: format.trim() || "png",
        views: [...views],
      });
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const ModeSwitch = ({
    mode,
    onChange,
  }: {
    mode: FieldMode;
    onChange: (m: FieldMode) => void;
  }) => (
    <div className="inline-flex overflow-hidden rounded border border-hair bg-white">
      {(["text", "select"] as const).map((m, i) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          className={`px-1.5 py-0.5 text-[10px] transition-colors ${
            mode === m ? "bg-ink-900 text-white" : "text-ink-500 hover:bg-ink-50"
          } ${i > 0 ? "border-l border-hair" : ""}`}
        >
          {m === "text" ? "Text" : "Liste"}
        </button>
      ))}
    </div>
  );

  return (
    <div>
      <div className="mb-4">
        <Link
          to="/dashboard/databases/production"
          className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-600 hover:text-ink-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Zurück zu den Datenbanken
        </Link>
      </div>

      <PageHeader
        eyebrow="Datenbanken"
        title="Auto erstellen"
        hideCalendarAndNotifications
        description={
          <span className="text-ink-600">
            Legt ein neues Fahrzeug im{" "}
            <code className="font-mono text-[11.5px]">
              vehicleimagery_controlling_storage
            </code>{" "}
            an und startet die KI-Generierung (Text-zu-Bild) der gewählten
            Ansichten. Das Auto erscheint danach in der Kontroll-Plattform und
            geht erst nach „correct/übertragen" live.
          </span>
        }
      />

      {result ? (
        <div className="max-w-xl rounded-lg border border-accent-mint/40 bg-accent-mint/5 p-5">
          <div className="mb-2 flex items-center gap-2 text-[14px] font-medium text-ink-900">
            <Check className="h-4 w-4 text-accent-mint" />
            {result.created.length} Auto{result.created.length === 1 ? "" : "s"}{" "}
            angelegt
            {result.skipped.length > 0
              ? `, ${result.skipped.length} übersprungen`
              : ""}
          </div>
          <p className="text-[12.5px] text-ink-700">
            <span className="font-medium">{result.totalJobs}</span>{" "}
            Generierungs-Jobs gestartet ({result.views.join(", ")}). Die Bilder
            werden in den nächsten Minuten generiert.
          </p>
          {result.created.length > 0 ? (
            <p className="mt-2 font-mono text-[11px] text-ink-600">
              Angelegt:{" "}
              {result.created.map((c) => `${c.jahr} → id ${c.id}`).join("  ·  ")}
            </p>
          ) : null}
          {result.skipped.length > 0 ? (
            <p className="mt-1 font-mono text-[11px] text-ink-400">
              Übersprungen (existierten schon):{" "}
              {result.skipped
                .map((s) => `${s.jahr} (id ${s.existingId})`)
                .join("  ·  ")}
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              to="/control-platform"
              className="inline-flex items-center gap-1.5 rounded-md bg-ink-900 px-3 py-1.5 text-[12.5px] font-medium text-white hover:bg-ink-700"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Zur Kontroll-Plattform
            </Link>
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center gap-1.5 rounded-md border border-hair bg-white px-3 py-1.5 text-[12.5px] text-ink-700 hover:bg-ink-50"
            >
              <Plus className="h-3.5 w-3.5" />
              Noch ein Auto anlegen
            </button>
          </div>
        </div>
      ) : (
        <div className="max-w-3xl">
          {error && (
            <p className="mb-4 rounded border border-accent-rose/30 bg-accent-rose/5 px-3 py-2 text-[12.5px] text-accent-rose">
              {error}
            </p>
          )}

          <section className="rounded-lg border border-hair bg-paper/80 p-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {/* Marke */}
              <div>
                <div className="mb-0.5 flex items-center justify-between">
                  <label className={`${LABEL} mb-0`}>Marke *</label>
                  <ModeSwitch mode={markeMode} onChange={setMarkeMode} />
                </div>
                {markeMode === "select" ? (
                  <select
                    className={TEXT_IN}
                    value={marke}
                    onChange={(e) => setMarke(e.target.value)}
                  >
                    <option value="">— wählen —</option>
                    {markeOptions.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className={TEXT_IN}
                    placeholder="z. B. Kia"
                    value={marke}
                    onChange={(e) => setMarke(e.target.value)}
                  />
                )}
              </div>

              {/* Modell */}
              <div>
                <div className="mb-0.5 flex items-center justify-between">
                  <label className={`${LABEL} mb-0`}>Modell *</label>
                  <ModeSwitch mode={modellMode} onChange={setModellMode} />
                </div>
                {modellMode === "select" ? (
                  <select
                    className={TEXT_IN}
                    value={modell}
                    onChange={(e) => setModell(e.target.value)}
                  >
                    <option value="">— wählen —</option>
                    {modellOptions.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className={TEXT_IN}
                    placeholder="z. B. K4"
                    value={modell}
                    onChange={(e) => setModell(e.target.value)}
                  />
                )}
              </div>

              {/* Jahr(e) */}
              <div>
                <label className={LABEL}>Jahr(e) *</label>
                <input
                  type="text"
                  className={TEXT_IN}
                  placeholder="2024 · 2020-2024 · 2020, 2022"
                  value={jahr}
                  onChange={(e) => setJahr(e.target.value)}
                />
                {jahr.trim() ? (
                  <p
                    className={`mt-0.5 text-[10.5px] ${
                      yearsParsed.error ? "text-accent-rose" : "text-ink-500"
                    }`}
                  >
                    {yearsParsed.error
                      ? yearsParsed.error
                      : `→ ${yearsParsed.years.length} Auto${
                          yearsParsed.years.length === 1 ? "" : "s"
                        }: ${yearsParsed.years.join(", ")}`}
                  </p>
                ) : (
                  <p className="mt-0.5 text-[10.5px] text-ink-400">
                    Einzeln, Bereich (2020-2024) oder Liste (2020, 2022) möglich.
                  </p>
                )}
              </div>

              <div>
                <label className={LABEL}>Body</label>
                <input
                  className={TEXT_IN}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
              </div>
              <div>
                <label className={LABEL}>Trim</label>
                <input
                  className={TEXT_IN}
                  value={trim}
                  onChange={(e) => setTrim(e.target.value)}
                />
              </div>
              <div>
                <label className={LABEL}>Farbe</label>
                <input
                  className={TEXT_IN}
                  value={farbe}
                  onChange={(e) => setFarbe(e.target.value)}
                />
              </div>
              <div>
                <label className={LABEL}>Resolution</label>
                <input
                  className={TEXT_IN}
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                />
              </div>
              <div>
                <label className={LABEL}>Format</label>
                <input
                  className={TEXT_IN}
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-5">
              <label className={LABEL}>Ansichten generieren</label>
              <p className="mb-2 text-[11px] text-ink-500">
                Außenansichten (Standard alle) · Innenansichten optional.
              </p>
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {EXTERIOR_VIEWS.map((v) => {
                    const on = views.has(v);
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => toggleView(v)}
                        className={`rounded-md border px-2.5 py-1.5 font-mono text-[11px] transition-colors ${
                          on
                            ? "border-ink-900 bg-ink-900 text-white"
                            : "border-hair bg-white text-ink-600 hover:bg-ink-50"
                        }`}
                      >
                        {v}
                      </button>
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {INTERIOR_VIEWS.map((v) => {
                    const on = views.has(v);
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => toggleView(v)}
                        className={`rounded-md border px-2.5 py-1.5 font-mono text-[11px] transition-colors ${
                          on
                            ? "border-brand-600 bg-brand-600 text-white"
                            : "border-dashed border-hair bg-white text-ink-500 hover:bg-ink-50"
                        }`}
                      >
                        {v}
                        <span className="ml-1 text-[9px] uppercase opacity-70">
                          innen
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-5 flex items-center gap-3">
              <button
                type="button"
                disabled={submitting}
                onClick={submit}
                className="inline-flex items-center gap-1.5 rounded-md bg-ink-900 px-4 py-2 text-[13px] font-medium text-white transition hover:bg-ink-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {submitting
                  ? "Wird angelegt…"
                  : `${yearsParsed.years.length || 1} Auto${
                      (yearsParsed.years.length || 1) === 1 ? "" : "s"
                    } anlegen · ${views.size} Ansicht${
                      views.size === 1 ? "" : "en"
                    } je Auto`}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
