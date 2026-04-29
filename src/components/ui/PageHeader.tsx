import { Bell, Calendar, ChevronDown, Plus } from "lucide-react";
import { type ReactNode, useState } from "react";

type Props = {
  /**
   * Wird intern (z. B. für `aria-label`) genutzt. Der Seitenname wird
   * NICHT mehr im Body angezeigt — er steht bereits prominent im
   * `DashboardHeader`. So haben wir keine redundante Überschrift.
   */
  title: string;
  /** Veraltet: wurde früher als kleines „Eyebrow"-Tag gerendert. */
  eyebrow?: string;
  description?: ReactNode;
  rightSlot?: ReactNode;
  primaryAction?: { label: string; onClick?: () => void };
  /** Versteckt Zeitraum-Dropdown („Letzte 7 Tage" …) und Benachrichtigungs-Glocke. */
  hideCalendarAndNotifications?: boolean;
};

const RANGES = [
  "Letzte 7 Tage",
  "Letzte 30 Tage",
  "Letzte 90 Tage",
  "Letztes Jahr",
];

export default function PageHeader({
  title,
  description,
  rightSlot,
  primaryAction,
  hideCalendarAndNotifications = false,
}: Props) {
  const [range, setRange] = useState(RANGES[1]);
  const [open, setOpen] = useState(false);

  // Wenn weder Beschreibung noch rechte Slot-Inhalte vorhanden sind und
  // Calendar+Notifications versteckt sind, rendern wir gar nichts —
  // sonst entsteht ein leerer Border-Bereich.
  const hasContent =
    !!description ||
    !!rightSlot ||
    !!primaryAction ||
    !hideCalendarAndNotifications;
  if (!hasContent) return null;

  return (
    <header
      aria-label={title}
      className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-hair pb-4"
    >
      <div className="min-w-0">
        {description ? (
          <p className="max-w-2xl text-[13px] leading-relaxed text-ink-500">
            {description}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {rightSlot}
        {!hideCalendarAndNotifications && (
          <>
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
          </>
        )}
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
