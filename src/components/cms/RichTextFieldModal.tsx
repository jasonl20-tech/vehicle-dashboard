import {
  Image as ImageIcon,
  Info,
  Link as LinkIcon,
  Link2,
  List,
  ListOrdered,
  Quote,
  Table2,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import type { CmsFieldDefinition } from "../../lib/cmsSchemaTypes";
import {
  ALL_RICH_TEXT_MARKS,
  defaultRichTextFieldConfig,
  FIELD_TYPE_LABELS,
  RICH_TEXT_MARK_LABELS,
  type RichTextFieldConfig,
  type RichTextEntryTypeFilter,
  type RichTextSizeLimit,
  type RichTextValidationConfig,
} from "../../lib/cmsSchemaTypes";

type Tab = "name" | "settings" | "validation" | "default";

type Local = {
  name: string;
  id: string;
  required: boolean;
  localized: boolean;
  helpText: string;
  richText: RichTextFieldConfig;
};

function cloneLocal(f: CmsFieldDefinition): Local {
  return {
    name: f.name,
    id: f.id,
    required: f.required,
    localized: Boolean(f.localized),
    helpText: f.helpText ?? "",
    richText: f.richText
      ? (JSON.parse(JSON.stringify(f.richText)) as RichTextFieldConfig)
      : defaultRichTextFieldConfig(),
  };
}

function ensureSize(
  v: RichTextValidationConfig,
  key: keyof RichTextValidationConfig,
): RichTextSizeLimit {
  const cur = v[key];
  if (cur && typeof cur === "object" && "enabled" in cur)
    return cur as RichTextSizeLimit;
  return { enabled: false };
}

function ensureTypes(
  v: RichTextValidationConfig,
  key: "linkToEntryTypes" | "embedBlockTypes" | "embedInlineTypes",
): RichTextEntryTypeFilter {
  const cur = v[key];
  if (cur && typeof cur === "object" && "keys" in cur)
    return cur as RichTextEntryTypeFilter;
  return { enabled: false, keys: [] };
}

type Props = {
  open: boolean;
  field: CmsFieldDefinition;
  onClose: () => void;
  onApply: (next: CmsFieldDefinition) => void;
  otherModelKeys: string[];
};

const TAB_ITEMS: { id: Tab; label: string }[] = [
  { id: "name", label: "Name and field ID" },
  { id: "settings", label: "Settings" },
  { id: "validation", label: "Validation" },
  { id: "default", label: "Default value" },
];

export default function RichTextFieldModal({
  open,
  field,
  onClose,
  onApply,
  otherModelKeys,
}: Props) {
  const [tab, setTab] = useState<Tab>("name");
  const [local, setLocal] = useState<Local>(() => cloneLocal(field));
  const prevOpen = useRef(false);

  useEffect(() => {
    if (open && !prevOpen.current) {
      setLocal(cloneLocal(field));
      setTab("name");
    }
    prevOpen.current = open;
  }, [open, field]);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  if (!open || field.type !== "RichText") return null;

  const rt = local.richText;
  const marks = new Set(rt.settings.formattingMarks);

  function toggleMark(id: string) {
    const next = new Set(marks);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setLocal((s) => ({
      ...s,
      richText: {
        ...s.richText,
        settings: {
          ...s.richText.settings,
          formattingMarks: [...next],
        },
      },
    }));
  }

  function disableAllFormatting() {
    setLocal((s) => ({
      ...s,
      richText: {
        ...s.richText,
        settings: { ...s.richText.settings, formattingMarks: [] },
      },
    }));
  }

  function patchValidation(patch: Partial<RichTextValidationConfig>) {
    setLocal((s) => ({
      ...s,
      richText: {
        ...s.richText,
        validation: { ...s.richText.validation, ...patch },
      },
    }));
  }

  function applyClick() {
    const name = local.name.slice(0, 50);
    const id = local.id.slice(0, 64);
    const helpText = local.helpText.slice(0, 255);
    const next: CmsFieldDefinition = {
      ...field,
      name,
      id,
      required: local.required,
      localized: local.localized ? true : undefined,
      helpText: helpText.trim() || undefined,
      richText: local.richText,
    };
    onApply(next);
    onClose();
  }

  const sidebarBtn = (t: Tab, label: string) => (
    <button
      key={t}
      type="button"
      onClick={() => setTab(t)}
      className={`w-full px-3 py-2.5 text-left text-[13px] transition ${
        tab === t
          ? "border-l-[3px] border-l-[#0366d6] bg-[#e8eaed] font-medium text-[#1a1a1a]"
          : "border-l-[3px] border-l-transparent text-[#5f6368] hover:bg-[#f1f3f4]"
      }`}
    >
      {label}
    </button>
  );

  const valRow = (
    title: string,
    desc: string,
    checked: boolean,
    onChange: (v: boolean) => void,
    children?: ReactNode,
  ) => (
    <div className="border-b border-[#e8eaed] py-4 last:border-b-0">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 rounded border-[#dadce0] text-[#0366d6] accent-[#0366d6]"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span>
          <span className="block text-[13px] font-semibold text-[#1a1a1a]">
            {title}
          </span>
          <span className="mt-0.5 block text-[12px] leading-snug text-[#5f6368]">
            {desc}
          </span>
        </span>
      </label>
      {children}
    </div>
  );

  const sizeInputs = (
    s: RichTextSizeLimit,
    onPatch: (next: RichTextSizeLimit) => void,
  ) =>
    s.enabled ? (
      <div className="mt-3 ml-7 grid max-w-xs grid-cols-2 gap-3">
        <div>
          <span className="mb-1 block text-[11px] font-medium text-[#5f6368]">
            Min
          </span>
          <input
            type="number"
            className="w-full rounded border border-[#dadce0] px-2 py-1.5 text-[13px]"
            value={s.min ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              onPatch({
                ...s,
                min: v === "" ? undefined : Number(v),
              });
            }}
          />
        </div>
        <div>
          <span className="mb-1 block text-[11px] font-medium text-[#5f6368]">
            Max
          </span>
          <input
            type="number"
            className="w-full rounded border border-[#dadce0] px-2 py-1.5 text-[13px]"
            value={s.max ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              onPatch({
                ...s,
                max: v === "" ? undefined : Number(v),
              });
            }}
          />
        </div>
      </div>
    ) : null;

  const typeCheckboxes = (
    tf: RichTextEntryTypeFilter,
    onPatch: (next: RichTextEntryTypeFilter) => void,
  ) =>
    tf.enabled && otherModelKeys.length > 0 ? (
      <div className="mt-3 ml-7 flex flex-wrap gap-2">
        {otherModelKeys.map((mk) => {
          const set = new Set(tf.keys);
          const on = set.has(mk);
          return (
            <label
              key={mk}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#dadce0] bg-white px-2.5 py-1 text-[11px]"
            >
              <input
                type="checkbox"
                className="rounded border-[#dadce0] accent-[#0366d6]"
                checked={on}
                onChange={() => {
                  const next = new Set(tf.keys);
                  if (next.has(mk)) next.delete(mk);
                  else next.add(mk);
                  onPatch({ ...tf, keys: [...next] });
                }}
              />
              <code>{mk}</code>
            </label>
          );
        })}
      </div>
    ) : null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Schließen"
        onClick={onClose}
      />
      <div className="relative flex max-h-[min(92vh,880px)] w-full max-w-[960px] flex-col overflow-hidden rounded-lg border border-[#dadce0] bg-white shadow-2xl">
        <header className="flex shrink-0 items-center justify-between border-b border-[#dadce0] px-5 py-4">
          <h2 className="text-[15px] font-semibold text-[#1a1a1a]">
            <span className="font-normal text-[#5f6368]">
              {local.name || field.name}
            </span>{" "}
            <span className="text-[#5f6368]">{FIELD_TYPE_LABELS.RichText}</span>
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

        <div className="flex min-h-0 flex-1">
          <nav className="w-[220px] shrink-0 overflow-y-auto border-r border-[#dadce0] bg-[#f8f9fa] py-2">
            {TAB_ITEMS.map(({ id, label }) => sidebarBtn(id, label))}
          </nav>

          <div className="min-w-0 flex-1 overflow-y-auto bg-white p-6">
            {tab === "name" && (
              <div className="max-w-xl space-y-8">
                <section>
                  <h3 className="mb-4 text-[18px] font-semibold text-[#1a1a1a]">
                    Name and field ID
                  </h3>
                  <div className="space-y-5">
                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <label className="text-[13px] font-medium text-[#1a1a1a]">
                          Name <span className="text-[#d93025]">*</span>
                        </label>
                        <span className="text-[11px] text-[#5f6368]">
                          {local.name.length} / 50
                        </span>
                      </div>
                      <input
                        value={local.name}
                        onChange={(e) =>
                          setLocal((s) => ({
                            ...s,
                            name: e.target.value.slice(0, 50),
                          }))
                        }
                        className="w-full rounded border border-[#dadce0] px-3 py-2 text-[13px] outline-none focus:border-[#0366d6] focus:ring-1 focus:ring-[#0366d6]"
                      />
                    </div>
                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <label className="text-[13px] font-medium text-[#1a1a1a]">
                          Field ID <span className="text-[#d93025]">*</span>
                        </label>
                        <span className="text-[11px] text-[#5f6368]">
                          {local.id.length} / 64
                        </span>
                      </div>
                      <input
                        value={local.id}
                        onChange={(e) =>
                          setLocal((s) => ({
                            ...s,
                            id: e.target.value.slice(0, 64),
                          }))
                        }
                        className="w-full rounded border border-[#dadce0] px-3 py-2 font-mono text-[13px] outline-none focus:border-[#0366d6] focus:ring-1 focus:ring-[#0366d6]"
                      />
                    </div>
                  </div>
                </section>
                <section>
                  <h3 className="mb-2 text-[13px] font-semibold text-[#1a1a1a]">
                    Help text
                  </h3>
                  <input
                    value={local.helpText}
                    onChange={(e) =>
                      setLocal((s) => ({
                        ...s,
                        helpText: e.target.value.slice(0, 255),
                      }))
                    }
                    className="w-full rounded border border-[#dadce0] px-3 py-2 text-[13px]"
                  />
                  <div className="mt-1 flex justify-between text-[11px] text-[#5f6368]">
                    <span>Appears below the field in the editor.</span>
                    <span>{local.helpText.length} / 255</span>
                  </div>
                </section>
              </div>
            )}

            {tab === "settings" && (
              <div className="max-w-2xl space-y-8">
                <section>
                  <h3 className="mb-4 text-[18px] font-semibold text-[#1a1a1a]">
                    Settings
                  </h3>
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-[#dadce0] accent-[#0366d6]"
                      checked={local.localized}
                      onChange={(e) =>
                        setLocal((s) => ({
                          ...s,
                          localized: e.target.checked,
                        }))
                      }
                    />
                    <span>
                      <span className="block text-[13px] font-semibold text-[#1a1a1a]">
                        Enable localization of this field
                      </span>
                      <span className="mt-0.5 block text-[12px] text-[#5f6368]">
                        Content can be translated per configured locale.
                      </span>
                    </span>
                  </label>
                </section>

                <section>
                  <div className="mb-3 flex items-center justify-between">
                    <h4 className="text-[13px] font-semibold text-[#1a1a1a]">
                      Formatting
                    </h4>
                    <button
                      type="button"
                      onClick={disableAllFormatting}
                      className="text-[12px] font-medium text-[#0366d6] hover:underline"
                    >
                      Disable all
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[...ALL_RICH_TEXT_MARKS].map((mid) => {
                      const on = marks.has(mid);
                      const label = RICH_TEXT_MARK_LABELS[mid] ?? mid;
                      const iconExtra =
                        mid === "bulletList" ? (
                          <List className="h-3.5 w-3.5" />
                        ) : mid === "orderedList" ? (
                          <ListOrdered className="h-3.5 w-3.5" />
                        ) : mid === "blockquote" ? (
                          <Quote className="h-3.5 w-3.5" />
                        ) : mid === "table" ? (
                          <Table2 className="h-3.5 w-3.5" />
                        ) : null;
                      return (
                        <button
                          key={mid}
                          type="button"
                          onClick={() => toggleMark(mid)}
                          className={`flex h-9 min-w-[2.25rem] items-center justify-center gap-1 rounded border px-2 text-[11px] font-semibold transition ${
                            on
                              ? "border-[#0366d6] bg-white text-[#0366d6]"
                              : "border-[#dadce0] bg-white text-[#80868b]"
                          }`}
                        >
                          {iconExtra}
                          {!iconExtra ? label : null}
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section>
                  <h4 className="mb-3 text-[13px] font-semibold text-[#1a1a1a]">
                    Allow hyperlinks
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        ["hyperlinkUrl", "Link to URL", LinkIcon],
                        ["hyperlinkEntry", "Link to entry", Link2],
                        ["hyperlinkAsset", "Link to asset", ImageIcon],
                      ] as const
                    ).map(([key, label, Icon]) => {
                      const on = rt.settings[key];
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() =>
                            setLocal((s) => ({
                              ...s,
                              richText: {
                                ...s.richText,
                                settings: {
                                  ...s.richText.settings,
                                  [key]: !s.richText.settings[key],
                                },
                              },
                            }))
                          }
                          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium ${
                            on
                              ? "border-[#0366d6] text-[#0366d6]"
                              : "border-[#dadce0] text-[#80868b]"
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section>
                  <h4 className="mb-3 text-[13px] font-semibold text-[#1a1a1a]">
                    Allow embedded entries &amp; assets
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        ["embedEntry", "Entry", Link2],
                        ["embedInlineEntry", "Inline entry", Link2],
                        ["embedAsset", "Asset", ImageIcon],
                      ] as const
                    ).map(([key, label, Icon]) => {
                      const on = rt.settings[key];
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() =>
                            setLocal((s) => ({
                              ...s,
                              richText: {
                                ...s.richText,
                                settings: {
                                  ...s.richText.settings,
                                  [key]: !s.richText.settings[key],
                                },
                              },
                            }))
                          }
                          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium ${
                            on
                              ? "border-[#0366d6] text-[#0366d6]"
                              : "border-[#dadce0] text-[#80868b]"
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </section>
              </div>
            )}

            {tab === "validation" && (
              <div>
                <h3 className="mb-2 text-[18px] font-semibold text-[#1a1a1a]">
                  Validation
                </h3>
                <div className="max-w-2xl">
                  <div className="mb-6">
                    <h4 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[#5f6368]">
                      General validations
                    </h4>
                    {valRow(
                      "Required field",
                      "You won't be able to publish an entry if this field is empty.",
                      local.required,
                      (v) => setLocal((s) => ({ ...s, required: v })),
                    )}
                    {valRow(
                      "Limit character count",
                      "Specify a minimum and/or maximum allowed number of characters.",
                      Boolean(rt.validation.size?.enabled),
                      (en) => {
                        const cur = ensureSize(rt.validation, "size");
                        patchValidation({
                          size: {
                            ...cur,
                            enabled: en,
                            min: en ? cur.min : undefined,
                            max: en ? cur.max : undefined,
                          },
                        });
                      },
                      sizeInputs(ensureSize(rt.validation, "size"), (next) =>
                        patchValidation({ size: next }),
                      ),
                    )}
                  </div>

                  <div className="mb-6">
                    <h4 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[#5f6368]">
                      Link to entry
                    </h4>
                    {valRow(
                      "Limit number of entries",
                      "Specify a minimum and/or maximum allowed number of entries.",
                      Boolean(rt.validation.linkToEntry?.enabled),
                      (en) => {
                        const cur = ensureSize(rt.validation, "linkToEntry");
                        patchValidation({
                          linkToEntry: { ...cur, enabled: en },
                        });
                      },
                      sizeInputs(
                        ensureSize(rt.validation, "linkToEntry"),
                        (next) => patchValidation({ linkToEntry: next }),
                      ),
                    )}
                    {valRow(
                      "Accept only specified entry type",
                      "Make this link type only accept entries from specified content type(s).",
                      Boolean(rt.validation.linkToEntryTypes?.enabled),
                      (en) => {
                        const cur = ensureTypes(
                          rt.validation,
                          "linkToEntryTypes",
                        );
                        patchValidation({
                          linkToEntryTypes: {
                            ...cur,
                            enabled: en,
                            keys: en ? cur.keys : [],
                          },
                        });
                      },
                      typeCheckboxes(
                        ensureTypes(rt.validation, "linkToEntryTypes"),
                        (next) => patchValidation({ linkToEntryTypes: next }),
                      ),
                    )}
                  </div>

                  <div className="mb-6">
                    <h4 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[#5f6368]">
                      Link to asset
                    </h4>
                    {valRow(
                      "Limit number of entries",
                      "Specify a minimum and/or maximum allowed number of entries.",
                      Boolean(rt.validation.linkToAsset?.enabled),
                      (en) => {
                        const cur = ensureSize(rt.validation, "linkToAsset");
                        patchValidation({ linkToAsset: { ...cur, enabled: en } });
                      },
                      sizeInputs(
                        ensureSize(rt.validation, "linkToAsset"),
                        (next) => patchValidation({ linkToAsset: next }),
                      ),
                    )}
                  </div>

                  <div className="mb-6">
                    <h4 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[#5f6368]">
                      Embedded block entry
                    </h4>
                    {valRow(
                      "Limit number of entries",
                      "Specify a minimum and/or maximum allowed number of entries.",
                      Boolean(rt.validation.embedBlock?.enabled),
                      (en) => {
                        const cur = ensureSize(rt.validation, "embedBlock");
                        patchValidation({ embedBlock: { ...cur, enabled: en } });
                      },
                      sizeInputs(
                        ensureSize(rt.validation, "embedBlock"),
                        (next) => patchValidation({ embedBlock: next }),
                      ),
                    )}
                    {valRow(
                      "Accept only specified entry type",
                      "Make this link type only accept entries from specified content type(s).",
                      Boolean(rt.validation.embedBlockTypes?.enabled),
                      (en) => {
                        const cur = ensureTypes(
                          rt.validation,
                          "embedBlockTypes",
                        );
                        patchValidation({
                          embedBlockTypes: {
                            ...cur,
                            enabled: en,
                            keys: en ? cur.keys : [],
                          },
                        });
                      },
                      typeCheckboxes(
                        ensureTypes(rt.validation, "embedBlockTypes"),
                        (next) => patchValidation({ embedBlockTypes: next }),
                      ),
                    )}
                  </div>

                  <div className="mb-6">
                    <h4 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[#5f6368]">
                      Embedded inline entry
                    </h4>
                    {valRow(
                      "Limit number of entries",
                      "Specify a minimum and/or maximum allowed number of entries.",
                      Boolean(rt.validation.embedInline?.enabled),
                      (en) => {
                        const cur = ensureSize(rt.validation, "embedInline");
                        patchValidation({
                          embedInline: { ...cur, enabled: en },
                        });
                      },
                      sizeInputs(
                        ensureSize(rt.validation, "embedInline"),
                        (next) => patchValidation({ embedInline: next }),
                      ),
                    )}
                    {valRow(
                      "Accept only specified entry type",
                      "Make this link type only accept entries from specified content type(s).",
                      Boolean(rt.validation.embedInlineTypes?.enabled),
                      (en) => {
                        const cur = ensureTypes(
                          rt.validation,
                          "embedInlineTypes",
                        );
                        patchValidation({
                          embedInlineTypes: {
                            ...cur,
                            enabled: en,
                            keys: en ? cur.keys : [],
                          },
                        });
                      },
                      typeCheckboxes(
                        ensureTypes(rt.validation, "embedInlineTypes"),
                        (next) => patchValidation({ embedInlineTypes: next }),
                      ),
                    )}
                  </div>

                  <div className="mb-6">
                    <h4 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[#5f6368]">
                      Embedded asset
                    </h4>
                    {valRow(
                      "Limit number of entries",
                      "Specify a minimum and/or maximum allowed number of entries.",
                      Boolean(rt.validation.embedAsset?.enabled),
                      (en) => {
                        const cur = ensureSize(rt.validation, "embedAsset");
                        patchValidation({
                          embedAsset: { ...cur, enabled: en },
                        });
                      },
                      sizeInputs(
                        ensureSize(rt.validation, "embedAsset"),
                        (next) => patchValidation({ embedAsset: next }),
                      ),
                    )}
                  </div>
                </div>
              </div>
            )}

            {tab === "default" && (
              <div className="max-w-xl">
                <h3 className="mb-4 text-[18px] font-semibold text-[#1a1a1a]">
                  Default value
                </h3>
                <div className="flex gap-3 rounded-lg border border-[#aecbfa] bg-[#e8f0fe] p-4">
                  <Info className="h-5 w-5 shrink-0 text-[#0366d6]" />
                  <div>
                    <p className="text-[13px] font-semibold text-[#174ea6]">
                      Not available for this field type
                    </p>
                    <p className="mt-1 text-[12px] leading-relaxed text-[#1967d2]">
                      You can only set a default value for the text, boolean,
                      date and time, and number field types.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <footer className="flex shrink-0 justify-end gap-2 border-t border-[#dadce0] bg-[#f8f9fa] px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded px-4 py-2 text-[13px] font-medium text-[#5f6368] hover:bg-[#e8eaed]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={applyClick}
            className="rounded bg-[#0366d6] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#0256b9]"
          >
            Apply
          </button>
        </footer>
      </div>
    </div>
  );
}
