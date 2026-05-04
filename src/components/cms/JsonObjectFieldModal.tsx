import { Braces, Info, X } from "lucide-react";
import CmsFieldEditorShell, {
  cmsFieldSectionDomId,
} from "./CmsFieldEditorShell";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import type {
  CmsFieldDefinition,
  JsonObjectFieldConfig,
} from "../../lib/cmsSchemaTypes";
import {
  CMS_FIELD_ID_RE,
  defaultJsonObjectFieldConfig,
} from "../../lib/cmsSchemaTypes";

type SectionId = "name" | "settings" | "validation" | "default" | "appearance";

type Local = {
  name: string;
  id: string;
  required: boolean;
  localized: boolean;
  propCountEnabled: boolean;
  minProps: string;
  maxProps: string;
  appearanceHelpText: string;
};

function parseOptionalInt(s: string): number | undefined {
  const t = s.trim();
  if (!t) return undefined;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.floor(n);
}

function buildJsonObjectConfig(local: Local): JsonObjectFieldConfig {
  const validation: JsonObjectFieldConfig["validation"] = {};
  if (local.propCountEnabled) {
    const min = parseOptionalInt(local.minProps);
    const max = parseOptionalInt(local.maxProps);
    validation.propertyCount = {
      enabled: true,
      ...(min !== undefined ? { min } : {}),
      ...(max !== undefined ? { max } : {}),
    };
  }
  return { validation };
}

function cloneLocal(f: CmsFieldDefinition): Local {
  const cfg = f.jsonObject ?? defaultJsonObjectFieldConfig();
  const pc = cfg.validation.propertyCount;
  return {
    name: f.name,
    id: f.id,
    required: f.required,
    localized: Boolean(f.localized),
    propCountEnabled: Boolean(pc?.enabled),
    minProps: pc?.min != null ? String(pc.min) : "",
    maxProps: pc?.max != null ? String(pc.max) : "",
    appearanceHelpText: f.helpText ?? "",
  };
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
  { id: "appearance", label: "Appearance" },
];

const HEADER_TYPE_LABEL = "Object";

