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
} from "lucide-react";
import {
  createContext,
  type CSSProperties,
  useContext,
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
import {
  STANDARD_FEATURED as FEATURED,
  STANDARD_SHOWROOM as SHOWROOM_2010,
} from "../lib/demoCars";

type CarId = {
  marke: string;
  modell: string;
  jahr: number;
  body: string;
  trim: string;
};

/**
 * Demo-Modus (öffentlicher Kunden-Link `/d/:token`): wenn gesetzt, läuft die
 * Seite OHNE Dashboard-Login und ist auf die im Link gespeicherten Fahrzeuge
 * und Farben begrenzt. Jede Bild-URL trägt das Token (`dt`), der Proxy prüft
 * den Scope serverseitig.
 */
export type DemoMode = {
  token: string;
  allowedColors: string[];
  featured: CarId[];
  showroom: CarId[];
};

/** Liefert das Demo-Token an alle Bild-bauenden Unterkomponenten (oder "" normal). */
const DemoTokenCtx = createContext<string>("");

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
  front: "Front",
  rear: "Rear",
  left: "Left",
  right: "Right",
  front_left: "Front left",
  front_right: "Front right",
  rear_left: "Rear left",
  rear_right: "Rear right",
  dashboard: "Dashboard",
  center_console: "Center console",
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
  black: "Black",
  white: "White",
  blue: "Blue",
  orange: "Orange",
  wine_red: "Wine red",
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
  transparent: boolean;
  width: number;
  height: number | null;
  resolution: string;
};

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

