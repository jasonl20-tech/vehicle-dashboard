import {
  AlertCircle,
  ArrowDownAZ,
  ArrowUpAZ,
  CheckCircle2,
  RefreshCw,
  Search,
  Stethoscope,
  X,
} from "lucide-react";
import {
  type ChangeEvent,
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  type AnalyticsMode,
  type KeyDetailResponse,
  type OverviewRow,
  PRESETS,
  type Range,
  type RecentRow,
  type StatusCount,
  type TimeseriesPoint,
  type TopAction,
  type TopBrand,
  type TopKey,
  type TopModel,
  type TopPath,
  type TopView,
  aeTimestampToDate,
  fmtCompact,
  fmtDateTime,
  fmtNumber,
  fmtRelative,
  makeApiUrls,
  parsePath,
  rangeFromPreset,
  statusClass,
  toAeTimestamp,
  useApi,
} from "../lib/customerApi";
import {
  CUSTOMER_KEYS_EMAIL_MAP_URL,
  type CustomerKeyEmailMap,
} from "../lib/customerKeysApi";

type TopKeysResp = { rows: TopKey[] };
type RecentResp = { rows: RecentRow[] };
type TimeseriesResp = {
  rows: TimeseriesPoint[];
  bucket: "minute" | "hour" | "day";
};

type KeyCustomerLookup = {
  email?: string;
  /** Einer der KV-Keys der Map/Testdatei zugeordnet (exakt oder fuzzy). */
  resolved: boolean;
  /** nur sinnvoll, wenn `resolved` */
  isTestKey: boolean;
};

/**
 * Daten aus `customer_keys` (E-Mail-Map + Test-Flag) für KeyChips und Suche.
 */
const KeyCustomerContext = createContext<{
  emailByKey: Record<string, string>;
  testByKey: Record<string, boolean>;
}>({ emailByKey: {}, testByKey: {} });

/**
 * Baut die Menge aller KV-Keys (für Fuzzy-Abgleich, auch ohne E-Mail im KV).
 */
function unionKvKeys(
  emailByKey: Record<string, string>,
  testByKey: Record<string, boolean>,
): string[] {
  return Array.from(
    new Set([...Object.keys(emailByKey), ...Object.keys(testByKey)]),
  );
}

/**
 * Liefert E-Mail und Test-Status zu einem Analytics-`keyId`, sofern der
 * zu einem `customer_keys`-Eintrag passt. `index1` o. ä. sind oft kürzer →
 * Präfix/Suffix-Fuzzy auf alle KV-Keys.
 */
function lookupKeyCustomer(
  emailByKey: Record<string, string>,
  testByKey: Record<string, boolean>,
  id: string,
): KeyCustomerLookup {
  if (!id) return { resolved: false, isTestKey: false };
  const t = id.trim();
  if (!t) return { resolved: false, isTestKey: false };

  const allKeys = unionKvKeys(emailByKey, testByKey);

  const directKey = (() => {
    if (testByKey[t] !== undefined || emailByKey[t]) return t;
    const tl = t.toLowerCase();
    for (const k of allKeys) {
      if (k.toLowerCase() === tl) return k;
    }
    return undefined;
  })();

  if (directKey) {
    return {
      email: emailByKey[directKey] ?? emailByKey[directKey.toLowerCase()],
      resolved: true,
      isTestKey: testByKey[directKey] ?? testByKey[directKey.toLowerCase()] ?? false,
    };
  }

  const tl = t.toLowerCase();
  if (tl.length < 4) return { resolved: false, isTestKey: false };
  const sorted = [...allKeys].sort((a, b) => b.length - a.length);
  for (const kvKey of sorted) {
    const k = kvKey.toLowerCase();
    if (k.length < 4) continue;
    if (k === tl) {
      return {
        email: emailByKey[kvKey] ?? emailByKey[kvKey.toLowerCase()],
        resolved: true,
        isTestKey: testByKey[kvKey] ?? testByKey[kvKey.toLowerCase()] ?? false,
      };
    }
    if (k.startsWith(tl) || (tl.length >= 6 && k.endsWith(tl))) {
      return {
        email: emailByKey[kvKey] ?? emailByKey[kvKey.toLowerCase()],
        resolved: true,
        isTestKey: testByKey[kvKey] ?? testByKey[kvKey.toLowerCase()] ?? false,
      };
    }
    if (tl.length >= 8 && (k.includes(tl) || tl.includes(k))) {
      return {
        email: emailByKey[kvKey] ?? emailByKey[kvKey.toLowerCase()],
        resolved: true,
        isTestKey: testByKey[kvKey] ?? testByKey[kvKey.toLowerCase()] ?? false,
      };
    }
  }
  return { resolved: false, isTestKey: false };
}

function lookupKeyEmail(
  emailByKey: Record<string, string>,
  testByKey: Record<string, boolean>,
  id: string,
): string | undefined {
  return lookupKeyCustomer(emailByKey, testByKey, id).email;
}

/** Eine Map, die pro Key sowohl exakte als auch lowercased Lookups erlaubt. */
function buildKeyEmailMap(raw: Record<string, string> | undefined): Record<string, string> {
  const base = raw ?? {};
  if (Object.keys(base).length === 0) return base;
  const out: Record<string, string> = { ...base };
  for (const [k, v] of Object.entries(base)) {
    if (!v) continue;
    const lk = k.toLowerCase();
    if (out[lk] === undefined) out[lk] = v;
  }
  return out;
}

function buildKeyTestMap(
  raw: Record<string, boolean> | undefined,
): Record<string, boolean> {
  const base = raw ?? {};
  if (Object.keys(base).length === 0) return base;
  const out: Record<string, boolean> = { ...base };
  for (const [k, v] of Object.entries(base)) {
    const lk = k.toLowerCase();
    if (out[lk] === undefined) out[lk] = v;
  }
  return out;
}

function useKeyCustomerInfo(id: string): KeyCustomerLookup {
  const { emailByKey, testByKey } = useContext(KeyCustomerContext);
  return useMemo(
    () => lookupKeyCustomer(emailByKey, testByKey, id),
    [emailByKey, testByKey, id],
  );
}

interface KundenApiPageProps {
  /** Datenquelle: alle Kunden (Standard) oder nur der Oneauto-Key. */
  mode?: AnalyticsMode;
  /** Wird im Header angezeigt – z. B. „Kunden API" oder „Oneauto API". */
  title?: string;
  /** Optionaler Subtitel/Header-Beschreibung. */
  description?: ReactNode;
  /** Eyebrow-Label (klein, oben). */
  eyebrow?: string;
}

