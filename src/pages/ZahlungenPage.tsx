import { Copy, ExternalLink, Plus, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BILLING_PAYMENT_LINKS,
  BILLING_PLANS,
  BILLING_STRIPE_PRICES,
  createPaymentLink,
  type PaymentLinksResponse,
  type PlansListResponse,
  type StripePaymentLinkRow,
  type StripePriceRow,
  type StripePricesResponse,
  plansUrlOne,
  putPlan,
  useJsonApi,
} from "../lib/billingApi";
import PageHeader from "../components/ui/PageHeader";

type PriceColumnSort = "off" | "asc" | "desc";

function formatPaymentLinkPrice(
  row: Pick<StripePaymentLinkRow, "firstPrice">,
): string {
  const fp = row.firstPrice;
  if (!fp) return "–";
  if (fp.unitAmount != null && fp.currency) {
    try {
      return `${new Intl.NumberFormat("de-DE", {
        style: "currency",
        currency: fp.currency.toUpperCase(),
      }).format(fp.unitAmount / 100)} · ${fp.id}`;
    } catch {
      // ignore
    }
  }
  return fp.id;
}

function rowMatchesQuery(row: StripePaymentLinkRow, q: string): boolean {
  if (!q) return true;
  const s = q.toLowerCase();
  const hay = [
    row.id,
    row.metadata?.price_id,
    row.url,
    row.livemode ? "live" : "test",
    row.firstPrice?.id,
    String(row.firstPrice?.unitAmount ?? ""),
    row.firstPrice?.currency,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(s);
}

function pairAlreadyExists(
  links: StripePaymentLinkRow[] | undefined,
  planKey: string,
  stripePriceId: string,
): boolean {
  if (!links?.length) return false;
  for (const row of links) {
    if (row.metadata?.price_id !== planKey) continue;
    if (row.firstPrice?.id && row.firstPrice.id === stripePriceId) return true;
  }
  return false;
}

export default function ZahlungenPage() {
  const pl = useJsonApi<PaymentLinksResponse>(BILLING_PAYMENT_LINKS);
  const kvs = useJsonApi<PlansListResponse>(BILLING_PLANS);

  const [planKey, setPlanKey] = useState<string | null>(null);
  const { data: planOne, error: planErr, loading: planLoading, reload: planReload } =
    useJsonApi<{ key: string; value: unknown; raw: string }>(
      planKey ? plansUrlOne(planKey) : null,
    );

  const [newKey, setNewKey] = useState("");
  const [newKeyError, setNewKeyError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [priceColSort, setPriceColSort] = useState<PriceColumnSort>("off");

  const displayedLinks = useMemo(() => {
    const rows = [...(pl.data?.paymentLinks ?? [])];
    const q = search.trim();
    const filtered = q
      ? rows.filter((r) => rowMatchesQuery(r, q))
      : rows;
    if (priceColSort === "off") {
      filtered.sort((a, b) => b.created - a.created);
    } else {
      const mult = priceColSort === "asc" ? 1 : -1;
      filtered.sort((a, b) => {
        const au = a.firstPrice?.unitAmount;
        const bu = b.firstPrice?.unitAmount;
        if (au == null && bu == null) return b.created - a.created;
        if (au == null) return 1;
        if (bu == null) return -1;
        if (au !== bu) return (au - bu) * mult;
        return b.created - a.created;
      });
    }
    return filtered;
  }, [pl.data?.paymentLinks, search, priceColSort]);

  const cyclePriceSort = useCallback(() => {
    setPriceColSort((prev) =>
      prev === "off" ? "asc" : prev === "asc" ? "desc" : "off",
    );
  }, []);

  const reloadAll = useCallback(() => {
    pl.reload();
    kvs.reload();
    if (planKey) planReload();
  }, [pl, kvs, planKey, planReload]);

  return (
    <>
      <PageHeader
        title="Zahlungen"
        hideCalendarAndNotifications
        description={
          <>
            Stripe-Abrechnung: <strong>Zahlungslinks</strong> und{" "}
            <strong>Pläne</strong> (KV) auf einer Seite. Pro Preis/Plan-Key-Paar
            nur <strong>ein</strong> aktiver Payment Link.
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
                  ? "Zuerst mindestens einen Plan im KV anlegen (Abschnitt Pläne)"
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
                className={`h-3.5 w-3.5 ${pl.loading || kvs.loading || planLoading ? "animate-spin" : ""}`}
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

      <section
        id="zahlungslinks"
        className="mb-10 scroll-mt-8"
        aria-labelledby="heading-zahlungslinks"
      >
        <h2
          id="heading-zahlungslinks"
          className="mb-2 font-display text-[22px] tracking-tightish text-ink-900"
        >
          Zahlungslinks
        </h2>
        <p className="mb-4 text-[12.5px] text-ink-500">
          Aktive Payment Links;{" "}
          <span className="font-mono">metadata.price_id</span> = Plan-Key. Nur
          aktive Links werden angezeigt.
        </p>
        {pl.loading && !pl.data ? (
          <p className="text-[13px] text-ink-400">Lade …</p>
        ) : (
          <>
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Suchen (ID, Key, Preis, URL, Modus) …"
                className="w-full max-w-md rounded-md border border-hair bg-white px-3 py-2 text-[13px] text-ink-800 shadow-sm placeholder:text-ink-400"
                aria-label="Zahlungslinks durchsuchen"
              />
              {search.trim() && (
                <p className="text-[12.5px] text-ink-500">
                  {displayedLinks.length} Treffer
                </p>
              )}
            </div>
            <div className="overflow-x-auto rounded-md border border-hair">
              <table className="w-full min-w-[720px] text-left text-[12.5px]">
                <thead>
                  <tr className="border-b border-hair bg-ink-50/80">
                    <th className="px-3 py-2 font-medium text-ink-600">Modus</th>
                    <th className="px-3 py-2 font-medium text-ink-600">
                      Plan-Key <span className="font-mono">(metadata.price_id)</span>
                    </th>
                    <th className="px-3 py-2 font-medium text-ink-600">
                      <button
                        type="button"
                        onClick={cyclePriceSort}
                        className="inline-flex items-center gap-1 text-left text-ink-600 hover:text-ink-900"
                        title="Klick: nach Betrag sortieren (auf / ab) oder Standard (neueste zuerst)"
                      >
                        Preis
                        {priceColSort === "asc" && (
                          <span className="text-[10px] text-ink-400">▲</span>
                        )}
                        {priceColSort === "desc" && (
                          <span className="text-[10px] text-ink-400">▼</span>
                        )}
                      </button>
                    </th>
                    <th className="px-3 py-2 font-medium text-ink-600">Link</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedLinks.map((row) => {
                    const pid = row.metadata?.price_id ?? "–";
                    return (
                      <tr
                        key={row.id}
                        className="border-b border-hair/80 last:border-0"
                      >
                        <td className="px-3 py-2">
                          {row.livemode ? "Live" : "Test"}
                        </td>
                        <td
                          className="max-w-[200px] truncate px-3 py-2 font-mono text-[11.5px] text-ink-800"
                          title={pid}
                        >
                          {pid}
                        </td>
                        <td className="px-3 py-2 text-ink-800">
                          {formatPaymentLinkPrice(row)}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {row.url ? (
                              <>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    try {
                                      await navigator.clipboard.writeText(
                                        row.url!,
                                      );
                                    } catch {
                                      window.alert(
                                        "Kopieren nicht möglich (Berechtigung/HTTPS).",
                                      );
                                    }
                                  }}
                                  className="inline-flex items-center gap-1 rounded border border-hair bg-white px-2 py-1 text-ink-600 hover:border-ink-300"
                                >
                                  <Copy className="h-3 w-3" />
                                  Link kopieren
                                </button>
                                <a
                                  href={row.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 rounded border border-hair bg-white px-2 py-1 text-ink-600 hover:border-ink-300"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  Öffnen
                                </a>
                              </>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {(pl.data?.paymentLinks?.length ?? 0) === 0 && !pl.error && (
                <p className="p-4 text-[13px] text-ink-500">
                  Keine Payment Links in Stripe gefunden.
                </p>
              )}
              {(pl.data?.paymentLinks?.length ?? 0) > 0 &&
                displayedLinks.length === 0 &&
                !pl.error && (
                  <p className="p-4 text-[13px] text-ink-500">
                    Keine Treffer für diese Suche.
                  </p>
                )}
            </div>
          </>
        )}
      </section>

      <section
        id="plaene"
        className="border-t border-hair pt-10 scroll-mt-8"
        aria-labelledby="heading-plaene"
      >
        <h2
          id="heading-plaene"
          className="mb-2 font-display text-[22px] tracking-tightish text-ink-900"
        >
          Pläne
        </h2>
        <p className="mb-4 text-[12.5px] text-ink-500">
          KV-Namespace <span className="font-mono">plans</span>. Preis in
          Stripe, dann <span className="font-mono">stripe_price_id: &quot;price_…&quot;</span>{" "}
          im JSON. Bearbeiten möglich, kein Löschen.
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
                <p className="mt-2 text-[12.5px] text-accent-rose">
                  {newKeyError}
                </p>
              )}
            </div>
          </div>
        )}
      </section>

      {createOpen && (
        <CreatePaymentLinkDialog
          planKeys={kvs.data?.keys ?? []}
          existingPaymentLinks={pl.data?.paymentLinks ?? []}
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
  existingPaymentLinks,
  onClose,
  onCreated,
}: {
  planKeys: string[];
  existingPaymentLinks: StripePaymentLinkRow[];
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
  const clientDuplicate =
    canUsePricePicker &&
    !!selectedPriceId &&
    pairAlreadyExists(
      existingPaymentLinks,
      planKey,
      selectedPriceId,
    );
  const canSubmit =
    !!planKey &&
    planKeys.length > 0 &&
    !pricesLoading &&
    !clientDuplicate &&
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
        {clientDuplicate && (
          <p className="mt-2 text-[12px] text-amber-800">
            Es gibt bereits einen aktiven Payment Link mit genau dieser Kombination
            aus Stripe-Preis und Plan-Key. Bitte wähle eine andere Kombination.
          </p>
        )}
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
