import { ImageIcon, RotateCcw, Shuffle, X } from "lucide-react";
import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import PageHeader from "../components/ui/PageHeader";
import { useApi } from "../lib/customerApi";
import {
  carDatabaseGalleryUrl,
  carThumbApiUrl,
  GALLERY_COLORS,
  GALLERY_VIEWS,
  type GalleryResponse,
  type GalleryRow,
} from "../lib/carDatabaseApi";
import { TEXT_IN } from "../lib/carDatabaseUi";

type Bg = "weiss" | "hell" | "dunkel" | "transparent";
type Fit = "contain" | "cover";
type Aspect = "square" | "4/3" | "16/9";

type Settings = {
  view: string;
  color: string;
  count: number;
  columns: number;
  aspect: Aspect;
  fit: Fit;
  bg: Bg;
  labels: boolean;
  border: boolean;
  rounded: boolean;
  random: boolean;
  marke: string;
  jahrMin: string;
  jahrMax: string;
};

const DEFAULTS: Settings = {
  view: "front_left",
  color: "",
  count: 24,
  columns: 4,
  aspect: "4/3",
  fit: "contain",
  bg: "weiss",
  labels: true,
  border: true,
  rounded: true,
  random: true,
  marke: "",
  jahrMin: "",
  jahrMax: "",
};

const STORAGE_KEY = "cardb_gallery_v1";

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return DEFAULTS;
  }
}

const ASPECT_CLASS: Record<Aspect, string> = {
  square: "aspect-square",
  "4/3": "aspect-[4/3]",
  "16/9": "aspect-[16/9]",
};

const CHECKER: CSSProperties = {
  backgroundColor: "#fff",
  backgroundImage:
    "linear-gradient(45deg,#e5e7eb 25%,transparent 25%),linear-gradient(-45deg,#e5e7eb 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e5e7eb 75%),linear-gradient(-45deg,transparent 75%,#e5e7eb 75%)",
  backgroundSize: "16px 16px",
  backgroundPosition: "0 0,0 8px,8px -8px,-8px 0",
};

function bgClass(bg: Bg): string {
  return bg === "dunkel"
    ? "bg-ink-900"
    : bg === "hell"
      ? "bg-ink-50"
      : bg === "transparent"
        ? ""
        : "bg-white";
}

