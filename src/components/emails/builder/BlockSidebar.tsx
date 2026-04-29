/**
 * Linke Sidebar des Email-Builders. Drei Tabs:
 *   - "Inhalt"    — klickbare Block-Liste (fügt Block in die zuletzt
 *                   ausgewählte Spalte ein)
 *   - "Layout"    — leere Section-Layouts: 1 / 1-1 / 1-2 / 2-1 / 1-1-1
 *   - "Vorlagen"  — fertige Section-Bausteine in 27 Kategorien
 *                   (Welcome, Hero, Newsletter, Receipt …) × 4 Themes
 *
 * Die Vorlagen-Liste ist groß (500+ Templates), darum:
 *   - Suchleiste oben (Volltext über Label, Beschreibung, Keywords)
 *   - Kategorien sind **kollabierte Akkordeons**, default zugeklappt
 *   - Bei aktiver Suche werden alle matchenden Kategorien automatisch
 *     ausgeklappt; die anderen verschwinden.
 *   - Templates pro Kategorie sind nach Theme gruppiert (mit Theme-Pill).
 */
import {
  Image as ImageIcon,
  AtSign,
  ChevronDown,
  ChevronRight,
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
  Search,
  Share2,
  Sparkles,
  Type,
  UserCircle2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  SECTION_CATEGORIES,
  SECTION_LAYOUT_RATIOS,
  SECTION_TEMPLATES,
  type SectionTemplate,
} from "./sectionTemplates";
import { THEMES } from "./templates/themes";
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

