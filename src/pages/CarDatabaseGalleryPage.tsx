import {
  ArrowDown,
  ArrowUp,
  ImageIcon,
  Plus,
  RotateCcw,
  Search,
  Shuffle,
  X,
} from "lucide-react";
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
  carDatabaseListUrl,
  carThumbApiUrl,
  GALLERY_COLORS,
  GALLERY_VIEWS,
  type CarListResponse,
  type CarRow,
  type GalleryResponse,
} from "../lib/carDatabaseApi";
import { TEXT_IN } from "../lib/carDatabaseUi";

type Bg = "weiss" | "hell" | "dunkel" | "transparent";
type Fit = "contain" | "cover";
type Aspect = "square" | "4/3" | "16/9";
type Mode = "auto" | "manual";

/** Minimale Auto-Identität (reicht für Thumbnail-Proxy + Anzeige). */
type CarId = {
  marke: string;
  modell: string;
  jahr: number;
  body: string;
  trim: string;
};

/** Ein manuell ausgewähltes Auto mit eigener Ansicht. */
type ManualItem = CarId & { farbe: string; view: string; id: string };

type Settings = {
  mode: Mode;
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
  manual: ManualItem[];
};

const DEFAULTS: Settings = {
  mode: "auto",
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
  manual: [],
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

function newId(): string {
  return `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

function viewLabel(v: string): string {
  return GALLERY_VIEWS.find((x) => x.value === v)?.label ?? v;
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
    car: CarId;
    farbe: string;
    view: string;
  } | null>(null);

  const isManual = s.mode === "manual";

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) =>
    setS((prev) => ({ ...prev, [k]: v }));

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    } catch {
      /* ignore */
    }
  }, [s]);

  // Zufalls-/Filter-Auswahl nur im Auto-Modus laden (manuell = kein Fetch).
  const autoUrl = useMemo(
    () =>
      isManual
        ? null
        : carDatabaseGalleryUrl({
            marke: s.marke,
            jahrMin: s.jahrMin,
            jahrMax: s.jahrMax,
            view: s.view,
            random: s.random,
            limit: s.count,
            seed,
          }),
    [isManual, s.marke, s.jahrMin, s.jahrMax, s.view, s.random, s.count, seed],
  );
  const api = useApi<GalleryResponse>(autoUrl);

  // Esc schließt Lightbox.
  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [lightbox]);

  // Manuelle Auswahl bearbeiten.
  const addCar = (r: CarRow) =>
    setS((prev) => ({
      ...prev,
      manual: [
        ...prev.manual,
        {
          marke: r.marke,
          modell: r.modell,
          jahr: r.jahr,
          body: r.body,
          trim: r.trim,
          farbe: r.farbe,
          view: prev.view,
          id: newId(),
        },
      ],
    }));
  const removeItem = (id: string) =>
    setS((prev) => ({
      ...prev,
      manual: prev.manual.filter((m) => m.id !== id),
    }));
  const setItemView = (id: string, view: string) =>
    setS((prev) => ({
      ...prev,
      manual: prev.manual.map((m) => (m.id === id ? { ...m, view } : m)),
    }));
  const moveItem = (id: string, dir: -1 | 1) =>
    setS((prev) => {
      const i = prev.manual.findIndex((m) => m.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.manual.length) return prev;
      const next = [...prev.manual];
      [next[i], next[j]] = [next[j], next[i]];
      return { ...prev, manual: next };
    });

  const tileBgClass = bgClass(s.bg);
  const tileBgStyle = s.bg === "transparent" ? CHECKER : undefined;

  const displayItems = isManual
    ? s.manual.map((m) => ({
        key: m.id,
        car: m as CarId,
        farbe: s.color || m.farbe,
        view: m.view || s.view,
      }))
    : (api.data?.rows ?? []).map((r, i) => ({
        key: `${r.marke}-${r.modell}-${r.jahr}-${r.body}-${r.trim}-${i}`,
        car: r as CarId,
        farbe: s.color || r.farbe,
        view: s.view,
      }));

  return (
    <div>
      <PageHeader
        eyebrow="Car Database"
        title="Galerie"
        description="Fahrzeuge als anpassbares Raster: zufällig/gefiltert oder als eigene Auswahl, bei der du jedes Auto und seine Ansicht selbst bestimmst."
      />

      {/* Modus-Umschalter */}
      <div className="mb-3 inline-flex rounded-lg border border-hair bg-paper p-0.5">
        <ModeBtn
          active={!isManual}
          onClick={() => set("mode", "auto")}
          label="Zufällig & Filter"
        />
        <ModeBtn
          active={isManual}
          onClick={() => set("mode", "manual")}
          label="Eigene Auswahl"
        />
      </div>

      {/* Steuerpanel */}
      <div className="mb-4 rounded-lg border border-hair bg-paper p-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          <Field label={isManual ? "Ansicht (Standard f. neue)" : "Ansicht"}>
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
          {!isManual && (
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
          )}
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
          {!isManual && (
            <>
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
                      set(
                        "jahrMin",
                        e.target.value.replace(/[^0-9]/g, "").slice(0, 4),
                      )
                    }
                    placeholder="von"
                    inputMode="numeric"
                    className={TEXT_IN}
                  />
                  <input
                    value={s.jahrMax}
                    onChange={(e) =>
                      set(
                        "jahrMax",
                        e.target.value.replace(/[^0-9]/g, "").slice(0, 4),
                      )
                    }
                    placeholder="bis"
                    inputMode="numeric"
                    className={TEXT_IN}
                  />
                </div>
              </Field>
            </>
          )}
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
          {!isManual && (
            <Toggle
              label="Zufällig"
              checked={s.random}
              onChange={(v) => set("random", v)}
            />
          )}
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setS({ ...DEFAULTS, manual: s.manual, mode: s.mode })
              }
              className="inline-flex items-center gap-1.5 rounded-md border border-hair bg-paper px-2.5 py-1.5 text-[12px] text-ink-600 hover:bg-ink-50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Ansicht zurücksetzen
            </button>
            {!isManual && (
              <button
                type="button"
                onClick={() => setSeed((n) => n + 1)}
                disabled={!s.random}
                className="inline-flex items-center gap-1.5 rounded-md border border-brand-500/40 bg-brand-500/10 px-3 py-1.5 text-[12px] font-medium text-brand-700 hover:bg-brand-500/15 disabled:opacity-40"
                title={
                  s.random ? "Neue Zufallsauswahl" : "Nur bei aktivem Zufall"
                }
              >
                <Shuffle className="h-3.5 w-3.5" />
                Würfeln
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Manuelle Auswahl */}
      {isManual && (
        <ManualPanel
          items={s.manual}
          defaultView={s.view}
          onAdd={addCar}
          onRemove={removeItem}
          onSetView={setItemView}
          onMove={moveItem}
          onClear={() => set("manual", [])}
        />
      )}

      {/* Galerie */}
      {!isManual && api.loading && displayItems.length === 0 ? (
        <div className="py-16 text-center text-[12px] text-ink-400">
          Lädt Autos…
        </div>
      ) : displayItems.length === 0 ? (
        <div className="py-16 text-center text-[12px] text-ink-400">
          {isManual
            ? "Noch keine Autos ausgewählt – oben suchen und hinzufügen."
            : "Keine Autos für diese Auswahl."}
        </div>
      ) : (
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: `repeat(${s.columns}, minmax(0, 1fr))` }}
        >
          {displayItems.map((it) => (
            <GalleryCard
              key={it.key}
              car={it.car}
              farbe={it.farbe}
              view={it.view}
              aspectClass={ASPECT_CLASS[s.aspect]}
              fit={s.fit}
              bgClass={tileBgClass}
              bgStyle={tileBgStyle}
              labels={s.labels}
              border={s.border}
              rounded={s.rounded}
              onOpen={() =>
                setLightbox({ car: it.car, farbe: it.farbe, view: it.view })
              }
            />
          ))}
        </div>
      )}

      <p className="mt-3 text-[11px] text-ink-400">
        {displayItems.length > 0 && `${displayItems.length} Autos angezeigt`}
        {s.color &&
          " · feste Farbe: nicht jedes Auto hat sie (sonst Platzhalter)"}
      </p>

      {api.error && !isManual && (
        <p className="mt-3 text-[12px] text-accent-rose">{api.error}</p>
      )}

      {lightbox && (
        <GalleryLightbox
          car={lightbox.car}
          farbe={lightbox.farbe}
          view={lightbox.view}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}

function ModeBtn({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors ${
        active ? "bg-ink-900 text-white" : "text-ink-500 hover:text-ink-900"
      }`}
    >
      {label}
    </button>
  );
}

