import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BILLING_STRIPE_PRICES,
  putPlan,
  useJsonApi,
  type StripePricesResponse,
  type StripePriceRow,
} from "../../lib/billingApi";
import {
  defaultPlanValue,
  isValidStripePriceIdInput,
  parsePlanValue,
  planValueToKvJson,
  type PlanValue,
} from "../../lib/planFormTypes";
import { fetchVehicleCatalog, type VehicleImageryCatalog } from "../../lib/vehicleImageryApi";

type Props = {
  planKey: string;
  planOne: { key: string; value: unknown; raw: string } | null;
  planLoading: boolean;
  planErr: string | null;
  onAfterSave: () => void;
};

function mergeOpts(catalog: string[], current: string[]): string[] {
  return [...new Set([...catalog, ...current].filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "de", { numeric: true }),
  );
}

function fmtPriceLabel(p: StripePriceRow): string {
  if (p.unitAmount != null && p.currency) {
    try {
      const a = p.unitAmount / 100;
      return `${p.productName || p.nickname || "—"} – ${a.toFixed(2)} ${p.currency.toUpperCase()} – ${p.id}`;
    } catch {
      // ignore
    }
  }
  return p.id;
}

export default function PlanFormEditor({
  planKey,
  planOne,
  planLoading,
  planErr,
  onAfterSave,
}: Props) {
  const [model, setModel] = useState<PlanValue | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [cat, setCat] = useState<VehicleImageryCatalog | null>(null);
  const [catErr, setCatErr] = useState<string | null>(null);
  const [catLoading, setCatLoading] = useState(true);
  const [blockMarke, setBlockMarke] = useState<Record<number, string[]>>({});
  const sp = useJsonApi<StripePricesResponse>(BILLING_STRIPE_PRICES);
  const modelRef = useRef<PlanValue | null>(null);
  modelRef.current = model;

  const loadCat = useCallback(() => {
    setCatLoading(true);
    setCatErr(null);
    fetchVehicleCatalog()
      .then(setCat)
      .catch((e) =>
        setCatErr(
          e instanceof Error ? e.message : "Katalog nicht erreichbar (Binding D1?)",
        ),
      )
      .finally(() => setCatLoading(false));
  }, []);

  const loadModelleForBlockRow = useCallback(
    async (idx: number, marke: string) => {
      if (!marke) {
        setBlockMarke((m) => ({ ...m, [idx]: [] }));
        return;
      }
      try {
        const r = await fetchVehicleCatalog({ marke });
        setBlockMarke((m) => ({ ...m, [idx]: r.modelle }));
      } catch {
        setBlockMarke((m) => ({ ...m, [idx]: [] }));
      }
    },
    [],
  );

  useEffect(() => {
    loadCat();
  }, [loadCat]);

  const blockRowsBrandSig = model?.content.blocked_models_rows
    .map((r) => r.brand)
    .join("|");
  useEffect(() => {
    const m = modelRef.current;
    if (!m) return;
    m.content.blocked_models_rows.forEach((row, idx) => {
      if (row.brand) void loadModelleForBlockRow(idx, row.brand);
    });
  }, [planKey, blockRowsBrandSig, loadModelleForBlockRow]);

  useEffect(() => {
    if (!planOne || planOne.key !== planKey) return;
    let input: unknown = planOne.value;
    if (input == null && planOne.raw) {
      try {
        input = JSON.parse(planOne.raw) as unknown;
      } catch {
        setModel(null);
        setParseError("Gespeichertes JSON ist ungültig");
        return;
      }
    }
    if (input == null) {
      setModel(defaultPlanValue(planKey));
      setParseError(null);
      return;
    }
    const parsed = parsePlanValue(input, planKey);
    if (parsed.ok) {
      setModel(parsed.value);
      setParseError(null);
    } else {
      setModel(null);
      setParseError(parsed.error);
    }
  }, [planKey, planOne]);

  const jahreBounds = useMemo(() => {
    const j = cat?.jahre ?? [];
    if (j.length === 0) return { min: 1990, max: new Date().getFullYear() + 1 };
    return { min: Math.min(...j), max: Math.max(...j) };
  }, [cat?.jahre]);

  if (planLoading && !planOne) {
    return <p className="text-[13px] text-ink-400">Lade Plan …</p>;
  }
  if (planErr) {
    return <p className="text-[13px] text-accent-rose">{planErr}</p>;
  }
  if (parseError && !model) {
    return (
      <div className="space-y-2">
        <p className="text-[13px] text-accent-rose">
          Plan-JSON ungültig: {parseError}
        </p>
        <button
          type="button"
          onClick={() => {
            setModel(defaultPlanValue(planKey));
            setParseError(null);
          }}
          className="rounded-md border border-hair bg-white px-3 py-1.5 text-[12.5px]"
        >
          Auf Standard-Plan setzen
        </button>
      </div>
    );
  }
  if (!model) {
    return <p className="text-[13px] text-ink-400">…</p>;
  }

  const set = (patch: Partial<PlanValue> | ((m: PlanValue) => PlanValue)) => {
    setModel((m) => {
      if (!m) return m;
      return typeof patch === "function" ? patch(m) : { ...m, ...patch };
    });
  };

  const validationMsg = ((): string | null => {
    if (!isValidStripePriceIdInput(model.stripe_price_id)) {
      return "stripe_price_id: nur price_… oder leer";
    }
    if (model.content.year_range.min > model.content.year_range.max) {
      return "Jahresbereich: min > max";
    }
    if (
      !model.content.allow_all_vehicles &&
      model.content.allowed_vehicle_ids.length === 0
    ) {
      return "Fahrzeuge: „Alle“ aktivieren oder mindestens eine Fahrzeug-ID";
    }
    for (const k of [
      "allowed_formats",
      "allowed_resolutions",
      "allowed_views",
      "allowed_colors",
    ] as const) {
      if (model.asset_rules[k].length === 0) {
        return `Asset-Regeln: mindestens ein Eintrag für ${k}`;
      }
    }
    return null;
  })();

  const onSave = async () => {
    if (validationMsg) {
      setSaveErr(validationMsg);
      return;
    }
    setSaveErr(null);
    setSaving(true);
    try {
      await putPlan(planKey, planValueToKvJson(model));
      onAfterSave();
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      {catErr && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-[12.5px] text-amber-900">
          Katalog: {catErr} – Dropdowns können leer bleiben; Werte in den Plan
          trotzdem wählbar, wenn du sie zuvor gespeichert hast.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={loadCat}
          disabled={catLoading}
          className="inline-flex items-center gap-1 rounded-md border border-hair bg-white px-2.5 py-1 text-[12px] text-ink-600"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${catLoading ? "animate-spin" : ""}`}
          />
          Fahrzeugkatalog
        </button>
        {sp.error && (
          <span className="text-[11px] text-ink-500">(Stripe-Preisliste: {sp.error})</span>
        )}
      </div>

      <section>
        <h3 className="mb-2 font-display text-[16px] text-ink-900">Stammdaten</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-[12px]">
            <span className="text-ink-500">plan_name</span>
            <input
              value={model.plan_name}
              onChange={(e) => set({ plan_name: e.target.value })}
              className="mt-0.5 w-full rounded border border-hair bg-white px-2 py-1.5 font-mono text-[12px]"
            />
          </label>
          <label className="block text-[12px]">
            <span className="text-ink-500">expires_in_seconds</span>
            <input
              type="number"
              min={60}
              value={model.expires_in_seconds}
              onChange={(e) =>
                set({ expires_in_seconds: Number(e.target.value) || 604800 })
              }
              className="mt-0.5 w-full rounded border border-hair bg-white px-2 py-1.5 font-mono text-[12px]"
            />
          </label>
        </div>
      </section>

      <section>
        <h3 className="mb-2 font-display text-[16px] text-ink-900">Features</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              ["allow_shadow", "Schatten"],
              ["allow_transparent", "Transparenz"],
              ["allow_getall", "Get-All"],
              ["allow_debug", "Debug"],
              ["allow_fallbacks", "Fallbacks"],
              ["watermark_images", "Wasserzeichen"],
            ] as const
          ).map(([k, label]) => (
            <label
              key={k}
              className="flex cursor-pointer items-center gap-2 text-[12.5px]"
            >
              <input
                type="checkbox"
                checked={model.features[k]}
                onChange={(e) =>
                  setModel((m) =>
                    m
                      ? {
                        ...m,
                        features: { ...m.features, [k]: e.target.checked },
                      }
                      : m,
                  )
                }
              />
              {label}
            </label>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 font-display text-[16px] text-ink-900">
          Asset-Regeln
        </h3>
        <p className="mb-2 text-[11.5px] text-ink-500">
          Nur Werte aus dem D1-Katalog wählbar; bereits gespeicherte Werte erscheinen mit.
        </p>
        <div className="space-y-4">
          {(
            [
              [
                "allowed_formats",
                "Formate",
                (cat?.formate ?? []) as string[],
                (m: PlanValue) => m.asset_rules.allowed_formats,
                (a: string[]) => (m: PlanValue) =>
                  ({ ...m, asset_rules: { ...m.asset_rules, allowed_formats: a } }),
              ],
              [
                "allowed_resolutions",
                "Auflösungen",
                (cat?.resolutions ?? []) as string[],
                (m: PlanValue) => m.asset_rules.allowed_resolutions,
                (a: string[]) => (m: PlanValue) => ({
                  ...m,
                  asset_rules: { ...m.asset_rules, allowed_resolutions: a },
                }),
              ],
              [
                "allowed_views",
                "Ansichten",
                (cat?.ansichten ?? []) as string[],
                (m: PlanValue) => m.asset_rules.allowed_views,
                (a: string[]) => (m: PlanValue) => ({
                  ...m,
                  asset_rules: { ...m.asset_rules, allowed_views: a },
                }),
              ],
              [
                "allowed_colors",
                "Farben",
                (cat?.farben ?? []) as string[],
                (m: PlanValue) => m.asset_rules.allowed_colors,
                (a: string[]) => (m: PlanValue) => ({
                  ...m,
                  asset_rules: { ...m.asset_rules, allowed_colors: a },
                }),
              ],
            ] as const
          ).map(([key, label, opts, get, patch]) => {
            const current = get(model);
            const all = mergeOpts(opts, current);
            return (
              <div key={key}>
                <p className="mb-1 text-[11px] font-medium text-ink-500">{label}</p>
                <div className="max-h-40 space-y-1 overflow-y-auto rounded border border-hair/80 bg-ink-50/40 p-2">
                  {all.length === 0 && (
                    <p className="text-[11px] text-ink-400">(kein Katalog)</p>
                  )}
                  {all.map((opt) => (
                    <label
                      key={opt}
                      className="flex cursor-pointer items-center gap-2 text-[12px]"
                    >
                      <input
                        type="checkbox"
                        checked={current.includes(opt)}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...current, opt]
                            : current.filter((x: string) => x !== opt);
                          setModel((m) => (m ? patch(next)(m) : m));
                        }}
                      />
                      <span className="font-mono text-[11.5px]">{opt}</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h3 className="mb-2 font-display text-[16px] text-ink-900">
          Inhaltsbeschränkungen
        </h3>
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-[12.5px]">
            <input
              type="checkbox"
              checked={model.content.is_test_mode}
              onChange={(e) =>
                setModel((m) =>
                  m
                    ? {
                      ...m,
                      content: { ...m.content, is_test_mode: e.target.checked },
                    }
                    : m,
                )
              }
            />
            Testmodus
          </label>
          <label className="flex items-center gap-2 text-[12.5px]">
            <input
              type="checkbox"
              checked={model.content.allow_all_vehicles}
              onChange={(e) => {
                const v = e.target.checked;
                setModel((m) =>
                  m
                    ? {
                      ...m,
                      content: { ...m.content, allow_all_vehicles: v, allowed_vehicle_ids: v ? [] : m.content.allowed_vehicle_ids },
                    }
                    : m,
                );
              }}
            />
            Alle Fahrzeuge erlaubt <span className="font-mono">(allowed_vehicle_ids: [&quot;*&quot;])</span>
          </label>
          {!model.content.allow_all_vehicles && (
            <div>
              <p className="mb-1 text-[11px] text-ink-500">Fahrzeug-IDs (eine pro Zeile)</p>
              <textarea
                value={model.content.allowed_vehicle_ids.join("\n")}
                onChange={(e) =>
                  setModel((m) =>
                    m
                      ? {
                        ...m,
                        content: {
                          ...m.content,
                          allowed_vehicle_ids: e.target.value
                            .split(/[\n,;]+/)
                            .map((s) => s.trim())
                            .filter(Boolean),
                        },
                      }
                      : m,
                  )
                }
                className="h-20 w-full rounded border border-hair bg-white p-2 font-mono text-[11.5px]"
                placeholder="id1"
              />
            </div>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-[12px]">
              <span className="text-ink-500">Jahre min (ca. {jahreBounds.min}–{jahreBounds.max})</span>
              <input
                type="number"
                value={model.content.year_range.min}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setModel((m) =>
                    m
                      ? {
                        ...m,
                        content: {
                          ...m.content,
                          year_range: { ...m.content.year_range, min: n },
                        },
                      }
                      : m,
                  );
                }}
                className="mt-0.5 w-full rounded border border-hair bg-white px-2 py-1.5 font-mono text-[12px]"
              />
            </label>
            <label className="text-[12px]">
              <span className="text-ink-500">Jahre max</span>
              <input
                type="number"
                value={model.content.year_range.max}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setModel((m) =>
                    m
                      ? {
                        ...m,
                        content: {
                          ...m.content,
                          year_range: { ...m.content.year_range, max: n },
                        },
                      }
                      : m,
                  );
                }}
                className="mt-0.5 w-full rounded border border-hair bg-white px-2 py-1.5 font-mono text-[12px]"
              />
            </label>
          </div>
          <div>
            <p className="mb-1 text-[11px] text-ink-500">Erlaubte Marken</p>
            <div className="max-h-32 space-y-1 overflow-y-auto rounded border border-hair/80 p-2">
              {mergeOpts(cat?.marken ?? [], model.content.allowed_brands).map(
                (opt) => (
                  <label
                    key={`a-${opt}`}
                    className="flex items-center gap-2 text-[12px]"
                  >
                    <input
                      type="checkbox"
                      checked={model.content.allowed_brands.includes(opt)}
                      onChange={(e) => {
                        const a = e.target.checked
                          ? [...model.content.allowed_brands, opt]
                          : model.content.allowed_brands.filter((x) => x !== opt);
                        setModel((m) =>
                          m ? { ...m, content: { ...m.content, allowed_brands: a } } : m,
                        );
                      }}
                    />
                    {opt}
                  </label>
                ),
              )}
            </div>
          </div>
          <div>
            <p className="mb-1 text-[11px] text-ink-500">Blockierte Marken</p>
            <div className="max-h-32 space-y-1 overflow-y-auto rounded border border-hair/80 p-2">
              {mergeOpts(cat?.marken ?? [], model.content.blocked_brands).map(
                (opt) => (
                  <label
                    key={`b-${opt}`}
                    className="flex items-center gap-2 text-[12px]"
                  >
                    <input
                      type="checkbox"
                      checked={model.content.blocked_brands.includes(opt)}
                      onChange={(e) => {
                        const a = e.target.checked
                          ? [...model.content.blocked_brands, opt]
                          : model.content.blocked_brands.filter((x) => x !== opt);
                        setModel((m) =>
                          m
                            ? { ...m, content: { ...m.content, blocked_brands: a } }
                            : m,
                        );
                      }}
                    />
                    {opt}
                  </label>
                ),
              )}
            </div>
          </div>
          <div>
            <p className="mb-1 text-[11px] text-ink-500">
              blockierte Modelle (pro Marke)
            </p>
            {model.content.blocked_models_rows.map((row, idx) => (
              <div
                key={idx}
                className="mb-2 flex flex-col gap-2 rounded border border-hair/60 p-2 sm:flex-row sm:items-start"
              >
                <select
                  value={row.brand}
                  onChange={async (e) => {
                    const brand = e.target.value;
                    setModel((m) => {
                      if (!m) return m;
                      const rows = [...m.content.blocked_models_rows];
                      rows[idx] = { ...rows[idx], brand, models: [] };
                      return { ...m, content: { ...m.content, blocked_models_rows: rows } };
                    });
                    await loadModelleForBlockRow(idx, brand);
                  }}
                  className="rounded border border-hair bg-white px-2 py-1.5 text-[12px]"
                >
                  <option value="">Marke wählen</option>
                  {(cat?.marken ?? []).map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <div className="min-w-0 flex-1 max-h-28 space-y-1 overflow-y-auto">
                  {mergeOpts(
                    blockMarke[idx] ?? [],
                    row.models,
                  ).map((opt) => (
                    <label
                      key={opt}
                      className="flex items-center gap-2 text-[11px] font-mono"
                    >
                      <input
                        type="checkbox"
                        checked={row.models.includes(opt)}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...row.models, opt]
                            : row.models.filter((x) => x !== opt);
                          setModel((m) => {
                            if (!m) return m;
                            const rows = [...m.content.blocked_models_rows];
                            rows[idx] = { ...rows[idx], models: next };
                            return {
                              ...m,
                              content: { ...m.content, blocked_models_rows: rows },
                            };
                          });
                        }}
                      />
                      {opt}
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setModel((m) => {
                      if (!m) return m;
                      const rows = m.content.blocked_models_rows.filter(
                        (_, i) => i !== idx,
                      );
                      return { ...m, content: { ...m.content, blocked_models_rows: rows } };
                    });
                    setBlockMarke((o) => {
                      const n = { ...o };
                      delete n[idx];
                      return n;
                    });
                  }}
                  className="self-start rounded p-1 text-ink-500 hover:text-accent-rose"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setModel((m) => {
                  if (!m) return m;
                  return {
                    ...m,
                    content: {
                      ...m.content,
                      blocked_models_rows: [
                        ...m.content.blocked_models_rows,
                        { brand: "", models: [] },
                      ],
                    },
                  };
                })
              }
              className="mt-1 inline-flex items-center gap-1 text-[12px] text-ink-600"
            >
              <Plus className="h-3.5 w-3.5" />
              Marke/Modelle
            </button>
          </div>
        </div>
      </section>

      <section>
        <h3 className="mb-2 font-display text-[16px] text-ink-900">Infrastruktur</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block text-[12px] sm:col-span-2">
            <span className="text-ink-500">custom_cdn</span>
            <input
              value={model.infrastructure.custom_cdn}
              onChange={(e) =>
                setModel((m) =>
                  m
                    ? {
                      ...m,
                      infrastructure: {
                        ...m.infrastructure,
                        custom_cdn: e.target.value,
                      },
                    }
                    : m,
                )
              }
              className="mt-0.5 w-full rounded border border-hair bg-white px-2 py-1.5 font-mono text-[12px]"
            />
          </label>
          <label className="block text-[12px]">
            <span className="text-ink-500">analytics_env_name</span>
            <input
              value={model.infrastructure.analytics_env_name}
              onChange={(e) =>
                setModel((m) =>
                  m
                    ? {
                      ...m,
                      infrastructure: {
                        ...m.infrastructure,
                        analytics_env_name: e.target.value,
                      },
                    }
                    : m,
                )
              }
              className="mt-0.5 w-full rounded border border-hair bg-white px-2 py-1.5 font-mono text-[12px]"
            />
          </label>
          <label className="block text-[12px]">
            <span className="text-ink-500">cache_ttl_seconds</span>
            <input
              type="number"
              min={0}
              value={model.infrastructure.cache_ttl_seconds}
              onChange={(e) =>
                setModel((m) =>
                  m
                    ? {
                      ...m,
                      infrastructure: {
                        ...m.infrastructure,
                        cache_ttl_seconds: Number(e.target.value) || 0,
                      },
                    }
                    : m,
                )
              }
              className="mt-0.5 w-full rounded border border-hair bg-white px-2 py-1.5 font-mono text-[12px]"
            />
          </label>
        </div>
      </section>

      <section>
        <h3 className="mb-2 font-display text-[16px] text-ink-900">Stripe</h3>
        <div className="max-w-lg">
          {sp.data && sp.data.prices.length > 0 ? (
            <select
              value={
                sp.data.prices.some((p) => p.id === model.stripe_price_id)
                  ? model.stripe_price_id
                  : model.stripe_price_id
                    ? `__custom__${model.stripe_price_id}`
                    : ""
              }
              onChange={(e) => {
                const v = e.target.value;
                if (v.startsWith("__custom__")) {
                  set({ stripe_price_id: v.replace("__custom__", "") });
                } else {
                  set({ stripe_price_id: v });
                }
              }}
              className="w-full rounded border border-hair bg-white px-2 py-2 text-[12px]"
            >
              <option value="">— kein Preis (oder unten manuell) —</option>
              {sp.data.prices.map((p) => (
                <option key={p.id} value={p.id}>
                  {fmtPriceLabel(p)}
                </option>
              ))}
              {model.stripe_price_id &&
                !sp.data.prices.some((p) => p.id === model.stripe_price_id) && (
                <option value={`__custom__${model.stripe_price_id}`}>
                  Gespeichert: {model.stripe_price_id}
                </option>
              )}
            </select>
          ) : null}
          <label className="mt-2 block text-[12px]">
            <span className="text-ink-500">stripe_price_id (manuell)</span>
            <input
              value={model.stripe_price_id}
              onChange={(e) => set({ stripe_price_id: e.target.value.trim() })}
              placeholder="price_…"
              className="mt-0.5 w-full rounded border border-hair bg-white px-2 py-1.5 font-mono text-[12px]"
            />
          </label>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={saving || !!validationMsg}
          onClick={onSave}
          className="rounded-md border border-hair bg-ink-900 px-4 py-2 text-[12.5px] text-white disabled:opacity-50"
        >
          {saving ? "…" : "Plan speichern"}
        </button>
        {validationMsg && (
          <p className="text-[12px] text-amber-800">{validationMsg}</p>
        )}
        {saveErr && <p className="text-[12px] text-accent-rose">{saveErr}</p>}
      </div>
    </div>
  );
}