/** Icon-Mapping pro Kategorie — fällt auf `Sparkles` zurück. */
const CATEGORY_ICONS: Record<string, typeof Layers> = {
  header: Layers,
  hero: ImageIcon,
  welcome: Sparkles,
  onboarding: Rows3,
  announcement: Sparkles,
  product_launch: ImageIcon,
  feature_release: Sparkles,
  promotion: MousePointer2,
  sale: MousePointer2,
  event: PlayCircle,
  newsletter: Rows3,
  digest: ListIcon,
  transactional: Rows3,
  receipt: ListIcon,
  shipping: Rows3,
  reminder: Sparkles,
  reengagement: Sparkles,
  survey: ListIcon,
  testimonial: Quote,
  pricing: MousePointer2,
  stats: LayoutGrid,
  team: UserCircle2,
  content: Rows3,
  cta: MousePointer2,
  footer: AtSign,
  legal: Rows3,
  holiday: Sparkles,
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
    <aside className="flex w-full shrink-0 flex-col border-b border-hair bg-white md:w-[260px] md:border-b-0 md:border-r">
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

      <div className="flex min-h-0 flex-1 flex-col">
        {tab === "content" && (
          <div className="overflow-y-auto p-3">
            <ContentTab onAddBlock={onAddBlock} />
          </div>
        )}
        {tab === "layout" && (
          <div className="overflow-y-auto p-3">
            <LayoutTab onAddSection={onAddSection} />
          </div>
        )}
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
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [openCats, setOpenCats] = useState<Set<string>>(() => new Set());
  const [themeFilter, setThemeFilter] = useState<string>("all");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim().toLowerCase()), 180);
    return () => clearTimeout(t);
  }, [search]);

  const totalCount = SECTION_TEMPLATES.length;

  // Templates nach Kategorie gruppieren
  const grouped = useMemo(() => {
    const m = new Map<string, SectionTemplate[]>();
    for (const t of SECTION_TEMPLATES) {
      if (themeFilter !== "all" && t.themeId !== themeFilter) continue;
      if (debounced) {
        const hay = [t.label, t.description, ...t.keywords]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(debounced)) continue;
      }
      const arr = m.get(t.category) ?? [];
      arr.push(t);
      m.set(t.category, arr);
    }
    return m;
  }, [debounced, themeFilter]);

  const filteredCats = useMemo(
    () => SECTION_CATEGORIES.filter((c) => (grouped.get(c.id)?.length ?? 0) > 0),
    [grouped],
  );

  const filteredTotal = useMemo(
    () =>
      Array.from(grouped.values()).reduce((acc, arr) => acc + arr.length, 0),
    [grouped],
  );

  // Bei aktiver Suche/Filter: alle übrig gebliebenen Kategorien automatisch öffnen
  const isFiltering = debounced.length > 0 || themeFilter !== "all";

  const toggleCat = (id: string) => {
    setOpenCats((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Such-Header */}
      <div className="sticky top-0 z-10 shrink-0 space-y-2 border-b border-hair bg-white p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Vorlagen durchsuchen…"
            className="w-full rounded-md border border-hair bg-paper pl-7 pr-7 py-1.5 text-[12px] focus:border-ink-500 focus:outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              title="Suche leeren"
              className="absolute right-1 top-1/2 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-ink-400 hover:bg-ink-50 hover:text-ink-700"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <ThemeChip
            id="all"
            label="Alle Themes"
            color="#6a6a70"
            active={themeFilter === "all"}
            onClick={() => setThemeFilter("all")}
          />
          {THEMES.map((t) => (
            <ThemeChip
              key={t.id}
              id={t.id}
              label={t.label}
              color={t.bg}
              active={themeFilter === t.id}
              onClick={() => setThemeFilter(t.id)}
            />
          ))}
        </div>
        <div className="flex items-center justify-between text-[10.5px] text-ink-500">
          <span>
            {isFiltering ? (
              <>
                <strong className="text-ink-700">{filteredTotal}</strong> /{" "}
                {totalCount} Vorlagen
              </>
            ) : (
              <>
                <strong className="text-ink-700">{totalCount}</strong> Vorlagen
                in {SECTION_CATEGORIES.length} Kategorien
              </>
            )}
          </span>
          {!isFiltering && openCats.size > 0 && (
            <button
              type="button"
              onClick={() => setOpenCats(new Set())}
              className="text-ink-500 underline-offset-2 hover:text-ink-800 hover:underline"
            >
              Alle einklappen
            </button>
          )}
          {!isFiltering && openCats.size === 0 && filteredCats.length > 0 && (
            <button
              type="button"
              onClick={() =>
                setOpenCats(new Set(filteredCats.map((c) => c.id)))
              }
              className="text-ink-500 underline-offset-2 hover:text-ink-800 hover:underline"
            >
              Alle ausklappen
            </button>
          )}
        </div>
      </div>

      {/* Kategorien-Liste */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {filteredCats.length === 0 ? (
          <div className="px-3 py-12 text-center text-[12px] text-ink-500">
            Keine Vorlagen gefunden
            {debounced ? (
              <>
                {" "}
                für „<strong>{debounced}</strong>"
              </>
            ) : null}
            .
          </div>
        ) : (
          <div className="space-y-1 p-2">
            {filteredCats.map((cat) => {
              const tpls = grouped.get(cat.id) ?? [];
              const open = isFiltering || openCats.has(cat.id);
              const Icon = CATEGORY_ICONS[cat.id] ?? Sparkles;
              return (
                <div key={cat.id} className="overflow-hidden rounded-md">
                  <button
                    type="button"
                    onClick={() => !isFiltering && toggleCat(cat.id)}
                    aria-expanded={open}
                    className={`flex w-full items-center gap-2 px-2 py-1.5 text-left text-[12px] transition ${
                      open
                        ? "bg-ink-50/60 text-ink-900"
                        : "hover:bg-ink-50/60 text-ink-800"
                    }`}
                  >
                    {!isFiltering &&
                      (open ? (
                        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-ink-500" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-500" />
                      ))}
                    {isFiltering && <Search className="h-3 w-3 shrink-0 text-ink-400" />}
                    <Icon className="h-3.5 w-3.5 shrink-0 text-ink-500" />
                    <span className="flex-1 truncate font-medium">
                      {cat.label}
                    </span>
                    <span className="shrink-0 rounded-full bg-ink-100 px-1.5 text-[10px] text-ink-600">
                      {tpls.length}
                    </span>
                  </button>
                  {open && (
                    <div className="space-y-1 border-l border-hair px-2 py-1.5">
                      <p className="mb-1 line-clamp-2 px-1 text-[10.5px] leading-snug text-ink-500">
                        {cat.description}
                      </p>
                      {tpls.map((t) => (
                        <SectionTemplateCard
                          key={t.id}
                          template={t}
                          onClick={() => onAddTemplate(t.build)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-hair bg-paper/60 p-2">
        <p className="text-[10px] leading-snug text-ink-500">
          Vorlagen sind komplett editierbar — Texte, Farben, Bilder und
          Größen kannst du nach dem Einfügen anpassen. Bilder ersetzt du
          per Klick auf das Bild + „Aus Assets wählen".
        </p>
      </div>
    </div>
  );
}

function ThemeChip({
  label,
  color,
  active,
  onClick,
}: {
  id: string;
  label: string;
  color: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-medium transition ${
        active
          ? "border-ink-900 bg-ink-900 text-white"
          : "border-hair bg-white text-ink-600 hover:border-ink-300 hover:text-ink-900"
      }`}
    >
      <span
        className="inline-block h-2 w-2 rounded-full ring-1 ring-black/10"
        style={{ background: color }}
      />
      {label}
    </button>
  );
}

function SectionTemplateCard({
  template,
  onClick,
}: {
  template: SectionTemplate;
  onClick: () => void;
}) {
  // Mini-Vorschau: einmal bauen, um die Spaltenanzahl + Hintergrund zu kennen.
  // Wir cachen mit useMemo, damit die Vorschau bei Re-Renders nicht jedes Mal
  // alle Helpers durchläuft (verhindert IDs-Drift).
  const section = useMemo(() => template.build(), [template.id]);
  const ratios = SECTION_LAYOUT_RATIOS[section.layout];
  const bg = section.backgroundColor ?? "#ffffff";
  const isDark = isDarkBg(bg);

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
                  background: isDark
                    ? "rgba(255,255,255,0.18)"
                    : "rgba(15,15,16,0.06)",
                }}
              >
                {Array.from({ length: Math.min(blocks, 3) }).map((_, j) => (
                  <div
                    key={j}
                    className="mx-1 h-[2px] rounded-[1px]"
                    style={{
                      background: isDark
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
        <p className="mt-0.5 line-clamp-1 text-[10.5px] leading-snug text-ink-500">
          {template.description}
        </p>
      </div>
    </button>
  );
}

function isDarkBg(bg: string): boolean {
  if (!bg) return false;
  const s = bg.toLowerCase().trim();
  if (s.startsWith("#")) {
    const hex = s.slice(1);
    if (hex.length !== 3 && hex.length !== 6) return false;
    const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    // Relativ-Helligkeit, schneller Approx
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return lum < 0.5;
  }
  return /rgb\(/.test(s);
}
