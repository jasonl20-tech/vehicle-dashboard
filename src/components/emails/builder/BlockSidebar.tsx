/**
 * Linke Sidebar des Email-Builders. Drei Tabs:
 *   - "Inhalt"    — Klickbare Block-Liste (fügt Block in die zuletzt
 *                   ausgewählte Spalte ein)
 *   - "Layout"    — Leere Section-Layouts: 1 / 1-1 / 1-2 / 2-1 / 1-1-1
 *   - "Vorlagen"  — Komplett vorbereitete Section-Bausteine
 *                   (Header, Hero, Content, CTA, Footer)
 *
 * Die Vorlagen-Liste ist nach Kategorien gruppiert. Jede Vorlage zeigt
 * eine Mini-Vorschau der Spalten-Aufteilung links, Label + Beschreibung
 * rechts. Klick fügt die Vorlage als neue Section unten an oder unter
 * der aktuell ausgewählten Section ein.
 */
import {
  Image as ImageIcon,
  AtSign,
  Code2,
  Layers,
  LayoutGrid,
  List as ListIcon,
  Minus,
  MousePointer2,
  PanelLeft,
  PlayCircle,
  Plus,
  Quote,
  Rows3,
  Share2,
  Type,
  UserCircle2,
} from "lucide-react";
import {
  SECTION_CATEGORIES,
  SECTION_LAYOUT_RATIOS,
  SECTION_TEMPLATES,
  type SectionCategory,
  type SectionTemplate,
} from "./sectionTemplates";
import type { ContentBlockType, Section, SectionLayout } from "./types";

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
  { type: "list", label: "Liste", Icon: ListIcon },
  { type: "quote", label: "Zitat", Icon: Quote },
  { type: "video", label: "Video", Icon: PlayCircle },
  { type: "social", label: "Social", Icon: Share2 },
  { type: "avatar", label: "Avatar", Icon: UserCircle2 },
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

const CATEGORY_ICONS: Record<SectionCategory, typeof Layers> = {
  header: Layers,
  hero: ImageIcon,
  content: Rows3,
  cta: MousePointer2,
  footer: AtSign,
};

type Props = {
  /** Aktueller Tab, wird vom Parent kontrolliert. */
  tab: "content" | "layout" | "templates";
  onTabChange: (tab: "content" | "layout" | "templates") => void;
  onAddBlock: (type: ContentBlockType) => void;
  onAddSection: (layout: SectionLayout) => void;
  onAddSectionTemplate: (sectionFactory: () => Section) => void;
};

export default function BlockSidebar({
  tab,
  onTabChange,
  onAddBlock,
  onAddSection,
  onAddSectionTemplate,
}: Props) {
  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-hair bg-white md:w-[240px] md:border-b-0 md:border-r">
      <div
        role="tablist"
        aria-label="Sidebar-Bereich"
        className="flex shrink-0 border-b border-hair bg-paper/60"
      >
        <SidebarTab
          active={tab === "content"}
          onClick={() => onTabChange("content")}
          icon={<Plus className="h-3.5 w-3.5" />}
          label="Inhalt"
        />
        <SidebarTab
          active={tab === "layout"}
          onClick={() => onTabChange("layout")}
          icon={<LayoutGrid className="h-3.5 w-3.5" />}
          label="Layout"
        />
        <SidebarTab
          active={tab === "templates"}
          onClick={() => onTabChange("templates")}
          icon={<Layers className="h-3.5 w-3.5" />}
          label="Vorlagen"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {tab === "content" && <ContentTab onAddBlock={onAddBlock} />}
        {tab === "layout" && <LayoutTab onAddSection={onAddSection} />}
        {tab === "templates" && (
          <TemplatesTab onAddTemplate={onAddSectionTemplate} />
        )}
      </div>
    </aside>
  );
}

function SidebarTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1 px-2 py-2 text-[11.5px] font-medium transition ${
        active
          ? "border-b-2 border-ink-900 text-ink-900"
          : "text-ink-500 hover:text-ink-800"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

// ─── Content-Tab ─────────────────────────────────────────────────────

function ContentTab({
  onAddBlock,
}: {
  onAddBlock: (type: ContentBlockType) => void;
}) {
  return (
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
        Klick fügt den Block in die ausgewählte Spalte ein. Wenn nichts
        ausgewählt ist, wird der Block unten in die letzte Section
        angehängt.
      </p>
    </>
  );
}

// ─── Layout-Tab ──────────────────────────────────────────────────────

function LayoutTab({
  onAddSection,
}: {
  onAddSection: (layout: SectionLayout) => void;
}) {
  return (
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
        Eine Section ist eine Reihe in deiner Mail. Sie kann ein bis drei
        Spalten haben — jede Spalte fasst Inhalts-Blöcke.
      </p>
    </>
  );
}

// ─── Vorlagen-Tab ────────────────────────────────────────────────────

function TemplatesTab({
  onAddTemplate,
}: {
  onAddTemplate: (factory: () => Section) => void;
}) {
  return (
    <div className="space-y-3">
      {SECTION_CATEGORIES.map(({ id, label }) => {
        const tpls = SECTION_TEMPLATES.filter((t) => t.category === id);
        if (tpls.length === 0) return null;
        const Icon = CATEGORY_ICONS[id];
        return (
          <section key={id}>
            <p className="mb-1.5 inline-flex items-center gap-1 text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-500">
              <Icon className="h-3 w-3" />
              {label}
            </p>
            <div className="space-y-1.5">
              {tpls.map((t) => (
                <SectionTemplateCard
                  key={t.id}
                  template={t}
                  onClick={() => onAddTemplate(t.build)}
                />
              ))}
            </div>
          </section>
        );
      })}
      <p className="border-t border-hair pt-2 text-[10.5px] leading-snug text-ink-500">
        Vorlagen sind editierbar — alle Texte, Farben, Bilder und Größen
        kannst du danach anpassen.
      </p>
    </div>
  );
}

function SectionTemplateCard({
  template,
  onClick,
}: {
  template: SectionTemplate;
  onClick: () => void;
}) {
  // Mini-Vorschau der Section-Aufteilung — wir bauen die Section im Hintergrund
  // einmal, um die Spaltenanzahl zu kennen.
  const section = template.build();
  const ratios = SECTION_LAYOUT_RATIOS[section.layout];
  const bg = section.backgroundColor ?? "#ffffff";

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full gap-2 rounded-lg border border-hair bg-white p-2 text-left transition hover:-translate-y-0.5 hover:border-ink-300 hover:shadow-sm"
    >
      <div
        className="grid h-10 w-12 shrink-0 grid-cols-1 gap-0.5 overflow-hidden rounded border border-hair p-1"
        style={{ background: bg }}
      >
        <div className="flex h-full gap-0.5">
          {ratios.map((r, i) => {
            const col = section.columns[i];
            const blocks = col?.blocks.length ?? 0;
            return (
              <div
                key={i}
                className="flex flex-col justify-center gap-[1px] rounded-[1px]"
                style={{
                  flexBasis: `${r}%`,
                  background:
                    bg === "#0f0f10" || bg === "#000000"
                      ? "rgba(255,255,255,0.18)"
                      : "rgba(15,15,16,0.06)",
                }}
              >
                {Array.from({ length: Math.min(blocks, 3) }).map((_, j) => (
                  <div
                    key={j}
                    className="mx-1 h-[2px] rounded-[1px]"
                    style={{
                      background:
                        bg === "#0f0f10" || bg === "#000000"
                          ? "rgba(255,255,255,0.55)"
                          : "rgba(15,15,16,0.42)",
                    }}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-medium text-ink-900">
          {template.label}
        </p>
        <p className="mt-0.5 line-clamp-2 text-[10.5px] leading-snug text-ink-500">
          {template.description}
        </p>
      </div>
    </button>
  );
}
