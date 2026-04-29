/**
 * Rechte Sidebar des Email-Builders. Zeigt kontextuelle Einstellungen
 * für die aktuelle Auswahl:
 *   - Block-Auswahl    → Block-Properties (typenspezifisch) + Padding
 *   - Section-Auswahl  → Layout, Hintergrund, Padding
 *   - Body / nichts    → Globale Email-Einstellungen
 *
 * Alle Felder schreiben direkt in den Builder-State (mutate-API).
 * Texte (z. B. Heading-Content) werden im Canvas inline editiert,
 * NICHT hier — die Sidebar regelt nur Style/Properties.
 */
import { useMemo } from "react";
import type { BuilderApi } from "./useBuilderState";
import type {
  ButtonBlock,
  ContentBlock,
  DividerBlock,
  HtmlBlock,
  ImageBlock,
  Padding,
  Section,
  SectionLayout,
  SpacerBlock,
  TextBlock,
  HeadingBlock,
  Align,
  BlockPath,
} from "./types";

// ─── Atomic Form-Elemente ────────────────────────────────────────────

function FieldGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2 border-b border-hair px-3 py-3 last:border-b-0">
      <p className="text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-500">
        {title}
      </p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex items-center justify-between gap-2 text-[12px] text-ink-700">
      <span className="shrink-0">{label}</span>
      <span className="flex items-center gap-1">{children}</span>
    </label>
  );
}

function NumberInput({
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  width = 64,
  unit,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
  width?: number;
  unit?: string;
}) {
  return (
    <span className="inline-flex items-center gap-1">
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v)) onChange(v);
        }}
        className="rounded-md border border-hair bg-white px-1.5 py-1 text-right text-[12px] tabular-nums focus:border-ink-500 focus:outline-none"
        style={{ width }}
      />
      {unit && <span className="text-[11px] text-ink-500">{unit}</span>}
    </span>
  );
}

function ColorInput({
  value,
  onChange,
  allowEmpty = false,
}: {
  value: string | undefined;
  onChange: (next: string | undefined) => void;
  allowEmpty?: boolean;
}) {
  const display = value ?? (allowEmpty ? "" : "#ffffff");
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="relative h-6 w-6 overflow-hidden rounded border border-hair">
        <input
          type="color"
          value={value && /^#([0-9a-fA-F]{6})$/.test(value) ? value : "#ffffff"}
          onChange={(e) => onChange(e.target.value)}
          className="absolute -left-0.5 -top-0.5 h-8 w-8 cursor-pointer border-0 p-0"
        />
      </span>
      <input
        type="text"
        value={display}
        placeholder={allowEmpty ? "transparent" : "#000000"}
        onChange={(e) => {
          const v = e.target.value.trim();
          if (allowEmpty && v === "") {
            onChange(undefined);
            return;
          }
          onChange(v);
        }}
        className="w-20 rounded-md border border-hair bg-white px-1.5 py-1 font-mono text-[11px] focus:border-ink-500 focus:outline-none"
      />
      {allowEmpty && value !== undefined && (
        <button
          type="button"
          onClick={() => onChange(undefined)}
          title="Hintergrund entfernen"
          className="text-[11px] text-ink-500 hover:text-ink-900"
        >
          ✕
        </button>
      )}
    </span>
  );
}

function SelectInput<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (next: T) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="rounded-md border border-hair bg-white px-1.5 py-1 text-[12px] focus:border-ink-500 focus:outline-none"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (s: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-44 rounded-md border border-hair bg-white px-1.5 py-1 text-[12px] focus:border-ink-500 focus:outline-none"
    />
  );
}

