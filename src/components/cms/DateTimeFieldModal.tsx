import { Info, X } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import type {
  CmsFieldDefinition,
  DateTimeDefaultSlice,
  DateTimeFieldConfig,
  DateTimeFormat,
  DateTimeTimeMode,
} from "../../lib/cmsSchemaTypes";
import {
  CMS_FIELD_ID_RE,
  defaultDateTimeFieldConfig,
} from "../../lib/cmsSchemaTypes";

type Tab = "name" | "settings" | "validation" | "default";

const TIMEZONE_OPTIONS = [
  "UTC",
  "UTC+01:00",
  "UTC+02:00",
  "UTC+03:00",
  "UTC+04:00",
  "UTC+05:00",
  "UTC+06:00",
  "UTC+07:00",
  "UTC+08:00",
  "UTC+09:00",
  "UTC+10:00",
  "UTC+11:00",
  "UTC+12:00",
  "UTC-01:00",
  "UTC-02:00",
  "UTC-03:00",
  "UTC-04:00",
  "UTC-05:00",
  "UTC-06:00",
  "UTC-07:00",
  "UTC-08:00",
  "UTC-09:00",
  "UTC-10:00",
  "UTC-11:00",
  "UTC-12:00",
  "Europe/Berlin",
  "Europe/London",
  "America/New_York",
];

const FORMAT_OPTIONS: { value: DateTimeFormat; label: string }[] = [
  { value: "date", label: "Date only" },
  { value: "dateAndTime", label: "Date and time" },
  { value: "dateAndTimeWithTimezone", label: "Date and time with timezone" },
];

type Local = {
  name: string;
  id: string;
  required: boolean;
  localized: boolean;
  helpText: string;
  format: DateTimeFormat;
  timeMode: DateTimeTimeMode;
  dateRangeEnabled: boolean;
  rangeMin: string;
  rangeMax: string;
  defaultDate: string;
  defaultTime: string;
  defaultTimezone: string;
  showDefaultInfo: boolean;
};

function cloneLocal(f: CmsFieldDefinition): Local {
  const cfg = f.dateTime ?? defaultDateTimeFieldConfig();
  const dr = cfg.validation.dateRange;
  const dv = cfg.defaultValue;
  return {
    name: f.name,
    id: f.id,
    required: f.required,
    localized: Boolean(f.localized),
    helpText: f.helpText ?? "",
    format: cfg.format,
    timeMode: cfg.timeMode,
    dateRangeEnabled: Boolean(dr?.enabled),
    rangeMin: dr?.min ?? "",
    rangeMax: dr?.max ?? "",
    defaultDate: dv?.date ?? "",
    defaultTime: dv?.time ?? "",
    defaultTimezone: dv?.timezone ?? "UTC+02:00",
    showDefaultInfo: true,
  };
}

function buildDateTimeConfig(local: Local): DateTimeFieldConfig {
  const dt: DateTimeFieldConfig = {
    validation: {},
    format: local.format,
    timeMode: local.timeMode,
  };
  if (local.dateRangeEnabled) {
    dt.validation.dateRange = {
      enabled: true,
      ...(local.rangeMin.trim() ? { min: local.rangeMin.trim() } : {}),
      ...(local.rangeMax.trim() ? { max: local.rangeMax.trim() } : {}),
    };
  }
  const slice: DateTimeDefaultSlice = {};
  if (local.defaultDate.trim()) slice.date = local.defaultDate.trim();
  if (local.format !== "date" && local.defaultTime.trim()) {
    slice.time = local.defaultTime.trim();
  }
  if (
    local.format === "dateAndTimeWithTimezone" &&
    local.defaultTimezone.trim()
  ) {
    slice.timezone = local.defaultTimezone.trim();
  }
  if (Object.keys(slice).length > 0) dt.defaultValue = slice;
  return dt;
}

type Props = {
  open: boolean;
  field: CmsFieldDefinition;
  onClose: () => void;
  onApply: (next: CmsFieldDefinition) => void;
};

const TAB_ITEMS: { id: Tab; label: string }[] = [
  { id: "name", label: "Name and field ID" },
  { id: "settings", label: "Settings" },
  { id: "validation", label: "Validation" },
  { id: "default", label: "Default value" },
];

