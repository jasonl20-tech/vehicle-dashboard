import { Info, X } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import type { CmsFieldDefinition, CmsFieldValidations } from "../../lib/cmsSchemaTypes";
import {
  FIELD_TYPE_LABELS,
  TEXT_SHORT_MAX,
  TEXT_LONG_MAX,
  CMS_FIELD_ID_RE,
} from "../../lib/cmsSchemaTypes";

type Tab = "name" | "settings" | "validation" | "default";

function capFor(f: CmsFieldDefinition): number {
  if (f.textShape?.variant === "long") return TEXT_LONG_MAX;
  if (f.textShape?.variant === "short") return TEXT_SHORT_MAX;
  const ml = f.validations?.maxLength;
  return ml !== undefined && ml > TEXT_SHORT_MAX ? TEXT_LONG_MAX : TEXT_SHORT_MAX;
}

type Local = {
  name: string;
  id: string;
  required: boolean;
  localized: boolean;
  helpText: string;
  isEntryTitle: boolean;
  defaultValue: string;
  unique: boolean;
  limitChars: boolean;
  limitMin: string;
  limitMax: string;
  patternMode: "none" | "email" | "uri" | "custom";
  customPattern: string;
  prohibitEnabled: boolean;
  prohibitPattern: string;
  allowedValuesEnabled: boolean;
  allowedValuesText: string;
};

function cloneLocal(f: CmsFieldDefinition, displayFieldIsThis: boolean): Local {
  const cap = capFor(f);
  const v = f.validations;
  const minL = v?.minLength;
  const maxL = v?.maxLength;
  const limitChars = !!(
    minL !== undefined ||
    (maxL !== undefined && maxL < cap)
  );
  let patternMode: Local["patternMode"] = "none";
  let customPattern = "";
  if (v?.patternPreset === "email") patternMode = "email";
  else if (v?.patternPreset === "uri") patternMode = "uri";
  else if (v?.pattern && v.pattern.trim()) {
    patternMode = "custom";
    customPattern = v.pattern;
  }
  return {
    name: f.name,
    id: f.id,
    required: f.required,
    localized: Boolean(f.localized),
    helpText: f.helpText ?? "",
    isEntryTitle: displayFieldIsThis,
    defaultValue: f.defaultValue ?? "",
    unique: Boolean(v?.unique),
    limitChars,
    limitMin: minL !== undefined ? String(minL) : "",
    limitMax:
      limitChars && maxL !== undefined && maxL < cap ? String(maxL) : "",
    patternMode,
    customPattern,
    prohibitEnabled: Boolean(v?.prohibitPattern),
    prohibitPattern: v?.prohibitPattern ?? "",
    allowedValuesEnabled: Boolean(v?.allowedValues?.length),
    allowedValuesText: v?.allowedValues?.join("\n") ?? "",
  };
}

function buildValidations(local: Local, cap: number): CmsFieldValidations {
  const v: CmsFieldValidations = {};
  if (local.unique) v.unique = true;
  if (local.limitChars) {
    const minV =
      local.limitMin.trim() === ""
        ? undefined
        : Math.floor(Number(local.limitMin));
    if (minV !== undefined && !Number.isNaN(minV) && minV >= 0) {
      v.minLength = minV;
    }
    let maxV: number;
    if (local.limitMax.trim() === "") maxV = cap;
    else {
      maxV = Math.floor(Number(local.limitMax));
      if (Number.isNaN(maxV)) maxV = cap;
      maxV = Math.max(0, Math.min(cap, maxV));
    }
    v.maxLength = maxV;
  } else {
    v.maxLength = cap;
  }
  if (local.patternMode === "email") v.patternPreset = "email";
  else if (local.patternMode === "uri") v.patternPreset = "uri";
  else if (local.patternMode === "custom" && local.customPattern.trim()) {
    v.pattern = local.customPattern.trim();
  }
  if (local.prohibitEnabled && local.prohibitPattern.trim()) {
    v.prohibitPattern = local.prohibitPattern.trim();
  }
  if (local.allowedValuesEnabled) {
    const vals = local.allowedValuesText
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (vals.length > 0) v.allowedValues = vals;
  }
  return v;
}

type Props = {
  open: boolean;
  field: CmsFieldDefinition;
  /** schema.displayField === field.id (vor evtl. ID-Änderung) */
  displayFieldIsThis: boolean;
  onClose: () => void;
  onApply: (next: CmsFieldDefinition, entryTitle: boolean) => void;
};

const TAB_ITEMS: { id: Tab; label: string }[] = [
  { id: "name", label: "Name and field ID" },
  { id: "settings", label: "Settings" },
  { id: "validation", label: "Validation" },
  { id: "default", label: "Default value" },
];

