/**
 * Geplanter Plan im KV: Schema für Formular (kein freies JSON).
 */

const STRIPE_PRICE_RE = /^price_[a-zA-Z0-9]+$/;

export type PlanFeatures = {
  allow_shadow: boolean;
  allow_transparent: boolean;
  allow_getall: boolean;
  allow_debug: boolean;
  allow_fallbacks: boolean;
  watermark_images: boolean;
};

export type PlanAssetRules = {
  allowed_formats: string[];
  allowed_resolutions: string[];
  allowed_views: string[];
  allowed_colors: string[];
};

export type PlanContentRestrictions = {
  is_test_mode: boolean;
  /** true = ["*"] */
  allow_all_vehicles: boolean;
  allowed_vehicle_ids: string[];
  year_range: { min: number; max: number };
  allowed_brands: string[];
  blocked_brands: string[];
  /** Markenname → Modell-IDs */
  blocked_models_rows: { brand: string; models: string[] }[];
};

export type PlanInfrastructure = {
  custom_cdn: string;
  analytics_env_name: string;
  cache_ttl_seconds: number;
};

export type PlanValue = {
  plan_name: string;
  expires_in_seconds: number;
  features: PlanFeatures;
  asset_rules: PlanAssetRules;
  content: PlanContentRestrictions;
  infrastructure: PlanInfrastructure;
  stripe_price_id: string;
};

function asBool(v: unknown, d: boolean): boolean {
  return typeof v === "boolean" ? v : d;
}
function asStr(v: unknown, d: string): string {
  return typeof v === "string" ? v : d;
}
function asStrArr(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x)).filter(Boolean);
}
function asNum(v: unknown, d: number): number {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (!Number.isNaN(n)) return n;
  }
  return d;
}

function parseBlockedModels(
  o: unknown,
): { brand: string; models: string[] }[] {
  if (o == null || typeof o !== "object" || Array.isArray(o)) return [];
  const out: { brand: string; models: string[] }[] = [];
  for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
    if (typeof v === "string") {
      if (v.trim()) out.push({ brand: k, models: v.split(/[,;]/).map((s) => s.trim()).filter(Boolean) });
      else out.push({ brand: k, models: [] });
    } else {
      out.push({ brand: k, models: asStrArr(v) });
    }
  }
  return out;
}

function toBlockedModelsJson(
  rows: { brand: string; models: string[] }[],
): Record<string, string[]> {
  const r: Record<string, string[]> = {};
  for (const row of rows) {
    const b = row.brand.trim();
    if (!b) continue;
    r[b] = [...row.models];
  }
  return r;
}

export function defaultPlanValue(planKey: string): PlanValue {
  return {
    plan_name: planKey,
    expires_in_seconds: 604800,
    features: {
      allow_shadow: false,
      allow_transparent: false,
      allow_getall: false,
      allow_debug: false,
      allow_fallbacks: true,
      watermark_images: false,
    },
    asset_rules: {
      allowed_formats: ["png"],
      allowed_resolutions: ["default"],
      allowed_views: ["front"],
      allowed_colors: ["default"],
    },
    content: {
      is_test_mode: false,
      allow_all_vehicles: true,
      allowed_vehicle_ids: [],
      year_range: { min: 2010, max: 2015 },
      allowed_brands: [],
      blocked_brands: [],
      blocked_models_rows: [],
    },
    infrastructure: {
      custom_cdn: "images.vehicleimagery.com",
      analytics_env_name: "production",
      cache_ttl_seconds: 604800,
    },
    stripe_price_id: "",
  };
}

/**
 * Liest abgespeichertes Plan-JSON in ein `PlanValue` (mit Defaults / Normalisierung).
 */
