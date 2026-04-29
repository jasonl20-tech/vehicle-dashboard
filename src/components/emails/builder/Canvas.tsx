/**
 * Canvas: Die mittlere Spalte des Builders. Rendert das EmailDesign als
 * editierbare Vorschau (KEIN iframe — wir wollen direktes Click-Targeting).
 *
 * - Sections werden als ausgewählt-bare Container gerendert.
 * - Spalten zeigen Drop-Zonen bei "Block hinzufügen".
 * - Blöcke haben:
 *     - Hover-Outline (zeigt Click-Target)
 *     - Klick → Selection (Settings-Sidebar reagiert)
 *     - Selektions-Toolbar oben rechts: Hoch/Runter/Duplizieren/Löschen
 *     - Bei Text/Heading: Inline-Editor mit Floating-Format-Toolbar
 * - Klick auf den weißen Bereich neben einer Section → wählt die Body-
 *   Settings aus.
 *
 * Visuell ahmt das Canvas die echte Email nach (gleicher Hintergrund,
 * gleiche content-width), bekommt aber Editor-Affordances oben drauf.
 */
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Play,
  Plus,
  Trash2,
} from "lucide-react";
import { useCallback } from "react";
import InlineTextEditor from "./InlineTextEditor";
import { socialIconUrl } from "./render";
import type { BuilderApi } from "./useBuilderState";
import type {
  AvatarBlock,
  BlockPath,
  ButtonBlock,
  ContentBlock,
  ContentBlockType,
  DividerBlock,
  HeadingBlock,
  HtmlBlock,
  ImageBlock,
  ListBlock,
  QuoteBlock,
  Section,
  SelectionTarget,
  SocialBlock,
  SpacerBlock,
  TextBlock,
  VideoBlock,
} from "./types";

// ─── Hilfen ───────────────────────────────────────────────────────────

function isSelectedBlock(sel: SelectionTarget, p: BlockPath): boolean {
  return (
    !!sel &&
    sel.kind === "block" &&
    sel.path.sectionIndex === p.sectionIndex &&
    sel.path.columnIndex === p.columnIndex &&
    sel.path.blockIndex === p.blockIndex
  );
}
function isSelectedSection(sel: SelectionTarget, idx: number): boolean {
  return !!sel && sel.kind === "section" && sel.sectionIndex === idx;
}

function colWidthsFor(layout: Section["layout"]): number[] {
  switch (layout) {
    case "1":
      return [100];
    case "1-1":
      return [50, 50];
    case "1-2":
      return [33, 67];
    case "2-1":
      return [67, 33];
    case "1-1-1":
      return [33, 33, 34];
  }
}

type Props = {
  api: BuilderApi;
  /** "desktop" zeigt 600px, "mobile" zeigt ~360px verengt. */
  device: "desktop" | "mobile";
  /** Optionaler Klick-Handler für "+"-Plus-Buttons in leeren Spalten:
   *  öffnet die Block-Sidebar, wenn sie eingeklappt ist. */
  onRequestAddBlock: (sectionIndex: number, columnIndex: number) => void;
};