export default function CarDatabaseDemoPage({ demo }: { demo?: DemoMode }) {
  const isDemo = !!demo;
  const demoToken = demo?.token ?? "";
  // Fahrzeug-/Farb-Quellen: im Demo-Modus AUSSCHLIESSLICH aus dem Link (sonst
  // läge das Hero-Auto außerhalb des Scopes → 403). Nie auf den globalen
  // Standard-Satz zurückfallen, solange der Link Fahrzeuge mitbringt.
  const featuredCars = isDemo
    ? demo!.featured.length
      ? demo!.featured
      : demo!.showroom
    : FEATURED;
  const [car, setCar] = useState<CarId>(() => featuredCars[0] ?? FEATURED[0]);
  const [color, setColor] = useState(() => demo?.allowedColors?.[0] ?? "white");
  const [view, setView] = useState("front_left");
  // Fester heller Studio-Hintergrund (Showroom). Transparent ist ein eigener
  // Schalter, der ausschließlich die Hero betrifft.
  const bg: BgMode = "showroom";
  const [transparent, setTransparent] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [showApi, setShowApi] = useState(false);
  const [zoom, setZoom] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Innen-Ansichten liegen nur unter Farbe „default" → Metadaten immer über
  // „default" laden (liefert alle Farben + alle Ansichten inkl. Innenraum).
  // Im Demo-Modus (öffentlich, ohne Login) NICHT die geschützte Detail-API
  // rufen — Farben/Ansichten kommen aus dem Link bzw. den Standard-Ansichten.
  const detailApi = useApi<CarDetailResponse>(
    isDemo ? null : carDatabaseDetailUrl({ ...car, farbe: "default" }),
  );
  const detail = detailApi.data;

  // Nur Farben mit mindestens einem AKTIVEN (live gerenderten) Bild gelten als
  // „verfügbar". So tauchen Farben ohne echte Bilder (z. B. wine_red, das nur
  // in der DB registriert, aber nicht gerendert ist) gar nicht erst auf.
  const colors = useMemo(
    () =>
      isDemo
        ? (demo?.allowedColors ?? [])
        : (detail?.colors ?? [])
            .filter((c) => c.aktiv > 0)
            .map((c) => c.farbe),
    [detail, isDemo, demo],
  );
  const availViews = useMemo(
    () => new Set((detail?.views ?? []).map((v) => v.view.toLowerCase())),
    [detail],
  );
  // Im Demo-Modus alle Standard-Ansichten zeigen (kein Detail-Abruf verfügbar).
  const exterior = useMemo(
    () =>
      isDemo ? SPIN : SPIN.filter((v) => availViews.size === 0 || availViews.has(v)),
    [availViews, isDemo],
  );
  const interior = useMemo(
    () => (isDemo ? INTERIOR : INTERIOR.filter((v) => availViews.has(v))),
    [availViews, isDemo],
  );

  // Bei Auto-Wechsel: Farbe/Ansicht auf sinnvolle Defaults.
  useEffect(() => {
    setView("front_left");
  }, [car]);
  useEffect(() => {
    if (!isDemo && !detail) return;
    // Keine verfügbare Farbe → ehrlich die Standardfarbe zeigen.
    if (colors.length === 0) {
      if (color !== "default") setColor("default");
      return;
    }
    // Gewählte Farbe nicht (mehr) verfügbar → auf eine verfügbare wechseln.
    if (!colors.includes(color)) {
      setColor(colors.includes("white") ? "white" : colors[0]);
    }
  }, [detail, colors, color, isDemo]);
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
          { view: v, width: 900, demoToken },
        ),
      ),
    );
  }, [car, color, exterior, interior, demoToken]);

  // Aktuelle Ansicht in ALLEN Farben vorladen → Farbwechsel ist sofort da.
  useEffect(() => {
    if (!SPIN.includes(view)) return; // Innen-Ansichten sind farb-unabhängig
    colors.forEach((c) =>
      preloadImage(
        carThumbApiUrl({ ...car, farbe: c }, { view, width: 900, demoToken }),
      ),
    );
  }, [car, colors, view, demoToken]);

  const title = `${car.marke} ${prettyModel(car.modell)}`;

  // Showroom „Baujahr 2010": 10 zufällige Autos live aus der Galerie-API,
  // mit fester Fallback-Liste, falls die DB (noch) nichts liefert.
  const showroomApi = useApi<GalleryResponse>(
    isDemo
      ? null
      : carDatabaseGalleryUrl({
          jahrMin: 2010,
          jahrMax: 2010,
          random: true,
          limit: 10,
        }),
  );
  const showroom2010 = useMemo<CarId[]>(() => {
    // Demo-Modus: genau die im Link erlaubten Fahrzeuge (Hero + Showroom),
    // dedupliziert — so ist jedes erlaubte Auto auswählbar und im Scope.
    if (isDemo) {
      const all = [...(demo?.featured ?? []), ...(demo?.showroom ?? [])];
      const out: CarId[] = [];
      for (const c of all) if (!out.some((o) => sameCarId(o, c))) out.push(c);
      return out;
    }
    const rows = showroomApi.data?.rows ?? [];
    if (!rows.length) return SHOWROOM_2010;
    return rows.slice(0, 10).map((r) => ({
      marke: r.marke,
      modell: r.modell,
      jahr: r.jahr,
      body: r.body,
      trim: r.trim,
    }));
  }, [showroomApi.data, isDemo, demo]);

  const pick = (c: CarId) => {
    setCar(c);
    setPickerOpen(false);
  };

  // Format/Größe/Auflösung sind in der Demo NICHT auswählbar (nur Werbung) —
  // die Hero nutzt feste Defaults. Variabel ist nur Transparent.
  const out: OutOptions = {
    format: "png",
    transparent,
    width: 900,
    height: null,
    resolution: "default",
  };

  return (
    <DemoTokenCtx.Provider value={demoToken}>
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
            Live demo
          </span>
          <div className="leading-tight">
            <div className="text-[14px] font-semibold tracking-tight text-ink-900">
              Vehicleimagery
            </div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-ink-400">
              Vehicle images from the API
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isDemo && (
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3 py-1.5 text-[12px] font-medium text-ink-700 hover:bg-ink-50"
            >
              <Search className="h-3.5 w-3.5" />
              Choose vehicle
            </button>
          )}
          <button
            type="button"
            onClick={() => setPresenting((p) => !p)}
            className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-2.5 py-1.5 text-[12px] text-ink-600 hover:bg-ink-50"
            title={presenting ? "Exit presentation" : "Presentation mode"}
          >
            {presenting ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">
              {presenting ? "Exit" : "Present"}
            </span>
          </button>
        </div>
      </header>

      <div className="bg-paper px-4 py-5 sm:px-6">
        {/* Demo-Intro statt Händler-Breadcrumb */}
        <div className="mb-5">
          <h2 className="font-display text-[22px] font-semibold leading-tight tracking-tight text-ink-900 sm:text-[26px]">
            Every vehicle. Every color. Every angle.
          </h2>
          <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-ink-500">
            Every image is loaded live from a single API — in studio quality,
            color-accurate and ready to cut out. Pick a vehicle, color, view and
            background and watch the image arrive in real time.
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
              bg={transparent ? "transparent" : bg}
              out={out}
              onZoom={() => setZoom(true)}
              onToggleTransparent={() => setTransparent((t) => !t)}
              onPick={setView}
              loading={detailApi.loading && !detail}
            />

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
              Current vehicle
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
                Exterior color · {colorLabel(color)}
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
              <Spec label="Colors" value={String(colors.length || 1)} />
              <Spec
                label="Views"
                value={String(exterior.length + interior.length)}
              />
              <Spec
                label="Exterior / Interior"
                value={`${exterior.length} / ${interior.length}`}
              />
            </div>

            {/* Erklär-Box: was man hier sieht */}
            <div className="mt-5 rounded-lg border border-hair bg-white p-3">
              <div className="flex items-center gap-1.5 text-[12px] font-medium text-ink-700">
                <Sparkles className="h-3.5 w-3.5 text-brand-600" />
                Live from the Vehicleimagery API
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-ink-500">
                These shots come straight from our API — no photo shoot, no
                hosting, no manual cut-out. Colors, angles and cut-outs in real
                time.
              </p>
            </div>
          </aside>
        </div>

        {/* 360°-Rundumblick (eigener Abschnitt) — immer Standardfarbe */}
        <Spin360Section car={car} exterior={exterior} bg={bg} />

        {/* Shadow & Ground (eigener Abschnitt) */}
        <ShadowGroundSection car={car} exterior={exterior} />

        {/* Transparent-Vergleich (Regler) */}
        <TransparentCompare car={car} />

        {/* Weitere API-Bildoptionen (Werbung — im Preview nicht sichtbar) */}
        <OutputOptionsSection />

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

      {/* Fahrzeug-Auswahl (im Demo-Modus deaktiviert) */}
      {!isDemo && pickerOpen && (
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
    </DemoTokenCtx.Provider>
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
  const dt = useContext(DemoTokenCtx);
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
      transparent: out.transparent,
      resolution: out.resolution,
      demoToken: dt,
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
              ? "JPEG doesn't support transparency"
              : "Show a real transparent PNG from the API"
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
          aria-label="Zoom"
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
      aria-label={side === "left" ? "Previous view" : "Next view"}
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
  const dt = useContext(DemoTokenCtx);
  const Thumb = ({ v }: { v: string }) => {
    const [failed, setFailed] = useState(false);
    const farbe = SPIN.includes(v) ? color : "default";
    const url = carThumbApiUrl(
      { ...car, farbe },
      { view: v, width: 150, demoToken: dt },
    );
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


/** Vorher/Nachher-Regler: Bild mit Hintergrund ↔ echtes transparentes PNG. */
function TransparentCompare({ car }: { car: CarId }) {
  const dt = useContext(DemoTokenCtx);
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

  // Gleiche Ansicht/Farbe; links mit Hintergrund, rechts echtes Freisteller-PNG.
  const bgUrl = carThumbApiUrl(
    { ...car, farbe: "default" },
    { view: "front_left", width: 760, demoToken: dt },
  );
  const trpUrl = carThumbApiUrl(
    { ...car, farbe: "default" },
    { view: "front_left", width: 760, transparent: true, demoToken: dt },
  );

  return (
    <div className="mt-8">
      <div className="mb-2 flex items-center gap-2">
        <h3 className="text-[13px] font-semibold text-ink-900">Transparent</h3>
        <span className="text-[11px] text-ink-400">
          With background ↔ transparent cut-out · drag the slider
        </span>
      </div>
      <div
        ref={ref}
        className="relative aspect-[16/9] w-full select-none overflow-hidden rounded-xl border border-hair"
        onPointerDown={(e) => {
          dragging.current = true;
          move(e.clientX);
        }}
        onPointerMove={(e) => dragging.current && move(e.clientX)}
        onPointerUp={() => (dragging.current = false)}
        onPointerLeave={() => (dragging.current = false)}
      >
        {/* Rechte Seite (volle Ebene): transparentes PNG auf Karo */}
        <div className="absolute inset-0" style={CHECKER}>
          {trpUrl && (
            <img
              src={trpUrl}
              alt="Transparent cut-out"
              draggable={false}
              className="absolute inset-0 h-full w-full object-contain p-6"
            />
          )}
        </div>
        {/* Linke Seite (geclippt): Bild auf Showroom-Hintergrund */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 90% at 50% 15%, #ffffff 0%, #f3f5f8 60%, #e6eaf0 100%)",
            clipPath: `inset(0 ${100 - pos}% 0 0)`,
          }}
        >
          {bgUrl && (
            <img
              src={bgUrl}
              alt="With background"
              draggable={false}
              className="absolute inset-0 h-full w-full object-contain p-6"
            />
          )}
        </div>
        <div
          className="absolute inset-y-0 w-0.5 bg-white shadow"
          style={{ left: `${pos}%` }}
        >
          <span className="absolute top-1/2 left-1/2 grid h-7 w-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-ink-700 shadow">
            <ChevronLeft className="h-3 w-3" />
          </span>
        </div>
      </div>
    </div>
  );
}

/** Eigener Abschnitt: zwei Bilder nebeneinander — links mit Schatten, rechts mit Ground. */
function ShadowGroundSection({
  car,
  exterior,
}: {
  car: CarId;
  exterior: string[];
}) {
  const dt = useContext(DemoTokenCtx);
  const v = exterior.includes("front_left")
    ? "front_left"
    : exterior[0] ?? "front_left";
  const shadowUrl = carThumbApiUrl(
    { ...car, farbe: "default" },
    { view: v, width: 760, shadow: true, demoToken: dt },
  );
  const groundUrl = carThumbApiUrl(
    { ...car, farbe: "default" },
    { view: v, width: 760, ground: true, demoToken: dt },
  );

  return (
    <section className="mt-10 border-t border-hair pt-8">
      <div className="rounded-2xl border border-hair bg-ink-50/60 p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center gap-2.5">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-ink-900 text-white">
            <Sparkles className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-[17px] font-semibold tracking-tight text-ink-900">
              Shadow &amp; ground
            </h3>
            <p className="truncate text-[12px] text-ink-500">
              Two API options side by side — drop shadow vs. anchored to the
              ground.
            </p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <SgCard
            label="Shadow"
            param="shadow=true"
            url={shadowUrl}
            alt={`${car.marke} ${prettyModel(car.modell)} with shadow`}
          />
          <SgCard
            label="Ground"
            param="ground=true"
            url={groundUrl}
            alt={`${car.marke} ${prettyModel(car.modell)} on the ground`}
          />
        </div>
      </div>
    </section>
  );
}

function SgCard({
  label,
  param,
  url,
  alt,
}: {
  label: string;
  param: string;
  url: string | null;
  alt: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  return (
    <div>
      <div
        className="relative aspect-[4/3] overflow-hidden rounded-xl border border-hair"
        style={{
          background:
            "radial-gradient(120% 90% at 50% 15%, #ffffff 0%, #f3f5f8 55%, #e6eaf0 100%)",
        }}
      >
        <div className="absolute inset-0 flex select-none items-center justify-center p-6">
          {url && !failed ? (
            <img
              src={url}
              alt={alt}
              draggable={false}
              onError={() => setFailed(true)}
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <ImageIcon className="h-10 w-10 text-ink-300" />
          )}
        </div>
        <span className="absolute left-3 top-3 rounded-full bg-ink-900/80 px-2.5 py-0.5 text-[11px] font-medium text-white backdrop-blur">
          {label}
        </span>
      </div>
      <div className="mt-1.5 text-center font-mono text-[11px] text-ink-400">
        {param}
      </div>
    </div>
  );
}

/**
 * Eigener Abschnitt, der API-Bildoptionen bewirbt, die im kleinen Preview NICHT
 * sichtbar werden (Format, Auflösung, Maße) — daher als klare Info statt Auswahl.
 */
function OutputOptionsSection() {
  const items = [
    {
      icon: ImageIcon,
      title: "4 file formats",
      desc: "PNG · JPEG · WebP · AVIF — pick what your stack needs.",
    },
    {
      icon: Sparkles,
      title: "Up to 4K resolution",
      desc: "Default · 1K · 2K · 4K — crisp at any size.",
    },
    {
      icon: Maximize2,
      title: "Any dimensions",
      desc: "Request an exact width & height in pixels.",
    },
  ];
  return (
    <section className="mt-10 border-t border-hair pt-8">
      <div className="rounded-2xl border border-hair bg-ink-50/60 p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center gap-2.5">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-ink-900 text-white">
            <Code2 className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-[17px] font-semibold tracking-tight text-ink-900">
              More output options
            </h3>
            <p className="text-[12px] text-ink-500">
              Not visible in this small preview — but available for every image
              via the API.
            </p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {items.map((it) => (
            <div
              key={it.title}
              className="rounded-xl border border-hair bg-white p-4"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600/10 text-brand-600">
                <it.icon className="h-4 w-4" />
              </span>
              <div className="mt-2 text-[13px] font-semibold text-ink-900">
                {it.title}
              </div>
              <div className="mt-0.5 text-[11.5px] leading-relaxed text-ink-500">
                {it.desc}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
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
  if (out.resolution !== "default")
    params.push(`resolution=${out.resolution}`);
  if (color && color !== "default") params.push(`color=${color}`);
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
          Exactly how this image comes from the API
        </span>
        <span className="text-[11px] text-ink-400">
          {open ? "hide" : "show"}
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
              {out.resolution !== "default" ? ` · ${out.resolution}` : ""}
              {out.transparent ? " · transparent" : ""}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {[
              "format: png · jpeg · webp · avif",
              "resolution: default · 1K · 2K · 4K",
              "shadow=true",
              "transparent=true (cut-out)",
              "ground=true (on the floor)",
              "width & height freely selectable",
              "getall: all views at once",
              "CDN cache",
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
            This demo loads the images live through exactly this API — no photo
            shoot of your own, no hosting, no manual cut-out. Test/trial keys
            return the images with a watermark automatically.
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
            Choose vehicle
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-500 hover:bg-ink-100"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-4 py-3">
          <div className="mb-2 text-[10px] font-medium uppercase tracking-wider text-ink-400">
            Recommended
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
                Model year 2010
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
              placeholder="Search all vehicles…"
              className="w-full rounded-md border border-hair bg-white py-2 pl-7 pr-2 text-[13px] text-ink-800 focus:border-ink-400 focus:outline-none"
            />
          </div>
          {q.length >= 2 && (
            <div className="mt-2 max-h-72 overflow-y-auto rounded-md border border-hair">
              {searchApi.loading && results.length === 0 ? (
                <div className="px-3 py-2 text-[12px] text-ink-400">
                  Searching…
                </div>
              ) : results.length === 0 ? (
                <div className="px-3 py-2 text-[12px] text-ink-400">
                  Nothing found.
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
                      {r.farben} colors
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
  const dt = useContext(DemoTokenCtx);
  const imgFarbe = SPIN.includes(view) ? color : "default";
  const url = carThumbApiUrl(
    { ...car, farbe: imgFarbe },
    {
      view,
      width: 1500,
      format: out.format,
      transparent: out.transparent,
      resolution: out.resolution,
      demoToken: dt,
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
        aria-label="Close"
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
  const dt = useContext(DemoTokenCtx);
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
        carThumbApiUrl(
          { ...car, farbe: "default" },
          { view: v, width: 1100, demoToken: dt },
        ),
      ),
    );
  }, [car, exterior, dt]);

  const len = exterior.length;
  const safeIdx = len ? Math.min(idx, len - 1) : 0;
  const view = exterior[safeIdx];
  const url = view
    ? carThumbApiUrl(
        { ...car, farbe: "default" },
        { view, width: 1100, demoToken: dt },
      )
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
    <section className="mt-10 border-t border-hair pt-8">
      <div className="rounded-2xl border border-hair bg-ink-50/60 p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center gap-2.5">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-ink-900 text-white">
            <Rotate3d className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-[17px] font-semibold tracking-tight text-ink-900">
              All angles
            </h3>
            <p className="truncate text-[12px] text-ink-500">
              Drag, arrows or slider — turn {car.marke}{" "}
              {prettyModel(car.modell)} through every angle.
            </p>
          </div>
          <span className="ml-auto rounded-full border border-hair bg-white px-2.5 py-1 text-[11px] font-medium text-ink-600">
            {VIEW_LABEL[view] ?? view}
          </span>
        </div>
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
          All angles
        </span>
        <span className="text-ink-400">
          {isExt ? VIEW_LABEL[current] ?? current : "Interior view active"} ·{" "}
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
        aria-label="Rotate the vehicle"
        className="w-full cursor-ew-resize accent-ink-900"
      />
      <div className="mt-1 flex justify-between text-[9.5px] uppercase tracking-wider text-ink-300">
        <span>Front</span>
        <span>Left</span>
        <span>Rear</span>
        <span>Right</span>
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
            Overview · {cars.length} vehicles (model year 2010)
          </h3>
        </div>
        <span className="text-[12px] text-ink-400">
          {loading ? "loading…" : "tap to select"}
        </span>
      </div>
      {/* Raster: 5 pro Reihe → 10 Fahrzeuge in zwei Reihen. */}
      <div className="grid grid-cols-5 gap-3">
        {cars.map((c) => (
          <ShowroomCard
            key={`${c.marke}-${c.modell}-${c.jahr}-${c.body}-${c.trim}`}
            car={c}
            active={sameCarId(c, current)}
            onPick={onPick}
          />
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
  const dt = useContext(DemoTokenCtx);
  const [failed, setFailed] = useState(false);
  const url = carThumbApiUrl(
    { ...car, farbe: "default" },
    { view: "front_left", width: 360, demoToken: dt },
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
            Selected
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
