/**
 * Linke Sidebar des Email-Builders. Zwei Tabs:
 *   - "Inhalt"  → Klickbare Block-Liste (fügt Block in die zuletzt
 *                 ausgewählte Spalte ein, alternativ unten in die
 *                 letzte Section)
 *   - "Layout"  → Sections-Layouts: 1 / 1-1 / 1-2 / 2-1 / 1-1-1
 *
 * Beide Listen sind Klick-basiert — das ist deutlich robuster als HTML5
 * Drag-and-Drop und für Email-Builder gängig (Mailchimp / Klaviyo
 * funktionieren genauso).
 */
import {
  Image as ImageIcon,
  Code2,
  LayoutGrid,
  Minus,
  MousePointer2,
  PanelLeft,
  Plus,
  Rows3,
  Type,
} from "lucide-react";
import type { ContentBlockType, SectionLayout } from "./types";

type BlockDef = {
  type: ContentBlockType;
  label: string;
  Icon: typeof Type;
};

const BLOCKS: BlockDef[] = [
  { type: "heading", label: "Überschrift", Icon: Type },
  { type: "text", label: "Text", Icon: Rows3 },
  { type: "button", label: "Button", Icon: MousePointer2 },
  { type: "image", label: "Bild", Icon: ImageIcon },
  { type: "spacer", label: "Spacer", Icon: PanelLeft },
  { type: "divider", label: "Trenner", Icon: Minus },
  { type: "html", label: "HTML", Icon: Code2 },
];

const LAYOUTS: { id: SectionLayout; label: string; cells: number[] }[] = [
  { id: "1", label: "1 Spalte", cells: [100] },
  { id: "1-1", label: "1 : 1", cells: [50, 50] },
  { id: "1-2", label: "1 : 2", cells: [33, 67] },
  { id: "2-1", label: "2 : 1", cells: [67, 33] },
  { id: "1-1-1", label: "1 : 1 : 1", cells: [33, 33, 34] },
];

type Props = {
  /** Aktueller Tab, wird vom Parent kontrolliert. */
  tab: "content" | "layout";
  onTabChange: (tab: "content" | "layout") => void;
  onAddBlock: (type: ContentBlockType) => void;
  onAddSection: (layout: SectionLayout) => void;
};

export default function BlockSidebar({
  tab,
  onTabChange,
  onAddBlock,
  onAddSection,
}: Props) {
  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-hair bg-white md:w-[220px] md:border-b-0 md:border-r">
      <div
        role="tablist"
        aria-label="Sidebar-Bereich"
        className="flex shrink-0 border-b border-hair bg-paper/60"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === "content"}
          onClick={() => onTabChange("content")}
          className={`flex flex-1 items-center justify-center gap-1 px-3 py-2 text-[12px] font-medium transition ${
            tab === "content"
              ? "border-b-2 border-ink-900 text-ink-900"
              : "text-ink-500 hover:text-ink-800"
          }`}
        >
          <Plus className="h-3.5 w-3.5" />
          Inhalt
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "layout"}
          onClick={() => onTabChange("layout")}
          className={`flex flex-1 items-center justify-center gap-1 px-3 py-2 text-[12px] font-medium transition ${
            tab === "layout"
              ? "border-b-2 border-ink-900 text-ink-900"
              : "text-ink-500 hover:text-ink-800"
          }`}
        >
          <LayoutGrid className="h-3.5 w-3.5" />
          Layout
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {tab === "content" ? (
          <>
            <p className="mb-2 text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-500">
              Inhalts-Blöcke
            </p>
            <div className="grid grid-cols-2 gap-2">
              {BLOCKS.map(({ type, label, Icon }) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => onAddBlock(type)}
                  className="group flex aspect-square flex-col items-center justify-center gap-1.5 rounded-lg border border-hair bg-white text-[11.5px] font-medium text-ink-700 transition hover:-translate-y-0.5 hover:border-ink-300 hover:bg-ink-50/40 hover:text-ink-900"
                >
                  <Icon className="h-5 w-5 text-ink-500 group-hover:text-ink-800" />
                  {label}
                </button>
              ))}
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-ink-500">
              Klicke auf einen Block, um ihn in die ausgewählte Spalte
              einzufügen. Falls keine Spalte ausgewählt ist, wird der
              Block unten in die letzte Section angehängt.
            </p>
          </>
        ) : (
          <>
            <p className="mb-2 text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-500">
              Section einfügen
            </p>
            <div className="space-y-1.5">
              {LAYOUTS.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => onAddSection(l.id)}
                  className="group flex w-full items-center gap-3 rounded-lg border border-hair bg-white p-2.5 transition hover:border-ink-300 hover:bg-ink-50/40"
                >
                  <div className="flex h-6 flex-1 gap-1">
                    {l.cells.map((c, i) => (
                      <div
                        key={i}
                        className="rounded bg-ink-200 transition group-hover:bg-ink-300"
                        style={{ flexBasis: `${c}%` }}
                      />
                    ))}
                  </div>
                  <span className="shrink-0 text-[11.5px] text-ink-700 group-hover:text-ink-900">
                    {l.label}
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-ink-500">
              Eine Section ist eine Reihe in deiner Mail. Sie kann ein
              oder mehrere Spalten haben — jede Spalte fasst Inhalts-
              Blöcke (Text, Button, Bild …).
            </p>
          </>
        )}
      </div>
    </aside>
  );
}
