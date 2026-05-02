import { ChevronRight, Image as ImageIcon, Search } from "lucide-react";
import { useMemo, useState } from "react";

type MockImage = {
  id: string;
  status: "open" | "in_progress" | "ok";
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
    name: "Demo · Estate",
    hint: "WAUZZZ8V9NA012345",
    images: [
      { id: "v1-1", status: "open" },
      { id: "v1-2", status: "in_progress" },
      { id: "v1-3", status: "ok" },
      { id: "v1-4", status: "open" },
      { id: "v1-5", status: "open" },
      { id: "v1-6", status: "in_progress" },
    ],
  },
  {
    id: "v2",
    name: "Demo · SUV",
    hint: "WBA51DP090C123456",
    images: [
      { id: "v2-1", status: "ok" },
      { id: "v2-2", status: "ok" },
      { id: "v2-3", status: "open" },
      { id: "v2-4", status: "open" },
    ],
  },
  {
    id: "v3",
    name: "Demo · Sedan",
    hint: "WDD2130041A654321",
    images: [
      { id: "v3-1", status: "open" },
      { id: "v3-2", status: "open" },
      { id: "v3-3", status: "open" },
    ],
  },
];

const STATUS_LABEL: Record<MockImage["status"], string> = {
  open: "Open",
  in_progress: "In progress",
  ok: "OK",
};

const STATUS_DOT: Record<MockImage["status"], string> = {
  open: "bg-ink-400",
  in_progress: "bg-brand-500",
  ok: "bg-accent-mint",
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
    <div className="flex min-h-[min(70vh,900px)] flex-col border border-hair bg-white lg:flex-row">
      <aside className="flex w-full shrink-0 flex-col border-b border-hair lg:w-[280px] lg:border-b-0 lg:border-r lg:border-hair">
        <div className="border-b border-hair px-3 py-3">
          <label className="sr-only" htmlFor="control-platform-search">
            Filter vehicles
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
            <input
              id="control-platform-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search vehicles…"
              className="w-full border border-hair bg-paper py-2 pl-8 pr-2 text-[12.5px] text-ink-800 placeholder:text-ink-400 focus:border-ink-800 focus:outline-none focus:ring-0"
            />
          </div>
          <p className="mt-2 text-[11px] tabular-nums text-ink-500">
            {filteredVehicles.length} vehicles
          </p>
        </div>
        <ul
          className="max-h-[40vh] flex-1 overflow-y-auto lg:max-h-none"
          role="listbox"
          aria-label="Vehicles"
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
                  className={`flex w-full items-center gap-2 border-b border-hair px-3 py-3 text-left text-[13px] transition-colors hover:bg-ink-50/80 ${
                    selected ? "bg-ink-50" : ""
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-ink-900">
                      {v.name}
                    </span>
                    <span className="mt-0.5 block truncate font-mono text-[11px] text-ink-500">
                      {v.hint}
                    </span>
                    <span className="mt-1 text-[11px] text-ink-500">
                      {v.images.length} images
                    </span>
                  </span>
                  <ChevronRight
                    className={`h-4 w-4 shrink-0 text-ink-400 ${
                      selected ? "text-ink-800" : ""
                    }`}
                  />
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        {vehicle ? (
          <>
            <div className="border-b border-hair px-4 py-4 sm:px-5">
              <h1 className="font-display text-lg font-semibold tracking-tight text-ink-900">
                {vehicle.name}
              </h1>
              <p className="mt-1 font-mono text-[11px] text-ink-500">
                {vehicle.hint}
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                {vehicle.images.map((img) => (
                  <li key={img.id}>
                    <button
                      type="button"
                      className="flex w-full flex-col border border-hair bg-paper text-left focus:outline-none focus-visible:ring-1 focus-visible:ring-ink-800"
                    >
                      <div className="relative flex aspect-[4/3] items-center justify-center bg-ink-50">
                        <ImageIcon className="h-8 w-8 text-ink-200" />
                        <span className="absolute left-2 top-2 font-mono text-[10px] text-ink-500">
                          {img.id}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 border-t border-hair px-2 py-2">
                        <span
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[img.status]}`}
                          aria-hidden
                        />
                        <span className="text-[11px] text-ink-600">
                          {STATUS_LABEL[img.status]}
                        </span>
                        <ChevronRight className="ml-auto h-3.5 w-3.5 text-ink-400" />
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </>
        ) : (
          <div className="grid flex-1 place-items-center px-6 py-16 text-center text-[13px] text-ink-500">
            No vehicle selected.
          </div>
        )}
      </section>
    </div>
  );
}
