import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
  const [savedPing, setSavedPing] = useState(false);
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
    return <p className="py-8 text-[12.5px] text-ink-400">Lade Plan …</p>;
  }
  if (planErr) {
    return (
      <p className="border-l-2 border-accent-rose px-3 py-2 text-[12.5px] text-accent-rose">
        {planErr}
      </p>
    );
  }
  if (parseError && !model) {
    return (
      <div className="space-y-3">
        <p className="border-l-2 border-accent-rose px-3 py-2 text-[12.5px] text-accent-rose">
          Plan-JSON ungültig: {parseError}
        </p>
        <button
          type="button"
          onClick={() => {
            setModel(defaultPlanValue(planKey));
            setParseError(null);
          }}
          className="rounded-md border border-hair bg-white px-3 py-1.5 text-[12.5px] text-ink-700 hover:border-ink-300 hover:text-ink-900"
        >
          Auf Standard-Plan setzen
        </button>
      </div>
    );
  }
  if (!model) {
    return <p className="py-8 text-[12.5px] text-ink-400">…</p>;
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
      setSavedPing(true);
      window.setTimeout(() => setSavedPing(false), 1600);
      onAfterSave();
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {catErr && (
        <p className="mb-6 border-l-2 border-accent-amber px-3 py-2 text-[12px] text-accent-amber">
          Katalog: {catErr} — Dropdowns können leer bleiben; bereits
          gespeicherte Werte erscheinen mit.
        </p>
      )}

      <div className="mb-8 flex flex-wrap items-center gap-3 text-[11.5px]">
        <button
          type="button"
          onClick={loadCat}
          disabled={catLoading}
          className="inline-flex items-center gap-1.5 text-ink-600 hover:text-ink-900 disabled:opacity-50"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${catLoading ? "animate-spin" : ""}`}
          />
          Fahrzeugkatalog neu laden
        </button>
        {sp.error && (
          <span className="text-ink-400">
            Stripe-Preisliste:{" "}
            <span className="text-accent-amber">{sp.error}</span>
          </span>
        )}
      </div>

      {/* Stammdaten */}
      <Section title="Stammdaten">
        <Grid2>
          <Field label="plan_name">
            <TextInput
              value={model.plan_name}
              onChange={(v) => set({ plan_name: v })}
            />
          </Field>
          <Field
            label="expires_in_seconds"
            hint={`${(model.expires_in_seconds / 86400).toFixed(1)} Tage`}
          >
            <TextInput
              type="number"
              min={60}
              value={String(model.expires_in_seconds)}
              onChange={(v) =>
                set({ expires_in_seconds: Number(v) || 604800 })
              }
            />
          </Field>
        </Grid2>
      </Section>

      {/* Features */}
      <Section title="Features">
        <Grid2>
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
            <Toggle
              key={k}
              label={label}
              code={k}
              checked={model.features[k]}
              onChange={(v) =>
                setModel((m) =>
                  m
                    ? { ...m, features: { ...m.features, [k]: v } }
                    : m,
                )
              }
            />
          ))}
        </Grid2>
      </Section>

      {/* Asset-Regeln */}
      <Section
        title="Asset-Regeln"
        hint="Nur Werte aus dem D1-Katalog wählbar; bereits gespeicherte Werte werden ergänzt."
      >
        <div className="divide-y divide-hair border-y border-hair">
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
              <div
                key={key}
                className="grid grid-cols-1 gap-3 py-4 sm:grid-cols-[180px_1fr] sm:gap-6"
              >
                <div>
                  <p className="text-[12.5px] font-medium text-ink-800">
                    {label}
                  </p>
                  <p className="mt-1 font-mono text-[10.5px] text-ink-400">
                    {key}
                  </p>
                  <p className="mt-2 text-[11px] text-ink-500">
                    {current.length} / {all.length} aktiv
                  </p>
                </div>
                <ChipPicker
                  options={all}
                  selected={current}
                  emptyHint="(kein Katalog)"
                  onToggle={(opt, on) => {
                    const next = on
                      ? [...current, opt]
                      : current.filter((x) => x !== opt);
                    setModel((m) => (m ? patch(next)(m) : m));
                  }}
                />
              </div>
            );
          })}
        </div>
      </Section>

      {/* Inhaltsbeschränkungen */}
      <Section title="Inhaltsbeschränkungen">
        <div className="space-y-6">
          <Grid2>
            <Toggle
              label="Testmodus"
              code="content.is_test_mode"
              checked={model.content.is_test_mode}
              onChange={(v) =>
                setModel((m) =>
                  m
                    ? {
                        ...m,
                        content: { ...m.content, is_test_mode: v },
                      }
                    : m,
                )
              }
            />
            <Toggle
              label="Alle Fahrzeuge erlaubt"
              code='content.allowed_vehicle_ids: ["*"]'
              checked={model.content.allow_all_vehicles}
              onChange={(v) => {
                setModel((m) =>
                  m
                    ? {
                        ...m,
                        content: {
                          ...m.content,
                          allow_all_vehicles: v,
                          allowed_vehicle_ids: v
                            ? []
                            : m.content.allowed_vehicle_ids,
                        },
                      }
                    : m,
                );
              }}
            />
          </Grid2>

          {!model.content.allow_all_vehicles && (
            <Field
              label="Fahrzeug-IDs"
              hint="eine pro Zeile, oder per Komma/Semikolon"
            >
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
                className="h-24 w-full border-b border-hair bg-transparent py-2 font-mono text-[11.5px] text-ink-800 outline-none placeholder:text-ink-400 focus:border-ink-700"
                placeholder="id1"
              />
            </Field>
          )}

          <Grid2>
            <Field
              label="Jahre min"
              hint={`Katalog: ${jahreBounds.min}–${jahreBounds.max}`}
            >
              <TextInput
                type="number"
                value={String(model.content.year_range.min)}
                onChange={(v) => {
                  const n = Number(v);
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
              />
            </Field>
            <Field label="Jahre max">
              <TextInput
                type="number"
                value={String(model.content.year_range.max)}
                onChange={(v) => {
                  const n = Number(v);
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
              />
            </Field>
          </Grid2>

          <BrandPickerRow
            title="Erlaubte Marken"
            code="content.allowed_brands"
            options={mergeOpts(cat?.marken ?? [], model.content.allowed_brands)}
            selected={model.content.allowed_brands}
            onToggle={(opt, on) => {
              const a = on
                ? [...model.content.allowed_brands, opt]
                : model.content.allowed_brands.filter((x) => x !== opt);
              setModel((m) =>
                m
                  ? { ...m, content: { ...m.content, allowed_brands: a } }
                  : m,
              );
            }}
          />

          <BrandPickerRow
            title="Blockierte Marken"
            code="content.blocked_brands"
            options={mergeOpts(cat?.marken ?? [], model.content.blocked_brands)}
            selected={model.content.blocked_brands}
            onToggle={(opt, on) => {
              const a = on
                ? [...model.content.blocked_brands, opt]
                : model.content.blocked_brands.filter((x) => x !== opt);
              setModel((m) =>
                m
                  ? { ...m, content: { ...m.content, blocked_brands: a } }
                  : m,
              );
            }}
          />

          {/* Blockierte Modelle pro Marke */}
          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <p className="text-[12.5px] font-medium text-ink-800">
                Blockierte Modelle (pro Marke)
              </p>
              <p className="font-mono text-[10.5px] text-ink-400">
                content.blocked_models_rows
              </p>
            </div>
            <div className="divide-y divide-hair border-y border-hair">
              {model.content.blocked_models_rows.length === 0 && (
                <div className="py-4 text-[12px] text-ink-400">
                  Noch keine blockierten Modelle.
                </div>
              )}
              {model.content.blocked_models_rows.map((row, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-1 gap-3 py-4 sm:grid-cols-[180px_1fr_auto] sm:items-start sm:gap-6"
                >
                  <div>
                    <p className="mb-1 text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-400">
                      Marke
                    </p>
                    <select
                      value={row.brand}
                      onChange={async (e) => {
                        const brand = e.target.value;
                        setModel((m) => {
                          if (!m) return m;
                          const rows = [...m.content.blocked_models_rows];
                          rows[idx] = { ...rows[idx], brand, models: [] };
                          return {
                            ...m,
                            content: { ...m.content, blocked_models_rows: rows },
                          };
                        });
                        await loadModelleForBlockRow(idx, brand);
                      }}
                      className="w-full border-b border-hair bg-transparent py-1.5 text-[12.5px] text-ink-800 outline-none focus:border-ink-700"
                    >
                      <option value="">— wählen —</option>
                      {(cat?.marken ?? []).map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <p className="mb-1 text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-400">
                      Modelle{" "}
                      <span className="ml-1 font-mono normal-case tracking-normal text-ink-300">
                        ({row.models.length})
                      </span>
                    </p>
                    {row.brand ? (
                      <ChipPicker
                        options={mergeOpts(blockMarke[idx] ?? [], row.models)}
                        selected={row.models}
                        emptyHint="(keine Modelle für diese Marke)"
                        onToggle={(opt, on) => {
                          const next = on
                            ? [...row.models, opt]
                            : row.models.filter((x) => x !== opt);
                          setModel((m) => {
                            if (!m) return m;
                            const rows = [...m.content.blocked_models_rows];
                            rows[idx] = { ...rows[idx], models: next };
                            return {
                              ...m,
                              content: {
                                ...m.content,
                                blocked_models_rows: rows,
                              },
                            };
                          });
                        }}
                      />
                    ) : (
                      <p className="text-[11.5px] text-ink-400">
                        Marke wählen, um Modelle anzuzeigen.
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setModel((m) => {
                        if (!m) return m;
                        const rows = m.content.blocked_models_rows.filter(
                          (_, i) => i !== idx,
                        );
                        return {
                          ...m,
                          content: { ...m.content, blocked_models_rows: rows },
                        };
                      });
                      setBlockMarke((o) => {
                        const n = { ...o };
                        delete n[idx];
                        return n;
                      });
                    }}
                    className="self-start text-ink-400 transition-colors hover:text-accent-rose"
                    title="Zeile entfernen"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
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
              className="mt-3 inline-flex items-center gap-1.5 text-[12px] text-ink-600 hover:text-ink-900"
            >
              <Plus className="h-3.5 w-3.5" />
              Marke / Modelle hinzufügen
            </button>
          </div>
        </div>
      </Section>

      {/* Infrastruktur */}
      <Section title="Infrastruktur">
        <div className="space-y-5">
          <Field label="custom_cdn">
            <TextInput
              value={model.infrastructure.custom_cdn}
              onChange={(v) =>
                setModel((m) =>
                  m
                    ? {
                        ...m,
                        infrastructure: {
                          ...m.infrastructure,
                          custom_cdn: v,
                        },
                      }
                    : m,
                )
              }
            />
          </Field>
          <Grid2>
            <Field label="analytics_env_name">
              <TextInput
                value={model.infrastructure.analytics_env_name}
                onChange={(v) =>
                  setModel((m) =>
                    m
                      ? {
                          ...m,
                          infrastructure: {
                            ...m.infrastructure,
                            analytics_env_name: v,
                          },
                        }
                      : m,
                  )
                }
              />
            </Field>
            <Field label="cache_ttl_seconds">
              <TextInput
                type="number"
                min={0}
                value={String(model.infrastructure.cache_ttl_seconds)}
                onChange={(v) =>
                  setModel((m) =>
                    m
                      ? {
                          ...m,
                          infrastructure: {
                            ...m.infrastructure,
                            cache_ttl_seconds: Number(v) || 0,
                          },
                        }
                      : m,
                  )
                }
              />
            </Field>
          </Grid2>
        </div>
      </Section>

      {/* Stripe */}
      <Section title="Stripe">
        <div className="max-w-2xl space-y-5">
          {sp.data && sp.data.prices.length > 0 ? (
            <Field label="Stripe-Preis (Auswahl)">
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
                className="w-full border-b border-hair bg-transparent py-2 text-[12.5px] text-ink-800 outline-none focus:border-ink-700"
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
            </Field>
          ) : null}
          <Field label="stripe_price_id (manuell)" hint="Format: price_…">
            <TextInput
              value={model.stripe_price_id}
              onChange={(v) => set({ stripe_price_id: v.trim() })}
              placeholder="price_…"
              mono
            />
          </Field>
        </div>
      </Section>

      {/* Footer / Save */}
      <div className="sticky bottom-0 -mx-6 mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-hair bg-paper/95 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-paper/85">
        <div className="min-w-0 text-[11.5px] text-ink-500">
          {validationMsg ? (
            <span className="text-accent-amber">{validationMsg}</span>
          ) : saveErr ? (
            <span className="text-accent-rose">{saveErr}</span>
          ) : savedPing ? (
            <span className="text-accent-mint">Gespeichert.</span>
          ) : (
            <span className="text-ink-400">
              Änderungen werden nach „Speichern“ übernommen.
            </span>
          )}
        </div>
        <button
          type="button"
          disabled={saving || !!validationMsg}
          onClick={onSave}
          className="rounded-md bg-ink-900 px-4 py-2 text-[12.5px] font-medium text-white transition-colors hover:bg-ink-800 disabled:opacity-50"
        >
          {saving ? "Speichere …" : "Plan speichern"}
        </button>
      </div>
    </div>
  );
}

// ---------- Layout-Bausteine ----------

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-hair pt-8 first:border-t-0 first:pt-0 mb-10">
      <div className="mb-5">
        <h3 className="font-display text-[18px] tracking-tightish text-ink-900">
          {title}
        </h3>
        {hint && <p className="mt-1 text-[11.5px] text-ink-500">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Grid2({ children }: { children: ReactNode }) {
  return <div className="grid gap-5 sm:grid-cols-2">{children}</div>;
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-400">
          {label}
        </p>
        {hint && (
          <p className="text-[10.5px] text-ink-400">{hint}</p>
        )}
      </div>
      {children}
    </div>
  );
}

function TextInput({
  value,
  onChange,
  type = "text",
  placeholder,
  min,
  mono = false,
}: {
  value: string;
  onChange: (v: string) => void;
  type?: "text" | "number";
  placeholder?: string;
  min?: number;
  mono?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      min={min}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full border-b border-hair bg-transparent py-1.5 text-[12.5px] text-ink-800 outline-none placeholder:text-ink-400 focus:border-ink-700 ${
        mono ? "font-mono text-[12px]" : ""
      }`}
    />
  );
}