export default function KundenApiPage({
  mode = "customers",
  title = "Kunden API",
  description,
  eyebrow = "API Analytics · Kunden API",
}: KundenApiPageProps = {}) {
  const [range, setRange] = useState<Range>(() => rangeFromPreset("7d"));
  const [openKey, setOpenKey] = useState<string | null>(null);

  const apiUrls = useMemo(() => makeApiUrls(mode), [mode]);

  // Email-Map: Mapping vom Kunden-Key zur Email (sofern hinterlegt). Fehlt
  // das KV-Binding, ignorieren wir den Fehler still — die UI fällt dann
  // einfach auf den Key-String zurück.
  const emailMap = useApi<CustomerKeyEmailMap>(CUSTOMER_KEYS_EMAIL_MAP_URL);
  const keyCustomer = useMemo(() => {
    return {
      emailByKey: buildKeyEmailMap(emailMap.data?.map),
      testByKey: buildKeyTestMap(emailMap.data?.is_test_key),
    };
  }, [emailMap.data]);

  const overview = useApi<{ row: OverviewRow }>(apiUrls.overview(range));
  const timeseries = useApi<TimeseriesResp>(apiUrls.timeseries(range));
  const topKeys = useApi<TopKeysResp>(apiUrls.topKeys(range, 25));
  const topBrands = useApi<{ rows: TopBrand[] }>(apiUrls.topBrands(range));
  const topActions = useApi<{ rows: TopAction[] }>(apiUrls.topActions(range));
  const topModels = useApi<{ rows: TopModel[] }>(apiUrls.topModels(range, 8));
  const topPaths = useApi<{ rows: TopPath[] }>(apiUrls.topPaths(range, 10));
  const topViews = useApi<{ rows: TopView[] }>(apiUrls.topViews(range, 12));
  const statusCodes = useApi<{ rows: StatusCount[] }>(
    apiUrls.statusCodes(range),
  );
  const recent = useApi<RecentResp>(apiUrls.recent(range, 200));

  function reloadAll() {
    emailMap.reload();
    overview.reload();
    timeseries.reload();
    topKeys.reload();
    topBrands.reload();
    topActions.reload();
    topModels.reload();
    topPaths.reload();
    topViews.reload();
    statusCodes.reload();
    recent.reload();
  }

  return (
    <KeyCustomerContext.Provider value={keyCustomer}>
      <Header
        range={range}
        onRange={setRange}
        onReload={reloadAll}
        title={title}
        eyebrow={eyebrow}
        description={description}
        mode={mode}
      />

      <ErrorBanner
        msg={
          overview.error ||
          timeseries.error ||
          topKeys.error ||
          recent.error ||
          null
        }
      />

      <DiagPanel
        autoOpen={Boolean(
          overview.error &&
            (overview.error.includes("404") ||
              overview.error.includes("CF_ACCOUNT_ID")),
        )}
      />


      <KpiGrid row={overview.data?.row} loading={overview.loading} />

      <Section
        title="Anfragen über Zeit"
        meta={
          timeseries.data?.bucket
            ? `Aggregation pro ${labelForBucket(timeseries.data.bucket)}`
            : undefined
        }
        legend={[
          { color: "#5a3df0", label: "Erfolgreich (2xx/3xx)" },
          { color: "#ff5d8f", label: "Fehler (4xx/5xx)" },
        ]}
      >
        <TimeChart
          data={timeseries.data?.rows ?? []}
          loading={timeseries.loading}
        />
      </Section>

      <div className="grid gap-12 border-t border-hair pt-10 lg:grid-cols-2">
        <SubSection title="Top Marken" meta="Aufrufe nach blob3">
          <TopBarsChart
            data={(topBrands.data?.rows ?? []).map((r) => ({
              label: r.brand,
              value: r.requests,
            }))}
            color="#5a3df0"
            loading={topBrands.loading}
          />
        </SubSection>
        <SubSection title="Top Endpoints" meta="Aufrufe nach blob5 (Action)">
          <TopBarsChart
            data={(topActions.data?.rows ?? []).map((r) => ({
              label: r.action,
              value: r.requests,
            }))}
            color="#3ecf8e"
            loading={topActions.loading}
          />
        </SubSection>
      </div>

      <Section
        title="Top Bild-Views"
        meta="Welche Ansicht (front_left, right, …) wird wie oft abgerufen?"
      >
        <TopViewsGrid
          rows={topViews.data?.rows ?? []}
          loading={topViews.loading}
        />
      </Section>

      <div className="grid gap-12 border-t border-hair pt-10 lg:grid-cols-3">
        <SubSection
          title="HTTP-Status"
          meta="Verteilung nach Statuscode"
          className="lg:col-span-1"
        >
          <StatusDonut
            data={statusCodes.data?.rows ?? []}
            loading={statusCodes.loading}
          />
        </SubSection>
        <SubSection
          title="Top Modelle"
          meta="Marke + Modell"
          className="lg:col-span-2"
        >
          <TopModelsList
            rows={topModels.data?.rows ?? []}
            loading={topModels.loading}
          />
        </SubSection>
      </div>

      <Section
        title="Top API-Keys"
        meta="Klicke einen Key an für Detail-Statistik"
      >
        <TopKeysTable
          rows={topKeys.data?.rows ?? []}
          loading={topKeys.loading}
          onOpen={setOpenKey}
        />
      </Section>

      <Section title="Top Pfade" meta="Häufigste Roh-URLs">
        <TopPathsTable
          rows={topPaths.data?.rows ?? []}
          loading={topPaths.loading}
        />
      </Section>

      <Section
        title="Letzte Anfragen"
        meta="Sortier- und filterbar (max. 200 Einträge)"
      >
        <RecentTable
          rows={recent.data?.rows ?? []}
          loading={recent.loading}
          onOpenKey={setOpenKey}
        />
      </Section>

      {openKey && (
        <KeyDetailDrawer
          keyId={openKey}
          range={range}
          mode={mode}
          onClose={() => setOpenKey(null)}
        />
      )}
    </KeyCustomerContext.Provider>
  );
}

// ---------- Header ----------

function Header({
  range,
  onRange,
  onReload,
  title,
  eyebrow,
  description,
  mode,
}: {
  range: Range;
  onRange: (r: Range) => void;
  onReload: () => void;
  title: string;
  eyebrow: string;
  description?: ReactNode;
  mode: AnalyticsMode;
}) {
  const defaultDescription =
    mode === "oneauto" ? (
      <>
        Live-Statistik für beide Oneauto-API-Key-Instanzen (z. B.{" "}
        <span className="font-mono text-[11.5px] text-ink-700">e6dd0c88…ac31</span> und{" "}
        <span className="font-mono text-[11.5px] text-ink-700">e6dd0c88…9c76b</span>
        ) – auch über mehrere Analytics-Datasets hinweg additiv zusammengeführt.
      </>
    ) : (
      <>
        Live-Statistik:{" "}
        <span className="font-mono text-[12.5px] text-ink-700">
          key_analytics
        </span>{" "}
        und, falls <span className="font-mono text-[11px] text-ink-700">CF_*_2</span>{" "}
        gesetzt ist,{" "}
        <span className="font-mono text-[12.5px] text-ink-700">api_analytics</span>{" "}
        werden additiv zusammengeführt. Anfragen mit Key{" "}
        <span className="font-mono text-[12px] text-ink-700">anonymous</span> und
        alle Oneauto-Key-Instanzen sind herausgefiltert.
      </>
    );

  return (
    <header className="mb-8 border-b border-hair pb-6">
      <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-ink-400">
        {eyebrow}
      </p>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-[34px] leading-[1.05] tracking-tighter2 text-ink-900">
            {title}
          </h1>
          <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-ink-500">
            {description ?? defaultDescription}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onReload}
            title="Aktualisieren"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-hair bg-white text-ink-500 transition-colors hover:border-ink-300 hover:text-ink-800"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <RangeBar range={range} onChange={onRange} />
    </header>
  );
}

