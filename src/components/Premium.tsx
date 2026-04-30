/**
 * Premium UI Kit — kleine, performante Bausteine, die das Dashboard
 * „edel" wirken lassen. Reine Funktionskomponenten, keine externen
 * Libraries; alle Animations-Sekret CSS-seitig in `src/index.css`.
 *
 *   <CountUp value={123} />
 *   <Skeleton className="h-3 w-20" />
 *   <SkeletonRows count={6} />
 */
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
} from "react";

// ─── CountUp ─────────────────────────────────────────────────────────

type CountUpProps = {
  value: number;
  /** Animation duration in ms. Default 700. */
  duration?: number;
  /** Anzahl der Nachkommastellen. Default 0. */
  decimals?: number;
  /** Suffix (z. B. „%" oder „·"). */
  suffix?: string;
  /** Prefix. */
  prefix?: string;
  className?: string;
};

/**
 * Smoothes Hochzählen einer Zahl (cubic-out). Erste Mount-Animation,
 * danach läuft sie nur, wenn sich `value` ändert.
 */
export function CountUp({
  value,
  duration = 700,
  decimals = 0,
  suffix,
  prefix,
  className,
}: CountUpProps) {
  const [display, setDisplay] = useState<number>(value);
  const fromRef = useRef<number>(0);
  const startedAtRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const targetRef = useRef<number>(value);

  useEffect(() => {
    if (typeof window === "undefined") {
      setDisplay(value);
      return;
    }
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced || !Number.isFinite(value)) {
      setDisplay(value);
      return;
    }
    fromRef.current = display;
    targetRef.current = value;
    startedAtRef.current = null;

    const tick = (now: number) => {
      if (startedAtRef.current == null) startedAtRef.current = now;
      const t = Math.min(1, (now - startedAtRef.current) / duration);
      // cubic-out
      const eased = 1 - Math.pow(1 - t, 3);
      const cur = fromRef.current + (targetRef.current - fromRef.current) * eased;
      setDisplay(cur);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  const text = useMemo(() => {
    const safe = Number.isFinite(display) ? display : 0;
    return safe.toLocaleString("de-DE", {
      maximumFractionDigits: decimals,
      minimumFractionDigits: decimals,
    });
  }, [display, decimals]);

  return (
    <span className={className}>
      {prefix}
      {text}
      {suffix}
    </span>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────

type SkeletonProps = HTMLAttributes<HTMLDivElement>;

/**
 * Einzelner Shimmer-Block. Klassen wie `h-3 w-20` selbst setzen.
 */
export function Skeleton({ className, style, ...rest }: SkeletonProps) {
  return (
    <div
      aria-hidden
      className={`skeleton-shimmer ${className ?? ""}`.trim()}
      style={{ ...style }}
      {...rest}
    />
  );
}

/**
 * `count` Tabellenzeilen mit Skeletons (passend zu den meisten Listen).
 */
export function SkeletonRows({
  count = 6,
  cols = 5,
  className,
}: {
  count?: number;
  cols?: number;
  className?: string;
}) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <tr key={i} className={className}>
          {Array.from({ length: cols }).map((__, j) => (
            <td key={j} className="border-b border-hair px-3 py-3 align-middle">
              <Skeleton
                className="h-3"
                style={{ width: `${50 + Math.random() * 40}%` }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ─── In-View-Hook ───────────────────────────────────────────────────

/**
 * Kleiner IntersectionObserver-Hook: liefert `true`, sobald das Element
 * mindestens einmal sichtbar war. Für Lazy-Animationen und Lazy-Charts.
 */
export function useInView<T extends HTMLElement>(opts?: IntersectionObserverInit) {
  const ref = useRef<T | null>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (seen) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setSeen(true);
            io.disconnect();
            break;
          }
        }
      },
      { rootMargin: "60px", threshold: 0.05, ...(opts ?? {}) },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [seen, opts]);
  return [ref, seen] as const;
}

// ─── Stagger-Style-Helper ────────────────────────────────────────────

/**
 * Liefert ein style-Objekt mit `--stagger`-Index, das man als
 * `style={...staggerStyle(i)}` in `:nth-child` Animationen nutzen kann.
 * Nützlich, wenn Items dynamisch ohne stabile Struktur entstehen.
 */
export function staggerDelay(idx: number, step = 30): CSSProperties {
  return { animationDelay: `${idx * step}ms` };
}
