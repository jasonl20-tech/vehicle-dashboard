/**
 * AssetUrlInput — Text-Input mit Button "Aus Assets wählen", der den
 * `AssetPicker` öffnet und beim Pick die öffentliche URL einsetzt.
 *
 * Wird im Email-Builder bei Bild-/Avatar-/Video-URL-Feldern verwendet.
 */
import { Image as ImageIcon, X } from "lucide-react";
import { useState } from "react";
import AssetPicker from "./AssetPicker";

export type AssetUrlInputProps = {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  accept?: ("image/" | "video/" | "*")[];
  /** Initialer Folder im Picker. Standard: "email" */
  initialFolder?: string;
  /** Optionale Vorschau (Bild) unterhalb des Inputs. */
  preview?: boolean;
  className?: string;
};

export default function AssetUrlInput({
  value,
  onChange,
  placeholder = "https://…",
  accept = ["image/"],
  initialFolder = "email",
  preview = false,
  className = "",
}: AssetUrlInputProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`space-y-1 ${className}`}>
      <div className="flex items-stretch gap-1">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="min-w-0 flex-1 rounded-md border border-hair bg-white px-2 py-1 text-[12px] focus:border-ink-500 focus:outline-none"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            title="Leeren"
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-hair bg-white text-ink-500 hover:bg-neutral-50 hover:text-ink-900"
          >
            <X className="h-3 w-3" />
          </button>
        )}
        <button
          type="button"
          onClick={() => setOpen(true)}
          title="Aus Assets wählen"
          className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-hair bg-white px-2 text-[11.5px] font-medium text-ink-700 hover:bg-neutral-50"
        >
          <ImageIcon className="h-3 w-3" />
          Assets
        </button>
      </div>
      {preview && value && /^https?:\/\//.test(value) && (
        <div className="flex items-center justify-center overflow-hidden rounded-md border border-hair bg-neutral-50 p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="Vorschau"
            className="max-h-24 object-contain"
            onError={(e) => {
              (e.currentTarget.style as CSSStyleDeclaration).display = "none";
            }}
          />
        </div>
      )}
      <AssetPicker
        open={open}
        accept={accept}
        initialFolder={initialFolder}
        onPick={(asset) => onChange(asset.url)}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}
