import { Copy, ExternalLink, Plus, RefreshCw, Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
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

function fmtMoney(unitAmount: number | null | undefined, currency?: string | null): string {
  if (unitAmount == null || !currency) return "–";
  try {
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(unitAmount / 100);
  } catch {
    return `${(unitAmount / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
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
  const [modeFilter, setModeFilter] = useState<"all" | "live" | "test">("all");

  const allLinks = pl.data?.paymentLinks ?? [];

  const displayedLinks = useMemo(() => {
    const rows = [...allLinks];
    const q = search.trim();
    let filtered = q ? rows.filter((r) => rowMatchesQuery(r, q)) : rows;
    if (modeFilter !== "all") {
      filtered = filtered.filter((r) =>
        modeFilter === "live" ? r.livemode : !r.livemode,
      );
    }
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
  }, [allLinks, search, priceColSort, modeFilter]);

  const cyclePriceSort = useCallback(() => {
    setPriceColSort((prev) =>
      prev === "off" ? "asc" : prev === "asc" ? "desc" : "off",
    );
  }, []);

  const reloadAll = useCallback(() => {
    pl.reload();
    kvs.reload();
  }, [pl, kvs]);

  // KPIs
  const totalLinks = allLinks.length;
  const liveLinks = allLinks.filter((r) => r.livemode).length;
  const testLinks = totalLinks - liveLinks;
  const uniquePlans = new Set(
    allLinks.map((r) => r.metadata?.price_id).filter(Boolean) as string[],
  ).size;

  return (
    <>
      <PageHeader
        eyebrow="Zahlungen"
        title="Zahlungslinks"
        hideCalendarAndNotifications
        description={
          <>
            Aktive Stripe Payment Links;{" "}
            <span className="font-mono text-[12.5px] text-ink-700">
              metadata.price_id
            </span>{" "}
            = Plan-Key. Pro Preis/Plan-Key-Paar nur <strong>ein</strong> Link.
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
              className="btn-shine press inline-flex items-center gap-1.5 rounded-md bg-ink-900 px-3 py-1.5 text-[12.5px] font-medium text-white shadow-[0_4px_16px_-6px_rgba(13,13,15,0.3)] transition-colors hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
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

      <ErrorLine msg={pl.error || kvs.error} />

      <KpiGrid
        loading={pl.loading && !pl.data}
        total={totalLinks}
        live={liveLinks}
        test={testLinks}
        uniquePlans={uniquePlans}
        availablePlanKeys={kvs.data?.keys?.length ?? 0}
      />

      <Section
        title="Aktive Payment Links"
        meta={
          search.trim() || modeFilter !== "all"
            ? `${displayedLinks.length} von ${totalLinks} Treffer`
            : `${totalLinks} Links`
        }
      >
        <Toolbar
          search={search}
          onSearch={setSearch}
          modeFilter={modeFilter}
          onMode={setModeFilter}
        />
        {pl.loading && !pl.data ? (
          <p className="py-12 text-center text-[12.5px] text-ink-400">Lade …</p>
        ) : (
          <LinksTable
            rows={displayedLinks}
            allCount={totalLinks}
            searchActive={!!search.trim() || modeFilter !== "all"}
            priceSort={priceColSort}
            onTogglePriceSort={cyclePriceSort}
          />
        )}
      </Section>

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

// ---------- Section ----------

function Section({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: string;
  children: ReactNode;
}) {
  return (
    <section className="mb-12 border-t border-hair pt-10 first:border-t-0 first:pt-0">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-display text-[20px] tracking-tightish text-ink-900">
          {title}
        </h2>
        {meta && <p className="text-[12.5px] text-ink-500">{meta}</p>}
      </div>
      {children}
    </section>
  );
}

// ---------- ErrorLine ----------

function ErrorLine({ msg }: { msg: string | null | undefined }) {
  if (!msg) return null;
  return (
    <p className="mb-6 border-l-2 border-accent-rose px-3 py-2 text-[12.5px] text-accent-rose">
      {msg}
    </p>
  );
}

// ---------- KpiGrid ----------

function KpiGrid({
  loading,
  total,
  live,
  test,
  uniquePlans,
  availablePlanKeys,
}: {
  loading: boolean;
  total: number;
  live: number;
  test: number;
  uniquePlans: number;
  availablePlanKeys: number;
}) {
  return (
    <div className="mb-12 grid grid-cols-1 divide-y divide-hair border-y border-hair sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
      <KpiTile
        label="Links gesamt"
        value={loading ? "…" : String(total)}
        sub={loading ? "" : `${live} Live · ${test} Test`}
      />
      <KpiTile
        label="Live"
        value={loading ? "…" : String(live)}
        sub={loading ? "" : "produktiv geschaltet"}
        tone="ok"
      />
      <KpiTile
        label="Test"
        value={loading ? "…" : String(test)}
        sub={loading ? "" : "Stripe Testmodus"}
        tone={test > 0 ? "warn" : "neutral"}
      />
      <KpiTile
        label="Verknüpfte Plan-Keys"
        value={loading ? "…" : String(uniquePlans)}
        sub={
          loading
            ? ""
            : availablePlanKeys > 0
              ? `${availablePlanKeys} Pläne verfügbar`
              : "noch keine Pläne"
        }
      />
    </div>
  );
}

function KpiTile({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "neutral" | "ok" | "warn" | "err";
}) {
  const subColor =
    tone === "ok"
      ? "text-accent-mint"
      : tone === "warn"
        ? "text-accent-amber"
        : tone === "err"
          ? "text-accent-rose"
          : "text-ink-400";
  return (
    <div className="px-5 py-6 first:pl-0 sm:px-6 lg:px-8 lg:first:pl-0">
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-400">
        {label}
      </p>
      <p className="mt-3 font-display text-[36px] leading-none tracking-tighter2 text-ink-900">
        {value}
      </p>
      {sub && <p className={`mt-3 text-[12px] font-medium ${subColor}`}>{sub}</p>}
    </div>
  );
}

// ---------- Toolbar ----------

function Toolbar({
  search,
  onSearch,
  modeFilter,
  onMode,
}: {
  search: string;
  onSearch: (s: string) => void;
  modeFilter: "all" | "live" | "test";
  onMode: (m: "all" | "live" | "test") => void;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[220px] max-w-md">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="ID, Plan-Key, Preis-ID, URL …"
          className="w-full border-b border-hair bg-transparent py-1.5 pl-7 pr-2 text-[12.5px] text-ink-800 outline-none placeholder:text-ink-400 focus:border-ink-700"
          aria-label="Zahlungslinks durchsuchen"
        />
      </div>
      <div className="inline-flex overflow-hidden rounded-md border border-hair bg-white">
        {(["all", "live", "test"] as const).map((m, i) => (
          <button
            key={m}
            type="button"
            onClick={() => onMode(m)}
            className={`px-3 py-1.5 text-[12px] transition-colors ${
              modeFilter === m
                ? "bg-ink-900 text-white"
                : "text-ink-600 hover:bg-ink-50"
            } ${i > 0 ? "border-l border-hair" : ""}`}
          >
            {m === "all" ? "Alle" : m === "live" ? "Live" : "Test"}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------- LinksTable ----------

function LinksTable({
  rows,
  allCount,
  searchActive,
  priceSort,
  onTogglePriceSort,
}: {
  rows: StripePaymentLinkRow[];
  allCount: number;
  searchActive: boolean;
  priceSort: PriceColumnSort;
  onTogglePriceSort: () => void;
}) {
  if (allCount === 0) {
    return (
      <p className="border border-dashed border-hair px-4 py-12 text-center text-[12.5px] text-ink-500">
        Keine Payment Links in Stripe gefunden.
      </p>
    );
  }
  if (rows.length === 0 && searchActive) {
    return (
      <p className="border border-dashed border-hair px-4 py-12 text-center text-[12.5px] text-ink-500">
        Keine Treffer für diese Suche.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-[12.5px]">
        <thead>
          <tr className="border-b border-hair text-[10.5px] font-medium uppercase tracking-wide text-ink-400">
            <th className="py-2 pr-3 font-medium">Modus</th>
            <th className="py-2 pr-3 font-medium">
              Plan-Key{" "}
              <span className="font-mono normal-case tracking-normal text-ink-300">
                (metadata.price_id)
              </span>
            </th>
            <th className="py-2 pr-3 font-medium">
              <button
                type="button"
                onClick={onTogglePriceSort}
                className="inline-flex items-center gap-1 text-[10.5px] uppercase tracking-wide text-ink-400 hover:text-ink-700"
                title="Klick: nach Betrag sortieren (auf / ab) oder Standard (neueste zuerst)"
              >
                Preis
                {priceSort === "asc" && (
                  <span className="text-[9px] text-ink-400">▲</span>
                )}
                {priceSort === "desc" && (
                  <span className="text-[9px] text-ink-400">▼</span>
                )}
              </button>
            </th>
            <th className="py-2 pr-3 font-medium">Stripe Preis</th>
            <th className="py-2 font-medium">Aktion</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const pid = row.metadata?.price_id ?? "–";
            const fp = row.firstPrice;
            return (
              <tr key={row.id} className="border-b border-hair/70 align-top">
                <td className="py-2 pr-3 text-ink-700">
                  <ModeBadge live={row.livemode} />
                </td>
                <td
                  className="max-w-[220px] truncate py-2 pr-3 font-mono text-[11.5px] text-ink-800"
                  title={pid}
                >
                  {pid}
                </td>
                <td className="py-2 pr-3 tabular-nums text-ink-900">
                  {fp ? fmtMoney(fp.unitAmount, fp.currency) : "–"}
                </td>
                <td
                  className="max-w-[200px] truncate py-2 pr-3 font-mono text-[11px] text-ink-500"
                  title={fp?.id ?? ""}
                >
                  {fp?.id ?? "–"}
                </td>
                <td className="py-2">
                  {row.url ? (
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(row.url!);
                          } catch {
                            window.alert(
                              "Kopieren nicht möglich (Berechtigung/HTTPS).",
                            );
                          }
                        }}
                        className="inline-flex items-center gap-1 text-ink-600 hover:text-ink-900"
                      >
                        <Copy className="h-3 w-3" />
                        Kopieren
                      </button>
                      <a
                        href={row.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-ink-600 hover:text-ink-900"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Öffnen
                      </a>
                    </div>
                  ) : (
                    <span className="text-ink-300">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ModeBadge({ live }: { live: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11.5px] tabular-nums ${
        live ? "text-accent-mint" : "text-accent-amber"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 ${
          live ? "bg-accent-mint" : "bg-accent-amber"
        }`}
      />
      {live ? "Live" : "Test"}
    </span>
  );
}

