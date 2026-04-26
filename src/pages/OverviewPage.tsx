import { ExternalLink, RefreshCw } from "lucide-react";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../components/ui/PageHeader";
import { controllingApiUrl, type ControllingResponse } from "../lib/controllingApi";
import {
  type OverviewRow,
  fmtCompact,
  fmtCurrency,
  fmtNumber,
  makeApiUrls,
  rangeCurrentMonthUtc,
  rangeFromPreset,
  rangeTodayUtc,
  reportsUrl,
  useApi,
  type OneautoReportsResponse,
} from "../lib/customerApi";
import {
  OVERVIEW_STATS_URL,
  type OverviewDwm,
  type OverviewStatsResponse,
} from "../lib/overviewStatsApi";

// ---------- Format (wie Controlling) ----------

function fmtHours(h: number | null | undefined): string {
  if (h == null || !Number.isFinite(h)) return "–";
  if (h <= 0) return "0";
  if (h < 1 / 60) return `${Math.round(h * 3600)} s`;
  if (h < 1) return `${Math.round(h * 60)} min`;
  if (h < 24) return `${h.toFixed(1)} h`;
  if (h < 24 * 14) return `${(h / 24).toFixed(1)} Tage`;
  return `${(h / (24 * 7)).toFixed(1)} Wo.`;
}

// ---------- Teilkarten ----------

function DwmBlock({
  title,
  d,
  hint,
  to,
}: {
  title: string;
  d: OverviewDwm;
  hint?: string;
  to: { day: string; week: string; month: string };
}) {
  return (
    <div className="rounded-xl border border-hair bg-paper p-4 shadow-sm">
      <h3 className="text-[12px] font-semibold text-ink-800">{title}</h3>
      {hint && (
        <p className="mt-0.5 text-[11px] text-ink-500">
          {hint}
        </p>
      )}
      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div>
          <dt className="text-[10px] font-medium uppercase tracking-wide text-ink-500">
            Heute
          </dt>
          <dd className="mt-0.5 text-lg font-semibold tabular-nums text-ink-900">
            <Link
              to={to.day}
              className="hover:text-ink-600 hover:underline"
            >
              {fmtNumber(d.day)}
            </Link>
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-medium uppercase tracking-wide text-ink-500">
            7 Tage
          </dt>
          <dd className="mt-0.5 text-lg font-semibold tabular-nums text-ink-900">
            <Link
              to={to.week}
              className="hover:text-ink-600 hover:underline"
            >
              {fmtNumber(d.week)}
            </Link>
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-medium uppercase tracking-wide text-ink-500">
            Monat
          </dt>
          <dd className="mt-0.5 text-lg font-semibold tabular-nums text-ink-900">
            <Link
              to={to.month}
              className="hover:text-ink-600 hover:underline"
            >
              {fmtNumber(d.month)}
            </Link>
          </dd>
        </div>
      </dl>
    </div>
  );
}

function CardShell({
  title,
  to,
  children,
  meta,
}: {
  title: string;
  to: string;
  children: ReactNode;
  meta?: string;
}) {
  return (
    <div className="rounded-xl border border-hair bg-paper p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-[12px] font-semibold text-ink-800">{title}</h3>
        <Link
          to={to}
          className="inline-flex shrink-0 items-center gap-0.5 text-[11px] text-ink-500 hover:text-ink-700"
        >
          <span>Öffnen</span>
          <ExternalLink className="h-3 w-3" aria-hidden />
        </Link>
      </div>
      {meta && (
        <p className="mt-0.5 text-[11px] text-ink-500">{meta}</p>
      )}
      <div className="mt-3">{children}</div>
    </div>
  );
}

type JobsResp = { total: number };

// ---------- Seite ----------

