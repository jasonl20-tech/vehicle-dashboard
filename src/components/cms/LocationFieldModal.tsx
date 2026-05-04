import { Info } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { CmsFieldDefinition } from "../../lib/cmsSchemaTypes";
import { CMS_FIELD_ID_RE, FIELD_TYPE_LABELS } from "../../lib/cmsSchemaTypes";
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
};

function cloneLocal(f: CmsFieldDefinition): Local {
  return {
    name: f.name,
    id: f.id,
    required: f.required,
    localized: Boolean(f.localized),
    helpText: f.helpText ?? "",
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

export default function LocationFieldModal({
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

  if (!open || field.type !== "Location") return null;

  function applyClick() {
    const name = local.name.slice(0, 50).trim();
    const id = local.id.slice(0, 64).trim();
    if (!name || !id || !CMS_FIELD_ID_RE.test(id)) return;
    const helpText = local.helpText.slice(0, 255);
    const next: CmsFieldDefinition = {
      ...field,
      name,
      id,
      required: local.required,
      localized: local.localized ? true : undefined,
      helpText: helpText.trim() || undefined,
    };
    onApply(next);
    onClose();
  }

  return (
    <CmsFieldEditorShell
      open={open}
      fieldName={local.name}
      fieldNameFallback={field.name}
      typeLabel={FIELD_TYPE_LABELS.Location}
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
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-[#dadce0] accent-[#0366d6]"
            checked={local.required}
            onChange={(e) =>
              setLocal((s) => ({ ...s, required: e.target.checked }))
            }
          />
          <span>
            <span className="block text-[13px] font-semibold text-[#1a1a1a]">
              Required field
            </span>
            <span className="mt-0.5 block text-[12px] leading-snug text-[#5f6368]">
              You won&apos;t be able to publish an entry if this field is empty.
            </span>
          </span>
        </label>
      </section>

      <section id={cmsFieldSectionDomId("default")} className="scroll-mt-6">
        <h3 className="mb-4 text-[20px] font-semibold text-[#1a1a1a]">
          Default value
        </h3>
        <div className="flex gap-3 rounded-lg border border-[#aecbfa] bg-[#e8f0fe] p-4">
          <Info className="h-5 w-5 shrink-0 text-[#0366d6]" />
          <div>
            <p className="text-[13px] font-semibold text-[#174ea6]">
              Not available for this field type
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-[#1967d2]">
              You can only set a default value for the text, boolean, date and
              time, and number field types.
            </p>
          </div>
        </div>
      </section>
    </CmsFieldEditorShell>
  );
}
