import { ArrowLeft, ChevronDown } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CMS_ROOT } from "../../lib/cmsAccess";
import {
  datetimeLocalToIso,
  isoToDatetimeLocal,
  statusLabelDe,
} from "../../lib/cmsApi";
import {
  mergePayloadWithSchema,
  serializeEntryPayloadForApi,
  textMaxLength,
  validateEntryPayload,
} from "../../lib/cmsEntryPayload";
import type {
  CmsContentModelSchema,
  CmsFieldDefinition,
} from "../../lib/cmsSchemaTypes";
import { FIELD_TYPE_LABELS } from "../../lib/cmsSchemaTypes";
import { extractPlainFromLexicalOrText } from "../../lib/lexicalRichText";
import { fmtRelative } from "../../lib/customerApi";
import LexicalRichTextField from "./LexicalRichTextField";

const MAIN_TAB_ACTIVE =
  "border-b-2 border-[#0366d6] pb-3 text-[13px] font-semibold text-[#0366d6]";
const MAIN_TAB_IDLE =
  "border-b-2 border-transparent pb-3 text-[13px] font-medium text-[#5f6368] hover:text-[#1a1a1a]";
const SIDE_TAB_ACTIVE =
  "border-b-2 border-[#0366d6] pb-2.5 text-[12px] font-semibold text-[#0366d6]";
const SIDE_TAB_IDLE =
  "border-b-2 border-transparent pb-2.5 text-[12px] font-medium text-[#5f6368] hover:text-[#1a1a1a]";

