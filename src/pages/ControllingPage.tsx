import { AlertCircle, BarChart2, Info, RefreshCw, Timer, Users } from "lucide-react";
import { useMemo, useState } from "react";
import PageHeader from "../components/ui/PageHeader";
import {
  type ControllingBlob4Mode,
  type ControllingResponse,
  type ControllingUserStats,
  type ControllingRawRow,
  controllingApiUrl,
} from "../lib/controllingApi";
import {
  PRESETS,
  type Range,
  fmtDateTime,
  fmtNumber,
  rangeFromPreset,
  useApi,
} from "../lib/customerApi";

function fmtDurationHours(h: number | null | undefined): string {
  if (h == null || Number.isNaN(h)) return "–";
  if (h <= 0) return "0";
  if (h < 1 / 60) return `${Math.round(h * 3600)} s`;
  if (h < 1) return `${Math.round(h * 60)} min`;
  if (h < 24) return `${h.toFixed(1)} h`;
  if (h < 168) return `${(h / 24).toFixed(1)} Tage`;
  return `${(h / 168).toFixed(1)} Wo.`;
}

function fmtSessionGap(sec: number | null | undefined): string {
  if (sec == null) return "–";
  if (sec < 60) return `${Math.round(sec)} s`;
  if (sec < 3600) return `${(sec / 60).toFixed(1)} min`;
  return `${(sec / 3600).toFixed(1)} h`;
}

function fmtUserLabel(s: ControllingRawRow): string {
  const b = [s.s_blob1, s.s_blob2].map((x) => x?.trim()).filter(Boolean);
  if (b.length) return b.join(" ");
  return [s.s_index1, s.s_index2]
    .map((x) => x?.trim())
    .filter(Boolean)
    .join(" ");
}

