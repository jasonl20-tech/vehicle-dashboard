import { Info, LayoutGrid, Link2, X } from "lucide-react";
import CmsFieldEditorShell, {
  cmsFieldSectionDomId,
} from "./CmsFieldEditorShell";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import type {
  CmsFieldDefinition,
  CmsFieldValidations,
  ReferenceFieldConfig,
  ReferenceFieldWidget,
} from "../../lib/cmsSchemaTypes";
import {
  CMS_FIELD_ID_RE,
  defaultReferenceFieldConfig,
} from "../../lib/cmsSchemaTypes";

type SectionId = "name" | "settings" | "validation" | "default" | "appearance";

type Local = {
  name: string;
  id: string;
  required: boolean;
  localized: boolean;
  acceptOnlyEntryType: boolean;
  allowedTypes: string[];
  appearanceHelpText: string;
  widget: ReferenceFieldWidget;
  allowCreateNew: boolean;
  allowLinkExisting: boolean;
};

function cloneLocal(f: CmsFieldDefinition): Local {
  const ref = f.reference ?? defaultReferenceFieldConfig();
  const lct = f.validations?.linkContentType;
  const hasFilter = Array.isArray(lct) && lct.length > 0;
  return {
    name: f.name,
    id: f.id,
    required: f.required,
    localized: Boolean(f.localized),
    acceptOnlyEntryType: hasFilter,
    allowedTypes: hasFilter ? [...lct!] : [],
    appearanceHelpText: f.helpText ?? "",
    widget: ref.widget,
    allowCreateNew: ref.allowCreateNew,
    allowLinkExisting: ref.allowLinkExisting,
  };
}

function buildReferenceConfig(local: Local): ReferenceFieldConfig {
  return {
    widget: local.widget,
    allowCreateNew: local.allowCreateNew,
    allowLinkExisting: local.allowLinkExisting,
  };
}

