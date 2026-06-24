import {
  Car,
  Check,
  ChevronLeft,
  ChevronRight,
  Code2,
  ImageIcon,
  Layers,
  Maximize2,
  Minimize2,
  Palette,
  Rotate3d,
  Search,
  Sparkles,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useApi } from "../lib/customerApi";
import {
  carDatabaseDetailUrl,
  carDatabaseGalleryUrl,
  carDatabaseListUrl,
  carThumbApiUrl,
  type CarDetailResponse,
  type CarListResponse,
  type CarRow,
  type GalleryResponse,
} from "../lib/carDatabaseApi";

type CarId = {
  marke: string;
  modell: string;
  jahr: number;
  body: string;
  trim: string;
};

const FEATURED: CarId[] = [
  { marke: "BMW", modell: "X3", jahr: 2024, body: "Basis", trim: "base" },
  { marke: "Tesla", modell: "Model_S", jahr: 2021, body: "Basis", trim: "base" },
  { marke: "Audi", modell: "e-tron", jahr: 2022, body: "Basis", trim: "base" },
  { marke: "BMW", modell: "i7", jahr: 2022, body: "Basis", trim: "base" },
  {
    marke: "Tesla",
    modell: "Cybertruck",
    jahr: 2023,
    body: "Basis",
    trim: "base",
  },
  { marke: "BMW", modell: "iX", jahr: 2021, body: "Basis", trim: "base" },
];

/**
 * Fallback-Showroom „Baujahr 2010" — wird genutzt, falls die Galerie-API
 * (noch) keine 2010er-Fahrzeuge liefert (neue DB evtl. leer). Sobald die DB
 * gefüllt ist, ersetzt die Live-Abfrage diese Liste automatisch.
 */
const SHOWROOM_2010: CarId[] = [
  { marke: "Volkswagen", modell: "Golf", jahr: 2010, body: "Basis", trim: "base" },
  { marke: "BMW", modell: "5er", jahr: 2010, body: "Basis", trim: "base" },
  { marke: "Audi", modell: "A4", jahr: 2010, body: "Basis", trim: "base" },
  { marke: "Mercedes-Benz", modell: "C_Klasse", jahr: 2010, body: "Basis", trim: "base" },
  { marke: "Ford", modell: "Focus", jahr: 2010, body: "Basis", trim: "base" },
  { marke: "Opel", modell: "Astra", jahr: 2010, body: "Basis", trim: "base" },
  { marke: "Toyota", modell: "Corolla", jahr: 2010, body: "Basis", trim: "base" },
  { marke: "Volkswagen", modell: "Passat", jahr: 2010, body: "Basis", trim: "base" },
  { marke: "Audi", modell: "A6", jahr: 2010, body: "Basis", trim: "base" },
  { marke: "BMW", modell: "X5", jahr: 2010, body: "Basis", trim: "base" },
];

function sameCarId(a: CarId, b: CarId): boolean {
  return (
    a.marke === b.marke &&
    a.modell === b.modell &&
    a.jahr === b.jahr &&
    a.body === b.body &&
    a.trim === b.trim
  );
}

/** 360°-Reihenfolge der 8 Außen-Ansichten (im Uhrzeigersinn). */
const SPIN = [
  "front",
  "front_left",
  "left",
  "rear_left",
  "rear",
  "rear_right",
  "right",
  "front_right",
];
const INTERIOR = ["dashboard", "center_console"];

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

const COLOR_HEX: Record<string, string> = {
  default: "#9aa3ad",
  black: "#1b1b1d",
  white: "#e9ebee",
  blue: "#1d4ed8",
  orange: "#ea580c",
  wine_red: "#7c2d3a",
  red: "#dc2626",
  silver: "#c4c8cd",
  grey: "#6b7280",
  gray: "#6b7280",
  green: "#15803d",
  yellow: "#eab308",
};
const COLOR_LABEL: Record<string, string> = {
  default: "Original",
  black: "Schwarz",
  white: "Weiß",
  blue: "Blau",
  orange: "Orange",
  wine_red: "Weinrot",
};

function colorHex(c: string): string {
  return COLOR_HEX[c.toLowerCase()] ?? "#9aa3ad";
}
function colorLabel(c: string): string {
  return COLOR_LABEL[c.toLowerCase()] ?? c.charAt(0).toUpperCase() + c.slice(1);
}
function prettyModel(s: string): string {
  return s.replace(/_/g, " ");
}

const CHECKER: CSSProperties = {
  backgroundColor: "#fff",
  backgroundImage:
    "linear-gradient(45deg,#e2e5ea 25%,transparent 25%),linear-gradient(-45deg,#e2e5ea 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e2e5ea 75%),linear-gradient(-45deg,transparent 75%,#e2e5ea 75%)",
  backgroundSize: "22px 22px",
  backgroundPosition: "0 0,0 11px,11px -11px,-11px 0",
};

type BgMode = "showroom" | "studio" | "transparent";

function stageStyle(bg: BgMode): CSSProperties {
  if (bg === "transparent") return CHECKER;
  if (bg === "studio")
    return {
      background:
        "radial-gradient(120% 90% at 50% 18%, #2b313c 0%, #1a1e26 60%, #0f1218 100%)",
    };
  return {
    background:
      "radial-gradient(120% 90% at 50% 15%, #ffffff 0%, #f3f5f8 55%, #e6eaf0 100%)",
  };
}

type ImgFormat = "png" | "jpeg" | "webp" | "avif";
/** Ausgabe-Optionen der API, die der Viewer demonstriert. */
type OutOptions = {
  format: ImgFormat;
  shadow: boolean;
  transparent: boolean;
  width: number;
  height: number | null;
  watermark: boolean;
};

const FORMATS: ImgFormat[] = ["png", "jpeg", "webp", "avif"];

/** Größen-Presets (zeigt: Breite & Höhe sind anfragbar). */
const SIZE_PRESETS: { label: string; w: number; h: number | null }[] = [
  { label: "Auto", w: 900, h: null },
  { label: "600", w: 600, h: null },
  { label: "1600", w: 1600, h: null },
  { label: "1:1 · 1000", w: 1000, h: 1000 },
  { label: "16:9 · 1280", w: 1280, h: 720 },
];

