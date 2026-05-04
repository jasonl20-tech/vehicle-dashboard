import { AutoLinkNode, LinkNode, TOGGLE_LINK_COMMAND } from "@lexical/link";
import {
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  ListItemNode,
  ListNode,
} from "@lexical/list";
import {
  LexicalComposer,
} from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import {
  $createHeadingNode,
  $createQuoteNode,
  $isHeadingNode,
  HeadingNode,
  QuoteNode,
} from "@lexical/rich-text";
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
  Heading2,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Undo2,
  Underline,
} from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
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
              <ContentEditable className="cms-lexical-input min-h-[180px] w-full resize-y px-3 py-2 text-[14px] text-ink-900 outline-none focus:ring-0" />
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

function ToolbarPlugin() {
  const [editor] = useLexicalComposerContext();

  const run = (fn: () => void) => {
    editor.update(fn);
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
      <span className="mx-1 w-px self-stretch bg-[#dadce0]" aria-hidden />
      <ToolBtn
        label="Überschrift 2"
        onClick={() =>
          run(() => {
            const selection = $getSelection();
            if (!$isRangeSelection(selection)) return;
            try {
              const top = selection.anchor
                .getNode()
                .getTopLevelElementOrThrow();
              if ($isHeadingNode(top) && top.getTag() === "h2") {
                $setBlocksType(selection, () => $createParagraphNode());
              } else {
                $setBlocksType(selection, () => $createHeadingNode("h2"));
              }
            } catch {
              $setBlocksType(selection, () => $createHeadingNode("h2"));
            }
          })
        }
        icon={<Heading2 className="h-3.5 w-3.5" />}
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
