import {
  ArrowLeft,
  ChevronDown,
  ExternalLink,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";
import AssetPicker from "../assets/AssetPicker";
import { CMS_ASSETS_FOLDER, CMS_ROOT } from "../../lib/cmsAccess";
import {
  datetimeLocalToIso,
  isoToDatetimeLocal,
  statusLabelDe,
} from "../../lib/cmsApi";
import {
  cmsMediaFieldKey,
  cmsMediaValueFromAsset,
  mergePayloadWithSchema,
  serializeEntryPayloadForApi,
  textMaxLength,
  validateEntryPayload,
} from "../../lib/cmsEntryPayload";
import type {
  CmsContentModelSchema,
  CmsFieldDefinition,
} from "../../lib/cmsSchemaTypes";
import { buildCmsPreviewUrl, FIELD_TYPE_LABELS } from "../../lib/cmsSchemaTypes";
import { extractPlainFromLexicalOrText } from "../../lib/lexicalRichText";
import { fmtRelative } from "../../lib/customerApi";
import { isImage, publicAssetUrl, type Asset } from "../../lib/assetsApi";
import LexicalRichTextField from "./LexicalRichTextField";

const SIDE_TAB_ACTIVE =
  "border-b-2 border-[#0366d6] pb-2.5 text-[12px] font-semibold text-[#0366d6]";
const SIDE_TAB_IDLE =
  "border-b-2 border-transparent pb-2.5 text-[12px] font-medium text-[#5f6368] hover:text-[#1a1a1a]";

type Props = {
  modelKey: string;
  schema: CmsContentModelSchema;
  contentId: string | null;
  /** Content-Modell-ID für API-Updates (nicht im UI änderbar). */
  selectedModelId: string;
  initialPayload: Record<string, unknown>;
  initialStatus: string;
  initialLocale: string;
  initialUpdatedAt: string | null;
  initialScheduledPublishAt: string | null;
  onCreate: (body: {
    payload: Record<string, unknown>;
    status: string;
    locale: string;
    scheduledPublishAt: string | null;
  }) => Promise<{ id: string; updated_at: string }>;
  onUpdate: (
    id: string,
    body: {
      payload: Record<string, unknown>;
      status: string;
      locale: string;
      contentModelId: string;
      scheduledPublishAt: string | null;
    },
  ) => Promise<{ updated_at: string; content_model_id: string }>;
};

export default function ContentEntryEditor({
  modelKey,
  schema,
  contentId,
  selectedModelId,
  initialPayload,
  initialStatus,
  initialLocale,
  initialUpdatedAt,
  initialScheduledPublishAt,
  onCreate,
  onUpdate,
}: Props) {
  const [payload, setPayload] = useState<Record<string, unknown>>(initialPayload);
  const [status, setStatus] = useState(initialStatus);
  const [locale] = useState(initialLocale);
  const [serverUpdatedAt, setServerUpdatedAt] = useState(initialUpdatedAt);
  const [scheduledLocal, setScheduledLocal] = useState(() =>
    isoToDatetimeLocal(initialScheduledPublishAt),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sideTab, setSideTab] = useState<"general" | "info">("general");

  useEffect(() => {
    setScheduledLocal(isoToDatetimeLocal(initialScheduledPublishAt));
  }, [initialScheduledPublishAt, contentId]);

  const entryTitle = useMemo(() => {
    for (const k of ["title", "name", "headline", "slug", "internalTitle"]) {
      const v = payload[k];
      if (typeof v === "string" && v.trim()) {
        const plain = extractPlainFromLexicalOrText(v).trim();
        if (plain) return plain.slice(0, 80);
      }
    }
    return contentId ? contentId.slice(0, 8) + "…" : "Neuer Eintrag";
  }, [payload, contentId]);

  const previewHref = useMemo(() => {
    const base = schema.previewBaseUrl?.trim();
    if (!base || !contentId) return null;
    return buildCmsPreviewUrl(base, {
      contentId,
      contentModelId: selectedModelId,
      modelKey,
      locale,
      deliveryEnvironment: schema.deliveryEnvironment,
    });
  }, [
    schema.previewBaseUrl,
    schema.deliveryEnvironment,
    contentId,
    selectedModelId,
    modelKey,
    locale,
  ]);

  const applyPayload = useCallback((p: Record<string, unknown>) => {
    setPayload(mergePayloadWithSchema(schema, p));
  }, [schema]);

  const saveWithStatus = async (nextStatus: string) => {
    const merged = mergePayloadWithSchema(schema, payload);
    const apiPayload = serializeEntryPayloadForApi(schema, merged);
    const ve = validateEntryPayload(schema, merged);
    if (ve.length > 0) {
      setFieldErrors(ve);
      setError(null);
      return;
    }
    setFieldErrors([]);
    setError(null);
    setSaving(true);
    try {
      const schedIso = datetimeLocalToIso(scheduledLocal);
      if (!contentId) {
        const row = await onCreate({
          payload: apiPayload,
          status: nextStatus,
          locale,
          scheduledPublishAt: schedIso,
        });
        setStatus(nextStatus);
        setServerUpdatedAt(row.updated_at);
        return;
      }
      const row = await onUpdate(contentId, {
        payload: apiPayload,
        status: nextStatus,
        locale,
        contentModelId: selectedModelId,
        scheduledPublishAt: schedIso,
      });
      setStatus(nextStatus);
      setServerUpdatedAt(row.updated_at);
      applyPayload(apiPayload);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const sl = status.toLowerCase();
  const statusBadgeClass =
    sl === "published"
      ? "bg-emerald-500/15 text-emerald-900"
      : sl === "archived"
        ? "bg-ink-200/80 text-ink-800"
        : sl === "scheduled"
          ? "bg-brand-500/15 text-brand-800"
          : "bg-orange-200/80 text-orange-950";

  return (
    <div className="-mx-6 min-h-[calc(100vh-6rem)] bg-[#f4f5f7] lg:-mx-8">
      {/* Sub-Header — Contentful-artig */}
      <div className="border-b border-[#e8eaed] bg-white px-4 py-3 lg:px-8">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to={`${CMS_ROOT}/entries`}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#5f6368] transition hover:bg-[#f1f3f4]"
            aria-label="Zurück zur Content-Liste"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0 flex-1 truncate text-[15px] font-semibold tracking-tight text-[#1a1a1a]">
            <span className="text-[#5f6368]">{modelKey}</span>
            <span className="mx-2 font-normal text-[#dadce0]">/</span>
            <span>{entryTitle}</span>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen((o) => !o)}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-[#dadce0] bg-white px-2.5 text-[12px] font-medium text-[#5f6368] hover:bg-[#f8f9fa] sm:px-3"
            aria-expanded={sidebarOpen}
            aria-controls="cms-entry-sidebar"
          >
            {sidebarOpen ? (
              <PanelRightClose className="h-4 w-4 shrink-0" aria-hidden />
            ) : (
              <PanelRightOpen className="h-4 w-4 shrink-0" aria-hidden />
            )}
            <span className="max-sm:sr-only">
              {sidebarOpen ? "Ausblenden" : "Seitenleiste"}
            </span>
          </button>
          {previewHref ? (
            <a
              href={previewHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-[#0366d6] bg-white px-2.5 text-[12px] font-medium text-[#0366d6] hover:bg-[#f0f7ff] sm:px-3"
            >
              <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
              <span className="max-sm:sr-only">Vorschau</span>
            </a>
          ) : schema.previewBaseUrl?.trim() && !contentId ? (
            <span
              className="inline-flex h-9 shrink-0 items-center rounded-lg border border-dashed border-[#dadce0] px-2.5 text-[11px] text-[#5f6368] sm:px-3"
              title="Zuerst speichern, um die Vorschau-URL mit contentId zu öffnen."
            >
              Vorschau nach Speichern
            </span>
          ) : null}
          {schema.deliveryEnvironment === "preview" ? (
            <span className="shrink-0 rounded-md bg-violet-500/15 px-2.5 py-1 text-[11px] font-semibold text-violet-950">
              Preview-Modell
            </span>
          ) : null}
          <span
            className={`shrink-0 rounded-md px-2.5 py-1 text-[11px] font-semibold ${statusBadgeClass}`}
          >
            {statusLabelDe(status)}
          </span>
        </div>
      </div>

      {error ? (
        <div className="px-4 py-3 lg:px-8">
          <pre className="whitespace-pre-wrap rounded-lg border border-rose-200 bg-rose-50/90 px-3 py-2 font-sans text-[13px] text-rose-900">
            {error}
          </pre>
        </div>
      ) : null}
      {fieldErrors.length > 0 ? (
        <div className="px-4 py-3 lg:px-8">
          <ul className="list-inside list-disc rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-[12px] text-amber-950">
            {fieldErrors.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div>
        <div className="flex flex-col xl:flex-row xl:items-stretch">
          {/* Editor-Hauptspalte */}
          <div className="min-w-0 flex-1 bg-white">
            <div className="px-4 py-8 lg:px-10 lg:py-10">
              {schema.fields.length === 0 ? (
                <p className="text-[14px] text-[#5f6368]">
                  Dieses Modell hat keine Felder — im Bereich Content-Modelle
                  Felder anlegen.
                </p>
              ) : (
                <div>
                  {schema.fields.map((f) => (
                    <div
                      key={f.id}
                      className="border-b border-[#e8eaed] py-8 first:pt-0 last:border-b-0 last:pb-0"
                    >
                      <EntryFieldBlock
                        field={f}
                        payload={payload}
                        locale={locale}
                        onChange={(id, v) =>
                          setPayload((prev) => ({ ...prev, [id]: v }))
                        }
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Rechte Sidebar — Contentful-artig */}
          {sidebarOpen ? (
            <aside
              id="cms-entry-sidebar"
              className="w-full shrink-0 border-t border-[#e8eaed] bg-white xl:w-[380px] xl:border-l xl:border-t-0"
            >
              <div className="sticky top-0 flex max-h-[calc(100vh-8rem)] flex-col xl:max-h-none">
                <div className="flex shrink-0 gap-6 border-b border-[#e8eaed] px-4 pt-4 lg:px-6">
                  <button
                    type="button"
                    onClick={() => setSideTab("general")}
                    className={
                      sideTab === "general" ? SIDE_TAB_ACTIVE : SIDE_TAB_IDLE
                    }
                  >
                    Allgemein
                  </button>
                  <button
                    type="button"
                    onClick={() => setSideTab("info")}
                    className={
                      sideTab === "info" ? SIDE_TAB_ACTIVE : SIDE_TAB_IDLE
                    }
                  >
                    Info
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 lg:p-6">
                  {sideTab === "general" ? (
                    <div className="space-y-5">
                      <div>
                        <p className="mb-2 text-[12px] font-medium text-[#1a1a1a]">
                          Status
                        </p>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[12px] text-[#5f6368]">
                            Aktuell
                          </span>
                          <span
                            className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${statusBadgeClass}`}
                          >
                            {statusLabelDe(status)}
                          </span>
                        </div>
                      </div>

                      <div>
                        <label
                          htmlFor="cms-scheduled-at"
                          className="mb-2 block text-[12px] font-medium text-[#1a1a1a]"
                        >
                          Geplant veröffentlichen
                        </label>
                        <input
                          id="cms-scheduled-at"
                          type="datetime-local"
                          value={scheduledLocal}
                          onChange={(e) => setScheduledLocal(e.target.value)}
                          disabled={saving}
                          className="w-full rounded-lg border border-[#dadce0] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#0366d6] disabled:opacity-50"
                        />
                        <button
                          type="button"
                          disabled={saving || !scheduledLocal}
                          onClick={() => setScheduledLocal("")}
                          className="mt-1.5 text-[11px] font-medium text-[#0366d6] hover:underline disabled:opacity-40"
                        >
                          Planung entfernen
                        </button>
                        <p className="mt-1.5 text-[11px] leading-snug text-[#5f6368]">
                          Erscheint unter „Geplant“, wenn gesetzt.
                        </p>
                      </div>

                      <div className="space-y-2 border-t border-[#e8eaed] pt-5">
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void saveWithStatus("published")}
                          className="flex w-full items-center justify-center gap-1 rounded-lg bg-emerald-600 py-2.5 text-[13px] font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                        >
                          Veröffentlichen
                          <ChevronDown
                            className="h-4 w-4 opacity-80"
                            aria-hidden
                          />
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void saveWithStatus("draft")}
                          className="w-full rounded-lg border border-[#dadce0] bg-white py-2.5 text-[13px] font-semibold text-[#1a1a1a] hover:bg-[#f8f9fa] disabled:opacity-50"
                        >
                          Als Entwurf speichern
                        </button>
                      </div>

                      <p className="text-[11px] text-[#80868b]">
                        {serverUpdatedAt
                          ? `Zuletzt gespeichert ${fmtRelative(serverUpdatedAt)}`
                          : "Noch nicht gespeichert"}
                      </p>
                    </div>
                  ) : (
                    <dl className="space-y-4 text-[13px]">
                      <div>
                        <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#80868b]">
                          Eintrag-ID
                        </dt>
                        <dd className="mt-1 font-mono text-[12px] text-[#1a1a1a]">
                          {contentId ?? "— (nach dem ersten Speichern)"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#80868b]">
                          Content-Typ
                        </dt>
                        <dd className="mt-1 text-[#1a1a1a]">{modelKey}</dd>
                      </div>
                      <div>
                        <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#80868b]">
                          Locale
                        </dt>
                        <dd className="mt-1 text-[#1a1a1a]">{locale}</dd>
                      </div>
                    </dl>
                  )}
                </div>
              </div>
            </aside>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Zeigt im Medien-Feld gespeicherte Metadaten-Snapshots aus dem Payload. */
function MediaFieldPayloadMeta({ raw }: { raw: unknown }) {
  if (raw == null || typeof raw !== "object" || !("key" in (raw as object))) {
    return null;
  }
  const o = raw as Record<string, unknown>;
  const title = o.title != null ? String(o.title).trim() : "";
  const altRaw = o.altText ?? o.alt_text;
  const alt = altRaw != null ? String(altRaw).trim() : "";
  const desc = o.description != null ? String(o.description).trim() : "";
  if (!title && !alt && !desc) return null;
  return (
    <div className="mt-2 rounded-lg border border-[#e8eaed] bg-[#fafbfc] px-3 py-2 text-[11px] text-[#5f6368]">
      {title ? (
        <div>
          <span className="font-semibold text-[#3c4043]">Titel:</span> {title}
        </div>
      ) : null}
      {alt ? (
        <div>
          <span className="font-semibold text-[#3c4043]">Alt:</span> {alt}
        </div>
      ) : null}
      {desc ? (
        <div className="line-clamp-3">
          <span className="font-semibold text-[#3c4043]">Beschreibung:</span>{" "}
          {desc}
        </div>
      ) : null}
    </div>
  );
}

function CmsMediaFieldInput({
  variant,
  raw,
  label,
  helpText,
  onChange,
}: {
  variant: "one" | "many";
  raw: unknown;
  label: ReactNode;
  helpText: string | null | undefined;
  onChange: (v: unknown) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTargetIndex, setPickerTargetIndex] = useState<number | null>(
    null,
  );

  function applyPick(asset: Asset) {
    const v = cmsMediaValueFromAsset(asset);
    if (variant === "one") {
      onChange(v);
      return;
    }
    const arr = Array.isArray(raw) ? [...(raw as unknown[])] : [];
    if (pickerTargetIndex !== null && pickerTargetIndex >= 0) {
      const next = [...arr];
      next[pickerTargetIndex] = v;
      onChange(next);
    } else {
      onChange([...arr, v]);
    }
    setPickerTargetIndex(null);
  }

  if (variant === "many") {
    const arr = Array.isArray(raw) ? [...(raw as unknown[])] : [];
    return (
      <>
        {label}
        <p className="mb-3 text-[12px] text-[#5f6368]">
          Dateien im R2-Bucket unter{" "}
          <code className="rounded bg-[#f1f3f4] px-1 font-mono text-[11px]">
            {CMS_ASSETS_FOLDER}/
          </code>
          . Über die Mediathek wählen oder Keys manuell eintragen.
        </p>
        <div className="space-y-2">
          {arr.map((item, i) => {
            const keyVal = cmsMediaFieldKey(item);
            return (
            <div
              key={i}
              className="flex flex-col gap-2 rounded-lg border border-[#e8eaed] bg-[#fafbfc] p-2"
            >
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={keyVal}
                onChange={(e) => {
                  const next = [...arr];
                  next[i] = e.target.value;
                  onChange(next);
                }}
                placeholder={`z. B. ${CMS_ASSETS_FOLDER}/bild.jpg`}
                className="min-w-[12rem] flex-1 rounded-lg border border-[#dadce0] bg-white px-3 py-2 font-mono text-[13px]"
              />
              <button
                type="button"
                onClick={() => {
                  setPickerTargetIndex(i);
                  setPickerOpen(true);
                }}
                className="shrink-0 rounded-lg border border-[#dadce0] bg-white px-3 py-2 text-[12px] font-medium text-[#1a1a1a] hover:bg-[#f8f9fa]"
              >
                Mediathek
              </button>
              <button
                type="button"
                onClick={() => onChange(arr.filter((_, j) => j !== i))}
                className="shrink-0 rounded-lg border border-[#dadce0] px-2.5 py-2 text-[12px] text-[#5f6368] hover:bg-rose-50 hover:text-rose-800"
                aria-label="Eintrag entfernen"
              >
                Entfernen
              </button>
            </div>
            <MediaFieldPayloadMeta raw={item} />
            </div>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onChange([...arr, ""])}
            className="rounded-lg border border-[#dadce0] bg-white px-3 py-2 text-[12px] font-medium text-[#1a1a1a] hover:bg-[#f8f9fa]"
          >
            Zeile hinzufügen
          </button>
          <button
            type="button"
            onClick={() => {
              setPickerTargetIndex(null);
              setPickerOpen(true);
            }}
            className="rounded-lg border border-[#0366d6] bg-[#0366d6]/10 px-3 py-2 text-[12px] font-medium text-[#0366d6] hover:bg-[#0366d6]/15"
          >
            Aus Mediathek anhängen
          </button>
        </div>
        {helpText ? (
          <p className="mt-2 text-[12px] text-ink-500">{helpText}</p>
        ) : null}
        <AssetPicker
          open={pickerOpen}
          accept={["*"]}
          initialFolder={CMS_ASSETS_FOLDER}
          rootFolder={CMS_ASSETS_FOLDER}
          title="CMS-Medium wählen"
          onPick={(a) => applyPick(a)}
          onClose={() => {
            setPickerOpen(false);
            setPickerTargetIndex(null);
          }}
        />
      </>
    );
  }

  const s = cmsMediaFieldKey(raw);
  const previewUrl = s ? publicAssetUrl(s) : "";
  const showPreview = Boolean(s && isImage({ content_type: "", name: s }));
  const imgAlt =
    raw != null &&
    typeof raw === "object" &&
    ("altText" in raw || "alt_text" in raw)
      ? String(
          (raw as Record<string, unknown>).altText ??
            (raw as Record<string, unknown>).alt_text ??
            "",
        ).trim()
      : "";

  return (
    <>
      {label}
      <p className="mb-2 text-[12px] text-[#5f6368]">
        R2-Schlüssel (z. B.{" "}
        <code className="rounded bg-[#f1f3f4] px-1 font-mono text-[11px]">
          {CMS_ASSETS_FOLDER}/datei.png
        </code>
        ). Über die Mediathek werden Titel, Alt und Beschreibung im Eintrag
        mitgespeichert.
      </p>
      <div className="flex flex-wrap items-start gap-2">
        <input
          value={s}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`${CMS_ASSETS_FOLDER}/…`}
          className="min-w-[12rem] flex-1 rounded-lg border border-[#dadce0] px-3 py-2.5 font-mono text-[14px]"
        />
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="shrink-0 rounded-lg border border-[#0366d6] bg-[#0366d6]/10 px-3 py-2.5 text-[13px] font-medium text-[#0366d6] hover:bg-[#0366d6]/15"
        >
          Mediathek
        </button>
      </div>
      <MediaFieldPayloadMeta raw={raw} />
      {showPreview ? (
        <a
          href={previewUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-block max-w-full"
        >
          <img
            src={previewUrl}
            alt={imgAlt}
            className="max-h-48 max-w-full rounded-lg border border-[#e8eaed] object-contain"
          />
        </a>
      ) : null}
      {s && !showPreview ? (
        <a
          href={previewUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block text-[12px] font-medium text-[#0366d6] hover:underline"
        >
          Öffentliche URL öffnen
        </a>
      ) : null}
      {helpText ? (
        <p className="mt-2 text-[12px] text-ink-500">{helpText}</p>
      ) : null}
      <AssetPicker
        open={pickerOpen}
        accept={["*"]}
        initialFolder={CMS_ASSETS_FOLDER}
        rootFolder={CMS_ASSETS_FOLDER}
        title="CMS-Medium wählen"
        onPick={(a) => applyPick(a)}
        onClose={() => setPickerOpen(false)}
      />
    </>
  );
}

function EntryFieldBlock({
  field: f,
  payload,
  locale,
  onChange,
}: {
  field: CmsFieldDefinition;
  payload: Record<string, unknown>;
  locale: string;
  onChange: (id: string, v: unknown) => void;
}) {
  const raw = payload[f.id];
  const requiredTag = f.required ? (
    <span className="font-normal text-[#c5221f]"> (erforderlich)</span>
  ) : null;

  const label = (
    <label className="mb-3 block">
      <span className="text-[14px] font-semibold text-[#1a1a1a]">
        {f.name}
        {f.localized ? (
          <span className="font-normal text-[#5f6368]"> | {locale}</span>
        ) : null}
        {requiredTag}
      </span>
      <span className="mt-1 block text-[11px] font-normal text-[#80868b]">
        {FIELD_TYPE_LABELS[f.type]}
      </span>
    </label>
  );

  if (f.type === "Text") {
    const max = f.list ? undefined : textMaxLength(f);
    if (f.list) {
      const arr = Array.isArray(raw) ? (raw as unknown[]) : [];
      const list: string[] = arr.map((x) => String(x));
      return (
        <>
          {label}
          <ul className="space-y-2">
            {list.map((line, i) => (
              <li key={i} className="flex gap-2">
                <input
                  value={line}
                  onChange={(e) => {
                    const next = [...list];
                    next[i] = e.target.value;
                    onChange(f.id, next);
                  }}
                  className="min-w-0 flex-1 rounded-lg border border-[#dadce0] px-3 py-2 text-[14px] outline-none ring-0 focus:border-[#0366d6]"
                />
                <button
                  type="button"
                  className="shrink-0 rounded-lg border border-hair px-2 text-[12px] text-ink-500 hover:bg-rose-50 hover:text-rose-700"
                  onClick={() => {
                    const next = list.filter((_, j) => j !== i);
                    onChange(f.id, next);
                  }}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="mt-2 text-[12px] font-medium text-[#0366d6] hover:underline"
            onClick={() => onChange(f.id, [...list, ""])}
          >
            + Eintrag
          </button>
          {f.helpText ? (
            <p className="mt-2 text-[12px] text-ink-500">{f.helpText}</p>
          ) : null}
        </>
      );
    }
    const s = raw == null ? "" : String(raw);
    return (
      <>
        {label}
        <input
          value={s}
          onChange={(e) => onChange(f.id, e.target.value)}
          className="w-full rounded-lg border border-[#dadce0] px-3 py-2.5 text-[14px] outline-none focus:border-[#0366d6]"
        />
        <div className="mt-1.5 flex justify-between text-[11px] text-ink-400">
          <span>{s.length} Zeichen</span>
          {max != null ? <span>Maximal {max} Zeichen</span> : null}
        </div>
        {f.helpText ? (
          <p className="mt-2 text-[12px] text-ink-500">{f.helpText}</p>
        ) : null}
      </>
    );
  }

  if (f.type === "RichText") {
    const s = raw == null ? "" : String(raw);
    return (
      <>
        {label}
        <LexicalRichTextField
          fieldId={f.id}
          value={s}
          onChange={(json) => onChange(f.id, json)}
          footer={
            f.helpText ? (
              <p className="mt-2 text-[12px] text-ink-500">{f.helpText}</p>
            ) : null
          }
        />
      </>
    );
  }

  if (f.type === "Number") {
    const v =
      typeof raw === "number"
        ? String(raw)
        : raw == null
          ? ""
          : String(raw);
    const step =
      f.numberShape?.variant === "decimal" ? "any" : "1";
    return (
      <>
        {label}
        <input
          type="number"
          step={step}
          value={v}
          onChange={(e) => onChange(f.id, e.target.value)}
          className="w-full max-w-md rounded-lg border border-[#dadce0] px-3 py-2.5 text-[14px] outline-none focus:border-[#0366d6]"
        />
        {f.helpText ? (
          <p className="mt-2 text-[12px] text-ink-500">{f.helpText}</p>
        ) : null}
      </>
    );
  }

  if (f.type === "DateTime") {
    const s = raw == null ? "" : String(raw);
    return (
      <>
        {label}
        <input
          type="datetime-local"
          value={s}
          onChange={(e) => onChange(f.id, e.target.value)}
          className="w-full max-w-md rounded-lg border border-[#dadce0] px-3 py-2.5 text-[14px] outline-none focus:border-[#0366d6]"
        />
        {f.helpText ? (
          <p className="mt-2 text-[12px] text-ink-500">{f.helpText}</p>
        ) : null}
      </>
    );
  }

  if (f.type === "Boolean") {
    const b = Boolean(raw);
    const cfg = f.boolean;
    return (
      <>
        {label}
        <div className="flex flex-wrap gap-4 text-[14px]">
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              checked={!b}
              onChange={() => onChange(f.id, false)}
              className="border-hair"
            />
            {cfg?.falseLabel ?? "Nein"}
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              checked={b}
              onChange={() => onChange(f.id, true)}
              className="border-hair"
            />
            {cfg?.trueLabel ?? "Ja"}
          </label>
        </div>
        {f.helpText ? (
          <p className="mt-2 text-[12px] text-ink-500">{f.helpText}</p>
        ) : null}
      </>
    );
  }

  if (f.type === "Location") {
    const lo = (raw && typeof raw === "object"
      ? (raw as Record<string, string>)
      : { lat: "", lon: "" }) ?? { lat: "", lon: "" };
    return (
      <>
        {label}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <span className="mb-1 block text-[11px] text-ink-500">
              Breitengrad
            </span>
            <input
              value={lo.lat ?? ""}
              onChange={(e) =>
                onChange(f.id, { ...lo, lat: e.target.value })
              }
              className="w-full rounded-lg border border-[#dadce0] px-3 py-2 text-[14px]"
            />
          </div>
          <div>
            <span className="mb-1 block text-[11px] text-ink-500">
              Längengrad
            </span>
            <input
              value={lo.lon ?? ""}
              onChange={(e) =>
                onChange(f.id, { ...lo, lon: e.target.value })
              }
              className="w-full rounded-lg border border-[#dadce0] px-3 py-2 text-[14px]"
            />
          </div>
        </div>
        {f.helpText ? (
          <p className="mt-2 text-[12px] text-ink-500">{f.helpText}</p>
        ) : null}
      </>
    );
  }

  if (f.type === "JsonObject") {
    const s = typeof raw === "string" ? raw : "{\n}";
    return (
      <>
        {label}
        <textarea
          value={s}
          onChange={(e) => onChange(f.id, e.target.value)}
          rows={8}
          className="w-full rounded-lg border border-[#dadce0] bg-[#f8f9fa] px-3 py-2 font-mono text-[12px]"
        />
        {f.helpText ? (
          <p className="mt-2 text-[12px] text-ink-500">{f.helpText}</p>
        ) : null}
      </>
    );
  }

  if (f.type === "Media") {
    return (
      <CmsMediaFieldInput
        variant={f.mediaShape?.variant === "many" ? "many" : "one"}
        raw={raw}
        label={label}
        helpText={f.helpText}
        onChange={(v) => onChange(f.id, v)}
      />
    );
  }

  if (f.type === "Reference") {
    if (f.referenceShape?.variant === "many") {
      const arr = Array.isArray(raw) ? (raw as unknown[]).map(String) : [];
      return (
        <>
          {label}
          <textarea
            value={arr.join(", ")}
            onChange={(e) =>
              onChange(
                f.id,
                e.target.value
                  .split(",")
                  .map((x) => x.trim())
                  .filter(Boolean),
              )
            }
            rows={2}
            placeholder="Entry-IDs, kommagetrennt"
            className="w-full rounded-lg border border-[#dadce0] px-3 py-2 font-mono text-[13px]"
          />
        </>
      );
    }
    const s = raw == null ? "" : String(raw);
    return (
      <>
        {label}
        <input
          value={s}
          onChange={(e) => onChange(f.id, e.target.value)}
          placeholder="Entry-ID"
          className="w-full rounded-lg border border-[#dadce0] px-3 py-2.5 font-mono text-[14px]"
        />
      </>
    );
  }

  return (
    <>
      {label}
      <p className="text-[12px] text-ink-500">Feldtyp nicht unterstützt.</p>
    </>
  );
}
