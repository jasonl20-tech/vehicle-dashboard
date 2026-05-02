import {
  ChevronDown,
  ChevronRight,
  Loader2,
  Mail,
  RefreshCw,
  Search,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import CustomerKeyEditor from "../components/customer-keys/CustomerKeyEditor";
import SplitView from "../components/layout/SplitView";
import { useJsonApi } from "../lib/billingApi";
import {
  customerKeyUrlOne,
  customerKeysListUrl,
  isExpiredIso,
  shortKey,
  type CustomerKeyOneResponse,
  type CustomerKeySummary,
  type CustomerKeysListResponse,
} from "../lib/customerKeysApi";

type ListVariant = "customer" | "test";
type ExpiryFilter = "all" | "expired" | "valid" | "soon7";

export default function KundenKeysPage() {
  return <KundenKeysSplitView variant="customer" />;
}

export function KundenTestKeysPage() {
  return <KundenKeysSplitView variant="test" />;
}

function basePathFor(variant: ListVariant): string {
  return variant === "test"
    ? "/dashboard/kunden/test-keys"
    : "/dashboard/kunden/keys";
}

function KundenKeysSplitView({ variant }: { variant: ListVariant }) {
  const list = useJsonApi<CustomerKeysListResponse>(
    customerKeysListUrl(variant === "customer" ? "customer" : "test"),
  );

  const { key: keyParam } = useParams();
  const navigate = useNavigate();
  const selectedKey = keyParam ? decodeURIComponent(keyParam) : null;

  const oneApi = useJsonApi<CustomerKeyOneResponse>(
    selectedKey ? customerKeyUrlOne(selectedKey) : null,
  );

  const reloadAll = useCallback(() => {
    list.reload();
    if (selectedKey) oneApi.reload();
  }, [list, oneApi, selectedKey]);

  const summaries = list.data?.keys ?? [];
  const isTestArea = variant === "test";

  // ---------- Filter / Suche ----------
  const [q, setQ] = useState("");
  const [planId, setPlanId] = useState("");
  const [expiry, setExpiry] = useState<ExpiryFilter>("all");
  /** `true` = Email-Gruppe zugeklappt. Standard: zu, übersichtlicher. */
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

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
    return summaries.filter((s) => {
      if (planId && s.plan_id !== planId) return false;

      if (expiry === "expired") {
        if (!s.expires_at || !isExpiredIso(s.expires_at)) return false;
      } else if (expiry === "valid") {
        if (!s.expires_at) return true;
        if (isExpiredIso(s.expires_at)) return false;
      } else if (expiry === "soon7") {
        if (!s.expires_at) return false;
        const t = Date.parse(s.expires_at);
        if (isNaN(t) || t < now || t > soonEnd) return false;
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
  }, [summaries, q, planId, expiry]);

  const groups = useMemo(() => groupByEmail(filtered), [filtered]);

  // Auto-expand der Gruppe, in der der gerade selektierte Key liegt:
  useEffect(() => {
    if (!selectedKey) return;
    const sel = summaries.find((s) => s.key === selectedKey);
    if (!sel) return;
    const gid = groupIdFor(sel.email);
    setCollapsed((m) => (m[gid] === false ? m : { ...m, [gid]: false }));
  }, [selectedKey, summaries]);

  const goToKey = useCallback(
    (key: string) => {
      navigate(`${basePathFor(variant)}/${encodeURIComponent(key)}`);
    },
    [navigate, variant],
  );

  // ---------- Sidebar ----------
  const aside = (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-hair p-3 pr-9">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-500">
            {isTestArea ? "Kundentest-Keys" : "Kunden-Keys"}
          </p>
          <button
            type="button"
            onClick={reloadAll}
            className="inline-flex h-6 w-6 items-center justify-center rounded text-ink-400 hover:bg-ink-100 hover:text-ink-700"
            title="Aktualisieren"
            aria-label="Aktualisieren"
          >
            <RefreshCw
              className={`h-3 w-3 ${list.loading ? "animate-spin" : ""}`}
            />
          </button>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-hair bg-paper/60 px-2.5 py-1.5">
          <Search className="h-3.5 w-3.5 shrink-0 text-ink-400" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Email, Key, Plan, Status…"
            className="min-w-0 flex-1 border-0 bg-transparent text-[12.5px] text-ink-900 placeholder:text-ink-400 focus:outline-none"
          />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <select
            value={planId}
            onChange={(e) => setPlanId(e.target.value)}
            className="min-w-0 rounded border border-hair bg-white px-1.5 py-1 text-[11.5px] text-ink-700 focus:border-ink-400 focus:outline-none"
            title="Plan filtern"
          >
            <option value="">Alle Pläne</option>
            {planOptions.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <select
            value={expiry}
            onChange={(e) => setExpiry(e.target.value as ExpiryFilter)}
            className="min-w-0 rounded border border-hair bg-white px-1.5 py-1 text-[11.5px] text-ink-700 focus:border-ink-400 focus:outline-none"
            title="Ablauffilter"
          >
            <option value="all">Alle</option>
            <option value="expired">Abgelaufen</option>
            <option value="valid">Gültig</option>
            <option value="soon7">Läuft in 7 T.</option>
          </select>
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] tabular-nums text-ink-500">
          <span>
            {filtered.length} Keys · {groups.length} Gruppen
            {q || planId || expiry !== "all"
              ? ` · ${summaries.length} gesamt`
              : ""}
          </span>
          {list.loading && <Loader2 className="h-3 w-3 animate-spin" />}
        </div>
      </div>

      {list.error && (
        <p className="border-b border-accent-rose/50 bg-accent-rose/10 px-3 py-2 text-[11.5px] text-accent-rose">
          {list.error}
        </p>
      )}

      <ul className="min-h-0 flex-1 divide-y divide-hair overflow-y-auto">
        {!list.loading && groups.length === 0 && (
          <li className="px-4 py-6 text-center text-[12.5px] text-ink-500">
            {summaries.length === 0
              ? isTestArea
                ? "Keine Kundentest-Keys gefunden."
                : "Keine Kunden-Keys im KV."
              : "Keine Treffer für die Filter."}
          </li>
        )}
        {groups.map((g) => {
          const gid = g.id;
          const isCollapsed = collapsed[gid] ?? true;
          const allExpired = g.rows.every(
            (r) => r.expires_at && isExpiredIso(r.expires_at),
          );
          const someExpired =
            !allExpired &&
            g.rows.some((r) => r.expires_at && isExpiredIso(r.expires_at));
          const tone = allExpired
            ? "rose"
            : someExpired
              ? "amber"
              : "neutral";
          return (
            <li key={gid}>
              <button
                type="button"
                onClick={() =>
                  setCollapsed((m) => ({ ...m, [gid]: !isCollapsed }))
                }
                className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition hover:bg-ink-50/60 ${
                  tone === "rose"
                    ? "border-l-2 border-l-accent-rose bg-accent-rose/[0.05]"
                    : tone === "amber"
                      ? "border-l-2 border-l-accent-amber/90 bg-accent-amber/[0.06]"
                      : "border-l-2 border-l-transparent"
                }`}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Mail
                    className={`h-3.5 w-3.5 shrink-0 ${
                      tone === "rose"
                        ? "text-accent-rose"
                        : tone === "amber"
                          ? "text-accent-amber"
                          : "text-ink-400"
                    }`}
                  />
                  {g.email ? (
                    <span
                      className="truncate text-[12.5px] font-medium text-ink-900"
                      title={g.email}
                    >
                      {g.email}
                    </span>
                  ) : (
                    <span className="italic text-[12.5px] text-ink-400">
                      (ohne Email)
                    </span>
                  )}
                  <span className="shrink-0 text-[10.5px] tabular-nums text-ink-400">
                    {g.rows.length}
                  </span>
                </span>
                {isCollapsed ? (
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-400" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-ink-400" />
                )}
              </button>
              {!isCollapsed && (
                <ul className="bg-paper/40">
                  {g.rows.map((r) => {
                    const active = r.key === selectedKey;
                    const expired =
                      r.expires_at && isExpiredIso(r.expires_at);
                    return (
                      <li key={r.key}>
                        <button
                          type="button"
                          onClick={() => goToKey(r.key)}
                          className={`flex w-full items-start gap-2 px-3 py-1.5 pl-8 text-left transition ${
                            active
                              ? "bg-ink-100 text-ink-900"
                              : "hover:bg-ink-50/70"
                          }`}
                        >
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span
                              className={`block truncate font-mono text-[11.5px] ${
                                active
                                  ? "text-ink-900"
                                  : expired
                                    ? "text-accent-rose"
                                    : "text-ink-700"
                              }`}
                              title={r.key}
                            >
                              {shortKey(r.key)}
                            </span>
                            <span
                              className="block truncate text-[10.5px] text-ink-500"
                              title={`${r.plan_id ?? ""} · ${r.status ?? ""}`}
                            >
                              {r.plan_id || "–"}
                              {r.status ? ` · ${r.status}` : ""}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );

  // ---------- Hauptbereich (Editor) ----------
  return (
    <SplitView
      storageKey={
        isTestArea ? "ui.kundenTestKeys.aside" : "ui.kundenKeys.aside"
      }
      asideLabel={isTestArea ? "Test-Keys" : "Keys"}
      asideWidthClass="md:w-[320px]"
      asideContent={aside}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {selectedKey ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8 sm:py-8">
            <CustomerKeyEditor
              key={selectedKey}
              kid={selectedKey}
              one={oneApi.data}
              err={oneApi.error}
              loading={oneApi.loading}
              onAfterSave={reloadAll}
              containerClassName="mx-auto max-w-3xl"
            />
          </div>
        ) : (
          <EmptyState variant={variant} />
        )}
      </div>
    </SplitView>
  );
}

function EmptyState({ variant }: { variant: ListVariant }) {
  const isTest = variant === "test";
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-12">
      <div className="max-w-md text-center">
        <p className="text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-400">
          {isTest ? "Kundentest-Keys" : "Kunden-Keys"}
        </p>
        <h2 className="mt-2 font-display text-[22px] tracking-tightish text-ink-900">
          Wähle einen Key links aus
        </h2>
        <p className="mt-3 text-[13px] leading-relaxed text-ink-500">
          {isTest ? (
            <>
              Test-Keys haben{" "}
              <span className="font-mono text-[11.5px] text-ink-700">
                test
              </span>{" "}
              im{" "}
              <span className="font-mono text-[11.5px] text-ink-700">
                plan_id
              </span>{" "}
              oder{" "}
              <span className="font-mono text-[11.5px] text-ink-700">
                plan_name
              </span>
              .
            </>
          ) : (
            <>
              Produktions-Keys ohne „test“ im Plan-Namen. Pläne mit „test“ siehe{" "}
              <span className="font-mono text-[11.5px] text-ink-700">
                Kundentest keys
              </span>
              .
            </>
          )}
        </p>
      </div>
    </div>
  );
}

// ---------- Helpers ----------

type CustomerGroup = {
  id: string;
  email: string | null;
  rows: CustomerKeySummary[];
};

function groupIdFor(email: string | null): string {
  return email ? `e:${email.toLowerCase()}` : "_:noemail";
}

function groupByEmail(rows: CustomerKeySummary[]): CustomerGroup[] {
  const byEmail = new Map<string, CustomerGroup>();
  for (const r of rows) {
    const id = groupIdFor(r.email);
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
