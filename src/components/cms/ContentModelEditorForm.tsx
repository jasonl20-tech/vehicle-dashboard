import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AddFieldModal from "./AddFieldModal";
import { CMS_CONTENT_MODELS_API } from "../../lib/cmsApi";
import { CMS_ROOT } from "../../lib/cmsAccess";
import type {
  CmsContentModelSchema,
  CmsFieldDefinition,
  CmsFieldType,
} from "../../lib/cmsSchemaTypes";
import {
  CMS_FIELD_ID_RE,
  CMS_MODEL_KEY_RE,
  defaultFieldIdForType,
  FIELD_TYPE_LABELS,
  serializeContentModelSchema,
} from "../../lib/cmsSchemaTypes";

type Props = {
  isNew: boolean;
  modelId: string | null;
  initialKey: string;
  initialDescription: string;
  initialSchema: CmsContentModelSchema;
  /** Andere Model-Keys für Reference → linkContentType */
  otherModelKeys: string[];
};

export default function ContentModelEditorForm({
  isNew,
  modelId,
  initialKey,
  initialDescription,
  initialSchema,
  otherModelKeys,
}: Props) {
  const navigate = useNavigate();
  const [key, setKey] = useState(initialKey);
  const [description, setDescription] = useState(initialDescription);
  const [schema, setSchema] = useState<CmsContentModelSchema>(initialSchema);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const linkTargets = useMemo(() => {
    const k = key.trim();
    return otherModelKeys.filter((x) => x !== k);
  }, [otherModelKeys, key]);

  const validationHints = useMemo(() => {
    const msgs: string[] = [];
    if (!key.trim()) msgs.push("API-Name (key) fehlt.");
    else if (!CMS_MODEL_KEY_RE.test(key.trim())) {
      msgs.push(
        "API-Name: Buchstabe zuerst, nur Buchstaben, Ziffern, _ und -.",
      );
    }
    const ids = schema.fields.map((f) => f.id.trim());
    const seen = new Set<string>();
    for (const id of ids) {
      if (!id) msgs.push("Jedes Feld braucht eine Feld-ID.");
      else if (!CMS_FIELD_ID_RE.test(id)) {
        msgs.push(`Ungültige Feld-ID: ${id}`);
      }
      if (seen.has(id)) msgs.push(`Doppelte Feld-ID: ${id}`);
      seen.add(id);
    }
    for (const f of schema.fields) {
      if (!f.name.trim()) msgs.push(`Feld „${f.id}“: Name fehlt.`);
    }
    return msgs;
  }, [key, schema.fields]);

  const canSave = validationHints.length === 0;

  function updateField(index: number, patch: Partial<CmsFieldDefinition>) {
    setSchema((s) => {
      const fields = s.fields.map((f, i) =>
        i === index ? { ...f, ...patch } : f,
      );
      return { ...s, fields };
    });
  }

  function removeField(index: number) {
    setSchema((s) => ({
      ...s,
      fields: s.fields.filter((_, i) => i !== index),
      displayField:
        s.displayField &&
        s.fields[index]?.id === s.displayField
          ? undefined
          : s.displayField,
    }));
  }

  function addField(type: CmsFieldType) {
    setSchema((s) => {
      const idx = s.fields.length;
      const id = defaultFieldIdForType(type, idx);
      const field: CmsFieldDefinition = {
        id,
        name: FIELD_TYPE_LABELS[type],
        type,
        required: false,
      };
      return { ...s, fields: [...s.fields, field] };
    });
  }

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    const bodyJson = serializeContentModelSchema(schema);
    try {
      if (isNew) {
        const res = await fetch(CMS_CONTENT_MODELS_API, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key: key.trim(),
            description: description.trim() || null,
            schema_json: bodyJson,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          id?: string;
        };
        if (!res.ok) {
          setError(data.error || `HTTP ${res.status}`);
          return;
        }
        if (data.id) {
          navigate(`${CMS_ROOT}/models/${data.id}/edit`, { replace: true });
          return;
        }
        navigate(`${CMS_ROOT}/models`);
        return;
      }

      const res = await fetch(`${CMS_CONTENT_MODELS_API}/${modelId}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: key.trim(),
          description: description.trim() || null,
          schema_json: bodyJson,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`);
        return;
      }
      navigate(`${CMS_ROOT}/models`);
    } catch (e) {
      setError((e as Error).message || String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link
          to={`${CMS_ROOT}/models`}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-600 hover:text-ink-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Content-Modelle
        </Link>
      </div>

      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="font-display text-[24px] font-semibold tracking-tighter2 text-ink-900">
          {isNew ? "Neues Content-Modell" : "Content-Modell bearbeiten"}
        </h1>
        <div className="flex flex-wrap gap-2">
          <Link
            to={`${CMS_ROOT}/models`}
            className="rounded-lg border border-hair bg-white px-4 py-2 text-[12.5px] font-medium text-ink-700 hover:bg-ink-50"
          >
            Abbrechen
          </Link>
          <button
            type="button"
            disabled={!canSave || saving}
            onClick={() => void handleSave()}
            className="rounded-lg bg-ink-900 px-4 py-2 text-[12.5px] font-medium text-white hover:bg-ink-800 disabled:opacity-50"
          >
            {saving ? "Speichern …" : "Speichern"}
          </button>
        </div>
      </header>

      {error ? (
        <pre className="mb-4 whitespace-pre-wrap rounded-lg border border-rose-200 bg-rose-50/80 px-3 py-2 font-sans text-[13px] text-rose-900">
          {error}
        </pre>
      ) : null}

      {!canSave && validationHints.length > 0 ? (
        <ul className="mb-4 list-inside list-disc rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-[12px] text-amber-950">
          {validationHints.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      ) : null}

      <div className="space-y-6">
        <div className="rounded-xl border border-hair bg-white p-5">
          <label
            className="mb-1.5 block text-[12px] font-medium text-ink-700"
            htmlFor="cms-model-key"
          >
            API-Name (key)
          </label>
          <input
            id="cms-model-key"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="z. B. blogPost"
            className="w-full rounded-lg border border-hair px-3 py-2 font-mono text-[13px] text-ink-900"
          />
          <p className="mt-1 text-[11px] text-ink-400">
            Eindeutig, später in APIs und Code verwendet.
          </p>
        </div>

        <div className="rounded-xl border border-hair bg-white p-5">
          <label
            className="mb-1.5 block text-[12px] font-medium text-ink-700"
            htmlFor="cms-model-desc"
          >
            Beschreibung
          </label>
          <textarea
            id="cms-model-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-hair px-3 py-2 text-[13px] text-ink-900"
          />
        </div>

        <div className="rounded-xl border border-hair bg-white p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[12px] font-semibold text-ink-800">
              Felder
            </span>
            <button
              type="button"
              onClick={() => setAddModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-hair bg-white px-3 py-1.5 text-[12px] font-medium text-ink-800 hover:bg-ink-50"
            >
              <Plus className="h-4 w-4" />
              Feld hinzufügen
            </button>
          </div>

          {schema.fields.length === 0 ? (
            <p className="text-[12px] text-ink-400">
              Noch keine Felder — Typ wie in Contentful wählen.
            </p>
          ) : (
            <ul className="space-y-4">
              {schema.fields.map((f, i) => (
                <li
                  key={`${f.id}-${i}`}
                  className="rounded-lg border border-hair bg-ink-50/30 p-4"
                >
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                    <div className="grid flex-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-[11px] font-medium text-ink-600">
                          Name
                        </label>
                        <input
                          value={f.name}
                          onChange={(e) =>
                            updateField(i, { name: e.target.value })
                          }
                          className="w-full rounded-md border border-hair bg-white px-2.5 py-1.5 text-[13px]"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] font-medium text-ink-600">
                          Feld-ID
                        </label>
                        <input
                          value={f.id}
                          onChange={(e) =>
                            updateField(i, { id: e.target.value.trim() })
                          }
                          className="w-full rounded-md border border-hair bg-white px-2.5 py-1.5 font-mono text-[13px]"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeField(i)}
                      className="rounded-md p-2 text-ink-400 hover:bg-rose-50 hover:text-rose-700"
                      aria-label="Feld entfernen"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mb-3 flex flex-wrap gap-4 text-[12px]">
                    <span className="rounded-md bg-ink-900/90 px-2 py-0.5 font-medium text-white">
                      {FIELD_TYPE_LABELS[f.type]}
                    </span>
                    <label className="inline-flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={f.required}
                        onChange={(e) =>
                          updateField(i, { required: e.target.checked })
                        }
                        className="rounded border-hair"
                      />
                      Pflichtfeld
                    </label>
                    <label className="inline-flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={Boolean(f.localized)}
                        onChange={(e) =>
                          updateField(i, {
                            localized: e.target.checked || undefined,
                          })
                        }
                        className="rounded border-hair"
                      />
                      Lokalisiert
                    </label>
                  </div>

                  <div className="mb-3">
                    <label className="mb-1 block text-[11px] font-medium text-ink-600">
                      Hilfetext (optional)
                    </label>
                    <input
                      value={f.helpText ?? ""}
                      onChange={(e) =>
                        updateField(i, {
                          helpText: e.target.value.trim() || undefined,
                        })
                      }
                      className="w-full rounded-md border border-hair bg-white px-2.5 py-1.5 text-[12px]"
                    />
                  </div>

                  {(f.type === "Text" || f.type === "RichText") && (
                    <div className="grid gap-3 border-t border-hair pt-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-[11px] font-medium text-ink-600">
                          Max. Länge (optional)
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={f.validations?.maxLength ?? ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            updateField(i, {
                              validations: {
                                ...f.validations,
                                maxLength:
                                  v === "" ? undefined : Math.max(0, Number(v)),
                              },
                            });
                          }}
                          className="w-full rounded-md border border-hair bg-white px-2.5 py-1.5 text-[13px]"
                        />
                      </div>
                      <label className="flex items-center gap-2 pt-6 text-[12px]">
                        <input
                          type="checkbox"
                          checked={Boolean(f.validations?.unique)}
                          onChange={(e) =>
                            updateField(i, {
                              validations: {
                                ...f.validations,
                                unique: e.target.checked || undefined,
                              },
                            })
                          }
                          className="rounded border-hair"
                        />
                        Eindeutig
                      </label>
                    </div>
                  )}

                  {f.type === "Number" && (
                    <div className="grid gap-3 border-t border-hair pt-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-[11px] font-medium text-ink-600">
                          Minimum
                        </label>
                        <input
                          type="number"
                          value={f.validations?.min ?? ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            updateField(i, {
                              validations: {
                                ...f.validations,
                                min: v === "" ? undefined : Number(v),
                              },
                            });
                          }}
                          className="w-full rounded-md border border-hair bg-white px-2.5 py-1.5 text-[13px]"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] font-medium text-ink-600">
                          Maximum
                        </label>
                        <input
                          type="number"
                          value={f.validations?.max ?? ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            updateField(i, {
                              validations: {
                                ...f.validations,
                                max: v === "" ? undefined : Number(v),
                              },
                            });
                          }}
                          className="w-full rounded-md border border-hair bg-white px-2.5 py-1.5 text-[13px]"
                        />
                      </div>
                    </div>
                  )}

                  {f.type === "Reference" && linkTargets.length > 0 && (
                    <div className="border-t border-hair pt-3">
                      <p className="mb-2 text-[11px] font-medium text-ink-600">
                        Erlaubte Verknüpfungen (Content-Typen)
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {linkTargets.map((mk) => {
                          const set = new Set(f.validations?.linkContentType);
                          const checked = set.has(mk);
                          return (
                            <label
                              key={mk}
                              className="inline-flex items-center gap-1.5 rounded-md border border-hair bg-white px-2 py-1 text-[11px]"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  const next = new Set(
                                    f.validations?.linkContentType ?? [],
                                  );
                                  if (next.has(mk)) next.delete(mk);
                                  else next.add(mk);
                                  const arr = [...next];
                                  updateField(i, {
                                    validations: {
                                      ...f.validations,
                                      linkContentType:
                                        arr.length > 0 ? arr : undefined,
                                    },
                                  });
                                }}
                                className="rounded border-hair"
                              />
                              <code>{mk}</code>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {f.type === "Reference" && linkTargets.length === 0 && (
                    <p className="border-t border-hair pt-3 text-[11px] text-ink-400">
                      Keine anderen Modelle — Reference-Ziele nach weiteren
                      Content-Typen möglich.
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 border-t border-hair pt-4">
            <label className="mb-1.5 block text-[11px] font-medium text-ink-600">
              Anzeige-Feld (Listen / Teaser)
            </label>
            <select
              value={schema.displayField ?? ""}
              onChange={(e) =>
                setSchema((s) => ({
                  ...s,
                  displayField: e.target.value || undefined,
                }))
              }
              className="w-full max-w-md rounded-md border border-hair bg-white px-2.5 py-2 text-[13px]"
            >
              <option value="">—</option>
              {schema.fields
                .filter((f) => f.type === "Text" || f.type === "RichText")
                .map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.id})
                  </option>
                ))}
            </select>
          </div>
        </div>
      </div>

      <AddFieldModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onPick={addField}
      />
    </div>
  );
}