export default function ControllingPage() {
  const [range, setRange] = useState<Range>(() => rangeFromPreset("7d"));
  const [gapMinutes, setGapMinutes] = useState(5);
  const [blob4, setBlob4] = useState<ControllingBlob4Mode>("nonempty");

  const url = useMemo(
    () => controllingApiUrl(range, { gapMinutes, blob4, limit: 100_000 }),
    [range, gapMinutes, blob4],
  );

  const { data, error, loading, reload } = useApi<ControllingResponse>(url);

  return (
    <>
      <PageHeader
        eyebrow="Intern Analytics"
        title="Controlling"
        description={
          <>
            Wie Kunden-API:{" "}
            <code className="font-mono text-[12.5px] text-ink-700">
              FROM {data?.ae?.fromTable ?? "key_analytics"} WHERE dataset =&nbsp;
            </code>
            <code className="font-mono text-[12.5px] text-ink-700">
              {data?.dataset ?? "controll_platform_logs"}
            </code>
            . Auswertung nur, wenn{" "}
            <span className="font-mono">blob4</span> belegt ist (oder optional
            nur 32-stellige Keys). Sessions enden nach{" "}
            {gapMinutes} min Pause; Nutzeranzeige aus index1/2 bzw. blob1/2
            laut eurer Writer-Logik.
          </>
        }
        rightSlot={
          <button
            type="button"
            onClick={reload}
            title="Aktualisieren"
            className="inline-flex items-center gap-1.5 rounded-md border border-hair bg-white px-2.5 py-1.5 text-[12.5px] text-ink-600 shadow-sm transition hover:border-ink-200 hover:text-ink-900"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
            />
            Neu laden
          </button>
        }
        hideCalendarAndNotifications
      />

      <Toolbar
        range={range}
        onRange={setRange}
        gapMinutes={gapMinutes}
        onGap={setGapMinutes}
        blob4={blob4}
        onBlob4={setBlob4}
      />

      {error && (
        <div className="mb-6 flex items-start gap-2.5 border-l-2 border-accent-rose bg-accent-rose/[0.06] px-3 py-2.5 text-[12.5px]">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-rose" />
          <div className="min-w-0 text-ink-700">
            <p className="font-medium">Daten konnten nicht geladen werden</p>
            <p className="mt-0.5 whitespace-pre-wrap text-ink-600">{error}</p>
          </div>
        </div>
      )}

      {loading && !data && (
        <p className="text-[13px] text-ink-500">Lade Controlling…</p>
      )}

      {data && (
        <div className="space-y-10">
          {data.truncated && (
            <div className="flex items-start gap-2 rounded-md border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-[12.5px] text-amber-900">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Anzahl Zeilen an der oberen Grenze ({data.rowLimit}) – ggf.{" "}
                <strong>Zeitraum verkürzen</strong> oder <code>limit</code> in
                der API erhöhen.
              </span>
            </div>
          )}

          <section>
            <h2 className="mb-3 flex items-center gap-2 font-display text-lg text-ink-900">
              <BarChart2 className="h-4 w-4 text-brand-600" />
              Überblick
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi
                label="Ereignisse (Zeitraum)"
                value={fmtNumber(data.rangeRows)}
              />
              <Kpi
                label="Nutzer (mit Events)"
                value={fmtNumber(Object.keys(data.byUser).length)}
              />
              <Kpi
                label="blob4-Gruppen"
                value={fmtNumber(data.byBlob4.length)}
              />
              <Kpi
                label="Session-Pause (Regel)"
                value={`${data.sessionGapMinutes} min`}
              />
            </div>
            {data.meta?.beschreibung && (
              <p className="mt-2 max-w-4xl text-[12.5px] leading-relaxed text-ink-500">
                {data.meta.beschreibung}
              </p>
            )}
          </section>

          <section>
            <h2 className="mb-3 flex items-center gap-2 font-display text-lg text-ink-900">
              <Users className="h-4 w-4 text-brand-600" />
              Pro Benutzer
            </h2>
            <div className="space-y-6">
              {Object.values(data.byUser)
                .sort((a, b) => b.eventCount - a.eventCount)
                .map((u) => (
                  <UserBlock key={u.user} u={u} />
                ))}
            </div>
          </section>

          <section>
            <h2 className="mb-3 flex items-center gap-2 font-display text-lg text-ink-900">
              <Timer className="h-4 w-4 text-brand-600" />
              Pro blob4 (Kontext / Key)
            </h2>
            <div className="overflow-x-auto border border-hair rounded-lg">
              <table className="w-full min-w-[800px] border-collapse text-left text-[12.5px]">
                <thead>
                  <tr className="border-b border-hair bg-ink-50/60 text-[11px] font-medium uppercase tracking-wide text-ink-500">
                    <th className="px-3 py-2.5">blob4</th>
                    <th className="px-3 py-2.5">Nutzer</th>
                    <th className="px-3 py-2.5 text-right">offen (letzt)</th>
                    <th className="px-3 py-2.5 text-right">Gesamt (d3)</th>
                    <th className="px-3 py-2.5 text-right">Rate / h</th>
                    <th className="px-3 py-2.5 text-right">ETA</th>
                    <th className="px-3 py-2.5">Hinweis</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byBlob4.map((row) => (
                    <tr
                      key={row.blob4 + row.lastTs}
                      className="border-b border-hair/80 hover:bg-ink-50/40"
                    >
                      <td className="max-w-xs truncate px-3 py-2 font-mono text-[11px] text-ink-800">
                        {row.blob4 || "—"}
                      </td>
                      <td className="px-3 py-2 text-ink-700">
                        {row.users.join(", ")}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">
                        {row.latestOpen != null
                          ? fmtNumber(row.latestOpen)
                          : "–"}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">
                        {row.latestTotal != null
                          ? fmtNumber(row.latestTotal)
                          : "–"}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">
                        {row.forecast.ratePerHour != null
                          ? fmtNumber(row.forecast.ratePerHour, {
                              maximumFractionDigits: 2,
                            })
                          : "–"}
                      </td>
                      <td className="px-3 py-2 text-right text-ink-800">
                        {fmtDurationHours(row.forecast.etaHours)}
                      </td>
                      <td className="px-3 py-2 text-ink-500">
                        {row.forecast.basis}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="mb-3 font-display text-lg text-ink-900">
              Rohzeilen (letzte {data.rawTail.length})
            </h2>
            <div className="overflow-x-auto border border-hair rounded-lg">
              <table className="w-full min-w-[960px] border-collapse text-left text-[11px]">
                <thead>
                  <tr className="border-b border-hair bg-ink-50/60 text-ink-500">
                    <th className="px-2 py-2">Zeit (UTC)</th>
                    <th className="px-2 py-2">Nutzer</th>
                    <th className="px-2 py-2">Aktion (blob3)</th>
                    <th className="px-2 py-2">blob4</th>
                    <th className="px-2 py-2">blob5</th>
                    <th className="px-2 py-2 text-right">d2</th>
                    <th className="px-2 py-2 text-right">d3</th>
                    <th className="px-2 py-2 text-right">d4</th>
                    <th className="px-2 py-2 text-right">d5</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rawTail.map((r, i) => (
                    <tr
                      key={r.ts + i}
                      className="border-b border-hair/70 hover:bg-ink-50/30"
                    >
                      <td className="whitespace-nowrap px-2 py-1.5 text-ink-600">
                        {r.ts}
                      </td>
                      <td className="px-2 py-1.5 text-ink-800">
                        {fmtUserLabel(r)}
                      </td>
                      <td
                        className="max-w-[200px] truncate px-2 py-1.5 text-ink-700"
                        title={r.s_blob3}
                      >
                        {r.s_blob3}
                      </td>
                      <td
                        className="max-w-[200px] truncate font-mono px-2 py-1.5"
                        title={r.s_blob4}
                      >
                        {r.s_blob4}
                      </td>
                      <td
                        className="max-w-[160px] truncate font-mono px-2 py-1.5"
                        title={r.s_blob5}
                      >
                        {r.s_blob5}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {fmtNumber(r.d2)}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {fmtNumber(r.d3)}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {fmtNumber(r.d4)}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {fmtNumber(r.d5)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-hair bg-white px-3 py-2.5 shadow-sm">
      <p className="text-[10.5px] font-medium uppercase tracking-wide text-ink-400">
        {label}
      </p>
      <p className="mt-0.5 font-mono text-lg font-medium tabular-nums text-ink-900">
        {value}
      </p>
    </div>
  );
}

function Toolbar({
  range,
  onRange,
  gapMinutes,
  onGap,
  blob4,
  onBlob4,
}: {
  range: Range;
  onRange: (r: Range) => void;
  gapMinutes: number;
  onGap: (n: number) => void;
  blob4: ControllingBlob4Mode;
  onBlob4: (b: ControllingBlob4Mode) => void;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-center gap-2 border-b border-hair pb-4">
      <div className="mr-2 text-[10.5px] font-medium uppercase tracking-wide text-ink-400">
        Zeitraum
      </div>
      {PRESETS.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onRange(rangeFromPreset(p.id))}
          className={`rounded-md border px-2.5 py-1 text-[12.5px] transition ${
            range.preset === p.id
              ? "border-brand-500 bg-brand-50/80 text-ink-900"
              : "border-hair bg-white text-ink-600 hover:border-ink-200"
          }`}
        >
          {p.label}
        </button>
      ))}

      <div className="ml-3 flex items-center gap-1.5 text-[12.5px] text-ink-600">
        <label htmlFor="gap-min">Session-Pause (min)</label>
        <input
          id="gap-min"
          type="number"
          min={1}
          max={120}
          value={gapMinutes}
          onChange={(e) => onGap(Number(e.target.value) || 5)}
          className="w-16 rounded border border-hair bg-white px-1.5 py-1 font-mono text-[12px] text-ink-900"
        />
      </div>

      <div className="flex items-center gap-1.5 text-[12.5px] text-ink-600">
        <span>blob4</span>
        <select
          value={blob4}
          onChange={(e) =>
            onBlob4(e.target.value as ControllingBlob4Mode)
          }
          className="rounded-md border border-hair bg-white px-2 py-1 text-[12.5px] text-ink-800"
        >
          <option value="nonempty">Nicht leer (Standard)</option>
          <option value="hex32">Nur 32-hex-Keys</option>
        </select>
      </div>
    </div>
  );
}

function UserBlock({ u }: { u: ControllingUserStats }) {
  return (
    <div className="overflow-hidden rounded-lg border border-hair bg-white shadow-sm">
      <div className="border-b border-hair/80 bg-ink-50/50 px-4 py-3">
        <h3 className="font-display text-base text-ink-900">{u.user}</h3>
        <p className="mt-0.5 text-[12.5px] text-ink-500">
          {u.firstTs && u.lastTs
            ? `Erste Aktivität ${fmtDateTime(u.firstTs)} · letzte ${fmtDateTime(
                u.lastTs,
              )}`
            : "—"}
        </p>
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Events" value={fmtNumber(u.eventCount)} />
        <Kpi
          label="Sessions"
          value={fmtNumber(u.sessions.length)}
        />
        <Kpi
          label="Ø Sitzung (Aktiv)"
          value={fmtNumber(u.avgSessionTimeSec, { maximumFractionDigits: 0 }) + " s"}
        />
        <Kpi
          label="Ges. aktive Sitzungszeit"
          value={
            (u.totalSessionTimeSec / 3600 < 1
              ? fmtNumber(u.totalSessionTimeSec, { maximumFractionDigits: 0 }) + " s"
              : (u.totalSessionTimeSec / 3600).toFixed(2) + " h")
          }
        />
      </div>
      {u.openNow && (
        <div className="border-t border-hair/80 bg-white px-4 py-3">
          <p className="text-[10.5px] font-medium uppercase tracking-wide text-ink-400">
            Zuletzt (double2 – double5)
          </p>
          <p className="mt-1 text-[12.5px] text-ink-600">
            <span className="font-mono">
              d2={fmtNumber(u.openNow.d2)} d3={fmtNumber(u.openNow.d3)} d4=
              {fmtNumber(u.openNow.d4)} d5={fmtNumber(u.openNow.d5)}
            </span>{" "}
            · offen:{" "}
            <strong>
              {u.openNow.open != null
                ? fmtNumber(u.openNow.open)
                : "–"}{" "}
            </strong>
            · blob4:{" "}
            <code className="text-[11px] text-ink-800">{u.openNow.blob4}</code>
          </p>
        </div>
      )}
      {u.forecast && (
        <div className="border-t border-hair/80 bg-brand-50/20 px-4 py-3">
          <p className="text-[10.5px] font-medium uppercase tracking-wide text-ink-400">
            Prognose (Benutzer)
          </p>
          <p className="mt-1 text-[12.5px] text-ink-800">
            Offen: {fmtNumber(u.forecast.open)} · Rate:{" "}
            {u.forecast.ratePerHour != null
              ? fmtNumber(u.forecast.ratePerHour, { maximumFractionDigits: 2 }) +
                " Fzg./h"
              : "–"}{" "}
            · geschätzt fertig:{" "}
            <strong>{fmtDurationHours(u.forecast.etaHours)}</strong>
          </p>
          <p className="mt-1 text-[12px] text-ink-500">{u.forecast.basis}</p>
        </div>
      )}

      <div className="max-h-56 overflow-y-auto border-t border-hair">
        <table className="w-full text-[11.5px]">
          <thead>
            <tr className="bg-ink-50/40 text-ink-500">
              <th className="px-3 py-1.5 text-left font-medium">Start</th>
              <th className="px-3 py-1.5 text-left">Ende</th>
              <th className="px-3 py-1.5 text-right">Events</th>
              <th className="px-3 py-1.5 text-right">Aktiv (s)</th>
              <th className="px-3 py-1.5 text-right">Pause davor</th>
            </tr>
          </thead>
          <tbody>
            {u.sessions.map((s, i) => (
              <tr key={s.start + i} className="border-t border-hair/60">
                <td className="px-3 py-1.5 text-ink-600">{s.start}</td>
                <td className="px-3 py-1.5 text-ink-600">{s.end}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">
                  {s.events}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">
                  {fmtNumber(s.durationSec, { maximumFractionDigits: 0 })}
                </td>
                <td className="px-3 py-1.5 text-right text-ink-500">
                  {s.gapStartSec == null
                    ? "—"
                    : fmtSessionGap(s.gapStartSec)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