export default function CarDatabaseGalleryPage() {
  const [s, setS] = useState<Settings>(loadSettings);
  const [seed, setSeed] = useState(1);
  const [lightbox, setLightbox] = useState<{
    car: GalleryRow;
    farbe: string;
  } | null>(null);

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) =>
    setS((prev) => ({ ...prev, [k]: v }));

  // Einstellungen merken.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    } catch {
      /* ignore */
    }
  }, [s]);

  const url = useMemo(
    () =>
      carDatabaseGalleryUrl({
        marke: s.marke,
        jahrMin: s.jahrMin,
        jahrMax: s.jahrMax,
        view: s.view,
        random: s.random,
        limit: s.count,
        seed,
      }),
    [s.marke, s.jahrMin, s.jahrMax, s.view, s.random, s.count, seed],
  );
  const api = useApi<GalleryResponse>(url);
  const rows = api.data?.rows ?? [];

  // Esc schließt die Lightbox.
  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [lightbox]);

  const tileBgClass = bgClass(s.bg);
  const tileBgStyle = s.bg === "transparent" ? CHECKER : undefined;

  return (
    <div>
      <PageHeader
        eyebrow="Car Database"
        title="Galerie"
        description="Fahrzeuge als anpassbares Raster — standardmäßig zufällige Autos in der Ansicht Vorne links. Ansicht, Layout, Hintergrund und vieles mehr frei einstellbar."
      />

      {/* Steuerpanel */}
      <div className="mb-4 rounded-lg border border-hair bg-paper p-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          <Field label="Ansicht">
            <select
              value={s.view}
              onChange={(e) => set("view", e.target.value)}
              className={TEXT_IN}
            >
              {GALLERY_VIEWS.map((v) => (
                <option key={v.value} value={v.value}>
                  {v.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Farbe">
            <select
              value={s.color}
              onChange={(e) => set("color", e.target.value)}
              className={TEXT_IN}
            >
              {GALLERY_COLORS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Anzahl">
            <select
              value={s.count}
              onChange={(e) => set("count", Number(e.target.value))}
              className={TEXT_IN}
            >
              {[12, 24, 36, 48, 60].map((n) => (
                <option key={n} value={n}>
                  {n} Autos
                </option>
              ))}
            </select>
          </Field>
          <Field label="Spalten">
            <select
              value={s.columns}
              onChange={(e) => set("columns", Number(e.target.value))}
              className={TEXT_IN}
            >
              {[2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Seitenverhältnis">
            <select
              value={s.aspect}
              onChange={(e) => set("aspect", e.target.value as Aspect)}
              className={TEXT_IN}
            >
              <option value="4/3">4 : 3</option>
              <option value="16/9">16 : 9</option>
              <option value="square">Quadrat</option>
            </select>
          </Field>
          <Field label="Bildanpassung">
            <select
              value={s.fit}
              onChange={(e) => set("fit", e.target.value as Fit)}
              className={TEXT_IN}
            >
              <option value="contain">Einpassen</option>
              <option value="cover">Füllen</option>
            </select>
          </Field>
          <Field label="Hintergrund">
            <select
              value={s.bg}
              onChange={(e) => set("bg", e.target.value as Bg)}
              className={TEXT_IN}
            >
              <option value="weiss">Weiß</option>
              <option value="hell">Hell</option>
              <option value="dunkel">Dunkel</option>
              <option value="transparent">Transparent (Schachbrett)</option>
            </select>
          </Field>
          <Field label="Marke (genau)">
            <input
              value={s.marke}
              onChange={(e) => set("marke", e.target.value)}
              placeholder="alle"
              className={TEXT_IN}
            />
          </Field>
          <Field label="Jahr von / bis">
            <div className="flex gap-2">
              <input
                value={s.jahrMin}
                onChange={(e) =>
                  set("jahrMin", e.target.value.replace(/[^0-9]/g, "").slice(0, 4))
                }
                placeholder="von"
                inputMode="numeric"
                className={TEXT_IN}
              />
              <input
                value={s.jahrMax}
                onChange={(e) =>
                  set("jahrMax", e.target.value.replace(/[^0-9]/g, "").slice(0, 4))
                }
                placeholder="bis"
                inputMode="numeric"
                className={TEXT_IN}
              />
            </div>
          </Field>
        </div>

        {/* Schalter + Aktionen */}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-hair pt-3">
          <Toggle
            label="Beschriftung"
            checked={s.labels}
            onChange={(v) => set("labels", v)}
          />
          <Toggle
            label="Rahmen"
            checked={s.border}
            onChange={(v) => set("border", v)}
          />
          <Toggle
            label="Ecken rund"
            checked={s.rounded}
            onChange={(v) => set("rounded", v)}
          />
          <Toggle
            label="Zufällig"
            checked={s.random}
            onChange={(v) => set("random", v)}
          />
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setS(DEFAULTS)}
              className="inline-flex items-center gap-1.5 rounded-md border border-hair bg-paper px-2.5 py-1.5 text-[12px] text-ink-600 hover:bg-ink-50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Zurücksetzen
            </button>
            <button
              type="button"
              onClick={() => setSeed((n) => n + 1)}
              disabled={!s.random}
              className="inline-flex items-center gap-1.5 rounded-md border border-brand-500/40 bg-brand-500/10 px-3 py-1.5 text-[12px] font-medium text-brand-700 hover:bg-brand-500/15 disabled:opacity-40"
              title={s.random ? "Neue Zufallsauswahl" : "Nur bei aktivem Zufall"}
            >
              <Shuffle className="h-3.5 w-3.5" />
              Würfeln
            </button>
          </div>
        </div>
      </div>

      {/* Galerie */}
      {api.loading && rows.length === 0 ? (
        <div className="py-16 text-center text-[12px] text-ink-400">
          Lädt Autos…
        </div>
      ) : rows.length === 0 ? (
        <div className="py-16 text-center text-[12px] text-ink-400">
          Keine Autos für diese Auswahl.
        </div>
      ) : (
        <div
          className="grid gap-3"
          style={{
            gridTemplateColumns: `repeat(${s.columns}, minmax(0, 1fr))`,
          }}
        >
          {rows.map((car, i) => {
            const farbe = s.color || car.farbe;
            return (
              <GalleryCard
                key={`${car.marke}-${car.modell}-${car.jahr}-${car.body}-${car.trim}-${i}`}
                car={car}
                farbe={farbe}
                view={s.view}
                aspectClass={ASPECT_CLASS[s.aspect]}
                fit={s.fit}
                bgClass={tileBgClass}
                bgStyle={tileBgStyle}
                labels={s.labels}
                border={s.border}
                rounded={s.rounded}
                onOpen={() => setLightbox({ car, farbe })}
              />
            );
          })}
        </div>
      )}

      <p className="mt-3 text-[11px] text-ink-400">
        {rows.length > 0 && `${rows.length} Autos angezeigt`}
        {s.color &&
          " · feste Farbe: nicht jedes Auto hat sie (sonst Platzhalter)"}
      </p>

      {api.error && (
        <p className="mt-3 text-[12px] text-accent-rose">{api.error}</p>
      )}

      {lightbox && (
        <GalleryLightbox
          car={lightbox.car}
          farbe={lightbox.farbe}
          view={s.view}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-ink-400">
        {label}
      </span>
      {children}
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-1.5 text-[12px] text-ink-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 rounded border-hair text-brand-600 focus:ring-0"
      />
      {label}
    </label>
  );
}

function GalleryCard({
  car,
  farbe,
  view,
  aspectClass,
  fit,
  bgClass: bgCls,
  bgStyle,
  labels,
  border,
  rounded,
  onOpen,
}: {
  car: GalleryRow;
  farbe: string;
  view: string;
  aspectClass: string;
  fit: Fit;
  bgClass: string;
  bgStyle?: CSSProperties;
  labels: boolean;
  border: boolean;
  rounded: boolean;
  onOpen: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const url = carThumbApiUrl({ ...car, farbe }, { view, width: 480 });
  return (
    <figure
      className={`overflow-hidden bg-paper ${border ? "border border-hair" : ""} ${
        rounded ? "rounded-lg" : ""
      }`}
    >
      <button
        type="button"
        onClick={onOpen}
        className={`relative block w-full ${aspectClass} ${bgCls}`}
        style={bgStyle}
        title="Groß ansehen"
      >
        {url && !failed ? (
          <img
            src={url}
            alt={`${car.marke} ${car.modell}`}
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
            className={`h-full w-full ${
              fit === "cover" ? "object-cover" : "object-contain"
            }`}
          />
        ) : (
          <span className="grid h-full w-full place-items-center">
            <ImageIcon className="h-6 w-6 text-ink-300" />
          </span>
        )}
      </button>
      {labels && (
        <figcaption className="truncate px-2 py-1.5 text-[11px]">
          <span className="font-medium text-ink-800">
            {car.marke} {car.modell}
          </span>
          <span className="text-ink-400"> · {car.jahr}</span>
        </figcaption>
      )}
    </figure>
  );
}

function GalleryLightbox({
  car,
  farbe,
  view,
  onClose,
}: {
  car: GalleryRow;
  farbe: string;
  view: string;
  onClose: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const url = carThumbApiUrl({ ...car, farbe }, { view, width: 1400 });
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-ink-900/85 p-6"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-md bg-white/10 text-white hover:bg-white/20"
        aria-label="Schließen"
      >
        <X className="h-5 w-5" />
      </button>
      <div
        className="flex max-h-[90vh] max-w-[92vw] flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        {url && !failed ? (
          <img
            src={url}
            alt={`${car.marke} ${car.modell}`}
            onError={() => setFailed(true)}
            className="max-h-[84vh] max-w-[92vw] rounded-lg object-contain"
          />
        ) : (
          <div className="rounded-lg bg-paper px-10 py-14 text-center text-[13px] text-ink-500">
            Für diese Auswahl ist kein Bild verfügbar.
          </div>
        )}
        <div className="mt-2 text-center text-[12px] text-white/80">
          {car.marke} {car.modell} · {car.jahr}
          {farbe && farbe !== "default" ? ` · ${farbe}` : ""}
        </div>
      </div>
    </div>
  );
}