type Props = {
  modelKey: string;
  schema: CmsContentModelSchema;
  contentId: string | null;
  /** Aktuell gewähltes Content-Modell (bearbeitbar bei bestehendem Eintrag). */
  selectedModelId: string;
  onSelectedModelIdChange: (id: string) => void;
  modelOptions: { id: string; key: string }[];
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
  onSelectedModelIdChange,
  modelOptions,
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
  const [mainTab, setMainTab] = useState<
    "editor" | "references" | "taxonomy" | "tags"
  >("editor");
  const [sideTab, setSideTab] = useState<"general" | "info">("general");

  const referenceFields = useMemo(
    () => schema.fields.filter((f) => f.type === "Reference"),
    [schema.fields],
  );

  useEffect(() => {
    setScheduledLocal(isoToDatetimeLocal(initialScheduledPublishAt));
  }, [initialScheduledPublishAt, contentId]);

  const resolvedModelKey = useMemo(() => {
    const hit = modelOptions.find((m) => m.id === selectedModelId);
    return hit?.key ?? modelKey;
  }, [modelOptions, selectedModelId, modelKey]);

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
      onSelectedModelIdChange(row.content_model_id);
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
            <span className="text-[#5f6368]">{resolvedModelKey}</span>
            <span className="mx-2 font-normal text-[#dadce0]">/</span>
            <span>{entryTitle}</span>
          </div>
          <span
            className={`shrink-0 rounded-md px-2.5 py-1 text-[11px] font-semibold ${statusBadgeClass}`}
          >
            {statusLabelDe(status)}
          </span>
        </div>
      </div>

      {/* Haupt-Tabs */}
      <div className="flex flex-wrap gap-6 border-b border-[#e8eaed] bg-white px-4 lg:gap-8 lg:px-8">
        <button
          type="button"
          onClick={() => setMainTab("editor")}
          className={mainTab === "editor" ? MAIN_TAB_ACTIVE : MAIN_TAB_IDLE}
        >
          Editor
        </button>
        <button
          type="button"
          onClick={() => setMainTab("references")}
          className={
            mainTab === "references" ? MAIN_TAB_ACTIVE : MAIN_TAB_IDLE
          }
        >
          Referenzen
          {referenceFields.length > 0 ? (
            <span className="ml-1 text-[#80868b]">
              ({referenceFields.length})
            </span>
          ) : null}
        </button>
        <button
          type="button"
          onClick={() => setMainTab("taxonomy")}
          className={mainTab === "taxonomy" ? MAIN_TAB_ACTIVE : MAIN_TAB_IDLE}
        >
          Taxonomie
        </button>
        <button
          type="button"
          onClick={() => setMainTab("tags")}
          className={mainTab === "tags" ? MAIN_TAB_ACTIVE : MAIN_TAB_IDLE}
        >
          Tags
        </button>
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
            {mainTab === "editor" ? (
              <div className="px-4 py-8 lg:px-10 lg:py-10">
                {schema.fields.length === 0 ? (
                  <p className="text-[14px] text-[#5f6368]">
                    Dieses Modell hat keine Felder — im Bereich Content-Modelle
                    Felder anlegen.
                  </p>
                ) : schema.fields.every((f) => f.type === "Reference") ? (
                  <p className="text-[14px] text-[#5f6368]">
                    Alle Felder dieses Modells sind Referenzen — bitte den Tab
                    „Referenzen“ öffnen.
                  </p>
                ) : (
                  <div>
                    {schema.fields
                      .filter((f) => f.type !== "Reference")
                      .map((f) => (
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
            ) : mainTab === "references" ? (
              <div className="px-4 py-8 lg:px-10 lg:py-10">
                {referenceFields.length === 0 ? (
                  <p className="text-[14px] text-[#5f6368]">
                    Keine Referenzfelder in diesem Content-Typ.
                  </p>
                ) : (
                  <div className="space-y-0">
                    {referenceFields.map((f) => (
                      <div
                        key={f.id}
                        className="border-b border-[#e8eaed] py-8 first:pt-0 last:border-b-0"
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
            ) : (
              <div className="px-4 py-10 lg:px-10">
                <p className="text-[14px] text-[#5f6368]">
                  {mainTab === "taxonomy"
                    ? "Taxonomien sind für dieses Projekt noch nicht angebunden."
                    : "Tags können hier später ergänzt werden."}
                </p>
              </div>
            )}
          </div>

          {/* Rechte Sidebar — Contentful-artig */}
          <aside className="w-full shrink-0 border-t border-[#e8eaed] bg-white xl:w-[380px] xl:border-l xl:border-t-0">
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
                  className={sideTab === "info" ? SIDE_TAB_ACTIVE : SIDE_TAB_IDLE}
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

                    {contentId ? (
                      <div>
                        <label
                          htmlFor="cms-entry-model"
                          className="mb-2 block text-[12px] font-medium text-[#1a1a1a]"
                        >
                          Content-Typ
                        </label>
                        <select
                          id="cms-entry-model"
                          value={selectedModelId}
                          onChange={(e) =>
                            onSelectedModelIdChange(e.target.value)
                          }
                          disabled={saving || modelOptions.length === 0}
                          className="w-full rounded-lg border border-[#dadce0] bg-white px-3 py-2 text-[13px] text-ink-900 outline-none focus:border-[#0366d6] disabled:opacity-50"
                        >
                          {modelOptions.length === 0 ? (
                            <option value={selectedModelId}>—</option>
                          ) : (
                            modelOptions.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.key}
                              </option>
                            ))
                          )}
                        </select>
                        <p className="mt-1.5 text-[11px] leading-snug text-[#5f6368]">
                          Nach dem Wechsel Felder prüfen und speichern.
                        </p>
                      </div>
                    ) : null}

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
                        <ChevronDown className="h-4 w-4 opacity-80" aria-hidden />
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
                      <dd className="mt-1 text-[#1a1a1a]">{resolvedModelKey}</dd>
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
        </div>
      </div>
    </div>
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
    if (f.mediaShape?.variant === "many") {
      const arr = Array.isArray(raw) ? (raw as unknown[]).map(String) : [];
      return (
        <>
          {label}
          <p className="mb-2 text-[12px] text-ink-500">
            Asset-IDs (ein Eintrag pro Zeile; Medien-API folgt).
          </p>
          <textarea
            value={arr.join("\n")}
            onChange={(e) =>
              onChange(
                f.id,
                e.target.value
                  .split("\n")
                  .map((x) => x.trim())
                  .filter(Boolean),
              )
            }
            rows={4}
            className="w-full rounded-lg border border-[#dadce0] px-3 py-2 font-mono text-[12px]"
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
          placeholder="Asset-ID"
          className="w-full rounded-lg border border-[#dadce0] px-3 py-2.5 font-mono text-[14px]"
        />
        {f.helpText ? (
          <p className="mt-2 text-[12px] text-ink-500">{f.helpText}</p>
        ) : null}
      </>
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
