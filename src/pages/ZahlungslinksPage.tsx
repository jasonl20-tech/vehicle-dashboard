import {
  Archive,
  ExternalLink,
  Pencil,
  Plus,
  RefreshCw,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BILLING_PAYMENT_LINKS,
  BILLING_PLANS,
  BILLING_STRIPE_PRICES,
  createPaymentLink,
  type PaymentLinksResponse,
  type PlansListResponse,
  type StripePriceRow,
  type StripePricesResponse,
  plansUrlOne,
  postPaymentLinkMetadata,
  putPlan,
  setPaymentLinkActive,
  useJsonApi,
} from "../lib/billingApi";
import PageHeader from "../components/ui/PageHeader";

export default function ZahlungslinksPage() {
  const pl = useJsonApi<PaymentLinksResponse>(BILLING_PAYMENT_LINKS);
  const kvs = useJsonApi<PlansListResponse>(BILLING_PLANS);

  const [editPl, setEditPl] = useState<{
    id: string;
    priceId: string;
  } | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const [planKey, setPlanKey] = useState<string | null>(null);
  const { data: planOne, error: planErr, loading: planLoading, reload: planReload } =
    useJsonApi<{ key: string; value: unknown; raw: string }>(
      planKey ? plansUrlOne(planKey) : null,
    );

  const [newKeyError, setNewKeyError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [newKey, setNewKey] = useState("");

  const keySet = useMemo(
    () => new Set(kvs.data?.keys ?? []),
    [kvs.data?.keys],
  );

  /** API liefert nur aktive Links; neueste zuerst. */
  const orderedLinks = useMemo(() => {
    const rows = pl.data?.paymentLinks ?? [];
    return [...rows].sort((a, b) => b.created - a.created);
  }, [pl.data?.paymentLinks]);

  const reloadAll = useCallback(() => {
    pl.reload();
    kvs.reload();
    if (planKey) planReload();
  }, [pl, kvs, planKey, planReload]);

  return (
    <>
      <PageHeader
        eyebrow="Zahlungen"
        title="Zahlungslinks"
        description={
          <>
            Beim Anlegen wählst du einen <strong>aktiven Stripe-Preis</strong>{" "}
            (per API aus deinem Konto geladen) und einen KV-Plan. Metadaten{" "}
            <span className="font-mono">price_id</span> = Plan-Key. Archivierte
            Links erscheinen nicht. KV-Pläne nur bearbeiten, nicht löschen.
            Alternativ kann der Preis nur im JSON als{" "}
            <span className="font-mono">stripe_price_id</span> stehen, wenn
            keine Liste verfügbar ist.
          </>
        }
        rightSlot={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              disabled={!kvs.data?.keys?.length}
              title={
                !kvs.data?.keys?.length
                  ? "Zuerst mindestens einen Plan im KV anlegen"
                  : undefined
              }
              className="inline-flex items-center gap-1.5 rounded-md border border-hair bg-ink-900 px-2.5 py-1.5 text-[11.5px] font-medium text-white transition-colors hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              Neuer Payment Link
            </button>
            <button
              type="button"
              onClick={reloadAll}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-hair bg-white text-ink-500 transition-colors hover:border-ink-300 hover:text-ink-800"
              title="Aktualisieren"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${pl.loading || kvs.loading ? "animate-spin" : ""}`}
              />
            </button>
          </div>
        }
      />

      {pl.error && (
        <p className="mb-4 text-[13px] text-accent-rose">{pl.error}</p>
      )}
      {kvs.error && (
        <p className="mb-4 text-[13px] text-accent-rose">{kvs.error}</p>
      )}

      <section className="mb-12 border-b border-hair pb-10">
        <h2 className="mb-3 font-display text-[18px] tracking-tightish text-ink-900">
          Stripe Payment Links
        </h2>
        <p className="mb-4 text-[12.5px] text-ink-500">
          Es werden nur <strong>aktive</strong> Payment Links aufgelistet.
        </p>
        {pl.loading && !pl.data ? (
          <p className="text-[13px] text-ink-400">Lade …</p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-hair">
            <table className="w-full min-w-[860px] text-left text-[12.5px]">
              <thead>
                <tr className="border-b border-hair bg-ink-50/80">
                  <th className="px-3 py-2 font-medium text-ink-600">Modus</th>
                  <th className="px-3 py-2 font-medium text-ink-600">
                    price_id (KV-Key)
                  </th>
                  <th className="px-3 py-2 font-medium text-ink-600">KV</th>
                  <th className="px-3 py-2 font-medium text-ink-600">URL</th>
                  <th className="px-3 py-2 font-medium text-ink-600">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {orderedLinks.map((row) => {
                  const pid = row.metadata?.price_id ?? "–";
                  const inKv = pid && pid !== "–" && keySet.has(pid);
                  return (
                    <tr
                      key={row.id}
                      className="border-b border-hair/80 last:border-0"
                    >
                      <td className="px-3 py-2">
                        {row.livemode ? "Live" : "Test"}
                      </td>
                      <td className="px-3 py-2 font-mono text-[11.5px] text-ink-800">
                        {pid}
                      </td>
                      <td className="px-3 py-2">
                        {inKv ? (
                          <span className="text-emerald-700">ok</span>
                        ) : pid === "–" || !pid ? (
                          "–"
                        ) : (
                          <span className="text-amber-700">fehlt</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {row.url ? (
                          <a
                            href={row.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-brand-600 hover:underline"
                          >
                            Link
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          "–"
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setEditPl({
                                id: row.id,
                                priceId: row.metadata?.price_id ?? "",
                              })
                            }
                            className="inline-flex items-center gap-1 rounded border border-hair bg-white px-2 py-1 text-ink-600 hover:border-ink-300"
                          >
                            <Pencil className="h-3 w-3" />
                            Metadaten
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (
                                !window.confirm(
                                  "Payment Link archivieren? Er erscheint danach nicht mehr in dieser Liste; in Stripe bleibt er inaktiv.",
                                )
                              ) {
                                return;
                              }
                              void (async () => {
                                try {
                                  await setPaymentLinkActive(row.id, false);
                                  pl.reload();
                                } catch (e) {
                                  window.alert(
                                    e instanceof Error ? e.message : String(e),
                                  );
                                }
                              })();
                            }}
                            className="inline-flex items-center gap-1 rounded border border-hair bg-white px-2 py-1 text-ink-600 hover:border-ink-300"
                          >
                            <Archive className="h-3 w-3" />
                            Archivieren
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {orderedLinks.length === 0 && !pl.error && (
              <p className="p-4 text-[13px] text-ink-500">
                Keine Payment Links in Stripe gefunden.
              </p>
            )}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display text-[18px] tracking-tightish text-ink-900">
          Pläne (KV: <span className="font-mono">plans</span>)
        </h2>
        <p className="mb-4 text-[12.5px] text-ink-500">
          Im JSON den Preis in Stripe anlegen, dann{" "}
          <span className="font-mono">stripe_price_id: &quot;price_…&quot;</span>{" "}
          setzen. Bearbeiten möglich, kein Löschen.
        </p>
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
                    await putPlan(k, {
                      plan_name: k,
                      stripe_price_id: "",
                      expires_in_seconds: 604800,
                      features: {},
                      asset_rules: {},
                      content_restrictions: {},
                      infrastructure: {},
                    });
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
                JSON
              </p>
              {planKey ? (
                <PlanEditor
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
      </section>

      {editPl && (
        <MetadataDialog
          initialPriceId={editPl.priceId}
          planKeys={kvs.data?.keys ?? []}
          onClose={() => setEditPl(null)}
          onSave={async (priceId) => {
            await postPaymentLinkMetadata(editPl.id, { price_id: priceId });
            setEditPl(null);
            pl.reload();
            kvs.reload();
          }}
        />
      )}

      {createOpen && (
        <CreatePaymentLinkDialog
          planKeys={kvs.data?.keys ?? []}
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            pl.reload();
            kvs.reload();
          }}
        />
      )}
    </>
  );
}

function PlanEditor({
  planKey,
  planOne,
  planLoading,
  planErr,
  onAfterSave,
}: {
  planKey: string;
  planOne: { key: string; value: unknown; raw: string } | null;
  planLoading: boolean;
  planErr: string | null;
  onAfterSave: () => void;
}) {
  const [text, setText] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (planOne?.key === planKey && planOne.raw && !dirty) {
      setText(planOne.raw);
    }
  }, [planKey, planOne, dirty]);

  if (planLoading && !planOne) {
    return <p className="text-[13px] text-ink-400">Lade Plan …</p>;
  }
  if (planErr) {
    return <p className="text-[13px] text-accent-rose">{planErr}</p>;
  }

  return (
    <div>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setDirty(true);
        }}
        spellCheck={false}
        className="h-[min(60vh,420px)] w-full rounded-md border border-hair bg-white p-3 font-mono text-[12px] leading-relaxed"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={async () => {
            setErr(null);
            setSaving(true);
            try {
              const parsed: unknown = JSON.parse(text) as unknown;
              await putPlan(planKey, parsed);
              setDirty(false);
              onAfterSave();
            } catch (e) {
              setErr(e instanceof Error ? e.message : String(e));
            } finally {
              setSaving(false);
            }
          }}
          className="rounded-md border border-hair bg-white px-3 py-1.5 text-[12.5px] text-ink-800 hover:border-ink-300"
        >
          {saving ? "…" : "Speichern"}
        </button>
      </div>
      {err && <p className="mt-2 text-[12.5px] text-accent-rose">{err}</p>}
    </div>
  );
}

function formatStripePriceLabel(p: StripePriceRow): string {
  const title = p.productName || p.nickname || "Preis";
  if (p.unitAmount != null && p.currency) {
    try {
      const amount = p.unitAmount / 100;
      const cur = p.currency.toUpperCase();
      const money = new Intl.NumberFormat("de-DE", {
        style: "currency",
        currency: cur,
      }).format(amount);
      const intv = p.recurring
        ? ` / ${p.recurring.interval_count > 1 ? p.recurring.interval_count + " " : ""}${p.recurring.interval}`
        : "";
      return `${title} – ${money}${intv} – ${p.id}`;
    } catch {
      // ignore
    }
  }
  return `${title} – ${p.id}`;
}

function CreatePaymentLinkDialog({
  planKeys,
  onClose,
  onCreated,
}: {
  planKeys: string[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [planKey, setPlanKey] = useState(planKeys[0] ?? "");
  const [prices, setPrices] = useState<StripePriceRow[] | null>(null);
  const [pricesLoadErr, setPricesLoadErr] = useState<string | null>(null);
  const [pricesLoading, setPricesLoading] = useState(true);
  const [selectedPriceId, setSelectedPriceId] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setPricesLoading(true);
    setPricesLoadErr(null);
    fetch(BILLING_STRIPE_PRICES, { credentials: "include" })
      .then(async (res) => {
        const j = (await res.json().catch(() => ({}))) as
          | StripePricesResponse
          | { error?: string };
        if (!res.ok) {
          throw new Error(
            (j as { error?: string }).error || `HTTP ${res.status}`,
          );
        }
        const list = (j as StripePricesResponse).prices ?? [];
        setPrices(list);
        if (list[0]) setSelectedPriceId(list[0].id);
      })
      .catch((e) => {
        setPricesLoadErr(
          e instanceof Error ? e.message : "Preise konnten nicht geladen werden.",
        );
        setPrices(null);
      })
      .finally(() => setPricesLoading(false));
  }, []);

  const canUsePricePicker = prices && prices.length > 0;
  const canSubmit =
    !!planKey &&
    planKeys.length > 0 &&
    !pricesLoading &&
    (canUsePricePicker ? !!selectedPriceId : true);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-night-900/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-pl-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-lg border border-hair bg-paper p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          id="create-pl-title"
          className="font-display text-[18px] text-ink-900"
        >
          Neuer Payment Link
        </h3>
        <p className="mt-1 text-[12.5px] text-ink-500">
          Produkt/Preis kommen aus deinem <strong>Stripe-Konto</strong> (API).
          <span className="font-mono"> metadata.price_id</span> = gewählter
          Plan-Key. Bei Auswahl eines Preises wird{" "}
          <span className="font-mono">stripe_price_id</span> im Plan-KV
          mitgespeichert.
        </p>
        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-[0.12em] text-ink-400">
              Plan (KV-Key) *
            </label>
            <select
              value={planKey}
              onChange={(e) => setPlanKey(e.target.value)}
              className="w-full rounded-md border border-hair bg-white px-2.5 py-2 font-mono text-[12.5px]"
            >
              {planKeys.length === 0 ? (
                <option value="">— zuerst Plan anlegen —</option>
              ) : (
                planKeys.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))
              )}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-[0.12em] text-ink-400">
              Produkt & Preis (Stripe) *
            </label>
            {pricesLoading && (
              <p className="text-[12.5px] text-ink-500">Lade Preise …</p>
            )}
            {pricesLoadErr && (
              <p className="text-[12.5px] text-amber-800">
                {pricesLoadErr} Du kannst stattdessen{" "}
                <span className="font-mono">stripe_price_id</span> im
                Plan-JSON setzen und ohne Liste speichern.
              </p>
            )}
            {canUsePricePicker && (
              <select
                value={selectedPriceId}
                onChange={(e) => setSelectedPriceId(e.target.value)}
                className="w-full max-w-full rounded-md border border-hair bg-white px-2.5 py-2 text-[12.5px]"
                size={Math.min(8, Math.max(3, prices.length))}
              >
                {prices.map((p) => (
                  <option key={p.id} value={p.id}>
                    {formatStripePriceLabel(p)}
                  </option>
                ))}
              </select>
            )}
            {!pricesLoading && prices && prices.length === 0 && !pricesLoadErr && (
              <p className="text-[12.5px] text-ink-500">
                Keine aktiven Preise in Stripe. Lege in Stripe Produkte/Preise
                an, oder nutze <span className="font-mono">stripe_price_id</span> im
                Plan-JSON.
              </p>
            )}
          </div>
        </div>
        {err && <p className="mt-2 text-[12px] text-accent-rose">{err}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-hair bg-white px-3 py-1.5 text-[12.5px]"
          >
            Abbrechen
          </button>
          <button
            type="button"
            disabled={busy || !canSubmit}
            onClick={async () => {
              setErr(null);
              if (!planKey) {
                setErr("Wähle einen Plan.");
                return;
              }
              setBusy(true);
              try {
                if (canUsePricePicker) {
                  await createPaymentLink(planKey, selectedPriceId);
                } else {
                  await createPaymentLink(planKey);
                }
                onCreated();
              } catch (e) {
                setErr(e instanceof Error ? e.message : String(e));
              } finally {
                setBusy(false);
              }
            }}
            className="rounded-md border border-hair bg-ink-900 px-3 py-1.5 text-[12.5px] text-white disabled:opacity-50"
          >
            {busy ? "…" : "In Stripe anlegen & verknüpfen"}
          </button>
        </div>
      </div>
    </div>
  );
}

function MetadataDialog({
  initialPriceId,
  planKeys,
  onClose,
  onSave,
}: {
  initialPriceId: string;
  planKeys: string[];
  onClose: () => void;
  onSave: (priceId: string) => Promise<void>;
}) {
  const [v, setV] = useState(initialPriceId);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-night-900/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg border border-hair bg-paper p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display text-[18px] text-ink-900">Metadaten</h3>
        <p className="mt-1 text-[12.5px] text-ink-500">
          Feld <span className="font-mono">price_id</span> = KV-Key
        </p>
        <div className="mt-3">
          <input
            list="plan-keys"
            value={v}
            onChange={(e) => setV(e.target.value)}
            className="w-full rounded-md border border-hair bg-white px-2.5 py-2 font-mono text-[12.5px]"
            placeholder="plan_test"
          />
          <datalist id="plan-keys">
            {planKeys.map((k) => (
              <option key={k} value={k} />
            ))}
          </datalist>
        </div>
        {err && <p className="mt-2 text-[12px] text-accent-rose">{err}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-hair bg-white px-3 py-1.5 text-[12.5px]"
          >
            Abbrechen
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setErr(null);
              setBusy(true);
              try {
                await onSave(v.trim());
              } catch (e) {
                setErr(e instanceof Error ? e.message : String(e));
              } finally {
                setBusy(false);
              }
            }}
            className="rounded-md border border-hair bg-ink-900 px-3 py-1.5 text-[12.5px] text-white"
          >
            {busy ? "…" : "Speichern"}
          </button>
        </div>
      </div>
    </div>
  );
}
