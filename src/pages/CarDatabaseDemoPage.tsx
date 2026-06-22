import {
  Award,
  BadgeCheck,
  Boxes,
  Calculator,
  Calendar,
  Car,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Code2,
  Fuel,
  Gauge,
  Heart,
  ImageIcon,
  Layers,
  Mail,
  MapPin,
  Maximize2,
  Minimize2,
  Palette,
  Phone,
  Rotate3d,
  Search,
  Share2,
  ShieldCheck,
  Sparkles,
  Star,
  X,
  Zap,
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

/** Fiktiver Kunde (Händler/Marktplatz), in dessen Auftritt die Demo läuft. */
const DEALER = {
  name: "NorthLane Motors",
  tagline: "Premium-Fahrzeuge",
};

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

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function fakeSpecs(car: CarId) {
  const h = hashStr(`${car.marke}|${car.modell}|${car.jahr}`);
  const m = car.modell.toLowerCase();
  const isEv =
    car.marke.toLowerCase() === "tesla" ||
    m.includes("e-tron") ||
    m.includes("e_tron") ||
    /^i\d/.test(m) ||
    m.startsWith("ix") ||
    m.includes("id.") ||
    m.includes("ev");
  const fuels = ["Benzin", "Diesel", "Mild-Hybrid"];
  const fuel = isEv ? "Elektro" : fuels[h % fuels.length];
  const price = 24900 + (h % 79000);
  const power = isEv ? 250 + (h % 360) : 110 + (h % 320);
  const km = 1000 + (h % 78000);
  return {
    price,
    powerHp: power,
    powerKw: Math.round(power * 0.7355),
    fuel,
    km,
    gearbox: isEv ? "Automatik (1-Gang)" : h % 2 ? "Automatik" : "Schaltgetriebe",
    firstReg: `${["01", "03", "06", "09"][h % 4]}/${car.jahr}`,
    isEv,
  };
}

const fmtEur = (n: number) =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
const fmtNum = (n: number) => new Intl.NumberFormat("de-DE").format(n);

/** Pool an Ausstattungsmerkmalen — deterministisch je Auto ausgewählt. */
const EQUIPMENT_POOL = [
  "LED-Matrix-Scheinwerfer",
  "Navigationssystem",
  "Panorama-Glasdach",
  "Sitzheizung vorn",
  "Adaptiver Tempomat",
  "Rückfahrkamera",
  "Apple CarPlay",
  "Android Auto",
  "Head-up-Display",
  "Keyless-Go",
  "Elektrische Heckklappe",
  '18"-Leichtmetallfelgen',
  "Einparkhilfe vorn & hinten",
  "Klimaautomatik (3-Zonen)",
  "Lederausstattung",
  "DAB+ Digitalradio",
  "Spurhalteassistent",
  "Totwinkel-Assistent",
  "Ambientebeleuchtung",
  "Wireless Charging",
];

/** Stabile Pseudo-Zufallsauswahl (kein Math.random → bei jedem Render gleich). */
function fakeEquipment(car: CarId): string[] {
  let seed = hashStr(`${car.marke}|${car.modell}|${car.jahr}|equip`);
  const pool = [...EQUIPMENT_POOL];
  const out: string[] = [];
  const count = 9 + (seed % 4); // 9–12 Merkmale
  while (out.length < count && pool.length) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    out.push(pool.splice(seed % pool.length, 1)[0]);
  }
  return out;
}

/** Einfache Finanzierungsrechnung (Annuität) für den Finanzierungs-Teaser. */
function financing(price: number) {
  const months = 60;
  const anzahlung = Math.round((price * 0.2) / 500) * 500; // ~20 %
  const financed = Math.max(0, price - anzahlung);
  const apr = 0.039;
  const m = apr / 12;
  const rate = Math.round(
    (financed * m) / (1 - Math.pow(1 + m, -months)),
  );
  return { months, anzahlung, rate, apr };
}

