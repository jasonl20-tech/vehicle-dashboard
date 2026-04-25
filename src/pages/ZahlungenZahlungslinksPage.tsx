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

export default function ZahlungenZahlungslinksPage() {
  const pl = useJsonApi<PaymentLinksResponse>(BILLING_PAYMENT_LINKS);
  const kvs = useJsonApi<PlansListResponse>(BILLING_PLANS);

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
  }, [pl, kvs]);

  return (
    <>
      <PageHeader
        eyebrow="Zahlungen"
        title="Zahlungslinks"
        hideCalendarAndNotifications
        description={
          <>
            Aktive Stripe Payment Links;{" "}
            <span className="font-mono">metadata.price_id</span> = Plan-Key.
            Pro Preis/Plan-Key-Paar nur <strong>ein</strong> Link.
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
                  ? "Zuerst mindestens einen Plan unter Zahlungen → Pläne anlegen"
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
