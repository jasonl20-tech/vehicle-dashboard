import { ArrowLeft, ExternalLink, FileText, Loader2, Save } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  getAsset,
  isImage as isImageAsset,
  updateAsset,
  type Asset,
} from "../../lib/assetsApi";
import { CMS_ROOT } from "../../lib/cmsAccess";

function displayName(a: Asset): string {
  const t = a.title?.trim();
  if (t) return t;
  const n = a.name?.trim();
  if (n && n !== ".keep") return n;
  return "Ohne Titel";
}

function safeFmtRelative(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const diff = Date.now() - d.getTime();
  const sec = Math.round(diff / 1000);
  if (sec < 60) return `vor ${sec} s`;
  const min = Math.round(sec / 60);
  if (min < 60) return `vor ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `vor ${h} h`;
  const days = Math.round(h / 24);
  if (days < 45) return `vor ${days} T`;
  const months = Math.round(days / 30);
  return `vor ${months} Mon`;
}

/**
 * Asset-Detail — große Bildvorschau („Content“) und Metadaten rechts.
 * Route: `/cms/media/asset?key={encodeURIComponent(r2Key)}`
 */
export default function CmsMediaAssetPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const assetKey = (searchParams.get("key") ?? "").trim();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [asset, setAsset] = useState<Asset | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [altText, setAltText] = useState("");
  const [cmsStatus, setCmsStatus] = useState<"draft" | "published">("draft");

  const load = useCallback(async () => {
    if (!assetKey) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const a = await getAsset(assetKey);
      setAsset(a);
      setTitle(a.title ?? "");
      setDescription(a.description ?? "");
      setAltText(a.alt_text ?? "");
      setCmsStatus(a.cms_status);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setAsset(null);
    } finally {
      setLoading(false);
    }
  }, [assetKey]);

  useEffect(() => {
    if (!assetKey) {
      navigate(`${CMS_ROOT}/media`, { replace: true });
      return;
    }
    void load();
  }, [assetKey, load, navigate]);

  const baseline = useMemo(() => {
    if (!asset) return null;
    return {
      title: asset.title ?? "",
      description: asset.description ?? "",
      alt_text: asset.alt_text ?? "",
      cms_status: asset.cms_status,
    };
  }, [asset]);

  const dirty = useMemo(() => {
    if (!baseline) return false;
    return (
      title.trim() !== baseline.title.trim() ||
      description.trim() !== baseline.description.trim() ||
      altText.trim() !== baseline.alt_text.trim() ||
      cmsStatus !== baseline.cms_status
    );
  }, [altText, baseline, cmsStatus, description, title]);

  const onSave = async () => {
    if (!assetKey || !asset || !dirty) return;
    setSaving(true);
    setError(null);
    try {
      const nextTitle = title.trim() || null;
      const nextDesc = description.trim() || null;
      const nextAlt = altText.trim() || null;
      const updated = await updateAsset(assetKey, {
        title: nextTitle,
        description: nextDesc,
        alt_text: nextAlt,
        cms_status: cmsStatus,
      });
      setAsset(updated);
      setTitle(updated.title ?? "");
      setDescription(updated.description ?? "");
      setAltText(updated.alt_text ?? "");
      setCmsStatus(updated.cms_status);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  if (!assetKey) return null;

  return (
    <div className="flex min-h-[calc(100vh-6rem)] flex-col bg-[#f4f5f7] pb-10">
      <div className="border-b border-[#e8eaed] bg-white px-4 py-4 lg:px-8">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to={`${CMS_ROOT}/media`}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#dadce0] bg-white px-3 text-[13px] font-medium text-[#5f6368] hover:bg-[#f8f9fa]"
          >
            <ArrowLeft className="h-4 w-4" />
            Zur Medienliste
          </Link>
        </div>
      </div>

      <div className="mx-auto mt-6 w-full max-w-[1400px] px-4 lg:mt-8 lg:px-8">
        {loading ? (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-[#e8eaed] bg-white py-32 text-[#5f6368]">
            <Loader2 className="h-6 w-6 animate-spin" />
            Laden …
          </div>
        ) : error && !asset ? (
          <div className="space-y-3 rounded-xl border border-[#e8eaed] bg-white p-8">
            <p className="text-[14px] text-rose-700">{error}</p>
            <Link
              to={`${CMS_ROOT}/media`}
              className="inline-block text-[13px] font-medium text-[#0366d6] hover:underline"
            >
              Zurück zur Medienliste
            </Link>
          </div>
        ) : asset ? (
          <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch">
            {/* Haupt-„Content“: große Vorschau */}
            <section className="flex min-h-[380px] flex-1 flex-col rounded-2xl border border-[#e8eaed] bg-white shadow-sm lg:min-h-[min(88vh,920px)]">
              <div className="flex flex-1 flex-col items-center justify-center bg-[#f4f5f7] p-6 sm:p-10">
                {isImageAsset(asset) ? (
                  <img
                    src={asset.url}
                    alt={altText || displayName(asset)}
                    className="max-h-[min(82vh,860px)] w-full max-w-full object-contain shadow-sm"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center gap-4 py-16 text-[#80868b]">
                    <FileText className="h-20 w-20 opacity-70" />
                    <p className="text-[14px]">Keine Bildvorschau für diesen Dateityp</p>
                  </div>
                )}
              </div>
              <div className="border-t border-[#e8eaed] bg-white px-5 py-4">
                <p className="text-center font-mono text-[11px] leading-relaxed text-[#80868b] break-all">
                  {asset.key}
                </p>
                <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
                  <a
                    href={asset.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#dadce0] bg-white px-3 text-[13px] font-medium text-[#0366d6] hover:bg-[#f8f9fa]"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Original öffnen
                  </a>
                </div>
              </div>
            </section>

            {/* Seitenleiste: Metadaten */}
            <aside className="w-full shrink-0 rounded-2xl border border-[#e8eaed] bg-white p-5 shadow-sm lg:w-[min(100%,430px)] lg:p-6">
              <div className="border-b border-[#f1f3f4] pb-4">
                <h1 className="font-display text-xl font-semibold tracking-tight text-[#1a1a1a]">
                  {displayName(asset)}
                </h1>
                <p className="mt-2 text-[13px] text-[#5f6368]">
                  Metadaten für dieses Medium. Änderungen gelten für Einbindungen im CMS.
                </p>
              </div>

              {error ? (
                <p className="mt-4 text-[13px] text-rose-700">{error}</p>
              ) : null}

              <dl className="mt-5 space-y-3 border-b border-[#f1f3f4] pb-5 text-[13px]">
                <div className="flex justify-between gap-2">
                  <dt className="text-[#80868b]">Abmessungen</dt>
                  <dd className="text-right text-[#3c4043]">
                    {asset.width != null && asset.height != null
                      ? `${asset.width} × ${asset.height} px`
                      : "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[#80868b]">Aktualisiert</dt>
                  <dd className="text-right text-[#3c4043]">
                    {safeFmtRelative(asset.updated_at ?? asset.uploaded_at)}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[#80868b]">Hochgeladen von</dt>
                  <dd className="max-w-[55%] truncate text-right text-[#3c4043]">
                    {asset.uploaded_by_name ?? "—"}
                  </dd>
                </div>
              </dl>

              <div className="mt-6 space-y-5">
                <label className="block">
                  <span className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-[#80868b]">
                    Titel
                  </span>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={256}
                    className="h-11 w-full rounded-lg border border-[#dadce0] bg-white px-3 text-[14px] text-[#1a1a1a] outline-none focus:border-[#0366d6]"
                    placeholder="Anzeigename im CMS"
                  />
                  <span className="mt-1 block text-[11px] text-[#80868b]">
                    {title.length} / 256
                  </span>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-[#80868b]">
                    Beschreibung
                  </span>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={50000}
                    rows={4}
                    className="w-full resize-y rounded-lg border border-[#dadce0] bg-white px-3 py-2 text-[14px] text-[#1a1a1a] outline-none focus:border-[#0366d6]"
                    placeholder="Interne oder öffentliche Beschreibung"
                  />
                  <span className="mt-1 block text-[11px] text-[#80868b]">
                    {description.length} / 50 000
                  </span>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-[#80868b]">
                    Alt-Beschreibung
                  </span>
                  <input
                    value={altText}
                    onChange={(e) => setAltText(e.target.value)}
                    maxLength={2000}
                    className="h-11 w-full rounded-lg border border-[#dadce0] bg-white px-3 text-[14px] text-[#1a1a1a] outline-none focus:border-[#0366d6]"
                    placeholder="Kurzbeschreibung für Barrierefreiheit (img alt)"
                  />
                  <span className="mt-1 block text-[11px] text-[#80868b]">
                    {altText.length} / 2 000
                  </span>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-[#80868b]">
                    Status
                  </span>
                  <select
                    value={cmsStatus}
                    onChange={(e) =>
                      setCmsStatus(e.target.value as "draft" | "published")
                    }
                    className={`h-11 w-full rounded-lg border px-3 text-[14px] font-semibold outline-none ${
                      cmsStatus === "published"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                        : "border-amber-200 bg-amber-50 text-amber-950"
                    }`}
                  >
                    <option value="draft">Entwurf</option>
                    <option value="published">Veröffentlicht</option>
                  </select>
                </label>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-[#f1f3f4] pt-6">
                <button
                  type="button"
                  disabled={!dirty || saving}
                  onClick={() => void onSave()}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#0366d6] px-4 text-[13px] font-semibold text-white shadow-sm hover:bg-[#0256b9] disabled:opacity-45"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Speichern
                </button>
                {!dirty && !saving ? (
                  <span className="text-[12px] text-[#80868b]">Keine Änderungen</span>
                ) : null}
              </div>
            </aside>
          </div>
        ) : null}
      </div>
    </div>
  );
}