type Props = {
  open: boolean;
  field: CmsFieldDefinition;
  /** Andere Content-Model-Keys (Referenz-Ziele) */
  otherModelKeys: string[];
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

const WIDGET_OPTIONS: {
  value: ReferenceFieldWidget;
  title: string;
  subtitle: string;
  defaultHint?: boolean;
  Icon: typeof Link2;
}[] = [
  {
    value: "entryLink",
    title: "Entry link",
    subtitle: "Compact link control to pick linked entries.",
    defaultHint: true,
    Icon: Link2,
  },
  {
    value: "entryCard",
    title: "Entry card",
    subtitle: "Rich card preview for linked entries.",
    Icon: LayoutGrid,
  },
];

const HEADER_TYPE_LABEL = "Link";

export default function ReferenceFieldModal({
  open,
  field,
  otherModelKeys,
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

  if (!open || field.type !== "Reference") return null;

  function applyClick() {
    const name = local.name.slice(0, 50).trim();
    const id = local.id.slice(0, 64).trim();
    if (!name || !id || !CMS_FIELD_ID_RE.test(id)) return;
    const help = local.appearanceHelpText.slice(0, 255).trim();
    const validations: CmsFieldValidations | undefined =
      local.acceptOnlyEntryType && local.allowedTypes.length > 0
        ? { linkContentType: [...local.allowedTypes] }
        : undefined;
    const next: CmsFieldDefinition = {
      ...field,
      name,
      id,
      required: local.required,
      localized: local.localized ? true : undefined,
      helpText: help || undefined,
      validations,
      reference: buildReferenceConfig(local),
      referenceShape: field.referenceShape,
    };
    onApply(next);
    onClose();
  }

  const cardinalityLabel =
    field.referenceShape?.variant === "many"
      ? "Many references"
      : "One reference";


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

  const yesNoRow = (
    title: string,
    desc: string,
    groupName: string,
    value: boolean,
    onChange: (v: boolean) => void,
  ) => (
    <div className="border-b border-[#e8eaed] py-4 last:border-b-0">
      <p className="mb-2 text-[13px] font-semibold text-[#1a1a1a]">{title}</p>
      <p className="mb-3 text-[12px] leading-snug text-[#5f6368]">{desc}</p>
      <div className="flex gap-6">
        <label className="inline-flex cursor-pointer items-center gap-2 text-[13px]">
          <input
            type="radio"
            name={groupName}
            className="accent-[#0366d6]"
            checked={value}
            onChange={() => onChange(true)}
          />
          Yes
        </label>
        <label className="inline-flex cursor-pointer items-center gap-2 text-[13px]">
          <input
            type="radio"
            name={groupName}
            className="accent-[#0366d6]"
            checked={!value}
            onChange={() => onChange(false)}
          />
          No
        </label>
      </div>
    </div>
  );

  function toggleAllowedType(key: string) {
    setLocal((s) => {
      const set = new Set(s.allowedTypes);
      if (set.has(key)) set.delete(key);
      else set.add(key);
      return { ...s, allowedTypes: [...set] };
    });
  }

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
                <p className="text-[12px] text-[#5f6368]">
                  Reference type:{" "}
                  <span className="font-medium text-[#1a1a1a]">
                    {cardinalityLabel}
                  </span>{" "}
                  (fixed after field creation)
                </p>
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
                  "Accept only specified entry type",
                  "Make this field only accept entries from specified content type(s).",
                  local.acceptOnlyEntryType,
                  (v) =>
                    setLocal((s) => ({
                      ...s,
                      acceptOnlyEntryType: v,
                      allowedTypes: v ? s.allowedTypes : [],
                    })),
                  local.acceptOnlyEntryType ? (
                    <div className="mt-3 ml-7">
                      {otherModelKeys.length === 0 ? (
                        <p className="text-[12px] text-[#5f6368]">
                          No other content types available yet — add another
                          model or disable this filter.
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {otherModelKeys.map((mk) => {
                            const checked = local.allowedTypes.includes(mk);
                            return (
                              <label
                                key={mk}
                                className="inline-flex items-center gap-2 rounded-md border border-[#dadce0] bg-white px-2.5 py-1.5 text-[12px]"
                              >
                                <input
                                  type="checkbox"
                                  className="rounded border-[#dadce0] accent-[#0366d6]"
                                  checked={checked}
                                  onChange={() => toggleAllowedType(mk)}
                                />
                                <code>{mk}</code>
                              </label>
                            );
                          })}
                        </div>
                      )}
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
                  <p className="mb-3 text-[12px] font-semibold text-[#5f6368]">
                    Widget
                  </p>
                  <div className="space-y-3">
                    {WIDGET_OPTIONS.map((opt) => {
                      const Icon = opt.Icon;
                      return (
                        <label
                          key={opt.value}
                          className={`flex cursor-pointer gap-3 rounded-lg border p-3 transition ${
                            local.widget === opt.value
                              ? "border-[#0366d6] bg-[#e8f0fe]/50"
                              : "border-[#dadce0] hover:bg-[#f8f9fa]"
                          }`}
                        >
                          <input
                            type="radio"
                            name="refWidget"
                            className="mt-1 accent-[#0366d6]"
                            checked={local.widget === opt.value}
                            onChange={() =>
                              setLocal((s) => ({ ...s, widget: opt.value }))
                            }
                          />
                          <div className="flex min-w-0 flex-1 gap-3">
                            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-md border border-[#dadce0] bg-white text-[#0366d6]">
                              <Icon className="h-6 w-6" aria-hidden />
                            </div>
                            <span>
                              <span className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-[#1a1a1a]">
                                {opt.title}
                                {opt.defaultHint ? (
                                  <span className="rounded bg-[#e8eaed] px-1.5 py-0 text-[10px] font-medium text-[#5f6368]">
                                    Default
                                  </span>
                                ) : null}
                              </span>
                              <span className="mt-0.5 block text-[12px] leading-snug text-[#5f6368]">
                                {opt.subtitle}
                              </span>
                            </span>
                          </div>
                        </label>
                      );
                    })}
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
                <div className="border-t border-[#e8eaed] pt-5">
                  <h4 className="mb-3 text-[13px] font-semibold text-[#1a1a1a]">
                    Editor behavior
                  </h4>
                  {yesNoRow(
                    'Show "Create new entries"',
                    "When enabled, people can create and link new entries (based on user permissions).",
                    "ref-create",
                    local.allowCreateNew,
                    (v) => setLocal((s) => ({ ...s, allowCreateNew: v })),
                  )}
                  {yesNoRow(
                    'Show "Link existing entries"',
                    "When enabled, people can link existing entries (based on user permissions).",
                    "ref-link",
                    local.allowLinkExisting,
                    (v) => setLocal((s) => ({ ...s, allowLinkExisting: v })),
                  )}
                </div>
              </div>
      </section>
    </CmsFieldEditorShell>
  );
}
