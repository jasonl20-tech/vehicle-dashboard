import { Info } from "lucide-react";
import CmsFieldEditorShell, {
  cmsFieldSectionDomId,
} from "./CmsFieldEditorShell";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import type {
  CmsFieldDefinition,
  MediaFieldConfig,
  MediaImageDimensionsValidation,
} from "../../lib/cmsSchemaTypes";
import {
  CMS_FIELD_ID_RE,
  defaultMediaFieldConfig,
} from "../../lib/cmsSchemaTypes";

type SectionId = "name" | "settings" | "validation" | "default";

type Local = {
  name: string;
  id: string;
  required: boolean;
  localized: boolean;
  helpText: string;
  allowCreateNew: boolean;
  allowLinkExisting: boolean;
  fileSizeEnabled: boolean;
  minBytes: string;
  maxBytes: string;
  fileTypesEnabled: boolean;
  fileTypesList: string;
  imageDimEnabled: boolean;
  minWidth: string;
  maxWidth: string;
  minHeight: string;
  maxHeight: string;
};

function parseOptionalInt(s: string): number | undefined {
  const t = s.trim();
  if (!t) return undefined;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.floor(n);
}

function buildMediaConfig(local: Local): MediaFieldConfig {
  const validation: MediaFieldConfig["validation"] = {};
  if (local.fileSizeEnabled) {
    const minB = parseOptionalInt(local.minBytes);
    const maxB = parseOptionalInt(local.maxBytes);
    validation.fileSize = {
      enabled: true,
      ...(minB !== undefined ? { minBytes: minB } : {}),
      ...(maxB !== undefined ? { maxBytes: maxB } : {}),
    };
  }
  if (local.fileTypesEnabled) {
    const types = local.fileTypesList
      .split(/[,;\s]+/)
      .map((x) => x.trim())
      .filter(Boolean);
    if (types.length > 0) {
      validation.fileTypes = { enabled: true, types };
    }
  }
  if (local.imageDimEnabled) {
    const o: MediaImageDimensionsValidation = { enabled: true };
    const mw = parseOptionalInt(local.minWidth);
    const xw = parseOptionalInt(local.maxWidth);
    const mh = parseOptionalInt(local.minHeight);
    const xh = parseOptionalInt(local.maxHeight);
    if (mw !== undefined) o.minWidth = mw;
    if (xw !== undefined) o.maxWidth = xw;
    if (mh !== undefined) o.minHeight = mh;
    if (xh !== undefined) o.maxHeight = xh;
    validation.imageDimensions = o;
  }
  return {
    validation,
    allowCreateNew: local.allowCreateNew,
    allowLinkExisting: local.allowLinkExisting,
  };
}

