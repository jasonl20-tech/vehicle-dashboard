/**
 * Darstellung eingebetteter Medien im Rich-Text – an Contentful-Blöcke angelehnt
 * (Karte, Griff, Status-Badge, Aktionsmenü).
 */
import { GripVertical, MoreHorizontal } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  src: string;
  altText: string;
  assetKey: string;
};

export default function CmsLexicalImageBlock({
  src,
  altText,
  assetKey,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  const openOriginal = useCallback(() => {
    window.open(src, "_blank", "noopener,noreferrer");
    setMenuOpen(false);
  }, [src]);

  const copyKey = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(assetKey);
    } catch {
      // ignore
    }
    setMenuOpen(false);
  }, [assetKey]);

  return (
    <figure
      className="my-4 flex w-full gap-0 overflow-hidden rounded-xl border border-[#e8eaed] bg-white shadow-[0_1px_2px_rgba(60,64,67,0.1),0_1px_3px_rgba(60,64,67,0.08)]"
      contentEditable={false}
      data-cms-lexical-image="true"
    >
      <div
        className="flex w-9 shrink-0 cursor-grab select-none items-center justify-center border-r border-[#e8eaed] bg-[#fafbfc] text-[#80868b] hover:bg-[#f1f3f4] active:cursor-grabbing"
        title="Block: Bild aus der Mediathek. Zum Verschieben den Block markieren (Pfeiltasten)."
        onMouseDown={(e) => e.preventDefault()}
      >
        <GripVertical className="h-5 w-5" aria-hidden />
      </div>
      <div className="relative min-w-0 flex-1 p-2.5 sm:p-3">
        <div className="pointer-events-none absolute left-2.5 top-2.5 z-10 sm:left-3 sm:top-3">
          <span className="pointer-events-auto inline-flex rounded-md bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold text-white shadow-sm">
            Veröffentlicht
          </span>
        </div>
        <div className="absolute right-1.5 top-1.5 z-10 sm:right-2 sm:top-2" ref={menuRef}>
          <button
            type="button"
            className="rounded-md p-1 text-[#5f6368] transition hover:bg-black/[0.05] focus:outline-none focus:ring-2 focus:ring-[#0366d6]/35"
            aria-label="Aktionen zum eingebetteten Bild"
            aria-expanded={menuOpen}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>
          {menuOpen ? (
            <div
              className="absolute right-0 top-full z-20 mt-0.5 min-w-[12rem] rounded-lg border border-[#e8eaed] bg-white py-1 shadow-lg"
              role="menu"
            >
              <button
                type="button"
                role="menuitem"
                className="block w-full px-3 py-2 text-left text-[13px] text-ink-800 hover:bg-[#f1f3f4]"
                onMouseDown={(e) => e.preventDefault()}
                onClick={openOriginal}
              >
                Bild in neuem Tab öffnen
              </button>
              <button
                type="button"
                role="menuitem"
                className="block w-full px-3 py-2 text-left text-[13px] text-ink-800 hover:bg-[#f1f3f4]"
                onMouseDown={(e) => e.preventDefault()}
                onClick={copyKey}
              >
                Asset-Key kopieren
              </button>
            </div>
          ) : null}
        </div>
        <div className="relative mt-8 overflow-hidden rounded-lg bg-[#eceff1] sm:mt-9">
          <img
            src={src}
            alt={altText || "Eingebettetes Medium"}
            className="max-h-[min(24rem,55vh)] w-full object-contain"
            draggable={false}
          />
        </div>
        {altText ? (
          <figcaption className="mt-2 line-clamp-2 px-0.5 text-center text-[11px] leading-snug text-[#5f6368]">
            {altText}
          </figcaption>
        ) : null}
      </div>
    </figure>
  );
}
