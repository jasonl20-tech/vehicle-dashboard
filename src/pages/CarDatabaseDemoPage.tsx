import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Code2,
  ImageIcon,
  Maximize2,
  Palette,
  Rotate3d,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import {
  createContext,
  type CSSProperties,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useApi } from "../lib/customerApi";
import {
  CAR_BRANDS_API,
  CAR_STATS_API,
  carDatabaseDetailUrl,
  carDatabaseListUrl,
  carThumbApiUrl,
  type BrandsResponse,
  type CarDetailResponse,
  type CarListResponse,
  type CarRow,
  type StatsResponse,
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

/**
 * Einheitlicher Abschnitts-Kopf (Nummer · Eyebrow · Titel · Kundentext). Gibt der
 * Demo den Charakter einer klaren, selbsterklärenden Präsentation statt einer
 * überladenen Webseite.
 */
function SectionHead({
  n,
  title,
  eyebrow,
  children,
}: {
  n: string;
  title: string;
  eyebrow?: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start gap-3 sm:gap-4">
      <div className="select-none font-display text-[26px] font-bold leading-none text-ink-200 sm:text-[32px]">
        {n}
      </div>
      <div className="max-w-2xl">
        {eyebrow && (
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-600">
            {eyebrow}
          </div>
        )}
        <h3 className="font-display text-[19px] font-semibold leading-tight tracking-tight text-ink-900 sm:text-[22px]">
          {title}
        </h3>
        {children && (
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-600">
            {children}
          </p>
        )}
      </div>
    </div>
  );
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

/** Dezente „Geist"-Lade-Animation, solange ein Auto-Bild noch lädt. */
function Spinner() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <span className="h-7 w-7 animate-spin rounded-full border-2 border-ink-200 border-t-ink-500" />
    </div>
  );
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
  // Fester heller Studio-Hintergrund (Showroom). Transparenz wird in der Hero
  // nicht mehr umgeschaltet (eigener Abschnitt 02 zeigt das Feature).
  const bg: BgMode = "showroom";
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
          { view: v, width: 720, demoToken },
        ),
      ),
    );
  }, [car, color, exterior, interior, demoToken]);

  // Aktuelle Ansicht in ALLEN Farben vorladen → Farbwechsel ist sofort da.
  useEffect(() => {
    if (!SPIN.includes(view)) return; // Innen-Ansichten sind farb-unabhängig
    colors.forEach((c) =>
      preloadImage(
        carThumbApiUrl({ ...car, farbe: c }, { view, width: 720, demoToken }),
      ),
    );
  }, [car, colors, view, demoToken]);

  const title = `${car.marke} ${prettyModel(car.modell)}`;

  // Beispiel-Fahrzeuge: ein FESTER Satz von 10 (bleibt bei jedem Aufruf gleich,
  // kein Random mehr). Demo-Link: die im Link gespeicherten Showroom-Fahrzeuge
  // (= derselbe Satz wie auf der Haupt-Demo).
  const showroom2010 = useMemo<CarId[]>(() => {
    if (isDemo) {
      const s = demo?.showroom?.length ? demo.showroom : (demo?.featured ?? []);
      return s.slice(0, 10);
    }
    return SHOWROOM_2010.slice(0, 10);
  }, [isDemo, demo]);

  // Angebotene Marken + Eckdaten (live, öffentlich gecacht — auch im Demo-Link).
  const brandsApi = useApi<BrandsResponse>(CAR_BRANDS_API);
  const brands = brandsApi.data?.brands ?? [];
  const statsApi = useApi<StatsResponse>(CAR_STATS_API);
  const totalImages = statsApi.data?.images ?? 0;

  const pick = (c: CarId) => {
    setCar(c);
    setPickerOpen(false);
  };

  // Hero nutzt feste Defaults (Transparenz-Schalter wurde entfernt).
  const out: OutOptions = {
    format: "png",
    transparent: false,
    width: 720,
    height: null,
    resolution: "default",
  };

  return (
    <DemoTokenCtx.Provider value={demoToken}>
    <div className="overflow-hidden rounded-2xl border border-hair bg-white">
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
              The car photography API
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* „Choose vehicle" nur intern (eingeloggt) — im Kunden-Link ausgeblendet. */}
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
        </div>
      </header>

      <div className="bg-paper px-4 py-5 sm:px-6">
        {/* Intro — große Demo-Überschrift + Überblick */}
        <div className="mb-7">
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-600">
            Vehicleimagery
          </div>
          <h2 className="mt-1 font-display text-[30px] font-bold leading-[1.05] tracking-tight text-ink-900 sm:text-[40px]">
            Demo
          </h2>
          <p className="mt-2.5 max-w-2xl text-[14.5px] leading-relaxed text-ink-600">
            This is a quick demo of our car image API. Pick a view and a color in
            the viewer below, then scroll down to see each feature on its own.
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
              bg={bg}
              out={out}
              onZoom={() => setZoom(true)}
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
              <p className="mt-2.5">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-600/10 px-2.5 py-1 text-[11.5px] font-medium text-brand-600">
                  <Sparkles className="h-3.5 w-3.5" />
                  We keep adding new colors
                </span>
              </p>
            </div>

            {/* Eckdaten der API (hervorgehoben) */}
            <div className="mt-5 rounded-xl border border-hair bg-ink-50/60 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-700">
                Our API in numbers
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Spec label="Colors" value={String(colors.length || 1)} />
                <Spec
                  label="Views"
                  value={String(exterior.length + interior.length)}
                />
                <Spec
                  label="Exterior / interior"
                  value={`${exterior.length} / ${interior.length}`}
                />
                <Spec
                  label="Images total"
                  value={
                    totalImages > 0 ? totalImages.toLocaleString("en-US") : "…"
                  }
                />
              </div>
            </div>
          </aside>
        </div>

        {/* Großer Trenner (zentriert): ab hier werden die API-Funktionen gezeigt */}
        <div className="mt-10 text-center">
          <h2 className="font-display text-[22px] font-bold tracking-tight text-ink-900 sm:text-[28px]">
            Our API features
          </h2>
          <p className="mx-auto mt-1 max-w-2xl text-[14px] leading-relaxed text-ink-600">
            Below you can try each feature of the API for yourself.
          </p>
        </div>

        {/* Weitere API-Bildoptionen */}
        <OutputOptionsSection />

        {/* 01 · Alle Ansichten / 360 */}
        <Spin360Section car={car} exterior={exterior} />

        {/* 02 · Transparenter Freisteller (Regler) */}
        <TransparentCompare car={car} />

        {/* 03 · Schatten — alle Ansichten, umschaltbar */}
        <ShadowSection car={car} exterior={exterior} />

        {/* 04 · Ground — mit/ohne, umschaltbar */}
        <GroundSection car={car} exterior={exterior} />

        {/* 05 · Mirroring — normal vs. gespiegelt */}
        <MirrorSection car={car} exterior={exterior} />

        {/* 06 · Marken-Übersicht (live) */}
        {brands.length > 0 && <BrandsSection brands={brands} />}

        {/* 07 · Dokumentation (vor den Beispiel-Bildern) */}
        <DocsSection />

        {/* 08 · Beispiel-Fahrzeuge (nur Schaufenster, nicht klickbar) */}
        <ShowroomGrid cars={showroom2010} />
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
  onPick: (v: string) => void;
  loading: boolean;
}) {
  const dt = useContext(DemoTokenCtx);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
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

  useEffect(() => {
    setFailed(false);
    setLoaded(false);
  }, [url]);

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
              onLoad={() => setLoaded(true)}
              onError={() => setFailed(true)}
              className={`max-h-full max-w-full object-contain transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
              style={{ filter: "drop-shadow(0 26px 24px rgba(0,0,0,0.22))" }}
            />
          ) : (
            <ImageIcon className="h-10 w-10 text-ink-300" />
          )}
        </div>

        {(loading || (!!url && !loaded && !failed)) && (
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
      { view: v, width: 110, demoToken: dt },
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
    <div className="rounded-lg border border-hair bg-white px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-ink-400">
        {label}
      </div>
      <div className="truncate text-[17px] font-semibold leading-tight text-ink-900">
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
    { view: "front_left", width: 560, demoToken: dt },
  );
  const trpUrl = carThumbApiUrl(
    { ...car, farbe: "default" },
    { view: "front_left", width: 560, transparent: true, demoToken: dt },
  );

  return (
    <section className="mt-6 rounded-2xl border border-hair bg-white p-4 sm:p-5">
      <SectionHead n="02" title="Transparent background">
        You can get the car as a cut-out with no background (a transparent PNG),
        so it sits on any layout or color. Drag the slider to compare it with the
        studio background.
      </SectionHead>
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
    </section>
  );
}

/** Umschalter (An/Aus) als segmentierte Pille — für die Shadow/Ground-Abschnitte. */
function Switch({
  on,
  onToggle,
  labelOn,
  labelOff,
}: {
  on: boolean;
  onToggle: () => void;
  labelOn: string;
  labelOff: string;
}) {
  const base = "rounded-md px-3 py-1.5 text-[12px] font-medium transition";
  return (
    <div className="inline-flex shrink-0 rounded-lg border border-hair bg-white p-0.5">
      <button
        type="button"
        onClick={() => !on && onToggle()}
        className={`${base} ${on ? "bg-ink-900 text-white" : "text-ink-500 hover:text-ink-900"}`}
      >
        {labelOn}
      </button>
      <button
        type="button"
        onClick={() => on && onToggle()}
        className={`${base} ${!on ? "bg-ink-900 text-white" : "text-ink-500 hover:text-ink-900"}`}
      >
        {labelOff}
      </button>
    </div>
  );
}

const SOFT_BG: CSSProperties = {
  background:
    "radial-gradient(120% 90% at 50% 15%, #ffffff 0%, #f3f5f8 55%, #e6eaf0 100%)",
};

/** 03 · Schatten — alle Ansichten, per Schalter mit/ohne Schatten. */
function ShadowSection({
  car,
  exterior,
}: {
  car: CarId;
  exterior: string[];
}) {
  const dt = useContext(DemoTokenCtx);
  const [on, setOn] = useState(true);
  const views = exterior.length ? exterior : SPIN;
  return (
    <section className="mt-6 rounded-2xl border border-hair bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionHead n="03" title="Shadow">
          A studio drop shadow under the car, available on every angle. Use the
          switch to turn it on or off.
        </SectionHead>
        <Switch
          on={on}
          onToggle={() => setOn((v) => !v)}
          labelOn="Shadow on"
          labelOff="Shadow off"
        />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {views.map((v) => (
          <ShadowTile key={v} car={car} view={v} shadow={on} dt={dt} />
        ))}
      </div>
    </section>
  );
}

function ShadowTile({
  car,
  view,
  shadow,
  dt,
}: {
  car: CarId;
  view: string;
  shadow: boolean;
  dt: string;
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const url = carThumbApiUrl(
    { ...car, farbe: "default" },
    { view, width: 380, shadow, demoToken: dt },
  );
  useEffect(() => {
    setFailed(false);
    setLoaded(false);
  }, [url]);
  return (
    <div
      className="relative aspect-[4/3] overflow-hidden rounded-lg border border-hair"
      style={SOFT_BG}
    >
      <div className="absolute inset-0 flex items-center justify-center p-4">
        {url && !failed ? (
          <img
            src={url}
            alt={`${prettyModel(car.modell)} ${VIEW_LABEL[view] ?? view}`}
            loading="lazy"
            draggable={false}
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            className={`max-h-full max-w-full object-contain transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
          />
        ) : (
          <ImageIcon className="h-6 w-6 text-ink-300" />
        )}
      </div>
      {!!url && !loaded && !failed && <Spinner />}
    </div>
  );
}

