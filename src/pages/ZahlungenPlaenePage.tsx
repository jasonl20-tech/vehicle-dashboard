import { Plus, RefreshCw } from "lucide-react";
import { useCallback, useState } from "react";
import PlanFormEditor from "../components/billing/PlanFormEditor";
import {
  BILLING_PLANS,
  plansUrlOne,
  putPlan,
  useJsonApi,
  type PlansListResponse,
} from "../lib/billingApi";
import { defaultPlanValue, planValueToKvJson } from "../lib/planFormTypes";
import PageHeader from "../components/ui/PageHeader";

export default function ZahlungenPlaenePage() {
  const kvs = useJsonApi<PlansListResponse>(BILLING_PLANS);

  const [planKey, setPlanKey] = useState<string | null>(null);
  const { data: planOne, error: planErr, loading: planLoading, reload: planReload } =
    useJsonApi<{ key: string; value: unknown; raw: string }>(
      planKey ? plansUrlOne(planKey) : null,
    );

  const [newKey, setNewKey] = useState("");
  const [newKeyError, setNewKeyError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reloadAll = useCallback(() => {
    kvs.reload();
    if (planKey) planReload();
  }, [kvs, planKey, planReload]);

  return (
    <>
      <PageHeader
        eyebrow="Zahlungen"
        title="Pläne"
        hideCalendarAndNotifications
        description={
          <>
            KV <span className="font-mono">plans</span>: Pläne per Formular
            bearbeiten (Werte aus D1-Fahrzeugkatalog &amp; Stripe). Kein
            Löschen.
          </>
        }
        rightSlot={
          <button
            type="button"
            onClick={reloadAll}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-hair bg-white text-ink-500 transition-colors hover:border-ink-300 hover:text-ink-800"
            title="Aktualisieren"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${kvs.loading || planLoading ? "animate-spin" : ""}`}
            />
          </button>
        }
      />

      {kvs.error && (
        <p className="mb-4 text-[13px] text-accent-rose">{kvs.error}</p>
      )}

      {kvs.loading && !kvs.data ? (
        <p className="text-[13px] text-ink-400">Lade …</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <p className="mb-2 text-[11.5px] font-medium uppercase tracking-[0.12em] text-ink-400">
              Keys
            </p>
            <ul className="max-h-[320px] space-y-0.5 overflow-y-auto rounded-md border border-hair p-1">
              {(kvs.data?.keys ?? []).map((k) => (
                <li key={k}>
                  <button
                    type="button"
                    onClick={() => {
                      setPlanKey(k);
                      setNewKeyError(null);
                    }}
                    className={`w-full rounded px-2.5 py-1.5 text-left font-mono text-[12px] ${
                      planKey === k
                        ? "bg-brand-500/10 text-ink-900"
                        : "text-ink-600 hover:bg-ink-50"
                    }`}
                  >
                    {k}
                  </button>
                </li>
              ))}
            </ul>
            <form
              className="mt-3 flex flex-wrap items-end gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                const k = newKey.trim();
                if (!k) return;
                setSaving(true);
                setNewKeyError(null);
                try {
                  await putPlan(k, planValueToKvJson(defaultPlanValue(k)));
                  setNewKey("");
                  kvs.reload();
                  setPlanKey(k);
                  planReload();
                } catch (er) {
                  setNewKeyError(
                    er instanceof Error ? er.message : String(er),
                  );
                } finally {
                  setSaving(false);
                }
              }}
            >
              <input
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="neuer_key"
                className="min-w-0 flex-1 rounded-md border border-hair bg-white px-2 py-1.5 font-mono text-[12px]"
              />
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1 rounded-md border border-hair bg-white px-2.5 py-1.5 text-[12px] text-ink-600 hover:border-ink-300"
              >
                <Plus className="h-3.5 w-3.5" />
                Neu
              </button>
            </form>
          </div>
          <div className="lg:col-span-8">
            <p className="mb-2 text-[11.5px] font-medium uppercase tracking-[0.12em] text-ink-400">
              Plan-Editor
            </p>
            {planKey ? (
              <PlanFormEditor
                key={planKey}
                planKey={planKey}
                planOne={planOne}
                planLoading={planLoading}
                planErr={planErr}
                onAfterSave={() => {
                  kvs.reload();
                  planReload();
                }}
              />
            ) : (
              <p className="text-[13px] text-ink-500">
                Wähle einen Key oder lege einen neuen an.
              </p>
            )}
            {newKeyError && (
              <p className="mt-2 text-[12.5px] text-accent-rose">{newKeyError}</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
