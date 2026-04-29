/**
 * Inline-Text-Editor für Text- und Heading-Blöcke.
 *
 * - Verwendet `contentEditable` direkt auf dem rendernden Element,
 *   damit das WYSIWYG-Gefühl im Canvas erhalten bleibt (kein Wechsel
 *   in einen separaten Modal-Editor).
 * - Floating-Toolbar erscheint, sobald der Block fokussiert ist.
 * - Toolbar-Aktionen: Bold, Italic, Link, Variable einfügen, Löschen
 *   der Formatierung. Alles via `document.execCommand` — funktional
 *   "deprecated", aber in modernen Browsern voll unterstützt und
 *   pragmatisch ausreichend für interne Nutzung.
 * - Bei Blur synchronisieren wir das aktuelle innerHTML zurück in
 *   den State.
 */
import { Bold, Italic, Link2, Type as TypeIcon, X } from "lucide-react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { EMAIL_TEMPLATE_VARIABLES } from "../../../lib/emailTemplatesApi";

type Props = {
  value: string;
  onChange: (next: string) => void;
  /** Optional: HTML-Tag, der gerendert wird (für Headings: h1/h2/h3). */
  tag?: keyof JSX.IntrinsicElements;
  /** Inline-Styles für das contentEditable-Element. */
  style?: React.CSSProperties;
  /** Klassen für das contentEditable-Element. */
  className?: string;
  /** Markiert das Element als ausgewählt (zeigt die Toolbar). */
  active: boolean;
  /** Sicherheit: deaktiviert die contenteditable-Eigenschaft. */
  disabled?: boolean;
};

export type InlineTextEditorHandle = {
  focus: () => void;
};

function escapeAttr(s: string): string {
  return s.replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/</g, "&lt;");
}
function escapeText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function ToolbarBtn({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault() /* Selection nicht verlieren */}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="inline-flex h-6 items-center gap-1 rounded px-1.5 text-ink-700 hover:bg-ink-100 hover:text-ink-900"
    >
      {children}
    </button>
  );
}

