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
  const {
    data: planOne,
    error: planErr,
    loading: planLoading,
    reload: planReload,
  } = useJsonApi<{ key: string; value: unknown; raw: string }>(
    planKey ? plansUrlOne(planKey) : null,
  );

  const [newKey, setNewKey] = useState("");
  const [newKeyError, setNewKeyError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reloadAll = useCallback(() => {
    kvs.reload();
    if (planKey) planReload();
  }, [kvs, planKey, planReload]);

  const keys = kvs.data?.keys ?? [];

  return (
    <>
      <PageHeader
        eyebrow="Zahlungen"
        title="Pläne"
        hideCalendarAndNotifications
        description={
          <>
            KV{" "}
            <span className="font-mono text-[12.5px] text-ink-700">plans</span>:
            Pläne per Formular bearbeiten — Werte aus D1-Fahrzeugkatalog &amp;
            Stripe. Kein Löschen.
          </>
        }
        rightSlot={
          <button
            type="button"
            onClick={reloadAll}
            className="press inline-flex h-8 w-8 items-center justify-center rounded-md border border-hair bg-white text-ink-500 transition-colors hover:border-ink-300 hover:text-ink-800"
            title="Aktualisieren"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${kvs.loading || planLoading ? "animate-spin" : ""}`}
            />
          </button>
        }
      />

      {kvs.error && (
        <p className="mb-6 border-l-2 border-accent-rose px-3 py-2 text-[12.5px] text-accent-rose">
          {kvs.error}
        </p>
      )}

      {kvs.loading && !kvs.data ? (
        <p className="py-12 text-center text-[12.5px] text-ink-400">Lade …</p>
      ) : (
        <div className="grid gap-10 border-t border-hair pt-10 lg:grid-cols-12 lg:gap-0">
          {/* Sidebar: Keys */}
          <aside className="lg:col-span-3 lg:border-r lg:border-hair lg:pr-8">
            <div className="mb-3 flex items-baseline justify-between">
              <p className="text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-400">
                Plan-Keys
              </p>
              <span className="text-[11px] tabular-nums text-ink-400">
                {keys.length}
              </span>
            </div>
            {keys.length === 0 ? (
              <p className="border border-dashed border-hair px-3 py-6 text-center text-[12px] text-ink-500">
                Noch keine Pläne — unten neuen Key anlegen.
              </p>
            ) : (
              <ul className="stagger-children divide-y divide-hair border-y border-hair">
                {keys.map((k, idx) => {
                  const active = planKey === k;
                  return (
                    <li
                      key={k}
                      className="animate-fade-up"
                      style={{
                        animationDelay: idx < 16 ? `${idx * 18}ms` : "0ms",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setPlanKey(k);
                          setNewKeyError(null);
                        }}
                        data-active={active ? "true" : "false"}
                        className={`accent-on-hover press group flex w-full items-center justify-between px-2 py-2 text-left font-mono text-[12px] transition-colors ${
                          active
                            ? "bg-ink-50 text-ink-900"
                            : "text-ink-600 hover:bg-ink-50/60 hover:text-ink-900"
                        }`}
                      >
                        <span className="truncate">{k}</span>
                        {active && (
                          <span className="animate-scale-in ml-2 h-1.5 w-1.5 shrink-0 bg-ink-900" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            <form
              className="mt-5"
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
              <p className="mb-2 text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-400">
                Neuen Plan anlegen
              </p>
              <div className="flex items-center gap-2">
                <input
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  placeholder="neuer_key"
                  className="min-w-0 flex-1 border-b border-hair bg-transparent py-1.5 font-mono text-[12px] text-ink-800 outline-none placeholder:text-ink-400 focus:border-ink-700"
                />
                <button
                  type="submit"
                  disabled={saving || !newKey.trim()}
                  className="press inline-flex items-center gap-1 rounded-md border border-hair bg-white px-2.5 py-1.5 text-[12px] text-ink-700 transition hover:border-ink-300 hover:text-ink-900 disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Anlegen
                </button>
              </div>
              {newKeyError && (
                <p className="mt-2 border-l-2 border-accent-rose px-3 py-1.5 text-[12px] text-accent-rose">
                  {newKeyError}
                </p>
              )}
            </form>
          </aside>

          {/* Editor */}
          <div className="lg:col-span-9 lg:pl-10">
            {planKey ? (
              <>
                <div className="mb-6 flex items-baseline justify-between gap-3 border-b border-hair pb-4">
                  <div className="min-w-0">
                    <p className="text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-400">
                      Plan-Editor
                    </p>
                    <p
                      className="mt-1 truncate font-mono text-[16px] text-ink-900"
                      title={planKey}
                    >
                      {planKey}
                    </p>
                  </div>
                </div>
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
              </>
            ) : (
              <div className="flex h-full min-h-[240px] flex-col items-start justify-center border border-dashed border-hair px-6 py-10">
                <p className="text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-400">
                  Kein Plan ausgewählt
                </p>
                <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-ink-500">
                  Wähle links einen Plan-Key aus oder lege unten in der
                  Seitenleiste einen neuen Plan an, um den Editor zu öffnen.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
