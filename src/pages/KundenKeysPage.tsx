import { ChevronDown, Mail, RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../components/ui/PageHeader";
import { useJsonApi } from "../lib/billingApi";
import {
  customerKeysListUrl,
  customerKeyDetailPath,
  isExpiredIso,
  shortKey,
  type CustomerKeySummary,
  type CustomerKeysListResponse,
} from "../lib/customerKeysApi";

const GROUPS_PER_PAGE = 20;

type ListVariant = "customer" | "test";
type ExpiryFilter = "all" | "expired" | "valid" | "soon7";

export default function KundenKeysPage() {
  return <KundenKeysListView variant="customer" />;
}

export function KundenTestKeysPage() {
  return <KundenKeysListView variant="test" />;
}

function KundenKeysListView({ variant }: { variant: ListVariant }) {
  const list = useJsonApi<CustomerKeysListResponse>(
    customerKeysListUrl(variant === "customer" ? "customer" : "test"),
  );

  const [q, setQ] = useState("");
  const [planId, setPlanId] = useState("");
  const [expiry, setExpiry] = useState<ExpiryFilter>("all");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [page, setPage] = useState(0);
  /** `true` = Gruppe zugeklappt (nur Email-Zeile). Standard: zu, übersichtlicher. */
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const reload = useCallback(() => list.reload(), [list]);
  const summaries = list.data?.keys ?? [];

  useEffect(() => {
    setPage(0);
  }, [q, planId, expiry, createdFrom, createdTo]);

  const planOptions = useMemo(() => {
    const s = new Set<string>();
    for (const r of summaries) {
      if (r.plan_id) s.add(r.plan_id);
    }
    return [...s].sort((a, b) => a.localeCompare(b, "de"));
  }, [summaries]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const now = Date.now();
    const soonEnd = now + 7 * 24 * 60 * 60 * 1000;
    const cFrom = createdFrom ? dayStart(createdFrom) : null;
    const cTo = createdTo ? dayEnd(createdTo) : null;

    return summaries.filter((s) => {
      if (planId && s.plan_id !== planId) return false;

      if (expiry === "expired") {
        if (!s.expires_at || !isExpiredIso(s.expires_at)) return false;
      } else if (expiry === "valid") {
        if (!s.expires_at) return true; // kein Enddatum = gilt als unbegrenzt
        if (isExpiredIso(s.expires_at)) return false;
      } else if (expiry === "soon7") {
        if (!s.expires_at) return false;
        const t = Date.parse(s.expires_at);
        if (isNaN(t) || t < now || t > soonEnd) return false;
      }

      if (cFrom != null || cTo != null) {
        const c = s.created_at ? Date.parse(s.created_at) : NaN;
        if (isNaN(c)) return false;
        if (cFrom != null && c < cFrom) return false;
        if (cTo != null && c > cTo) return false;
      }

      if (!term) return true;
      const hay = [
        s.email,
        s.key,
        s.plan_id,
        s.plan_name,
        s.stripe_customer_id,
        s.stripe_subscription_id,
        s.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(term);
    });
  }, [summaries, q, planId, expiry, createdFrom, createdTo]);

  const groups = useMemo(() => groupByEmail(filtered), [filtered]);
  const totalPages = Math.max(1, Math.ceil(groups.length / GROUPS_PER_PAGE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);

  useEffect(() => {
    setPage((p) => Math.min(p, Math.max(0, totalPages - 1)));
  }, [totalPages]);
  const pageGroups = useMemo(() => {
    const p = Math.max(0, safePage);
    const start = p * GROUPS_PER_PAGE;
    return groups.slice(start, start + GROUPS_PER_PAGE);
  }, [groups, safePage]);

  const stats = useMemo(() => computeStats(summaries), [summaries]);
  const linkFrom: "customer" | "test" = variant === "test" ? "test" : "customer";
  const isTestArea = variant === "test";

  return (
    <>
      <PageHeader
        eyebrow="Kundenmanagement"
        title={isTestArea ? "Kundentest keys" : "Kunden keys"}
        hideCalendarAndNotifications
        description={
          isTestArea ? (
            <>
              Keys, deren{" "}
              <span className="font-mono text-[12px] text-ink-600">plan_id</span>{" "}
              oder <span className="font-mono text-[12px] text-ink-600">plan_name</span>{" "}
              <span className="font-medium text-ink-800">test</span> enthält. Klick
              auf einen Key öffnet die Bearbeiten-Seite.
            </>
          ) : (
            <>
              Produktions-Keys (ohne Pläne mit <span className="font-medium">test</span> im
              Namen). Kundentest-Keys siehe{" "}
              <span className="font-mono text-[12px] text-ink-600">Kundentest keys</span>.
            </>
          )
        }
        rightSlot={
          <button
            type="button"
            onClick={reload}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-hair bg-white text-ink-500 transition-colors hover:border-ink-300 hover:text-ink-800"
            title="Aktualisieren"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${list.loading ? "animate-spin" : ""}`}
            />
          </button>
        }
      />

      {list.error && (
        <p className="mb-6 border-l-2 border-accent-rose px-3 py-2 text-[12.5px] text-accent-rose">
          {list.error}
        </p>
      )}

      <KpiStrip
        stats={stats}
        loading={list.loading && !list.data}
        variant={variant}
      />

      {list.loading && !list.data ? (
        <p className="py-12 text-center text-[12.5px] text-ink-400">Lade …</p>
      ) : (
        <div className="border-t border-hair pt-8">
          <FilterBar
            q={q}
            onQ={setQ}
            planId={planId}
            onPlanId={setPlanId}
            planOptions={planOptions}
            expiry={expiry}
            onExpiry={setExpiry}
            createdFrom={createdFrom}
            onCreatedFrom={setCreatedFrom}
            createdTo={createdTo}
            onCreatedTo={setCreatedTo}
            onResetFilters={() => {
              setQ("");
              setPlanId("");
              setExpiry("all");
              setCreatedFrom("");
              setCreatedTo("");
              setPage(0);
            }}
            resultCount={filtered.length}
            groupCount={groups.length}
            totalCount={summaries.length}
          />

          {groups.length === 0 ? (
            <p className="mt-6 border border-dashed border-hair px-3 py-8 text-center text-[13px] text-ink-500">
              {summaries.length === 0
                ? isTestArea
                  ? "Keine Kundentest-Keys (kein plan mit „test“ im Namen)."
                  : "Keine Kunden-Keys (ohne Test-Pläne) im KV."
                : "Keine Treffer — Filter lockern oder Suche ändern."}
            </p>
          ) : (
            <>
              <ul className="mt-6 divide-y divide-hair border-y border-hair">
                {pageGroups.map((g) => (
                  <EmailGroupBlock
                    key={g.id}
                    group={g}
                    linkFrom={linkFrom}
                    showTestBadge={isTestArea}
                    collapsed={collapsed[g.id] ?? true}
                    onToggle={() =>
                      setCollapsed((m) => {
                        const cur = m[g.id] ?? true;
                        return { ...m, [g.id]: !cur };
                      })
                    }
                  />
                ))}
              </ul>

              {totalPages > 1 && (
                <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-[12.5px] text-ink-600">
                  <p className="text-[11.5px] text-ink-400">
                    Gruppen {safePage * GROUPS_PER_PAGE + 1}–
                    {Math.min((safePage + 1) * GROUPS_PER_PAGE, groups.length)} von{" "}
                    {groups.length} (Keys: {filtered.length} / {summaries.length})
                  </p>
                  <div className="inline-flex items-center gap-1 border border-hair">
                    <button
                      type="button"
                      disabled={safePage <= 0}
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      className="px-3 py-1.5 text-[12px] hover:bg-ink-50 disabled:opacity-40"
                    >
                      Zurück
                    </button>
                    <span className="border-l border-hair px-3 py-1.5 font-mono text-[11px]">
                      {safePage + 1} / {totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={safePage >= totalPages - 1}
                      onClick={() =>
                        setPage((p) => Math.min(totalPages - 1, p + 1))
                      }
                      className="px-3 py-1.5 text-[12px] hover:bg-ink-50 disabled:opacity-40"
                    >
                      Weiter
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}

// ---------- filter helpers ----------

function dayStart(ymd: string): number {
  return new Date(ymd + "T00:00:00").getTime();
}
function dayEnd(ymd: string): number {
  return new Date(ymd + "T23:59:59.999").getTime();
}

type CustomerGroup = {
  id: string;
  email: string | null;
  rows: CustomerKeySummary[];
};

function groupByEmail(rows: CustomerKeySummary[]): CustomerGroup[] {
  const byEmail = new Map<string, CustomerGroup>();
  for (const r of rows) {
    const id = r.email ? `e:${r.email.toLowerCase()}` : "_:noemail";
    let g = byEmail.get(id);
    if (!g) {
      g = { id, email: r.email, rows: [] };
      byEmail.set(id, g);
    }
    g.rows.push(r);
  }
  const out = Array.from(byEmail.values());
  out.sort((a, b) => {
    if (a.email === null && b.email !== null) return 1;
    if (b.email === null && a.email !== null) return -1;
    const ea = (a.email ?? "").toLowerCase();
    const eb = (b.email ?? "").toLowerCase();
    return ea < eb ? -1 : ea > eb ? 1 : 0;
  });
  for (const g of out) {
    g.rows.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  }
  return out;
}

type Stats = {
  total: number;
  withEmail: number;
  uniqueEmails: number;
  uniquePlans: number;
  expired: number;
};

function computeStats(rows: CustomerKeySummary[]): Stats {
  const emails = new Set<string>();
  const plans = new Set<string>();
  let withEmail = 0;
  let expired = 0;
  for (const r of rows) {
    if (r.email) {
      emails.add(r.email.toLowerCase());
      withEmail += 1;
    }
    if (r.plan_id) plans.add(r.plan_id);
    if (r.expires_at && isExpiredIso(r.expires_at)) expired += 1;
  }
  return {
    total: rows.length,
    withEmail,
    uniqueEmails: emails.size,
    uniquePlans: plans.size,
    expired,
  };
}

function KpiStrip({
  stats,
  loading,
  variant,
}: {
  stats: Stats;
  loading: boolean;
  variant: ListVariant;
}) {
  return (
    <div className="mb-10 grid grid-cols-2 divide-y divide-hair border-y border-hair sm:grid-cols-3 sm:divide-x sm:divide-y-0 lg:grid-cols-5">
      <KpiTile
        label={variant === "test" ? "Kundentest-Keys" : "Kunden-Keys"}
        value={ld(loading, stats.total)}
        sub={
          variant === "test"
            ? "„test“ in plan_id / plan_name"
            : "ohne Test-Pläne"
        }
      />
      <KpiTile
        label="Abgelaufen"
        value={ld(loading, stats.expired)}
        sub="Ablaufdatum"
        tone="warn"
      />
      <KpiTile
        label="Mit Email"
        value={ld(loading, stats.withEmail)}
        sub={
          !loading && stats.total
            ? `${pct(stats.withEmail, stats.total)} %`
            : "—"
        }
        tone="ok"
      />
      <KpiTile
        label="E-Mails"
        value={ld(loading, stats.uniqueEmails)}
        sub="unique"
      />
      <KpiTile
        label="Pläne"
        value={ld(loading, stats.uniquePlans)}
        sub="unique plan_id"
      />
    </div>
  );
}

function ld(loading: boolean, n: number) {
  return loading ? "…" : String(n);
}
function pct(a: number, b: number) {
  return b ? Math.round((a / b) * 100) : 0;
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
  tone?: "neutral" | "ok" | "warn";
}) {
  const subColor =
    tone === "ok"
      ? "text-accent-mint"
      : tone === "warn"
        ? "text-accent-amber"
        : "text-ink-400";
  return (
    <div className="px-4 py-5 sm:px-5 lg:px-6">
      <p className="text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-400">
        {label}
      </p>
      <p className="mt-2 font-display text-[32px] leading-none tracking-tighter2 text-ink-900">
        {value}
      </p>
      {sub && <p className={`mt-2 text-[11.5px] font-medium ${subColor}`}>{sub}</p>}
    </div>
  );
}

// ---------- Filterbar ----------

function FilterBar({
  q,
  onQ,
  planId,
  onPlanId,
  planOptions,
  expiry,
  onExpiry,
  createdFrom,
  onCreatedFrom,
  createdTo,
  onCreatedTo,
  onResetFilters,
  resultCount,
  groupCount,
  totalCount,
}: {
  q: string;
  onQ: (s: string) => void;
  planId: string;
  onPlanId: (s: string) => void;
  planOptions: string[];
  expiry: ExpiryFilter;
  onExpiry: (e: ExpiryFilter) => void;
  createdFrom: string;
  onCreatedFrom: (s: string) => void;
  createdTo: string;
  onCreatedTo: (s: string) => void;
  onResetFilters: () => void;
  resultCount: number;
  groupCount: number;
  totalCount: number;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="relative sm:col-span-2">
          <Search className="pointer-events-none absolute left-0 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
          <input
            type="search"
            placeholder="Suche: Email, Key, Plan, Status, Stripe-IDs…"
            value={q}
            onChange={(e) => onQ(e.target.value)}
            className="w-full border-b border-hair bg-transparent py-1.5 pl-6 pr-2 text-[12.5px] text-ink-800 outline-none placeholder:text-ink-400 focus:border-ink-700"
          />
        </div>
        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink-400">
            plan_id
          </span>
          <select
            value={planId}
            onChange={(e) => onPlanId(e.target.value)}
            className="border-b border-hair bg-transparent py-1.5 text-[12.5px] text-ink-800 outline-none focus:border-ink-700"
          >
            <option value="">Alle Pläne</option>
            {planOptions.map((p) => (
              <option key={p} value={p}>
                {p}
                {p.toLowerCase().includes("test") ? " (Test-Plan)" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink-400">
            Ablauf
          </span>
          <select
            value={expiry}
            onChange={(e) => onExpiry(e.target.value as ExpiryFilter)}
            className="border-b border-hair bg-transparent py-1.5 text-[12.5px] text-ink-800 outline-none focus:border-ink-700"
          >
            <option value="all">Alle</option>
            <option value="expired">Abgelaufen</option>
            <option value="valid">Noch gültig (oder ohne Datum)</option>
            <option value="soon7">Läuft in 7 Tagen ab</option>
          </select>
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink-400">
            Erstellt ab
          </span>
          <input
            type="date"
            value={createdFrom}
            onChange={(e) => onCreatedFrom(e.target.value)}
            className="border-b border-hair bg-transparent py-1.5 text-[12.5px] text-ink-800 outline-none focus:border-ink-700"
          />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink-400">
            Erstellt bis
          </span>
          <input
            type="date"
            value={createdTo}
            onChange={(e) => onCreatedTo(e.target.value)}
            className="border-b border-hair bg-transparent py-1.5 text-[12.5px] text-ink-800 outline-none focus:border-ink-700"
          />
        </label>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-[12px] text-ink-500">
        <p>
          <span className="font-medium text-ink-800">{resultCount}</span> Keys
          in{" "}
          <span className="font-medium text-ink-800">{groupCount}</span>{" "}
          E-Mail-Gruppen · Gesamt im KV:{" "}
          <span className="text-ink-400">{totalCount}</span>
        </p>
        <button
          type="button"
          onClick={onResetFilters}
          className="text-[12px] text-ink-600 underline decoration-hair underline-offset-2 hover:text-ink-900"
        >
          Filter zurücksetzen
        </button>
      </div>
    </div>
  );
}

function fmtExpires(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" });
}

/** E-Mail-Kopfzeile: rot = alle Keys mit Datum abgelaufen, gelb = gemischt, sonst neutral. */
function emailGroupBarTone(
  rows: CustomerKeySummary[],
): "allExpired" | "someExpired" | "ok" {
  if (rows.length === 0) return "ok";
  const allExpired = rows.every((r) => r.expires_at && isExpiredIso(r.expires_at));
  if (allExpired) return "allExpired";
  if (rows.some((r) => r.expires_at && isExpiredIso(r.expires_at)))
    return "someExpired";
  return "ok";
}

function EmailGroupBlock({
  group,
  linkFrom,
  showTestBadge,
  collapsed,
  onToggle,
}: {
  group: CustomerGroup;
  linkFrom: "customer" | "test";
  showTestBadge: boolean;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const bar = emailGroupBarTone(group.rows);
  const barBtn =
    bar === "allExpired"
      ? "border-b border-transparent border-l-2 border-l-accent-rose bg-accent-rose/[0.07] pl-1.5 text-left transition-colors hover:border-b-hair hover:border-l-accent-rose hover:bg-accent-rose/15"
      : bar === "someExpired"
        ? "border-b border-transparent border-l-2 border-l-accent-amber/90 bg-accent-amber/12 pl-1.5 text-left transition-colors hover:border-b-hair hover:border-l-accent-amber hover:bg-accent-amber/18"
        : "border-b border-l-2 border-l-transparent border-transparent pl-0 text-left transition-colors hover:border-hair";
  const mailClass =
    bar === "allExpired"
      ? "text-accent-rose"
      : bar === "someExpired"
        ? "text-accent-amber"
        : "text-ink-400";
  const metaClass =
    bar === "allExpired"
      ? "text-accent-rose/80"
      : bar === "someExpired"
        ? "text-accent-amber/80"
        : "text-ink-400";

  return (
    <li>
      <div className="px-0 py-1 sm:px-1">
        <button type="button" onClick={onToggle} className={`flex w-full items-center justify-between gap-3 rounded-l py-2 ${barBtn}`}>
          <span className="flex min-w-0 items-center gap-2">
            <Mail className={`h-3.5 w-3.5 shrink-0 ${mailClass}`} />
            {group.email ? (
              <span className="truncate text-[13px] font-medium text-ink-900" title={group.email}>
                {group.email}
              </span>
            ) : (
              <span className="italic text-[13px] text-ink-400">(ohne Email)</span>
            )}
            <span className={`shrink-0 text-[11px] tabular-nums ${metaClass}`}>
              {group.rows.length} Key{group.rows.length === 1 ? "" : "s"}
            </span>
          </span>
          <ChevronDown
            className={`h-3.5 w-3.5 shrink-0 ${metaClass} transition-transform ${
              collapsed ? "-rotate-90" : "rotate-0"
            }`}
            aria-hidden
          />
        </button>
        {!collapsed && (
          <div className="mt-1 max-h-[min(24rem,70vh)] overflow-y-auto">
            <table className="min-w-full text-left text-[11.5px]">
              <thead className="text-[10px] font-medium uppercase tracking-[0.12em] text-ink-400">
                <tr>
                  <th className="py-1.5 pr-3">Key / Bearbeiten</th>
                  <th className="py-1.5 pr-3">plan_id</th>
                  <th className="py-1.5 pr-3">Ablauf</th>
                  <th className="py-1.5 pr-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hair/80 text-ink-800">
                {group.rows.map((r) => {
                  const exp = r.expires_at;
                  const expired = exp && isExpiredIso(exp);
                  return (
                    <tr key={r.key} className="hover:bg-ink-50/30">
                      <td className="max-w-[min(28rem,50vw)] py-1.5 pr-3 align-top">
                        <Link
                          to={customerKeyDetailPath(r.key, linkFrom)}
                          className="block font-mono text-[11px] text-brand-600 underline decoration-hair underline-offset-2 hover:text-ink-900"
                          title={r.key}
                        >
                          {shortKey(r.key)}
                        </Link>
                      </td>
                      <td className="pr-3 align-top">
                        <span className="font-mono text-[11px] text-ink-700">
                          {r.plan_id || "—"}
                        </span>
                        {showTestBadge && (
                          <span className="ml-1 font-mono text-[9.5px] uppercase tracking-wider text-accent-amber">
                            test
                          </span>
                        )}
                      </td>
                      <td
                        className={`pr-3 align-top tabular-nums ${
                          expired ? "text-accent-rose" : "text-ink-600"
                        }`}
                      >
                        {fmtExpires(exp)}
                      </td>
                      <td className="align-top text-ink-500">{r.status || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </li>
  );
}