export default function TextFieldModal({
  open,
  field,
  displayFieldIsThis,
  onClose,
  onApply,
}: Props) {
  const [tab, setTab] = useState<Tab>("name");
  const [local, setLocal] = useState<Local>(() =>
    cloneLocal(field, displayFieldIsThis),
  );
  const prevOpen = useRef(false);
  const cap = capFor(field);

  useEffect(() => {
    if (open && !prevOpen.current) {
      setLocal(cloneLocal(field, displayFieldIsThis));
      setTab("name");
    }
    prevOpen.current = open;
  }, [open, field, displayFieldIsThis]);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  if (!open || field.type !== "Text") return null;

  const variantLabel =
    field.textShape?.variant === "long" ||
    (!field.textShape && cap === TEXT_LONG_MAX)
      ? "Long text"
      : "Short text";

  function applyClick() {
    const name = local.name.slice(0, 50).trim();
    const id = local.id.slice(0, 64).trim();
    if (!name || !id || !CMS_FIELD_ID_RE.test(id)) return;
    const helpText = local.helpText.slice(0, 255);
    const dv = local.defaultValue.slice(0, cap);
    const validations = buildValidations(local, cap);
    const next: CmsFieldDefinition = {
      ...field,
      name,
      id,
      required: local.required,
      localized: local.localized ? true : undefined,
      helpText: helpText.trim() || undefined,
      defaultValue: dv.trim() ? dv : undefined,
      validations,
    };
    onApply(next, local.isEntryTitle);
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
      <div className="relative flex max-h-[min(92vh,880px)] w-full max-w-[960px] flex-col overflow-hidden rounded-lg border border-[#dadce0] bg-white shadow-2xl">
        <header className="flex shrink-0 items-center justify-between border-b border-[#dadce0] px-5 py-4">
          <h2 className="text-[15px] font-semibold text-[#1a1a1a]">
            <span className="font-normal text-[#5f6368]">
              {local.name || field.name}
            </span>{" "}
            <span className="text-[#5f6368]">{FIELD_TYPE_LABELS.Text}</span>
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
                  <div className="mb-4 rounded-lg border border-[#f9ab00]/50 bg-[#fef7e0]/80 px-3 py-2 text-[11px] text-[#663c00]">
                    Type and list settings were set when the field was created
                    and cannot be changed here ({variantLabel}
                    {field.list ? ", List" : ""}).
                  </div>
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
                      checked={local.isEntryTitle}
                      onChange={(e) =>
                        setLocal((s) => ({
                          ...s,
                          isEntryTitle: e.target.checked,
                        }))
                      }
                    />
                    <span>
                      <span className="block text-[13px] font-semibold text-[#1a1a1a]">
                        This field represents the Entry title
                      </span>
                    </span>
                  </label>
                  <label className="mt-4 flex cursor-pointer items-start gap-3">
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
                        Content can be translated per configured locale.
                      </span>
                    </span>
                  </label>
                </div>
              </div>
            )}

            {tab === "validation" && (
              <div className="max-w-2xl">
                <h3 className="mb-2 text-[18px] font-semibold text-[#1a1a1a]">
                  Validation
                </h3>
                <div className="mb-2 text-[11px] text-[#5f6368]">
                  Maximum length for this field type: {cap.toLocaleString()}{" "}
                  characters.
                </div>
                <div>
                  <h4 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[#5f6368]">
                    General validations
                  </h4>
                  {valRow(
                    "Required field",
                    "You won't be able to publish an entry if this field is empty.",
                    local.required,
                    (v) => setLocal((s) => ({ ...s, required: v })),
                  )}
                  {valRow(
                    "Unique field",
                    "You won't be able to publish an entry if there is an existing entry with identical content.",
                    local.unique,
                    (v) => setLocal((s) => ({ ...s, unique: v })),
                  )}
                  {valRow(
                    "Limit character count",
                    "Specify a minimum and/or maximum allowed number of characters.",
                    local.limitChars,
                    (v) => setLocal((s) => ({ ...s, limitChars: v })),
                    local.limitChars ? (
                      <div className="mt-3 ml-7 grid max-w-xs grid-cols-2 gap-3">
                        <div>
                          <span className="mb-1 block text-[11px] font-medium text-[#5f6368]">
                            Min
                          </span>
                          <input
                            type="number"
                            min={0}
                            className="w-full rounded border border-[#dadce0] px-2 py-1.5 text-[13px]"
                            value={local.limitMin}
                            onChange={(e) =>
                              setLocal((s) => ({
                                ...s,
                                limitMin: e.target.value,
                              }))
                            }
                          />
                        </div>
                        <div>
                          <span className="mb-1 block text-[11px] font-medium text-[#5f6368]">
                            Max (empty = type max)
                          </span>
                          <input
                            type="number"
                            min={0}
                            className="w-full rounded border border-[#dadce0] px-2 py-1.5 text-[13px]"
                            value={local.limitMax}
                            onChange={(e) =>
                              setLocal((s) => ({
                                ...s,
                                limitMax: e.target.value,
                              }))
                            }
                          />
                        </div>
                      </div>
                    ) : null,
                  )}
                  {valRow(
                    "Match a specific pattern",
                    "Make this field match a pattern: e-mail address, URI, or a custom regular expression.",
                    local.patternMode !== "none",
                    (on) =>
                      setLocal((s) => ({
                        ...s,
                        patternMode: on ? "email" : "none",
                        customPattern: on ? s.customPattern : "",
                      })),
                    local.patternMode !== "none" ? (
                      <div className="mt-3 ml-7 space-y-3">
                        <div className="flex flex-wrap gap-3">
                          {(["email", "uri", "custom"] as const).map((m) => (
                            <label
                              key={m}
                              className="inline-flex items-center gap-2 text-[12px]"
                            >
                              <input
                                type="radio"
                                name="patternMode"
                                checked={local.patternMode === m}
                                onChange={() =>
                                  setLocal((s) => ({ ...s, patternMode: m }))
                                }
                                className="accent-[#0366d6]"
                              />
                              {m === "email"
                                ? "E-mail"
                                : m === "uri"
                                  ? "URI"
                                  : "Custom regex"}
                            </label>
                          ))}
                        </div>
                        {local.patternMode === "custom" ? (
                          <input
                            value={local.customPattern}
                            onChange={(e) =>
                              setLocal((s) => ({
                                ...s,
                                customPattern: e.target.value,
                              }))
                            }
                            placeholder="Regular expression"
                            className="w-full max-w-md rounded border border-[#dadce0] px-2 py-1.5 font-mono text-[12px]"
                          />
                        ) : null}
                      </div>
                    ) : null,
                  )}
                  {valRow(
                    "Prohibit a specific pattern",
                    "Make this field invalid when a pattern is matched (e.g. blocklist).",
                    local.prohibitEnabled,
                    (v) =>
                      setLocal((s) => ({
                        ...s,
                        prohibitEnabled: v,
                        prohibitPattern: v ? s.prohibitPattern : "",
                      })),
                    local.prohibitEnabled ? (
                      <div className="mt-3 ml-7">
                        <input
                          value={local.prohibitPattern}
                          onChange={(e) =>
                            setLocal((s) => ({
                              ...s,
                              prohibitPattern: e.target.value,
                            }))
                          }
                          placeholder="Regular expression"
                          className="w-full max-w-md rounded border border-[#dadce0] px-2 py-1.5 font-mono text-[12px]"
                        />
                      </div>
                    ) : null,
                  )}
                  {valRow(
                    "Accept only specified values",
                    "You won't be able to publish an entry if the field value is not in the list of specified values.",
                    local.allowedValuesEnabled,
                    (v) =>
                      setLocal((s) => ({
                        ...s,
                        allowedValuesEnabled: v,
                        allowedValuesText: v ? s.allowedValuesText : "",
                      })),
                    local.allowedValuesEnabled ? (
                      <div className="mt-3 ml-7">
                        <textarea
                          value={local.allowedValuesText}
                          onChange={(e) =>
                            setLocal((s) => ({
                              ...s,
                              allowedValuesText: e.target.value,
                            }))
                          }
                          rows={5}
                          placeholder="One value per line"
                          className="w-full max-w-md rounded border border-[#dadce0] px-2 py-1.5 text-[12px]"
                        />
                      </div>
                    ) : null,
                  )}
                </div>
              </div>
            )}

            {tab === "default" && (
              <div className="max-w-xl">
                <h3 className="mb-4 text-[18px] font-semibold text-[#1a1a1a]">
                  Default value
                </h3>
                <div className="mb-4 flex gap-3 rounded-lg border border-[#aecbfa] bg-[#e8f0fe] p-4">
                  <Info className="h-5 w-5 shrink-0 text-[#0366d6]" />
                  <p className="text-[12px] leading-relaxed text-[#1967d2]">
                    This value is inserted automatically when creating a new
                    entry (schema only; entry editor may use it later).
                  </p>
                </div>
                <input
                  value={local.defaultValue}
                  onChange={(e) =>
                    setLocal((s) => ({
                      ...s,
                      defaultValue: e.target.value.slice(0, cap),
                    }))
                  }
                  className="w-full rounded border border-[#dadce0] px-3 py-2 text-[13px]"
                />
                <div className="mt-1 flex justify-between text-[11px] text-[#5f6368]">
                  <span>{local.defaultValue.length} characters</span>
                  <span>Maximum {cap.toLocaleString()} characters</span>
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
