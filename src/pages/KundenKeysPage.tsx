import { Mail, RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "../components/ui/PageHeader";
import PlanFormFields, {
  Field,
  Grid2,
  Section,
  TextInput,
  getPlanValidationMsg,
} from "../components/billing/PlanFormFields";
import { useJsonApi } from "../lib/billingApi";
import {
  CUSTOMER_KEYS_URL,
  CUSTOMER_KEY_STATUSES,
  customerKeyUrlOne,
  parseCustomerKeyValue,
  putCustomerKey,
  shortKey,
  type CustomerKeyOneResponse,
  type CustomerKeySummary,
  type CustomerKeysListResponse,
  type CustomerKeyValue,
} from "../lib/customerKeysApi";
import { type PlanValue } from "../lib/planFormTypes";

export default function KundenKeysPage() {
  const list = useJsonApi<CustomerKeysListResponse>(CUSTOMER_KEYS_URL);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const one = useJsonApi<CustomerKeyOneResponse>(
    selectedKey ? customerKeyUrlOne(selectedKey) : null,
  );

  const reloadAll = useCallback(() => {
    list.reload();
    if (selectedKey) one.reload();
  }, [list, one, selectedKey]);

  const summaries = list.data?.keys ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return summaries;
    return summaries.filter((s) => {
      const fields = [
        s.email,
        s.key,
        s.plan_id,
        s.plan_name,
        s.stripe_customer_id,
        s.stripe_subscription_id,
        s.status,
      ];
      return fields.some(
        (f) => typeof f === "string" && f.toLowerCase().includes(q),
      );
    });
  }, [summaries, search]);

  // Gruppen für die Sidebar: Email als primärer Header. Mehrere Keys pro
  // Email werden als Untereinträge angezeigt; Keys ohne Email landen in
  // einer „(ohne Email)"-Gruppe ganz unten.
  const groups = useMemo(() => groupByEmail(filtered), [filtered]);

  // Stats für das KPI-Band: Total / Granted / Tests / unique Pläne / unique
  // Emails. Alles auf das ungefilterte Set bezogen, damit die Suche die
  // KPIs nicht verzerrt.
  const stats = useMemo(() => computeStats(summaries), [summaries]);

  return (
    <>
      <PageHeader
        eyebrow="Kundenmanagement"
        title="Kunden Keys"
        hideCalendarAndNotifications
        description={
          <>
            KV{" "}
            <span className="font-mono text-[12.5px] text-ink-700">
              customer_keys
            </span>
            : ausgegebene Kunden-Keys mit Plan, Status und Stripe-Verknüpfung —
            sortiert nach Email-Adresse für schnelles Zuordnen.
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
              className={`h-3.5 w-3.5 ${list.loading || one.loading ? "animate-spin" : ""}`}
            />
          </button>
        }
      />

      {list.error && (
        <p className="mb-6 border-l-2 border-accent-rose px-3 py-2 text-[12.5px] text-accent-rose">
          {list.error}
        </p>
      )}

      <KpiStrip stats={stats} loading={list.loading && !list.data} />

      {list.loading && !list.data ? (
        <p className="py-12 text-center text-[12.5px] text-ink-400">Lade …</p>
      ) : (
        <div className="grid gap-10 border-t border-hair pt-10 lg:grid-cols-12 lg:gap-0">
          {/* Sidebar: Email-/Key-Liste */}
          <aside className="lg:col-span-4 lg:border-r lg:border-hair lg:pr-8 xl:col-span-3">
            <div className="mb-3 flex items-baseline justify-between">
              <p className="text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-400">
                Kunden
              </p>
              <span className="text-[11px] tabular-nums text-ink-400">
                {filtered.length} / {summaries.length}
              </span>
            </div>

            <div className="relative mb-4">
              <Search className="pointer-events-none absolute left-0 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
              <input
                type="search"
                placeholder="Email, Key, Plan, Stripe-ID …"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full border-b border-hair bg-transparent py-1.5 pl-6 pr-2 text-[12.5px] text-ink-800 outline-none placeholder:text-ink-400 focus:border-ink-700"
              />
            </div>

            {groups.length === 0 ? (
              <p className="border border-dashed border-hair px-3 py-6 text-center text-[12px] text-ink-500">
                {summaries.length === 0
                  ? "Noch keine Kunden-Keys."
                  : "Keine Treffer."}
              </p>
            ) : (
              <ul className="divide-y divide-hair border-y border-hair">
                {groups.map((g) => (
                  <CustomerGroupRow
                    key={g.id}
                    group={g}
                    selectedKey={selectedKey}
                    onSelect={setSelectedKey}
                  />
                ))}
              </ul>
            )}
          </aside>

          {/* Editor */}
          <div className="lg:col-span-8 lg:pl-10 xl:col-span-9">
            {selectedKey ? (
              <CustomerKeyEditor
                key={selectedKey}
                kid={selectedKey}
                one={one.data}
                err={one.error}
                loading={one.loading}
                onAfterSave={() => {
                  list.reload();
                  one.reload();
                }}
              />
            ) : (
              <div className="flex h-full min-h-[240px] flex-col items-start justify-center border border-dashed border-hair px-6 py-10">
                <p className="text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-400">
                  Kein Kunden-Key ausgewählt
                </p>
                <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-ink-500">
                  Wähle links einen Kunden aus, um den Plan + Status
                  einzusehen oder zu bearbeiten. Mehrere Keys pro Email werden
                  unter der Email gruppiert.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ---------- Gruppierung & Stats ----------

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
  granted: number;
  testMode: number;
  uniqueEmails: number;
  uniquePlans: number;
};

function computeStats(rows: CustomerKeySummary[]): Stats {
  const emails = new Set<string>();
  const plans = new Set<string>();
  let granted = 0;
  let testMode = 0;
  let withEmail = 0;
  for (const r of rows) {
    if (r.email) {
      emails.add(r.email.toLowerCase());
      withEmail += 1;
    }
    if (r.plan_id) plans.add(r.plan_id);
    if (r.status === "granted") granted += 1;
    if (r.is_test_mode === true) testMode += 1;
  }
  return {
    total: rows.length,
    withEmail,
    granted,
    testMode,
    uniqueEmails: emails.size,
    uniquePlans: plans.size,
  };
}

function KpiStrip({ stats, loading }: { stats: Stats; loading: boolean }) {
  return (
    <div className="mb-12 grid grid-cols-2 divide-y divide-hair border-y border-hair sm:grid-cols-3 sm:divide-x sm:divide-y-0 lg:grid-cols-5">
      <KpiTile
        label="Keys gesamt"
        value={loading ? "…" : String(stats.total)}
        sub="im KV"
      />
      <KpiTile
        label="Mit Email"
        value={loading ? "…" : String(stats.withEmail)}
        sub={
          loading
            ? ""
            : stats.total > 0
              ? `${Math.round((stats.withEmail / stats.total) * 100)} % zugeordnet`
              : "—"
        }
        tone={stats.withEmail > 0 ? "ok" : "neutral"}
      />
      <KpiTile
        label="Aktiv (granted)"
        value={loading ? "…" : String(stats.granted)}
        sub={loading ? "" : `${stats.total - stats.granted} sonstige`}
        tone="ok"
      />
      <KpiTile
        label="Unique Pläne"
        value={loading ? "…" : String(stats.uniquePlans)}
        sub={loading ? "" : "verknüpft"}
      />
      <KpiTile
        label="Testmodus"
        value={loading ? "…" : String(stats.testMode)}
        sub={loading ? "" : "is_test_mode = true"}
        tone={stats.testMode > 0 ? "warn" : "neutral"}
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
  tone?: "neutral" | "ok" | "warn";
}) {
  const subColor =
    tone === "ok"
      ? "text-accent-mint"
      : tone === "warn"
        ? "text-accent-amber"
        : "text-ink-400";
  return (
    <div className="px-5 py-6 sm:px-6 lg:px-8 lg:first:pl-0">
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

// ---------- Sidebar-Zeile ----------

function CustomerGroupRow({
  group,
  selectedKey,
  onSelect,
}: {
  group: CustomerGroup;
  selectedKey: string | null;
  onSelect: (k: string) => void;
}) {
  const single = group.rows.length === 1;
  return (
    <li>
      <div className="px-1 py-2">
        <div className="flex items-baseline justify-between gap-2">
          <p className="flex min-w-0 items-center gap-1.5 text-[12.5px] text-ink-800">
            {group.email ? (
              <>
                <Mail className="h-3 w-3 shrink-0 text-ink-400" />
                <span className="truncate" title={group.email}>
                  {group.email}
                </span>
              </>
            ) : (
              <span className="italic text-ink-400">(ohne Email)</span>
            )}
          </p>
          {!single && (
            <span className="text-[10.5px] tabular-nums text-ink-400">
              {group.rows.length}
            </span>
          )}
        </div>
        <ul className={single ? "mt-1" : "mt-1 space-y-0.5 pl-4"}>
          {group.rows.map((r) => {
            const active = selectedKey === r.key;
            return (
              <li key={r.key}>
                <button
                  type="button"
                  onClick={() => onSelect(r.key)}
                  className={`group flex w-full items-center justify-between gap-2 px-1.5 py-1 text-left transition-colors ${
                    active
                      ? "bg-ink-50 text-ink-900"
                      : "text-ink-600 hover:bg-ink-50/60 hover:text-ink-900"
                  }`}
                  title={r.key}
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="font-mono text-[11px] text-ink-700">
                      {shortKey(r.key)}
                    </span>
                    {r.plan_id && (
                      <span className="truncate text-[10.5px] text-ink-400">
                        {r.plan_id}
                      </span>
                    )}
                  </span>
                  <StatusDot status={r.status} testMode={r.is_test_mode} />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </li>
  );
}

function StatusDot({
  status,
  testMode,
}: {
  status: string | null;
  testMode: boolean | null;
}) {
  let color = "bg-ink-200";
  let title = status || "—";
  if (status === "granted") {
    color = "bg-accent-mint";
    title = "granted";
  } else if (status === "pending") {
    color = "bg-accent-amber";
  } else if (status === "revoked" || status === "expired") {
    color = "bg-accent-rose";
  }
  if (testMode) {
    title += " · Testmodus";
  }
  return (
    <span className="flex shrink-0 items-center gap-1">
      {testMode && (
        <span className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-accent-amber">
          test
        </span>
      )}
      <span
        className={`h-1.5 w-1.5 rounded-full ${color}`}
        title={title}
        aria-hidden
      />
    </span>
  );
}

// ---------- Editor ----------

function CustomerKeyEditor({
  kid,
  one,
  err,
  loading,
  onAfterSave,
}: {
  kid: string;
  one: CustomerKeyOneResponse | null;
  err: string | null;
  loading: boolean;
  onAfterSave: () => void;
}) {
  const [model, setModel] = useState<CustomerKeyValue | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [savedPing, setSavedPing] = useState(false);

  // Modell aus dem geladenen KV-Wert ableiten. `one` trifft asynchron ein,
  // daher useEffect. parseError wird nur bei wirklich kaputtem JSON gesetzt;
  // sonst fallen wir mit Defaults gracefully zurück.
  useEffect(() => {
    if (!one || one.key !== kid) return;
    let input: unknown = one.value;
    if (input == null && one.raw) {
      try {
        input = JSON.parse(one.raw) as unknown;
      } catch {
        setModel(null);
        setParseError("Gespeichertes JSON ist ungültig");
        return;
      }
    }
    const parsed = parseCustomerKeyValue(input);
    if (parsed.ok) {
      setModel(parsed.value);
      setParseError(null);
    } else {
      setModel(null);
      setParseError(parsed.error);
    }
  }, [one, kid]);

  if (loading && !one) {
    return (
      <p className="py-8 text-[12.5px] text-ink-400">Lade Kunden-Key …</p>
    );
  }
  if (err) {
    return (
      <p className="border-l-2 border-accent-rose px-3 py-2 text-[12.5px] text-accent-rose">
        {err}
      </p>
    );
  }
  if (parseError && !model) {
    return (
      <p className="border-l-2 border-accent-rose px-3 py-2 text-[12.5px] text-accent-rose">
        Wert ungültig: {parseError}
      </p>
    );
  }
  if (!model) {
    return <p className="py-8 text-[12.5px] text-ink-400">…</p>;
  }

  const planValidation = getPlanValidationMsg(model.plan);
  const customerValidation = ((): string | null => {
    if (model.customer.email && !/^\S+@\S+\.\S+$/.test(model.customer.email)) {
      return "Email: ungültiges Format";
    }
    if (!model.plan_id.trim()) return "plan_id darf nicht leer sein";
    if (!model.status.trim()) return "status darf nicht leer sein";
    return null;
  })();
  const validationMsg = customerValidation ?? planValidation;

  const setPlan = (next: PlanValue) =>
    setModel((m) => (m ? { ...m, plan: next } : m));

  const onSave = async () => {
    if (!model || validationMsg) {
      if (validationMsg) setSaveErr(validationMsg);
      return;
    }
    setSaveErr(null);
    setSaving(true);
    try {
      await putCustomerKey(kid, model);
      setSavedPing(true);
      window.setTimeout(() => setSavedPing(false), 1600);
      onAfterSave();
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const customerLabel = model.customer.email || shortKey(kid);

  return (
    <div>
      {/* Editor-Header */}
      <div className="mb-6 flex items-baseline justify-between gap-3 border-b border-hair pb-4">
        <div className="min-w-0">
          <p className="text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-400">
            Kunden-Key
          </p>
          <p
            className="mt-1 truncate font-display text-[20px] tracking-tightish text-ink-900"
            title={kid}
          >
            {customerLabel}
          </p>
          <p
            className="mt-0.5 truncate font-mono text-[11.5px] text-ink-500"
            title={kid}
          >
            {kid}
          </p>
        </div>
      </div>

      {/* Status & Customer */}
      <Section title="Status & Kunde">
        <div className="space-y-5">
          <Grid2>
            <Field label="status">
              <select
                value={model.status}
                onChange={(e) =>
                  setModel((m) => (m ? { ...m, status: e.target.value } : m))
                }
                className="w-full border-b border-hair bg-transparent py-1.5 text-[12.5px] text-ink-800 outline-none focus:border-ink-700"
              >
                {[
                  ...new Set([
                    model.status,
                    ...CUSTOMER_KEY_STATUSES,
                  ]),
                ].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="plan_id">
              <TextInput
                value={model.plan_id}
                onChange={(v) =>
                  setModel((m) => (m ? { ...m, plan_id: v } : m))
                }
                mono
              />
            </Field>
          </Grid2>

          <Field label="customer.email">
            <TextInput
              type="email"
              value={model.customer.email}
              onChange={(v) =>
                setModel((m) =>
                  m ? { ...m, customer: { ...m.customer, email: v } } : m,
                )
              }
              placeholder="kunde@example.com"
            />
          </Field>

          <Grid2>
            <Field label="customer.stripe_customer_id">
              <TextInput
                value={model.customer.stripe_customer_id ?? ""}
                onChange={(v) =>
                  setModel((m) =>
                    m
                      ? {
                          ...m,
                          customer: {
                            ...m.customer,
                            stripe_customer_id: v.trim() || null,
                          },
                        }
                      : m,
                  )
                }
                placeholder="cus_…"
                mono
              />
            </Field>
            <Field
              label="customer.stripe_subscription_id"
              hint="z. B. one_time_purchase"
            >
              <TextInput
                value={model.customer.stripe_subscription_id}
                onChange={(v) =>
                  setModel((m) =>
                    m
                      ? {
                          ...m,
                          customer: {
                            ...m.customer,
                            stripe_subscription_id: v,
                          },
                        }
                      : m,
                  )
                }
                mono
              />
            </Field>
          </Grid2>

          <Grid2>
            <Field
              label="metadata.created_at"
              hint="ISO 8601 (UTC)"
            >
              <TextInput
                value={model.metadata.created_at}
                onChange={(v) =>
                  setModel((m) =>
                    m
                      ? { ...m, metadata: { ...m.metadata, created_at: v } }
                      : m,
                  )
                }
                mono
              />
            </Field>
          </Grid2>
        </div>
      </Section>

      {/* Eingebetteter Plan — gleicher Editor wie unter „Pläne" */}
      <PlanFormFields model={model.plan} onChange={setPlan} />

      {/* Sticky Save-Footer */}
      <div className="sticky bottom-0 -mx-6 mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-hair bg-paper/95 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-paper/85">
        <div className="min-w-0 text-[11.5px] text-ink-500">
          {validationMsg ? (
            <span className="text-accent-amber">{validationMsg}</span>
          ) : saveErr ? (
            <span className="text-accent-rose">{saveErr}</span>
          ) : savedPing ? (
            <span className="text-accent-mint">Gespeichert.</span>
          ) : (
            <span className="text-ink-400">
              Änderungen werden nach „Speichern“ übernommen.
            </span>
          )}
        </div>
        <button
          type="button"
          disabled={saving || !!validationMsg}
          onClick={onSave}
          className="rounded-md bg-ink-900 px-4 py-2 text-[12.5px] font-medium text-white transition-colors hover:bg-ink-800 disabled:opacity-50"
        >
          {saving ? "Speichere …" : "Kunden-Key speichern"}
        </button>
      </div>
    </div>
  );
}
