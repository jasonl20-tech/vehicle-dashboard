import { Info, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { CmsFieldDefinition } from "../../lib/cmsSchemaTypes";
import { CMS_FIELD_ID_RE, FIELD_TYPE_LABELS } from "../../lib/cmsSchemaTypes";

type Tab = "name" | "settings" | "validation" | "default";

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

const TAB_ITEMS: { id: Tab; label: string }[] = [
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
      <div className="relative flex max-h-[min(92vh,820px)] w-full max-w-[960px] flex-col overflow-hidden rounded-lg border border-[#dadce0] bg-white shadow-2xl">
        <header className="flex shrink-0 items-center justify-between border-b border-[#dadce0] px-5 py-4">
          <h2 className="text-[15px] font-semibold text-[#1a1a1a]">
            <span className="font-normal text-[#5f6368]">
              {local.name || field.name}
            </span>{" "}
            <span className="text-[#5f6368]">
              {FIELD_TYPE_LABELS.Location}
            </span>
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
              </div>
            )}

            {tab === "validation" && (
              <div className="max-w-2xl">
                <h3 className="mb-4 text-[18px] font-semibold text-[#1a1a1a]">
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
                      You won&apos;t be able to publish an entry if this field
                      is empty.
                    </span>
                  </span>
                </label>
              </div>
            )}

            {tab === "default" && (
              <div className="max-w-xl">
                <h3 className="mb-4 text-[18px] font-semibold text-[#1a1a1a]">
                  Default value
                </h3>
                <div className="flex gap-3 rounded-lg border border-[#aecbfa] bg-[#e8f0fe] p-4">
                  <Info className="h-5 w-5 shrink-0 text-[#0366d6]" />
                  <div>
                    <p className="text-[13px] font-semibold text-[#174ea6]">
                      Not available for this field type
                    </p>
                    <p className="mt-1 text-[12px] leading-relaxed text-[#1967d2]">
                      You can only set a default value for the text, boolean,
                      date and time, and number field types.
                    </p>
                  </div>
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