export function parsePlanValue(
  input: unknown,
  fallbackKey: string,
): { ok: true; value: PlanValue } | { ok: false; error: string } {
  let base: Record<string, unknown>;
  if (input == null) {
    return { ok: true, value: defaultPlanValue(fallbackKey) };
  }
  if (typeof input === "string") {
    try {
      base = JSON.parse(input) as Record<string, unknown>;
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "JSON" };
    }
  } else if (typeof input === "object" && !Array.isArray(input)) {
    base = { ...(input as Record<string, unknown>) };
  } else {
    return { ok: false, error: "Ungültiger Plan" };
  }

  const d = defaultPlanValue(asStr(base.plan_name, fallbackKey) || fallbackKey);
  const f = base.features as Record<string, unknown> | undefined;
  const a = base.asset_rules as Record<string, unknown> | undefined;
  const c = base.content_restrictions as Record<string, unknown> | undefined;
  const i = base.infrastructure as Record<string, unknown> | undefined;

  const y = c?.year_range as Record<string, unknown> | undefined;
  const vehicleIds = asStrArr(c?.allowed_vehicle_ids);
  const allV =
    vehicleIds.length === 1 && vehicleIds[0] === "*";

  const value: PlanValue = {
    plan_name: asStr(base.plan_name, d.plan_name) || d.plan_name,
    expires_in_seconds: asNum(base.expires_in_seconds, d.expires_in_seconds),
    features: {
      allow_shadow: asBool(f?.allow_shadow, d.features.allow_shadow),
      allow_transparent: asBool(
        f?.allow_transparent,
        d.features.allow_transparent,
      ),
      allow_getall: asBool(f?.allow_getall, d.features.allow_getall),
      allow_debug: asBool(f?.allow_debug, d.features.allow_debug),
      allow_fallbacks: asBool(f?.allow_fallbacks, d.features.allow_fallbacks),
      watermark_images: asBool(
        f?.watermark_images,
        d.features.watermark_images,
      ),
    },
    asset_rules: {
      allowed_formats: asStrArr(a?.allowed_formats).length
        ? asStrArr(a?.allowed_formats)
        : d.asset_rules.allowed_formats,
      allowed_resolutions: asStrArr(a?.allowed_resolutions).length
        ? asStrArr(a?.allowed_resolutions)
        : d.asset_rules.allowed_resolutions,
      allowed_views: asStrArr(a?.allowed_views).length
        ? asStrArr(a?.allowed_views)
        : d.asset_rules.allowed_views,
      allowed_colors: asStrArr(a?.allowed_colors).length
        ? asStrArr(a?.allowed_colors)
        : d.asset_rules.allowed_colors,
    },
    content: {
      is_test_mode: asBool(c?.is_test_mode, d.content.is_test_mode),
      allow_all_vehicles: allV || d.content.allow_all_vehicles,
      allowed_vehicle_ids: allV ? [] : vehicleIds,
      year_range: {
        min: asNum(y?.min, d.content.year_range.min),
        max: asNum(y?.max, d.content.year_range.max),
      },
      allowed_brands: asStrArr(c?.allowed_brands),
      blocked_brands: asStrArr(c?.blocked_brands),
      blocked_models_rows: parseBlockedModels(c?.blocked_models).length
        ? parseBlockedModels(c?.blocked_models)
        : d.content.blocked_models_rows,
    },
    infrastructure: {
      custom_cdn: asStr(i?.custom_cdn, d.infrastructure.custom_cdn),
      analytics_env_name: asStr(
        i?.analytics_env_name,
        d.infrastructure.analytics_env_name,
      ),
      cache_ttl_seconds: asNum(
        i?.cache_ttl_seconds,
        d.infrastructure.cache_ttl_seconds,
      ),
    },
    stripe_price_id: asStr(base.stripe_price_id, d.stripe_price_id).trim(),
  };

  if (value.content.year_range.min > value.content.year_range.max) {
    const t = value.content.year_range.min;
    value.content.year_range.min = value.content.year_range.max;
    value.content.year_range.max = t;
  }

  return { ok: true, value };
}

/**
 * Baut ein Objekt, das 1:1 im KV gespeichert wird.
 */
export function planValueToKvJson(p: PlanValue): Record<string, unknown> {
  const allowedIds = p.content.allow_all_vehicles
    ? ["*"]
    : p.content.allowed_vehicle_ids;

  return {
    plan_name: p.plan_name,
    expires_in_seconds: p.expires_in_seconds,
    features: { ...p.features },
    asset_rules: {
      allowed_formats: [...p.asset_rules.allowed_formats],
      allowed_resolutions: [...p.asset_rules.allowed_resolutions],
      allowed_views: [...p.asset_rules.allowed_views],
      allowed_colors: [...p.asset_rules.allowed_colors],
    },
    content_restrictions: {
      is_test_mode: p.content.is_test_mode,
      allowed_vehicle_ids: allowedIds,
      year_range: {
        min: p.content.year_range.min,
        max: p.content.year_range.max,
      },
      allowed_brands: [...p.content.allowed_brands],
      blocked_brands: [...p.content.blocked_brands],
      blocked_models: toBlockedModelsJson(p.content.blocked_models_rows),
    },
    infrastructure: { ...p.infrastructure },
    stripe_price_id: p.stripe_price_id.trim(),
  };
}

export function isValidStripePriceIdInput(s: string): boolean {
  if (!s.trim()) return true; // erlaubt leer
  return STRIPE_PRICE_RE.test(s.trim());
}