export default function OverviewPage() {
  const api = useMemo(() => makeApiUrls("customers"), []);
  const [reqUrls] = useState(() => ({
    day: api.overview(rangeTodayUtc()),
    week: api.overview(rangeFromPreset("7d")),
    month: api.overview(rangeCurrentMonthUtc()),
  }));
  const [cRange] = useState(() => rangeFromPreset("7d"));
  const controllingUrl = useMemo(
    () =>
      controllingApiUrl(cRange, {
        gapMinutes: 30,
        blob4: "nonempty",
        limit: 100_000,
      }),
    [cRange],
  );
  const oneautoUrl = useMemo(() => reportsUrl(12), []);
  const jobsUrl =
    "/api/intern-analytics/controll-jobs?check=0&limit=1" as const;

  const stat = useApi<OverviewStatsResponse>(OVERVIEW_STATS_URL);
  const reqD = useApi<{ row: OverviewRow }>(reqUrls.day);
  const reqW = useApi<{ row: OverviewRow }>(reqUrls.week);
  const reqM = useApi<{ row: OverviewRow }>(reqUrls.month);
  const oneauto = useApi<OneautoReportsResponse>(oneautoUrl);
  const ctrl = useApi<ControllingResponse>(controllingUrl);
  const jobs = useApi<JobsResp>(jobsUrl);

  const reloadAll = useCallback(() => {
    stat.reload();
    reqD.reload();
    reqW.reload();
    reqM.reload();
    oneauto.reload();
    ctrl.reload();
    jobs.reload();
  }, [stat, reqD, reqW, reqM, oneauto, ctrl, jobs]);

  const anyLoading =
    stat.loading ||
    reqD.loading ||
    reqW.loading ||
    reqM.loading ||
    oneauto.loading ||
    ctrl.loading ||
    jobs.loading;
  const anyError =
    stat.error ||
    reqD.error ||
    reqW.error ||
    reqM.error ||
    oneauto.error ||
    ctrl.error ||
    jobs.error;

  const thisMonthOa = oneauto.data?.months?.[0];

  return (
    <>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <PageHeader
          eyebrow="Dashboard"
          title="Übersicht"
          description="Aktuelle Kennzahlen zu Anfragen, API-Nutzung, Oneauto, Keys und Controlling."
        />
        <button
          type="button"
          onClick={reloadAll}
          disabled={anyLoading}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 self-start rounded-md border border-hair bg-white px-3 text-[12.5px] font-medium text-ink-700 transition-colors enabled:hover:bg-ink-50 disabled:opacity-50"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${anyLoading ? "animate-spin" : ""}`}
            aria-hidden
          />
          Aktualisieren
        </button>
      </div>

      {anyError && (
        <div
          className="mb-5 rounded-md border border-accent-amber/50 bg-accent-amber/[0.08] px-3 py-2 text-[12.5px] text-ink-700"
          role="status"
        >
          Mindestens eine Quelle liefert einen Fehler. Details pro Bereich
          unten.{" "}
          {[stat, reqD, reqW, reqM, oneauto, ctrl, jobs]
            .map((s) => s.error)
            .filter(Boolean)
            .join(" · ")}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {stat.data ? (
          <>
            <DwmBlock
              title="Anfragen (Website)"
              hint="Heute = UTC, Woche = 7 Tage rollierend, Monat = laufender Kalendermonat (UTC)"
              d={stat.data.website.submissions}
              to={{
                day: "/kunden/anfragen",
                week: "/kunden/anfragen",
                month: "/kunden/anfragen",
              }}
            />
            <DwmBlock
              title="Test-Anfragen"
              hint="Heute = UTC, Woche = 7 Tage rollierend, Monat = laufender Kalendermonat (UTC)"
              d={stat.data.website.trialSubmissions}
              to={{
                day: "/kunden/test-anfragen",
                week: "/kunden/test-anfragen",
                month: "/kunden/test-anfragen",
              }}
            />
            <DwmBlock
              title="Newsletter"
              hint="Heute = UTC, Woche = 7 Tage rollierend, Monat = laufender Kalendermonat (UTC)"
              d={stat.data.website.newsletter}
              to={{
                day: "/kunden/newsletter",
                week: "/kunden/newsletter",
                month: "/kunden/newsletter",
              }}
            />
          </>
        ) : stat.error ? (
          <div className="rounded-xl border border-accent-rose/30 bg-accent-rose/[0.06] p-4 text-[12.5px] text-accent-rose md:col-span-2 xl:col-span-3">
            Website-Statistiken: {stat.error}
          </div>
        ) : (
          <LoadingCard title="Anfragen / Test / Newsletter" />
        )}

        <CardShell
          title="Oneauto-Report (dieser Monat, Vorschau)"
          to="/analytics/oneauto-reports"
          meta="Abrechnung laufender Monat (siehe Tabelle Kunden-API-Reports)"
        >
          {oneauto.error && (
            <p className="text-[12.5px] text-accent-rose">{oneauto.error}</p>
          )}
          {oneauto.loading && !oneauto.data && (
            <p className="text-[12.5px] text-ink-500">Laden …</p>
          )}
          {thisMonthOa && (
            <div className="space-y-1.5 text-[13px]">
              <p>
                <span className="text-ink-500">Betrag: </span>
                <span className="font-semibold tabular-nums text-ink-900">
                  {fmtCurrency(thisMonthOa.eur, "EUR")}
                </span>
                <span className="text-ink-500"> · </span>
                {fmtCurrency(thisMonthOa.gbp, "GBP")}
              </p>
              <p className="text-[11.5px] text-ink-500">
                Views (Monat): {fmtNumber(thisMonthOa.views)} · Requests:{" "}
                {fmtCompact(thisMonthOa.requests)} ·{" "}
                {thisMonthOa.closed
                  ? "Monat abgeschlossen"
                  : "Laufender Monat (Vorschau)"}
                {thisMonthOa.fx?.date
                  ? ` · FX ${thisMonthOa.fx.source} ${thisMonthOa.fx.date}`
                  : null}
              </p>
            </div>
          )}
        </CardShell>

        <CardShell
          title="Kunden-API: Requests (alle Keys)"
          to="/analytics/kunden-api"
          meta="Heute = ab Mitternacht UTC, Woche = 7 Tage, Monat = Kalendermonat UTC"
        >
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-[10px] font-medium uppercase tracking-wide text-ink-500">
                Heute
              </div>
              <div className="mt-0.5 text-lg font-semibold tabular-nums">
                {reqD.error
                  ? "–"
                  : fmtNumber(reqD.data?.row?.requests ?? null)}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-medium uppercase tracking-wide text-ink-500">
                7 Tage
              </div>
              <div className="mt-0.5 text-lg font-semibold tabular-nums">
                {reqW.error
                  ? "–"
                  : fmtNumber(reqW.data?.row?.requests ?? null)}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-medium uppercase tracking-wide text-ink-500">
                Monat
              </div>
              <div className="mt-0.5 text-lg font-semibold tabular-nums">
                {reqM.error
                  ? "–"
                  : fmtNumber(reqM.data?.row?.requests ?? null)}
              </div>
            </div>
          </div>
        </CardShell>

        <CardShell
          title="Aktive Keys (KV)"
          to="/kunden/keys"
          meta="Produktiv = ohne Test-Plan, Test = Test-Plan-Name. Abgelaufene Keys (expires_at) zählen nicht."
        >
          {stat.data?.activeKeys == null ? (
            <p className="text-[12.5px] text-ink-500">
              {stat.loading
                ? "Laden …"
                : "Keine KV-Angabe (Binding `customer_keys`)."}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 text-center">
              <div>
                <div className="text-[10px] font-medium uppercase tracking-wide text-ink-500">
                  Produktiv
                </div>
                <div className="mt-0.5 text-xl font-semibold tabular-nums">
                  <Link
                    to="/kunden/keys"
                    className="hover:underline"
                  >
                    {fmtNumber(stat.data.activeKeys.productive)}
                  </Link>
                </div>
              </div>
              <div>
                <div className="text-[10px] font-medium uppercase tracking-wide text-ink-500">
                  Test-Keys
                </div>
                <div className="mt-0.5 text-xl font-semibold tabular-nums">
                  <Link
                    to="/kunden/test-keys"
                    className="hover:underline"
                  >
                    {fmtNumber(stat.data.activeKeys.test)}
                  </Link>
                </div>
              </div>
            </div>
          )}
        </CardShell>

        <CardShell
          title="Offene Controlling-Jobs"
          to="/intern-analytics/jobs"
          meta="Status „offen“ (check = 0)"
        >
          {jobs.error && (
            <p className="text-[12.5px] text-accent-rose">{jobs.error}</p>
          )}
          <p className="text-3xl font-semibold tabular-nums text-ink-900">
            {fmtNumber(jobs.data?.total ?? null)}
          </p>
        </CardShell>

        <div className="md:col-span-2 xl:col-span-1">
          <CardShell
            title="Voraussichtliche Bearbeitungszeit (Controlling)"
            to="/intern-analytics/controlling"
            meta="Basis letzte 7 Tage, Session-Gap 30 min, Zeilen nur mit blob4; global über alle Modi"
          >
            {ctrl.error && (
              <p className="text-[12.5px] text-accent-rose">{ctrl.error}</p>
            )}
            {ctrl.data && (
              <dl className="space-y-2 text-[13px]">
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-500">Ohne neuen Zufluss</dt>
                  <dd className="font-medium tabular-nums">
                    {fmtHours(ctrl.data.global.etaIfNoNewHours)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-500">Bei fortlaufendem Zufluss</dt>
                  <dd className="font-medium tabular-nums">
                    {fmtHours(ctrl.data.global.etaIfKeepsAddingHours)}
                  </dd>
                </div>
              </dl>
            )}
            {ctrl.loading && !ctrl.data && (
              <p className="text-[12.5px] text-ink-500">Laden …</p>
            )}
          </CardShell>
        </div>
      </div>
    </>
  );
}

function LoadingCard({ title }: { title: string }) {
  return (
    <div className="rounded-xl border border-dashed border-hair bg-ink-50/30 p-4 text-[12.5px] text-ink-500 md:col-span-2 xl:col-span-3">
      {title}: Daten werden geladen …
    </div>
  );
}
