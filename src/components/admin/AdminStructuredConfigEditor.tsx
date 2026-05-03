import { Plus, Trash2 } from "lucide-react";
import { useCallback, useState, type ReactNode } from "react";
import {
  ADMIN_ACTIVE_MODE_LABELS,
  ADMIN_CONTROLL_ACTION_LABELS,
  ADMIN_GENERATION_SLUG_LABELS,
  ADMIN_GENERATION_SLUG_PRESET,
  ADMIN_PREVIEW_SLUG_LABELS,
  controllButtonKeysForMode,
  DEFAULT_ACTIVE_CONTROLL_MODE,
  generationSlugOrder,
  isPresetPreviewSlug,
  previewImageSlugOrder,
  type ActiveControllModeConfig,
  type ControllButtonsConfig,
  type ControllButtonsModeKey,
} from "../../lib/adminSettingsFormModel";
import { ADMIN_SETTINGS_HINTS } from "../../lib/adminSettingsApi";

const MODES: readonly ControllButtonsModeKey[] = [
  "correction",
  "scaling",
  "shadow",
  "transparency",
] as const;

function FieldHint({ settingId }: { settingId: string }) {
  const text = ADMIN_SETTINGS_HINTS[settingId];
  if (!text) return null;
  return (
    <p className="border-b border-hair pb-4 text-[12px] leading-relaxed text-ink-500">
      {text}
    </p>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-hair bg-white/80 px-3 py-2.5 transition hover:bg-night-900/[0.02]">
      <span className="text-[13px] text-ink-800">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 shrink-0 rounded border-hair text-brand-600 focus:ring-brand-500 disabled:opacity-50"
      />
    </label>
  );
}

function ControllButtonsForm({
  value,
  onChange,
  disabled,
}: {
  value: ControllButtonsConfig;
  onChange: (v: ControllButtonsConfig) => void;
  disabled?: boolean;
}) {
  const setModeBool = useCallback(
    (mode: ControllButtonsModeKey, key: string, checked: boolean) => {
      onChange({
        buttons: {
          ...value.buttons,
          [mode]: { ...value.buttons[mode], [key]: checked },
        },
      });
    },
    [value.buttons, onChange],
  );

  return (
    <div className="space-y-6">
      <FieldHint settingId="controll_buttons" />
      <div className="grid gap-5 lg:grid-cols-2">
        {MODES.map((mode) => (
          <fieldset
            key={mode}
            className="rounded-lg border border-hair bg-paper/50 p-4"
          >
            <legend className="px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500">
              {ADMIN_ACTIVE_MODE_LABELS[mode]}
            </legend>
            <div className="mt-3 space-y-2">
              {controllButtonKeysForMode(mode, value).map((key: string) => (
                <ToggleRow
                  key={key}
                  label={
                    ADMIN_CONTROLL_ACTION_LABELS[key] ?? key.replace(/_/g, " ")
                  }
                  checked={Boolean(value.buttons[mode][key])}
                  onChange={(c) => setModeBool(mode, key, c)}
                  disabled={disabled}
                />
              ))}
            </div>
          </fieldset>
        ))}
      </div>
    </div>
  );
}

function ActiveControllModeForm({
  value,
  onChange,
  disabled,
}: {
  value: ActiveControllModeConfig;
  onChange: (v: ActiveControllModeConfig) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-4">
      <FieldHint settingId="active_controll_mode" />
      <div className="grid gap-2 sm:grid-cols-2">
        {MODES.map((mode) => (
          <ToggleRow
            key={mode}
            label={ADMIN_ACTIVE_MODE_LABELS[mode]}
            checked={value[mode]}
            onChange={(c) => onChange({ ...value, [mode]: c })}
            disabled={disabled}
          />
        ))}
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange({ ...DEFAULT_ACTIVE_CONTROLL_MODE })}
        className="text-[12px] text-ink-500 underline-offset-2 hover:text-ink-800 hover:underline disabled:opacity-50"
      >
        Alle Modi aktivieren
      </button>
    </div>
  );
}