/** 04 · Ground — links mit, rechts ohne Boden-Verankerung (Gegenüberstellung). */
function GroundSection({
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
  const withUrl = carThumbApiUrl(
    { ...car, farbe: "default" },
    { view: v, width: 480, ground: true, transparent: true, demoToken: dt },
  );
  const withoutUrl = carThumbApiUrl(
    { ...car, farbe: "default" },
    { view: v, width: 480, transparent: true, demoToken: dt },
  );
  return (
    <section className="mt-6 rounded-2xl border border-hair bg-white p-4 sm:p-5">
      <SectionHead n="04" title="Ground">
        Ground places the car's wheels on the same floor line, so several cars
        line up at the same height instead of floating at different heights. Left
        with ground, right without.
      </SectionHead>
      <div className="grid gap-4 sm:grid-cols-2">
        <CompareTile
          label="With ground"
          caption="ground=true"
          url={withUrl}
          alt={`${prettyModel(car.modell)} on the ground`}
        />
        <CompareTile
          label="Without ground"
          caption="ground=false"
          url={withoutUrl}
          alt={`${prettyModel(car.modell)} floating`}
        />
      </div>
    </section>
  );
}

/** 05 · Mirroring — dasselbe Bild normal vs. horizontal gespiegelt (Gegenüberstellung). */
function MirrorSection({
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
  // Beide Seiten auf reinem Weiß: „ohne" = Auto auf Weiß, „mit" = Boden-
  // Reflexion. (Die Reflexion braucht technisch die transparente Variante.)
  const normalUrl = carThumbApiUrl(
    { ...car, farbe: "default" },
    { view: v, width: 480, transparent: true, demoToken: dt },
  );
  const mirrorUrl = carThumbApiUrl(
    { ...car, farbe: "default" },
    { view: v, width: 480, transparent: true, mirroring: true, demoToken: dt },
  );
  return (
    <section className="mt-6 rounded-2xl border border-hair bg-white p-4 sm:p-5">
      <SectionHead n="05" title="Reflection (mirroring)">
        Mirroring adds a reflection of the car on the floor: a faded copy of the
        car beneath itself, not a black shadow. On the left without it, on the
        right with it.
      </SectionHead>
      <div className="grid gap-4 sm:grid-cols-2">
        <CompareTile
          label="Mirroring off"
          caption="mirroring=false"
          url={normalUrl}
          alt={`${prettyModel(car.modell)} normal`}
        />
        <CompareTile
          label="Mirroring on"
          caption="mirroring=true"
          url={mirrorUrl}
          alt={`${prettyModel(car.modell)} mirrored`}
        />
      </div>
    </section>
  );
}

/** Vergleichskachel: Bild mit Eck-Label + Mono-Caption (für Ground/Mirroring). */
function CompareTile({
  label,
  caption,
  url,
  alt,
}: {
  label: string;
  caption: string;
  url: string | null;
  alt: string;
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    setFailed(false);
    setLoaded(false);
  }, [url]);
  return (
    <div>
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-hair bg-white">
        <div className="absolute inset-0 flex items-center justify-center p-6">
          {url && !failed ? (
            <img
              src={url}
              alt={alt}
              draggable={false}
              onLoad={() => setLoaded(true)}
              onError={() => setFailed(true)}
              className={`max-h-full max-w-full object-contain transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
            />
          ) : (
            <ImageIcon className="h-10 w-10 text-ink-300" />
          )}
        </div>
        {!!url && !loaded && !failed && <Spinner />}
        <span className="absolute left-3 top-3 rounded-full bg-ink-900/80 px-2.5 py-0.5 text-[11px] font-medium text-white">
          {label}
        </span>
      </div>
      <div className="mt-1.5 text-center font-mono text-[11px] text-ink-400">
        {caption}
      </div>
    </div>
  );
}

/** Ein Marken-Logo (von unserer Website /manufactures/{slug}_logo.svg) mit
 *  Text-Fallback, falls für die Marke (noch) kein Logo existiert. */
function BrandLogo({ brand }: { brand: string }) {
  const [failed, setFailed] = useState(false);
  const src = `https://vehicleimagery.com/manufactures/${brand.toLowerCase()}_logo.svg`;
  return (
    <div
      className="flex h-16 items-center justify-center rounded-xl border border-hair bg-white p-3"
      title={prettyModel(brand)}
    >
      {failed ? (
        <span className="text-center text-[11.5px] font-medium leading-tight text-ink-600">
          {prettyModel(brand)}
        </span>
      ) : (
        <img
          src={src}
          alt={prettyModel(brand)}
          loading="lazy"
          onError={() => setFailed(true)}
          className="max-h-9 max-w-[82%] object-contain opacity-75 grayscale transition duration-200 hover:opacity-100 hover:grayscale-0"
        />
      )}
    </div>
  );
}

/** 06 · Coverage — Marken-Logo-Wall (live), per Klick auf „+N more" voll ausklappbar. */
function BrandsSection({ brands }: { brands: string[] }) {
  const MAX = 48;
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? brands : brands.slice(0, MAX);
  const hasMore = brands.length > MAX;
  return (
    <section className="mt-6 rounded-2xl border border-hair bg-white p-4 sm:p-5">
      <SectionHead n="06" title="Brands we cover">
        These are the brands you can request through the API, {brands.length} in
        total, and we keep adding more.
      </SectionHead>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6">
        {shown.map((b) => (
          <BrandLogo key={b} brand={b} />
        ))}
      </div>
      {hasMore && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-ink-200 bg-ink-50 px-4 py-2.5 text-[13px] font-semibold text-ink-800 transition hover:bg-ink-100"
        >
          {showAll ? (
            <>
              Show fewer
              <ChevronUp className="h-4 w-4" />
            </>
          ) : (
            <>
              Show all {brands.length} brands
              <ChevronDown className="h-4 w-4" />
            </>
          )}
        </button>
      )}
    </section>
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
      title: "File formats",
      desc: "Pick whatever your stack needs.",
      tags: ["PNG", "JPEG", "WebP", "AVIF"],
    },
    {
      icon: Sparkles,
      title: "Resolution",
      desc: "Size & quality presets, or exact pixels.",
      tags: ["thumb", "small", "medium", "large", "full"],
    },
    {
      icon: Maximize2,
      title: "Custom size",
      desc: "Request exact pixels, any ratio.",
      tags: ["Width", "Height", "Any ratio"],
    },
  ];
  return (
    <section className="mt-6 rounded-2xl border border-hair bg-white p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-600/10 text-brand-600">
          <Code2 className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h3 className="font-display text-[17px] font-semibold tracking-tight text-ink-900">
            More output options
          </h3>
          <p className="text-[12.5px] leading-snug text-ink-500">
            These don't show in this small preview, but they work for every
            image.
          </p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {items.map((it) => (
          <div
            key={it.title}
            className="rounded-xl border border-hair bg-ink-50/50 p-4"
          >
            <div className="flex items-center gap-2.5">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-600/10 text-brand-600">
                <it.icon className="h-[18px] w-[18px]" />
              </span>
              <div className="text-[14px] font-semibold text-ink-900">
                {it.title}
              </div>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {it.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-md border border-hair bg-white px-2 py-0.5 text-[11px] font-medium text-ink-700"
                >
                  {t}
                </span>
              ))}
            </div>
            <div className="mt-2 text-[11.5px] leading-relaxed text-ink-500">
              {it.desc}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/** 08 · Dokumentation — kompakte, doku-artige Übersicht (statt roher Code-Vorschau),
 *  an die Struktur der Website-Doku angelehnt. */
function DocsSection() {
  const groups: { label: string; items: string[] }[] = [
    {
      label: "Authentication",
      items: [
        "Simple GET requests",
        "Header: x-api-key",
        "Base URL: api.vehicleimagery.com",
      ],
    },
    {
      label: "Addressing a vehicle",
      items: [
        "Path: brand / model / year / variant / trim / view",
        "List brands, models, years, variants and trims",
        "Per vehicle: colors, views and features",
        "Get all configurations in one call",
      ],
    },
    {
      label: "Views",
      items: [
        "8 exterior angles (front, front-left, … front-right)",
        "Interior: dashboard, center console",
        "Combine into a 360°-style view",
      ],
    },
    {
      label: "Formats & size",
      items: [
        "Formats: PNG, JPEG, WebP, AVIF, auto",
        "Resolution presets: thumb, small, medium, large, full",
        "Exact width & height in pixels",
        "Aspect ratios: 1:1, 4:3, 3:2, 16:9, 21:9, …",
        "Quality: 40–100",
      ],
    },
    {
      label: "Image looks",
      items: [
        "Transparent background (cut-out)",
        "Studio shadow",
        "Ground (wheels on the floor)",
        "Reflection (mirroring)",
        "Any color",
        "Watermark on test/trial keys",
      ],
    },
    {
      label: "Delivery",
      items: [
        "Served via global CDN, long cache",
        "Documented HTTP status codes",
        "Error notes (fallback codes)",
      ],
    },
  ];
  return (
    <section className="mt-6 rounded-2xl border border-hair bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionHead n="07" title="Documentation">
          A short overview of what the API offers. The full reference, with every
          endpoint and parameter, is in the documentation.
        </SectionHead>
        <a
          href="https://vehicleimagery.com/documentation"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-[12px] font-medium text-ink-700 transition hover:bg-ink-50"
        >
          <Code2 className="h-3.5 w-3.5" />
          Full documentation
        </a>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((g) => (
          <div
            key={g.label}
            className="rounded-xl border border-hair bg-ink-50/50 p-4"
          >
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-800">
              {g.label}
            </div>
            <ul className="mt-2 space-y-1.5">
              {g.items.map((it) => (
                <li
                  key={it}
                  className="flex gap-1.5 text-[12px] leading-snug text-ink-600"
                >
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-400" />
                  <span>{it}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
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
}: {
  car: CarId;
  exterior: string[];
}) {
  const dt = useContext(DemoTokenCtx);
  const [idx, setIdx] = useState(0);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
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
          { view: v, width: 720, transparent: true, demoToken: dt },
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
        { view, width: 720, transparent: true, demoToken: dt },
      )
    : null;

  useEffect(() => {
    setFailed(false);
    setLoaded(false);
  }, [url]);

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
    <section className="mt-6 rounded-2xl border border-hair bg-white p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <SectionHead n="01" title="360° view">
            We don't offer a real 360° view like most people know it. But you can
            create a kind of 360° view from our eight views. Drag it, or use the
            arrows and the slider below.
          </SectionHead>
          <span className="shrink-0 rounded-full border border-hair bg-white px-2.5 py-1 text-[11px] font-medium text-ink-600">
            {VIEW_LABEL[view] ?? view}
          </span>
        </div>
        <div className="relative">
          {/* Fester Bild-Kasten: aspect-[16/9] bestimmt die Größe allein, das
              Bild liegt absolut darin → kein Größensprung beim Drehen. */}
          <div
            className="relative aspect-[16/9] cursor-ew-resize overflow-hidden rounded-xl border border-hair bg-white"
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
                  onLoad={() => setLoaded(true)}
                  onError={() => setFailed(true)}
                  className={`max-h-full max-w-full object-contain transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
                  style={{ filter: "drop-shadow(0 26px 24px rgba(0,0,0,0.22))" }}
                />
              ) : (
                <ImageIcon className="h-10 w-10 text-ink-300" />
              )}
            </div>
            {!!url && !loaded && !failed && <Spinner />}
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

/** 08 · Beispiel-Fahrzeuge — reines Schaufenster (nicht klickbar), zufällig. */
function ShowroomGrid({ cars }: { cars: CarId[] }) {
  return (
    <section className="mt-6 rounded-2xl border border-hair bg-white p-4 sm:p-5">
      <SectionHead n="08" title="Example vehicles">
        A few example cars from the API. Any make, model and year is available on
        request.
      </SectionHead>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {cars.map((c) => (
          <ShowroomCard
            key={`${c.marke}-${c.modell}-${c.jahr}-${c.body}-${c.trim}`}
            car={c}
          />
        ))}
      </div>
    </section>
  );
}

function ShowroomCard({ car }: { car: CarId }) {
  const dt = useContext(DemoTokenCtx);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const url = carThumbApiUrl(
    { ...car, farbe: "default" },
    { view: "front_left", width: 260, demoToken: dt },
  );
  return (
    <div className="overflow-hidden rounded-xl border border-hair bg-white">
      <div className="relative flex aspect-[4/3] items-center justify-center bg-white p-2.5">
        {url && !failed ? (
          <img
            src={url}
            alt={`${car.marke} ${prettyModel(car.modell)}`}
            loading="lazy"
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            className={`max-h-full max-w-full object-contain transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
          />
        ) : (
          <ImageIcon className="h-7 w-7 text-ink-300" />
        )}
        {!!url && !loaded && !failed && <Spinner />}
      </div>
      <div className="border-t border-hair px-2.5 py-1.5">
        <div className="truncate text-[12px] font-semibold text-ink-900">
          {car.marke} {prettyModel(car.modell)}
        </div>
        <div className="text-[10.5px] text-ink-400">{car.jahr}</div>
      </div>
    </div>
  );
}
