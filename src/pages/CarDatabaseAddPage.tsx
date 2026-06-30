import {
  AlertTriangle,
  ImageIcon,
  Info,
  Loader2,
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

/* ---------- Tab A: Auto erstellen (Text → Bild) über kie.ai ---------- */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type ViewResult = {
  state: "waiting" | "done" | "error";
  imageUrl?: string;
  error?: string;
};

/** Erzeugt EINE Ansicht über kie.ai (createTask → pollen). Liefert die Bild-URL. */
async function generateView(
  car: {
    marke: string;
    modell: string;
    jahr: string;
    body?: string;
    trim?: string;
    view: string;
  },
  refImages: string[],
): Promise<{ imageUrl: string | null; error: string | null }> {
  const res = await fetch("/api/databases/car-generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ ...car, images: refImages }),
  });
  const j = (await res.json().catch(() => ({}))) as {
    taskId?: string;
    error?: string;
  };
  if (!res.ok || !j.taskId) {
    return { imageUrl: null, error: j.error || `HTTP ${res.status}` };
  }
  // Status pollen, bis fertig — Wall-Clock-Budget ~180 s (nano-banana kann bei
  // Bild→Bild deutlich über 90 s brauchen; sonst gingen langsame Bilder verloren).
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    await sleep(3000);
    const pr = await fetch(
      `/api/databases/car-generate?taskId=${encodeURIComponent(j.taskId)}`,
      { credentials: "include" },
    );
    const pj = (await pr.json().catch(() => ({}))) as {
      state?: string;
      imageUrl?: string | null;
      error?: string | null;
    };
    if (pj.state === "success") {
      return {
        imageUrl: pj.imageUrl || null,
        error: pj.imageUrl ? null : "Kein Bild erhalten.",
      };
    }
    if (pj.state === "fail") {
      return { imageUrl: null, error: pj.error || "Generierung fehlgeschlagen." };
    }
  }
  return { imageUrl: null, error: "Zeitüberschreitung (>3 Min)." };
}

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
  const [busy, setBusy] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, ViewResult>>({});
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const yearsParsed = useMemo(() => parseYears(jahr), [jahr]);

  // Generierte Ansichten ins NEUE System übernehmen (R2 + fahrzeugliste,
  // kontrolliert=0) → erscheinen dann in der neuen Kontroll-Ansicht.
  const saveToControl = async () => {
    if (saving) return;
    const items = orderedViews
      .filter((v) => results[v]?.state === "done" && results[v]?.imageUrl)
      .map((v) => ({ view: v, imageUrl: results[v].imageUrl as string }));
    if (items.length === 0) return;
    setSaving(true);
    setSaveMsg(null);
    const jahrForGen =
      promptJahr.trim() || String(yearsParsed.years[0] || "") || jahr.trim();
    try {
      const res = await fetch("/api/databases/car-generate-save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          marke: marke.trim(),
          modell: modell.trim(),
          jahr: jahrForGen,
          body: body.trim(),
          trim: trim.trim(),
          farbe: "default",
          items,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        saved?: number;
        error?: string;
      };
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setSaveMsg(
        `${j.saved ?? 0} Ansicht(en) ins neue System übernommen — jetzt in „Kontrolle (neu)" zur Freigabe.`,
      );
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  };

  const orderedViews = useMemo(
    () => [...EXTERIOR_VIEWS, ...INTERIOR_VIEWS].filter((v) => views.has(v)),
    [views],
  );

  const toggleView = (v: string) =>
    setViews((prev) => {
      const next = new Set(prev);
      if (next.has(v)) next.delete(v);
      else next.add(v);
      return next;
    });

  const generate = async () => {
    if (busy) return;
    if (!marke.trim() || !modell.trim()) {
      setGenError("Marke und Modell sind erforderlich.");
      return;
    }
    if (orderedViews.length === 0) {
      setGenError("Mindestens eine Ansicht wählen.");
      return;
    }
    setBusy(true);
    setGenError(null);
    const jahrForGen =
      promptJahr.trim() ||
      String(yearsParsed.years[0] || "") ||
      jahr.trim();
    const car = {
      marke: marke.trim(),
      modell: modell.trim(),
      jahr: jahrForGen,
      body: body.trim(),
      trim: trim.trim(),
    };
    setResults(
      Object.fromEntries(
        orderedViews.map((v) => [v, { state: "waiting" } as ViewResult]),
      ),
    );
    try {
      // 1) Erste Ansicht (Text→Bild) — dient als Referenz für die übrigen.
      const first = orderedViews[0];
      const r0 = await generateView({ ...car, view: first }, []);
      setResults((prev) => ({
        ...prev,
        [first]: r0.imageUrl
          ? { state: "done", imageUrl: r0.imageUrl }
          : { state: "error", error: r0.error || "" },
      }));
      const refUrl = r0.imageUrl;
      // 2) Übrige Ansichten parallel (Bild→Bild mit Referenz = konsistent).
      await Promise.all(
        orderedViews.slice(1).map(async (v) => {
          const r = await generateView({ ...car, view: v }, refUrl ? [refUrl] : []);
          setResults((prev) => ({
            ...prev,
            [v]: r.imageUrl
              ? { state: "done", imageUrl: r.imageUrl }
              : { state: "error", error: r.error || "" },
          }));
        }),
      );
    } catch (e) {
      setGenError(e instanceof Error ? e.message : "Fehler bei der Generierung.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <div className="mb-4 flex items-start gap-2 rounded-lg border border-hair bg-ink-50/60 px-4 py-3 text-[12.5px] text-ink-600">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Generierung läuft über <strong>kie.ai (nano-banana)</strong>. Die erste
          Ansicht entsteht aus Text, die übrigen werden für ein konsistentes Auto
          daraus abgeleitet. <strong>Nur Vorschau</strong> — es wird noch nichts
          in der Datenbank gespeichert.
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
                  : `→ generiert für ${yearsParsed.years[0] ?? ""}${
                      yearsParsed.years.length > 1
                        ? ` (mehrere Jahre folgen später)`
                        : ""
                    }`}
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
            disabled={busy}
            onClick={() => void generate()}
            className="inline-flex items-center gap-1.5 rounded-md bg-ink-900 px-4 py-2 text-[13px] font-medium text-white hover:bg-ink-800 disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {busy
              ? "Generiere…"
              : `Generieren · ${orderedViews.length} Ansicht${
                  orderedViews.length === 1 ? "" : "en"
                }`}
          </button>
          {genError && (
            <p className="mt-2 text-[11.5px] text-accent-rose">{genError}</p>
          )}
          <p className="mt-2 text-[11px] text-ink-400">
            Kann 1–3 Min dauern (erste Ansicht, dann übrige parallel). Erst
            Vorschau — mit „In Kontrolle übernehmen" gehen sie ins neue System.
          </p>
        </div>

        {orderedViews.some((v) => results[v]) && (
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {orderedViews.map((v) => {
              const r = results[v];
              if (!r) return null;
              return (
                <div
                  key={v}
                  className="overflow-hidden rounded-md border border-hair bg-white"
                >
                  <div className="relative grid aspect-[4/3] w-full place-items-center bg-ink-50">
                    {r.state === "done" && r.imageUrl ? (
                      <img
                        src={r.imageUrl}
                        alt={v}
                        loading="lazy"
                        className="h-full w-full object-contain"
                      />
                    ) : r.state === "error" ? (
                      <div className="px-2 text-center text-[10px] text-accent-rose">
                        Fehler
                        {r.error ? `: ${r.error}` : ""}
                      </div>
                    ) : (
                      <Loader2 className="h-5 w-5 animate-spin text-ink-300" />
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-1 px-2 py-1">
                    <span className="truncate text-[11px] font-medium text-ink-700">
                      {VIEW_LABEL[v] || v}
                    </span>
                    {r.state === "done" && r.imageUrl && (
                      <a
                        href={r.imageUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 text-[10px] text-brand-600 hover:underline"
                      >
                        öffnen
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {orderedViews.some((v) => results[v]?.state === "done") && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={saving || busy}
              onClick={() => void saveToControl()}
              className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {saving ? "Übernehme…" : "In Kontrolle übernehmen (neues System)"}
            </button>
            {saveMsg && (
              <span className="text-[12px] text-ink-600">{saveMsg}</span>
            )}
          </div>
        )}
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
