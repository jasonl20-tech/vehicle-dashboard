import {
  registerCodeHighlighting,
  PrismTokenizer,
  CodeHighlightNode,
  CodeNode,
  $createCodeNode,
  $isCodeNode,
} from "@lexical/code";
import { AutoLinkNode, LinkNode, TOGGLE_LINK_COMMAND } from "@lexical/link";
import {
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  ListItemNode,
  ListNode,
} from "@lexical/list";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { TablePlugin } from "@lexical/react/LexicalTablePlugin";
import {
  $createHeadingNode,
  $createQuoteNode,
  $isHeadingNode,
  HeadingNode,
  QuoteNode,
} from "@lexical/rich-text";
import {
  INSERT_TABLE_COMMAND,
  TableCellNode,
  TableNode,
  TableRowNode,
} from "@lexical/table";
import { $setBlocksType } from "@lexical/selection";
import {
  $createParagraphNode,
  $getSelection,
  $isRangeSelection,
  FORMAT_TEXT_COMMAND,
  REDO_COMMAND,
  UNDO_COMMAND,
  type LexicalCommand,
} from "lexical";
import {
  Bold,
  Code,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Pilcrow,
  Quote,
  Redo2,
  Strikethrough,
  Table2,
  Underline,
  Undo2,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import AssetPicker from "../assets/AssetPicker";
import {
  richTextInitialSerialized,
  richTextPlainTextLength,
} from "../../lib/lexicalRichText";
import { CMS_ASSETS_FOLDER } from "../../lib/cmsAccess";
import type { Asset } from "../../lib/assetsApi";
import {
  $createCmsHrNode,
  $createCmsImageNode,
  CmsHrNode,
  CmsImageNode,
} from "./lexical/CmsLexicalNodes";

const LEXICAL_THEME = {
  paragraph: "mb-1 text-[14px] leading-relaxed font-normal text-ink-900",
  quote:
    "border-l-4 border-ink-200 pl-3 my-2 text-[14px] leading-relaxed text-ink-700 bg-ink-50/50 py-2 rounded-r",
  heading: {
    h1: "!text-2xl !font-bold mb-2 text-ink-900",
    h2: "!text-xl !font-semibold mb-2 text-ink-900",
    h3: "!text-lg !font-semibold mb-1 text-ink-900",
    h4: "text-base font-semibold mb-1 text-ink-900",
    h5: "text-sm font-semibold mb-1 text-ink-900",
    h6: "text-xs font-semibold mb-1 text-ink-900",
  },
  list: {
    ul: "list-disc ml-6 my-1 text-[14px] leading-relaxed text-ink-900",
    ol: "list-decimal ml-6 my-1 text-[14px] leading-relaxed text-ink-900",
    listitem: "my-0.5 text-[14px] leading-relaxed",
    nested: {
      listitem: "list-none",
    },
  },
  link: "text-[14px] text-[#0366d6] underline cursor-pointer",
  text: {
    bold: "font-bold",
    italic: "italic",
    underline: "underline",
    strikethrough: "line-through",
    code: "font-mono text-[13px] bg-ink-100/80 rounded px-1",
  },
  table: "LexicalTable__table w-full border-collapse border border-hair my-2 text-[13px]",
  tableCell:
    "LexicalTable__cell border border-hair px-2 py-1.5 min-w-[3rem] align-top",
  tableCellHeader:
    "LexicalTable__cell LexicalTable__cellHeader border border-hair px-2 py-1.5 bg-ink-100 font-semibold text-left align-top",
  tableRow: "LexicalTable__row",
  tableSelection: "LexicalTable__selection",
  code: "block bg-[#1a1a1a] text-[#e8e8e8] rounded-lg p-3 font-mono text-[13px] my-2 overflow-x-auto",
  codeHighlight: {
    atrule: "text-amber-300",
    attr: "text-sky-300",
    boolean: "text-purple-300",
    builtin: "text-cyan-300",
    cdata: "text-ink-400",
    char: "text-green-300",
    class: "text-yellow-300",
    "class-name": "text-yellow-300",
    comment: "text-ink-500 italic",
    constant: "text-purple-300",
    deleted: "text-rose-400",
    doctype: "text-ink-500",
    entity: "text-orange-300",
    function: "text-blue-300",
    important: "text-rose-400",
    inserted: "text-green-400",
    keyword: "text-fuchsia-300",
    namespace: "text-ink-400",
    number: "text-orange-300",
    operator: "text-ink-300",
    prolog: "text-ink-500",
    property: "text-sky-300",
    punctuation: "text-ink-400",
    regex: "text-green-300",
    selector: "text-yellow-200",
    string: "text-green-400",
    symbol: "text-rose-300",
    tag: "text-rose-400",
    url: "text-sky-400",
    variable: "text-purple-200",
  },
};

type Props = {
  fieldId: string;
  value: unknown;
  onChange: (serializedJson: string) => void;
  showMeta?: boolean;
  footer?: ReactNode;
};

const LEXICAL_NODES = [
  HeadingNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  LinkNode,
  AutoLinkNode,
  TableNode,
  TableCellNode,
  TableRowNode,
  CodeNode,
  CodeHighlightNode,
  CmsImageNode,
  CmsHrNode,
];

export default function LexicalRichTextField({
  fieldId,
  value,
  onChange,
  showMeta = true,
  footer,
}: Props) {
  const [plainLen, setPlainLen] = useState(() =>
    richTextPlainTextLength(typeof value === "string" ? value : ""),
  );

  const [initialConfig] = useState(() => ({
    namespace: `cms-rt-${fieldId.replace(/[^a-zA-Z0-9_-]/g, "_")}`,
    theme: LEXICAL_THEME,
    nodes: LEXICAL_NODES,
    onError: (e: Error) => {
      console.error(e);
    },
    editorState: richTextInitialSerialized(
      typeof value === "string" ? value : "",
    ),
  }));

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className="overflow-hidden rounded-lg border border-[#dadce0] bg-white">
        <ToolbarPlugin />
        <div className="relative">
          <RichTextPlugin
            contentEditable={
              <ContentEditable className="cms-lexical-input min-h-[220px] w-full resize-y px-3 py-2 text-ink-900 outline-none focus:ring-0" />
            }
            placeholder={
              <div className="pointer-events-none absolute left-3 top-2 text-[13px] text-ink-400">
                Text eingeben…
              </div>
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
        </div>
      </div>
      <HistoryPlugin />
      <ListPlugin />
      <LinkPlugin />
      <TablePlugin hasHorizontalScroll />
      <CodeHighlightPlugin />
      <OnChangePlugin
        onChange={(editorState) => {
          const json = JSON.stringify(editorState.toJSON());
          onChange(json);
          setPlainLen(richTextPlainTextLength(json));
        }}
      />
      {showMeta ? (
        <div className="mt-1.5 flex justify-between text-[11px] text-ink-400">
          <span>{plainLen} Zeichen (Text)</span>
        </div>
      ) : null}
      {footer}
    </LexicalComposer>
  );
}

function CodeHighlightPlugin() {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    return registerCodeHighlighting(editor, PrismTokenizer);
  }, [editor]);
  return null;
}

