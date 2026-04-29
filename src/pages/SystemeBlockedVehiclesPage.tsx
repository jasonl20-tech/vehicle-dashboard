import { Loader2, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import SplitView from "../components/layout/SplitView";
import { useJsonApi } from "../lib/billingApi";
import {
  BLOCKED_VEHICLES_URL,
  encodeBlockedModel,
  formatBlockedModelLabel,
  parseBlockedVehiclesValue,
  putBlockedVehicles,
  type BlockedVehiclesGetResponse,
  type BlockedVehiclesValue,
} from "../lib/blockedVehiclesApi";
import {
  fetchVehicleCatalog,
  type VehicleImageryCatalog,
} from "../lib/vehicleImageryApi";

type BlockKind = "all" | "brands" | "models";

export default function SystemeBlockedVehiclesPage() {
  const api = useJsonApi<BlockedVehiclesGetResponse>(BLOCKED_VEHICLES_URL);
  const [form, setForm] = useState<BlockedVehiclesValue>({
    brands: [],
    models: [],
  });
  const [cat, setCat] = useState<VehicleImageryCatalog | null>(null);
  const [catErr, setCatErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedPing, setSavedPing] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const [pickBrand, setPickBrand] = useState("");
  const [customBrand, setCustomBrand] = useState("");

  const [pickMarke, setPickMarke] = useState("");
  const [modelle, setModelle] = useState<string[]>([]);
  const [pickModell, setPickModell] = useState("");

  const [filter, setFilter] = useState<BlockKind>("all");
  const [q, setQ] = useState("");

  const marken = cat?.marken ?? [];

  const loadCat = useCallback(() => {
    setCatErr(null);
    fetchVehicleCatalog()
      .then(setCat)
      .catch((e) =>
        setCatErr(
          e instanceof Error ? e.message : "Katalog nicht erreichbar",
        ),
      );
  }, []);

  useEffect(() => {
    void loadCat();
  }, [loadCat]);

  useEffect(() => {
    if (pickMarke) {
      fetchVehicleCatalog({ marke: pickMarke })
        .then((c) => {
          setModelle(c.modelle ?? []);
          setPickModell("");
        })
        .catch(() => {
          setModelle([]);
        });
    } else {
      setModelle([]);
      setPickModell("");
    }
  }, [pickMarke]);

  useEffect(() => {
    if (api.data?.value) {
      setForm(parseBlockedVehiclesValue(api.data.value));
    }
  }, [api.data?.raw]);

  const addBrand = (name: string) => {
    const t = name.trim();
    if (!t) return;
    setForm((f) =>
      f.brands.includes(t) ? f : { ...f, brands: [...f.brands, t] },
    );
  };

  const removeBrand = (b: string) => {
    setForm((f) => ({ ...f, brands: f.brands.filter((x) => x !== b) }));
  };

  const addModelPair = () => {
    if (!pickMarke.trim() || !pickModell.trim()) return;
    const key = encodeBlockedModel(pickMarke, pickModell);
    setForm((f) =>
      f.models.includes(key) ? f : { ...f, models: [...f.models, key] },
    );
    setPickModell("");
  };

  const removeModel = (key: string) => {
    setForm((f) => ({ ...f, models: f.models.filter((x) => x !== key) }));
  };

  const onSave = async () => {
    setSaveErr(null);
    setSaving(true);
    try {
      await putBlockedVehicles(form);
      setSavedPing(true);
      window.setTimeout(() => setSavedPing(false), 1600);
      api.reload();
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const reload = useCallback(() => {
    api.reload();
    void loadCat();
  }, [api, loadCat]);

  const brandOptions = useMemo(
    () => marken.filter((m) => !form.brands.includes(m)),
    [marken, form.brands],
  );

  const filteredBrands = useMemo(() => {
    if (filter === "models") return [] as string[];
    const t = q.trim().toLowerCase();
    return form.brands.filter((b) => !t || b.toLowerCase().includes(t));
  }, [form.brands, q, filter]);

  const filteredModels = useMemo(() => {
    if (filter === "brands") return [] as string[];
    const t = q.trim().toLowerCase();
    return form.models.filter(
      (m) => !t || formatBlockedModelLabel(m).toLowerCase().includes(t),
    );
  }, [form.models, q, filter]);

  const totalCount = form.brands.length + form.models.length;
  const visibleCount = filteredBrands.length + filteredModels.length;

  const aside = (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-hair p-3 pr-9">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-500">
            Gesperrt
          </p>
          <button
            type="button"
            onClick={reload}
            title="Aktualisieren"
            aria-label="Aktualisieren"
            className="inline-flex h-6 w-6 items-center justify-center rounded text-ink-400 hover:bg-ink-100 hover:text-ink-700"
          >
            <RefreshCw
              className={`h-3 w-3 ${api.loading ? "animate-spin" : ""}`}
            />
          </button>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-hair bg-paper/60 px-2.5 py-1.5">
          <Search className="h-3.5 w-3.5 shrink-0 text-ink-400" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Marke oder Modell…"
            className="min-w-0 flex-1 border-0 bg-transparent text-[12.5px] text-ink-900 placeholder:text-ink-400 focus:outline-none"
          />
        </div>
        <div className="mt-2 flex gap-1">
          {(
            [
              { id: "all" as BlockKind, label: "Alle", count: totalCount },
              {
                id: "brands" as BlockKind,
                label: "Marken",
                count: form.brands.length,
              },
              {
                id: "models" as BlockKind,
                label: "Modelle",
                count: form.models.length,
              },
            ]
          ).map((t) => {
            const active = t.id === filter;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setFilter(t.id)}
                className={`flex flex-1 items-center justify-center gap-1 rounded border px-1.5 py-1 text-[10.5px] transition-colors ${
                  active
                    ? "border-ink-400 bg-ink-50 text-ink-900"
                    : "border-hair bg-white text-ink-600 hover:border-ink-300"
                }`}
              >
                <span>{t.label}</span>
                <span className="tabular-nums opacity-60">{t.count}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] tabular-nums text-ink-500">
          <span>
            {visibleCount}
            {q.trim() ? ` / ${totalCount}` : ` Einträge`}
          </span>
          {api.loading && <Loader2 className="h-3 w-3 animate-spin" />}
        </div>
      </div>

      {api.error && (
        <p className="border-b border-accent-rose/50 bg-accent-rose/10 px-3 py-2 text-[11.5px] text-accent-rose">
          {api.error}
        </p>
      )}

      <ul className="min-h-0 flex-1 divide-y divide-hair overflow-y-auto">
        {!api.loading && totalCount === 0 && (
          <li className="px-3 py-6 text-center text-[12.5px] text-ink-500">
            Keine gesperrten Einträge. Rechts hinzufügen.
          </li>
        )}
        {filteredBrands.map((b) => (
          <li
            key={`b:${b}`}
            className="group flex items-center justify-between gap-2 px-3 py-2 hover:bg-ink-50/60"
          >
            <div className="min-w-0 flex-1">
              <span className="block text-[10px] font-medium uppercase tracking-[0.14em] text-accent-rose/80">
                Marke
              </span>
              <span
                className="block truncate font-mono text-[12.5px] text-ink-900"
                title={b}
              >
                {b}
              </span>
            </div>
            <button
              type="button"
              onClick={() => removeBrand(b)}
              className="shrink-0 rounded p-1 text-ink-400 opacity-0 transition hover:bg-accent-rose/10 hover:text-accent-rose group-hover:opacity-100"
              aria-label={`${b} entfernen`}
              title="Entfernen"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
        {filteredModels.map((key) => (
          <li
            key={`m:${key}`}
            className="group flex items-center justify-between gap-2 px-3 py-2 hover:bg-ink-50/60"
          >
            <div className="min-w-0 flex-1">
              <span className="block text-[10px] font-medium uppercase tracking-[0.14em] text-accent-amber">
                Modell
              </span>
              <span
                className="block truncate font-mono text-[12.5px] text-ink-900"
                title={formatBlockedModelLabel(key)}
              >
                {formatBlockedModelLabel(key)}
              </span>
            </div>
            <button
              type="button"
              onClick={() => removeModel(key)}
              className="shrink-0 rounded p-1 text-ink-400 opacity-0 transition hover:bg-accent-rose/10 hover:text-accent-rose group-hover:opacity-100"
              aria-label="Entfernen"
              title="Entfernen"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <SplitView
      storageKey="ui.systemeBlocked.aside"
      asideLabel="Gesperrt"
      asideWidthClass="md:w-[320px]"
      asideContent={aside}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-hair bg-white px-4 py-2.5">
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-ink-400">
              Systeme
            </p>
            <p className="mt-0.5 truncate text-[14px] font-medium text-ink-900">
              Blockierte Fahrzeuge
            </p>
          </div>
          <div className="flex items-center gap-2">
            {savedPing && (
              <span className="text-[11.5px] text-accent-mint">
                Gespeichert.
              </span>
            )}
            <button
              type="button"
              onClick={onSave}
              disabled={saving || api.loading}
              className="rounded-md bg-ink-900 px-3 py-1.5 text-[12.5px] font-medium text-white transition-colors hover:bg-ink-800 disabled:opacity-50"
            >
              {saving ? "Speichere…" : "Speichern"}
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8">
          {catErr && (
            <p className="mb-4 border-l-2 border-accent-amber px-3 py-2 text-[12.5px] text-ink-800">
              Katalog: {catErr}
            </p>
          )}
          {saveErr && (
            <p className="mb-4 border-l-2 border-accent-rose px-3 py-2 text-[12.5px] text-accent-rose">
              {saveErr}
            </p>
          )}

          <div className="mx-auto max-w-3xl space-y-10">
            <p className="text-[12.5px] leading-relaxed text-ink-500">
              KV{" "}
              <span className="font-mono text-ink-700">blocked_vehicles</span>,
              Key{" "}
              <span className="font-mono text-ink-700">
                _config_blocked_vehicles
              </span>
              : Marken werden komplett gesperrt; Marke + Modell sperrt nur die
              Kombination.
            </p>

            <section>
              <h2 className="mb-1 text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-400">
                Marke sperren
              </h2>
              <p className="mb-4 text-[12.5px] text-ink-500">
                Alle Fahrzeuge der gewählten Marke gelten als gesperrt.
              </p>
              <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                <div className="min-w-0">
                  <label className="mb-1 block text-[10px] font-medium uppercase tracking-[0.12em] text-ink-400">
                    Marke aus Katalog
                  </label>
                  <select
                    value={pickBrand}
                    onChange={(e) => setPickBrand(e.target.value)}
                    className="w-full rounded-md border border-hair bg-white px-2.5 py-2 text-[13px] text-ink-800 focus:border-ink-400 focus:outline-none"
                  >
                    <option value="">— wählen —</option>
                    {brandOptions.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (pickBrand) addBrand(pickBrand);
                    setPickBrand("");
                  }}
                  disabled={!pickBrand}
                  className="inline-flex h-9 items-center gap-1 rounded-md border border-hair bg-white px-3 text-[12.5px] text-ink-800 hover:border-ink-300 disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Marke sperren
                </button>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                <div className="min-w-0">
                  <label className="mb-1 block text-[10px] font-medium uppercase tracking-[0.12em] text-ink-400">
                    Oder Marke (Freitext)
                  </label>
                  <input
                    value={customBrand}
                    onChange={(e) => setCustomBrand(e.target.value)}
                    placeholder="z. B. exotische Schreibweise"
                    className="w-full rounded-md border border-hair bg-white px-2.5 py-2 text-[13px] text-ink-800 focus:border-ink-400 focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    addBrand(customBrand);
                    setCustomBrand("");
                  }}
                  disabled={!customBrand.trim()}
                  className="inline-flex h-9 items-center gap-1 rounded-md border border-hair bg-white px-3 text-[12.5px] text-ink-800 hover:border-ink-300 disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Hinzufügen
                </button>
              </div>
            </section>

            <section className="border-t border-hair pt-10">
              <h2 className="mb-1 text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-400">
                Marke + Modell sperren
              </h2>
              <p className="mb-4 text-[12.5px] text-ink-500">
                Pro Eintrag genau eine Marken-/Modell-Kombination — der
                Modell-Katalog wird aus der gewählten Marke geladen.
              </p>
              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <div>
                  <label className="mb-1 block text-[10px] font-medium uppercase tracking-[0.12em] text-ink-400">
                    Marke
                  </label>
                  <select
                    value={pickMarke}
                    onChange={(e) => setPickMarke(e.target.value)}
                    className="w-full rounded-md border border-hair bg-white px-2.5 py-2 text-[13px] text-ink-800 focus:border-ink-400 focus:outline-none"
                  >
                    <option value="">— wählen —</option>
                    {marken.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-medium uppercase tracking-[0.12em] text-ink-400">
                    Modell
                  </label>
                  <select
                    value={pickModell}
                    onChange={(e) => setPickModell(e.target.value)}
                    disabled={!pickMarke}
                    className="w-full rounded-md border border-hair bg-white px-2.5 py-2 text-[13px] text-ink-800 focus:border-ink-400 focus:outline-none disabled:opacity-50"
                  >
                    <option value="">
                      {pickMarke ? "— wählen —" : "Zuerst Marke"}
                    </option>
                    {modelle.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={addModelPair}
                  disabled={!pickMarke || !pickModell}
                  className="inline-flex h-9 items-center justify-center gap-1 rounded-md border border-hair bg-white px-3 text-[12.5px] text-ink-800 hover:border-ink-300 disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Sperre
                </button>
              </div>
            </section>
          </div>
        </div>
      </div>
    </SplitView>
  );
}