function Toggle({
  label,
  code,
  checked,
  onChange,
}: {
  label: string;
  code?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 border-b border-hair py-2 text-[12.5px] hover:text-ink-900">
      <div className="min-w-0">
        <span className="block text-ink-800">{label}</span>
        {code && (
          <span className="mt-0.5 block truncate font-mono text-[10.5px] text-ink-400">
            {code}
          </span>
        )}
      </div>
      <span
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
          checked ? "bg-ink-900" : "bg-ink-200"
        }`}
      >
        <span
          className={`inline-block h-3 w-3 rounded-full bg-white shadow-sm transition-transform ${
            checked ? "translate-x-3.5" : "translate-x-0.5"
          }`}
        />
      </span>
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

function ChipPicker({
  options,
  selected,
  emptyHint,
  onToggle,
}: {
  options: string[];
  selected: string[];
  emptyHint?: string;
  onToggle: (opt: string, on: boolean) => void;
}) {
  if (options.length === 0) {
    return <p className="text-[11.5px] text-ink-400">{emptyHint ?? "—"}</p>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const on = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onToggle(opt, !on)}
            className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 font-mono text-[11px] transition-colors ${
              on
                ? "border-ink-900 bg-ink-900 text-white"
                : "border-hair bg-white text-ink-600 hover:border-ink-300 hover:text-ink-900"
            }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function BrandPickerRow({
  title,
  code,
  options,
  selected,
  onToggle,
}: {
  title: string;
  code: string;
  options: string[];
  selected: string[];
  onToggle: (opt: string, on: boolean) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <p className="text-[12.5px] font-medium text-ink-800">
          {title}{" "}
          <span className="ml-1 font-mono text-[10.5px] text-ink-400">
            ({selected.length})
          </span>
        </p>
        <p className="font-mono text-[10.5px] text-ink-400">{code}</p>
      </div>
      <ChipPicker
        options={options}
        selected={selected}
        emptyHint="(kein Katalog)"
        onToggle={onToggle}
      />
    </div>
  );
}