// ---------- Create Payment Link Dialog ----------

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
    pairAlreadyExists(existingPaymentLinks, planKey, selectedPriceId);
  const canSubmit =
    !!planKey &&
    planKeys.length > 0 &&
    !pricesLoading &&
    !clientDuplicate &&
    (canUsePricePicker ? !!selectedPriceId : true);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-night-900/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-pl-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl border border-hair bg-paper"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-hair px-5 py-3">
          <div>
            <p className="text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-400">
              Stripe
            </p>
            <h3
              id="create-pl-title"
              className="font-display text-[20px] leading-tight tracking-tightish text-ink-900"
            >
              Neuer Payment Link
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-7 w-7 items-center justify-center text-ink-400 hover:text-ink-800"
            aria-label="Schließen"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 px-5 py-5">
          <p className="text-[12.5px] leading-relaxed text-ink-500">
            Produkt/Preis aus deinem Stripe-Konto wählen. Im Link wird{" "}
            <span className="font-mono text-[12px] text-ink-700">
              metadata.price_id
            </span>{" "}
            auf den Plan-Key gesetzt; im Plan-KV wird{" "}
            <span className="font-mono text-[12px] text-ink-700">
              stripe_price_id
            </span>{" "}
            zur Verknüpfung mitgespeichert.
          </p>

          <div>
            <FieldLabel>Plan (KV-Key) *</FieldLabel>
            <select
              value={planKey}
              onChange={(e) => setPlanKey(e.target.value)}
              className="w-full border-b border-hair bg-transparent py-1.5 font-mono text-[12.5px] text-ink-800 outline-none focus:border-ink-700"
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
            <FieldLabel>Produkt & Preis (Stripe) *</FieldLabel>
            {pricesLoading && (
              <p className="text-[12px] text-ink-500">Lade Preise …</p>
            )}
            {pricesLoadErr && (
              <p className="text-[12px] text-accent-amber">
                {pricesLoadErr} — du kannst stattdessen{" "}
                <span className="font-mono">stripe_price_id</span> im
                Plan-Editor setzen und ohne Liste speichern.
              </p>
            )}
            {canUsePricePicker && (
              <select
                value={selectedPriceId}
                onChange={(e) => setSelectedPriceId(e.target.value)}
                className="w-full border-b border-hair bg-transparent py-1.5 text-[12.5px] text-ink-800 outline-none focus:border-ink-700"
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
              <p className="text-[12px] text-ink-500">
                Keine aktiven Preise in Stripe. Lege Produkte/Preise an oder
                setze <span className="font-mono">stripe_price_id</span> manuell
                im Plan-Editor.
              </p>
            )}
          </div>

          {clientDuplicate && (
            <p className="border-l-2 border-accent-amber px-3 py-2 text-[12px] text-accent-amber">
              Es gibt bereits einen aktiven Payment Link mit dieser Kombination
              aus Stripe-Preis und Plan-Key. Bitte andere Kombination wählen.
            </p>
          )}
          {err && (
            <p className="border-l-2 border-accent-rose px-3 py-2 text-[12px] text-accent-rose">
              {err}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-hair px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-hair bg-white px-3 py-1.5 text-[12.5px] text-ink-600 hover:border-ink-300 hover:text-ink-900"
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
            className="btn-shine press rounded-md bg-ink-900 px-3 py-1.5 text-[12.5px] font-medium text-white shadow-[0_4px_16px_-6px_rgba(13,13,15,0.3)] transition-colors hover:bg-ink-800 disabled:opacity-50 disabled:shadow-none"
          >
            {busy ? "…" : "In Stripe anlegen & verknüpfen"}
          </button>
        </div>
      </div>
    </div>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="mb-1 block text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-400">
      {children}
    </label>
  );
}
