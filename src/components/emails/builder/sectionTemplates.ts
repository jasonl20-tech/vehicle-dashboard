/**
 * Section-Templates — generierte Vorlagen-Bibliothek.
 *
 * Die eigentlichen Layouts liegen modular in `templates/`:
 *   - `templates/themes.ts`       — Hell, Soft, Dunkel, Brand
 *   - `templates/layouts.ts`      — ~40 generische Layout-Builder
 *   - `templates/categories.ts`   — 27 Kategorien × 5 Layouts × 4 Themes
 *
 * → 27 × 5 × 4 = **540 Vorlagen**.
 *
 * Diese Datei flacht die Kategorien × Themes × Layouts zu einer flachen
 * `SECTION_TEMPLATES`-Liste ab, die das UI direkt rendert. Jedes
 * `SectionTemplate` hat:
 *   - `id`           eindeutig (kategorie + layout + theme)
 *   - `category`     Kategorie-ID
 *   - `themeId`      Theme-ID
 *   - `label`        kurzes UI-Label
 *   - `description`  Hilfe-Text für die UI
 *   - `keywords`     Suchterme (kategorie-keywords + label)
 *   - `build()`      erzeugt eine frische `Section` (mit eigenen IDs)
 *
 * Hinweis zur Idempotenz: Jeder `build()`-Aufruf erzeugt eine neue Section
 * mit unique IDs (`makeSection`/`makeImage` etc.). Beim Einfügen ins
 * Design wird zusätzlich `freshSection` aufgerufen, um dies erneut
 * sicherzustellen — falls jemand Templates clont oder cached.
 */
import { newId } from "./defaults";
import type { Section, SectionLayout } from "./types";
import { CATEGORIES, type CategoryDef } from "./templates/categories";
import { LAYOUTS } from "./templates/layouts";
import { THEMES, type Theme } from "./templates/themes";

/** Kompatibilitäts-Type — wird vom UI als String verwendet. */
export type SectionCategory = string;

export type SectionTemplate = {
  id: string;
  category: SectionCategory;
  themeId: string;
  label: string;
  description: string;
  keywords: string[];
  build: () => Section;
};

// ─── Generierung ──────────────────────────────────────────────────────

function buildTemplatesForCategory(cat: CategoryDef): SectionTemplate[] {
  const out: SectionTemplate[] = [];
  for (const layoutId of cat.layouts) {
    const layout = LAYOUTS[layoutId];
    if (!layout) continue;
    for (const theme of THEMES) {
      out.push({
        id: `${cat.id}__${layoutId}__${theme.id}`,
        category: cat.id,
        themeId: theme.id,
        label: `${layout.label} · ${theme.label}`,
        description: cat.description,
        keywords: [...cat.keywords, layout.label.toLowerCase(), theme.label.toLowerCase()],
        build: () => layout.build(theme as Theme, cat.content),
      });
    }
  }
  return out;
}

export const SECTION_TEMPLATES: SectionTemplate[] = CATEGORIES.flatMap(
  buildTemplatesForCategory,
);

export type SectionCategoryDef = {
  id: SectionCategory;
  label: string;
  description: string;
  count: number;
};

export const SECTION_CATEGORIES: SectionCategoryDef[] = CATEGORIES.map((c) => ({
  id: c.id,
  label: c.label,
  description: c.description,
  count: c.layouts.length * THEMES.length,
}));

/**
 * Erzeugt eine frische Kopie der Section mit eindeutigen IDs.
 * Beim Einfügen ins Design notwendig, damit mehrfaches Einfügen
 * derselben Vorlage kollisionsfrei bleibt.
 */
export function freshSection(s: Section): Section {
  const cloned: Section = JSON.parse(JSON.stringify(s));
  cloned.id = newId("sec");
  cloned.columns.forEach((c) => {
    c.id = newId("col");
    c.blocks.forEach((b) => {
      b.id = newId("blk");
    });
  });
  return cloned;
}

/**
 * Spalten-Verhältnisse pro Layout (für die Mini-Vorschau im Sidebar).
 */
export const SECTION_LAYOUT_RATIOS: Record<SectionLayout, number[]> = {
  "1": [100],
  "1-1": [50, 50],
  "1-2": [33, 67],
  "2-1": [67, 33],
  "1-1-1": [33, 33, 34],
};
