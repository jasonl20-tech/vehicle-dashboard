import { Info, X } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import type {
  BooleanFieldConfig,
  BooleanFieldWidget,
  CmsFieldDefinition,
} from "../../lib/cmsSchemaTypes";
import {
  CMS_FIELD_ID_RE,
  defaultBooleanFieldConfig,
} from "../../lib/cmsSchemaTypes";
import CmsFieldEditorShell, {
  cmsFieldSectionDomId,
} from "./CmsFieldEditorShell";

type SectionId = "name" | "settings" | "validation" | "default" | "appearance";

type DefaultMode = "unset" | "yes" | "no";

type Local = {
  name: string;
  id: string;
  required: boolean;
  localized: boolean;
  defaultMode: DefaultMode;
  showDefaultInfo: boolean;
  widget: BooleanFieldWidget;
  appearanceHelpText: string;
  trueLabel: string;
  falseLabel: string;
};

function cloneLocal(f: CmsFieldDefinition): Local {
  const cfg = f.boolean ?? defaultBooleanFieldConfig();
  let defaultMode: DefaultMode = "unset";
  if (f.defaultBoolean === true) defaultMode = "yes";
  else if (f.defaultBoolean === false) defaultMode = "no";
  return {
    name: f.name,
    id: f.id,
    required: f.required,
    localized: Boolean(f.localized),
    defaultMode,
    showDefaultInfo: true,
    widget: cfg.widget,
    appearanceHelpText: f.helpText ?? "",
    trueLabel: cfg.trueLabel,
    falseLabel: cfg.falseLabel,
  };
}

