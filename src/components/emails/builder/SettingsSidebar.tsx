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
import { Trash2 } from "lucide-react";
import AssetUrlInput from "../../assets/AssetUrlInput";
import {
  SOCIAL_NETWORKS,
  newId,
  socialDefaultUrl,
  socialLabel,
} from "./defaults";
import type { BuilderApi } from "./useBuilderState";
import type {
  AvatarBlock,
  Border,
  ButtonBlock,
  ContentBlock,
  DividerBlock,
  HtmlBlock,
  ImageBlock,
  ListBlock,
  Padding,
  QuoteBlock,
  Section,
  SectionLayout,
  SocialBlock,
  SocialNetwork,
  SpacerBlock,
  TextBlock,
  VideoBlock,
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

// ─── Border-Editor (Farbe / Breite / Stil) ───────────────────────────

function BorderEditor({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Border | undefined;
  onChange: (next: Border | undefined) => void;
}) {
  const enabled = !!value && value.width > 0;
  return (
    <div className="space-y-1.5">
      <Row label={label}>
        <SwitchInput
          value={enabled}
          onChange={(on) =>
            onChange(
              on
                ? value && value.width > 0
                  ? value
                  : { color: "#e5e5e7", width: 1, style: "solid" }
                : undefined,
            )
          }
        />
      </Row>
      {enabled && value && (
        <>
          <Row label="Farbe">
            <ColorInput
              value={value.color}
              onChange={(v) => v && onChange({ ...value, color: v })}
            />
          </Row>
          <Row label="Stärke">
            <NumberInput
              value={value.width}
              onChange={(width) => onChange({ ...value, width })}
              min={0}
              max={20}
              unit="px"
            />
          </Row>
          <Row label="Stil">
            <SelectInput
              value={value.style}
              options={[
                { value: "solid", label: "Durchgezogen" },
                { value: "dashed", label: "Gestrichelt" },
                { value: "dotted", label: "Gepunktet" },
              ]}
              onChange={(style) =>
                onChange({ ...value, style: style as Border["style"] })
              }
            />
          </Row>
        </>
      )}
    </div>
  );
}

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
        <Row label="Body-Padding Y">
          <NumberInput
            value={design.body.contentPaddingY}
            onChange={(contentPaddingY) => updateBody({ contentPaddingY })}
            min={0}
            max={120}
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
      <FieldGroup title="Trennlinien">
        <BorderEditor
          label="Linie oben"
          value={section.borderTop}
          onChange={(borderTop) =>
            updateSection(sectionIndex, { borderTop })
          }
        />
        <BorderEditor
          label="Linie unten"
          value={section.borderBottom}
          onChange={(borderBottom) =>
            updateSection(sectionIndex, { borderBottom })
          }
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
      {block.type === "list" && <ListSettings block={block} update={update} />}
      {block.type === "quote" && (
        <QuoteSettings block={block} update={update} />
      )}
      {block.type === "video" && (
        <VideoSettings block={block} update={update} />
      )}
      {block.type === "social" && (
        <SocialSettings block={block} update={update} />
      )}
      {block.type === "avatar" && (
        <AvatarSettings block={block} update={update} />
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
      <FieldGroup title="Rahmen">
        <BorderEditor
          label="Rahmen aktiv"
          value={block.border}
          onChange={(border) => update({ border })}
        />
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
          <AssetUrlInput
            value={block.src}
            onChange={(src) => update({ src })}
            placeholder="https://…/bild.png"
            accept={["image/"]}
            preview
          />
          <p className="text-[10.5px] leading-snug text-ink-500">
            Klicke auf <strong>Assets</strong>, um ein Bild aus dem
            R2-Bucket (`assets.vehicleimagery.com`) auszuwählen oder hochzuladen.
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
        <Row label="Eckenradius">
          <NumberInput
            value={block.borderRadius}
            onChange={(borderRadius) => update({ borderRadius })}
            min={0}
            max={64}
            unit="px"
          />
        </Row>
      </FieldGroup>
      <FieldGroup title="Rahmen">
        <BorderEditor
          label="Rahmen aktiv"
          value={block.border}
          onChange={(border) => update({ border })}
        />
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

function ListSettings({
  block,
  update,
}: {
  block: ListBlock;
  update: Updater<ListBlock>;
}) {
  return (
    <>
      <FieldGroup title="Liste">
        <Row label="Stil">
          <SelectInput
            value={block.ordered ? "ordered" : "unordered"}
            options={[
              { value: "unordered", label: "Bullet (•)" },
              { value: "ordered", label: "Nummeriert (1.)" },
            ]}
            onChange={(v) => update({ ordered: v === "ordered" })}
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
            min={10}
            max={24}
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
        <Row label="Punkt-Abstand">
          <NumberInput
            value={block.itemSpacing}
            onChange={(itemSpacing) => update({ itemSpacing })}
            min={0}
            max={32}
            unit="px"
          />
        </Row>
        <Row label="Farbe">
          <ColorInput
            value={block.color}
            onChange={(v) => v && update({ color: v })}
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
      <FieldGroup title="Einträge">
        <div className="space-y-1.5">
          {block.items.map((item, idx) => (
            <div key={idx} className="flex items-start gap-1.5">
              <input
                type="text"
                value={stripHtml(item)}
                onChange={(e) => {
                  const next = block.items.slice();
                  next[idx] = e.target.value;
                  update({ items: next });
                }}
                className="min-w-0 flex-1 rounded-md border border-hair bg-white px-2 py-1 text-[12px] focus:border-ink-500 focus:outline-none"
                placeholder={`Eintrag ${idx + 1}`}
              />
              <button
                type="button"
                title="Löschen"
                onClick={() => {
                  const next = block.items.slice();
                  next.splice(idx, 1);
                  update({ items: next });
                }}
                disabled={block.items.length <= 1}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-ink-500 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => update({ items: [...block.items, "Neuer Eintrag"] })}
            className="inline-flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-hair bg-white px-2 py-1 text-[11.5px] text-ink-600 hover:border-ink-300 hover:text-ink-900"
          >
            + Eintrag hinzufügen
          </button>
          <p className="text-[10.5px] leading-snug text-ink-500">
            Inline-Formatierung (Fett/Kursiv/Link) kannst du auch direkt
            im Canvas auf den Listenpunkten editieren.
          </p>
        </div>
      </FieldGroup>
    </>
  );
}

function QuoteSettings({
  block,
  update,
}: {
  block: QuoteBlock;
  update: Updater<QuoteBlock>;
}) {
  return (
    <>
      <FieldGroup title="Zitat">
        <div className="space-y-1">
          <p className="text-[11.5px] text-ink-700">Quelle (optional)</p>
          <input
            type="text"
            value={block.cite ?? ""}
            onChange={(e) =>
              update({ cite: e.target.value.trim() || undefined })
            }
            placeholder="— Max Mustermann, CEO"
            className="w-full rounded-md border border-hair bg-white px-2 py-1 text-[12px] focus:border-ink-500 focus:outline-none"
          />
        </div>
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
            min={12}
            max={32}
            unit="px"
          />
        </Row>
        <Row label="Farbe">
          <ColorInput
            value={block.color}
            onChange={(v) => v && update({ color: v })}
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
      <FieldGroup title="Akzent (linke Linie)">
        <Row label="Farbe">
          <ColorInput
            value={block.accentColor}
            onChange={(v) => v && update({ accentColor: v })}
          />
        </Row>
        <Row label="Breite">
          <NumberInput
            value={block.accentWidth}
            onChange={(accentWidth) => update({ accentWidth })}
            min={0}
            max={12}
            unit="px"
          />
        </Row>
      </FieldGroup>
    </>
  );
}

function VideoSettings({
  block,
  update,
}: {
  block: VideoBlock;
  update: Updater<VideoBlock>;
}) {
  const widthMode = block.width === "100%" ? "full" : "fixed";
  return (
    <>
      <FieldGroup title="Video">
        <div className="space-y-1">
          <p className="text-[11.5px] text-ink-700">Thumbnail-URL</p>
          <AssetUrlInput
            value={block.thumbnailUrl}
            onChange={(thumbnailUrl) => update({ thumbnailUrl })}
            placeholder="https://…/thumbnail.png"
            accept={["image/"]}
            preview
          />
        </div>
        <div className="space-y-1">
          <p className="text-[11.5px] text-ink-700">Video-Link</p>
          <input
            type="text"
            value={block.videoUrl}
            onChange={(e) => update({ videoUrl: e.target.value })}
            placeholder="https://youtube.com/watch?v=…"
            className="w-full rounded-md border border-hair bg-white px-2 py-1 text-[12px] focus:border-ink-500 focus:outline-none"
          />
          <p className="text-[10.5px] leading-snug text-ink-500">
            Mail-Clients zeigen kein Video direkt — der User klickt auf
            das Thumbnail und landet bei der Video-URL.
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-[11.5px] text-ink-700">Alt-Text</p>
          <input
            type="text"
            value={block.alt}
            onChange={(e) => update({ alt: e.target.value })}
            placeholder="Video ansehen"
            className="w-full rounded-md border border-hair bg-white px-2 py-1 text-[12px] focus:border-ink-500 focus:outline-none"
          />
        </div>
      </FieldGroup>
      <FieldGroup title="Größe & Stil">
        <Row label="Modus">
          <SelectInput
            value={widthMode}
            options={[
              { value: "full", label: "Volle Breite" },
              { value: "fixed", label: "Fixe Pixel" },
            ]}
            onChange={(v) => update({ width: v === "full" ? "100%" : 400 })}
          />
        </Row>
        {widthMode === "fixed" && (
          <Row label="Breite">
            <NumberInput
              value={typeof block.width === "number" ? block.width : 400}
              onChange={(w) => update({ width: w })}
              min={120}
              max={800}
              unit="px"
            />
          </Row>
        )}
        <Row label="Eckenradius">
          <NumberInput
            value={block.borderRadius}
            onChange={(borderRadius) => update({ borderRadius })}
            min={0}
            max={32}
            unit="px"
          />
        </Row>
        <Row label="Ausrichtung">
          <SelectInput<Align>
            value={block.align}
            options={ALIGN_OPTIONS}
            onChange={(align) => update({ align })}
          />
        </Row>
        <Row label="Play-Overlay">
          <SwitchInput
            value={block.showPlayOverlay}
            onChange={(showPlayOverlay) => update({ showPlayOverlay })}
          />
        </Row>
        {block.showPlayOverlay && (
          <Row label="Play-Farbe">
            <ColorInput
              value={block.playButtonColor}
              onChange={(v) => v && update({ playButtonColor: v })}
            />
          </Row>
        )}
      </FieldGroup>
    </>
  );
}

function SocialSettings({
  block,
  update,
}: {
  block: SocialBlock;
  update: Updater<SocialBlock>;
}) {
  const updateLink = (idx: number, patch: Partial<SocialBlock["links"][0]>) => {
    const next = block.links.slice();
    next[idx] = { ...next[idx]!, ...patch };
    update({ links: next });
  };
  const removeLink = (idx: number) => {
    const next = block.links.slice();
    next.splice(idx, 1);
    update({ links: next });
  };
  const addLink = (network: SocialNetwork) => {
    update({
      links: [
        ...block.links,
        { id: newId("sn"), network, url: socialDefaultUrl(network) },
      ],
    });
  };
  const availableToAdd = SOCIAL_NETWORKS.filter(
    (n) => !block.links.some((l) => l.network === n),
  );

  return (
    <>
      <FieldGroup title="Social-Icons">
        <div className="space-y-1.5">
          {block.links.map((l, idx) => (
            <div
              key={l.id}
              className="space-y-1 rounded-md border border-hair bg-paper/50 p-1.5"
            >
              <div className="flex items-center gap-1.5">
                <SelectInput<SocialNetwork>
                  value={l.network}
                  options={SOCIAL_NETWORKS.map((n) => ({
                    value: n,
                    label: socialLabel(n),
                  }))}
                  onChange={(network) => updateLink(idx, { network })}
                />
                <button
                  type="button"
                  title="Entfernen"
                  onClick={() => removeLink(idx)}
                  className="ml-auto inline-flex h-6 w-6 items-center justify-center rounded text-ink-500 hover:bg-rose-50 hover:text-rose-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <input
                type="text"
                value={l.url}
                onChange={(e) => updateLink(idx, { url: e.target.value })}
                placeholder={socialDefaultUrl(l.network)}
                className="w-full rounded-md border border-hair bg-white px-1.5 py-1 text-[11.5px] focus:border-ink-500 focus:outline-none"
              />
            </div>
          ))}
        </div>
        {availableToAdd.length > 0 && (
          <div className="flex items-center gap-1.5">
            <SelectInput<SocialNetwork>
              value={availableToAdd[0]!}
              options={availableToAdd.map((n) => ({
                value: n,
                label: socialLabel(n),
              }))}
              onChange={(n) => addLink(n)}
            />
            <button
              type="button"
              onClick={() => addLink(availableToAdd[0]!)}
              className="inline-flex h-7 items-center rounded-md bg-ink-900 px-2 text-[11.5px] font-medium text-white hover:bg-black"
            >
              + Hinzufügen
            </button>
          </div>
        )}
      </FieldGroup>
      <FieldGroup title="Darstellung">
        <Row label="Icon-Größe">
          <NumberInput
            value={block.iconSize}
            onChange={(iconSize) => update({ iconSize })}
            min={16}
            max={64}
            unit="px"
          />
        </Row>
        <Row label="Abstand">
          <NumberInput
            value={block.gap}
            onChange={(gap) => update({ gap })}
            min={0}
            max={48}
            unit="px"
          />
        </Row>
        <Row label="Stil">
          <SelectInput
            value={block.style}
            options={[
              { value: "color", label: "Farbig" },
              { value: "mono", label: "Einfarbig" },
            ]}
            onChange={(v) => update({ style: v as "color" | "mono" })}
          />
        </Row>
        {block.style === "mono" && (
          <Row label="Mono-Farbe">
            <ColorInput
              value={block.monoColor}
              onChange={(v) => v && update({ monoColor: v })}
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

function AvatarSettings({
  block,
  update,
}: {
  block: AvatarBlock;
  update: Updater<AvatarBlock>;
}) {
  return (
    <>
      <FieldGroup title="Person">
        <div className="space-y-1">
          <p className="text-[11.5px] text-ink-700">Foto-URL</p>
          <AssetUrlInput
            value={block.imageUrl}
            onChange={(imageUrl) => update({ imageUrl })}
            placeholder="https://…/profil.jpg"
            accept={["image/"]}
            preview
          />
        </div>
        <div className="space-y-1">
          <p className="text-[11.5px] text-ink-700">Name</p>
          <input
            type="text"
            value={block.name}
            onChange={(e) => update({ name: e.target.value })}
            className="w-full rounded-md border border-hair bg-white px-2 py-1 text-[12px] focus:border-ink-500 focus:outline-none"
          />
        </div>
        <div className="space-y-1">
          <p className="text-[11.5px] text-ink-700">Untertitel</p>
          <input
            type="text"
            value={block.subtitle}
            onChange={(e) => update({ subtitle: e.target.value })}
            placeholder="Rolle · Firma"
            className="w-full rounded-md border border-hair bg-white px-2 py-1 text-[12px] focus:border-ink-500 focus:outline-none"
          />
        </div>
      </FieldGroup>
      <FieldGroup title="Layout">
        <Row label="Anordnung">
          <SelectInput
            value={block.layout}
            options={[
              { value: "horizontal", label: "Bild links" },
              { value: "vertical", label: "Bild oben" },
            ]}
            onChange={(v) =>
              update({ layout: v as "horizontal" | "vertical" })
            }
          />
        </Row>
        <Row label="Foto-Größe">
          <NumberInput
            value={block.imageSize}
            onChange={(imageSize) => update({ imageSize })}
            min={24}
            max={200}
            unit="px"
          />
        </Row>
        <Row label="Rund">
          <SwitchInput
            value={block.imageRounded}
            onChange={(imageRounded) => update({ imageRounded })}
          />
        </Row>
        {!block.imageRounded && (
          <Row label="Eckenradius">
            <NumberInput
              value={block.imageBorderRadius}
              onChange={(imageBorderRadius) => update({ imageBorderRadius })}
              min={0}
              max={48}
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
      <FieldGroup title="Typografie">
        <Row label="Schrift">
          <SelectInput
            value={block.fontFamily}
            options={FONT_OPTIONS}
            onChange={(fontFamily) => update({ fontFamily })}
          />
        </Row>
        <Row label="Name-Farbe">
          <ColorInput
            value={block.nameColor}
            onChange={(v) => v && update({ nameColor: v })}
          />
        </Row>
        <Row label="Untertitel-Farbe">
          <ColorInput
            value={block.subtitleColor}
            onChange={(v) => v && update({ subtitleColor: v })}
          />
        </Row>
      </FieldGroup>
    </>
  );
}

/** Entfernt simple HTML-Tags, sodass die Listen-Inputs klar bleiben. */
function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, "");
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
    case "list":
      return block.ordered ? "Liste (nummeriert)" : "Liste";
    case "quote":
      return "Zitat";
    case "video":
      return "Video";
    case "social":
      return "Social-Icons";
    case "avatar":
      return "Avatar / Bio";
    case "html":
      return "Custom HTML";
  }
}
