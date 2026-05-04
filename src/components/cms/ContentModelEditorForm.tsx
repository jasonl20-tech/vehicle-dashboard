import {
  ArrowLeft,
  Braces,
  CalendarClock,
  CheckCircle2,
  ClipboardCopy,
  FileText,
  GripVertical,
  Hash,
  Image as ImageLucide,
  Link2,
  MapPin,
  Minus,
  MoreHorizontal,
  Plus,
  ToggleLeft,
  Trash2,
  Type,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AddBooleanFieldModal from "./AddBooleanFieldModal";
import AddDateTimeFieldModal from "./AddDateTimeFieldModal";
import AddFieldModal from "./AddFieldModal";
import AddJsonObjectFieldModal from "./AddJsonObjectFieldModal";
import AddLocationFieldModal from "./AddLocationFieldModal";
import AddMediaFieldModal from "./AddMediaFieldModal";
import AddNumberFieldModal from "./AddNumberFieldModal";
import AddReferenceFieldModal from "./AddReferenceFieldModal";
import AddTextFieldModal from "./AddTextFieldModal";
import BooleanFieldModal from "./BooleanFieldModal";
import DateTimeFieldModal from "./DateTimeFieldModal";
import JsonObjectFieldModal from "./JsonObjectFieldModal";
import LocationFieldModal from "./LocationFieldModal";
import MediaFieldModal from "./MediaFieldModal";
import NumberFieldModal from "./NumberFieldModal";
import ReferenceFieldModal from "./ReferenceFieldModal";
import RichTextFieldModal from "./RichTextFieldModal";
import TextFieldModal from "./TextFieldModal";
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
  defaultRichTextFieldConfig,
  FIELD_TYPE_LABELS,
  TEXT_SHORT_MAX,
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
  const [addTextModalOpen, setAddTextModalOpen] = useState(false);
  const [addNumberModalOpen, setAddNumberModalOpen] = useState(false);
  const [addDateTimeModalOpen, setAddDateTimeModalOpen] = useState(false);
  const [addLocationModalOpen, setAddLocationModalOpen] = useState(false);
  const [addMediaModalOpen, setAddMediaModalOpen] = useState(false);
  const [addBooleanModalOpen, setAddBooleanModalOpen] = useState(false);
  const [addJsonObjectModalOpen, setAddJsonObjectModalOpen] = useState(false);
  const [addReferenceModalOpen, setAddReferenceModalOpen] = useState(false);
  const [richModalIndex, setRichModalIndex] = useState<number | null>(null);
  const [textModalIndex, setTextModalIndex] = useState<number | null>(null);
  const [numberModalIndex, setNumberModalIndex] = useState<number | null>(
    null,
  );
  const [dateTimeModalIndex, setDateTimeModalIndex] = useState<number | null>(
    null,
  );
  const [locationModalIndex, setLocationModalIndex] = useState<number | null>(
    null,
  );
  const [mediaModalIndex, setMediaModalIndex] = useState<number | null>(null);
  const [booleanModalIndex, setBooleanModalIndex] = useState<number | null>(
    null,
  );
  const [jsonObjectModalIndex, setJsonObjectModalIndex] = useState<
    number | null
  >(null);
  const [referenceModalIndex, setReferenceModalIndex] = useState<number | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const linkTargets = useMemo(() => {
    const k = key.trim();
    return otherModelKeys.filter((x) => x !== k);
  }, [otherModelKeys, key]);

  const schemaJsonPreview = useMemo(
    () => JSON.stringify(serializeContentModelSchema(schema), null, 2),
    [schema],
  );

  const [schemaJsonCopied, setSchemaJsonCopied] = useState(false);

  const [editorPanel, setEditorPanel] = useState<"fields" | "meta" | "json">(
    "fields",
  );
  const [fieldActionMenu, setFieldActionMenu] = useState<number | null>(null);
  const [dragFieldIndex, setDragFieldIndex] = useState<number | null>(null);

  function reorderFields(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return;
    setSchema((s) => {
      const n = s.fields.length;
      if (fromIndex < 0 || toIndex < 0 || fromIndex >= n || toIndex >= n)
        return s;
      const fields = [...s.fields];
      const [item] = fields.splice(fromIndex, 1);
      fields.splice(toIndex, 0, item);
      return { ...s, fields };
    });
  }

  async function copyModelId() {
    const text = !isNew && modelId ? String(modelId) : key.trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  }

  function openFieldConfig(i: number) {
    const t = schema.fields[i]?.type;
    if (t === "RichText") setRichModalIndex(i);
    else if (t === "Text") setTextModalIndex(i);
    else if (t === "Number") setNumberModalIndex(i);
    else if (t === "DateTime") setDateTimeModalIndex(i);
    else if (t === "Location") setLocationModalIndex(i);
    else if (t === "Media") setMediaModalIndex(i);
    else if (t === "Boolean") setBooleanModalIndex(i);
    else if (t === "JsonObject") setJsonObjectModalIndex(i);
    else if (t === "Reference") setReferenceModalIndex(i);
  }

  function fieldTypeSubtitle(f: CmsFieldDefinition): string | null {
    if (f.type === "Text") {
      if (f.list) return "Liste";
      return null;
    }
    if (f.type === "Number")
      return f.numberShape?.variant === "decimal" ? "Decimal" : "Integer";
    if (f.type === "Media")
      return f.mediaShape?.variant === "many" ? "Many files" : "One file";
    if (f.type === "Boolean" && f.boolean?.widget)
      return f.boolean.widget === "toggle" ? "Toggle" : f.boolean.widget;
    if (f.type === "Reference")
      return f.referenceShape?.variant === "many"
        ? "Many references"
        : "One reference";
    return null;
  }

  function fieldTypeDisplay(f: CmsFieldDefinition): { label: string; Icon: typeof Type } {
    switch (f.type) {
      case "Text":
        return {
          label:
            f.textShape?.variant === "long" ||
            (f.validations?.maxLength ?? 0) > TEXT_SHORT_MAX
              ? "Long text"
              : "Short text",
          Icon: Type,
        };
      case "RichText":
        return { label: "Rich text", Icon: FileText };
      case "Number":
        return { label: "Number", Icon: Hash };
      case "DateTime":
        return { label: "Date & time", Icon: CalendarClock };
      case "Location":
        return { label: FIELD_TYPE_LABELS.Location, Icon: MapPin };
      case "Media":
        return { label: FIELD_TYPE_LABELS.Media, Icon: ImageLucide };
      case "Boolean":
        return { label: FIELD_TYPE_LABELS.Boolean, Icon: ToggleLeft };
      case "JsonObject":
        return { label: FIELD_TYPE_LABELS.JsonObject, Icon: Braces };
      case "Reference":
        return { label: FIELD_TYPE_LABELS.Reference, Icon: Link2 };
      default:
        return { label: FIELD_TYPE_LABELS[f.type], Icon: Type };
    }
  }

  const modelTitle =
    isNew && !key.trim()
      ? "Neues Content-Modell"
      : key.trim() || "Content-Modell";

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
    setRichModalIndex((cur) =>
      cur === null ? null : cur === index ? null : cur > index ? cur - 1 : cur,
    );
    setTextModalIndex((cur) =>
      cur === null ? null : cur === index ? null : cur > index ? cur - 1 : cur,
    );
    setNumberModalIndex((cur) =>
      cur === null ? null : cur === index ? null : cur > index ? cur - 1 : cur,
    );
    setDateTimeModalIndex((cur) =>
      cur === null ? null : cur === index ? null : cur > index ? cur - 1 : cur,
    );
    setLocationModalIndex((cur) =>
      cur === null ? null : cur === index ? null : cur > index ? cur - 1 : cur,
    );
    setMediaModalIndex((cur) =>
      cur === null ? null : cur === index ? null : cur > index ? cur - 1 : cur,
    );
    setBooleanModalIndex((cur) =>
      cur === null ? null : cur === index ? null : cur > index ? cur - 1 : cur,
    );
    setJsonObjectModalIndex((cur) =>
      cur === null ? null : cur === index ? null : cur > index ? cur - 1 : cur,
    );
    setReferenceModalIndex((cur) =>
      cur === null ? null : cur === index ? null : cur > index ? cur - 1 : cur,
    );
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
    if (type === "Text") {
      setAddTextModalOpen(true);
      return;
    }
    if (type === "Number") {
      setAddNumberModalOpen(true);
      return;
    }
    if (type === "DateTime") {
      setAddDateTimeModalOpen(true);
      return;
    }
    if (type === "Location") {
      setAddLocationModalOpen(true);
      return;
    }
    if (type === "Media") {
      setAddMediaModalOpen(true);
      return;
    }
    if (type === "Boolean") {
      setAddBooleanModalOpen(true);
      return;
    }
    if (type === "JsonObject") {
      setAddJsonObjectModalOpen(true);
      return;
    }
    if (type === "Reference") {
      setAddReferenceModalOpen(true);
      return;
    }
    setSchema((s) => {
      const idx = s.fields.length;
      const id = defaultFieldIdForType(type, idx);
      const base = {
        id,
        name: FIELD_TYPE_LABELS[type],
        type,
        required: false,
      };
      const field: CmsFieldDefinition =
        type === "RichText"
          ? { ...base, richText: defaultRichTextFieldConfig() }
          : base;
      if (type === "RichText") {
        setTimeout(() => setRichModalIndex(idx), 0);
      }
      return { ...s, fields: [...s.fields, field] };
    });
  }

  function appendTextField(field: CmsFieldDefinition) {
    const idx = schema.fields.length;
    setSchema((s) => ({ ...s, fields: [...s.fields, field] }));
    setAddTextModalOpen(false);
    setTextModalIndex(idx);
  }

  function appendNumberField(field: CmsFieldDefinition) {
    const idx = schema.fields.length;
    setSchema((s) => ({ ...s, fields: [...s.fields, field] }));
    setAddNumberModalOpen(false);
    setNumberModalIndex(idx);
  }

  function appendDateTimeField(field: CmsFieldDefinition) {
    const idx = schema.fields.length;
    setSchema((s) => ({ ...s, fields: [...s.fields, field] }));
    setAddDateTimeModalOpen(false);
    setDateTimeModalIndex(idx);
  }

  function appendLocationField(field: CmsFieldDefinition) {
    const idx = schema.fields.length;
    setSchema((s) => ({ ...s, fields: [...s.fields, field] }));
    setAddLocationModalOpen(false);
    setLocationModalIndex(idx);
  }

  function appendMediaField(field: CmsFieldDefinition) {
    const idx = schema.fields.length;
    setSchema((s) => ({ ...s, fields: [...s.fields, field] }));
    setAddMediaModalOpen(false);
    setMediaModalIndex(idx);
  }

  function appendBooleanField(field: CmsFieldDefinition) {
    const idx = schema.fields.length;
    setSchema((s) => ({ ...s, fields: [...s.fields, field] }));
    setAddBooleanModalOpen(false);
    setBooleanModalIndex(idx);
  }

  function appendJsonObjectField(field: CmsFieldDefinition) {
    const idx = schema.fields.length;
    setSchema((s) => ({ ...s, fields: [...s.fields, field] }));
    setAddJsonObjectModalOpen(false);
    setJsonObjectModalIndex(idx);
  }

  function appendReferenceField(field: CmsFieldDefinition) {
    const idx = schema.fields.length;
    setSchema((s) => ({ ...s, fields: [...s.fields, field] }));
    setAddReferenceModalOpen(false);
    setReferenceModalIndex(idx);
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

  async function copySchemaJsonPreview() {
    try {
      await navigator.clipboard.writeText(schemaJsonPreview);
      setSchemaJsonCopied(true);
      window.setTimeout(() => setSchemaJsonCopied(false), 2000);
    } catch {
      /* Clipboard nicht verfügbar */
    }
  }

  return (
    <>
    <div className="w-full max-w-none">
      <div className="-mx-6 mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-[#e8eaed] bg-white px-6 py-3 lg:-mx-8 lg:px-8">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <Link
            to={`${CMS_ROOT}/models`}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#5f6368] transition hover:bg-[#f1f3f4]"
            aria-label="Zurück zu Content-Modellen"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="truncate text-[17px] font-semibold tracking-tight text-[#1a1a1a]">
            {modelTitle}
          </h1>
          <button
            type="button"
            onClick={() => void copyModelId()}
            className="rounded-md border border-[#dadce0] bg-white px-3 py-1.5 text-[12px] font-medium text-[#1a1a1a] hover:bg-[#f8f9fa]"
          >
            ID kopieren
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={`${CMS_ROOT}/models`}
            className="rounded-md border border-[#dadce0] bg-white px-4 py-2 text-[13px] font-medium text-[#5f6368] hover:bg-[#f8f9fa]"
          >
            Abbrechen
          </Link>
          <button
            type="button"
            disabled={!canSave || saving}
            onClick={() => void handleSave()}
            className="rounded-md bg-[#1b873f] px-5 py-2 text-[13px] font-medium text-white shadow-sm hover:bg-[#146c32] disabled:opacity-50"
          >
            {saving ? "Speichern …" : "Speichern"}
          </button>
        </div>
      </div>

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

      <div className="flex min-h-[min(70vh,640px)] flex-col lg:flex-row">
        <nav
          className="shrink-0 border-b border-[#e8eaed] bg-white lg:w-56 lg:border-b-0 lg:border-r lg:py-3"
          aria-label="Content-Typ Abschnitte"
        >
          <button
            type="button"
            onClick={() => setEditorPanel("fields")}
            className={`flex w-full items-center px-4 py-2.5 text-left text-[13px] transition lg:px-4 ${
              editorPanel === "fields"
                ? "bg-[#f3f4f6] font-medium text-[#1a1a1a]"
                : "text-[#5f6368] hover:bg-[#f9fafb]"
            }`}
          >
            Felder ({schema.fields.length})
          </button>
          <button
            type="button"
            onClick={() => setEditorPanel("meta")}
            className={`flex w-full items-center px-4 py-2.5 text-left text-[13px] transition lg:px-4 ${
              editorPanel === "meta"
                ? "bg-[#f3f4f6] font-medium text-[#1a1a1a]"
                : "text-[#5f6368] hover:bg-[#f9fafb]"
            }`}
          >
            Name und Beschreibung
          </button>
          <button
            type="button"
            onClick={() => setEditorPanel("json")}
            className={`flex w-full items-center px-4 py-2.5 text-left text-[13px] transition lg:px-4 ${
              editorPanel === "json"
                ? "bg-[#f3f4f6] font-medium text-[#1a1a1a]"
                : "text-[#5f6368] hover:bg-[#f9fafb]"
            }`}
          >
            JSON-Vorschau
          </button>
        </nav>

        <div className="min-w-0 flex-1 bg-white px-4 py-8 lg:px-10 lg:py-10">
          {editorPanel === "meta" ? (
            <div className="mx-auto max-w-2xl space-y-6">
              <h2 className="text-[22px] font-semibold tracking-tight text-[#1a1a1a]">
                Name und Beschreibung
              </h2>
              <div>
                <label
                  className="mb-1.5 block text-[13px] font-medium text-[#1a1a1a]"
                  htmlFor="cms-model-key"
                >
                  API-Name (key)
                </label>
                <input
                  id="cms-model-key"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder="z. B. caseStudy"
                  className="w-full rounded-md border border-[#dadce0] px-3 py-2.5 font-mono text-[14px] text-[#1a1a1a] outline-none focus:border-[#0366d6] focus:ring-1 focus:ring-[#0366d6]"
                />
                <p className="mt-1 text-[12px] text-[#5f6368]">
                  Eindeutig, wird in APIs und Code verwendet.
                </p>
              </div>
              <div>
                <label
                  className="mb-1.5 block text-[13px] font-medium text-[#1a1a1a]"
                  htmlFor="cms-model-desc"
                >
                  Beschreibung
                </label>
                <textarea
                  id="cms-model-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="w-full rounded-md border border-[#dadce0] px-3 py-2.5 text-[14px] text-[#1a1a1a] outline-none focus:border-[#0366d6] focus:ring-1 focus:ring-[#0366d6]"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-[#1a1a1a]">
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
                  className="w-full max-w-md rounded-md border border-[#dadce0] bg-white px-3 py-2.5 text-[13px]"
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
          ) : editorPanel === "json" ? (
            <div className="mx-auto max-w-4xl">
              <h2 className="mb-4 text-[22px] font-semibold tracking-tight text-[#1a1a1a]">
                JSON-Vorschau
              </h2>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[12px] text-[#5f6368]">
                  Vorschau von{" "}
                  <code className="font-mono text-[#1a1a1a]">schema_json</code>{" "}
                  beim Speichern (nur Lesen).
                </p>
                <button
                  type="button"
                  onClick={() => void copySchemaJsonPreview()}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[#dadce0] bg-white px-3 py-1.5 text-[12px] font-medium text-[#1a1a1a] hover:bg-[#f8f9fa]"
                >
                  <ClipboardCopy className="h-3.5 w-3.5" />
                  {schemaJsonCopied ? "Kopiert" : "Kopieren"}
                </button>
              </div>
              <pre
                className="max-h-[min(560px,60vh)] overflow-auto rounded-lg border border-[#e8eaed] bg-[#0d1117] p-4 font-mono text-[12px] leading-relaxed text-[#e6edf3] lg:max-h-[calc(100vh-16rem)]"
                tabIndex={0}
              >
                {schemaJsonPreview}
              </pre>
            </div>
          ) : (
            <div>
              <h2 className="mb-6 text-[26px] font-semibold tracking-tight text-[#1a1a1a]">
                Felder
              </h2>

              {schema.fields.length === 0 ? (
                <p className="text-[14px] text-[#5f6368]">
                  Noch keine Felder — unten einen Typ hinzufügen.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <div className="min-w-[720px]">
                    <div
                      className="grid grid-cols-[36px_1fr_minmax(160px,1fr)_100px_148px] gap-3 border-b border-[#e8eaed] pb-2.5 text-[11px] font-semibold uppercase tracking-wide text-[#5f6368]"
                      role="row"
                    >
                      <span className="sr-only">Sortieren</span>
                      <span>Name</span>
                      <span>Feldtyp</span>
                      <span>Lokalisiert</span>
                      <span className="text-right">Aktionen</span>
                    </div>

                    <div role="list">
                      {schema.fields.map((f, i) => {
                        const { label: typeLabel, Icon: TypeIcon } =
                          fieldTypeDisplay(f);
                        const sub = fieldTypeSubtitle(f);
                        const isEntryTitle =
                          schema.displayField === f.id &&
                          (f.type === "Text" || f.type === "RichText");
                        const known =
                          f.type === "RichText" ||
                          f.type === "Text" ||
                          f.type === "Number" ||
                          f.type === "DateTime" ||
                          f.type === "Location" ||
                          f.type === "Media" ||
                          f.type === "Boolean" ||
                          f.type === "JsonObject" ||
                          f.type === "Reference";
                        return (
                          <div
                            key={`${f.id}-${i}`}
                            role="listitem"
                            draggable={known}
                            onDragStart={(e) => {
                              if (!known) return;
                              e.dataTransfer.effectAllowed = "move";
                              e.dataTransfer.setData("text/plain", String(i));
                              setDragFieldIndex(i);
                            }}
                            onDragEnd={() => setDragFieldIndex(null)}
                            onDragOver={(e) => {
                              e.preventDefault();
                              e.dataTransfer.dropEffect = "move";
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              const from = Number(
                                e.dataTransfer.getData("text/plain"),
                              );
                              if (Number.isNaN(from)) return;
                              reorderFields(from, i);
                            }}
                            className={`grid grid-cols-[36px_1fr_minmax(160px,1fr)_100px_148px] items-center gap-3 border-b border-[#f0f1f3] py-3.5 text-[13px] ${
                              dragFieldIndex === i ? "bg-[#f8f9fa]" : ""
                            }`}
                          >
                            <div
                              className={`flex justify-center text-[#9aa0a6] ${known ? "cursor-grab active:cursor-grabbing" : ""}`}
                              title={known ? "Zum Sortieren ziehen" : undefined}
                            >
                              <GripVertical className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-medium text-[#1a1a1a]">
                                  {f.name || "—"}
                                </span>
                                {isEntryTitle ? (
                                  <span className="rounded bg-[#e8eaed] px-2 py-0.5 text-[11px] font-medium text-[#5f6368]">
                                    Eintragstitel
                                  </span>
                                ) : null}
                              </div>
                            </div>
                            <div className="flex min-w-0 items-center gap-2 text-[#1a1a1a]">
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[#e8eaed] bg-[#fafafa]">
                                <TypeIcon className="h-3.5 w-3.5 text-[#5f6368]" />
                              </span>
                              <span className="min-w-0">
                                <span className="block truncate font-medium">
                                  {typeLabel}
                                </span>
                                {sub ? (
                                  <span className="block truncate text-[11px] text-[#80868b]">
                                    {sub}
                                  </span>
                                ) : null}
                              </span>
                            </div>
                            <div className="flex justify-center">
                              {f.localized ? (
                                <CheckCircle2 className="h-5 w-5 text-green-600" aria-label="Ja" />
                              ) : (
                                <Minus className="h-5 w-5 text-[#dadce0]" aria-label="Nein" />
                              )}
                            </div>
                            <div className="relative flex items-center justify-end gap-1">
                              {known ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => openFieldConfig(i)}
                                    className="rounded-md px-3 py-1.5 text-[13px] font-medium text-[#0366d6] hover:bg-[#e8f0fe]"
                                  >
                                    Bearbeiten
                                  </button>
                                  <div className="relative">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setFieldActionMenu(
                                          fieldActionMenu === i ? null : i,
                                        )
                                      }
                                      className="rounded-md p-2 text-[#5f6368] hover:bg-[#f1f3f4]"
                                      aria-label="Weitere Aktionen"
                                    >
                                      <MoreHorizontal className="h-4 w-4" />
                                    </button>
                                    {fieldActionMenu === i ? (
                                      <div className="absolute right-0 top-full z-30 mt-1 min-w-[140px] rounded-md border border-[#e8eaed] bg-white py-1 shadow-lg">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            removeField(i);
                                            setFieldActionMenu(null);
                                          }}
                                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-rose-700 hover:bg-rose-50"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                          Löschen
                                        </button>
                                      </div>
                                    ) : null}
                                  </div>
                                </>
                              ) : (
                                <span className="text-[11px] text-[#9aa0a6]">
                                  —
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-10 flex justify-center">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(true)}
                  className="inline-flex items-center gap-2 rounded-full border border-dashed border-[#dadce0] bg-white px-5 py-2.5 text-[13px] font-medium text-[#1a1a1a] transition hover:border-[#0366d6] hover:bg-[#f8f9fa] hover:text-[#0366d6]"
                >
                  <Plus className="h-4 w-4" />
                  Feld hinzufügen
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>

      <AddFieldModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onPick={addField}
      />

      <AddTextFieldModal
        open={addTextModalOpen}
        suggestedName={FIELD_TYPE_LABELS.Text}
        suggestedId={defaultFieldIdForType("Text", schema.fields.length)}
        onClose={() => setAddTextModalOpen(false)}
        onChangeFieldType={() => {
          setAddTextModalOpen(false);
          setAddModalOpen(true);
        }}
        onAddAndConfigure={appendTextField}
      />

      <AddNumberFieldModal
        open={addNumberModalOpen}
        suggestedName={FIELD_TYPE_LABELS.Number}
        suggestedId={defaultFieldIdForType("Number", schema.fields.length)}
        onClose={() => setAddNumberModalOpen(false)}
        onChangeFieldType={() => {
          setAddNumberModalOpen(false);
          setAddModalOpen(true);
        }}
        onAddAndConfigure={appendNumberField}
      />

      <AddDateTimeFieldModal
        open={addDateTimeModalOpen}
        suggestedName={FIELD_TYPE_LABELS.DateTime}
        suggestedId={defaultFieldIdForType("DateTime", schema.fields.length)}
        onClose={() => setAddDateTimeModalOpen(false)}
        onChangeFieldType={() => {
          setAddDateTimeModalOpen(false);
          setAddModalOpen(true);
        }}
        onAddAndConfigure={appendDateTimeField}
      />

      <AddLocationFieldModal
        open={addLocationModalOpen}
        suggestedName={FIELD_TYPE_LABELS.Location}
        suggestedId={defaultFieldIdForType("Location", schema.fields.length)}
        onClose={() => setAddLocationModalOpen(false)}
        onChangeFieldType={() => {
          setAddLocationModalOpen(false);
          setAddModalOpen(true);
        }}
        onAddAndConfigure={appendLocationField}
      />
      <AddMediaFieldModal
        open={addMediaModalOpen}
        suggestedName={FIELD_TYPE_LABELS.Media}
        suggestedId={defaultFieldIdForType("Media", schema.fields.length)}
        onClose={() => setAddMediaModalOpen(false)}
        onChangeFieldType={() => {
          setAddMediaModalOpen(false);
          setAddModalOpen(true);
        }}
        onAddAndConfigure={appendMediaField}
      />
      <AddBooleanFieldModal
        open={addBooleanModalOpen}
        suggestedName={FIELD_TYPE_LABELS.Boolean}
        suggestedId={defaultFieldIdForType("Boolean", schema.fields.length)}
        onClose={() => setAddBooleanModalOpen(false)}
        onChangeFieldType={() => {
          setAddBooleanModalOpen(false);
          setAddModalOpen(true);
        }}
        onAddAndConfigure={appendBooleanField}
      />
      <AddJsonObjectFieldModal
        open={addJsonObjectModalOpen}
        suggestedName={FIELD_TYPE_LABELS.JsonObject}
        suggestedId={defaultFieldIdForType("JsonObject", schema.fields.length)}
        onClose={() => setAddJsonObjectModalOpen(false)}
        onChangeFieldType={() => {
          setAddJsonObjectModalOpen(false);
          setAddModalOpen(true);
        }}
        onAddAndConfigure={appendJsonObjectField}
      />
      <AddReferenceFieldModal
        open={addReferenceModalOpen}
        suggestedName={FIELD_TYPE_LABELS.Reference}
        suggestedId={defaultFieldIdForType("Reference", schema.fields.length)}
        onClose={() => setAddReferenceModalOpen(false)}
        onChangeFieldType={() => {
          setAddReferenceModalOpen(false);
          setAddModalOpen(true);
        }}
        onAddAndConfigure={appendReferenceField}
      />

      {richModalIndex !== null &&
        schema.fields[richModalIndex]?.type === "RichText" && (
          <RichTextFieldModal
            open
            field={schema.fields[richModalIndex]!}
            onClose={() => setRichModalIndex(null)}
            onApply={(next) => {
              updateField(richModalIndex, next);
              setRichModalIndex(null);
            }}
            otherModelKeys={linkTargets}
          />
        )}

      {textModalIndex !== null &&
        schema.fields[textModalIndex]?.type === "Text" && (
          <TextFieldModal
            open
            field={schema.fields[textModalIndex]!}
            displayFieldIsThis={
              schema.displayField === schema.fields[textModalIndex]!.id
            }
            onClose={() => setTextModalIndex(null)}
            onApply={(next, entryTitle) => {
              const idx = textModalIndex;
              const oldId = schema.fields[idx]!.id;
              setSchema((s) => {
                const fields = s.fields.map((f, i) =>
                  i === idx ? { ...f, ...next } : f,
                );
                let displayField = s.displayField;
                if (entryTitle) displayField = next.id;
                else if (
                  oldId &&
                  (displayField === oldId || displayField === next.id)
                ) {
                  displayField = undefined;
                }
                return { ...s, fields, displayField };
              });
              setTextModalIndex(null);
            }}
          />
        )}

      {numberModalIndex !== null &&
        schema.fields[numberModalIndex]?.type === "Number" && (
          <NumberFieldModal
            open
            field={schema.fields[numberModalIndex]!}
            onClose={() => setNumberModalIndex(null)}
            onApply={(next) => {
              const idx = numberModalIndex;
              setSchema((s) => ({
                ...s,
                fields: s.fields.map((f, i) => (i === idx ? { ...f, ...next } : f)),
              }));
              setNumberModalIndex(null);
            }}
          />
        )}

      {dateTimeModalIndex !== null &&
        schema.fields[dateTimeModalIndex]?.type === "DateTime" && (
          <DateTimeFieldModal
            open
            field={schema.fields[dateTimeModalIndex]!}
            onClose={() => setDateTimeModalIndex(null)}
            onApply={(next) => {
              const idx = dateTimeModalIndex;
              setSchema((s) => ({
                ...s,
                fields: s.fields.map((f, i) =>
                  i === idx ? { ...f, ...next } : f,
                ),
              }));
              setDateTimeModalIndex(null);
            }}
          />
        )}

      {locationModalIndex !== null &&
        schema.fields[locationModalIndex]?.type === "Location" && (
          <LocationFieldModal
            open
            field={schema.fields[locationModalIndex]!}
            onClose={() => setLocationModalIndex(null)}
            onApply={(next) => {
              const idx = locationModalIndex;
              setSchema((s) => ({
                ...s,
                fields: s.fields.map((f, i) =>
                  i === idx ? { ...f, ...next } : f,
                ),
              }));
              setLocationModalIndex(null);
            }}
          />
        )}

      {mediaModalIndex !== null &&
        schema.fields[mediaModalIndex]?.type === "Media" && (
          <MediaFieldModal
            open
            field={schema.fields[mediaModalIndex]!}
            onClose={() => setMediaModalIndex(null)}
            onApply={(next) => {
              const idx = mediaModalIndex;
              setSchema((s) => ({
                ...s,
                fields: s.fields.map((f, i) =>
                  i === idx ? { ...f, ...next } : f,
                ),
              }));
              setMediaModalIndex(null);
            }}
          />
        )}

      {booleanModalIndex !== null &&
        schema.fields[booleanModalIndex]?.type === "Boolean" && (
          <BooleanFieldModal
            open
            field={schema.fields[booleanModalIndex]!}
            onClose={() => setBooleanModalIndex(null)}
            onApply={(next) => {
              const idx = booleanModalIndex;
              setSchema((s) => ({
                ...s,
                fields: s.fields.map((f, i) =>
                  i === idx ? { ...f, ...next } : f,
                ),
              }));
              setBooleanModalIndex(null);
            }}
          />
        )}

      {jsonObjectModalIndex !== null &&
        schema.fields[jsonObjectModalIndex]?.type === "JsonObject" && (
          <JsonObjectFieldModal
            open
            field={schema.fields[jsonObjectModalIndex]!}
            onClose={() => setJsonObjectModalIndex(null)}
            onApply={(next) => {
              const idx = jsonObjectModalIndex;
              setSchema((s) => ({
                ...s,
                fields: s.fields.map((f, i) =>
                  i === idx ? { ...f, ...next } : f,
                ),
              }));
              setJsonObjectModalIndex(null);
            }}
          />
        )}

      {referenceModalIndex !== null &&
        schema.fields[referenceModalIndex]?.type === "Reference" && (
          <ReferenceFieldModal
            open
            field={schema.fields[referenceModalIndex]!}
            otherModelKeys={linkTargets}
            onClose={() => setReferenceModalIndex(null)}
            onApply={(next) => {
              const idx = referenceModalIndex;
              setSchema((s) => ({
                ...s,
                fields: s.fields.map((f, i) =>
                  i === idx ? { ...f, ...next } : f,
                ),
              }));
              setReferenceModalIndex(null);
            }}
          />
        )}
    </>
  );
}