function ToolbarPlugin() {
  const [editor] = useLexicalComposerContext();
  const [imagePickerOpen, setImagePickerOpen] = useState(false);

  /** Nach Toolbar-Klick Auswahl/Fokus zuverlässig zurück auf den Editor (Lexical-Pattern). */
  const run = (fn: () => void) => {
    editor.focus(() => {
      editor.update(fn);
    });
  };

  const dispatchCmd = <P,>(command: LexicalCommand<P>, payload: P) => {
    editor.focus(() => {
      editor.dispatchCommand(command, payload);
    });
  };

  type BlockKind =
    | "paragraph"
    | "h1"
    | "h2"
    | "h3"
    | "h4"
    | "h5"
    | "h6"
    | "quote";

  const setBlockType = (kind: BlockKind) => {
    run(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      if (kind === "paragraph") {
        $setBlocksType(selection, () => $createParagraphNode());
        return;
      }
      if (kind === "quote") {
        $setBlocksType(selection, () => $createQuoteNode());
        return;
      }
      const tag = kind;
      try {
        const top = selection.anchor.getNode().getTopLevelElementOrThrow();
        if ($isHeadingNode(top) && top.getTag() === tag) {
          $setBlocksType(selection, () => $createParagraphNode());
        } else {
          $setBlocksType(selection, () => $createHeadingNode(tag));
        }
      } catch {
        $setBlocksType(selection, () => $createHeadingNode(tag));
      }
    });
  };

  const toggleCodeBlock = () => {
    run(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      try {
        const top = selection.anchor.getNode().getTopLevelElementOrThrow();
        if ($isCodeNode(top)) {
          $setBlocksType(selection, () => $createParagraphNode());
        } else {
          $setBlocksType(selection, () => $createCodeNode("plaintext"));
        }
      } catch {
        $setBlocksType(selection, () => $createCodeNode("plaintext"));
      }
    });
  };

  const insertTable = () => {
    const r = window.prompt("Anzahl Zeilen (1–20)", "3");
    const c = window.prompt("Anzahl Spalten (1–12)", "3");
    const rows = Math.min(20, Math.max(1, Number.parseInt(r || "3", 10) || 3));
    const cols = Math.min(12, Math.max(1, Number.parseInt(c || "3", 10) || 3));
    editor.focus(() => {
      editor.dispatchCommand(INSERT_TABLE_COMMAND, {
        rows: String(rows),
        columns: String(cols),
        includeHeaders: { rows: true, columns: false },
      });
    });
  };

  const insertImageFromAsset = (asset: Asset) => {
    const alt =
      asset.title?.trim() ||
      asset.alt_text?.trim() ||
      asset.name ||
      "";
    run(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      const imageNode = $createCmsImageNode(
        asset.url,
        alt,
        asset.key,
        asset.cms_status,
      );
      selection.insertNodes([imageNode]);
      const paragraph = $createParagraphNode();
      imageNode.insertAfter(paragraph);
      paragraph.selectStart();
    });
  };

  const insertHorizontalRule = () => {
    run(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      const hr = $createCmsHrNode();
      selection.insertNodes([hr]);
      const paragraph = $createParagraphNode();
      hr.insertAfter(paragraph);
      paragraph.selectStart();
    });
  };

  return (
    <>
      <div
        className="flex flex-wrap items-center gap-1 border-b border-[#dadce0] bg-[#f8f9fa] px-2 py-1.5"
        role="toolbar"
        aria-label="Textformatierung"
      >
        <label className="sr-only" htmlFor={`cms-rt-block-${editor.getKey()}`}>
          Absatzformat
        </label>
        <select
          id={`cms-rt-block-${editor.getKey()}`}
          className="h-8 max-w-[11rem] rounded border border-[#dadce0] bg-white px-2 text-[12px] text-ink-800"
          defaultValue=""
          onChange={(e) => {
            const v = e.target.value as BlockKind | "";
            e.target.value = "";
            if (!v) return;
            setBlockType(v);
          }}
        >
          <option value="">Textstil…</option>
          <option value="paragraph">Normaler Text</option>
          <option value="h1">Überschrift 1</option>
          <option value="h2">Überschrift 2</option>
          <option value="h3">Überschrift 3</option>
          <option value="h4">Überschrift 4</option>
          <option value="h5">Überschrift 5</option>
          <option value="h6">Überschrift 6</option>
          <option value="quote">Zitat</option>
        </select>

        <span className="mx-0.5 w-px self-stretch bg-[#dadce0]" aria-hidden />

        <ToolBtn
          label="Rückgängig"
          onClick={() => dispatchCmd(UNDO_COMMAND, undefined)}
          icon={<Undo2 className="h-3.5 w-3.5" />}
        />
        <ToolBtn
          label="Wiederholen"
          onClick={() => dispatchCmd(REDO_COMMAND, undefined)}
          icon={<Redo2 className="h-3.5 w-3.5" />}
        />

        <span className="mx-0.5 w-px self-stretch bg-[#dadce0]" aria-hidden />

        <ToolBtn
          label="Fett"
          onClick={() => dispatchCmd(FORMAT_TEXT_COMMAND, "bold")}
          icon={<Bold className="h-3.5 w-3.5" />}
        />
        <ToolBtn
          label="Kursiv"
          onClick={() => dispatchCmd(FORMAT_TEXT_COMMAND, "italic")}
          icon={<Italic className="h-3.5 w-3.5" />}
        />
        <ToolBtn
          label="Unterstrichen"
          onClick={() => dispatchCmd(FORMAT_TEXT_COMMAND, "underline")}
          icon={<Underline className="h-3.5 w-3.5" />}
        />
        <ToolBtn
          label="Durchgestrichen"
          onClick={() => dispatchCmd(FORMAT_TEXT_COMMAND, "strikethrough")}
          icon={<Strikethrough className="h-3.5 w-3.5" />}
        />
        <ToolBtn
          label="Code (inline)"
          onClick={() => dispatchCmd(FORMAT_TEXT_COMMAND, "code")}
          icon={<Code className="h-3.5 w-3.5" />}
        />

        <span className="mx-0.5 w-px self-stretch bg-[#dadce0]" aria-hidden />

        <ToolBtn
          label="Absatz"
          onClick={() => setBlockType("paragraph")}
          icon={<Pilcrow className="h-3.5 w-3.5" />}
        />
        <ToolBtn
          label="Code-Block"
          onClick={() => toggleCodeBlock()}
          icon={<span className="font-mono text-[11px] font-bold">{"{ }"}</span>}
        />
        <ToolBtn
          label="Aufzählung"
          onClick={() => dispatchCmd(INSERT_UNORDERED_LIST_COMMAND, undefined)}
          icon={<List className="h-3.5 w-3.5" />}
        />
        <ToolBtn
          label="Nummerierung"
          onClick={() => dispatchCmd(INSERT_ORDERED_LIST_COMMAND, undefined)}
          icon={<ListOrdered className="h-3.5 w-3.5" />}
        />
        <ToolBtn
          label="Zitat"
          onClick={() => setBlockType("quote")}
          icon={<Quote className="h-3.5 w-3.5" />}
        />
        <ToolBtn
          label="Tabelle einfügen"
          onClick={() => insertTable()}
          icon={<Table2 className="h-3.5 w-3.5" />}
        />

        <span className="mx-0.5 w-px self-stretch bg-[#dadce0]" aria-hidden />

        <label className="sr-only" htmlFor={`cms-rt-embed-${editor.getKey()}`}>
          Einbetten
        </label>
        <select
          id={`cms-rt-embed-${editor.getKey()}`}
          className="h-8 max-w-[10rem] rounded border border-[#0366d6]/40 bg-white px-2 text-[12px] font-medium text-[#0366d6]"
          defaultValue=""
          onChange={(e) => {
            const v = e.target.value;
            e.target.value = "";
            if (v === "image") setImagePickerOpen(true);
            if (v === "hr") insertHorizontalRule();
          }}
        >
          <option value="">+ Einbetten</option>
          <option value="image">Bild (Mediathek)</option>
          <option value="hr">Trennlinie</option>
        </select>
        <ToolBtn
          label="Bild aus Mediathek einfügen"
          onClick={() => setImagePickerOpen(true)}
          icon={<ImagePlus className="h-3.5 w-3.5" />}
        />
        <ToolBtn
          label="Horizontale Trennlinie"
          onClick={() => insertHorizontalRule()}
          icon={<Minus className="h-3.5 w-3.5" />}
        />

        <span className="mx-0.5 w-px self-stretch bg-[#dadce0]" aria-hidden />

        <ToolBtn
          label="Link"
          onClick={() => {
            const url = window.prompt("Link-URL", "https://");
            if (url === null) return;
            const trimmed = url.trim();
            if (!trimmed) {
              dispatchCmd(TOGGLE_LINK_COMMAND, null);
              return;
            }
            let href = trimmed;
            if (
              !/^https?:\/\//i.test(href) &&
              !href.startsWith("mailto:") &&
              !href.startsWith("/") &&
              !href.startsWith("#")
            ) {
              href = `https://${href}`;
            }
            dispatchCmd(TOGGLE_LINK_COMMAND, href);
          }}
          icon={<Link2 className="h-3.5 w-3.5" />}
        />
      </div>

      <AssetPicker
        open={imagePickerOpen}
        accept={["image/"]}
        initialFolder={CMS_ASSETS_FOLDER}
        rootFolder={CMS_ASSETS_FOLDER}
        title="Bild in den Text einfügen"
        onPick={(a) => insertImageFromAsset(a)}
        onClose={() => setImagePickerOpen(false)}
      />
    </>
  );
}

function ToolBtn({
  label,
  onClick,
  icon,
}: {
  label: string;
  onClick: () => void;
  icon: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onClick()}
      className="rounded p-1.5 text-ink-600 hover:bg-white hover:text-ink-900"
    >
      {icon}
    </button>
  );
}