function SwitchInput({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${
        value ? "bg-ink-900" : "bg-ink-200"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
          value ? "translate-x-4" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

const ALIGN_OPTIONS: { value: Align; label: string }[] = [
  { value: "left", label: "Links" },
  { value: "center", label: "Zentriert" },
  { value: "right", label: "Rechts" },
];

const FONT_OPTIONS = [
  { value: "Helvetica, Arial, sans-serif", label: "Helvetica / Arial" },
  { value: "Georgia, 'Times New Roman', serif", label: "Georgia" },
  { value: "'Trebuchet MS', sans-serif", label: "Trebuchet MS" },
  { value: "Verdana, sans-serif", label: "Verdana" },
  { value: "'Courier New', Courier, monospace", label: "Courier New" },
  {
    value:
      "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    label: "System UI",
  },
];

// ─── Padding-Editor (Top/Right/Bottom/Left) ──────────────────────────

function PaddingEditor({
  value,
  onChange,
}: {
  value: Padding;
  onChange: (p: Padding) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      <Row label="Oben">
        <NumberInput
          value={value.top}
          onChange={(top) => onChange({ ...value, top })}
          unit="px"
          width={56}
        />
      </Row>
      <Row label="Unten">
        <NumberInput
          value={value.bottom}
          onChange={(bottom) => onChange({ ...value, bottom })}
          unit="px"
          width={56}
        />
      </Row>
      <Row label="Links">
        <NumberInput
          value={value.left}
          onChange={(left) => onChange({ ...value, left })}
          unit="px"
          width={56}
        />
      </Row>
      <Row label="Rechts">
        <NumberInput
          value={value.right}
          onChange={(right) => onChange({ ...value, right })}
          unit="px"
          width={56}
        />
      </Row>
    </div>
  );
}

// ─── Body-Settings ────────────────────────────────────────────────────

function BodyPanel({ api }: { api: BuilderApi }) {
  const { design, updateBody } = api;
  return (
    <>
      <FieldGroup title="Hintergrund">
        <Row label="Body-Farbe">
          <ColorInput
            value={design.body.backgroundColor}
            onChange={(v) => v && updateBody({ backgroundColor: v })}
          />
        </Row>
        <Row label="Content-Farbe">
          <ColorInput
            value={design.body.contentBackgroundColor}
            onChange={(v) => v && updateBody({ contentBackgroundColor: v })}
          />
        </Row>
      </FieldGroup>
      <FieldGroup title="Layout">
        <Row label="Content-Breite">
          <NumberInput
            value={design.body.contentWidth}
            onChange={(contentWidth) => updateBody({ contentWidth })}
            min={320}
            max={800}
            step={10}
            unit="px"
          />
        </Row>
      </FieldGroup>
      <FieldGroup title="Typografie">
        <Row label="Schriftart">
          <SelectInput
            value={design.body.fontFamily}
            options={FONT_OPTIONS}
            onChange={(fontFamily) => updateBody({ fontFamily })}
          />
        </Row>
        <Row label="Textfarbe">
          <ColorInput
            value={design.body.color}
            onChange={(v) => v && updateBody({ color: v })}
          />
        </Row>
      </FieldGroup>
    </>
  );
}

// ─── Section-Settings ─────────────────────────────────────────────────

function SectionPanel({
  api,
  sectionIndex,
  section,
}: {
  api: BuilderApi;
  sectionIndex: number;
  section: Section;
}) {
  const { setSectionLayout, updateSection } = api;
  return (
    <>
      <FieldGroup title="Section">
        <Row label="Layout">
          <SelectInput<SectionLayout>
            value={section.layout}
            options={[
              { value: "1", label: "1 Spalte" },
              { value: "1-1", label: "1 : 1" },
              { value: "1-2", label: "1 : 2" },
              { value: "2-1", label: "2 : 1" },
              { value: "1-1-1", label: "1 : 1 : 1" },
            ]}
            onChange={(layout) => setSectionLayout(sectionIndex, layout)}
          />
        </Row>
        <Row label="Hintergrund">
          <ColorInput
            value={section.backgroundColor}
            onChange={(v) =>
              updateSection(sectionIndex, { backgroundColor: v })
            }
            allowEmpty
          />
        </Row>
      </FieldGroup>
      <FieldGroup title="Padding">
        <PaddingEditor
          value={section.padding}
          onChange={(padding) => updateSection(sectionIndex, { padding })}
        />
      </FieldGroup>
    </>
  );
}

// ─── Block-Settings (kontextual pro Block-Typ) ───────────────────────

function BlockPanel({
  api,
  path,
  block,
}: {
  api: BuilderApi;
  path: BlockPath;
  block: ContentBlock;
}) {
  const { updateBlock } = api;

  const update = <T extends ContentBlock>(patch: Partial<T>) =>
    updateBlock<T>(path, patch);

  return (
    <>
      {block.type === "text" && <TextSettings block={block} update={update} />}
      {block.type === "heading" && (
        <HeadingSettings block={block} update={update} />
      )}
      {block.type === "button" && (
        <ButtonSettings block={block} update={update} />
      )}
      {block.type === "image" && (
        <ImageSettings block={block} update={update} />
      )}
      {block.type === "spacer" && (
        <SpacerSettings block={block} update={update} />
      )}
      {block.type === "divider" && (
        <DividerSettings block={block} update={update} />
      )}
      {block.type === "html" && (
        <HtmlSettings block={block} update={update} />
      )}

      <FieldGroup title="Padding">
        <PaddingEditor
          value={block.padding}
          onChange={(padding) => updateBlock(path, { padding })}
        />
      </FieldGroup>
      <FieldGroup title="Block-Hintergrund">
        <Row label="Farbe">
          <ColorInput
            value={block.backgroundColor}
            onChange={(v) => updateBlock(path, { backgroundColor: v })}
            allowEmpty
          />
        </Row>
      </FieldGroup>
    </>
  );
}

type Updater<T extends ContentBlock> = (patch: Partial<T>) => void;

function TextSettings({
  block,
  update,
}: {
  block: TextBlock;
  update: Updater<TextBlock>;
}) {
  return (
    <FieldGroup title="Text">
      <Row label="Schrift">
        <SelectInput
          value={block.fontFamily}
          options={FONT_OPTIONS}
          onChange={(fontFamily) => update({ fontFamily })}
        />
      </Row>
      <Row label="Größe">
        <NumberInput
          value={block.fontSize}
          onChange={(fontSize) => update({ fontSize })}
          min={8}
          max={72}
          unit="px"
        />
      </Row>
      <Row label="Zeilenhöhe">
        <NumberInput
          value={block.lineHeight}
          onChange={(lineHeight) => update({ lineHeight })}
          min={1}
          max={3}
          step={0.05}
        />
      </Row>
      <Row label="Farbe">
        <ColorInput value={block.color} onChange={(v) => v && update({ color: v })} />
      </Row>
      <Row label="Ausrichtung">
        <SelectInput<Align>
          value={block.align}
          options={ALIGN_OPTIONS}
          onChange={(align) => update({ align })}
        />
      </Row>
    </FieldGroup>
  );
}

function HeadingSettings({
  block,
  update,
}: {
  block: HeadingBlock;
  update: Updater<HeadingBlock>;
}) {
  return (
    <FieldGroup title="Überschrift">
      <Row label="Ebene">
        <SelectInput
          value={String(block.level)}
          options={[
            { value: "1", label: "H1" },
            { value: "2", label: "H2" },
            { value: "3", label: "H3" },
          ]}
          onChange={(v) => update({ level: Number(v) as 1 | 2 | 3 })}
        />
      </Row>
      <Row label="Schrift">
        <SelectInput
          value={block.fontFamily}
          options={FONT_OPTIONS}
          onChange={(fontFamily) => update({ fontFamily })}
        />
      </Row>
      <Row label="Größe">
        <NumberInput
          value={block.fontSize}
          onChange={(fontSize) => update({ fontSize })}
          min={8}
          max={72}
          unit="px"
        />
      </Row>
      <Row label="Gewicht">
        <SelectInput
          value={String(block.fontWeight)}
          options={[
            { value: "400", label: "Regular" },
            { value: "500", label: "Medium" },
            { value: "600", label: "Semibold" },
            { value: "700", label: "Bold" },
          ]}
          onChange={(v) =>
            update({ fontWeight: Number(v) as 400 | 500 | 600 | 700 })
          }
        />
      </Row>
      <Row label="Farbe">
        <ColorInput value={block.color} onChange={(v) => v && update({ color: v })} />
      </Row>
      <Row label="Ausrichtung">
        <SelectInput<Align>
          value={block.align}
          options={ALIGN_OPTIONS}
          onChange={(align) => update({ align })}
        />
      </Row>
    </FieldGroup>
  );
}

function ButtonSettings({
  block,
  update,
}: {
  block: ButtonBlock;
  update: Updater<ButtonBlock>;
}) {
  return (
    <>
      <FieldGroup title="Button-Inhalt">
        <Row label="Text">
          <TextInput value={block.text} onChange={(text) => update({ text })} />
        </Row>
        <Row label="Link (URL)">
          <TextInput
            value={block.href}
            onChange={(href) => update({ href })}
            placeholder="https://…"
          />
        </Row>
      </FieldGroup>
      <FieldGroup title="Stil">
        <Row label="Hintergrund">
          <ColorInput
            value={block.backgroundColor}
            onChange={(v) => v && update({ backgroundColor: v })}
          />
        </Row>
        <Row label="Textfarbe">
          <ColorInput value={block.color} onChange={(v) => v && update({ color: v })} />
        </Row>
        <Row label="Größe">
          <NumberInput
            value={block.fontSize}
            onChange={(fontSize) => update({ fontSize })}
            min={10}
            max={32}
            unit="px"
          />
        </Row>
        <Row label="Gewicht">
          <SelectInput
            value={String(block.fontWeight)}
            options={[
              { value: "400", label: "Regular" },
              { value: "500", label: "Medium" },
              { value: "600", label: "Semibold" },
              { value: "700", label: "Bold" },
            ]}
            onChange={(v) =>
              update({ fontWeight: Number(v) as 400 | 500 | 600 | 700 })
            }
          />
        </Row>
        <Row label="Eckenradius">
          <NumberInput
            value={block.borderRadius}
            onChange={(borderRadius) => update({ borderRadius })}
            min={0}
            max={48}
            unit="px"
          />
        </Row>
        <Row label="Padding X">
          <NumberInput
            value={block.paddingX}
            onChange={(paddingX) => update({ paddingX })}
            unit="px"
          />
        </Row>
        <Row label="Padding Y">
          <NumberInput
            value={block.paddingY}
            onChange={(paddingY) => update({ paddingY })}
            unit="px"
          />
        </Row>
        <Row label="Volle Breite">
          <SwitchInput
            value={block.fullWidth}
            onChange={(fullWidth) => update({ fullWidth })}
          />
        </Row>
        <Row label="Ausrichtung">
          <SelectInput<Align>
            value={block.align}
            options={ALIGN_OPTIONS}
            onChange={(align) => update({ align })}
          />
        </Row>
      </FieldGroup>
    </>
  );
}

function ImageSettings({
  block,
  update,
}: {
  block: ImageBlock;
  update: Updater<ImageBlock>;
}) {
  const widthMode = block.width === "100%" ? "full" : "fixed";
  return (
    <>
      <FieldGroup title="Bild">
        <div className="space-y-1">
          <p className="text-[11.5px] text-ink-700">Bild-URL</p>
          <input
            type="text"
            value={block.src}
            onChange={(e) => update({ src: e.target.value })}
            placeholder="https://…/bild.png"
            className="w-full rounded-md border border-hair bg-white px-2 py-1 text-[12px] focus:border-ink-500 focus:outline-none"
          />
          <p className="text-[10.5px] leading-snug text-ink-500">
            Lade das Bild bei einem Hoster (R2/S3/Cloudinary) hoch und füge die
            öffentliche URL hier ein. Das Dashboard speichert keine Bilder selbst.
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-[11.5px] text-ink-700">Alt-Text</p>
          <input
            type="text"
            value={block.alt}
            onChange={(e) => update({ alt: e.target.value })}
            placeholder="Beschreibung für Screenreader"
            className="w-full rounded-md border border-hair bg-white px-2 py-1 text-[12px] focus:border-ink-500 focus:outline-none"
          />
        </div>
        <div className="space-y-1">
          <p className="text-[11.5px] text-ink-700">Link bei Klick</p>
          <input
            type="text"
            value={block.href ?? ""}
            onChange={(e) =>
              update({ href: e.target.value.trim() || undefined })
            }
            placeholder="https://… (optional)"
            className="w-full rounded-md border border-hair bg-white px-2 py-1 text-[12px] focus:border-ink-500 focus:outline-none"
          />
        </div>
      </FieldGroup>
      <FieldGroup title="Größe">
        <Row label="Modus">
          <SelectInput
            value={widthMode}
            options={[
              { value: "full", label: "Volle Breite" },
              { value: "fixed", label: "Fixe Pixel" },
            ]}
            onChange={(v) =>
              update({ width: v === "full" ? "100%" : 200 })
            }
          />
        </Row>
        {widthMode === "fixed" && (
          <Row label="Breite">
            <NumberInput
              value={typeof block.width === "number" ? block.width : 200}
              onChange={(w) => update({ width: w })}
              min={20}
              max={800}
              unit="px"
            />
          </Row>
        )}
        <Row label="Ausrichtung">
          <SelectInput<Align>
            value={block.align}
            options={ALIGN_OPTIONS}
            onChange={(align) => update({ align })}
          />
        </Row>
      </FieldGroup>
    </>
  );
}

function SpacerSettings({
  block,
  update,
}: {
  block: SpacerBlock;
  update: Updater<SpacerBlock>;
}) {
  return (
    <FieldGroup title="Spacer">
      <Row label="Höhe">
        <NumberInput
          value={block.height}
          onChange={(height) => update({ height })}
          min={0}
          max={200}
          unit="px"
        />
      </Row>
    </FieldGroup>
  );
}

function DividerSettings({
  block,
  update,
}: {
  block: DividerBlock;
  update: Updater<DividerBlock>;
}) {
  return (
    <FieldGroup title="Trenner">
      <Row label="Farbe">
        <ColorInput
          value={block.color}
          onChange={(v) => v && update({ color: v })}
        />
      </Row>
      <Row label="Stärke">
        <NumberInput
          value={block.thickness}
          onChange={(thickness) => update({ thickness })}
          min={1}
          max={12}
          unit="px"
        />
      </Row>
      <Row label="Inset">
        <NumberInput
          value={block.inset}
          onChange={(inset) => update({ inset })}
          min={0}
          max={40}
          unit="%"
        />
      </Row>
    </FieldGroup>
  );
}

function HtmlSettings({
  block,
  update,
}: {
  block: HtmlBlock;
  update: Updater<HtmlBlock>;
}) {
  return (
    <FieldGroup title="Custom HTML">
      <textarea
        value={block.html}
        onChange={(e) => update({ html: e.target.value })}
        rows={10}
        spellCheck={false}
        className="w-full rounded-md border border-hair bg-white p-2 font-mono text-[11.5px] leading-relaxed focus:border-ink-500 focus:outline-none"
      />
      <p className="text-[10.5px] leading-snug text-ink-500">
        Wird unverändert in die Mail eingebettet. Nutze inline-Styles, denn
        Email-Clients ignorieren externe CSS.
      </p>
    </FieldGroup>
  );
}

// ─── Top-Level ────────────────────────────────────────────────────────

export default function SettingsSidebar({ api }: { api: BuilderApi }) {
  const sel = api.selection;
  const design = api.design;

  const titleAndContent = useMemo(() => {
    if (!sel || sel.kind === "body") {
      return {
        title: "Globale Einstellungen",
        subtitle: "Body, Content-Breite, Default-Typografie.",
        body: <BodyPanel api={api} />,
      };
    }
    if (sel.kind === "section") {
      const section = design.sections[sel.sectionIndex];
      if (!section) {
        return {
          title: "Section",
          subtitle: "",
          body: <p className="px-3 py-3 text-[12px] text-ink-500">—</p>,
        };
      }
      return {
        title: `Section ${sel.sectionIndex + 1}`,
        subtitle: "Layout, Hintergrund und Padding der gewählten Reihe.",
        body: (
          <SectionPanel
            api={api}
            sectionIndex={sel.sectionIndex}
            section={section}
          />
        ),
      };
    }
    if (sel.kind === "block") {
      const { sectionIndex, columnIndex, blockIndex } = sel.path;
      const block =
        design.sections[sectionIndex]?.columns[columnIndex]?.blocks[
          blockIndex
        ];
      if (!block) {
        return {
          title: "Block",
          subtitle: "Nicht gefunden",
          body: <p className="px-3 py-3 text-[12px] text-ink-500">—</p>,
        };
      }
      return {
        title: blockTitle(block),
        subtitle: "Eigenschaften des ausgewählten Blocks.",
        body: <BlockPanel api={api} path={sel.path} block={block} />,
      };
    }
    return {
      title: "Auswahl",
      subtitle: "",
      body: null as React.ReactNode,
    };
  }, [api, design.sections, sel]);

  return (
    <aside className="flex w-full shrink-0 flex-col border-t border-hair bg-white md:w-[300px] md:border-l md:border-t-0">
      <div className="border-b border-hair px-3 py-2.5">
        <p className="text-[13px] font-semibold text-ink-900">
          {titleAndContent.title}
        </p>
        {titleAndContent.subtitle && (
          <p className="mt-0.5 text-[11px] text-ink-500">
            {titleAndContent.subtitle}
          </p>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {titleAndContent.body}
      </div>
    </aside>
  );
}

function blockTitle(block: ContentBlock): string {
  switch (block.type) {
    case "text":
      return "Text-Block";
    case "heading":
      return `Überschrift (H${block.level})`;
    case "button":
      return "Button";
    case "image":
      return "Bild";
    case "spacer":
      return "Spacer";
    case "divider":
      return "Trenner";
    case "html":
      return "Custom HTML";
  }
}
