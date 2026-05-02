import { ChevronRight, Image as ImageIcon, Search } from "lucide-react";
import { useMemo, useState } from "react";
import PageHeader from "../components/ui/PageHeader";

type MockImage = {
  id: string;
  /** Platzhalter: später z. B. Freigabe / Markierung / QC */
  status: "offen" | "in_arbeit" | "ok";
};

type MockVehicle = {
  id: string;
  name: string;
  hint: string;
  images: MockImage[];
};

const MOCK_VEHICLES: MockVehicle[] = [
  {
    id: "v1",
    name: "Demo Fahrzeug · Kombi",
    hint: "WAUZZZ8V9NA012345",
    images: [
      { id: "v1-1", status: "offen" },
      { id: "v1-2", status: "in_arbeit" },
      { id: "v1-3", status: "ok" },
      { id: "v1-4", status: "offen" },
      { id: "v1-5", status: "offen" },
      { id: "v1-6", status: "in_arbeit" },
    ],
  },
  {
    id: "v2",
    name: "Demo Fahrzeug · SUV",
    hint: "WBA51DP090C123456",
    images: [
      { id: "v2-1", status: "ok" },
      { id: "v2-2", status: "ok" },
      { id: "v2-3", status: "offen" },
      { id: "v2-4", status: "offen" },
    ],
  },
  {
    id: "v3",
    name: "Demo Fahrzeug · Limousine",
    hint: "WDD2130041A654321",
    images: [
      { id: "v3-1", status: "offen" },
      { id: "v3-2", status: "offen" },
      { id: "v3-3", status: "offen" },
    ],
  },
];

const STATUS_LABEL: Record<MockImage["status"], string> = {
  offen: "Offen",
  in_arbeit: "In Arbeit",
  ok: "OK",
};

const STATUS_STYLE: Record<MockImage["status"], string> = {
  offen: "border-hair bg-ink-50/80 text-ink-600",
  in_arbeit: "border-brand-200 bg-brand-50/90 text-brand-800",
  ok: "border-accent-mint/40 bg-accent-mint/10 text-ink-700",
};

export default function ControlPlatformPage() {
  const [selectedId, setSelectedId] = useState(MOCK_VEHICLES[0]?.id ?? "");
  const [query, setQuery] = useState("");

  const vehicle = useMemo(
    () => MOCK_VEHICLES.find((v) => v.id === selectedId) ?? MOCK_VEHICLES[0],
    [selectedId],
  );

  const filteredVehicles = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return MOCK_VEHICLES;
    return MOCK_VEHICLES.filter(
      (v) =>
        v.name.toLowerCase().includes(q) || v.hint.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <>
      <PageHeader
        title="Control Platform"
        description="Struktur für Bildprüfung und Markierung: links Fahrzeuge, rechts alle Bilder des gewählten Fahrzeugs. Daten und Editor folgen im nächsten Schritt."
        hideCalendarAndNotifications
      />

      <div className="flex min-h-[min(70vh,900px)] flex-col gap-4 overflow-hidden rounded-xl border border-hair bg-white/80 shadow-[0_24px_70px_-50px_rgba(13,13,15,0.35)] backdrop-blur lg:flex-row">
        {/* Fahrzeugliste */}
        <aside className="flex w-full shrink-0 flex-col border-b border-hair lg:w-[min(100%,280px)] lg:border-b-0 lg:border-r lg:border-hair">
          <div className="border-b border-hair px-4 py-3">
            <label className="sr-only" htmlFor="control-platform-search">
              Fahrzeuge filtern
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
              <input
                id="control-platform-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Fahrzeug suchen…"
                className="w-full rounded-md border border-hair bg-paper py-2 pl-8 pr-3 text-[12.5px] text-ink-800 placeholder:text-ink-400 focus:border-ink-400 focus:outline-none focus:ring-1 focus:ring-ink-300"
              />
            </div>
            <p className="mt-2 text-[10.5px] uppercase tracking-[0.18em] text-ink-400">
              {filteredVehicles.length} Fahrzeuge
            </p>
          </div>
          <ul
            className="max-h-[40vh] flex-1 overflow-y-auto lg:max-h-none"
            role="listbox"
            aria-label="Fahrzeuge"
          >
            {filteredVehicles.map((v) => {
              const selected = v.id === vehicle?.id;
              return (
                <li key={v.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => setSelectedId(v.id)}
                    className={`flex w-full items-start gap-2 border-b border-hair px-4 py-3 text-left transition hover:bg-ink-50/60 ${
                      selected ? "bg-brand-50/50" : ""
                    }`}
                  >
                    <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md bg-night-900/[0.04] text-ink-500">
                      <ImageIcon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-ink-900">
                        {v.name}
                      </span>
                      <span className="mt-0.5 block truncate font-mono text-[11px] text-ink-400">
                        {v.hint}
                      </span>
                      <span className="mt-1 inline-block text-[11px] text-ink-500">
                        {v.images.length} Bilder
                      </span>
                    </span>
                    <ChevronRight
                      className={`mt-1 h-4 w-4 shrink-0 transition-transform ${
                        selected ? "translate-x-0.5 text-brand-600" : "text-ink-300"
                      }`}
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* Bildbereich */}
        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          {vehicle ? (
            <>
              <div className="flex flex-wrap items-end justify-between gap-3 border-b border-hair px-4 py-4 sm:px-5">
                <div className="min-w-0">
                  <h2 className="font-display text-[19px] font-semibold tracking-tightish text-ink-900">
                    {vehicle.name}
                  </h2>
                  <p className="mt-1 font-mono text-[11px] text-ink-500">
                    {vehicle.hint}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-ink-500">
                  <span className="rounded-full border border-hair bg-paper px-2.5 py-1">
                    Raster · Markierung folgt
                  </span>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                  {vehicle.images.map((img) => (
                    <li key={img.id}>
                      <button
                        type="button"
                        className="group flex w-full flex-col overflow-hidden rounded-lg border border-hair bg-paper text-left shadow-sm transition hover:border-ink-200 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/70 focus-visible:ring-offset-2"
                      >
                        <div className="relative aspect-[4/3] bg-gradient-to-br from-ink-100/90 via-paper to-brand-50/40">
                          <div className="absolute inset-0 flex items-center justify-center">
                            <ImageIcon className="h-10 w-10 text-ink-200/80 transition group-hover:scale-105 group-hover:text-ink-300" />
                          </div>
                          <span className="absolute right-2 top-2 rounded-md border border-white/80 bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-ink-600 shadow-sm backdrop-blur">
                            {img.id}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 border-t border-hair px-2.5 py-2">
                          <span
                            className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLE[img.status]}`}
                          >
                            {STATUS_LABEL[img.status]}
                          </span>
                          <ChevronRight className="h-3.5 w-3.5 text-ink-300 group-hover:text-ink-500" />
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : (
            <div className="grid flex-1 place-items-center px-6 py-16 text-center text-[13px] text-ink-500">
              Kein Fahrzeug ausgewählt.
            </div>
          )}
        </section>
      </div>
    </>
  );
}
