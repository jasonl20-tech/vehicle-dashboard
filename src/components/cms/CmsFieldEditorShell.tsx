import { X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type CmsFieldEditorNavItem = { id: string; label: string };

export const CMS_FIELD_SECTION_PREFIX = "cms-field-section-";

export function cmsFieldSectionDomId(navId: string): string {
  return `${CMS_FIELD_SECTION_PREFIX}${navId}`;
}

type Props = {
  open: boolean;
  /** Anzeigename (z. B. Live aus State) */
  fieldName: string;
  /** Fallback-Name wenn leer */
  fieldNameFallback: string;
  /** z. B. „Short text“, „Boolean“ */
  typeLabel: string;
  navItems: CmsFieldEditorNavItem[];
  onClose: () => void;
  onConfirm: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmDisabled?: boolean;
  children: ReactNode;
};

export default function CmsFieldEditorShell({
  open,
  fieldName,
  fieldNameFallback,
  typeLabel,
  navItems,
  onClose,
  onConfirm,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmDisabled = false,
  children,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeId, setActiveId] = useState(navItems[0]?.id ?? "");

  const syncActiveFromScroll = useCallback(() => {
    const root = scrollRef.current;
    if (!root || navItems.length === 0) return;
    const rootRect = root.getBoundingClientRect();
    const offsetTop = 24;
    let bestId = navItems[0].id;
    let bestDY = Number.POSITIVE_INFINITY;

    for (const { id } of navItems) {
      const el = document.getElementById(cmsFieldSectionDomId(id));
      if (!el) continue;
      const r = el.getBoundingClientRect();
      const dy = Math.abs(r.top - rootRect.top - offsetTop);
      if (dy < bestDY) {
        bestDY = dy;
        bestId = id;
      }
    }
    setActiveId(bestId);
  }, [navItems]);

  useEffect(() => {
    if (!open) return;
    setActiveId(navItems[0]?.id ?? "");
    const t = window.requestAnimationFrame(() => syncActiveFromScroll());
    return () => window.cancelAnimationFrame(t);
  }, [open, navItems, syncActiveFromScroll]);

  useEffect(() => {
    if (!open) return;
    const root = scrollRef.current;
    if (!root) return;
    const onScroll = () => syncActiveFromScroll();
    root.addEventListener("scroll", onScroll, { passive: true });
    syncActiveFromScroll();
    return () => root.removeEventListener("scroll", onScroll);
  }, [open, syncActiveFromScroll]);

  const scrollToSection = (id: string) => {
    const root = scrollRef.current;
    const el = document.getElementById(cmsFieldSectionDomId(id));
    if (!root || !el) return;
    const y =
      el.getBoundingClientRect().top -
      root.getBoundingClientRect().top +
      root.scrollTop -
      16;
    root.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
    setActiveId(id);
  };

  if (!open) return null;

  const displayName = (fieldName || fieldNameFallback).trim() || fieldNameFallback;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-white"
      role="dialog"
      aria-modal="true"
    >
      <header className="flex shrink-0 items-center justify-between border-b border-[#e5e7eb] px-6 py-4 lg:px-8">
        <h2 className="flex flex-wrap items-baseline gap-x-2 text-[#1a1a1a]">
          <span className="text-[17px] font-semibold tracking-tight">
            {displayName}
          </span>
          <span className="text-[15px] font-normal text-[#5f6368]">
            {typeLabel}
          </span>
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1.5 text-[#5f6368] transition hover:bg-[#f3f4f6]"
          aria-label="Schließen"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:flex-row">
        <nav
          aria-label="Abschnitte"
          className="flex shrink-0 flex-row gap-0 overflow-x-auto overflow-y-hidden border-b border-[#e5e7eb] bg-white lg:w-[min(288px,26%)] lg:max-w-[320px] lg:flex-col lg:overflow-y-auto lg:border-b-0 lg:border-r lg:py-3"
        >
          {navItems.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => scrollToSection(id)}
              className={`shrink-0 px-4 py-2.5 text-left text-[13px] transition lg:w-full ${
                activeId === id
                  ? "border-b-[3px] border-b-[#0366d6] bg-[#f3f4f6] font-medium text-[#1a1a1a] lg:border-b-0 lg:border-l-[3px] lg:border-l-[#0366d6]"
                  : "border-b-[3px] border-b-transparent text-[#5f6368] hover:bg-[#f9fafb] lg:border-l-[3px] lg:border-l-transparent"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        <div
          ref={scrollRef}
          className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-white px-6 py-8 lg:px-10 lg:py-10"
        >
          <div className="mx-auto max-w-3xl space-y-14 pb-8">{children}</div>
        </div>
      </div>

      <footer className="flex shrink-0 justify-end gap-3 border-t border-[#e5e7eb] bg-white px-6 py-4 lg:px-8">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-[#dadce0] bg-white px-5 py-2 text-[13px] font-medium text-[#1a1a1a] shadow-sm transition hover:bg-[#f9fafb]"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          disabled={confirmDisabled}
          onClick={onConfirm}
          className="rounded-md bg-[#1b873f] px-5 py-2 text-[13px] font-medium text-white shadow-sm transition hover:bg-[#146c32] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {confirmLabel}
        </button>
      </footer>
    </div>
  );
}
