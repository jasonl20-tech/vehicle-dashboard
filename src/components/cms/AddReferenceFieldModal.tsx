import { AlertTriangle, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  CMS_FIELD_ID_RE,
  type CmsFieldDefinition,
  type ReferenceFieldVariant,
  newReferenceFieldFromWizard,
} from "../../lib/cmsSchemaTypes";

type Props = {
  open: boolean;
  suggestedName: string;
  suggestedId: string;
  onClose: () => void;
  onChangeFieldType: () => void;
  onAddAndConfigure: (field: CmsFieldDefinition) => void;
};

export default function AddReferenceFieldModal({
  open,
  suggestedName,
  suggestedId,
  onClose,
  onChangeFieldType,
  onAddAndConfigure,
}: Props) {
  const [name, setName] = useState(suggestedName);
  const [id, setId] = useState(suggestedId);
  const [variant, setVariant] = useState<ReferenceFieldVariant>("one");
  const prevOpen = useRef(false);

  useEffect(() => {
    if (open && !prevOpen.current) {
      setName(suggestedName);
      setId(suggestedId);
      setVariant("one");
    }
    prevOpen.current = open;
  }, [open, suggestedName, suggestedId]);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  if (!open) return null;

  function submit() {
    const n = name.slice(0, 50).trim();
    const fid = id.slice(0, 64).trim();
    if (!n || !fid || !CMS_FIELD_ID_RE.test(fid)) return;
    onAddAndConfigure(
      newReferenceFieldFromWizard({ id: fid, name: n, variant }),
    );
  }

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Schließen"
        onClick={onClose}
      />
      <div className="relative max-h-[min(92vh,760px)] w-full max-w-[640px] overflow-hidden rounded-lg border border-[#dadce0] bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-[#dadce0] px-5 py-4">
          <h2 className="text-[15px] font-semibold text-[#1a1a1a]">
            Add field · Reference
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

        <div className="max-h-[min(70vh,560px)] overflow-y-auto px-5 py-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[12px] text-[#5f6368]">
                Name <span className="text-[#d93025]">*</span>
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 50))}
                className="w-full rounded border border-[#dadce0] px-3 py-2 text-[13px] outline-none focus:border-[#0366d6] focus:ring-1 focus:ring-[#0366d6]"
              />
              <div className="mt-1 flex justify-between text-[11px] text-[#5f6368]">
                <span>Appears in the entry editor</span>
                <span>{name.length} / 50</span>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[12px] text-[#5f6368]">
                Field ID
              </label>
              <input
                value={id}
                onChange={(e) => setId(e.target.value.slice(0, 64))}
                className="w-full rounded border border-[#dadce0] px-3 py-2 font-mono text-[13px] outline-none focus:border-[#0366d6] focus:ring-1 focus:ring-[#0366d6]"
              />
              <div className="mt-1 flex justify-between text-[11px] text-[#5f6368]">
                <span>Appears in API responses</span>
                <span>{id.length} / 64</span>
              </div>
            </div>
          </div>

          <div className="mt-5 flex gap-2 rounded-lg border border-[#f9ab00] bg-[#fef7e0] px-3 py-2.5 text-[12px] text-[#663c00]">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#f9ab00]" />
            <p className="font-medium">These settings cannot be changed later.</p>
          </div>

          <div className="mt-6 space-y-4">
            <p className="text-[12px] font-semibold text-[#1a1a1a]">Type</p>
            <label className="flex cursor-pointer gap-3 rounded-lg border border-transparent p-1 hover:bg-[#f8f9fa]">
              <input
                type="radio"
                name="refVariant"
                checked={variant === "one"}
                onChange={() => setVariant("one")}
                className="mt-1 accent-[#0366d6]"
              />
              <span>
                <span className="block text-[13px] font-medium text-[#1a1a1a]">
                  One reference
                </span>
                <span className="mt-0.5 block text-[12px] leading-snug text-[#5f6368]">
                  For example, a blog post can reference only one author.
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer gap-3 rounded-lg border border-transparent p-1 hover:bg-[#f8f9fa]">
              <input
                type="radio"
                name="refVariant"
                checked={variant === "many"}
                onChange={() => setVariant("many")}
                className="mt-1 accent-[#0366d6]"
              />
              <span>
                <span className="block text-[13px] font-medium text-[#1a1a1a]">
                  Many references
                </span>
                <span className="mt-0.5 block text-[12px] leading-snug text-[#5f6368]">
                  For example, a blog post can reference several authors. The
                  API response will include a separate block for each field.
                </span>
              </span>
            </label>
          </div>
        </div>

        <footer className="flex flex-wrap justify-end gap-2 border-t border-[#dadce0] bg-[#f8f9fa] px-5 py-3">
          <button
            type="button"
            onClick={() => {
              onClose();
              onChangeFieldType();
            }}
            className="rounded border border-[#dadce0] bg-white px-4 py-2 text-[13px] font-medium text-[#1a1a1a] hover:bg-[#f1f3f4]"
          >
            Change field type
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={
              !name.trim() ||
              !id.trim() ||
              !CMS_FIELD_ID_RE.test(id.trim())
            }
            className="rounded px-4 py-2 text-[13px] font-medium text-white hover:opacity-95 disabled:opacity-40"
            style={{ backgroundColor: "#007a33" }}
          >
            Add and configure
          </button>
        </footer>
      </div>
    </div>
  );
}