function PreviewImagesForm({
  value,
  onChange,
  disabled,
}: {
  value: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
  disabled?: boolean;
}) {
  const [newSlug, setNewSlug] = useState("");
  const slugs = previewImageSlugOrder(value);

  const addSlug = () => {
    const s = newSlug.trim().toLowerCase().replace(/\s+/g, "_");
    if (!s || !/^[a-z0-9_-]{1,64}$/.test(s)) return;
    if (value[s] !== undefined) return;
    onChange({ ...value, [s]: "" });
    setNewSlug("");
  };

  return (
    <div className="space-y-4">
      <FieldHint settingId="preview_images" />
      <div className="space-y-3">
        {slugs.map((slug: string) => (
          <label key={slug} className="block">
            <span className="mb-1 flex items-center justify-between gap-2">
              <span className="text-[10.5px] font-medium uppercase tracking-[0.1em] text-ink-400">
                {ADMIN_PREVIEW_SLUG_LABELS[slug] ?? slug}
                <span className="ml-1 font-mono text-[10px] font-normal normal-case text-ink-500">
                  {slug}
                </span>
              </span>
              {!isPresetPreviewSlug(slug) && (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    const next = { ...value };
                    delete next[slug];
                    onChange(next);
                  }}
                  className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-accent-rose hover:bg-accent-rose/10 disabled:opacity-50"
                >
                  <Trash2 className="h-3 w-3" /> Zeile
                </button>
              )}
            </span>
            <input
              value={value[slug] ?? ""}
              disabled={disabled}
              onChange={(e) => onChange({ ...value, [slug]: e.target.value })}
              placeholder="https://…"
              className="w-full rounded-md border border-hair bg-white px-2.5 py-2 font-mono text-[12px] text-ink-800 focus:border-ink-400 focus:outline-none disabled:opacity-50"
            />
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-2 rounded-md border border-dashed border-hair bg-ink-50/50 p-3">
        <label className="min-w-[140px] flex-1">
          <span className="mb-1 block text-[10px] uppercase tracking-[0.12em] text-ink-400">
            Weitere Ansicht (Slug)
          </span>
          <input
            value={newSlug}
            disabled={disabled}
            onChange={(e) => setNewSlug(e.target.value)}
            placeholder="z. B. steeringwheel"
            className="w-full rounded-md border border-hair bg-white px-2 py-1.5 font-mono text-[12px] focus:border-ink-400 focus:outline-none"
          />
        </label>
        <button
          type="button"
          disabled={disabled}
          onClick={addSlug}
          className="inline-flex items-center gap-1 rounded-md border border-hair bg-white px-3 py-1.5 text-[12px] font-medium text-ink-800 hover:bg-night-900/[0.04] disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" /> Hinzufügen
        </button>
      </div>
    </div>
  );
}

function GenerationViewsForm({
  value,
  onChange,
  disabled,
}: {
  value: Record<string, boolean>;
  onChange: (v: Record<string, boolean>) => void;
  disabled?: boolean;
}) {
  const [newSlug, setNewSlug] = useState("");
  const slugs = generationSlugOrder(value);

  const addSlug = () => {
    const s = newSlug.trim().toLowerCase().replace(/\s+/g, "_");
    if (!s || !/^[a-z0-9_-]{1,64}$/.test(s)) return;
    onChange({ ...value, [s]: true });
    setNewSlug("");
  };

  return (
    <div className="space-y-4">
      <FieldHint settingId="generation_views" />
      <div className="space-y-2">
        {slugs.map((slug: string) => (
          <div
            key={slug}
            className="flex items-stretch gap-2 rounded-md border border-hair bg-white/80"
          >
            <div className="min-w-0 flex-1">
              <ToggleRow
                label={
                  <span>
                    <span className="font-medium text-ink-900">
                      {ADMIN_GENERATION_SLUG_LABELS[slug] ?? slug}
                    </span>
                    <span className="ml-2 font-mono text-[11px] text-ink-500">
                      {slug}
                    </span>
                  </span>
                }
                checked={value[slug] === true}
                onChange={(c) => onChange({ ...value, [slug]: c })}
                disabled={disabled}
              />
            </div>
            {!ADMIN_GENERATION_SLUG_PRESET.includes(
              slug as (typeof ADMIN_GENERATION_SLUG_PRESET)[number],
            ) && (
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  const next = { ...value };
                  delete next[slug];
                  onChange(next);
                }}
                className="shrink-0 border-l border-hair px-2.5 text-accent-rose hover:bg-accent-rose/5 disabled:opacity-50"
                title="Slug entfernen"
              >
                <Trash2 className="mx-auto h-4 w-4" />
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-2 rounded-md border border-dashed border-hair bg-ink-50/50 p-3">
        <label className="min-w-[140px] flex-1">
          <span className="mb-1 block text-[10px] uppercase tracking-[0.12em] text-ink-400">
            Slug für neue Ansicht
          </span>
          <input
            value={newSlug}
            disabled={disabled}
            onChange={(e) => setNewSlug(e.target.value)}
            className="w-full rounded-md border border-hair bg-white px-2 py-1.5 font-mono text-[12px] focus:border-ink-400 focus:outline-none"
          />
        </label>
        <button
          type="button"
          disabled={disabled}
          onClick={addSlug}
          className="inline-flex items-center gap-1 rounded-md border border-hair bg-white px-3 py-1.5 text-[12px] font-medium hover:bg-night-900/[0.04] disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" /> Hinzufügen (an)
        </button>
      </div>
    </div>
  );
}

function GoogleTemplateForm({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-4">
      <FieldHint settingId="google_image_search" />
      <label className="block">
        <span className="mb-1.5 block text-[10.5px] font-medium uppercase tracking-[0.12em] text-ink-400">
          Vorlage
        </span>
        <textarea
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          className="w-full rounded-md border border-hair bg-white px-2.5 py-2 text-[13px] leading-relaxed text-ink-800 focus:border-ink-400 focus:outline-none disabled:opacity-50"
        />
      </label>
      <p className="text-[11px] text-ink-500">
        Platzhalter:{" "}
        <span className="font-mono text-ink-600">
          {`{{marke}} {{model}} {{jahr}} {{body}} {{trim}} {{ansicht}}`}
        </span>
      </p>
    </div>
  );
}

function ViewsSlugListForm({
  settingId,
  items,
  onChange,
  disabled,
}: {
  settingId: "first_views" | "inside_views";
  items: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const [addVal, setAddVal] = useState("");

  const push = (raw: string) => {
    const s = raw.trim().toLowerCase().replace(/\s+/g, "_");
    if (!s || !/^[a-z0-9_-]{1,64}$/.test(s)) return;
    if (items.includes(s)) return;
    onChange([...items, s]);
    setAddVal("");
  };

  return (
    <div className="space-y-4">
      <FieldHint settingId={settingId} />
      <ul className="flex flex-wrap gap-2">
        {items.map((slug: string) => (
          <li
            key={slug}
            className="inline-flex items-center gap-1 rounded-full border border-hair bg-white px-2.5 py-1 text-[12px] text-ink-800"
          >
            <span className="font-mono">{slug}</span>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange(items.filter((x) => x !== slug))}
              className="rounded p-0.5 text-ink-400 hover:bg-ink-100 hover:text-accent-rose disabled:opacity-50"
              aria-label={`${slug} entfernen`}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-[160px] flex-1">
          <span className="mb-1 block text-[10px] uppercase tracking-[0.12em] text-ink-400">
            Ansicht hinzufügen
          </span>
          <input
            value={addVal}
            disabled={disabled}
            onChange={(e) => setAddVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                push(addVal);
              }
            }}
            placeholder="z. B. front_left"
            className="w-full rounded-md border border-hair bg-white px-2 py-1.5 font-mono text-[12px] focus:border-ink-400 focus:outline-none"
          />
        </label>
        <button
          type="button"
          disabled={disabled}
          onClick={() => push(addVal)}
          className="inline-flex items-center gap-1 rounded-md border border-hair bg-white px-3 py-1.5 text-[12px] font-medium hover:bg-night-900/[0.04] disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" /> Hinzufügen
        </button>
      </div>
    </div>
  );
}

function ImageAiForm({
  value,
  onChange,
  disabled,
}: {
  value: 0 | 1;
  onChange: (v: 0 | 1) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-4">
      <FieldHint settingId="image_ai" />
      <label className="block max-w-md">
        <span className="mb-1.5 block text-[10.5px] font-medium uppercase tracking-[0.12em] text-ink-400">
          Anbieter
        </span>
        <select
          value={value}
          disabled={disabled}
          onChange={(e) =>
            onChange(Number(e.target.value) === 0 ? 0 : 1)
          }
          className="w-full rounded-md border border-hair bg-white px-2.5 py-2 text-[13px] text-ink-800 focus:border-ink-400 focus:outline-none disabled:opacity-50"
        >
          <option value={0}>Nano banana (Vertex)</option>
          <option value={1}>Nano banana (Kie.ai)</option>
        </select>
      </label>
    </div>
  );
}

export type AdminStructuredDraft = unknown;

export default function AdminStructuredConfigEditor({
  settingId,
  draft,
  onDraftChange,
  disabled,
}: {
  settingId: string;
  draft: AdminStructuredDraft;
  onDraftChange: (v: AdminStructuredDraft) => void;
  disabled?: boolean;
}) {
  switch (settingId) {
    case "controll_buttons":
      return (
        <ControllButtonsForm
          value={draft as ControllButtonsConfig}
          onChange={onDraftChange}
          disabled={disabled}
        />
      );
    case "active_controll_mode":
      return (
        <ActiveControllModeForm
          value={draft as ActiveControllModeConfig}
          onChange={onDraftChange}
          disabled={disabled}
        />
      );
    case "preview_images":
      return (
        <PreviewImagesForm
          value={draft as Record<string, string>}
          onChange={onDraftChange}
          disabled={disabled}
        />
      );
    case "generation_views":
      return (
        <GenerationViewsForm
          value={draft as Record<string, boolean>}
          onChange={onDraftChange}
          disabled={disabled}
        />
      );
    case "google_image_search":
      return (
        <GoogleTemplateForm
          value={draft as string}
          onChange={onDraftChange}
          disabled={disabled}
        />
      );
    case "first_views":
      return (
        <ViewsSlugListForm
          settingId="first_views"
          items={draft as string[]}
          onChange={onDraftChange}
          disabled={disabled}
        />
      );
    case "inside_views":
      return (
        <ViewsSlugListForm
          settingId="inside_views"
          items={draft as string[]}
          onChange={onDraftChange}
          disabled={disabled}
        />
      );
    case "image_ai":
      return (
        <ImageAiForm
          value={draft as 0 | 1}
          onChange={onDraftChange}
          disabled={disabled}
        />
      );
    default:
      return null;
  }
}