export default function Canvas({ api, device, onRequestAddBlock }: Props) {
  const { design, selection, setSelection } = api;

  const onBackgroundClick = useCallback(
    (e: React.MouseEvent) => {
      // Nur reagieren, wenn der Click direkt auf dem Hintergrund (nicht
      // auf einer Section/Block) landet.
      if (e.target === e.currentTarget) {
        setSelection({ kind: "body" });
      }
    },
    [setSelection],
  );

  const widthPx =
    device === "mobile" ? 360 : design.body.contentWidth;

  return (
    <div
      onClick={onBackgroundClick}
      className="flex h-full min-h-0 w-full flex-col overflow-y-auto"
      style={{ background: design.body.backgroundColor }}
    >
      <div
        className="mx-auto flex w-full flex-col py-6"
        style={{ maxWidth: `${widthPx}px` }}
      >
        <div
          className="overflow-hidden rounded-md shadow-sm ring-1 ring-black/5"
          style={{ background: design.body.contentBackgroundColor }}
        >
          {design.sections.length === 0 ? (
            <EmptyState
              onAddSection={() => api.addSection("1")}
            />
          ) : (
            design.sections.map((s, i) => (
              <SectionView
                key={s.id}
                api={api}
                section={s}
                sectionIndex={i}
                isSelected={isSelectedSection(selection, i)}
                onRequestAddBlock={onRequestAddBlock}
              />
            ))
          )}
        </div>

        {design.sections.length > 0 && (
          <button
            type="button"
            onClick={() => api.addSection("1")}
            className="mx-auto mt-3 inline-flex items-center gap-1.5 rounded-md border border-dashed border-ink-300 bg-white/60 px-3 py-2 text-[12px] font-medium text-ink-600 transition hover:border-ink-500 hover:text-ink-900"
          >
            <Plus className="h-3.5 w-3.5" />
            Section hinzufügen
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Empty-State, wenn das Design komplett leer ist ──────────────────

function EmptyState({ onAddSection }: { onAddSection: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-8 py-16 text-center">
      <p className="text-[14px] font-medium text-ink-900">
        Diese Mail ist noch leer.
      </p>
      <p className="max-w-[36ch] text-[12.5px] text-ink-500">
        Füge deine erste Section ein, um anzufangen — oder wähle links eine
        Vorlage aus der Liste.
      </p>
      <button
        type="button"
        onClick={onAddSection}
        className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-ink-900 px-3 py-1.5 text-[12.5px] font-medium text-white transition hover:bg-black"
      >
        <Plus className="h-3.5 w-3.5" />
        Section hinzufügen
      </button>
    </div>
  );
}

// ─── Section ──────────────────────────────────────────────────────────

function SectionView({
  api,
  section,
  sectionIndex,
  isSelected,
  onRequestAddBlock,
}: {
  api: BuilderApi;
  section: Section;
  sectionIndex: number;
  isSelected: boolean;
  onRequestAddBlock: (sectionIndex: number, columnIndex: number) => void;
}) {
  const widths = colWidthsFor(section.layout);

  const onSectionClick = useCallback(
    (e: React.MouseEvent) => {
      // Click auf Section-Padding (nicht auf Block) = Section auswählen
      if (e.target === e.currentTarget) {
        api.setSelection({ kind: "section", sectionIndex });
      }
    },
    [api, sectionIndex],
  );

  return (
    <div
      onClick={onSectionClick}
      className={`group/section relative ${isSelected ? "outline outline-2 outline-blue-500" : ""}`}
      style={{
        background: section.backgroundColor,
        padding: `${section.padding.top}px ${section.padding.right}px ${section.padding.bottom}px ${section.padding.left}px`,
        borderTop: section.borderTop
          ? `${section.borderTop.width}px ${section.borderTop.style} ${section.borderTop.color}`
          : undefined,
        borderBottom: section.borderBottom
          ? `${section.borderBottom.width}px ${section.borderBottom.style} ${section.borderBottom.color}`
          : undefined,
      }}
    >
      {/* Section-Toolbar oben rechts (zeigt sich bei Hover oder Selection) */}
      <div
        className={`absolute right-1 top-1 z-10 inline-flex items-center gap-0.5 rounded-md bg-white/95 p-0.5 shadow-md ring-1 ring-black/5 transition ${
          isSelected
            ? "opacity-100"
            : "opacity-0 group-hover/section:opacity-100"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <SmallBtn
          title="Section hochschieben"
          disabled={sectionIndex === 0}
          onClick={() => api.moveSection(sectionIndex, -1)}
        >
          <ArrowUp className="h-3.5 w-3.5" />
        </SmallBtn>
        <SmallBtn
          title="Section runterschieben"
          onClick={() => api.moveSection(sectionIndex, 1)}
        >
          <ArrowDown className="h-3.5 w-3.5" />
        </SmallBtn>
        <SmallBtn
          title="Section duplizieren"
          onClick={() => api.duplicateSection(sectionIndex)}
        >
          <Copy className="h-3.5 w-3.5" />
        </SmallBtn>
        <SmallBtn
          title="Section löschen"
          tone="danger"
          onClick={() => api.removeSection(sectionIndex)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </SmallBtn>
      </div>

      <div className="flex w-full gap-0">
        {widths.map((w, colIdx) => {
          const col = section.columns[colIdx];
          if (!col) return null;
          return (
            <div
              key={col.id}
              className="min-w-0"
              style={{ flexBasis: `${w}%`, flexGrow: 0, flexShrink: 0 }}
            >
              <ColumnView
                api={api}
                sectionIndex={sectionIndex}
                columnIndex={colIdx}
                blocks={col.blocks}
                onRequestAddBlock={onRequestAddBlock}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SmallBtn({
  title,
  onClick,
  disabled,
  tone = "default",
  children,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "default" | "danger";
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`inline-flex h-6 w-6 items-center justify-center rounded transition ${
        disabled
          ? "cursor-not-allowed text-ink-300"
          : tone === "danger"
            ? "text-ink-700 hover:bg-rose-50 hover:text-rose-600"
            : "text-ink-700 hover:bg-ink-100 hover:text-ink-900"
      }`}
    >
      {children}
    </button>
  );
}

// ─── Column ───────────────────────────────────────────────────────────

function ColumnView({
  api,
  sectionIndex,
  columnIndex,
  blocks,
  onRequestAddBlock,
}: {
  api: BuilderApi;
  sectionIndex: number;
  columnIndex: number;
  blocks: ContentBlock[];
  onRequestAddBlock: (sectionIndex: number, columnIndex: number) => void;
}) {
  return (
    <div className="min-h-[24px]">
      {blocks.map((block, blockIdx) => {
        const path: BlockPath = { sectionIndex, columnIndex, blockIndex: blockIdx };
        return (
          <BlockView
            key={block.id}
            api={api}
            block={block}
            path={path}
            isLastInColumn={blockIdx === blocks.length - 1}
          />
        );
      })}
      {blocks.length === 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRequestAddBlock(sectionIndex, columnIndex);
          }}
          className="flex w-full items-center justify-center gap-1.5 rounded border border-dashed border-ink-300 px-3 py-4 text-[11.5px] text-ink-500 transition hover:border-ink-500 hover:text-ink-900"
        >
          <Plus className="h-3.5 w-3.5" />
          Block hinzufügen
        </button>
      )}
    </div>
  );
}

// ─── Block ────────────────────────────────────────────────────────────

function BlockView({
  api,
  block,
  path,
  isLastInColumn,
}: {
  api: BuilderApi;
  block: ContentBlock;
  path: BlockPath;
  isLastInColumn: boolean;
}) {
  const selected = isSelectedBlock(api.selection, path);

  const onClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      api.setSelection({ kind: "block", path });
    },
    [api, path],
  );

  return (
    <div
      onClick={onClick}
      className={`group/block relative cursor-pointer transition ${
        selected
          ? "outline outline-2 outline-blue-500"
          : "outline outline-1 outline-transparent hover:outline-ink-300"
      }`}
      style={{
        padding: `${block.padding.top}px ${block.padding.right}px ${block.padding.bottom}px ${block.padding.left}px`,
        background: block.backgroundColor,
      }}
    >
      {/* Block-Toolbar */}
      <div
        className={`absolute right-1 top-1 z-10 inline-flex items-center gap-0.5 rounded-md bg-white/95 p-0.5 shadow-md ring-1 ring-black/5 transition ${
          selected
            ? "opacity-100"
            : "opacity-0 group-hover/block:opacity-100"
        }`}
      >
        <SmallBtn
          title="Hochschieben"
          disabled={path.blockIndex === 0}
          onClick={() => api.moveBlock(path, -1)}
        >
          <ArrowUp className="h-3.5 w-3.5" />
        </SmallBtn>
        <SmallBtn
          title="Runterschieben"
          disabled={isLastInColumn}
          onClick={() => api.moveBlock(path, 1)}
        >
          <ArrowDown className="h-3.5 w-3.5" />
        </SmallBtn>
        <SmallBtn
          title="Duplizieren"
          onClick={() => api.duplicateBlock(path)}
        >
          <Copy className="h-3.5 w-3.5" />
        </SmallBtn>
        <SmallBtn
          title="Löschen"
          tone="danger"
          onClick={() => api.removeBlock(path)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </SmallBtn>
      </div>

      {renderBlockContent(api, block, path, selected)}
    </div>
  );
}

function renderBlockContent(
  api: BuilderApi,
  block: ContentBlock,
  path: BlockPath,
  selected: boolean,
): React.ReactNode {
  switch (block.type) {
    case "text":
      return <TextView api={api} block={block} path={path} selected={selected} />;
    case "heading":
      return <HeadingView api={api} block={block} path={path} selected={selected} />;
    case "button":
      return <ButtonView block={block} />;
    case "image":
      return <ImageView block={block} />;
    case "spacer":
      return <SpacerView block={block} />;
    case "divider":
      return <DividerView block={block} />;
    case "list":
      return <ListView api={api} block={block} path={path} selected={selected} />;
    case "quote":
      return <QuoteView api={api} block={block} path={path} selected={selected} />;
    case "video":
      return <VideoView block={block} />;
    case "social":
      return <SocialView block={block} />;
    case "avatar":
      return <AvatarView block={block} />;
    case "html":
      return <HtmlView block={block} />;
  }
}

// ─── Block-spezifische Editor-Views ──────────────────────────────────

function TextView({
  api,
  block,
  path,
  selected,
}: {
  api: BuilderApi;
  block: TextBlock;
  path: BlockPath;
  selected: boolean;
}) {
  return (
    <InlineTextEditor
      value={block.content}
      onChange={(content) => api.updateBlock<TextBlock>(path, { content })}
      active={selected}
      style={{
        fontFamily: block.fontFamily,
        fontSize: `${block.fontSize}px`,
        lineHeight: block.lineHeight,
        color: block.color,
        textAlign: block.align,
        outline: "none",
        margin: 0,
      }}
    />
  );
}

function HeadingView({
  api,
  block,
  path,
  selected,
}: {
  api: BuilderApi;
  block: HeadingBlock;
  path: BlockPath;
  selected: boolean;
}) {
  return (
    <InlineTextEditor
      value={block.content}
      tag={`h${block.level}` as keyof JSX.IntrinsicElements}
      onChange={(content) => api.updateBlock<HeadingBlock>(path, { content })}
      active={selected}
      style={{
        fontFamily: block.fontFamily,
        fontSize: `${block.fontSize}px`,
        fontWeight: block.fontWeight,
        color: block.color,
        textAlign: block.align,
        margin: 0,
        lineHeight: 1.25,
        outline: "none",
      }}
    />
  );
}

function ButtonView({ block }: { block: ButtonBlock }) {
  const border = block.border;
  return (
    <div style={{ textAlign: block.align }}>
      <span
        style={{
          display: block.fullWidth ? "block" : "inline-block",
          background: block.backgroundColor,
          color: block.color,
          borderRadius: `${block.borderRadius}px`,
          padding: `${block.paddingY}px ${block.paddingX}px`,
          fontSize: `${block.fontSize}px`,
          fontWeight: block.fontWeight,
          fontFamily: "Helvetica, Arial, sans-serif",
          textDecoration: "none",
          cursor: "default",
          border: border
            ? `${border.width}px ${border.style} ${border.color}`
            : "none",
        }}
      >
        {block.text}
      </span>
    </div>
  );
}

function ImageView({ block }: { block: ImageBlock }) {
  const widthStyle =
    block.width === "100%" ? { width: "100%" as const } : { width: `${block.width}px` };
  const border = block.border;
  return (
    <div style={{ textAlign: block.align }}>
      {block.src ? (
        <img
          src={block.src}
          alt={block.alt}
          style={{
            display: "inline-block",
            maxWidth: "100%",
            height: "auto",
            borderRadius: block.borderRadius
              ? `${block.borderRadius}px`
              : undefined,
            border: border
              ? `${border.width}px ${border.style} ${border.color}`
              : 0,
            ...widthStyle,
          }}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.opacity = "0.4";
          }}
        />
      ) : (
        <div
          style={{
            ...widthStyle,
            display: "inline-block",
            background: "#f0f0f3",
            border: "1px dashed #c0c0c5",
            color: "#9999a0",
            fontSize: 12,
            padding: "20px",
          }}
        >
          Kein Bild · setze die URL rechts in den Einstellungen.
        </div>
      )}
    </div>
  );
}

function ListView({
  api,
  block,
  path,
  selected,
}: {
  api: BuilderApi;
  block: ListBlock;
  path: BlockPath;
  selected: boolean;
}) {
  const Tag = block.ordered ? "ol" : "ul";
  return (
    <Tag
      style={{
        margin: 0,
        paddingLeft: 20,
        textAlign: block.align,
        fontFamily: block.fontFamily,
        color: block.color,
      }}
    >
      {block.items.map((item, idx) => (
        <li
          key={idx}
          style={{
            fontSize: `${block.fontSize}px`,
            lineHeight: block.lineHeight,
            marginBottom: idx === block.items.length - 1 ? 0 : block.itemSpacing,
            color: block.color,
          }}
        >
          <InlineTextEditor
            value={item}
            onChange={(content) => {
              const next = block.items.slice();
              next[idx] = content;
              api.updateBlock<ListBlock>(path, { items: next });
            }}
            tag="span"
            active={selected}
            style={{ outline: "none", display: "inline" }}
          />
        </li>
      ))}
    </Tag>
  );
}

function QuoteView({
  api,
  block,
  path,
  selected,
}: {
  api: BuilderApi;
  block: QuoteBlock;
  path: BlockPath;
  selected: boolean;
}) {
  return (
    <blockquote
      style={{
        margin: 0,
        borderLeft: block.accentWidth
          ? `${block.accentWidth}px solid ${block.accentColor}`
          : "none",
        paddingLeft: block.accentWidth ? 16 : 0,
        fontFamily: block.fontFamily,
        fontSize: `${block.fontSize}px`,
        color: block.color,
        textAlign: block.align,
        fontStyle: "italic",
        lineHeight: 1.5,
      }}
    >
      <InlineTextEditor
        value={block.content}
        onChange={(content) => api.updateBlock<QuoteBlock>(path, { content })}
        tag="div"
        active={selected}
        style={{ outline: "none" }}
      />
      {block.cite ? (
        <span
          style={{
            display: "block",
            marginTop: 8,
            fontSize: Math.max(11, block.fontSize - 3),
            fontStyle: "normal",
            opacity: 0.7,
            color: block.color,
          }}
        >
          {block.cite}
        </span>
      ) : null}
    </blockquote>
  );
}

function VideoView({ block }: { block: VideoBlock }) {
  const widthStyle =
    block.width === "100%"
      ? { width: "100%" as const }
      : { width: `${block.width}px` };
  return (
    <div style={{ textAlign: block.align, position: "relative" }}>
      <div
        style={{
          display: "inline-block",
          position: "relative",
          ...widthStyle,
        }}
      >
        {block.thumbnailUrl ? (
          <img
            src={block.thumbnailUrl}
            alt={block.alt}
            style={{
              display: "block",
              width: "100%",
              height: "auto",
              border: 0,
              borderRadius: block.borderRadius
                ? `${block.borderRadius}px`
                : undefined,
            }}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.opacity = "0.4";
            }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              aspectRatio: "16 / 9",
              background: "#0f0f10",
              borderRadius: block.borderRadius
                ? `${block.borderRadius}px`
                : undefined,
            }}
          />
        )}
        {block.showPlayOverlay && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 64,
                height: 64,
                borderRadius: "50%",
                background: block.playButtonColor,
                opacity: 0.92,
                boxShadow: "0 4px 18px rgba(0,0,0,0.25)",
              }}
            >
              <Play
                fill="#0f0f10"
                strokeWidth={0}
                style={{ width: 28, height: 28, color: "#0f0f10" }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SocialView({ block }: { block: SocialBlock }) {
  return (
    <div style={{ textAlign: block.align }}>
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: block.gap,
        }}
      >
        {block.links.map((l) => (
          <img
            key={l.id}
            src={socialIconUrl(l.network, block.style)}
            alt={l.network}
            style={{
              display: "inline-block",
              width: block.iconSize,
              height: block.iconSize,
              border: 0,
            }}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.opacity = "0.3";
            }}
          />
        ))}
      </div>
    </div>
  );
}

function AvatarView({ block }: { block: AvatarBlock }) {
  const radius = block.imageRounded
    ? Math.round(block.imageSize / 2)
    : block.imageBorderRadius;
  const img = block.imageUrl ? (
    <img
      src={block.imageUrl}
      alt={block.name}
      style={{
        display: "block",
        width: block.imageSize,
        height: block.imageSize,
        borderRadius: radius ? `${radius}px` : undefined,
        objectFit: "cover",
        border: 0,
      }}
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.opacity = "0.3";
      }}
    />
  ) : (
    <div
      style={{
        width: block.imageSize,
        height: block.imageSize,
        borderRadius: radius ? `${radius}px` : undefined,
        background: "#e5e5e7",
      }}
    />
  );
  const text = (
    <div>
      <div
        style={{
          fontFamily: block.fontFamily,
          fontSize: 15,
          fontWeight: 600,
          color: block.nameColor,
          lineHeight: 1.3,
          margin: 0,
        }}
      >
        {block.name || "—"}
      </div>
      {block.subtitle && (
        <div
          style={{
            fontFamily: block.fontFamily,
            fontSize: 12.5,
            color: block.subtitleColor,
            lineHeight: 1.4,
            marginTop: 2,
          }}
        >
          {block.subtitle}
        </div>
      )}
    </div>
  );
  return (
    <div style={{ textAlign: block.align }}>
      <div
        style={{
          display: "inline-flex",
          gap: 12,
          flexDirection: block.layout === "vertical" ? "column" : "row",
          alignItems: block.layout === "vertical" ? "stretch" : "center",
        }}
      >
        {img}
        {text}
      </div>
    </div>
  );
}

function SpacerView({ block }: { block: SpacerBlock }) {
  return (
    <div
      style={{
        height: `${block.height}px`,
        background:
          "repeating-linear-gradient(45deg, rgba(0,0,0,0.02) 0 6px, transparent 6px 12px)",
        borderRadius: 2,
      }}
    />
  );
}

function DividerView({ block }: { block: DividerBlock }) {
  const insetPct = Math.max(0, Math.min(40, block.inset));
  return (
    <div style={{ paddingLeft: `${insetPct}%`, paddingRight: `${insetPct}%` }}>
      <div
        style={{
          borderTop: `${block.thickness}px solid ${block.color}`,
        }}
      />
    </div>
  );
}

function HtmlView({ block }: { block: HtmlBlock }) {
  return (
    <div
      // Custom-HTML wird unverändert eingebettet — Editor-Pflege durch
      // den Settings-Panel rechts (Textarea).
      dangerouslySetInnerHTML={{ __html: block.html }}
    />
  );
}

// Used by SectionView – avoid unused-var warning
export type { ContentBlockType };
