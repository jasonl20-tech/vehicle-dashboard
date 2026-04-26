import { Plus, RefreshCw, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "../components/ui/PageHeader";
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
import { fetchVehicleCatalog, type VehicleImageryCatalog } from "../lib/vehicleImageryApi";

export default function SystemeBlockedVehiclesPage() {
  const api = useJsonApi<BlockedVehiclesGetResponse>(BLOCKED_VEHICLES_URL);
  const [form, setForm] = useState<BlockedVehiclesValue>({
    brands: [],
    models: [],
  });
  const [cat, setCat] = useState<VehicleImageryCatalog | null>(null);
  const [catErr, setCatErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const [pickBrand, setPickBrand] = useState("");
  const [customBrand, setCustomBrand] = useState("");

  const [pickMarke, setPickMarke] = useState("");
  const [modelle, setModelle] = useState<string[]>([]);
  const [pickModell, setPickModell] = useState("");

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
    setForm((f) => (f.brands.includes(t) ? f : { ...f, brands: [...f.brands, t] }));
  };

  const removeBrand = (b: string) => {
    setForm((f) => ({ ...f, brands: f.brands.filter((x) => x !== b) }));
  };

  const addModelPair = () => {
    if (!pickMarke.trim() || !pickModell.trim()) return;
    const key = encodeBlockedModel(pickMarke, pickModell);
    setForm((f) => (f.models.includes(key) ? f : { ...f, models: [...f.models, key] }));
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
      api.reload();
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const brandOptions = useMemo(() => {
    return marken.filter((m) => !form.brands.includes(m));
  }, [marken, form.brands]);

  const reload = useCallback(() => {
    api.reload();
    void loadCat();
  }, [api, loadCat]);

  return (
    <>
      <PageHeader
        eyebrow="Systeme"
        title="Blockierte Fahrzeuge"
        hideCalendarAndNotifications
        description={
          <>
            KV{" "}
            <span className="font-mono text-[12.5px] text-ink-700">
              blocked_vehicles
            </span>
            , Key{" "}
            <span className="font-mono text-[12.5px] text-ink-700">
              _config_blocked_vehicles
            </span>
            : gesperrte <strong>Marken</strong> (gesamte Marke) und
            <strong> Marke+Modell</strong>-Kombinationen. Auswahl aus dem
            D1-Fahrzeugkatalog oder Marke manuell.
          </>
        }
        rightSlot={
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={reload}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-hair bg-white text-ink-500 transition-colors hover:border-ink-300 hover:text-ink-800"
              title="Aktualisieren"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${api.loading || saving ? "animate-spin" : ""}`}
              />
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={saving || api.loading}
              className="rounded-md border border-hair bg-white px-3 py-1.5 text-[12.5px] font-medium text-ink-800 transition-colors hover:border-ink-300 disabled:opacity-50"
            >
              {saving ? "Speichern …" : "Speichern"}
            </button>
          </div>
        }
      />

      {api.error && (
        <p className="mb-6 border-l-2 border-accent-rose px-3 py-2 text-[12.5px] text-accent-rose">
          {api.error}
        </p>
      )}

      {catErr && (
        <p className="mb-6 border-l-2 border-accent-amber px-3 py-2 text-[12.5px] text-ink-800">
          Katalog: {catErr}
        </p>
      )}

      {saveErr && (
        <p className="mb-6 border-l-2 border-accent-rose px-3 py-2 text-[12.5px] text-accent-rose">
          {saveErr}
        </p>
      )}

      {api.loading && !api.data ? (
        <p className="py-12 text-center text-[12.5px] text-ink-400">Lade …</p>
      ) : (
        <div className="max-w-3xl space-y-10">
          <section>
            <h2 className="mb-1 text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-400">
              Gesperrte Marken
            </h2>
            <p className="mb-4 text-[12.5px] text-ink-500">
              Alle Fahrzeuge dieser Marke zählen als gesperrt.
            </p>
            {form.brands.length > 0 && (
              <ul className="mb-4 flex flex-wrap gap-1.5">
                {form.brands.map((b) => (
                  <li
                    key={b}
                    className="inline-flex max-w-full items-center gap-1 rounded-md border border-hair bg-ink-50 px-2.5 py-1 font-mono text-[12.5px] text-ink-800"
                  >
                    <span className="min-w-0 truncate">{b}</span>
                    <button
                      type="button"
                      onClick={() => removeBrand(b)}
                      className="shrink-0 text-ink-500 hover:text-accent-rose"
                      aria-label={`${b} entfernen`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
              <div className="min-w-0 sm:max-w-xs">
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
                Hinzufügen
              </button>
            </div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1 sm:max-w-md">
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

          <div className="border-t border-hair pt-10">
            <section>
              <h2 className="mb-1 text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-400">
                Gesperrte Modelle
              </h2>
              <p className="mb-4 text-[12.5px] text-ink-500">
                Pro Eintrag genau eine Marke + Modellkombination (aus dem
                Katalog, der zur gewählten Marke geladen wird). Ohne
                Markensperre nutzbar.
              </p>
              {form.models.length > 0 && (
                <ul className="mb-4 space-y-1.5">
                  {form.models.map((key) => (
                    <li
                      key={key}
                      className="flex max-w-2xl items-center justify-between gap-2 rounded-md border border-hair bg-paper/80 px-2.5 py-2"
                    >
                      <span className="min-w-0 font-mono text-[12.5px] text-ink-800">
                        {formatBlockedModelLabel(key)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeModel(key)}
                        className="shrink-0 text-ink-500 hover:text-accent-rose"
                        aria-label="Eintrag entfernen"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
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
      )}
    </>
  );
}
