import { Info } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import type { CmsFieldDefinition, CmsFieldValidations } from "../../lib/cmsSchemaTypes";
import { CMS_FIELD_ID_RE } from "../../lib/cmsSchemaTypes";
import CmsFieldEditorShell, {
  cmsFieldSectionDomId,
} from "./CmsFieldEditorShell";

type SectionId = "name" | "settings" | "validation" | "default";

type Local = {
  name: string;
  id: string;
  required: boolean;
  localized: boolean;
  helpText: string;
  unique: boolean;
  limitRange: boolean;
  rangeMin: string;
  rangeMax: string;
  allowedValuesEnabled: boolean;
  allowedValuesText: string;
  defaultNumberStr: string;
};

function cloneLocal(f: CmsFieldDefinition): Local {
  const v = f.validations;
  const limitRange = v?.min !== undefined || v?.max !== undefined;
  return {
    name: f.name,
    id: f.id,
    required: f.required,
    localized: Boolean(f.localized),
    helpText: f.helpText ?? "",
    unique: Boolean(v?.unique),
    limitRange,
    rangeMin: v?.min !== undefined ? String(v.min) : "",
    rangeMax: v?.max !== undefined ? String(v.max) : "",
    allowedValuesEnabled: Boolean(v?.allowedNumberValues?.length),
    allowedValuesText: v?.allowedNumberValues?.join("\n") ?? "",
    defaultNumberStr:
      f.defaultNumber !== undefined && !Number.isNaN(f.defaultNumber)
        ? String(f.defaultNumber)
        : "",
  };
}

function parseNumberLine(s: string, integer: boolean): number | null {
  const t = s.trim();
  if (t === "") return null;
  const n = integer ? parseInt(t, 10) : parseFloat(t);
  return Number.isNaN(n) ? null : n;
}

function buildValidations(
  local: Local,
  integer: boolean,
): CmsFieldValidations {
  const v: CmsFieldValidations = {};
  if (local.unique) v.unique = true;
  if (local.limitRange) {
    if (local.rangeMin.trim() !== "") {
      const n = parseNumberLine(local.rangeMin, integer);
      if (n !== null) v.min = n;
    }
    if (local.rangeMax.trim() !== "") {
      const n = parseNumberLine(local.rangeMax, integer);
      if (n !== null) v.max = n;
    }
  }
  if (local.allowedValuesEnabled) {
    const nums: number[] = [];
    for (const line of local.allowedValuesText.split(/\r?\n/)) {
      const n = parseNumberLine(line, integer);
      if (n !== null) nums.push(n);
    }
    if (nums.length > 0) v.allowedNumberValues = nums;
  }
  return v;
}

type Props = {
  open: boolean;
  field: CmsFieldDefinition;
  onClose: () => void;
  onApply: (next: CmsFieldDefinition) => void;
};

const NAV_ITEMS: { id: SectionId; label: string }[] = [
  { id: "name", label: "Name and field ID" },
  { id: "settings", label: "Settings" },
  { id: "validation", label: "Validation" },
  { id: "default", label: "Default value" },
];

