import {
  Braces,
  Calendar,
  FileText,
  Hash,
  Image as ImageIcon,
  Link2,
  MapPin,
  ToggleLeft,
  Type as TypeIcon,
  X,
} from "lucide-react";
import { useEffect } from "react";
import type { CmsFieldType } from "../../lib/cmsSchemaTypes";
import {
  CMS_FIELD_TYPES,
  FIELD_TYPE_HELP,
  FIELD_TYPE_LABELS,
} from "../../lib/cmsSchemaTypes";

const ICONS: Record<CmsFieldType, typeof FileText> = {
  RichText: FileText,
  Text: TypeIcon,
  Number: Hash,
  DateTime: Calendar,
  Location: MapPin,
  Media: ImageIcon,
  Boolean: ToggleLeft,
  JsonObject: Braces,
  Reference: Link2,
};

type Props = {
  open: boolean;
  onClose: () => void;
  onPick: (type: CmsFieldType) => void;
};

export default function AddFieldModal({ open, onClose, onPick }: Props) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cms-add-field-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-night-900/45 backdrop-blur-[2px]"
        aria-label="Schließen"
        onClick={onClose}
      />
      <div className="relative max-h-[min(90vh,640px)] w-full max-w-[680px] overflow-hidden rounded-2xl border border-hair bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-hair px-5 py-4">
          <h2
            id="cms-add-field-title"
            className="font-display text-lg font-semibold text-ink-900"
          >
            Neues Feld
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-500 transition hover:bg-ink-50 hover:text-ink-900"
            aria-label="Schließen"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[min(72vh,520px)] overflow-y-auto p-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CMS_FIELD_TYPES.map((type) => {
              const Icon = ICONS[type];
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    onPick(type);
                    onClose();
                  }}
                  className="flex flex-col items-start rounded-xl border border-hair bg-white p-4 text-left transition hover:border-ink-300 hover:bg-ink-50/50"
                >
                  <div className="mb-3 grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-ink-900 text-white">
                    <Icon className="h-5 w-5" aria-hidden />
                  </div>
                  <span className="text-[13px] font-semibold text-ink-900">
                    {FIELD_TYPE_LABELS[type]}
                  </span>
                  <span className="mt-1 text-[11.5px] leading-snug text-ink-500">
                    {FIELD_TYPE_HELP[type]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
