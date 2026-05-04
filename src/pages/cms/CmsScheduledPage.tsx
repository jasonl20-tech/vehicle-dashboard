import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CMS_ROOT } from "../../lib/cmsAccess";
import {
  CMS_CONTENT_MODELS_API,
  CMS_CONTENTS_API,
  extractContentTitle,
  type CmsContentsListResponse,
} from "../../lib/cmsApi";
import { useApi } from "../../lib/customerApi";

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function ymKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

/** Montag = 0 … Sonntag = 6 */
function weekdayMon0(d: Date): number {
  const wd = d.getDay();
  return wd === 0 ? 6 : wd - 1;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, delta: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1);
}

function daysInMonth(y: number, m0: number): number {
  return new Date(y, m0 + 1, 0).getDate();
}

function dateKeyFromIso(iso: string): string | null {
  if (!iso) return null;
  const s = iso.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export default function CmsScheduledPage() {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const monthYm = ymKey(cursor);

  const models = useApi<CmsContentModelsListResponse>(
    `${CMS_CONTENT_MODELS_API}?limit=500`,
  );

  const contentsUrl = useMemo(
    () =>
      `${CMS_CONTENTS_API}?${new URLSearchParams({
        scheduled_month: monthYm,
        limit: "500",
      })}`,
    [monthYm],
  );
  const contents = useApi<CmsContentsListResponse>(contentsUrl);

  const modelKeyById = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of models.data?.rows ?? []) {
      m.set(r.id, r.key);
    }
    return m;
  }, [models.data?.rows]);

  const rows = useMemo(() => {
    const list = contents.data?.rows ?? [];
    return list.map((r) => {
      let payload: unknown = null;
      try {
        payload = JSON.parse(r.payload_json) as unknown;
      } catch {
        payload = null;
      }
      const dayKey = dateKeyFromIso(r.scheduled_publish_at ?? "");
      return {
        id: r.id,
        title: extractContentTitle(payload),
        type:
          modelKeyById.get(r.content_model_id) ??
          r.content_model_id.slice(0, 8),
        dayKey,
        timeLabel: r.scheduled_publish_at
          ? new Intl.DateTimeFormat("de-DE", {
              hour: "2-digit",
              minute: "2-digit",
            }).format(new Date(r.scheduled_publish_at))
          : "",
      };
    });
  }, [contents.data?.rows, modelKeyById]);

  const byDay = useMemo(() => {
    const m = new Map<string, typeof rows>();
    for (const r of rows) {
      if (!r.dayKey) continue;
      const list = m.get(r.dayKey) ?? [];
      list.push(r);
      m.set(r.dayKey, list);
    }
    return m;
  }, [rows]);

  const year = cursor.getFullYear();
  const month0 = cursor.getMonth();
  const dim = daysInMonth(year, month0);
  const first = new Date(year, month0, 1);
  const lead = weekdayMon0(first);

  const title = new Intl.DateTimeFormat("de-DE", {
    month: "long",
    year: "numeric",
  }).format(first);

  const cells: Array<{ day: number | null }> = [];
  for (let i = 0; i < lead; i++) cells.push({ day: null });
  for (let d = 1; d <= dim; d++) cells.push({ day: d });

  const loading = models.loading || contents.loading;
  const err = models.error || contents.error;

  return (
    <div className="w-full">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-ink-900 lg:text-[26px]">
            Geplant
          </h1>
          <p className="mt-1 text-[13px] text-ink-500">
            Einträge mit geplantem Veröffentlichungsdatum (Kalender monatlich).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCursor((c) => addMonths(c, -1))}
            className="inline-flex items-center rounded-md border border-[#dadce0] bg-white p-2 text-ink-700 hover:bg-[#f8f9fa]"
            aria-label="Vorheriger Monat"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="min-w-[10rem] text-center text-[14px] font-semibold capitalize text-ink-900">
            {title}
          </span>
          <button
            type="button"
            onClick={() => setCursor((c) => addMonths(c, 1))}
            className="inline-flex items-center rounded-md border border-[#dadce0] bg-white p-2 text-ink-700 hover:bg-[#f8f9fa]"
            aria-label="Nächster Monat"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setCursor(startOfMonth(new Date()))}
            className="rounded-md border border-[#dadce0] bg-white px-3 py-1.5 text-[12px] font-medium text-ink-700 hover:bg-[#f8f9fa]"
          >
            Heute
          </button>
        </div>
      </header>

      {err ? (
        <pre className="mb-4 whitespace-pre-wrap rounded-lg border border-rose-200 bg-rose-50/80 px-3 py-2 text-[13px] text-rose-900">
          {err}
        </pre>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-[#dadce0] bg-white shadow-sm">
        {loading ? (
          <p className="p-6 text-[13px] text-ink-500">Laden …</p>
        ) : (
          <div className="grid grid-cols-7 gap-px border-b border-[#e8eaed] bg-[#e8eaed]">
            {WEEKDAYS.map((w) => (
              <div
                key={w}
                className="bg-[#fafafa] px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-ink-500"
              >
                {w}
              </div>
            ))}
            {cells.map((cell, idx) => {
              if (cell.day == null) {
                return (
                  <div
                    key={`empty-${idx}`}
                    className="min-h-[7rem] bg-white"
                  />
                );
              }
              const dk = `${year}-${pad2(month0 + 1)}-${pad2(cell.day)}`;
              const list = byDay.get(dk) ?? [];
              return (
                <div
                  key={dk}
                  className="min-h-[7rem] bg-white p-1.5 text-left align-top"
                >
                  <div className="mb-1 text-[12px] font-semibold text-ink-700">
                    {cell.day}
                  </div>
                  <ul className="space-y-1">
                    {list.map((r) => (
                      <li key={r.id}>
                        <Link
                          to={`${CMS_ROOT}/entries/${r.id}/edit`}
                          className="block truncate rounded bg-[#e8f0fe] px-1 py-0.5 text-[10.5px] font-medium text-[#1967d2] hover:underline"
                          title={`${r.title} · ${r.type}`}
                        >
                          <span className="text-ink-500">{r.timeLabel} </span>
                          {r.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {!loading && !err && rows.length === 0 ? (
        <p className="mt-4 text-[13px] text-ink-500">
          Keine geplanten Einträge in diesem Monat. Datum im Editor unter
          „Geplant veröffentlichen“ setzen.
        </p>
      ) : null}
    </div>
  );
}