function ManualPanel({
  items,
  defaultView,
  onAdd,
  onRemove,
  onSetView,
  onMove,
  onClear,
}: {
  items: ManualItem[];
  defaultView: string;
  onAdd: (r: CarRow) => void;
  onRemove: (id: string) => void;
  onSetView: (id: string, view: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onClear: () => void;
}) {
  const [qIn, setQIn] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setQ(qIn.trim()), 350);
    return () => clearTimeout(t);
  }, [qIn]);

  const searchApi = useApi<CarListResponse>(
    q.length >= 2 ? carDatabaseListUrl({ q, limit: 8 }) : null,
  );
  const results = searchApi.data?.rows ?? [];

  return (
    <div className="mb-4 rounded-lg border border-hair bg-paper p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[12px] font-medium uppercase tracking-[0.1em] text-ink-400">
          Eigene Auswahl ({items.length})
        </h3>
        {items.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="text-[11px] text-ink-500 hover:text-accent-rose"
          >
            Alle entfernen
          </button>
        )}
      </div>

      {/* Suche + hinzufügen */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
        <input
          value={qIn}
          onChange={(e) => setQIn(e.target.value)}
          placeholder="Auto suchen (Marke, Modell, Jahr) und hinzufügen…"
          className={`${TEXT_IN} pl-7`}
        />
        {q.length >= 2 && (
          <div className="absolute z-10 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-hair bg-paper shadow-lg">
            {searchApi.loading && results.length === 0 ? (
              <div className="px-3 py-2 text-[12px] text-ink-400">Suche…</div>
            ) : results.length === 0 ? (
              <div className="px-3 py-2 text-[12px] text-ink-400">
                Nichts gefunden.
              </div>
            ) : (
              results.map((r, i) => (
                <button
                  key={`${r.marke}-${r.modell}-${r.jahr}-${i}`}
                  type="button"
                  onClick={() => onAdd(r)}
                  className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-ink-50"
                >
                  <MiniThumb car={r} farbe={r.farbe} view={defaultView} />
                  <span className="min-w-0 flex-1 truncate text-[12px]">
                    <span className="font-medium text-ink-800">
                      {r.marke} {r.modell}
                    </span>
                    <span className="text-ink-400">
                      {" "}
                      {r.jahr} · {r.body} · {r.trim}
                    </span>
                  </span>
                  <Plus className="h-4 w-4 shrink-0 text-brand-600" />
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Ausgewählte Autos */}
      {items.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {items.map((m, i) => (
            <div
              key={m.id}
              className="flex items-center gap-2 rounded-md border border-hair bg-white px-2 py-1.5"
            >
              <span className="w-5 shrink-0 text-center text-[11px] tabular-nums text-ink-400">
                {i + 1}
              </span>
              <MiniThumb car={m} farbe={m.farbe} view={m.view} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] font-medium text-ink-800">
                  {m.marke} {m.modell}
                </div>
                <div className="truncate text-[10px] text-ink-400">
                  {m.jahr} · {m.body} · {m.trim}
                </div>
              </div>
              <select
                value={m.view}
                onChange={(e) => onSetView(m.id, e.target.value)}
                className="shrink-0 rounded border border-hair bg-white px-1.5 py-1 text-[11px] text-ink-700 focus:outline-none"
                title="Ansicht dieses Autos"
              >
                {GALLERY_VIEWS.map((v) => (
                  <option key={v.value} value={v.value}>
                    {v.label}
                  </option>
                ))}
              </select>
              <div className="flex shrink-0 items-center">
                <IconBtn
                  onClick={() => onMove(m.id, -1)}
                  disabled={i === 0}
                  aria="Nach oben"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </IconBtn>
                <IconBtn
                  onClick={() => onMove(m.id, 1)}
                  disabled={i === items.length - 1}
                  aria="Nach unten"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </IconBtn>
                <IconBtn onClick={() => onRemove(m.id)} aria="Entfernen">
                  <X className="h-3.5 w-3.5" />
                </IconBtn>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function IconBtn({
  onClick,
  disabled,
  aria,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  aria: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={aria}
      title={aria}
      className="inline-flex h-7 w-7 items-center justify-center rounded text-ink-500 hover:bg-ink-100 hover:text-ink-900 disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}

function MiniThumb({
  car,
  farbe,
  view,
}: {
  car: CarId;
  farbe: string;
  view: string;
}) {
  const [failed, setFailed] = useState(false);
  const url = carThumbApiUrl({ ...car, farbe }, { view, width: 96 });
  if (!url || failed) {
    return (
      <span className="grid h-9 w-12 shrink-0 place-items-center rounded border border-hair bg-ink-50">
        <ImageIcon className="h-3.5 w-3.5 text-ink-300" />
      </span>
    );
  }
  return (
    <img
      src={url}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className="h-9 w-12 shrink-0 rounded border border-hair bg-white object-contain"
    />
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
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
  car: CarId;
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
          <span className="text-ink-400">
            {" "}
            · {car.jahr} · {viewLabel(view)}
          </span>
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
  car: CarId;
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
          {car.marke} {car.modell} · {car.jahr} · {viewLabel(view)}
          {farbe && farbe !== "default" ? ` · ${farbe}` : ""}
        </div>
      </div>
    </div>
  );
}
