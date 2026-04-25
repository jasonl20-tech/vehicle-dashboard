import { Calendar, ChevronDown } from "lucide-react";
import { type ReactNode, useState } from "react";

type Props = {
  title: string;
  description?: ReactNode;
  rightSlot?: ReactNode;
};

const RANGES = [
  "Letzte 7 Tage",
  "Letzte 30 Tage",
  "Letzte 90 Tage",
  "Letztes Jahr",
];

export default function PageHeader({ title, description, rightSlot }: Props) {
  const [range, setRange] = useState(RANGES[1]);
  const [open, setOpen] = useState(false);

  return (
    <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 text-sm text-ink-500">{description}</p>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        {rightSlot}
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-2 rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm shadow-card hover:bg-ink-50"
          >
            <Calendar className="h-4 w-4 text-ink-500" />
            {range}
            <ChevronDown className="h-4 w-4 text-ink-400" />
          </button>
          {open && (
            <div
              role="menu"
              className="absolute right-0 z-20 mt-2 w-48 overflow-hidden rounded-lg border border-ink-200 bg-white shadow-card"
            >
              {RANGES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    setRange(r);
                    setOpen(false);
                  }}
                  className={`block w-full px-3 py-2 text-left text-sm hover:bg-ink-50 ${
                    r === range ? "text-brand-700 font-medium" : "text-ink-700"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