function RangeBar({
  range,
  onChange,
}: {
  range: Range;
  onChange: (r: Range) => void;
}) {
  const [showCustom, setShowCustom] = useState(range.preset === "custom");

  return (
    <div className="mt-5 flex flex-wrap items-center gap-2">
      <div className="inline-flex overflow-hidden rounded-md border border-hair bg-white">
        {PRESETS.map((p, i) => {
          const active = range.preset === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setShowCustom(false);
                onChange(rangeFromPreset(p.id));
              }}
              className={`px-3 py-1.5 text-[12px] transition-colors ${
                active
                  ? "bg-ink-900 text-white"
                  : "text-ink-600 hover:bg-ink-50"
              } ${i > 0 ? "border-l border-hair" : ""}`}
            >
              {p.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setShowCustom((v) => !v)}
          className={`border-l border-hair px-3 py-1.5 text-[12px] transition-colors ${
            range.preset === "custom" || showCustom
              ? "bg-ink-900 text-white"
              : "text-ink-600 hover:bg-ink-50"
          }`}
        >
          Custom
        </button>
      </div>
      {showCustom && (
        <CustomRange range={range} onChange={onChange} />
      )}
      <span className="ml-auto text-[11.5px] text-ink-400">
        {range.from} → {range.to} (UTC)
      </span>
    </div>
  );
}

function CustomRange({
  range,
  onChange,
}: {
  range: Range;
  onChange: (r: Range) => void;
}) {
  const fromInput = aeToInputLocal(range.from);
  const toInput = aeToInputLocal(range.to);

  function update(part: "from" | "to") {
    return (e: ChangeEvent<HTMLInputElement>) => {
      const local = e.target.value;
      const ae = inputLocalToAe(local);
      if (!ae) return;
      onChange({
        ...range,
        preset: "custom",
        from: part === "from" ? ae : range.from,
        to: part === "to" ? ae : range.to,
      });
    };
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="datetime-local"
        value={fromInput}
        onChange={update("from")}
        className="rounded-md border border-hair bg-white px-2 py-1 text-[12px] text-ink-700 focus:border-ink-400 focus:outline-none"
      />
      <span className="text-ink-400">–</span>
      <input
        type="datetime-local"
        value={toInput}
        onChange={update("to")}
        className="rounded-md border border-hair bg-white px-2 py-1 text-[12px] text-ink-700 focus:border-ink-400 focus:outline-none"
      />
    </div>
  );
}

function aeToInputLocal(ae: string): string {
  // ae = "YYYY-MM-DD HH:MM:SS" (UTC) → local "YYYY-MM-DDTHH:MM"
  try {
    const d = aeTimestampToDate(ae);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return "";
  }
}

function inputLocalToAe(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  if (isNaN(d.getTime())) return null;
  return toAeTimestamp(d);
}

// ---------- KPI ----------

function KpiGrid({
  row,
  loading,
}: {
  row?: OverviewRow;
  loading: boolean;
}) {
  const total = row?.requests ?? 0;
  const ok = row?.okRequests ?? 0;
  const err = row?.errRequests ?? 0;
  const views = row?.viewRequests ?? 0;
  const viewsOk = row?.viewOkRequests ?? 0;
  const successRate =
    total > 0 ? Math.round((ok / total) * 1000) / 10 : null;
  const viewShare =
    total > 0 ? Math.round((views / total) * 1000) / 10 : null;

  return (
    <div className="mb-12 grid grid-cols-1 divide-y divide-hair border-y border-hair sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-5">
      <KpiTile
        label="Anfragen gesamt"
        value={loading ? "…" : fmtNumber(total)}
        sub="im Zeitraum"
      />
      <KpiTile
        label="Bild-Views"
        value={loading ? "…" : fmtNumber(views)}
        sub={
          loading
            ? ""
            : viewShare != null
              ? `${fmtNumber(viewShare)} % aller Anfragen · ${fmtNumber(viewsOk)} ok`
              : `${fmtNumber(viewsOk)} ok`
        }
        tone={views > 0 ? "ok" : "neutral"}
      />
      <KpiTile
        label="Aktive Kunden-Keys"
        value={loading ? "…" : fmtNumber(row?.uniqueKeys)}
        sub="unique"
      />
      <KpiTile
        label="Erfolgsrate"
        value={
          loading
            ? "…"
            : successRate != null
              ? `${fmtNumber(successRate)} %`
              : "–"
        }
        sub={loading ? "" : `${fmtNumber(ok)} ok`}
        tone={
          successRate == null ? "neutral" : successRate >= 99 ? "ok" : successRate >= 90 ? "warn" : "err"
        }
      />
      <KpiTile
        label="Fehlerrequests"
        value={loading ? "…" : fmtNumber(err)}
        sub={loading ? "" : `${fmtNumber(total - ok - err)} sonst.`}
        tone={err > 0 ? "warn" : "ok"}
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
      <p className="mt-3 font-display text-[40px] leading-none tracking-tighter2 text-ink-900">
        {value}
      </p>
      {sub && (
        <p className={`mt-3 text-[12px] font-medium ${subColor}`}>{sub}</p>
      )}
    </div>
  );
}

// ---------- Sections ----------

function Section({
  title,
  meta,
  legend,
  children,
}: {
  title: string;
  meta?: string;
  legend?: { color: string; label: string }[];
  children: ReactNode;
}) {
  return (
    <section className="border-t border-hair pt-10 pb-12 first-of-type:border-t-0 first-of-type:pt-0">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-[20px] tracking-tightish text-ink-900">
            {title}
          </h2>
          {meta && (
            <p className="mt-1 text-[12px] text-ink-400">{meta}</p>
          )}
        </div>
        {legend && (
          <div className="flex flex-wrap items-center gap-4 text-[11.5px] text-ink-500">
            {legend.map((it) => (
              <span key={it.label} className="inline-flex items-center gap-1.5">
                <span
                  className="h-1.5 w-3 rounded-full"
                  style={{ background: it.color }}
                />
                {it.label}
              </span>
            ))}
          </div>
        )}
      </div>
      {children}
    </section>
  );
}

function SubSection({
  title,
  meta,
  className,
  children,
}: {
  title: string;
  meta?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <div className="mb-4">
        <h3 className="font-display text-[16px] tracking-tightish text-ink-900">
          {title}
        </h3>
        {meta && <p className="mt-0.5 text-[11.5px] text-ink-400">{meta}</p>}
      </div>
      {children}
    </div>
  );
}

// ---------- Diagnose-Panel ----------

type DiagBlock = {
  ok: boolean;
  binding?: string;
  dataset?: string;
  accountId: {
    present: boolean;
    masked: string | null;
    valid: boolean;
    error: string | null;
  };
  token: { present: boolean; length: number };
  endpoint: string | null;
  test?: {
    status: number;
    cfRay: string | null;
    bodyPreview: string;
    rowsReturned?: number;
  };
  hint?: string;
  error?: string;
};

type MergedDiagResp = {
  ok: boolean;
  mergedSources?: string[];
  error?: string;
  primary?: DiagBlock;
  secondary?: DiagBlock | null;
};

function DiagPanel({ autoOpen }: { autoOpen?: boolean }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<MergedDiagResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [autoTriggered, setAutoTriggered] = useState(false);

  async function run() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/analytics/_diag", {
        credentials: "include",
      });
      const j = (await res.json().catch(() => ({}))) as MergedDiagResp;
      setData(j);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (autoOpen && !autoTriggered) {
      setAutoTriggered(true);
      setOpen(true);
      run();
    }
  }, [autoOpen, autoTriggered]);

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => {
            const next = !open;
            setOpen(next);
            if (next && !data && !loading) run();
          }}
          className="inline-flex items-center gap-1.5 rounded-md border border-hair bg-white px-2.5 py-1.5 text-[11.5px] font-medium text-ink-600 transition-colors hover:border-ink-300 hover:text-ink-900"
        >
          <Stethoscope className="h-3.5 w-3.5" />
          {open ? "Diagnose schließen" : "Verbindung diagnostizieren"}
        </button>
        {open && (
          <button
            type="button"
            onClick={run}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-md border border-hair bg-white px-2.5 py-1.5 text-[11.5px] font-medium text-ink-600 transition-colors hover:border-ink-300 hover:text-ink-900 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
            />
            Erneut prüfen
          </button>
        )}
      </div>

      {open && (
        <div className="mt-3 rounded-md border border-hair bg-white p-4">
          {loading && (
            <p className="text-[12.5px] text-ink-500">
              Prüfe Cloudflare-API …
            </p>
          )}
          {err && (
            <p className="text-[12.5px] text-accent-rose">
              Diagnose fehlgeschlagen: {err}
            </p>
          )}
          {data && (
            <div className="space-y-6">
              {data.error && !data.primary && (
                <div className="rounded border border-accent-rose/40 bg-accent-rose/[0.06] px-3 py-2 text-[12.5px] text-accent-rose">
                  {data.error}
                </div>
              )}
              {data.mergedSources && data.mergedSources.length > 0 && (
                <p className="text-[12px] text-ink-500">
                  Zusammengeführte Datasets:{" "}
                  <span className="font-mono text-ink-700">
                    {data.mergedSources.join(" + ")}
                  </span>
                </p>
              )}
              {data.primary && (
                <DiagSourceBlock
                  title="Primär (CF_ACCOUNT_ID / key_analytics)"
                  idLabel="CF_ACCOUNT_ID"
                  tokenLabel="CF_API_TOKEN"
                  block={data.primary}
                />
              )}
              {data.secondary && (
                <DiagSourceBlock
                  title="Sekundär (CF_*_2 / api_analytics)"
                  idLabel="CF_ACCOUNT_ID_2"
                  tokenLabel="CF_API_TOKEN_2"
                  block={data.secondary}
                />
              )}
              {data.ok && data.primary && (
                <div className="rounded border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-[12px] text-emerald-800">
                  Die konfigurierte(n) Quelle(n) sind prüfbar; die
                  Dashboard-Werte fassen alle Datasets zusammen.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DiagSourceBlock({
  title,
  idLabel,
  tokenLabel,
  block,
}: {
  title: string;
  idLabel: string;
  tokenLabel: string;
  block: DiagBlock;
}) {
  return (
    <div>
      <h4 className="mb-2 text-[12px] font-medium text-ink-700">{title}</h4>
      <div className="grid gap-3 text-[12.5px] sm:grid-cols-2">
        {block.dataset && (
          <DiagRow
            label="Binding / Dataset"
            ok
            value={`${block.binding ?? "–"} · ${block.dataset}`}
            mono
          />
        )}
        <DiagRow
          label={idLabel}
          ok={block.accountId.valid && block.accountId.present}
          value={
            block.accountId.present
              ? block.accountId.masked +
                (block.accountId.valid ? " (valide)" : " (invalide)")
              : "fehlt"
          }
          detail={block.accountId.error || undefined}
        />
        <DiagRow
          label={tokenLabel}
          ok={block.token.present}
          value={
            block.token.present
              ? `gesetzt (${block.token.length} Zeichen)`
              : "fehlt"
          }
        />
        <DiagRow
          label="API-Endpoint"
          ok={!!block.endpoint}
          value={block.endpoint || "–"}
          mono
        />
        {block.test && (
          <DiagRow
            label="Probe-Call (SELECT 1)"
            ok={block.test.status >= 200 && block.test.status < 300}
            value={`HTTP ${block.test.status}${
              block.test.cfRay ? ` · CF-Ray ${block.test.cfRay}` : ""
            }`}
            detail={
              block.test.bodyPreview
                ? `Body: ${block.test.bodyPreview}`
                : undefined
            }
            mono
          />
        )}
        {block.hint && (
          <div className="sm:col-span-2 rounded border border-amber-200 bg-amber-50/60 px-3 py-2 text-[12px] text-amber-900">
            Hinweis: {block.hint}
          </div>
        )}
        {block.error && (
          <div className="sm:col-span-2 rounded border border-accent-rose/40 bg-accent-rose/[0.06] px-3 py-2 text-[12px] text-accent-rose">
            {block.error}
          </div>
        )}
        {block.ok && !block.error && (
          <div className="sm:col-span-2 rounded border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-[12px] text-emerald-800">
            Verbindung zur Analytics Engine OK – Schema/Dataset und
            Permissions passen.
          </div>
        )}
      </div>
    </div>
  );
}

function DiagRow({
  label,
  value,
  ok,
  detail,
  mono,
}: {
  label: string;
  value: string;
  ok: boolean;
  detail?: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded border border-hair px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-400">
          {label}
        </span>
        <span
          className={`inline-flex h-1.5 w-1.5 rounded-full ${ok ? "bg-emerald-500" : "bg-accent-rose"}`}
          aria-hidden
        />
      </div>
      <span
        className={`break-all text-ink-800 ${mono ? "font-mono text-[11.5px]" : ""}`}
      >
        {value}
      </span>
      {detail && (
        <span className="break-all text-[11.5px] text-ink-500">{detail}</span>
      )}
    </div>
  );
}

function ErrorBanner({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <div className="mb-8 flex items-start gap-2.5 border-l-2 border-accent-rose bg-accent-rose/[0.06] px-3 py-2 text-[12.5px]">
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-rose" />
      <span className="text-ink-700">{msg}</span>
    </div>
  );
}

// ---------- Charts ----------

function TimeChart({
  data,
  loading,
}: {
  data: TimeseriesPoint[];
  loading: boolean;
}) {
  if (loading && data.length === 0) {
    return <ChartSkeleton h={280} />;
  }
  if (data.length === 0) {
    return <EmptyChart h={280} text="Keine Daten im gewählten Zeitraum." />;
  }
  const formatted = data.map((d) => ({
    ...d,
    bucketLabel: fmtDateTime(d.bucket),
  }));
  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={formatted}
          margin={{ top: 5, right: 0, bottom: 0, left: -10 }}
        >
          <defs>
            <linearGradient id="okGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#5a3df0" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#5a3df0" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="errGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ff5d8f" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#ff5d8f" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#ececea" strokeDasharray="3 3" />
          <XAxis
            dataKey="bucketLabel"
            stroke="#8b8b86"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            minTickGap={24}
          />
          <YAxis
            stroke="#8b8b86"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => fmtCompact(v)}
            width={42}
          />
          <Tooltip content={<TimeTooltip />} />
          <Legend wrapperStyle={{ display: "none" }} />
          <Area
            type="monotone"
            dataKey="ok"
            stroke="#5a3df0"
            strokeWidth={1.6}
            fill="url(#okGrad)"
            name="Erfolgreich"
            stackId="1"
          />
          <Area
            type="monotone"
            dataKey="err"
            stroke="#ff5d8f"
            strokeWidth={1.4}
            fill="url(#errGrad)"
            name="Fehler"
            stackId="1"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

type TimeTooltipPayload = {
  payload: TimeseriesPoint & { bucketLabel: string };
};

function TimeTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TimeTooltipPayload[];
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-md border border-hair bg-white px-3 py-2 text-[12px] shadow-sm">
      <p className="text-ink-500">{p.bucketLabel}</p>
      <p className="mt-1">
        <span className="text-ink-900 font-medium">
          {fmtNumber(p.requests)}
        </span>{" "}
        <span className="text-ink-400">Anfragen</span>
      </p>
      <p className="text-[11px] text-ink-500">
        <span className="text-brand-600">{fmtNumber(p.ok)} ok</span>
        {" · "}
        <span className="text-accent-rose">{fmtNumber(p.err)} err</span>
        {" · "}
        <span className="text-ink-500">{fmtNumber(p.keys)} keys</span>
      </p>
    </div>
  );
}

function TopBarsChart({
  data,
  color,
  loading,
}: {
  data: { label: string; value: number }[];
  color: string;
  loading: boolean;
}) {
  if (loading && data.length === 0) return <ChartSkeleton h={220} />;
  if (data.length === 0) return <EmptyChart h={220} text="Keine Daten." />;
  return (
    <div className="h-[240px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 5, right: 8, bottom: 0, left: 0 }}
        >
          <CartesianGrid stroke="#ececea" horizontal={false} />
          <XAxis
            type="number"
            stroke="#8b8b86"
            fontSize={11}
            tickFormatter={(v: number) => fmtCompact(v)}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            type="category"
            dataKey="label"
            stroke="#48484a"
            fontSize={11.5}
            tickLine={false}
            axisLine={false}
            width={120}
          />
          <Tooltip
            cursor={{ fill: "rgba(13,13,15,0.04)" }}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <div className="rounded-md border border-hair bg-white px-3 py-1.5 text-[12px] shadow-sm">
                  <span className="text-ink-700 font-medium">
                    {payload[0].payload.label}
                  </span>{" "}
                  <span className="text-ink-400">
                    · {fmtNumber(payload[0].value as number)}
                  </span>
                </div>
              ) : null
            }
          />
          <Bar dataKey="value" fill={color} radius={[0, 3, 3, 0]} barSize={14} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function StatusDonut({
  data,
  loading,
}: {
  data: StatusCount[];
  loading: boolean;
}) {
  if (loading && data.length === 0) return <ChartSkeleton h={220} />;
  if (data.length === 0) return <EmptyChart h={220} text="Keine Daten." />;

  const COLORS: Record<string, string> = {
    ok: "#5a3df0",
    warn: "#f7b955",
    err: "#ff5d8f",
  };
  const total = data.reduce((s, d) => s + d.requests, 0);
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-3">
      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="requests"
              nameKey="status"
              innerRadius={55}
              outerRadius={85}
              paddingAngle={2}
              stroke="none"
            >
              {data.map((d, i) => (
                <Cell
                  key={i}
                  fill={COLORS[statusClass(d.status)]}
                />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <div className="rounded-md border border-hair bg-white px-3 py-1.5 text-[12px] shadow-sm">
                    <span className="font-medium text-ink-700">
                      HTTP {payload[0].payload.status}
                    </span>{" "}
                    <span className="text-ink-400">
                      · {fmtNumber(payload[0].value as number)}
                    </span>
                  </div>
                ) : null
              }
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="space-y-1.5 text-[12px]">
        {data.map((d) => {
          const pct = total > 0 ? (d.requests / total) * 100 : 0;
          return (
            <li key={d.status} className="flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: COLORS[statusClass(d.status)] }}
              />
              <span className="font-mono text-ink-700">{d.status}</span>
              <span className="text-ink-400">
                {fmtNumber(d.requests)} ·{" "}
                {pct.toFixed(pct >= 10 ? 0 : 1)}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function TopModelsList({
  rows,
  loading,
}: {
  rows: TopModel[];
  loading: boolean;
}) {
  if (loading && rows.length === 0) return <ChartSkeleton h={220} />;
  if (rows.length === 0) return <EmptyChart h={220} text="Keine Daten." />;
  const max = Math.max(...rows.map((r) => r.requests), 1);
  return (
    <ul className="divide-y divide-hair">
      {rows.map((r, i) => (
        <li key={i} className="grid grid-cols-[1fr_auto] gap-3 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-[13px] text-ink-800">
              <span className="font-medium">{r.brand}</span>{" "}
              <span className="text-ink-400">·</span> {r.model}
            </p>
            <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-ink-50">
              <div
                className="h-full rounded-full bg-brand-500"
                style={{ width: `${(r.requests / max) * 100}%` }}
              />
            </div>
          </div>
          <div className="self-center text-right text-[12.5px] tabular-nums text-ink-700">
            {fmtNumber(r.requests)}
          </div>
        </li>
      ))}
    </ul>
  );
}

function TopViewsGrid({
  rows,
  loading,
}: {
  rows: TopView[];
  loading: boolean;
}) {
  if (loading && rows.length === 0) return <ChartSkeleton h={220} />;
  if (rows.length === 0)
    return <EmptyChart h={220} text="Keine Bild-Views im gewählten Zeitraum." />;
  const max = Math.max(...rows.map((r) => r.requests), 1);
  return (
    <div className="grid grid-cols-1 gap-x-8 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((r, i) => {
        const okShare =
          r.requests > 0 ? Math.round((r.ok / r.requests) * 100) : 0;
        return (
          <div key={i} className="grid grid-cols-[1fr_auto] gap-3 py-1.5">
            <div className="min-w-0">
              <div className="flex items-baseline justify-between gap-3">
                <p className="truncate text-[13px] text-ink-800">
                  <span className="font-mono text-[12.5px] text-ink-900">
                    {r.view}
                  </span>
                </p>
                <span className="shrink-0 text-[11px] tabular-nums text-ink-400">
                  {okShare}% ok · {fmtNumber(r.keys)} Keys
                </span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-ink-50">
                <div
                  className="h-full rounded-full bg-brand-500"
                  style={{ width: `${(r.requests / max) * 100}%` }}
                />
              </div>
            </div>
            <div className="self-center text-right text-[12.5px] tabular-nums text-ink-700">
              {fmtNumber(r.requests)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------- Tables ----------

function TopKeysTable({
  rows,
  loading,
  onOpen,
}: {
  rows: TopKey[];
  loading: boolean;
  onOpen: (k: string) => void;
}) {
  if (loading && rows.length === 0) return <TableSkeleton rows={6} />;
  if (rows.length === 0)
    return (
      <div className="border-y border-hair px-4 py-12 text-center text-[13px] text-ink-500">
        Keine Kunden-Keys im gewählten Zeitraum.
      </div>
    );
  return (
    <div className="overflow-x-auto border-y border-hair">
      <table className="min-w-full text-[12.5px]">
        <thead className="bg-paper text-ink-500">
          <tr>
            <Th>Key</Th>
            <Th align="right">Anfragen</Th>
            <Th align="right">OK</Th>
            <Th align="right">Fehler</Th>
            <Th align="right">Marken</Th>
            <Th align="right">Letzte Nutzung</Th>
            <Th />
          </tr>
        </thead>
        <tbody className="divide-y divide-hair">
          {rows.map((r) => (
            <tr key={r.keyId} className="hover:bg-ink-50/40">
              <Td>
                <KeyChip id={r.keyId} />
              </Td>
              <Td align="right" className="font-medium text-ink-900">
                {fmtNumber(r.requests)}
              </Td>
              <Td align="right" className="text-brand-700">
                {fmtNumber(r.ok)}
              </Td>
              <Td
                align="right"
                className={r.err > 0 ? "text-accent-rose" : "text-ink-400"}
              >
                {fmtNumber(r.err)}
              </Td>
              <Td align="right">{fmtNumber(r.brands)}</Td>
              <Td align="right" className="text-ink-500">
                {fmtRelative(r.lastSeen)}
              </Td>
              <Td align="right">
                <button
                  type="button"
                  onClick={() => onOpen(r.keyId)}
                  className="rounded-md border border-hair px-2 py-1 text-[11.5px] text-ink-600 hover:border-ink-300 hover:text-ink-900"
                >
                  Details
                </button>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TopPathsTable({
  rows,
  loading,
}: {
  rows: TopPath[];
  loading: boolean;
}) {
  if (loading && rows.length === 0) return <TableSkeleton rows={5} />;
  if (rows.length === 0)
    return (
      <div className="border-y border-hair px-4 py-12 text-center text-[13px] text-ink-500">
        Keine Daten.
      </div>
    );
  return (
    <div className="overflow-x-auto border-y border-hair">
      <table className="min-w-full text-[12.5px]">
        <thead className="bg-paper text-ink-500">
          <tr>
            <Th>Pfad</Th>
            <Th>Marke</Th>
            <Th>Modell</Th>
            <Th>Jahr</Th>
            <Th>Variante</Th>
            <Th>Trim</Th>
            <Th>Ansicht</Th>
            <Th align="right">Anfragen</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-hair">
          {rows.map((r, i) => {
            const p = parsePath(r.path);
            return (
              <tr key={i} className="hover:bg-ink-50/40">
                <Td>
                  <code className="font-mono text-[11.5px] text-ink-700">
                    {r.path}
                  </code>
                </Td>
                <Td>{p.brand || "–"}</Td>
                <Td>{p.model || "–"}</Td>
                <Td>{p.year || "–"}</Td>
                <Td>{p.variant || "–"}</Td>
                <Td>{p.trim || "–"}</Td>
                <Td>{p.view || "–"}</Td>
                <Td align="right" className="font-medium text-ink-900">
                  {fmtNumber(r.requests)}
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RecentTable({
  rows,
  loading,
  onOpenKey,
}: {
  rows: RecentRow[];
  loading: boolean;
  onOpenKey: (k: string) => void;
}) {
  const { emailByKey, testByKey } = useContext(KeyCustomerContext);
  const [sortAsc, setSortAsc] = useState(false);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "ok" | "err">(
    "all",
  );

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    let out = rows.filter((r) => {
      if (statusFilter === "ok" && r.status >= 400) return false;
      if (statusFilter === "err" && r.status < 400) return false;
      if (!term) return true;
      const email = lookupKeyEmail(emailByKey, testByKey, r.keyId);
      const c = lookupKeyCustomer(emailByKey, testByKey, r.keyId);
      return (
        r.keyId.toLowerCase().includes(term) ||
        (email && email.toLowerCase().includes(term)) ||
        r.path.toLowerCase().includes(term) ||
        r.brand?.toLowerCase().includes(term) ||
        r.model?.toLowerCase().includes(term) ||
        r.action?.toLowerCase().includes(term) ||
        (term === "test" && c.resolved && c.isTestKey) ||
        (term === "kunde" && c.resolved && !c.isTestKey)
      );
    });
    out = [...out].sort((a, b) => {
      const ta = aeTimestampToDate(a.timestamp).getTime();
      const tb = aeTimestampToDate(b.timestamp).getTime();
      return sortAsc ? ta - tb : tb - ta;
    });
    return out;
  }, [rows, sortAsc, q, statusFilter, emailByKey, testByKey]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-[420px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
          <input
            type="search"
            placeholder="E-Mail, Key, Pfad, Marke, Action…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full rounded-md border border-hair bg-white py-1.5 pl-8 pr-3 text-[12.5px] text-ink-800 placeholder:text-ink-400 focus:border-ink-400 focus:outline-none"
          />
        </div>
        <SegFilter
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { id: "all", label: "Alle" },
            { id: "ok", label: "Erfolgreich" },
            { id: "err", label: "Fehler" },
          ]}
        />
        <span className="ml-auto text-[11.5px] text-ink-400">
          {fmtNumber(filtered.length)} / {fmtNumber(rows.length)} Zeilen
        </span>
      </div>

      {loading && rows.length === 0 ? (
        <TableSkeleton rows={8} />
      ) : filtered.length === 0 ? (
        <div className="border-y border-hair px-4 py-12 text-center text-[13px] text-ink-500">
          Keine Treffer.
        </div>
      ) : (
        <div className="overflow-x-auto border-y border-hair">
          <table className="min-w-full text-[12.5px]">
            <thead className="bg-paper text-ink-500">
              <tr>
                <Th>
                  <button
                    type="button"
                    onClick={() => setSortAsc((v) => !v)}
                    className="inline-flex items-center gap-1 hover:text-ink-800"
                  >
                    Zeit
                    {sortAsc ? (
                      <ArrowUpAZ className="h-3 w-3" />
                    ) : (
                      <ArrowDownAZ className="h-3 w-3" />
                    )}
                  </button>
                </Th>
                <Th>Key</Th>
                <Th>Marke</Th>
                <Th>Modell</Th>
                <Th>Action</Th>
                <Th>Pfad</Th>
                <Th align="right">Status</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hair">
              {filtered.map((r, i) => (
                <tr key={i} className="hover:bg-ink-50/40">
                  <Td className="whitespace-nowrap text-ink-500">
                    {fmtDateTime(r.timestamp)}
                  </Td>
                  <Td>
                    <button
                      type="button"
                      onClick={() => onOpenKey(r.keyId)}
                      className="text-left"
                    >
                      <KeyChip id={r.keyId} interactive />
                    </button>
                  </Td>
                  <Td>{r.brand && r.brand !== "NA" ? r.brand : "–"}</Td>
                  <Td>{r.model && r.model !== "NA" ? r.model : "–"}</Td>
                  <Td>
                    <code className="font-mono text-[11.5px] text-ink-700">
                      {r.action || "–"}
                    </code>
                  </Td>
                  <Td>
                    <code className="font-mono text-[11.5px] text-ink-700">
                      {r.path}
                    </code>
                  </Td>
                  <Td align="right">
                    <StatusBadge code={r.status} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SegFilter<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { id: T; label: string }[];
}) {
  return (
    <div className="inline-flex overflow-hidden rounded-md border border-hair bg-white">
      {options.map((o, i) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            className={`px-2.5 py-1.5 text-[12px] transition-colors ${
              active ? "bg-ink-900 text-white" : "text-ink-600 hover:bg-ink-50"
            } ${i > 0 ? "border-l border-hair" : ""}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function StatusBadge({ code }: { code: number }) {
  const klass = statusClass(code);
  const cls =
    klass === "ok"
      ? "bg-brand-50 text-brand-700 ring-brand-100"
      : klass === "warn"
        ? "bg-accent-amber/10 text-ink-700 ring-accent-amber/30"
        : "bg-accent-rose/10 text-accent-rose ring-accent-rose/20";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[11px] ring-1 ring-inset ${cls}`}
    >
      {klass === "ok" ? (
        <CheckCircle2 className="h-3 w-3" />
      ) : (
        <AlertCircle className="h-3 w-3" />
      )}
      {code}
    </span>
  );
}

function KeyCustomerTypeBadge({ isTest, show }: { isTest: boolean; show: boolean }) {
  if (!show) return null;
  return isTest ? (
    <span
      className="shrink-0 text-[9.5px] font-medium uppercase tracking-wider text-accent-amber"
      title="Kundentest-Key (Plan mit „test“ im Namen/ID)"
    >
      TEST
    </span>
  ) : (
    <span
      className="shrink-0 text-[9.5px] font-medium uppercase tracking-wider text-ink-500"
      title="Produktionskunde (kein Kundentest-Plan)"
    >
      KUNDE
    </span>
  );
}

function KeyChip({
  id,
  interactive = false,
}: {
  id: string;
  interactive?: boolean;
}) {
  const { email, resolved, isTestKey } = useKeyCustomerInfo(id);
  const short = id.length > 22 ? `${id.slice(0, 8)}…${id.slice(-6)}` : id;
  const ring = `ring-1 ring-inset ring-hair ${
    interactive ? "hover:bg-ink-50" : "bg-paper"
  }`;

  // Email vorhanden → Email in Sans-Serif, Key als Tooltip; sonst Key wie zuvor.
  if (email) {
    return (
      <span
        title={id}
        className={`inline-flex max-w-[min(280px,100%)] min-w-0 items-center gap-1.5 rounded px-1.5 py-0.5 text-[11.5px] ${ring}`}
      >
        <span className="min-w-0 truncate text-ink-800">{email}</span>
        <KeyCustomerTypeBadge isTest={isTestKey} show={resolved} />
      </span>
    );
  }
  return (
    <span
      title={id}
      className={`inline-flex max-w-[min(280px,100%)] min-w-0 items-center gap-1.5 rounded px-1.5 py-0.5 font-mono text-[11.5px] ${ring}`}
    >
      <span className="min-w-0 truncate">{short}</span>
      <KeyCustomerTypeBadge isTest={isTestKey} show={resolved} />
    </span>
  );
}

function Th({
  children,
  align,
}: {
  children?: ReactNode;
  align?: "right";
}) {
  return (
    <th
      className={`whitespace-nowrap px-3 py-2 text-[10.5px] font-medium uppercase tracking-[0.14em] ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align,
  className = "",
}: {
  children?: ReactNode;
  align?: "right";
  className?: string;
}) {
  return (
    <td
      className={`px-3 py-2 ${
        align === "right" ? "text-right" : "text-left"
      } ${className}`}
    >
      {children}
    </td>
  );
}

// ---------- Skeletons ----------

function ChartSkeleton({ h }: { h: number }) {
  return (
    <div
      className="w-full animate-pulse rounded-md border border-hair bg-paper"
      style={{ height: h }}
    />
  );
}
function EmptyChart({ h, text }: { h: number; text: string }) {
  return (
    <div
      className="grid w-full place-items-center rounded-md border border-dashed border-hair text-[12.5px] text-ink-400"
      style={{ height: h }}
    >
      {text}
    </div>
  );
}
function TableSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-1.5">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-7 w-full animate-pulse rounded-sm bg-ink-50"
        />
      ))}
    </div>
  );
}

function labelForBucket(b: "minute" | "hour" | "day"): string {
  if (b === "minute") return "5 Minuten";
  if (b === "hour") return "Stunde";
  return "Tag";
}

// ---------- Drilldown Drawer ----------

function KeyDetailDrawer({
  keyId,
  range,
  mode,
  onClose,
}: {
  keyId: string;
  range: Range;
  mode: AnalyticsMode;
  onClose: () => void;
}) {
  const apiUrls = useMemo(() => makeApiUrls(mode), [mode]);
  const detail = useApi<KeyDetailResponse>(apiUrls.keyDetail(range, keyId));
  const { email, resolved, isTestKey } = useKeyCustomerInfo(keyId);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex"
      role="dialog"
      aria-modal="true"
      aria-label="Key Details"
    >
      <button
        type="button"
        aria-label="Schließen"
        onClick={onClose}
        className="flex-1 cursor-default bg-night-900/40 backdrop-blur-sm"
      />
      <aside className="flex w-full max-w-[720px] flex-col overflow-hidden bg-paper shadow-2xl animate-[drawerIn_0.22s_ease-out]">
        <div className="flex items-start justify-between gap-4 border-b border-hair px-6 py-4">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-[10.5px] font-medium uppercase tracking-[0.18em] text-ink-400">
              {email ? "Kunde" : "Kunden-Key"}
              <KeyCustomerTypeBadge isTest={isTestKey} show={resolved} />
            </p>
            <p
              className="mt-1 truncate text-[15px] text-ink-900"
              title={keyId}
            >
              {email ?? <span className="font-mono text-[13.5px]">{keyId}</span>}
            </p>
            {email && (
              <p
                className="mt-0.5 truncate font-mono text-[11px] text-ink-400"
                title={keyId}
              >
                {keyId}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-md border border-hair text-ink-500 hover:text-ink-900"
            title="Schließen"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {detail.loading && !detail.data ? (
            <div className="space-y-4">
              <ChartSkeleton h={140} />
              <ChartSkeleton h={220} />
            </div>
          ) : detail.error ? (
            <ErrorBanner msg={detail.error} />
          ) : detail.data ? (
            <KeyDetailBody data={detail.data} />
          ) : null}
        </div>
      </aside>
      <style>{`
        @keyframes drawerIn {
          from { transform: translateX(20px); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function KeyDetailBody({ data }: { data: KeyDetailResponse }) {
  const r = data.row;
  const total = r.requests || 0;
  const ok = r.okRequests || 0;
  const err = r.errRequests || 0;
  const views = r.viewRequests || 0;
  const success = total > 0 ? Math.round((ok / total) * 1000) / 10 : null;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <MiniKpi label="Anfragen" value={fmtNumber(total)} />
        <MiniKpi
          label="Bild-Views"
          value={fmtNumber(views)}
          tone={views > 0 ? "ok" : "neutral"}
        />
        <MiniKpi
          label="Erfolgsrate"
          value={success != null ? `${fmtNumber(success)} %` : "–"}
          tone={
            success == null
              ? "neutral"
              : success >= 99
                ? "ok"
                : success >= 90
                  ? "warn"
                  : "err"
          }
        />
        <MiniKpi label="Fehler" value={fmtNumber(err)} tone={err > 0 ? "warn" : "ok"} />
        <MiniKpi label="Letzte Nutzung" value={fmtRelative(r.lastSeen)} />
      </div>

      <div className="mt-8">
        <h3 className="font-display text-[15px] tracking-tightish text-ink-900">
          Anfragen über Zeit
        </h3>
        <div className="mt-3">
          <TimeChart data={data.timeseries} loading={false} />
        </div>
      </div>

      <div className="mt-8 grid gap-8 sm:grid-cols-2">
        <div>
          <h3 className="font-display text-[14px] tracking-tightish text-ink-900">
            Top Marken
          </h3>
          <ul className="mt-3 divide-y divide-hair">
            {data.topBrands.map((b, i) => (
              <li
                key={i}
                className="flex items-center justify-between py-1.5 text-[12.5px]"
              >
                <span className="text-ink-800">{b.brand}</span>
                <span className="tabular-nums text-ink-500">
                  {fmtNumber(b.requests)}
                </span>
              </li>
            ))}
            {data.topBrands.length === 0 && (
              <li className="py-3 text-[12px] text-ink-400">Keine Daten.</li>
            )}
          </ul>
        </div>
        <div>
          <h3 className="font-display text-[14px] tracking-tightish text-ink-900">
            Top Endpoints
          </h3>
          <ul className="mt-3 divide-y divide-hair">
            {data.topActions.map((a, i) => (
              <li
                key={i}
                className="flex items-center justify-between py-1.5 text-[12.5px]"
              >
                <code className="font-mono text-[11.5px] text-ink-700">
                  {a.action}
                </code>
                <span className="tabular-nums text-ink-500">
                  {fmtNumber(a.requests)}
                </span>
              </li>
            ))}
            {data.topActions.length === 0 && (
              <li className="py-3 text-[12px] text-ink-400">Keine Daten.</li>
            )}
          </ul>
        </div>
      </div>

      <div className="mt-8">
        <h3 className="font-display text-[14px] tracking-tightish text-ink-900">
          Bild-Views dieses Keys
        </h3>
        {data.topViews.length === 0 ? (
          <p className="mt-3 text-[12.5px] text-ink-400">
            Dieser Key hat im Zeitraum keine echten Bild-Views (nur
            Metadaten-Calls) gemacht.
          </p>
        ) : (
          <ul className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
            {data.topViews.map((v, i) => {
              const max = Math.max(
                ...data.topViews.map((x) => x.requests),
                1,
              );
              return (
                <li key={i} className="py-1.5 text-[12.5px]">
                  <div className="flex items-baseline justify-between gap-3">
                    <code className="font-mono text-[11.5px] text-ink-800">
                      {v.view}
                    </code>
                    <span className="tabular-nums text-ink-500">
                      {fmtNumber(v.requests)}
                    </span>
                  </div>
                  <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-ink-50">
                    <div
                      className="h-full rounded-full bg-brand-500"
                      style={{ width: `${(v.requests / max) * 100}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="mt-8">
        <h3 className="font-display text-[14px] tracking-tightish text-ink-900">
          Häufigste Pfade
        </h3>
        <ul className="mt-3 divide-y divide-hair">
          {data.topPaths.map((p, i) => (
            <li
              key={i}
              className="flex items-center justify-between gap-3 py-1.5 text-[12.5px]"
            >
              <code
                className="truncate font-mono text-[11.5px] text-ink-700"
                title={p.path}
              >
                {p.path}
              </code>
              <span className="tabular-nums text-ink-500">
                {fmtNumber(p.requests)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-8">
        <h3 className="font-display text-[14px] tracking-tightish text-ink-900">
          Letzte Anfragen ({data.recent.length})
        </h3>
        <div className="mt-3 overflow-x-auto rounded-md border border-hair">
          <table className="min-w-full text-[12px]">
            <thead className="bg-paper text-ink-500">
              <tr>
                <Th>Zeit</Th>
                <Th>Action</Th>
                <Th>Pfad</Th>
                <Th align="right">Status</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hair">
              {data.recent.map((row, i) => (
                <tr key={i}>
                  <Td className="whitespace-nowrap text-ink-500">
                    {fmtDateTime(row.timestamp)}
                  </Td>
                  <Td>
                    <code className="font-mono text-[11px] text-ink-700">
                      {row.action || "–"}
                    </code>
                  </Td>
                  <Td>
                    <code className="font-mono text-[11px] text-ink-700">
                      {row.path}
                    </code>
                  </Td>
                  <Td align="right">
                    <StatusBadge code={row.status} />
                  </Td>
                </tr>
              ))}
              {data.recent.length === 0 && (
                <tr>
                  <Td>
                    <span className="text-ink-400">Keine Einträge.</span>
                  </Td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function MiniKpi({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "ok" | "warn" | "err";
}) {
  const valColor =
    tone === "ok"
      ? "text-accent-mint"
      : tone === "warn"
        ? "text-accent-amber"
        : tone === "err"
          ? "text-accent-rose"
          : "text-ink-900";
  return (
    <div className="rounded-md border border-hair bg-white px-3 py-2.5">
      <p className="text-[10.5px] uppercase tracking-[0.16em] text-ink-400">
        {label}
      </p>
      <p
        className={`mt-1.5 font-display text-[20px] tracking-tighter2 ${valColor}`}
      >
        {value}
      </p>
    </div>
  );
}
