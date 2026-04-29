/**
 * AssetPicker — Modal zum Auswählen einer Datei aus dem R2-Bucket
 * (`env.assets`, Custom-Domain `assets.vehicleimagery.com`).
 *
 * Verwendet `AssetBrowser` im `mode="pick"`, also nur Lese-/Auswahl-
 * Modus. Beim Klick auf eine Datei wird `onPick` aufgerufen mit dem
 * vollständigen Asset-Datensatz inkl. öffentlicher URL.
 *
 * Beispiel:
 *   <AssetPicker
 *     open={pickerOpen}
 *     accept={["image/"]}
 *     initialFolder="email"
 *     onPick={(asset) => setImageUrl(asset.url)}
 *     onClose={() => setPickerOpen(false)}
 *   />
 */
import { useEffect } from "react";
import AssetBrowser from "./AssetBrowser";
import type { Asset } from "../../lib/assetsApi";

export type AssetPickerProps = {
  open: boolean;
  /** MIME-Type-Präfix-Filter. */
  accept?: ("image/" | "video/" | "*")[];
  /** Initialer Folder-Pfad (z. B. "email"). */
  initialFolder?: string;
  /** Optional: Title oben im Modal. */
  title?: string;
  onPick: (asset: Asset) => void;
  onClose: () => void;
};

export default function AssetPicker({
  open,
  accept,
  initialFolder = "email",
  title = "Asset auswählen",
  onPick,
  onClose,
}: AssetPickerProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-stretch justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="my-auto flex h-[80vh] w-full max-w-[1200px] flex-col overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-neutral-900">
        <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-2.5 dark:border-neutral-800">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            {title}
          </h2>
          <span className="text-xs text-neutral-500">
            ESC oder außerhalb klicken zum Schließen
          </span>
        </header>
        <div className="flex min-h-0 flex-1">
          <AssetBrowser
            mode="pick"
            accept={accept}
            initialFolder={initialFolder}
            onPick={(a) => {
              onPick(a);
              onClose();
            }}
            onClose={onClose}
          />
        </div>
      </div>
    </div>
  );
}