/** Kurztitel im Modal-Header wie Contentful („… Date“). */
const HEADER_TYPE_LABEL = "Date";

export default function DateTimeFieldModal({
  open,
  field,
  onClose,
  onApply,
}: Props) {
  const [tab, setTab] = useState<Tab>("name");
  const [local, setLocal] = useState<Local>(() => cloneLocal(field));
  const prevOpen = useRef(false);

  useEffect(() => {
    if (open && !prevOpen.current) {
      setLocal(cloneLocal(field));
      setTab("name");
    }
    prevOpen.current = open;
  }, [open, field]);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  if (!open || field.type !== "DateTime") return null;

  const rangeInputType =
    local.format === "date" ? "date" : "datetime-local";

  function applyClick() {
    const name = local.name.slice(0, 50).trim();
    const id = local.id.slice(0, 64).trim();
    if (!name || !id || !CMS_FIELD_ID_RE.test(id)) return;
    const helpText = local.helpText.slice(0, 255);
    const dateTime = buildDateTimeConfig(local);
    const next: CmsFieldDefinition = {
      ...field,
      name,
      id,
      required: local.required,
      localized: local.localized ? true : undefined,
      helpText: helpText.trim() || undefined,
      dateTime,
    };
    onApply(next);
    onClose();
  }

  const sidebarBtn = (t: Tab, label: string) => (
    <button
      key={t}
      type="button"
      onClick={() => setTab(t)}
      className={`w-full px-3 py-2.5 text-left text-[13px] transition ${
        tab === t
          ? "border-l-[3px] border-l-[#0366d6] bg-[#e8eaed] font-medium text-[#1a1a1a]"
          : "border-l-[3px] border-l-transparent text-[#5f6368] hover:bg-[#f1f3f4]"
      }`}
    >
      {label}
    </button>
  );

  const valRow = (
    title: string,
    desc: string,
    checked: boolean,
    onChange: (v: boolean) => void,
    children?: ReactNode,
  ) => (
    <div className="border-b border-[#e8eaed] py-4 last:border-b-0">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 rounded border-[#dadce0] accent-[#0366d6]"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span>
          <span className="block text-[13px] font-semibold text-[#1a1a1a]">
            {title}
          </span>
          <span className="mt-0.5 block text-[12px] leading-snug text-[#5f6368]">
            {desc}
          </span>
        </span>
      </label>
      {children}
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Schließen"
        onClick={onClose}
      />
      <div className="relative flex max-h-[min(92vh,900px)] w-full max-w-[960px] flex-col overflow-hidden rounded-lg border border-[#dadce0] bg-white shadow-2xl">
        <header className="flex shrink-0 items-center justify-between border-b border-[#dadce0] px-5 py-4">
          <h2 className="text-[15px] font-semibold text-[#1a1a1a]">
            <span className="font-normal text-[#5f6368]">
              {local.name || field.name}
            </span>{" "}
            <span className="text-[#5f6368]">{HEADER_TYPE_LABEL}</span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 text-[#5f6368] hover:bg-[#f1f3f4]"
            aria-label="Schließen"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex min-h-0 flex-1">
          <nav className="w-[220px] shrink-0 overflow-y-auto border-r border-[#dadce0] bg-[#f8f9fa] py-2">
            {TAB_ITEMS.map(({ id, label }) => sidebarBtn(id, label))}
          </nav>

          <div className="min-w-0 flex-1 overflow-y-auto bg-white p-6">
            {tab === "name" && (
              <div className="max-w-xl space-y-8">
                <section>
                  <h3 className="mb-4 text-[18px] font-semibold text-[#1a1a1a]">
                    Name and field ID
                  </h3>
                  <div className="space-y-5">
                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <label className="text-[13px] font-medium text-[#1a1a1a]">
                          Name <span className="text-[#d93025]">*</span>
                        </label>
                        <span className="text-[11px] text-[#5f6368]">
                          {local.name.length} / 50
                        </span>
                      </div>
                      <input
                        value={local.name}
                        onChange={(e) =>
                          setLocal((s) => ({
                            ...s,
                            name: e.target.value.slice(0, 50),
                          }))
                        }
                        className="w-full rounded border border-[#dadce0] px-3 py-2 text-[13px] outline-none focus:border-[#0366d6] focus:ring-1 focus:ring-[#0366d6]"
                      />
                    </div>
                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <label className="text-[13px] font-medium text-[#1a1a1a]">
                          Field ID <span className="text-[#d93025]">*</span>
                        </label>
                        <span className="text-[11px] text-[#5f6368]">
                          {local.id.length} / 64
                        </span>
                      </div>
                      <input
                        value={local.id}
                        onChange={(e) =>
                          setLocal((s) => ({
                            ...s,
                            id: e.target.value.slice(0, 64),
                          }))
                        }
                        className="w-full rounded border border-[#dadce0] px-3 py-2 font-mono text-[13px] outline-none focus:border-[#0366d6] focus:ring-1 focus:ring-[#0366d6]"
                      />
                    </div>
                  </div>
                </section>
                <section>
                  <h3 className="mb-2 text-[13px] font-semibold text-[#1a1a1a]">
                    Help text
                  </h3>
                  <input
                    value={local.helpText}
                    onChange={(e) =>
                      setLocal((s) => ({
                        ...s,
                        helpText: e.target.value.slice(0, 255),
                      }))
                    }
                    className="w-full rounded border border-[#dadce0] px-3 py-2 text-[13px]"
                  />
                  <div className="mt-1 flex justify-between text-[11px] text-[#5f6368]">
                    <span>This help text will show up below the field.</span>
                    <span>{local.helpText.length} / 255</span>
                  </div>
                </section>
              </div>
            )}

            {tab === "settings" && (
              <div className="max-w-xl space-y-6">
                <h3 className="text-[18px] font-semibold text-[#1a1a1a]">
                  Settings
                </h3>
                <div>
                  <p className="mb-3 text-[12px] font-semibold text-[#5f6368]">
                    Field options
                  </p>
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-[#dadce0] accent-[#0366d6]"
                      checked={local.localized}
                      onChange={(e) =>
                        setLocal((s) => ({
                          ...s,
                          localized: e.target.checked,
                        }))
                      }
                    />
                    <span>
                      <span className="block text-[13px] font-semibold text-[#1a1a1a]">
                        Enable localization of this field
                      </span>
                      <span className="mt-0.5 block text-[12px] text-[#5f6368]">
                        All the content can be translated to configured locales.
                      </span>
                    </span>
                  </label>
                </div>
                <div className="border-t border-[#e8eaed] pt-5">
                  <label className="mb-1 block text-[13px] font-medium text-[#1a1a1a]">
                    Format <span className="text-[#d93025]">*</span>
                  </label>
                  <select
                    value={local.format}
                    onChange={(e) =>
                      setLocal((s) => ({
                        ...s,
                        format: e.target.value as DateTimeFormat,
                      }))
                    }
                    className="w-full max-w-md rounded border border-[#dadce0] bg-white px-3 py-2 text-[13px]"
                  >
                    {FORMAT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-[#1a1a1a]">
                    Time mode <span className="text-[#d93025]">*</span>
                  </label>
                  <select
                    value={local.timeMode}
                    onChange={(e) =>
                      setLocal((s) => ({
                        ...s,
                        timeMode: e.target.value as DateTimeTimeMode,
                      }))
                    }
                    className="w-full max-w-md rounded border border-[#dadce0] bg-white px-3 py-2 text-[13px]"
                  >
                    <option value="24">24 Hour</option>
                    <option value="12">12 Hour</option>
                  </select>
                </div>
              </div>
            )}

            {tab === "validation" && (
              <div className="max-w-2xl">
                <h3 className="mb-4 text-[18px] font-semibold text-[#1a1a1a]">
                  Validation
                </h3>
                {valRow(
                  "Required field",
                  "You won't be able to publish an entry if this field is empty.",
                  local.required,
                  (v) => setLocal((s) => ({ ...s, required: v })),
                )}
                {valRow(
                  "Accept only specified date range",
                  "Specify an early and/or latest allowed date for this field.",
                  local.dateRangeEnabled,
                  (v) =>
                    setLocal((s) => ({
                      ...s,
                      dateRangeEnabled: v,
                      rangeMin: v ? s.rangeMin : "",
                      rangeMax: v ? s.rangeMax : "",
                    })),
                  local.dateRangeEnabled ? (
                    <div className="mt-3 ml-7 grid max-w-lg gap-3 sm:grid-cols-2">
                      <div>
                        <span className="mb-1 block text-[11px] font-medium text-[#5f6368]">
                          Earliest
                        </span>
                        <input
                          type={rangeInputType}
                          className="w-full rounded border border-[#dadce0] px-2 py-1.5 text-[13px]"
                          value={local.rangeMin}
                          onChange={(e) =>
                            setLocal((s) => ({
                              ...s,
                              rangeMin: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div>
                        <span className="mb-1 block text-[11px] font-medium text-[#5f6368]">
                          Latest
                        </span>
                        <input
                          type={rangeInputType}
                          className="w-full rounded border border-[#dadce0] px-2 py-1.5 text-[13px]"
                          value={local.rangeMax}
                          onChange={(e) =>
                            setLocal((s) => ({
                              ...s,
                              rangeMax: e.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>
                  ) : null,
                )}
              </div>
            )}

            {tab === "default" && (
              <div className="max-w-xl">
                <h3 className="mb-4 text-[18px] font-semibold text-[#1a1a1a]">
                  Default value
                </h3>
                {local.showDefaultInfo ? (
                  <div className="relative mb-4 flex gap-3 rounded-lg border border-[#aecbfa] bg-[#e8f0fe] p-4 pr-10">
                    <Info className="h-5 w-5 shrink-0 text-[#0366d6]" />
                    <p className="text-[12px] leading-relaxed text-[#1967d2]">
                      This setting allows you to set a default value for this
                      field, which will be automatically inserted to new content
                      entries. It can help editors avoid content entry altogether,
                      or just give them a helpful prompt for how to structure
                      their content.
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        setLocal((s) => ({ ...s, showDefaultInfo: false }))
                      }
                      className="absolute right-2 top-2 rounded p-1 text-[#174ea6] hover:bg-[#d2e3fc]"
                      aria-label="Hinweis schließen"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : null}
                <div className="flex flex-wrap items-end gap-3">
                  <div className="min-w-[140px] flex-1">
                    <span className="mb-1 block text-[11px] font-medium text-[#5f6368]">
                      Date
                    </span>
                    <input
                      type="date"
                      value={local.defaultDate}
                      onChange={(e) =>
                        setLocal((s) => ({
                          ...s,
                          defaultDate: e.target.value,
                        }))
                      }
                      className="w-full rounded border border-[#dadce0] px-2 py-2 text-[13px]"
                    />
                  </div>
                  {local.format !== "date" ? (
                    <div className="min-w-[100px] flex-1">
                      <span className="mb-1 block text-[11px] font-medium text-[#5f6368]">
                        Time
                      </span>
                      <input
                        type="time"
                        value={local.defaultTime}
                        onChange={(e) =>
                          setLocal((s) => ({
                            ...s,
                            defaultTime: e.target.value,
                          }))
                        }
                        className="w-full rounded border border-[#dadce0] px-2 py-2 text-[13px]"
                      />
                    </div>
                  ) : null}
                  {local.format === "dateAndTimeWithTimezone" ? (
                    <div className="min-w-[160px] flex-1">
                      <span className="mb-1 block text-[11px] font-medium text-[#5f6368]">
                        Timezone
                      </span>
                      <select
                        value={local.defaultTimezone}
                        onChange={(e) =>
                          setLocal((s) => ({
                            ...s,
                            defaultTimezone: e.target.value,
                          }))
                        }
                        className="w-full rounded border border-[#dadce0] bg-white px-2 py-2 text-[12px]"
                      >
                        {TIMEZONE_OPTIONS.map((tz) => (
                          <option key={tz} value={tz}>
                            {tz}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </div>

        <footer className="flex shrink-0 justify-end gap-2 border-t border-[#dadce0] bg-[#f8f9fa] px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded px-4 py-2 text-[13px] font-medium text-[#5f6368] hover:bg-[#e8eaed]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={applyClick}
            className="rounded bg-[#0366d6] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#0256b9]"
          >
            Apply
          </button>
        </footer>
      </div>
    </div>
  );
}