/**
 * Bild-URL im Hintergrund vorladen (wärmt Browser- und Edge-Cache vor, bevor
 * der Nutzer klickt). Eine sitzungsweite Menge verhindert doppelte Anfragen
 * für dieselbe URL.
 */
const preloadedUrls = new Set<string>();
function preloadImage(url: string | null) {
  if (!url || preloadedUrls.has(url)) return;
  preloadedUrls.add(url);
  const img = new Image();
  img.src = url;
}

export default function CarDatabaseDemoPage() {
  const [car, setCar] = useState<CarId>(FEATURED[0]);
  const [color, setColor] = useState("white");
  const [view, setView] = useState("front_left");
  // Fester heller Studio-Hintergrund (Showroom). Transparent ist ein eigener
  // Schalter, der ausschließlich die Hero betrifft.
  const bg: BgMode = "showroom";
  const [transparent, setTransparent] = useState(false);
  // Neue API-Ausgabe-Optionen.
  const [format, setFormat] = useState<"png" | "jpeg" | "webp" | "avif">("png");
  const [shadow, setShadow] = useState(false);
  const [width, setWidth] = useState(900);
  const [height, setHeight] = useState<number | null>(null);
  // Wasserzeichen: Plan-/Key-Merkmal (Testkunden) → hier Vorschau-Overlay.
  const [watermark, setWatermark] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [showApi, setShowApi] = useState(false);
  const [zoom, setZoom] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Innen-Ansichten liegen nur unter Farbe „default" → Metadaten immer über
  // „default" laden (liefert alle Farben + alle Ansichten inkl. Innenraum).
  const detailApi = useApi<CarDetailResponse>(
    carDatabaseDetailUrl({ ...car, farbe: "default" }),
  );
  const detail = detailApi.data;

  // Nur Farben mit mindestens einem AKTIVEN (live gerenderten) Bild gelten als
  // „verfügbar". So tauchen Farben ohne echte Bilder (z. B. wine_red, das nur
  // in der DB registriert, aber nicht gerendert ist) gar nicht erst auf.
  const colors = useMemo(
    () =>
      (detail?.colors ?? [])
        .filter((c) => c.aktiv > 0)
        .map((c) => c.farbe),
    [detail],
  );
  const availViews = useMemo(
    () => new Set((detail?.views ?? []).map((v) => v.view.toLowerCase())),
    [detail],
  );
  const exterior = useMemo(
    () => SPIN.filter((v) => availViews.size === 0 || availViews.has(v)),
    [availViews],
  );
  const interior = useMemo(
    () => INTERIOR.filter((v) => availViews.has(v)),
    [availViews],
  );

  // Bei Auto-Wechsel: Farbe/Ansicht auf sinnvolle Defaults.
  useEffect(() => {
    setView("front_left");
  }, [car]);
  useEffect(() => {
    if (!detail) return;
    // Keine verfügbare Farbe → ehrlich die Standardfarbe zeigen.
    if (colors.length === 0) {
      if (color !== "default") setColor("default");
      return;
    }
    // Gewählte Farbe nicht (mehr) verfügbar → auf eine verfügbare wechseln.
    if (!colors.includes(color)) {
      setColor(colors.includes("white") ? "white" : colors[0]);
    }
  }, [detail, colors, color]);
  // Fehlt die aktuelle Außen-Ansicht beim gewählten Auto → erste verfügbare.
  useEffect(() => {
    if (!availViews.size) return;
    if (SPIN.includes(view) && !availViews.has(view)) {
      setView(exterior[0] ?? interior[0] ?? view);
    }
  }, [availViews, view, exterior, interior]);

  // Aktuelle Farbe: alle Ansichten vorladen → Ansichtswechsel ist sofort da.
  useEffect(() => {
    [...exterior, ...interior].forEach((v) =>
      preloadImage(
        carThumbApiUrl(
          { ...car, farbe: SPIN.includes(v) ? color : "default" },
          { view: v, width: 900 },
        ),
      ),
    );
  }, [car, color, exterior, interior]);

  // Aktuelle Ansicht in ALLEN Farben vorladen → Farbwechsel ist sofort da.
  useEffect(() => {
    if (!SPIN.includes(view)) return; // Innen-Ansichten sind farb-unabhängig
    colors.forEach((c) =>
      preloadImage(carThumbApiUrl({ ...car, farbe: c }, { view, width: 900 })),
    );
  }, [car, colors, view]);

  const title = `${car.marke} ${prettyModel(car.modell)}`;

  // Showroom „Baujahr 2010": 10 zufällige Autos live aus der Galerie-API,
  // mit fester Fallback-Liste, falls die DB (noch) nichts liefert.
  const showroomApi = useApi<GalleryResponse>(
    carDatabaseGalleryUrl({
      jahrMin: 2010,
      jahrMax: 2010,
      random: true,
      limit: 10,
    }),
  );
  const showroom2010 = useMemo<CarId[]>(() => {
    const rows = showroomApi.data?.rows ?? [];
    if (!rows.length) return SHOWROOM_2010;
    return rows.slice(0, 10).map((r) => ({
      marke: r.marke,
      modell: r.modell,
      jahr: r.jahr,
      body: r.body,
      trim: r.trim,
    }));
  }, [showroomApi.data]);

  const pick = (c: CarId) => {
    setCar(c);
    setPickerOpen(false);
  };

  // JPEG kann keine Transparenz → in dem Fall Freisteller ausschalten.
  const effTransparent = transparent && format !== "jpeg";
  const out: OutOptions = {
    format,
    shadow,
    transparent: effTransparent,
    width,
    height,
    watermark,
  };

  return (
    <div
      className={
        presenting
          ? "fixed inset-0 z-50 overflow-y-auto bg-white"
          : "overflow-hidden rounded-xl border border-hair"
      }
    >
      {/* Demo-Header (Vehicleimagery, kein fiktiver Händler) */}
      <header className="flex items-center justify-between gap-3 border-b border-hair bg-white px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-ink-900 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Live-Demo
          </span>
          <div className="leading-tight">
            <div className="text-[14px] font-semibold tracking-tight text-ink-900">
              Vehicleimagery
            </div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-ink-400">
              Fahrzeugbilder aus der API
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3 py-1.5 text-[12px] font-medium text-ink-700 hover:bg-ink-50"
          >
            <Search className="h-3.5 w-3.5" />
            Fahrzeug wählen
          </button>
          <button
            type="button"
            onClick={() => setPresenting((p) => !p)}
            className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-2.5 py-1.5 text-[12px] text-ink-600 hover:bg-ink-50"
            title={presenting ? "Präsentation beenden" : "Präsentationsmodus"}
          >
            {presenting ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">
              {presenting ? "Beenden" : "Präsentation"}
            </span>
          </button>
        </div>
      </header>

      <div className="bg-paper px-4 py-5 sm:px-6">
        {/* Demo-Intro statt Händler-Breadcrumb */}
        <div className="mb-5">
          <h2 className="font-display text-[22px] font-semibold leading-tight tracking-tight text-ink-900 sm:text-[26px]">
            Jedes Fahrzeug. Jede Farbe. Jede Perspektive.
          </h2>
          <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-ink-500">
            Alle Bilder werden live über eine einzige API geladen — in
            Studio-Qualität, farbtreu und freistellbar. Wähle Fahrzeug, Farbe,
            Ansicht und Hintergrund und sieh, wie das Bild in Echtzeit kommt.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          {/* Viewer */}
          <div>
            <Stage
              car={car}
              color={color}
              view={view}
              views={[...exterior, ...interior]}
              bg={effTransparent ? "transparent" : bg}
              out={out}
              onZoom={() => setZoom(true)}
              onToggleTransparent={() => setTransparent((t) => !t)}
              onPick={setView}
              loading={detailApi.loading && !detail}
            />

            {/* Ausgabe-Optionen — demonstriert die API-Funktionen live */}
            <div className="mt-3 space-y-2.5 rounded-xl border border-hair bg-white p-3">
              {/* Format + Schatten + Transparent */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-medium uppercase tracking-wider text-ink-400">
                  Format
                </span>
                <div className="inline-flex rounded-lg border border-hair bg-white p-0.5">
                  {FORMATS.map((f) => (
                    <SegBtn
                      key={f}
                      active={format === f}
                      onClick={() => {
                        setFormat(f);
                        if (f === "jpeg") setTransparent(false);
                      }}
                    >
                      {f.toUpperCase()}
                    </SegBtn>
                  ))}
                </div>
                <OptToggle
                  active={shadow}
                  onClick={() => setShadow((s) => !s)}
                  title="Schlagschatten von der API rendern lassen"
                >
                  Schatten
                </OptToggle>
                <OptToggle
                  active={effTransparent}
                  disabled={format === "jpeg"}
                  onClick={() => setTransparent((t) => !t)}
                  title={
                    format === "jpeg"
                      ? "JPEG unterstützt keine Transparenz"
                      : "Echtes transparentes PNG über die API anzeigen"
                  }
                  icon={Layers}
                >
                  Transparent
                </OptToggle>
              </div>

              {/* Größe + Wasserzeichen */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-medium uppercase tracking-wider text-ink-400">
                  Größe
                </span>
                <div className="inline-flex rounded-lg border border-hair bg-white p-0.5">
                  {SIZE_PRESETS.map((s) => (
                    <SegBtn
                      key={s.label}
                      active={width === s.w && height === s.h}
                      onClick={() => {
                        setWidth(s.w);
                        setHeight(s.h);
                      }}
                    >
                      {s.label}
                    </SegBtn>
                  ))}
                </div>
                <OptToggle
                  active={watermark}
                  onClick={() => setWatermark((w) => !w)}
                  title="Vorschau: So sehen Bilder von Test-/Trial-Kunden aus (automatisches Wasserzeichen)"
                >
                  Testkunde · Wasserzeichen
                </OptToggle>
              </div>
            </div>

            {/* Ansichts-Streifen */}
            <ThumbStrip
              car={car}
              color={color}
              exterior={exterior}
              interior={interior}
              active={view}
              onPick={setView}
            />
          </div>

          {/* Demo-Infos (echt, kein Fake-Listing) */}
          <aside>
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-ink-400">
              Aktuelles Fahrzeug
            </div>
            <h1 className="mt-0.5 text-[22px] font-semibold leading-tight tracking-tight text-ink-900">
              {title}
            </h1>
            <div className="mt-0.5 text-[13px] text-ink-500">
              {car.jahr}
              {car.body && car.body !== "Basis" ? ` · ${car.body}` : ""}
            </div>

            {/* Farben (live aus der API) */}
            <div className="mt-5">
              <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-ink-400">
                <Palette className="h-3.5 w-3.5" />
                Außenfarbe · {colorLabel(color)}
              </div>
              <div className="flex flex-wrap gap-2">
                {(colors.length ? colors : [color]).map((c) => {
                  const active = c === color;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      title={colorLabel(c)}
                      className={`relative h-8 w-8 rounded-full border transition ${
                        active
                          ? "border-ink-900 ring-2 ring-ink-900/15"
                          : "border-ink-200 hover:border-ink-400"
                      }`}
                      style={{ backgroundColor: colorHex(c) }}
                    >
                      {active && (
                        <Check
                          className="absolute inset-0 m-auto h-4 w-4"
                          style={{
                            color:
                              c.toLowerCase() === "white" ||
                              c.toLowerCase() === "default"
                                ? "#1c1c1e"
                                : "#fff",
                          }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Echte Verfügbarkeits-Infos aus der Datenbank/API */}
            <div className="mt-5 grid grid-cols-2 gap-2">
              <Spec label="Farben" value={String(colors.length || 1)} />
              <Spec
                label="Ansichten"
                value={String(exterior.length + interior.length)}
              />
              <Spec
                label="Außen / Innen"
                value={`${exterior.length} / ${interior.length}`}
              />
              <Spec label="Formate" value="PNG·JPEG·WebP·AVIF" />
            </div>

            {/* Erklär-Box: was man hier sieht */}
            <div className="mt-5 rounded-lg border border-hair bg-white p-3">
              <div className="flex items-center gap-1.5 text-[12px] font-medium text-ink-700">
                <Sparkles className="h-3.5 w-3.5 text-brand-600" />
                Live aus der Vehicleimagery-API
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-ink-500">
                Diese Aufnahmen kommen direkt aus unserer API — kein Foto-Shoot,
                kein Hosting, kein Freistellen. Farben, Perspektiven und
                Freisteller in Echtzeit.
              </p>
            </div>
          </aside>
        </div>

        {/* 360°-Rundumblick (eigener Abschnitt) — immer Standardfarbe */}
        <Spin360Section car={car} exterior={exterior} bg={bg} />

        {/* Farbvergleich */}
        {colors.length >= 2 && <ColorCompare car={car} colors={colors} />}

        {/* Aus dem Katalog wählen */}
        <ShowroomGrid
          cars={showroom2010}
          current={car}
          onPick={pick}
          loading={showroomApi.loading && !showroomApi.data}
        />

        {/* So kommt das Bild aus der API */}
        <ApiPanel
          car={car}
          view={view}
          color={color}
          out={out}
          open={showApi}
          onToggle={() => setShowApi((v) => !v)}
        />
      </div>

      {/* Fahrzeug-Auswahl */}
      {pickerOpen && (
        <CarPicker
          current={car}
          cars2010={showroom2010}
          onPick={pick}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {/* Zoom */}
      {zoom && (
        <Zoomed
          car={car}
          color={color}
          view={view}
          out={out}
          onClose={() => setZoom(false)}
        />
      )}
    </div>
  );
}

/**
 * Hero-Bühne: zeigt die gewählte Perspektive in der gewählten Farbe. Pfeile
 * wechseln durch die verfügbaren Ansichten (KEIN 360°-Dreh — das gibt es im
 * eigenen Abschnitt). Der Transparent-Schalter fragt ein echtes Freisteller-PNG
 * über die API an und zeigt es auf einem Karo-Hintergrund.
 *
 * Der Bild-Kasten hat eine feste Größe: `aspect-[16/10]` bestimmt sie allein,
 * das Bild liegt absolut darin (object-contain) und kann sie nie verändern —
 * egal welche Ansicht/Bildgröße geladen wird.
 */
function Stage({
  car,
  color,
  view,
  views,
  bg,
  out,
  onZoom,
  onToggleTransparent,
  onPick,
  loading,
}: {
  car: CarId;
  color: string;
  view: string;
  views: string[];
  bg: BgMode;
  out: OutOptions;
  onZoom: () => void;
  onToggleTransparent: () => void;
  onPick: (v: string) => void;
  loading: boolean;
}) {
  const [failed, setFailed] = useState(false);
  // Innenraum-Bilder sind farb-unabhängig → über „default" laden.
  const imgFarbe = SPIN.includes(view) ? color : "default";
  const url = carThumbApiUrl(
    { ...car, farbe: imgFarbe },
    {
      view,
      width: out.width,
      height: out.height,
      format: out.format,
      shadow: out.shadow,
      transparent: out.transparent,
    },
  );

  useEffect(() => setFailed(false), [url]);

  const stepView = (dir: number) => {
    if (views.length < 2) return;
    const i = views.indexOf(view);
    const cur = i < 0 ? 0 : i;
    onPick(views[(cur + dir + views.length) % views.length]);
  };

  return (
    <div className="relative">
      <div
        className="relative aspect-[16/10] overflow-hidden rounded-xl border border-hair"
        style={stageStyle(bg)}
      >
        {/* Bild-Ebene: absolut → beeinflusst die Kastengröße nie. */}
        <div className="absolute inset-0 flex items-center justify-center p-4 select-none">
          {url && !failed ? (
            <img
              src={url}
              alt={`${car.marke} ${prettyModel(car.modell)} ${VIEW_LABEL[view] ?? view}`}
              draggable={false}
              onError={() => setFailed(true)}
              className="max-h-full max-w-full object-contain"
              style={{ filter: "drop-shadow(0 26px 24px rgba(0,0,0,0.22))" }}
            />
          ) : (
            <ImageIcon className="h-10 w-10 text-ink-300" />
          )}
        </div>

        {/* Wasserzeichen-Vorschau (Testkunde) */}
        {out.watermark && <WatermarkOverlay />}

        {loading && (
          <div className="absolute inset-0 grid place-items-center bg-white/40 backdrop-blur-[1px]">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-ink-300 border-t-ink-700" />
          </div>
        )}

        <div
          className={`pointer-events-none absolute right-3 top-3 rounded-full px-2 py-1 text-[10px] font-medium backdrop-blur ${
            bg === "studio" ? "bg-white/15 text-white" : "bg-ink-900/70 text-white"
          }`}
        >
          {VIEW_LABEL[view] ?? view}
        </div>

        {/* Transparent-Schalter (echtes Freisteller-PNG) */}
        <button
          type="button"
          onClick={onToggleTransparent}
          aria-pressed={out.transparent}
          disabled={out.format === "jpeg"}
          title={
            out.format === "jpeg"
              ? "JPEG unterstützt keine Transparenz"
              : "Echtes transparentes PNG über die API anzeigen"
          }
          className={`absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-medium shadow backdrop-blur transition ${
            out.format === "jpeg"
              ? "cursor-not-allowed bg-white/70 text-ink-300"
              : out.transparent
                ? "bg-ink-900 text-white"
                : "bg-white/85 text-ink-700 hover:bg-white"
          }`}
        >
          <Layers className="h-3.5 w-3.5" />
          Transparent
        </button>

        {/* Zoom */}
        <button
          type="button"
          onClick={onZoom}
          aria-label="Vergrößern"
          className="absolute bottom-3 right-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/85 text-ink-700 shadow hover:bg-white"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>

      {/* Pfeile: durch die verfügbaren Ansichten blättern. */}
      {views.length > 1 && (
        <>
          <ArrowBtn side="left" onClick={() => stepView(-1)} />
          <ArrowBtn side="right" onClick={() => stepView(1)} />
        </>
      )}
    </div>
  );
}

function ArrowBtn({
  side,
  onClick,
}: {
  side: "left" | "right";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Vorherige Ansicht" : "Nächste Ansicht"}
      className={`absolute top-1/2 -translate-y-1/2 ${
        side === "left" ? "left-3" : "right-3"
      } inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/85 text-ink-700 shadow hover:bg-white`}
    >
      {side === "left" ? (
        <ChevronLeft className="h-5 w-5" />
      ) : (
        <ChevronRight className="h-5 w-5" />
      )}
    </button>
  );
}

function ThumbStrip({
  car,
  color,
  exterior,
  interior,
  active,
  onPick,
}: {
  car: CarId;
  color: string;
  exterior: string[];
  interior: string[];
  active: string;
  onPick: (v: string) => void;
}) {
  const Thumb = ({ v }: { v: string }) => {
    const [failed, setFailed] = useState(false);
    const farbe = SPIN.includes(v) ? color : "default";
    const url = carThumbApiUrl({ ...car, farbe }, { view: v, width: 150 });
    return (
      <button
        type="button"
        onClick={() => onPick(v)}
        title={VIEW_LABEL[v] ?? v}
        className={`relative aspect-[4/3] w-[68px] shrink-0 overflow-hidden rounded-md border bg-white ${
          active === v ? "border-ink-900 ring-1 ring-ink-900" : "border-hair"
        }`}
      >
        {url && !failed ? (
          <img
            src={url}
            alt={VIEW_LABEL[v] ?? v}
            loading="lazy"
            onError={() => setFailed(true)}
            className="h-full w-full object-contain"
          />
        ) : (
          <span className="grid h-full w-full place-items-center">
            <ImageIcon className="h-4 w-4 text-ink-300" />
          </span>
        )}
      </button>
    );
  };
  return (
    <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1">
      {exterior.map((v) => (
        <Thumb key={v} v={v} />
      ))}
      {interior.length > 0 && (
        <span className="mx-1 h-8 w-px shrink-0 bg-hair" aria-hidden />
      )}
      {interior.map((v) => (
        <Thumb key={v} v={v} />
      ))}
    </div>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-hair bg-white px-2.5 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-ink-400">
        {label}
      </div>
      <div className="truncate text-[12.5px] font-medium text-ink-800">
        {value}
      </div>
    </div>
  );
}

function SegBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors ${
        active ? "bg-ink-900 text-white" : "text-ink-500 hover:text-ink-900"
      }`}
    >
      {children}
    </button>
  );
}

/** Umschalt-Pille mit Status-Punkt (Transparent / Schatten / Wasserzeichen). */
function OptToggle({
  active,
  onClick,
  children,
  title,
  disabled,
  icon: Icon,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  title?: string;
  disabled?: boolean;
  icon?: LucideIcon;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium transition ${
        disabled
          ? "cursor-not-allowed border-hair bg-ink-50 text-ink-300"
          : active
            ? "border-ink-900 bg-ink-900 text-white"
            : "border-ink-200 bg-white text-ink-700 hover:bg-ink-50"
      }`}
    >
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {children}
      <span
        className={`ml-0.5 inline-block h-2 w-2 rounded-full ${
          active ? "bg-emerald-400" : disabled ? "bg-ink-200" : "bg-ink-300"
        }`}
      />
    </button>
  );
}

/**
 * Demo-Vorschau des Test-/Trial-Wasserzeichens. Wasserzeichen ist serverseitig
 * ein Plan-Merkmal (Testkunden); hier als clientseitiges Overlay simuliert, um
 * im Call zu zeigen, wie Trial-Bilder aussehen.
 */
function WatermarkOverlay() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-[-40%] flex flex-wrap content-center justify-center gap-x-8 gap-y-5 rotate-[-28deg]">
        {Array.from({ length: 80 }).map((_, i) => (
          <span
            key={i}
            className="whitespace-nowrap text-[12px] font-bold uppercase tracking-[0.3em] text-ink-900/15"
          >
            Vehicleimagery · Demo
          </span>
        ))}
      </div>
      <span className="absolute left-3 top-3 rounded-full bg-amber-500/90 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">
        Testkunde
      </span>
    </div>
  );
}


function ColorCompare({ car, colors }: { car: CarId; colors: string[] }) {
  const left = colors.includes("white") ? "white" : colors[0];
  const right = colors.includes("black")
    ? "black"
    : colors.find((c) => c !== left) ?? colors[0];
  const [pos, setPos] = useState(50);
  const ref = useRef<HTMLDivElement | null>(null);
  const dragging = useRef(false);

  const move = (clientX: number) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const p = ((clientX - r.left) / r.width) * 100;
    setPos(Math.min(100, Math.max(0, p)));
  };

  const lUrl = carThumbApiUrl(
    { ...car, farbe: left },
    { view: "front_left", width: 760 },
  );
  const rUrl = carThumbApiUrl(
    { ...car, farbe: right },
    { view: "front_left", width: 760 },
  );

  return (
    <div className="mt-8">
      <div className="mb-2 flex items-center gap-2">
        <h3 className="text-[13px] font-semibold text-ink-900">
          Farbvergleich
        </h3>
        <span className="text-[11px] text-ink-400">
          {colorLabel(left)} ↔ {colorLabel(right)} · Regler ziehen
        </span>
      </div>
      <div
        ref={ref}
        className="relative aspect-[16/9] w-full select-none overflow-hidden rounded-xl border border-hair"
        style={{
          background:
            "radial-gradient(120% 90% at 50% 15%, #ffffff 0%, #f3f5f8 60%, #e6eaf0 100%)",
        }}
        onPointerDown={(e) => {
          dragging.current = true;
          move(e.clientX);
        }}
        onPointerMove={(e) => dragging.current && move(e.clientX)}
        onPointerUp={() => (dragging.current = false)}
        onPointerLeave={() => (dragging.current = false)}
      >
        {rUrl && (
          <img
            src={rUrl}
            alt={colorLabel(right)}
            draggable={false}
            className="absolute inset-0 h-full w-full object-contain p-6"
          />
        )}
        {lUrl && (
          <img
            src={lUrl}
            alt={colorLabel(left)}
            draggable={false}
            className="absolute inset-0 h-full w-full object-contain p-6"
            style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
          />
        )}
        <div
          className="absolute inset-y-0 w-0.5 bg-white shadow"
          style={{ left: `${pos}%` }}
        >
          <span className="absolute top-1/2 left-1/2 grid h-7 w-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-ink-700 shadow">
            <ChevronLeft className="h-3 w-3" />
          </span>
        </div>
        <span className="absolute left-3 top-3 rounded bg-ink-900/70 px-2 py-0.5 text-[10px] font-medium text-white">
          {colorLabel(left)}
        </span>
        <span className="absolute right-3 top-3 rounded bg-ink-900/70 px-2 py-0.5 text-[10px] font-medium text-white">
          {colorLabel(right)}
        </span>
      </div>
    </div>
  );
}

const CT_BY_FORMAT: Record<ImgFormat, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
  avif: "image/avif",
};

function ApiPanel({
  car,
  view,
  color,
  out,
  open,
  onToggle,
}: {
  car: CarId;
  view: string;
  color: string;
  out: OutOptions;
  open: boolean;
  onToggle: () => void;
}) {
  const path = `/api/${car.marke}/${prettyModel(car.modell).replace(/ /g, "_")}/${car.jahr}/${view}`;
  // Query-String aus den aktuell gewählten Optionen — spiegelt 1:1 das Bild oben.
  const params: string[] = [`format=${out.format}`];
  if (color && color !== "default") params.push(`color=${color}`);
  if (out.shadow) params.push("shadow=true");
  if (out.transparent) params.push("transparent=true");
  params.push(`width=${out.width}`);
  if (out.height) params.push(`height=${out.height}`);
  const qs = `?${params.join("&")}`;

  return (
    <div className="mt-8 rounded-xl border border-hair bg-white">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
      >
        <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-ink-900">
          <Code2 className="h-4 w-4 text-brand-600" />
          So kommt genau dieses Bild aus der API
        </span>
        <span className="text-[11px] text-ink-400">
          {open ? "ausblenden" : "anzeigen"}
        </span>
      </button>
      {open && (
        <div className="border-t border-hair px-4 py-3">
          <div className="overflow-x-auto rounded-lg bg-ink-900 px-3 py-2.5 font-mono text-[12px] leading-relaxed text-ink-100">
            <div>
              <span className="text-emerald-400">GET</span>{" "}
              https://api.vehicleimagery.com{path}
              <span className="text-amber-300">{qs}</span>
            </div>
            <div className="text-ink-400">x-api-key: VI-••••••••••••••••</div>
            <div className="mt-1 text-ink-400">
              → 200 · {CT_BY_FORMAT[out.format]} · {out.width}
              {out.height ? `×${out.height}` : ""} px
              {out.shadow ? " · Schatten" : ""}
              {out.transparent ? " · transparent" : ""}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {[
              "format: png · jpeg · webp · avif",
              "shadow=true",
              "transparent=true (Freisteller)",
              "width & height frei wählbar",
              "getall: alle Ansichten auf einmal",
              "CDN-Cache",
            ].map((t) => (
              <span
                key={t}
                className="rounded-full border border-hair bg-ink-50 px-2 py-0.5 text-[11px] text-ink-600"
              >
                {t}
              </span>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-ink-400">
            Diese Demo lädt die Bilder live über genau diese API — kein eigener
            Foto-Shoot, kein Hosting, kein Freistellen. Test-/Trial-Keys liefern
            die Bilder automatisch mit Wasserzeichen.
          </p>
        </div>
      )}
    </div>
  );
}

function CarPicker({
  current,
  cars2010,
  onPick,
  onClose,
}: {
  current: CarId;
  cars2010: CarId[];
  onPick: (c: CarId) => void;
  onClose: () => void;
}) {
  const [qIn, setQIn] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setQ(qIn.trim()), 350);
    return () => clearTimeout(t);
  }, [qIn]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const searchApi = useApi<CarListResponse>(
    q.length >= 2 ? carDatabaseListUrl({ q, limit: 10 }) : null,
  );
  const results = searchApi.data?.rows ?? [];
  const toId = (r: CarRow): CarId => ({
    marke: r.marke,
    modell: r.modell,
    jahr: r.jahr,
    body: r.body,
    trim: r.trim,
  });
  const sameId = (a: CarId, b: CarId) =>
    a.marke === b.marke &&
    a.modell === b.modell &&
    a.jahr === b.jahr &&
    a.body === b.body &&
    a.trim === b.trim;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-ink-900/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="my-10 w-full max-w-lg rounded-xl border border-hair bg-paper shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-hair px-4 py-3">
          <h3 className="text-[14px] font-semibold text-ink-900">
            Fahrzeug wählen
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-500 hover:bg-ink-100"
            aria-label="Schließen"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-4 py-3">
          <div className="mb-2 text-[10px] font-medium uppercase tracking-wider text-ink-400">
            Empfohlen
          </div>
          <div className="mb-4 flex flex-wrap gap-1.5">
            {FEATURED.map((c) => (
              <button
                key={`${c.marke}-${c.modell}-${c.jahr}`}
                type="button"
                onClick={() => onPick(c)}
                className={`rounded-full border px-2.5 py-1 text-[12px] transition-colors ${
                  sameId(c, current)
                    ? "border-ink-900 bg-ink-900 text-white"
                    : "border-hair bg-white text-ink-700 hover:bg-ink-50"
                }`}
              >
                {c.marke} {prettyModel(c.modell)} {c.jahr}
              </button>
            ))}
          </div>
          {cars2010.length > 0 && (
            <>
              <div className="mb-2 text-[10px] font-medium uppercase tracking-wider text-ink-400">
                Baujahr 2010
              </div>
              <div className="mb-4 flex flex-wrap gap-1.5">
                {cars2010.map((c) => (
                  <button
                    key={`${c.marke}-${c.modell}-${c.jahr}-${c.body}-${c.trim}`}
                    type="button"
                    onClick={() => onPick(c)}
                    className={`rounded-full border px-2.5 py-1 text-[12px] transition-colors ${
                      sameId(c, current)
                        ? "border-ink-900 bg-ink-900 text-white"
                        : "border-hair bg-white text-ink-700 hover:bg-ink-50"
                    }`}
                  >
                    {c.marke} {prettyModel(c.modell)} {c.jahr}
                  </button>
                ))}
              </div>
            </>
          )}
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
            <input
              autoFocus
              value={qIn}
              onChange={(e) => setQIn(e.target.value)}
              placeholder="Alle Fahrzeuge durchsuchen…"
              className="w-full rounded-md border border-hair bg-white py-2 pl-7 pr-2 text-[13px] text-ink-800 focus:border-ink-400 focus:outline-none"
            />
          </div>
          {q.length >= 2 && (
            <div className="mt-2 max-h-72 overflow-y-auto rounded-md border border-hair">
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
                    onClick={() => onPick(toId(r))}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[12.5px] hover:bg-ink-50"
                  >
                    <span className="truncate">
                      <span className="font-medium text-ink-800">
                        {r.marke} {prettyModel(r.modell)}
                      </span>
                      <span className="text-ink-400"> · {r.jahr}</span>
                    </span>
                    <span className="text-[10px] text-ink-400">
                      {r.farben} Farben
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Zoomed({
  car,
  color,
  view,
  out,
  onClose,
}: {
  car: CarId;
  color: string;
  view: string;
  out: OutOptions;
  onClose: () => void;
}) {
  const imgFarbe = SPIN.includes(view) ? color : "default";
  const url = carThumbApiUrl(
    { ...car, farbe: imgFarbe },
    {
      view,
      width: 1500,
      format: out.format,
      shadow: out.shadow,
      transparent: out.transparent,
    },
  );
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-ink-900/90 p-6"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Schließen"
        className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-md bg-white/10 text-white hover:bg-white/20"
      >
        <X className="h-5 w-5" />
      </button>
      {url && (
        <div
          className="relative"
          onClick={(e) => e.stopPropagation()}
          style={out.transparent ? CHECKER : undefined}
        >
          <img
            src={url}
            alt={`${car.marke} ${prettyModel(car.modell)}`}
            className={`max-h-[88vh] max-w-[94vw] object-contain ${
              out.transparent ? "rounded-lg" : ""
            }`}
          />
          {out.watermark && <WatermarkOverlay />}
        </div>
      )}
    </div>
  );
}

/**
 * Eigenständiger 360°-Abschnitt: großer Viewer, durch Ziehen, Pfeile oder den
 * Regler durch die 8 Studio-Perspektiven drehbar. Hat eine eigene
 * Dreh-Position (unabhängig vom Perspektiven-Viewer oben) und zeigt das
 * Fahrzeug immer in der Standardfarbe (`default`).
 */
function Spin360Section({
  car,
  exterior,
  bg,
}: {
  car: CarId;
  exterior: string[];
  bg: BgMode;
}) {
  const [idx, setIdx] = useState(0);
  const [failed, setFailed] = useState(false);
  const drag = useRef<{ x: number; idx: number } | null>(null);

  // Bei Fahrzeugwechsel zurück auf die erste Ansicht.
  useEffect(() => {
    setIdx(0);
  }, [car]);

  // Alle Außen-Ansichten vorladen → flüssiger Dreh.
  useEffect(() => {
    exterior.forEach((v) =>
      preloadImage(
        carThumbApiUrl({ ...car, farbe: "default" }, { view: v, width: 1100 }),
      ),
    );
  }, [car, exterior]);

  const len = exterior.length;
  const safeIdx = len ? Math.min(idx, len - 1) : 0;
  const view = exterior[safeIdx];
  const url = view
    ? carThumbApiUrl({ ...car, farbe: "default" }, { view, width: 1100 })
    : null;

  useEffect(() => setFailed(false), [url]);

  const setSpin = (n: number) => {
    if (!len) return;
    setIdx(((n % len) + len) % len);
  };
  const onDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, idx: safeIdx };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const steps = Math.round((drag.current.x - e.clientX) / 24);
    setSpin(drag.current.idx + steps);
  };
  const onUp = () => {
    drag.current = null;
  };

  if (len < 2) return null;

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center gap-2">
        <Rotate3d className="h-4 w-4 text-brand-600" />
        <h3 className="text-[15px] font-semibold tracking-tight text-ink-900">
          360°-Rundumblick
        </h3>
        <span className="text-[12px] text-ink-400">
          {car.marke} {prettyModel(car.modell)} · {VIEW_LABEL[view] ?? view}
        </span>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_240px]">
        <div className="relative">
          {/* Fester Bild-Kasten: aspect-[16/9] bestimmt die Größe allein, das
              Bild liegt absolut darin → kein Größensprung beim Drehen. */}
          <div
            className="relative aspect-[16/9] cursor-ew-resize overflow-hidden rounded-xl border border-hair"
            style={stageStyle(bg)}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerLeave={onUp}
          >
            <div className="absolute inset-0 flex select-none items-center justify-center p-6">
              {url && !failed ? (
                <img
                  src={url}
                  alt={`${car.marke} ${prettyModel(car.modell)} 360 Grad`}
                  draggable={false}
                  onError={() => setFailed(true)}
                  className="max-h-full max-w-full object-contain"
                  style={{ filter: "drop-shadow(0 26px 24px rgba(0,0,0,0.22))" }}
                />
              ) : (
                <ImageIcon className="h-10 w-10 text-ink-300" />
              )}
            </div>
            <div className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-ink-900/80 px-2 py-1 text-[10px] font-medium text-white backdrop-blur">
              <Rotate3d className="h-3 w-3" />
              360°
            </div>
          </div>
          <ArrowBtn side="left" onClick={() => setSpin(safeIdx - 1)} />
          <ArrowBtn side="right" onClick={() => setSpin(safeIdx + 1)} />
          <SpinSlider
            exterior={exterior}
            spinIdx={safeIdx}
            view={view}
            onSpin={setSpin}
          />
        </div>
        <aside className="flex flex-col justify-center gap-2 rounded-xl border border-hair bg-white p-4">
          <div className="text-[13px] font-semibold text-ink-900">
            {car.marke} {prettyModel(car.modell)}
          </div>
          <p className="text-[11.5px] leading-relaxed text-ink-500">
            Ziehe das Bild oder nutze den Regler, um das Fahrzeug in 8
            Studio-Perspektiven zu drehen — alle live über die
            Vehicleimagery-API.
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {exterior.map((v, i) => (
              <button
                key={v}
                type="button"
                onClick={() => setSpin(i)}
                className={`rounded-full border px-2 py-0.5 text-[10.5px] transition ${
                  i === safeIdx
                    ? "border-ink-900 bg-ink-900 text-white"
                    : "border-hair bg-white text-ink-600 hover:bg-ink-50"
                }`}
              >
                {VIEW_LABEL[v] ?? v}
              </button>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}

/** 360°-Regler: scrubbt durch die vorhandenen Außen-Ansichten. */
function SpinSlider({
  exterior,
  spinIdx,
  view,
  onSpin,
}: {
  exterior: string[];
  spinIdx: number;
  view: string;
  onSpin: (idx: number) => void;
}) {
  if (exterior.length < 2) return null;
  const isExt = SPIN.includes(view) && exterior.includes(view);
  const current = exterior[spinIdx] ?? exterior[0];
  return (
    <div className="mt-3 rounded-lg border border-hair bg-white px-3 py-2.5">
      <div className="mb-2 flex items-center justify-between text-[11px]">
        <span className="inline-flex items-center gap-1.5 font-medium text-ink-700">
          <Rotate3d className="h-3.5 w-3.5 text-brand-600" />
          360°-Ansicht
        </span>
        <span className="text-ink-400">
          {isExt ? VIEW_LABEL[current] ?? current : "Innenansicht aktiv"} ·{" "}
          {spinIdx + 1}/{exterior.length}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={exterior.length - 1}
        step={1}
        value={spinIdx}
        onChange={(e) => onSpin(Number(e.target.value))}
        aria-label="360-Grad-Ansicht drehen"
        className="w-full cursor-ew-resize accent-ink-900"
      />
      <div className="mt-1 flex justify-between text-[9.5px] uppercase tracking-wider text-ink-300">
        <span>Vorne</span>
        <span>Links</span>
        <span>Hinten</span>
        <span>Rechts</span>
      </div>
    </div>
  );
}

/** Auswählbarer Showroom mit (zufälligen) Fahrzeugen — hier Baujahr 2010. */
function ShowroomGrid({
  cars,
  current,
  onPick,
  loading,
}: {
  cars: CarId[];
  current: CarId;
  onPick: (c: CarId) => void;
  loading: boolean;
}) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Car className="h-4 w-4 text-brand-600" />
          <h3 className="text-[15px] font-semibold tracking-tight text-ink-900">
            Übersicht · {cars.length} Fahrzeuge (Baujahr 2010)
          </h3>
        </div>
        <span className="text-[12px] text-ink-400">
          {loading ? "lädt…" : "5 sichtbar · nach rechts scrollen für mehr"}
        </span>
      </div>
      {/* Horizontale Reihe: immer 5 sichtbar, Rest per Scroll nach rechts. */}
      <div className="flex snap-x gap-3 overflow-x-auto pb-2 [scrollbar-width:thin]">
        {cars.map((c) => (
          <div
            key={`${c.marke}-${c.modell}-${c.jahr}-${c.body}-${c.trim}`}
            className="shrink-0 basis-[calc((100%_-_3rem)/5)] snap-start"
          >
            <ShowroomCard
              car={c}
              active={sameCarId(c, current)}
              onPick={onPick}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

function ShowroomCard({
  car,
  active,
  onPick,
}: {
  car: CarId;
  active: boolean;
  onPick: (c: CarId) => void;
}) {
  const [failed, setFailed] = useState(false);
  const url = carThumbApiUrl(
    { ...car, farbe: "default" },
    { view: "front_left", width: 360 },
  );
  return (
    <button
      type="button"
      onClick={() => onPick(car)}
      aria-pressed={active}
      className={`group block w-full overflow-hidden rounded-xl border bg-white text-left transition hover:-translate-y-0.5 hover:shadow-sm ${
        active
          ? "border-ink-900 ring-1 ring-ink-900"
          : "border-hair hover:border-ink-200"
      }`}
    >
      <div
        className="relative flex aspect-[4/3] items-center justify-center p-2.5"
        style={{
          background:
            "radial-gradient(120% 90% at 50% 15%, #ffffff 0%, #f3f5f8 60%, #e9edf2 100%)",
        }}
      >
        {url && !failed ? (
          <img
            src={url}
            alt={`${car.marke} ${prettyModel(car.modell)}`}
            loading="lazy"
            onError={() => setFailed(true)}
            className="max-h-full max-w-full object-contain transition duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <ImageIcon className="h-7 w-7 text-ink-300" />
        )}
        {active && (
          <span className="absolute left-2 top-2 rounded-full bg-ink-900 px-1.5 py-0.5 text-[9px] font-medium text-white">
            Ausgewählt
          </span>
        )}
      </div>
      <div className="border-t border-hair px-2.5 py-1.5">
        <div className="truncate text-[12px] font-semibold text-ink-900">
          {car.marke} {prettyModel(car.modell)}
        </div>
        <div className="text-[10.5px] text-ink-400">{car.jahr}</div>
      </div>
    </button>
  );
}
