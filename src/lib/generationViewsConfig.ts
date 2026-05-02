/**
 * Frontend-Typen + API-Pfad für die `generation_views`-Settings.
 *
 * Steuert, welche fehlenden Ansichten als „+"-Button (Generation-Job)
 * angezeigt werden dürfen.
 */

export const GENERATION_VIEWS_SETTINGS_PATH = "/api/configs/generation-views";

/** Map: lowercase view-slug → boolean. */
export type GenerationViewsConfig = Record<string, boolean>;

export type GenerationViewsApiResponse = {
  views: GenerationViewsConfig;
  _meta?: { source: "database" | "default"; configsBound: boolean };
};

/**
 * Prüft, ob für eine fehlende Ansicht ein „+"-Button angeboten werden
 * darf. Lookup ist case-insensitiv.
 */
export function isGenerationAllowedForSlug(
  config: GenerationViewsConfig | null | undefined,
  slug: string | null | undefined,
): boolean {
  if (!config || !slug) return false;
  return config[slug.trim().toLowerCase()] === true;
}
