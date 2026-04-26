import { ArrowRight, Command, CornerDownLeft, Search } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { flattenNav, type FlatRoute } from "./layout/navConfig";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function CommandPalette({ open, onClose }: Props) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const all = useMemo<FlatRoute[]>(() => flattenNav(), []);

  const filtered = useMemo<FlatRoute[]>(() => {
    const s = q.trim().toLowerCase();
    if (!s) return all;
    const tokens = s.split(/\s+/).filter(Boolean);
    return all
      .map((it) => {
        const hay = `${it.label} ${it.section} ${it.to}`.toLowerCase();
        const allMatch = tokens.every((t) => hay.includes(t));
        if (!allMatch) return null;
        // prio: label start > label contains > section contains > path contains
        const labelLow = it.label.toLowerCase();
        let score = 0;
        if (labelLow.startsWith(s)) score += 100;
        else if (labelLow.includes(s)) score += 60;
        if (it.section.toLowerCase().includes(s)) score += 20;
        if (it.to.toLowerCase().includes(s)) score += 5;
        return { it, score };
      })
      .filter((x): x is { it: FlatRoute; score: number } => x !== null)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.it);
  }, [all, q]);

  // Group filtered items by section, preserving the filtered order.
  const groups = useMemo<Array<{ section: string; items: FlatRoute[] }>>(() => {
    const map = new Map<string, FlatRoute[]>();
    for (const it of filtered) {
      const arr = map.get(it.section);
      if (arr) arr.push(it);
      else map.set(it.section, [it]);
    }
    return Array.from(map.entries()).map(([section, items]) => ({
      section,
      items,
    }));
  }, [filtered]);

  // Reset state when opening
  useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
      window.setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  // Keep active index in valid bounds when filter changes
  useEffect(() => {
    setActive((a) => {
      if (filtered.length === 0) return 0;
      return Math.min(a, filtered.length - 1);
    });
  }, [filtered.length]);

  // Auto-scroll active item into view
  useLayoutEffect(() => {
    if (!open) return;
    const el = itemRefs.current[active];
    if (el) {
      el.scrollIntoView({ block: "nearest", behavior: "auto" });
    }
  }, [active, open, groups]);

  const close = useCallback(() => onClose(), [onClose]);

  const goTo = useCallback(
    (idx: number) => {
      const it = filtered[idx];
      if (!it) return;
      navigate(it.to);
      close();
    },
    [filtered, navigate, close],
  );

  // Global keys while open
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((a) => (filtered.length === 0 ? 0 : (a + 1) % filtered.length));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((a) =>
          filtered.length === 0
            ? 0
            : (a - 1 + filtered.length) % filtered.length,
        );
      } else if (e.key === "Home") {
        e.preventDefault();
        setActive(0);
      } else if (e.key === "End") {
        e.preventDefault();
        if (filtered.length > 0) setActive(filtered.length - 1);
      } else if (e.key === "Enter") {
        e.preventDefault();
        goTo(active);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, filtered.length, active, goTo, close]);

  if (!open) return null;

  // Build a map from filtered-index to (section, withinSection-index) for highlighting.
  let runningIdx = 0;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[12vh] sm:pt-[14vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Befehlspalette"
      onMouseDown={close}
    >
      <div
        className="absolute inset-0 bg-night-900/40 backdrop-blur-sm"
        aria-hidden
      />
      <div
        className="relative z-[1] w-full max-w-xl overflow-hidden rounded-xl border border-hair bg-paper shadow-[0_30px_80px_-12px_rgba(13,13,15,0.35)]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-hair px-4 py-3">
          <Search className="h-4 w-4 text-ink-400" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Suchen oder Befehl …"
            className="flex-1 bg-transparent text-[14px] text-ink-900 outline-none placeholder:text-ink-400"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="inline-flex select-none items-center gap-0.5 rounded border border-hair bg-white px-1.5 py-0.5 font-mono text-[10px] text-ink-500">
            esc
          </kbd>
        </div>

        {/* Result list */}
        <div ref={listRef} className="max-h-[60vh] overflow-y-auto py-1.5">
          {filtered.length === 0 ? (
            <p className="px-4 py-10 text-center text-[13px] text-ink-400">
              Keine Treffer für „{q}"
            </p>
          ) : (
            groups.map(({ section, items }) => (
              <div key={section} className="mb-1.5 last:mb-0">
                <p className="px-4 pb-1 pt-2 text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-400">
                  {section}
                </p>
                <div className="px-1.5">
                  {items.map((it) => {
                    const idx = runningIdx++;
                    const isActive = idx === active;
                    const isParent =
                      it.label === it.section && it.parentLabel === undefined;
                    return (
                      <button
                        key={it.to}
                        ref={(el) => (itemRefs.current[idx] = el)}
                        type="button"
                        onMouseEnter={() => setActive(idx)}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => goTo(idx)}
                        className={`group flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-[13px] transition-colors ${
                          isActive
                            ? "bg-ink-900 text-white"
                            : "text-ink-700 hover:bg-ink-50"
                        }`}
                      >
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center ${
                            isActive ? "text-white/80" : "text-ink-400"
                          }`}
                        >
                          <ArrowRight className="h-3.5 w-3.5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate">
                            {isParent ? it.label : it.label}
                          </span>
                          {!isParent && (
                            <span
                              className={`mt-0.5 block truncate font-mono text-[10.5px] ${
                                isActive ? "text-white/55" : "text-ink-400"
                              }`}
                            >
                              {it.to}
                            </span>
                          )}
                        </span>
                        {isActive && (
                          <span className="hidden items-center gap-1 text-[10.5px] text-white/70 sm:inline-flex">
                            <CornerDownLeft className="h-3 w-3" />
                            Öffnen
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-hair bg-paper px-4 py-2 text-[11px] text-ink-400">
          <div className="flex items-center gap-3">
            <KbdHint label="navigieren">
              <span className="font-mono">↑</span>
              <span className="font-mono">↓</span>
            </KbdHint>
            <KbdHint label="öffnen">
              <CornerDownLeft className="h-3 w-3" />
            </KbdHint>
          </div>
          <div className="flex items-center gap-1.5">
            <span>Schnell-Öffnen</span>
            <kbd className="inline-flex items-center gap-0.5 rounded border border-hair bg-white px-1.5 py-0.5 font-mono text-[10px] text-ink-500">
              <Command className="h-3 w-3" />
              K
            </kbd>
          </div>
        </div>
      </div>
    </div>
  );
}

function KbdHint({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-flex items-center gap-0.5 rounded border border-hair bg-white px-1.5 py-0.5 text-ink-500">
        {children}
      </span>
      <span>{label}</span>
    </span>
  );
}
