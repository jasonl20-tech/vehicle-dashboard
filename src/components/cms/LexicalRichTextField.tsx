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
} from "lexical";
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
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
import {
  richTextInitialSerialized,
  richTextPlainTextLength,
} from "../../lib/lexicalRichText";

const LEXICAL_THEME = {
  paragraph: "mb-1 text-[14px] leading-relaxed text-ink-900",
  quote:
    "border-l-4 border-ink-200 pl-3 my-2 text-ink-700 bg-ink-50/50 py-2 rounded-r",
  heading: {
    h1: "text-2xl font-bold mb-2 text-ink-900",
    h2: "text-xl font-semibold mb-2 text-ink-900",
    h3: "text-lg font-semibold mb-1 text-ink-900",
    h4: "text-base font-semibold mb-1 text-ink-900",
    h5: "text-sm font-semibold mb-1 text-ink-900",
    h6: "text-xs font-semibold mb-1 text-ink-900",
  },
  list: {
    ul: "list-disc ml-6 my-1",
    ol: "list-decimal ml-6 my-1",
    listitem: "my-0.5",
    nested: {
      listitem: "list-none",
    },
  },
  link: "text-[#0366d6] underline cursor-pointer",
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
              <ContentEditable className="cms-lexical-input min-h-[220px] w-full resize-y px-3 py-2 text-[14px] text-ink-900 outline-none focus:ring-0" />
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

  const run = (fn: () => void) => {
    editor.update(fn);
  };

  const setHeading = (tag: "h1" | "h2" | "h3") => {
    run(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
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

  const setParagraph = () => {
    run(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        $setBlocksType(selection, () => $createParagraphNode());
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
    editor.dispatchCommand(INSERT_TABLE_COMMAND, {
      rows: String(rows),
      columns: String(cols),
      includeHeaders: { rows: true, columns: false },
    });
  };

  return (
    <div
      className="flex flex-wrap gap-0.5 border-b border-[#dadce0] bg-[#f8f9fa] px-2 py-1.5"
      role="toolbar"
      aria-label="Textformatierung"
    >
      <ToolBtn
        label="Rückgängig"
        onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}
        icon={<Undo2 className="h-3.5 w-3.5" />}
      />
      <ToolBtn
        label="Wiederholen"
        onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}
        icon={<Redo2 className="h-3.5 w-3.5" />}
      />
      <span className="mx-1 w-px self-stretch bg-[#dadce0]" aria-hidden />
      <ToolBtn
        label="Fett"
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold")}
        icon={<Bold className="h-3.5 w-3.5" />}
      />
      <ToolBtn
        label="Kursiv"
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic")}
        icon={<Italic className="h-3.5 w-3.5" />}
      />
      <ToolBtn
        label="Unterstrichen"
        onClick={() =>
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, "underline")
        }
        icon={<Underline className="h-3.5 w-3.5" />}
      />
      <ToolBtn
        label="Durchgestrichen"
        onClick={() =>
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, "strikethrough")
        }
        icon={<Strikethrough className="h-3.5 w-3.5" />}
      />
      <ToolBtn
        label="Code (inline)"
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "code")}
        icon={<Code className="h-3.5 w-3.5" />}
      />
      <span className="mx-1 w-px self-stretch bg-[#dadce0]" aria-hidden />
      <ToolBtn
        label="Überschrift 1"
        onClick={() => setHeading("h1")}
        icon={<Heading1 className="h-3.5 w-3.5" />}
      />
      <ToolBtn
        label="Überschrift 2"
        onClick={() => setHeading("h2")}
        icon={<Heading2 className="h-3.5 w-3.5" />}
      />
      <ToolBtn
        label="Überschrift 3"
        onClick={() => setHeading("h3")}
        icon={<Heading3 className="h-3.5 w-3.5" />}
      />
      <ToolBtn
        label="Absatz"
        onClick={() => setParagraph()}
        icon={<Pilcrow className="h-3.5 w-3.5" />}
      />
      <ToolBtn
        label="Zitat"
        onClick={() =>
          run(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              $setBlocksType(selection, () => $createQuoteNode());
            }
          })
        }
        icon={<Quote className="h-3.5 w-3.5" />}
      />
      <ToolBtn
        label="Code-Block"
        onClick={() => toggleCodeBlock()}
        icon={<span className="font-mono text-[11px] font-bold">{"{ }"}</span>}
      />
      <span className="mx-1 w-px self-stretch bg-[#dadce0]" aria-hidden />
      <ToolBtn
        label="Aufzählung"
        onClick={() =>
          editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)
        }
        icon={<List className="h-3.5 w-3.5" />}
      />
      <ToolBtn
        label="Nummerierung"
        onClick={() =>
          editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)
        }
        icon={<ListOrdered className="h-3.5 w-3.5" />}
      />
      <ToolBtn
        label="Tabelle einfügen"
        onClick={() => insertTable()}
        icon={<Table2 className="h-3.5 w-3.5" />}
      />
      <span className="mx-1 w-px self-stretch bg-[#dadce0]" aria-hidden />
      <ToolBtn
        label="Link"
        onClick={() => {
          const url = window.prompt("Link-URL", "https://");
          if (url === null) return;
          const trimmed = url.trim();
          if (!trimmed) {
            editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
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
          editor.dispatchCommand(TOGGLE_LINK_COMMAND, href);
        }}
        icon={<Link2 className="h-3.5 w-3.5" />}
      />
    </div>
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
