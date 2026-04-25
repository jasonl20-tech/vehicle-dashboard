import { Bell, Calendar, ChevronDown, Plus } from "lucide-react";
import { type ReactNode, useState } from "react";

type Props = {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  rightSlot?: ReactNode;
  primaryAction?: { label: string; onClick?: () => void };
};

const RANGES = [
  "Letzte 7 Tage",
  "Letzte 30 Tage",
  "Letzte 90 Tage",
  "Letztes Jahr",
];

export default function PageHeader({
  eyebrow,
  title,
  description,
  rightSlot,
  primaryAction,
}: Props) {
  const [range, setRange] = useState(RANGES[1]);
  const [open, setOpen] = useState(false);

  return (
    <header className="mb-10 flex flex-wrap items-end justify-between gap-6 border-b border-hair pb-6">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-ink-400">
            {eyebrow}
          </p>
        )}
        <h1 className="font-display text-[34px] leading-[1.05] tracking-tighter2 text-ink-900">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-ink-500">
            {description}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {rightSlot}
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-2 rounded-md border border-hair bg-white px-3 py-1.5 text-[12.5px] text-ink-700 hover:border-ink-300"
          >
            <Calendar className="h-3.5 w-3.5 text-ink-400" />
            {range}
            <ChevronDown className="h-3.5 w-3.5 text-ink-400" />
          </button>
          {open && (
            <div
              role="menu"
              className="absolute right-0 z-20 mt-2 w-48 overflow-hidden rounded-lg border border-hair bg-white py-1 shadow-[0_10px_30px_-12px_rgba(13,13,15,0.18)]"
            >
              {RANGES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    setRange(r);
                    setOpen(false);
                  }}
                  className={`block w-full px-3 py-1.5 text-left text-[12.5px] hover:bg-ink-50 ${
                    r === range ? "text-ink-900 font-medium" : "text-ink-600"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          title="Benachrichtigungen"
          className="relative rounded-md border border-hair bg-white p-1.5 text-ink-500 hover:border-ink-300 hover:text-ink-800"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-accent-rose" />
        </button>
        {primaryAction && (
          <button
            type="button"
            onClick={primaryAction.onClick}
            className="inline-flex items-center gap-1.5 rounded-md bg-ink-900 px-3 py-1.5 text-[12.5px] font-medium text-white hover:bg-ink-800"
          >
            <Plus className="h-3.5 w-3.5" />
            {primaryAction.label}
          </button>
        )}
      </div>
    </header>
  );
}
