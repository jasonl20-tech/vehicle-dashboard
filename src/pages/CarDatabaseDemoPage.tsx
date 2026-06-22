import {
  Boxes,
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
  Zap,
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
  carDatabaseListUrl,
  carThumbApiUrl,
  type CarDetailResponse,
  type CarListResponse,
  type CarRow,
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
  const [bg, setBg] = useState<BgMode>("showroom");
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

  // 360°-Steuerung nur über tatsächlich vorhandene Außen-Ansichten.
  const spinIdx = Math.max(0, exterior.indexOf(view));
  const setSpin = (idx: number) => {
    if (!exterior.length) return;
    const n = ((idx % exterior.length) + exterior.length) % exterior.length;
    setView(exterior[n]);
  };

  const specs = useMemo(() => fakeSpecs(car), [car]);
  const title = `${car.marke} ${prettyModel(car.modell)}`;

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
              bg={bg}
              isExterior={SPIN.includes(view)}
              spinIdx={spinIdx}
              onSpin={setSpin}
              onZoom={() => setZoom(true)}
              loading={detailApi.loading && !detail}
            />

            {/* Steuerleiste */}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex rounded-lg border border-hair bg-white p-0.5">
                <SegBtn
                  active={bg === "showroom"}
                  onClick={() => setBg("showroom")}
                >
                  Showroom
                </SegBtn>
                <SegBtn active={bg === "studio"} onClick={() => setBg("studio")}>
                  Studio
                </SegBtn>
                <SegBtn
                  active={bg === "transparent"}
                  onClick={() => setBg("transparent")}
                >
                  Freisteller
                </SegBtn>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-ink-400">
                <Rotate3d className="h-3.5 w-3.5" />
                Ziehen zum Drehen
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

          {/* Listing-Infos */}
          <aside>
            <h1 className="text-[22px] font-semibold leading-tight tracking-tight text-ink-900">
              {title}
            </h1>
            <div className="mt-0.5 text-[13px] text-ink-500">
              {car.jahr} · {specs.fuel} · {specs.powerHp} PS
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

            {/* CTAs */}
            <div className="mt-5 space-y-2">
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

        {/* Feature-Band */}
        <FeatureBand />

        {/* Farbvergleich */}
        {colors.length >= 2 && (
          <ColorCompare car={car} colors={colors} />
        )}

        {/* API-Vorschau */}
        <ApiPanel
          car={car}
          view={view}
          color={color}
          open={showApi}
          onToggle={() => setShowApi((v) => !v)}
        />
      </div>

      {/* Fahrzeug-Auswahl */}
      {pickerOpen && (
        <CarPicker
          current={car}
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
          onClose={() => setZoom(false)}
        />
      )}
    </div>
  );
}

function Stage({
  car,
  color,
  view,
  bg,
  isExterior,
  spinIdx,
  onSpin,
  onZoom,
  loading,
}: {
  car: CarId;
  color: string;
  view: string;
  bg: BgMode;
  isExterior: boolean;
  spinIdx: number;
  onSpin: (idx: number) => void;
  onZoom: () => void;
  loading: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const drag = useRef<{ x: number; idx: number } | null>(null);
  // Innenraum-Bilder sind farb-unabhängig → über „default" laden.
  const imgFarbe = SPIN.includes(view) ? color : "default";
  const url = carThumbApiUrl({ ...car, farbe: imgFarbe }, { view, width: 900 });

  useEffect(() => setFailed(false), [url]);

  const onDown = (e: React.PointerEvent) => {
    if (!isExterior) return;
    drag.current = { x: e.clientX, idx: spinIdx };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const steps = Math.round((drag.current.x - e.clientX) / 24);
    onSpin(drag.current.idx + steps);
  };
  const onUp = () => {
    drag.current = null;
  };

  return (
    <div className="relative">
      <div
        className={`relative overflow-hidden rounded-xl border border-hair ${
          isExterior ? "cursor-ew-resize" : ""
        }`}
        style={stageStyle(bg)}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onUp}
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

        {/* 360-Badge */}
        {isExterior && (
          <div className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-ink-900/80 px-2 py-1 text-[10px] font-medium text-white backdrop-blur">
            <Rotate3d className="h-3 w-3" />
            360°
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
          aria-label="Vergrößern"
          className="absolute bottom-3 right-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/85 text-ink-700 shadow hover:bg-white"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>

      {/* Pfeile */}
      {isExterior && (
        <>
          <ArrowBtn side="left" onClick={() => onSpin(spinIdx - 1)} />
          <ArrowBtn side="right" onClick={() => onSpin(spinIdx + 1)} />
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
  onPick,
  onClose,
}: {
  current: CarId;
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
  onClose,
}: {
  car: CarId;
  color: string;
  view: string;
  onClose: () => void;
}) {
  const imgFarbe = SPIN.includes(view) ? color : "default";
  const url = carThumbApiUrl({ ...car, farbe: imgFarbe }, { view, width: 1500 });
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
          className="max-h-[88vh] max-w-[94vw] object-contain"
          onClick={(e) => e.stopPropagation()}
        />
      )}
    </div>
  );
}