export default function NumberFieldModal({
  open,
  field,
  onClose,
  onApply,
}: Props) {
  const [local, setLocal] = useState<Local>(() => cloneLocal(field));
  const prevOpen = useRef(false);

  const integer = field.numberShape?.variant !== "decimal";

  useEffect(() => {
    if (open && !prevOpen.current) {
      setLocal(cloneLocal(field));
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

  if (!open || field.type !== "Number") return null;

  const typeLabel = integer ? "Integer" : "Decimal";

  function applyClick() {
    const name = local.name.slice(0, 50).trim();
    const id = local.id.slice(0, 64).trim();
    if (!name || !id || !CMS_FIELD_ID_RE.test(id)) return;
    const helpText = local.helpText.slice(0, 255);
    const validations = buildValidations(local, integer);
    let defaultNumber: number | undefined;
    if (local.defaultNumberStr.trim() !== "") {
      const n = parseNumberLine(local.defaultNumberStr, integer);
      if (n !== null) defaultNumber = n;
    }
    const next: CmsFieldDefinition = {
      ...field,
      name,
      id,
      required: local.required,
      localized: local.localized ? true : undefined,
      helpText: helpText.trim() || undefined,
    };
    if (Object.keys(validations).length > 0) next.validations = validations;
    else delete next.validations;
    if (defaultNumber !== undefined) next.defaultNumber = defaultNumber;
    else delete next.defaultNumber;
    onApply(next);
    onClose();
  }

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
    <CmsFieldEditorShell
      open={open}
      fieldName={local.name}
      fieldNameFallback={field.name}
      typeLabel={typeLabel}
      navItems={NAV_ITEMS}
      onClose={onClose}
      onConfirm={applyClick}
    >
      <section
        id={cmsFieldSectionDomId("name")}
        className="scroll-mt-6 space-y-8"
      >
        <div>
          <h3 className="mb-4 text-[20px] font-semibold text-[#1a1a1a]">
            Name and field ID
          </h3>
          <div className="mb-4 rounded-lg border border-[#f9ab00]/50 bg-[#fef7e0]/80 px-3 py-2 text-[11px] text-[#663c00]">
            Number type (Integer vs. Decimal) was set when the field was
            created and cannot be changed here.
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
                className="w-full rounded-md border border-[#dadce0] px-3 py-2 text-[13px] outline-none focus:border-[#0366d6] focus:ring-1 focus:ring-[#0366d6]"
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
                className="w-full rounded-md border border-[#dadce0] px-3 py-2 font-mono text-[13px] outline-none focus:border-[#0366d6] focus:ring-1 focus:ring-[#0366d6]"
              />
            </div>
          </div>
        </div>
        <div>
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
            className="w-full rounded-md border border-[#dadce0] px-3 py-2 text-[13px]"
          />
          <div className="mt-1 flex justify-between text-[11px] text-[#5f6368]">
            <span>This help text will show up below the field.</span>
            <span>{local.helpText.length} / 255</span>
          </div>
        </div>
      </section>

      <section
        id={cmsFieldSectionDomId("settings")}
        className="scroll-mt-6 space-y-6"
      >
        <h3 className="text-[20px] font-semibold text-[#1a1a1a]">Settings</h3>
        <div>
          <p className="mb-3 text-[13px] font-semibold text-[#5f6368]">
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
      </section>

      <section id={cmsFieldSectionDomId("validation")} className="scroll-mt-6">
        <h3 className="mb-4 text-[20px] font-semibold text-[#1a1a1a]">
          Validation
        </h3>
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
            "Accept only specified number range",
            "Specify a minimum and/or maximum allowed number for this field.",
            local.limitRange,
            (v) =>
              setLocal((s) => ({
                ...s,
                limitRange: v,
                rangeMin: v ? s.rangeMin : "",
                rangeMax: v ? s.rangeMax : "",
              })),
            local.limitRange ? (
              <div className="mt-3 ml-7 grid max-w-xs grid-cols-2 gap-3">
                <div>
                  <span className="mb-1 block text-[11px] font-medium text-[#5f6368]">
                    Minimum
                  </span>
                  <input
                    type="number"
                    step={integer ? 1 : "any"}
                    className="w-full rounded-md border border-[#dadce0] px-2 py-1.5 text-[13px]"
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
                    Maximum
                  </span>
                  <input
                    type="number"
                    step={integer ? 1 : "any"}
                    className="w-full rounded-md border border-[#dadce0] px-2 py-1.5 text-[13px]"
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
                  placeholder="One number per line"
                  className="w-full max-w-md rounded-md border border-[#dadce0] px-2 py-1.5 font-mono text-[12px]"
                />
              </div>
            ) : null,
          )}
        </div>
      </section>

      <section id={cmsFieldSectionDomId("default")} className="scroll-mt-6">
        <h3 className="mb-4 text-[20px] font-semibold text-[#1a1a1a]">
          Default value
        </h3>
        <div className="mb-4 flex gap-3 rounded-lg border border-[#aecbfa] bg-[#e8f0fe] p-4">
          <Info className="h-5 w-5 shrink-0 text-[#0366d6]" />
          <p className="text-[12px] leading-relaxed text-[#1967d2]">
            This setting allows you to set a default value for this field, which
            will be automatically inserted to new content entries. It can help
            editors avoid content entry altogether or just give them a helpful
            prompt.
          </p>
        </div>
        <input
          type="number"
          step={integer ? 1 : "any"}
          value={local.defaultNumberStr}
          onChange={(e) =>
            setLocal((s) => ({
              ...s,
              defaultNumberStr: e.target.value,
            }))
          }
          className="w-full rounded-md border border-[#dadce0] px-3 py-2 text-[13px]"
        />
      </section>
    </CmsFieldEditorShell>
  );
}