type Review = { name: string; date: string; stars: number; text: string };
const REVIEWS: Review[] = [
  {
    name: "Markus Brandt",
    date: "vor 2 Wochen",
    stars: 5,
    text: "Super Beratung, transparente Preise und die Fotos im Inserat haben exakt dem Fahrzeug entsprochen. Probefahrt war unkompliziert.",
  },
  {
    name: "Sandra Keller",
    date: "vor 1 Monat",
    stars: 5,
    text: "Vom ersten Kontakt bis zur Übergabe alles top organisiert. Finanzierung wurde mir verständlich erklärt — gerne wieder!",
  },
  {
    name: "Tobias Reinhardt",
    date: "vor 1 Monat",
    stars: 4,
    text: "Faire Inzahlungnahme meines Altwagens. Abwicklung etwas zügiger gewünscht, aber insgesamt sehr zufrieden.",
  },
];

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

export default function CarDatabaseDemoPage() {
  const [car, setCar] = useState<CarId>(FEATURED[0]);
  const [color, setColor] = useState("white");
  const [view, setView] = useState("front_left");
  // Hintergrund der Hero-Bühne (nur Showroom/Studio). Transparent ist ein
  // eigener Schalter, der ausschließlich die Hero betrifft.
  const [bg, setBg] = useState<"showroom" | "studio">("showroom");
  const [transparent, setTransparent] = useState(false);
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

  // Verfügbare Farben + Ansichten des Autos.
  const colors = useMemo(
    () => (detail?.colors ?? []).map((c) => c.farbe),
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
    if (colors.length && !colors.includes(color)) {
      setColor(colors.includes("white") ? "white" : colors[0]);
    }
  }, [colors, color]);
  // Fehlt die aktuelle Außen-Ansicht beim gewählten Auto → erste verfügbare.
  useEffect(() => {
    if (!availViews.size) return;
    if (SPIN.includes(view) && !availViews.has(view)) {
      setView(exterior[0] ?? interior[0] ?? view);
    }
  }, [availViews, view, exterior, interior]);

  // Alle Außen-Ansichten der aktuellen Farbe vorladen → flüssiger 360°-Dreh.
  useEffect(() => {
    exterior.forEach((v) => {
      const u = carThumbApiUrl({ ...car, farbe: color }, { view: v, width: 900 });
      if (u) {
        const img = new Image();
        img.src = u;
      }
    });
  }, [car, color, exterior]);

  const specs = useMemo(() => fakeSpecs(car), [car]);
  const equipment = useMemo(() => fakeEquipment(car), [car]);
  const finance = useMemo(() => financing(specs.price), [specs.price]);
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

  return (
    <div
      className={
        presenting
          ? "fixed inset-0 z-50 overflow-y-auto bg-white"
          : "overflow-hidden rounded-xl border border-hair"
      }
    >
      {/* Kunden-Header */}
      <header className="flex items-center justify-between gap-3 border-b border-ink-100 bg-white px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-ink-900 text-white">
            <span className="text-[15px] font-bold">N</span>
          </div>
          <div className="leading-tight">
            <div className="text-[14px] font-semibold tracking-tight text-ink-900">
              {DEALER.name}
            </div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-ink-400">
              {DEALER.tagline}
            </div>
          </div>
        </div>
        <nav className="hidden items-center gap-5 text-[13px] text-ink-500 md:flex">
          <span className="font-medium text-ink-900">Fahrzeuge</span>
          <span>Leasing</span>
          <span>Service</span>
          <span>Kontakt</span>
        </nav>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3 py-1.5 text-[12px] font-medium text-ink-700 hover:bg-ink-50"
          >
            <Search className="h-3.5 w-3.5" />
            Fahrzeug
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
        {/* Breadcrumb */}
        <div className="mb-3 flex items-center gap-1.5 text-[11px] text-ink-400">
          <span>Fahrzeuge</span>
          <ChevronRight className="h-3 w-3" />
          <span>{car.marke}</span>
          <ChevronRight className="h-3 w-3" />
          <span className="text-ink-600">{prettyModel(car.modell)}</span>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          {/* Viewer */}
          <div>
            <Stage
              car={car}
              color={color}
              view={view}
              bg={transparent ? "transparent" : bg}
              transparent={transparent}
              onZoom={() => setZoom(true)}
              onToggleTransparent={() => setTransparent((t) => !t)}
              loading={detailApi.loading && !detail}
            />

            {/* Hintergrund + Transparent-Schalter */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-medium uppercase tracking-wider text-ink-400">
                Hintergrund
              </span>
              <div className="inline-flex rounded-lg border border-hair bg-white p-0.5">
                <SegBtn
                  active={!transparent && bg === "showroom"}
                  onClick={() => {
                    setTransparent(false);
                    setBg("showroom");
                  }}
                >
                  Showroom
                </SegBtn>
                <SegBtn
                  active={!transparent && bg === "studio"}
                  onClick={() => {
                    setTransparent(false);
                    setBg("studio");
                  }}
                >
                  Studio
                </SegBtn>
              </div>
              <button
                type="button"
                onClick={() => setTransparent((t) => !t)}
                aria-pressed={transparent}
                title="Echtes transparentes PNG über die API anzeigen"
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium transition ${
                  transparent
                    ? "border-ink-900 bg-ink-900 text-white"
                    : "border-ink-200 bg-white text-ink-700 hover:bg-ink-50"
                }`}
              >
                <Layers className="h-3.5 w-3.5" />
                Transparent (PNG)
                <span
                  className={`ml-0.5 inline-block h-2 w-2 rounded-full ${
                    transparent ? "bg-emerald-400" : "bg-ink-300"
                  }`}
                />
              </button>
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

          {/* Listing-Infos */}
          <aside>
            <h1 className="text-[22px] font-semibold leading-tight tracking-tight text-ink-900">
              {title}
            </h1>
            <div className="mt-0.5 text-[13px] text-ink-500">
              {car.jahr} · {specs.fuel} · {specs.powerHp} PS
            </div>

            <div className="mt-2 flex items-center gap-1.5 text-[11.5px] text-ink-500">
              <RatingStars value={4.8} />
              <span>4,8 · 127 Bewertungen</span>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-ink-500">
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-ink-400" />
                EZ {specs.firstReg}
              </span>
              <span className="inline-flex items-center gap-1">
                <Gauge className="h-3.5 w-3.5 text-ink-400" />
                {fmtNum(specs.km)} km
              </span>
              <span className="inline-flex items-center gap-1">
                <Fuel className="h-3.5 w-3.5 text-ink-400" />
                {specs.fuel}
              </span>
            </div>

            <div className="mt-3 text-[24px] font-bold text-ink-900">
              {fmtEur(specs.price)}
              <span className="ml-2 align-middle text-[11px] font-normal text-ink-400">
                inkl. MwSt.
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <Spec label="Erstzulassung" value={specs.firstReg} />
              <Spec label="Kilometer" value={`${fmtNum(specs.km)} km`} />
              <Spec label="Leistung" value={`${specs.powerKw} kW (${specs.powerHp} PS)`} />
              <Spec label="Kraftstoff" value={specs.fuel} />
              <Spec label="Getriebe" value={specs.gearbox} />
              <Spec label="Karosserie" value={car.body} />
            </div>

            {/* Farben */}
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

            {/* Merken / Teilen */}
            <div className="mt-5 flex gap-2">
              <button className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 py-2 text-[12px] font-medium text-ink-600 hover:bg-ink-50">
                <Heart className="h-3.5 w-3.5" />
                Merken
              </button>
              <button className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 py-2 text-[12px] font-medium text-ink-600 hover:bg-ink-50">
                <Share2 className="h-3.5 w-3.5" />
                Teilen
              </button>
            </div>

            {/* CTAs */}
            <div className="mt-3 space-y-2">
              <button className="w-full rounded-lg bg-ink-900 px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-ink-800">
                Probefahrt buchen
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button className="rounded-lg border border-ink-200 bg-white px-4 py-2.5 text-[13px] font-medium text-ink-700 hover:bg-ink-50">
                  Angebot anfragen
                </button>
                <button className="rounded-lg border border-ink-200 bg-white px-4 py-2.5 text-[13px] font-medium text-ink-700 hover:bg-ink-50">
                  Finanzierung
                </button>
              </div>
            </div>

            {/* Vertrauens-Zeile */}
            <div className="mt-5 rounded-lg border border-hair bg-white p-3">
              <div className="flex items-center gap-1.5 text-[12px] font-medium text-ink-700">
                <Sparkles className="h-3.5 w-3.5 text-brand-600" />
                Studio-Bilder in 8 Perspektiven
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-ink-500">
                Alle Aufnahmen farbtreu, freistellbar und blitzschnell geladen —
                bereitgestellt über die Vehicleimagery-API.
              </p>
            </div>
          </aside>
        </div>

        {/* 360°-Rundumblick (eigener Abschnitt) — immer Standardfarbe */}
        <Spin360Section car={car} exterior={exterior} bg={bg} />

        {/* Übersicht · 10 Fahrzeuge (Baujahr 2010) */}
        <ShowroomGrid
          cars={showroom2010}
          current={car}
          onPick={pick}
          loading={showroomApi.loading && !showroomApi.data}
        />

        {/* Ausstattung & Highlights */}
        <Highlights items={equipment} />

        {/* Finanzierung */}
        <FinanceTeaser price={specs.price} finance={finance} />

        {/* Feature-Band */}
        <FeatureBand />

        {/* Farbvergleich */}
        {colors.length >= 2 && (
          <ColorCompare car={car} colors={colors} />
        )}

        {/* Kundenbewertungen */}
        <Reviews />

        {/* Händler / Standort */}
        <DealerInfo />

        {/* API-Vorschau */}
        <ApiPanel
          car={car}
          view={view}
          color={color}
          open={showApi}
          onToggle={() => setShowApi((v) => !v)}
        />

        {/* Footer */}
        <DealerFooter />
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
          transparent={transparent}
          onClose={() => setZoom(false)}
        />
      )}
    </div>
  );
}

/**
 * Hero-Bühne: zeigt die gewählte Perspektive in der gewählten Farbe. KEIN
 * 360°-Dreh (das gibt es im eigenen Abschnitt). Der Transparent-Schalter
 * fragt ein echtes Freisteller-PNG über die API an und zeigt es auf einem
 * Karo-Hintergrund, der die Transparenz sichtbar macht.
 */
function Stage({
  car,
  color,
  view,
  bg,
  transparent,
  onZoom,
  onToggleTransparent,
  loading,
}: {
  car: CarId;
  color: string;
  view: string;
  bg: BgMode;
  transparent: boolean;
  onZoom: () => void;
  onToggleTransparent: () => void;
  loading: boolean;
}) {
  const [failed, setFailed] = useState(false);
  // Innenraum-Bilder sind farb-unabhängig → über „default" laden.
  const imgFarbe = SPIN.includes(view) ? color : "default";
  const url = carThumbApiUrl(
    { ...car, farbe: imgFarbe },
    { view, width: 900, transparent },
  );

  useEffect(() => setFailed(false), [url]);

  return (
    <div className="relative">
      <div
        className="relative overflow-hidden rounded-xl border border-hair"
        style={stageStyle(bg)}
      >
        <div className="relative flex aspect-[16/10] items-center justify-center p-4 select-none">
          {url && !failed ? (
            <img
              src={url}
              alt={`${car.marke} ${prettyModel(car.modell)} ${VIEW_LABEL[view] ?? view}`}
              draggable={false}
              onError={() => setFailed(true)}
              className="max-h-full max-w-full object-contain drop-shadow-xl"
              style={{ filter: "drop-shadow(0 26px 24px rgba(0,0,0,0.22))" }}
            />
          ) : (
            <div className="grid place-items-center text-ink-300">
              <ImageIcon className="h-10 w-10" />
            </div>
          )}
          {loading && (
            <div className="absolute inset-0 grid place-items-center bg-white/40 backdrop-blur-[1px]">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-ink-300 border-t-ink-700" />
            </div>
          )}
        </div>

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
          aria-pressed={transparent}
          title="Echtes transparentes PNG über die API anzeigen"
          className={`absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-medium shadow backdrop-blur transition ${
            transparent
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

const FEATURES = [
  { icon: Rotate3d, title: "8 Perspektiven", desc: "Rundum-Ansicht für jedes Fahrzeug." },
  { icon: Palette, title: "Farbtreue Lacke", desc: "Kalibrierte, konsistente Farben." },
  { icon: Layers, title: "Freisteller", desc: "Transparente PNGs für jedes Layout." },
  { icon: Sparkles, title: "Studio-Qualität", desc: "Einheitlich wie aus dem Fotostudio." },
  { icon: Zap, title: "Blitzschnell", desc: "Global gecachtes CDN, ~50 ms." },
  { icon: Boxes, title: "Innenraum", desc: "Cockpit & Mittelkonsole inklusive." },
];

function FeatureBand() {
  return (
    <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {FEATURES.map((f) => (
        <div key={f.title} className="rounded-lg border border-hair bg-white p-3">
          <f.icon className="h-5 w-5 text-brand-600" />
          <div className="mt-1.5 text-[12.5px] font-semibold text-ink-900">
            {f.title}
          </div>
          <div className="mt-0.5 text-[11px] leading-snug text-ink-500">
            {f.desc}
          </div>
        </div>
      ))}
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

function ApiPanel({
  car,
  view,
  color,
  open,
  onToggle,
}: {
  car: CarId;
  view: string;
  color: string;
  open: boolean;
  onToggle: () => void;
}) {
  const path = `/api/${car.marke}/${prettyModel(car.modell).replace(/ /g, "_")}/${car.jahr}/${view}`;
  const colorQ = color && color !== "default" ? `?color=${color}` : "";
  return (
    <div className="mt-8 rounded-xl border border-hair bg-white">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
      >
        <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-ink-900">
          <Code2 className="h-4 w-4 text-brand-600" />
          So einfach kommt dieses Bild aus der API
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
              {colorQ}
            </div>
            <div className="text-ink-400">x-api-key: VI-••••••••••••••••</div>
            <div className="mt-1 text-ink-400">
              → 200 · image/png · studio-quality, farbtreu
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {[
              "Formate: PNG · JPG · WebP",
              "Auflösungen wählbar",
              "transparent=true (Freisteller)",
              "shadow=true",
              "getall: alle 8 Ansichten auf einmal",
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
            Foto-Shoot, kein Hosting, kein Freistellen.
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
  transparent,
  onClose,
}: {
  car: CarId;
  color: string;
  view: string;
  transparent: boolean;
  onClose: () => void;
}) {
  const imgFarbe = SPIN.includes(view) ? color : "default";
  const url = carThumbApiUrl(
    { ...car, farbe: imgFarbe },
    { view, width: 1500, transparent },
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
        <img
          src={url}
          alt={`${car.marke} ${prettyModel(car.modell)}`}
          onClick={(e) => e.stopPropagation()}
          style={transparent ? CHECKER : undefined}
          className={`max-h-[88vh] max-w-[94vw] object-contain ${
            transparent ? "rounded-lg" : ""
          }`}
        />
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
    exterior.forEach((v) => {
      const u = carThumbApiUrl(
        { ...car, farbe: "default" },
        { view: v, width: 1100 },
      );
      if (u) {
        const img = new Image();
        img.src = u;
      }
    });
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
          <div
            className="relative cursor-ew-resize overflow-hidden rounded-xl border border-hair"
            style={stageStyle(bg)}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerLeave={onUp}
          >
            <div className="relative flex aspect-[16/9] select-none items-center justify-center p-6">
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

function RatingStars({ value }: { value: number }) {
  return (
    <span
      className="inline-flex items-center gap-0.5"
      aria-label={`${value} von 5 Sternen`}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${
            i <= Math.round(value)
              ? "fill-amber-400 text-amber-400"
              : "text-ink-200"
          }`}
        />
      ))}
    </span>
  );
}

function Highlights({ items }: { items: string[] }) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center gap-2">
        <BadgeCheck className="h-4 w-4 text-brand-600" />
        <h3 className="text-[15px] font-semibold tracking-tight text-ink-900">
          Ausstattung &amp; Highlights
        </h3>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => (
          <div
            key={it}
            className="flex items-center gap-2 rounded-lg border border-hair bg-white px-3 py-2 text-[12.5px] text-ink-700"
          >
            <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
            <span className="truncate">{it}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function FinanceTeaser({
  price,
  finance,
}: {
  price: number;
  finance: ReturnType<typeof financing>;
}) {
  return (
    <section className="mt-8 overflow-hidden rounded-xl border border-hair bg-white">
      <div className="grid sm:grid-cols-[1.2fr_1fr]">
        <div className="border-b border-hair p-5 sm:border-b-0 sm:border-r">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-ink-900">
            <Calculator className="h-4 w-4 text-brand-600" />
            Finanzierung ab
          </div>
          <div className="mt-2 flex items-end gap-2">
            <span className="text-[34px] font-bold leading-none text-ink-900">
              {fmtEur(finance.rate)}
            </span>
            <span className="pb-1 text-[13px] text-ink-500">/ Monat</span>
          </div>
          <p className="mt-2 max-w-md text-[11.5px] leading-relaxed text-ink-500">
            Repräsentatives Beispiel: {fmtEur(finance.anzahlung)} Anzahlung,{" "}
            {finance.months} Monate Laufzeit,{" "}
            {(finance.apr * 100).toLocaleString("de-DE", {
              minimumFractionDigits: 1,
            })}{" "}
            % eff. Jahreszins. Bonität vorausgesetzt.
          </p>
        </div>
        <div className="flex flex-col justify-center gap-2 p-5">
          <FinRow label="Anzahlung" value={fmtEur(finance.anzahlung)} />
          <FinRow label="Laufzeit" value={`${finance.months} Monate`} />
          <FinRow label="Fahrzeugpreis" value={fmtEur(price)} />
          <button className="mt-1 rounded-lg border border-ink-200 bg-white px-4 py-2 text-[12.5px] font-medium text-ink-700 hover:bg-ink-50">
            Finanzierung berechnen
          </button>
        </div>
      </div>
    </section>
  );
}

function FinRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-hair pb-1.5 text-[12.5px]">
      <span className="text-ink-500">{label}</span>
      <span className="font-medium text-ink-800">{value}</span>
    </div>
  );
}

function Reviews() {
  return (
    <section className="mt-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
          <h3 className="text-[15px] font-semibold tracking-tight text-ink-900">
            Kundenbewertungen
          </h3>
        </div>
        <span className="text-[12px] text-ink-500">
          4,8 / 5 · 127 Google-Rezensionen
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {REVIEWS.map((r) => (
          <figure
            key={r.name}
            className="rounded-xl border border-hair bg-white p-4"
          >
            <RatingStars value={r.stars} />
            <blockquote className="mt-2 text-[12.5px] leading-relaxed text-ink-700">
              „{r.text}“
            </blockquote>
            <figcaption className="mt-3 flex items-center gap-2">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink-900 text-[11px] font-semibold text-white">
                {r.name.charAt(0)}
              </span>
              <span className="text-[11.5px] text-ink-500">
                <span className="font-medium text-ink-800">{r.name}</span> ·{" "}
                {r.date}
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

const HOURS = [
  { d: "Mo – Fr", t: "08:00 – 19:00" },
  { d: "Samstag", t: "09:00 – 16:00" },
  { d: "Sonntag", t: "Schautag 11 – 15 Uhr" },
];

function DealerInfo() {
  return (
    <section className="mt-8 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
      <div className="rounded-xl border border-hair bg-white p-5">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-brand-600" />
          <h3 className="text-[15px] font-semibold tracking-tight text-ink-900">
            {DEALER.name}
          </h3>
        </div>
        <p className="mt-1 text-[12.5px] text-ink-500">
          Industriestraße 14 · 80939 München
        </p>
        <div className="mt-3 grid gap-2 text-[12.5px] text-ink-700 sm:grid-cols-2">
          <span className="inline-flex items-center gap-2">
            <Phone className="h-3.5 w-3.5 text-ink-400" />
            +49 89 1234-567
          </span>
          <span className="inline-flex items-center gap-2">
            <Mail className="h-3.5 w-3.5 text-ink-400" />
            verkauf@northlane-motors.de
          </span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge icon={ShieldCheck}>Geprüfter Händler</Badge>
          <Badge icon={Award}>Top-Bewertung 2025</Badge>
          <Badge icon={Check}>Gebrauchtwagen-Garantie</Badge>
        </div>
        <div
          className="relative mt-4 h-32 overflow-hidden rounded-lg border border-hair"
          style={{
            backgroundColor: "#eef1f5",
            backgroundImage:
              "linear-gradient(#dde2e9 1px, transparent 1px), linear-gradient(90deg, #dde2e9 1px, transparent 1px)",
            backgroundSize: "26px 26px",
          }}
          aria-hidden
        >
          <span className="absolute left-1/2 top-1/2 grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-brand-600/15">
            <MapPin className="h-5 w-5 text-brand-600" />
          </span>
        </div>
      </div>
      <div className="rounded-xl border border-hair bg-white p-5">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-brand-600" />
          <h3 className="text-[15px] font-semibold tracking-tight text-ink-900">
            Öffnungszeiten
          </h3>
        </div>
        <ul className="mt-3 space-y-1.5 text-[12.5px]">
          {HOURS.map((h) => (
            <li key={h.d} className="flex items-center justify-between">
              <span className="text-ink-500">{h.d}</span>
              <span className="font-medium text-ink-800">{h.t}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 rounded-lg bg-ink-50 p-3 text-[11.5px] leading-relaxed text-ink-600">
          Vereinbare online einen Termin — wir stellen dein Wunschfahrzeug
          bereit.
        </div>
      </div>
    </section>
  );
}

function Badge({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-hair bg-ink-50 px-2.5 py-1 text-[11px] font-medium text-ink-700">
      <Icon className="h-3.5 w-3.5 text-brand-600" />
      {children}
    </span>
  );
}

function DealerFooter() {
  return (
    <footer className="mt-10 rounded-xl bg-ink-900 px-5 py-6 text-ink-100 sm:px-7">
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-white text-[13px] font-bold text-ink-900">
              N
            </span>
            <span className="text-[14px] font-semibold text-white">
              {DEALER.name}
            </span>
          </div>
          <p className="mt-2 text-[11.5px] leading-relaxed text-ink-400">
            {DEALER.tagline} — Neu- &amp; Gebrauchtwagen, Finanzierung, Leasing
            und Service aus einer Hand.
          </p>
        </div>
        <FooterCol
          title="Fahrzeuge"
          items={[
            "Neuwagen",
            "Gebrauchtwagen",
            "Elektro & Hybrid",
            "Transporter",
          ]}
        />
        <FooterCol
          title="Service"
          items={["Finanzierung", "Leasing", "Inzahlungnahme", "Werkstatt"]}
        />
        <FooterCol
          title="Unternehmen"
          items={["Über uns", "Kontakt", "Karriere", "Standorte"]}
        />
      </div>
      <div className="mt-6 flex flex-col items-start justify-between gap-2 border-t border-white/10 pt-4 text-[11px] text-ink-400 sm:flex-row sm:items-center">
        <span>
          © {DEALER.name} — Demo-Auftritt. Fahrzeugbilder live über die
          Vehicleimagery-API.
        </span>
        <span className="flex gap-3">
          <span>Impressum</span>
          <span>Datenschutz</span>
          <span>AGB</span>
        </span>
      </div>
    </footer>
  );
}

function FooterCol({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div className="text-[12px] font-semibold uppercase tracking-wider text-ink-300">
        {title}
      </div>
      <ul className="mt-2 space-y-1.5 text-[12px] text-ink-400">
        {items.map((it) => (
          <li key={it} className="cursor-pointer transition hover:text-white">
            {it}
          </li>
        ))}
      </ul>
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
  const specs = fakeSpecs(car);
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
        <div className="flex items-center justify-between">
          <span className="text-[10.5px] text-ink-400">{car.jahr}</span>
          <span className="text-[11.5px] font-bold text-ink-900">
            {fmtEur(specs.price)}
          </span>
        </div>
      </div>
    </button>
  );
}