const InlineTextEditor = forwardRef<InlineTextEditorHandle, Props>(
  function InlineTextEditor(
    { value, onChange, tag = "div", style, className, active, disabled },
    ref,
  ) {
    const elRef = useRef<HTMLElement | null>(null);
    // Sentinel: garantiert ungleich jedem realen value → der erste
    // useEffect-Run setzt das initiale innerHTML einmalig.
    const UNINITIALIZED = "\u0000__INIT__\u0000";
    const lastEmittedRef = useRef<string>(UNINITIALIZED);
    const [showVarMenu, setShowVarMenu] = useState(false);

    useImperativeHandle(ref, () => ({
      focus: () => {
        elRef.current?.focus();
      },
    }));

    // Toolbar verschwindet → Variablen-Menü zu
    useEffect(() => {
      if (!active) setShowVarMenu(false);
    }, [active]);

    // Initiales und externes innerHTML imperativ setzen.
    //
    // Wir vermeiden absichtlich `dangerouslySetInnerHTML`, weil React
    // dabei bei JEDEM Wert-Update das DOM neu schreibt → der Caret
    // (Cursor) springt zwingend an Position 0. Hier setzen wir das
    // innerHTML nur, wenn sich der Wert wirklich von dem unterscheidet,
    // den wir zuletzt emittiert haben (also: extern geändert), und
    // lassen das DOM in allen anderen Fällen unangetastet, damit der
    // Browser die Caret-Position bewahren kann.
    useEffect(() => {
      const el = elRef.current;
      if (!el) return;
      if (value === lastEmittedRef.current) return;
      el.innerHTML = value || "";
      lastEmittedRef.current = value;
    }, [value]);

    const onInput = useCallback(() => {
      const el = elRef.current;
      if (!el) return;
      const next = el.innerHTML;
      if (next === lastEmittedRef.current) return;
      lastEmittedRef.current = next;
      onChange(next);
    }, [onChange]);

    const exec = useCallback(
      (cmd: string, val?: string) => {
        try {
          document.execCommand(cmd, false, val);
        } catch {
          // execCommand ist in alten Browsern fehleranfällig — egal,
          // im Dashboard ist die Browser-Range eng.
        }
        // Manuell change feuern — execCommand ändert DOM, kein React-Event
        onInput();
      },
      [onInput],
    );

    const onBold = useCallback(() => exec("bold"), [exec]);
    const onItalic = useCallback(() => exec("italic"), [exec]);
    const onClearFormat = useCallback(() => exec("removeFormat"), [exec]);

    const onLink = useCallback(() => {
      const cur = window.getSelection()?.toString();
      const url = window.prompt(
        "Link-URL (https://… oder mailto:…)",
        "https://",
      );
      if (!url || !url.trim()) return;
      if (!cur || !cur.trim()) {
        exec(
          "insertHTML",
          `<a href="${escapeAttr(url)}">${escapeText(url)}</a>`,
        );
        return;
      }
      exec("createLink", url);
    }, [exec]);

    const insertVariable = useCallback(
      (token: string) => {
        setShowVarMenu(false);
        // Token als plain Text einfügen, NICHT als HTML — sonst werden
        // {{}} doppelt geparst.
        exec("insertText", token);
      },
      [exec],
    );

    const Tag = tag as React.ElementType;

    return (
      <div className="relative">
        {active && !disabled && (
          <div
            className="absolute -top-9 left-0 z-20 inline-flex items-center gap-0.5 rounded-md border border-hair bg-white p-0.5 shadow-md"
            onMouseDown={(e) => e.preventDefault()}
          >
            <ToolbarBtn title="Fett (⌘B)" onClick={onBold}>
              <Bold className="h-3.5 w-3.5" />
            </ToolbarBtn>
            <ToolbarBtn title="Kursiv (⌘I)" onClick={onItalic}>
              <Italic className="h-3.5 w-3.5" />
            </ToolbarBtn>
            <ToolbarBtn title="Link" onClick={onLink}>
              <Link2 className="h-3.5 w-3.5" />
            </ToolbarBtn>
            <span className="mx-0.5 inline-block h-4 w-px bg-hair" />
            <div className="relative">
              <ToolbarBtn
                title="Variable einfügen"
                onClick={() => setShowVarMenu((v) => !v)}
              >
                <TypeIcon className="h-3.5 w-3.5" />
                <span className="ml-1 text-[11px] font-medium">{`{{var}}`}</span>
              </ToolbarBtn>
              {showVarMenu && (
                <div
                  role="dialog"
                  className="absolute left-0 top-full z-30 mt-1 w-64 rounded-lg border border-hair bg-white p-1 shadow-xl"
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <div className="max-h-64 overflow-y-auto">
                    {EMAIL_TEMPLATE_VARIABLES.map((v) => (
                      <button
                        key={v.token}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => insertVariable(v.token)}
                        className="flex w-full items-center justify-between gap-3 rounded px-2 py-1.5 text-left text-[12.5px] hover:bg-ink-50"
                      >
                        <span className="font-mono text-ink-900">{v.token}</span>
                        <span className="truncate text-[11px] text-ink-500">
                          {v.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <span className="mx-0.5 inline-block h-4 w-px bg-hair" />
            <ToolbarBtn title="Formatierung entfernen" onClick={onClearFormat}>
              <X className="h-3.5 w-3.5" />
            </ToolbarBtn>
          </div>
        )}
        <Tag
          ref={(el: HTMLElement | null) => {
            elRef.current = el;
          }}
          contentEditable={!disabled}
          suppressContentEditableWarning
          spellCheck={false}
          onInput={onInput}
          onBlur={onInput}
          className={className}
          style={style}
        />
      </div>
    );
  },
);

export default InlineTextEditor;