export default function JsonObjectFieldModal({
  open,
  field,
  onClose,
  onApply,
}: Props) {
  const [local, setLocal] = useState<Local>(() => cloneLocal(field));
  const prevOpen = useRef(false);

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

  if (!open || field.type !== "JsonObject") return null;

  function applyClick() {
    const name = local.name.slice(0, 50).trim();
    const id = local.id.slice(0, 64).trim();
    if (!name || !id || !CMS_FIELD_ID_RE.test(id)) return;
    const help = local.appearanceHelpText.slice(0, 255).trim();
    const next: CmsFieldDefinition = {
      ...field,
      name,
      id,
      required: local.required,
      localized: local.localized ? true : undefined,
      helpText: help || undefined,
      jsonObject: buildJsonObjectConfig(local),
    };
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
      typeLabel={HEADER_TYPE_LABEL}
      navItems={NAV_ITEMS}
      onClose={onClose}
      onConfirm={applyClick}
    >
      <section
        id={cmsFieldSectionDomId("name")}
        className="scroll-mt-6 space-y-8"
      >
        <div className="max-w-xl space-y-8">
                <section>
                  <h3 className="mb-4 text-[20px] font-semibold text-[#1a1a1a]">
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
                </section>
              </div>
      </section>

      <section
        id={cmsFieldSectionDomId("settings")}
        className="scroll-mt-6 space-y-8"
      >
        <div className="max-w-xl space-y-6">
                <h3 className="text-[20px] font-semibold text-[#1a1a1a]">
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
                        All the content can be translated to configured
                        locales.
                      </span>
                    </span>
                  </label>
                </div>
              </div>
      </section>

      <section
        id={cmsFieldSectionDomId("validation")}
        className="scroll-mt-6 space-y-8"
      >
        <div className="max-w-2xl">
                <h3 className="mb-4 text-[20px] font-semibold text-[#1a1a1a]">
                  Validation
                </h3>
                {valRow(
                  "Required field",
                  "You won't be able to publish an entry if this field is empty.",
                  local.required,
                  (v) => setLocal((s) => ({ ...s, required: v })),
                )}
                {valRow(
                  "Limit number of properties",
                  "Specify a minimum and/or maximum allowed number of properties.",
                  local.propCountEnabled,
                  (v) =>
                    setLocal((s) => ({
                      ...s,
                      propCountEnabled: v,
                      minProps: v ? s.minProps : "",
                      maxProps: v ? s.maxProps : "",
                    })),
                  local.propCountEnabled ? (
                    <div className="mt-3 ml-7 grid max-w-lg gap-3 sm:grid-cols-2">
                      <div>
                        <span className="mb-1 block text-[11px] font-medium text-[#5f6368]">
                          Minimum
                        </span>
                        <input
                          type="number"
                          min={0}
                          className="w-full rounded-md border border-[#dadce0] px-2 py-1.5 text-[13px]"
                          value={local.minProps}
                          onChange={(e) =>
                            setLocal((s) => ({
                              ...s,
                              minProps: e.target.value,
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
                          min={0}
                          className="w-full rounded-md border border-[#dadce0] px-2 py-1.5 text-[13px]"
                          value={local.maxProps}
                          onChange={(e) =>
                            setLocal((s) => ({
                              ...s,
                              maxProps: e.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>
                  ) : null,
                )}
              </div>
      </section>

      <section
        id={cmsFieldSectionDomId("default")}
        className="scroll-mt-6 space-y-8"
      >
        <div className="max-w-xl">
                <h3 className="mb-4 text-[20px] font-semibold text-[#1a1a1a]">
                  Default value
                </h3>
                <div className="flex gap-3 rounded-lg border border-[#aecbfa] bg-[#e8f0fe] p-4">
                  <Info className="h-5 w-5 shrink-0 text-[#0366d6]" />
                  <div className="text-[12px] leading-relaxed text-[#1967d2]">
                    <p className="font-semibold">Not available for this field type</p>
                    <p className="mt-1">
                      You can only set a default value for the text, boolean,
                      date and time, and number field types.
                    </p>
                  </div>
                </div>
              </div>
      </section>

      <section
        id={cmsFieldSectionDomId("appearance")}
        className="scroll-mt-6 space-y-8"
      >
        <div className="max-w-xl space-y-8">
                <section>
                  <h3 className="mb-4 text-[20px] font-semibold text-[#1a1a1a]">
                    Appearance
                  </h3>
                  <div className="rounded-lg border border-[#0366d6] bg-[#e8f0fe]/40 p-4">
                    <div className="flex gap-3">
                      <input
                        type="radio"
                        name="jsonObjectWidget"
                        checked
                        disabled
                        className="mt-1 accent-[#0366d6]"
                        aria-label="Object (default widget)"
                      />
                      <div className="flex min-w-0 flex-1 gap-3">
                        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-md border border-[#dadce0] bg-white text-[#5f6368]">
                          <Braces className="h-7 w-7" aria-hidden />
                        </div>
                        <div>
                          <span className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-[#1a1a1a]">
                            Object
                            <span className="rounded bg-[#e8eaed] px-1.5 py-0 text-[10px] font-medium text-[#5f6368]">
                              Default
                            </span>
                          </span>
                          <span className="mt-0.5 block text-[12px] text-[#5f6368]">
                            Structured JSON key-value editor for this field.
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
                <section>
                  <h3 className="mb-2 text-[13px] font-semibold text-[#1a1a1a]">
                    Help text
                  </h3>
                  <input
                    value={local.appearanceHelpText}
                    onChange={(e) =>
                      setLocal((s) => ({
                        ...s,
                        appearanceHelpText: e.target.value.slice(0, 255),
                      }))
                    }
                    className="w-full rounded-md border border-[#dadce0] px-3 py-2 text-[13px]"
                  />
                  <div className="mt-1 flex justify-between text-[11px] text-[#5f6368]">
                    <span>This help text will show up below the field.</span>
                    <span>{local.appearanceHelpText.length} / 255</span>
                  </div>
                </section>
              </div>
      </section>
    </CmsFieldEditorShell>
  );
}