function cloneLocal(f: CmsFieldDefinition): Local {
  const cfg = f.media ?? defaultMediaFieldConfig();
  const fs = cfg.validation.fileSize;
  const ft = cfg.validation.fileTypes;
  const idim = cfg.validation.imageDimensions;
  return {
    name: f.name,
    id: f.id,
    required: f.required,
    localized: Boolean(f.localized),
    helpText: f.helpText ?? "",
    allowCreateNew: cfg.allowCreateNew,
    allowLinkExisting: cfg.allowLinkExisting,
    fileSizeEnabled: Boolean(fs?.enabled),
    minBytes: fs?.minBytes != null ? String(fs.minBytes) : "",
    maxBytes: fs?.maxBytes != null ? String(fs.maxBytes) : "",
    fileTypesEnabled: Boolean(ft?.enabled && ft.types.length > 0),
    fileTypesList: ft?.types?.length ? ft.types.join(", ") : "",
    imageDimEnabled: Boolean(idim?.enabled),
    minWidth: idim?.minWidth != null ? String(idim.minWidth) : "",
    maxWidth: idim?.maxWidth != null ? String(idim.maxWidth) : "",
    minHeight: idim?.minHeight != null ? String(idim.minHeight) : "",
    maxHeight: idim?.maxHeight != null ? String(idim.maxHeight) : "",
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
];

const HEADER_TYPE_LABEL = "Link";

export default function MediaFieldModal({
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

  if (!open || field.type !== "Media") return null;

  function applyClick() {
    const name = local.name.slice(0, 50).trim();
    const id = local.id.slice(0, 64).trim();
    if (!name || !id || !CMS_FIELD_ID_RE.test(id)) return;
    const helpText = local.helpText.slice(0, 255);
    const media = buildMediaConfig(local);
    const next: CmsFieldDefinition = {
      ...field,
      name,
      id,
      required: local.required,
      localized: local.localized ? true : undefined,
      helpText: helpText.trim() || undefined,
      media,
      mediaShape: field.mediaShape,
    };
    onApply(next);
    onClose();
  }

  const variantLabel =
    field.mediaShape?.variant === "many" ? "Many files" : "One file";


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
                  Media shape:{" "}
                  <span className="font-medium text-[#1a1a1a]">{variantLabel}</span>{" "}
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
                    className="w-full rounded-md border border-[#dadce0] px-3 py-2 text-[13px]"
                  />
                  <div className="mt-1 flex justify-between text-[11px] text-[#5f6368]">
                    <span>This help text will show up below the field.</span>
                    <span>{local.helpText.length} / 255</span>
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
                <div className="border-t border-[#e8eaed] pt-5">
                  <h4 className="mb-3 text-[13px] font-semibold text-[#1a1a1a]">
                    Editor behavior
                  </h4>
                  {yesNoRow(
                    'Show "Create new assets"',
                    "When enabled, people can create and link new assets (based on user permissions).",
                    "cms-media-create",
                    local.allowCreateNew,
                    (v) => setLocal((s) => ({ ...s, allowCreateNew: v })),
                  )}
                  {yesNoRow(
                    'Show "Link existing assets"',
                    "When enabled, people can link existing assets (based on user permissions).",
                    "cms-media-link",
                    local.allowLinkExisting,
                    (v) => setLocal((s) => ({ ...s, allowLinkExisting: v })),
                  )}
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
                  "Accept only specified file size",
                  "Specify a minimum and/or maximum allowed file size.",
                  local.fileSizeEnabled,
                  (v) =>
                    setLocal((s) => ({
                      ...s,
                      fileSizeEnabled: v,
                      minBytes: v ? s.minBytes : "",
                      maxBytes: v ? s.maxBytes : "",
                    })),
                  local.fileSizeEnabled ? (
                    <div className="mt-3 ml-7 grid max-w-lg gap-3 sm:grid-cols-2">
                      <div>
                        <span className="mb-1 block text-[11px] font-medium text-[#5f6368]">
                          Min size (bytes)
                        </span>
                        <input
                          type="number"
                          min={0}
                          className="w-full rounded-md border border-[#dadce0] px-2 py-1.5 text-[13px]"
                          value={local.minBytes}
                          onChange={(e) =>
                            setLocal((s) => ({
                              ...s,
                              minBytes: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div>
                        <span className="mb-1 block text-[11px] font-medium text-[#5f6368]">
                          Max size (bytes)
                        </span>
                        <input
                          type="number"
                          min={0}
                          className="w-full rounded-md border border-[#dadce0] px-2 py-1.5 text-[13px]"
                          value={local.maxBytes}
                          onChange={(e) =>
                            setLocal((s) => ({
                              ...s,
                              maxBytes: e.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>
                  ) : null,
                )}
                {valRow(
                  "Accept only specified file types",
                  "Make this field only accept specified file types (e.g. image/png, .pdf).",
                  local.fileTypesEnabled,
                  (v) =>
                    setLocal((s) => ({
                      ...s,
                      fileTypesEnabled: v,
                      fileTypesList: v ? s.fileTypesList : "",
                    })),
                  local.fileTypesEnabled ? (
                    <div className="mt-3 ml-7">
                      <input
                        value={local.fileTypesList}
                        onChange={(e) =>
                          setLocal((s) => ({
                            ...s,
                            fileTypesList: e.target.value,
                          }))
                        }
                        placeholder="image/png, image/jpeg, application/pdf"
                        className="w-full max-w-xl rounded border border-[#dadce0] px-2 py-1.5 text-[13px]"
                      />
                    </div>
                  ) : null,
                )}
                {valRow(
                  "Accept only specified image dimensions",
                  "Specify a minimum and/or maximum allowed image dimension.",
                  local.imageDimEnabled,
                  (v) =>
                    setLocal((s) => ({
                      ...s,
                      imageDimEnabled: v,
                      minWidth: v ? s.minWidth : "",
                      maxWidth: v ? s.maxWidth : "",
                      minHeight: v ? s.minHeight : "",
                      maxHeight: v ? s.maxHeight : "",
                    })),
                  local.imageDimEnabled ? (
                    <div className="mt-3 ml-7 grid max-w-2xl gap-3 sm:grid-cols-2">
                      {(
                        [
                          ["minWidth", "Min width (px)", local.minWidth],
                          ["maxWidth", "Max width (px)", local.maxWidth],
                          ["minHeight", "Min height (px)", local.minHeight],
                          ["maxHeight", "Max height (px)", local.maxHeight],
                        ] as const
                      ).map(([key, label, val]) => (
                        <div key={key}>
                          <span className="mb-1 block text-[11px] font-medium text-[#5f6368]">
                            {label}
                          </span>
                          <input
                            type="number"
                            min={0}
                            className="w-full rounded-md border border-[#dadce0] px-2 py-1.5 text-[13px]"
                            value={val}
                            onChange={(e) =>
                              setLocal((s) => ({
                                ...s,
                                [key]: e.target.value,
                              }))
                            }
                          />
                        </div>
                      ))}
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
                  <p className="text-[12px] leading-relaxed text-[#1967d2]">
                    Not available for this field type. You can only set a
                    default value for the text, boolean, date and time, and
                    number field types.
                  </p>
                </div>
              </div>
      </section>
    </CmsFieldEditorShell>
  );
}
