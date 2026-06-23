import {
  AlertTriangle,
  ImageIcon,
  Info,
  Loader2,
  Lock,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import PageHeader from "../components/ui/PageHeader";

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

/** Max. Anzahl Referenzfotos (mehr Winkel = bessere Rekonstruktion). */
const MAX_REF = 8;

const VIEW_LABEL: Record<string, string> = {
  front: "Vorne",
  rear: "Hinten",
  left: "Links",
  right: "Rechts",
  front_left: "Vorne links",
  front_right: "Vorne rechts",
  rear_left: "Hinten links",
  rear_right: "Hinten rechts",
  dashboard: "Cockpit",
  center_console: "Mittelkonsole",
};

/** Parst „2024", „2020-2024", „2020, 2022" → sortierte Jahresliste. */
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
  return { years: [...out].sort((a, b) => a - b), error: null };
}

type Tab = "text" | "images";

export default function CarDatabaseAddPage() {
  const [tab, setTab] = useState<Tab>("text");

  return (
    <div>
      <PageHeader
        eyebrow="Car Database"
        title="Auto hinzufügen"
        description="Neue Fahrzeuge anlegen — klassisch per Text (KI generiert die Ansichten) oder aus eigenen Fotos (für Modelle, die die KI noch nicht kennt)."
      />

      {/* Tab-Umschalter */}
      <div className="mb-4 inline-flex rounded-lg border border-hair bg-paper p-0.5">
        <TabBtn active={tab === "text"} onClick={() => setTab("text")}>
          Auto erstellen
        </TabBtn>
        <TabBtn active={tab === "images"} onClick={() => setTab("images")}>
          Aus Bildern erstellen
        </TabBtn>
      </div>

      {tab === "text" ? <TextCreate /> : <ImageCreate />}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
        active ? "bg-ink-900 text-white" : "text-ink-500 hover:text-ink-900"
      }`}
    >
      {children}
    </button>
  );
}

/* ---------- Tab A: Auto erstellen (Text → Bild) — NUR VISUELL ---------- */

function TextCreate() {
  const [marke, setMarke] = useState("");
  const [modell, setModell] = useState("");
  const [jahr, setJahr] = useState("");
  const [body, setBody] = useState("Basis");
  const [trim, setTrim] = useState("base");
  const [promptJahr, setPromptJahr] = useState("");
  const [views, setViews] = useState<Set<string>>(
    () => new Set<string>(EXTERIOR_VIEWS),
  );
  const yearsParsed = useMemo(() => parseYears(jahr), [jahr]);

  const toggleView = (v: string) =>
    setViews((prev) => {
      const next = new Set(prev);
      if (next.has(v)) next.delete(v);
      else next.add(v);
      return next;
    });

  return (
    <div className="max-w-3xl">
      <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-[12.5px] text-amber-700">
        <Lock className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          <strong>Noch nicht aktiv.</strong> Die Generierung wird angeschlossen,
          sobald die neue Kontrolle und Pipeline stehen. Die Eingaben sind hier
          schon einmal vorbereitet, lösen aber noch nichts aus.
        </span>
      </div>

      <section className="rounded-lg border border-hair bg-paper/80 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className={LABEL}>Marke *</label>
            <input
              className={TEXT_IN}
              placeholder="z. B. Kia"
              value={marke}
              onChange={(e) => setMarke(e.target.value)}
            />
          </div>
          <div>
            <label className={LABEL}>Modell *</label>
            <input
              className={TEXT_IN}
              placeholder="z. B. K4"
              value={modell}
              onChange={(e) => setModell(e.target.value)}
            />
          </div>
          <div>
            <label className={LABEL}>Jahr(e) *</label>
            <input
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
            <label className={LABEL}>Prompt-Jahrgang (optional)</label>
            <input
              className={TEXT_IN}
              placeholder="leer = echtes Jahr · z. B. 2023"
              value={promptJahr}
              onChange={(e) => setPromptJahr(e.target.value)}
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

        <div className="mt-5">
          <button
            type="button"
            disabled
            title="Wird später angeschlossen"
            className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-md bg-ink-900/40 px-4 py-2 text-[13px] font-medium text-white"
          >
            <Sparkles className="h-4 w-4" />
            {`${yearsParsed.years.length || 1} Auto${
              (yearsParsed.years.length || 1) === 1 ? "" : "s"
            } anlegen · ${views.size} Ansicht${views.size === 1 ? "" : "en"}`}
          </button>
          <p className="mt-2 text-[11px] text-ink-400">
            Button bewusst deaktiviert — Anbindung folgt mit der neuen Kontrolle.
          </p>
        </div>
      </section>
    </div>
  );
}

/* ---------- Tab B: Aus Bildern erstellen (Bild → Bild) — TEST ---------- */

type Upload = { id: string; name: string; dataUrl: string };
type GenResult = {
  view: string;
  status: "loading" | "done" | "error";
  image?: string;
  error?: string;
};

/**
 * Lädt eine Bilddatei und verkleinert sie (max. Kante `maxDim`, JPEG) → kleine
 * Data-URL. Wichtig, damit der Request nicht zu groß wird (sonst 502 beim
 * Generieren). Reicht für KI-Referenzbilder völlig aus.
 */
function loadAndDownscale(
  file: File,
  maxDim = 1280,
  quality = 0.85,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        try {
          resolve(canvas.toDataURL("image/jpeg", quality));
        } catch {
          resolve(dataUrl);
        }
      };
      img.onerror = () => reject(new Error("Bild konnte nicht geladen werden."));
      img.src = dataUrl;
    };
    reader.onerror = () => reject(new Error("Datei konnte nicht gelesen werden."));
    reader.readAsDataURL(file);
  });
}

function ImageCreate() {
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [marke, setMarke] = useState("");
  const [modell, setModell] = useState("");
  const [jahr, setJahr] = useState("");
  const [targets, setTargets] = useState<Set<string>>(
    () => new Set<string>(["front_left"]),
  );
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<GenResult[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const addFiles = async (files: FileList | null) => {
    if (!files) return;
    setErr(null);
    const room = MAX_REF - uploads.length;
    const list = Array.from(files).slice(0, Math.max(0, room));
    const next: Upload[] = [];
    for (const f of list) {
      try {
        const dataUrl = await loadAndDownscale(f);
        next.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          name: f.name,
          dataUrl,
        });
      } catch {
        /* ignore single file errors */
      }
    }
    setUploads((prev) => [...prev, ...next].slice(0, MAX_REF));
  };

  const removeUpload = (id: string) =>
    setUploads((prev) => prev.filter((u) => u.id !== id));

  const toggleTarget = (v: string) =>
    setTargets((prev) => {
      const n = new Set(prev);
      if (n.has(v)) n.delete(v);
      else n.add(v);
      return n;
    });

  const selectedViews = [...EXTERIOR_VIEWS, ...INTERIOR_VIEWS].filter((v) =>
    targets.has(v),
  );

  const generate = async () => {
    if (uploads.length === 0) {
      setErr("Bitte mindestens ein Foto hochladen.");
      return;
    }
    if (selectedViews.length === 0) {
      setErr("Bitte mindestens eine Ziel-Ansicht wählen.");
      return;
    }
    setErr(null);
    setBusy(true);
    setResults(selectedViews.map((v) => ({ view: v, status: "loading" })));
    for (const v of selectedViews) {
      try {
        const res = await fetch("/api/databases/car-generate-test", {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            images: uploads.map((u) => u.dataUrl),
            view: v,
            marke,
            modell,
            jahr,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          image?: string;
          error?: string;
        };
        const msg =
          data.error ||
          (res.status === 502
            ? "KI aktuell offline (502) — AI-Gateway/Google-Credentials"
            : `HTTP ${res.status}`);
        setResults((prev) =>
          prev.map((r) =>
            r.view === v
              ? data.ok && data.image
                ? { view: v, status: "done", image: data.image }
                : { view: v, status: "error", error: msg }
              : r,
          ),
        );
      } catch (e) {
        setResults((prev) =>
          prev.map((r) =>
            r.view === v
              ? { view: v, status: "error", error: String(e) }
              : r,
          ),
        );
      }
    }
    setBusy(false);
  };

  return (
    <div className="max-w-3xl">
      <div className="mb-4 flex items-start gap-2 rounded-lg border border-brand-500/30 bg-brand-500/5 px-4 py-3 text-[12.5px] text-brand-700">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          <strong>Test-Modus.</strong> Lade ein paar Fotos eines Autos hoch
          (z. B. ein älteres Modell, das die KI nicht kennt) — die KI versucht
          daraus unsere Studio-Ansichten zu erzeugen. Ergebnisse werden{" "}
          <strong>nur temporär angezeigt</strong> und nirgends gespeichert.
        </span>
      </div>

      <section className="rounded-lg border border-hair bg-paper/80 p-4">
        {/* Upload */}
        <label className={LABEL}>Referenzfotos (max. {MAX_REF})</label>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {uploads.map((u) => (
            <div
              key={u.id}
              className="relative h-20 w-24 overflow-hidden rounded-md border border-hair bg-white"
            >
              <img
                src={u.dataUrl}
                alt={u.name}
                className="h-full w-full object-contain"
              />
              <button
                type="button"
                onClick={() => removeUpload(u.id)}
                className="absolute right-0.5 top-0.5 grid h-5 w-5 place-items-center rounded-full bg-ink-900/70 text-white hover:bg-ink-900"
                aria-label="Entfernen"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          {uploads.length < MAX_REF && (
            <label className="grid h-20 w-24 cursor-pointer place-items-center rounded-md border border-dashed border-hair bg-white text-ink-400 hover:bg-ink-50">
              <div className="flex flex-col items-center gap-1">
                <Upload className="h-4 w-4" />
                <span className="text-[10px]">hochladen</span>
              </div>
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  void addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
          )}
        </div>

        {/* Auto-Infos (optional, helfen dem Prompt) */}
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div>
            <label className={LABEL}>Marke (optional)</label>
            <input
              className={TEXT_IN}
              placeholder="z. B. Opel"
              value={marke}
              onChange={(e) => setMarke(e.target.value)}
            />
          </div>
          <div>
            <label className={LABEL}>Modell (optional)</label>
            <input
              className={TEXT_IN}
              placeholder="z. B. Kadett"
              value={modell}
              onChange={(e) => setModell(e.target.value)}
            />
          </div>
          <div>
            <label className={LABEL}>Jahr (optional)</label>
            <input
              className={TEXT_IN}
              placeholder="z. B. 1985"
              value={jahr}
              onChange={(e) => setJahr(e.target.value)}
            />
          </div>
        </div>

        {/* Ziel-Ansichten */}
        <div className="mt-4">
          <label className={LABEL}>Welche Ansichten erzeugen?</label>
          <p className="mb-2 text-[11px] text-ink-500">
            Werden nacheinander generiert (kann je Ansicht etwas dauern).
          </p>
          <div className="flex flex-wrap gap-1.5">
            {[...EXTERIOR_VIEWS, ...INTERIOR_VIEWS].map((v) => {
              const on = targets.has(v);
              const interior = (INTERIOR_VIEWS as readonly string[]).includes(v);
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => toggleTarget(v)}
                  className={`rounded-md border px-2.5 py-1.5 text-[11px] transition-colors ${
                    on
                      ? interior
                        ? "border-brand-600 bg-brand-600 text-white"
                        : "border-ink-900 bg-ink-900 text-white"
                      : "border-hair bg-white text-ink-600 hover:bg-ink-50"
                  }`}
                >
                  {VIEW_LABEL[v] ?? v}
                </button>
              );
            })}
          </div>
        </div>

        {err && (
          <p className="mt-3 flex items-center gap-1.5 text-[12px] text-accent-rose">
            <AlertTriangle className="h-3.5 w-3.5" />
            {err}
          </p>
        )}

        <div className="mt-5">
          <button
            type="button"
            disabled={busy}
            onClick={() => void generate()}
            className="inline-flex items-center gap-1.5 rounded-md bg-ink-900 px-4 py-2 text-[13px] font-medium text-white transition hover:bg-ink-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {busy
              ? "Generiere…"
              : `${selectedViews.length || 1} Ansicht${
                  (selectedViews.length || 1) === 1 ? "" : "en"
                } generieren (Test)`}
          </button>
        </div>
      </section>

      {/* Ergebnisse */}
      {results.length > 0 && (
        <div className="mt-5">
          <h3 className="mb-2 text-[12px] font-medium uppercase tracking-[0.1em] text-ink-400">
            Ergebnis (temporär · nicht gespeichert)
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {results.map((r) => (
              <div
                key={r.view}
                className="overflow-hidden rounded-lg border border-hair bg-white"
              >
                <div className="grid aspect-[4/3] place-items-center bg-ink-50">
                  {r.status === "loading" ? (
                    <Loader2 className="h-5 w-5 animate-spin text-ink-400" />
                  ) : r.status === "done" && r.image ? (
                    <img
                      src={r.image}
                      alt={VIEW_LABEL[r.view] ?? r.view}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <ImageIcon className="h-6 w-6 text-ink-300" />
                  )}
                </div>
                <div className="px-2 py-1.5">
                  <div className="text-[12px] font-medium text-ink-800">
                    {VIEW_LABEL[r.view] ?? r.view}
                  </div>
                  {r.status === "error" && (
                    <div
                      className="truncate text-[10px] text-accent-rose"
                      title={r.error}
                    >
                      {r.error}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
