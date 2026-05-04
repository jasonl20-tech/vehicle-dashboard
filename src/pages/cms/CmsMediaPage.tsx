import AssetBrowser from "../../components/assets/AssetBrowser";
import { CMS_ASSETS_FOLDER } from "../../lib/cmsAccess";

/**
 * CMS-Medien: gleicher R2-Bucket wie der Asset-Manager (`env.assets`),
 * alle Keys unter dem Prefix {@link CMS_ASSETS_FOLDER}.
 */
export default function CmsMediaPage() {
  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col">
      <header className="mb-4 shrink-0">
        <h1 className="font-display text-[28px] font-semibold tracking-tighter2 text-ink-900 sm:text-[32px]">
          Medien
        </h1>
        <p className="mt-2 max-w-2xl text-[14px] text-ink-500">
          Dateien liegen im Bucket <code className="rounded bg-ink-100 px-1 py-0.5 text-[13px]">env.assets</code> unter{" "}
          <code className="rounded bg-ink-100 px-1 py-0.5 text-[13px]">{CMS_ASSETS_FOLDER}/</code>{" "}
          (öffentlich über die Asset-Domain).
        </p>
      </header>

      <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-hair bg-white">
        <div className="h-[min(70vh,52rem)] min-h-[20rem]">
          <AssetBrowser
            mode="manage"
            initialFolder={CMS_ASSETS_FOLDER}
            rootFolder={CMS_ASSETS_FOLDER}
            className="h-full"
          />
        </div>
      </div>
    </div>
  );
}