function buildBooleanConfig(local: Local): BooleanFieldConfig {
  const t = local.trueLabel.slice(0, 255).trim() || "Yes";
  const fl = local.falseLabel.slice(0, 255).trim() || "No";
  return {
    widget: local.widget,
    trueLabel: t,
    falseLabel: fl,
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

const WIDGET_OPTIONS: {
  value: BooleanFieldWidget;
  title: string;
  subtitle: string;
  defaultHint?: boolean;
}[] = [
  {
    value: "radio",
    title: "Radio",
    subtitle: "Two options as radio buttons with custom labels.",
    defaultHint: true,
  },
  {
    value: "dropdown",
    title: "Dropdown",
    subtitle: "Select true or false from a dropdown list.",
  },
  {
    value: "toggle",
    title: "Boolean",
    subtitle: "A toggle switch for quick yes/no input.",
  },
];

const HEADER_TYPE_LABEL = "Boolean";

export default function BooleanFieldModal({
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

  if (!open || field.type !== "Boolean") return null;

  function applyClick() {
    const name = local.name.slice(0, 50).trim();
    const id = local.id.slice(0, 64).trim();
    if (!name || !id || !CMS_FIELD_ID_RE.test(id)) return;
    const help = local.appearanceHelpText.slice(0, 255).trim();
    const defaultBoolean =
      local.defaultMode === "yes"
        ? true
        : local.defaultMode === "no"
          ? false
          : undefined;
    const next: CmsFieldDefinition = {
      ...field,
      name,
      id,
      required: local.required,
      localized: local.localized ? true : undefined,
      helpText: help || undefined,
      defaultBoolean,
      boolean: buildBooleanConfig(local),
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
        <div>
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
        {valRow(
          "Required field",
          "You won't be able to publish an entry if this field is empty.",
          local.required,
          (v) => setLocal((s) => ({ ...s, required: v })),
        )}
      </section>

      <section id={cmsFieldSectionDomId("default")} className="scroll-mt-6">
        <h3 className="mb-4 text-[20px] font-semibold text-[#1a1a1a]">
          Default value
        </h3>
        {local.showDefaultInfo ? (
          <div className="relative mb-4 flex gap-3 rounded-lg border border-[#aecbfa] bg-[#e8f0fe] p-4 pr-10">
            <Info className="h-5 w-5 shrink-0 text-[#0366d6]" />
            <p className="text-[12px] leading-relaxed text-[#1967d2]">
              This setting allows you to set a default value for this field,
              which will be automatically inserted to new content entries. It
              can help editors avoid content entry altogether, or just give
              them a helpful prompt for how to structure their content.
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
        <div className="space-y-3">
          <p className="text-[12px] font-medium text-[#5f6368]">
            Default for new entries
          </p>
          <label className="flex cursor-pointer gap-3 rounded-lg border border-transparent p-1 hover:bg-[#f8f9fa]">
            <input
              type="radio"
              name="boolDefault"
              className="mt-1 accent-[#0366d6]"
              checked={local.defaultMode === "unset"}
              onChange={() =>
                setLocal((s) => ({ ...s, defaultMode: "unset" }))
              }
            />
            <span className="text-[13px] text-[#1a1a1a]">
              No default (editors choose)
            </span>
          </label>
          <label className="flex cursor-pointer gap-3 rounded-lg border border-transparent p-1 hover:bg-[#f8f9fa]">
            <input
              type="radio"
              name="boolDefault"
              className="mt-1 accent-[#0366d6]"
              checked={local.defaultMode === "yes"}
              onChange={() => setLocal((s) => ({ ...s, defaultMode: "yes" }))}
            />
            <span className="text-[13px] text-[#1a1a1a]">Yes</span>
          </label>
          <label className="flex cursor-pointer gap-3 rounded-lg border border-transparent p-1 hover:bg-[#f8f9fa]">
            <input
              type="radio"
              name="boolDefault"
              className="mt-1 accent-[#0366d6]"
              checked={local.defaultMode === "no"}
              onChange={() => setLocal((s) => ({ ...s, defaultMode: "no" }))}
            />
            <span className="text-[13px] text-[#1a1a1a]">No</span>
          </label>
        </div>
      </section>

      <section
        id={cmsFieldSectionDomId("appearance")}
        className="scroll-mt-6 space-y-8"
      >
        <div>
          <h3 className="mb-4 text-[20px] font-semibold text-[#1a1a1a]">
            Appearance
          </h3>
          <p className="mb-3 text-[13px] font-semibold text-[#5f6368]">Widget</p>
          <div className="space-y-3">
            {WIDGET_OPTIONS.map((opt) => (
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
                  name="boolWidget"
                  className="mt-1 accent-[#0366d6]"
                  checked={local.widget === opt.value}
                  onChange={() =>
                    setLocal((s) => ({ ...s, widget: opt.value }))
                  }
                />
                <span>
                  <span className="flex items-center gap-2 text-[13px] font-semibold text-[#1a1a1a]">
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
              </label>
            ))}
          </div>
        </div>
        <div>
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
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[13px] font-medium text-[#1a1a1a]">
              True condition custom label
            </label>
            <input
              value={local.trueLabel}
              onChange={(e) =>
                setLocal((s) => ({
                  ...s,
                  trueLabel: e.target.value.slice(0, 255),
                }))
              }
              className="w-full rounded-md border border-[#dadce0] px-3 py-2 text-[13px]"
            />
            <div className="mt-1 text-right text-[11px] text-[#5f6368]">
              {local.trueLabel.length} / 255
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[13px] font-medium text-[#1a1a1a]">
              False condition custom label
            </label>
            <input
              value={local.falseLabel}
              onChange={(e) =>
                setLocal((s) => ({
                  ...s,
                  falseLabel: e.target.value.slice(0, 255),
                }))
              }
              className="w-full rounded-md border border-[#dadce0] px-3 py-2 text-[13px]"
            />
            <div className="mt-1 text-right text-[11px] text-[#5f6368]">
              {local.falseLabel.length} / 255
            </div>
          </div>
        </div>
      </section>
    </CmsFieldEditorShell>
  );
}
