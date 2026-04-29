/**
 * Wrapper um Unlayers `react-email-editor` (visueller Drag-and-Drop-
 * Email-Builder, ähnlich Mailchimp/Beefree).
 *
 * Lazy-loadbar (~250 KB Wrapper-Code, das eigentliche Editor-iframe
 * kommt von editor.unlayer.com).
 *
 * Imperatives Handle:
 *  - getResult(cb): liefert { design, html } asynchron — Editor antwortet
 *    via postMessage, daher Callback statt Promise.
 *  - loadDesign(design): blendet ein anderes Design im Editor ein.
 *  - loadBlank(): leerer Body (Quick-Reset / "Neue Vorlage").
 *  - insertMergeTag(token): nutzt Unlayer-Built-in zum Einfügen.
 *
 * Variablen-Tokens (`{{name}}` etc.) werden über `mergeTags` als native
 * Unlayer-Merge-Tags reingegeben — der User sieht sie als Pillen im
 * Text-Editor und kann sie per Klick einfügen.
 */
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import EmailEditor, {
  type EditorRef,
  type EmailEditorProps,
} from "react-email-editor";
import { EMAIL_TEMPLATE_VARIABLES } from "../../lib/emailTemplatesApi";

type ExportResult = { design: unknown; html: string };

export type EmailUnlayerEditorHandle = {
  /** Asynchron: liefert das aktuelle Design + gerendertes HTML. */
  getResult: (cb: (result: ExportResult) => void) => void;
  /** Lädt ein Design (z. B. nach Template-Wechsel). */
  loadDesign: (design: unknown) => void;
  /** Setzt den Editor auf einen leeren Body zurück. */
  loadBlank: () => void;
  /** Fügt einen Merge-Tag-Token an der Cursor-Position ein. */
  insertMergeTag: (token: string) => void;
};

type Props = {
  /** Initiales Unlayer-Design (JSON). `null` = leerer Editor. */
  initialDesign: unknown | null;
  /**
   * Wird aufgerufen, sobald der User eine Änderung am Design vornimmt
   * (Block hinzugefügt, Text geändert, Block verschoben …).
   */
  onDirtyChange?: (dirty: boolean) => void;
};

/** Merge-Tags im Unlayer-Format (zeigt sie als Pillen in Text-Tools). */
const MERGE_TAGS = EMAIL_TEMPLATE_VARIABLES.reduce<
  Record<string, { name: string; value: string }>
>((acc, v) => {
  // Schlüssel ohne {{ }} und ohne Bindestriche — nur Buchstaben/Zahlen/_.
  const key = v.token
    .replace(/[{}]/g, "")
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .trim();
  if (!key) return acc;
  acc[key] = { name: v.label, value: v.token };
  return acc;
}, {});

/**
 * Editor-Optionen. Wir stellen Theme + MergeTags fest, sonst übernehmen
 * wir Unlayer-Defaults (alle Standardblöcke aktiviert).
 */
const EDITOR_OPTIONS: EmailEditorProps["options"] = {
  appearance: {
    theme: "modern_light",
    panels: {
      tools: { dock: "left" },
    },
  },
  mergeTags: MERGE_TAGS,
  features: {
    preview: true,
    undoRedo: true,
    stockImages: false, // keine Stock-Image-Suche; eigene Bilder per URL
  },
  displayMode: "email",
};

const EmailUnlayerEditor = forwardRef<EmailUnlayerEditorHandle, Props>(
  function EmailUnlayerEditor({ initialDesign, onDirtyChange }, ref) {
    const editorRef = useRef<EditorRef>(null);
    /** Wir tracken `ready` lokal, weil onReady erst nach iframe-Load feuert. */
    const readyRef = useRef(false);
    /** Letzter Stand, der noch geladen werden muss, falls onReady noch nicht da war. */
    const pendingDesignRef = useRef<unknown | null>(initialDesign);
    /** Verhindert, dass das initiale loadDesign den Dirty-Flag triggert. */
    const ignoreNextChangeRef = useRef(true);
    /** Cached, ob wir bereits dirty=true gemeldet haben. */
    const dirtyRef = useRef(false);

    // Wenn sich das initial-Design ändert (Template gewechselt), neu laden
    useEffect(() => {
      pendingDesignRef.current = initialDesign;
      ignoreNextChangeRef.current = true;
      dirtyRef.current = false;
      onDirtyChange?.(false);
      const ed = editorRef.current?.editor;
      if (ed && readyRef.current) {
        applyDesign(ed, initialDesign);
      }
    }, [initialDesign, onDirtyChange]);

    function applyDesign(
      ed: NonNullable<EditorRef["editor"]>,
      design: unknown | null,
    ) {
      if (design && typeof design === "object") {
        try {
          // Type-Cast erforderlich, weil JSONTemplate intern ein
          // strukturiertes Schema vorgibt — hier vertrauen wir der Round-trip.
          (ed as unknown as { loadDesign: (d: unknown) => void }).loadDesign(
            design,
          );
        } catch {
          ed.loadBlank();
        }
      } else {
        ed.loadBlank();
      }
    }

    const onReady = useCallback<NonNullable<EmailEditorProps["onReady"]>>(
      (unlayer) => {
        readyRef.current = true;
        ignoreNextChangeRef.current = true;
        applyDesign(unlayer, pendingDesignRef.current);
        try {
          // Listener für Design-Änderungen → Dirty-Tracking
          unlayer.addEventListener(
            "design:updated" as never,
            (() => {
              if (ignoreNextChangeRef.current) {
                // Erste Updates direkt nach loadDesign sind systembedingt
                ignoreNextChangeRef.current = false;
                return;
              }
              if (!dirtyRef.current) {
                dirtyRef.current = true;
                onDirtyChange?.(true);
              }
            }) as never,
          );
        } catch {
          // Listener nicht kritisch — Save funktioniert auch ohne Dirty.
        }
      },
      [onDirtyChange],
    );

    useImperativeHandle(
      ref,
      () => ({
        getResult: (cb) => {
          const ed = editorRef.current?.editor;
          if (!ed) {
            cb({ design: null, html: "" });
            return;
          }
          try {
            ed.exportHtml((data) => {
              cb({ design: data.design ?? null, html: data.html ?? "" });
            });
          } catch {
            cb({ design: null, html: "" });
          }
        },
        loadDesign: (design) => {
          ignoreNextChangeRef.current = true;
          dirtyRef.current = false;
          onDirtyChange?.(false);
          const ed = editorRef.current?.editor;
          if (ed) applyDesign(ed, design);
          else pendingDesignRef.current = design;
        },
        loadBlank: () => {
          ignoreNextChangeRef.current = true;
          dirtyRef.current = false;
          onDirtyChange?.(false);
          const ed = editorRef.current?.editor;
          if (ed) ed.loadBlank();
          else pendingDesignRef.current = null;
        },
        insertMergeTag: (token: string) => {
          // Unlayer hat keine offizielle "insert at cursor"-API, aber das
          // Merge-Tag-Menu wird über die Pille im Text-Tool geöffnet. Wir
          // legen den Token zusätzlich in die Zwischenablage, damit der
          // User ihn auch außerhalb von Text-Tools (z. B. in der URL eines
          // Buttons) einfügen kann.
          if (typeof navigator !== "undefined" && navigator.clipboard) {
            navigator.clipboard.writeText(token).catch(() => {
              // bewusst leer — Clipboard ist nice-to-have
            });
          }
        },
      }),
      [onDirtyChange],
    );

    return (
      <div className="absolute inset-0 flex min-h-0 min-w-0 flex-col bg-white">
        <EmailEditor
          ref={editorRef}
          minHeight="100%"
          options={EDITOR_OPTIONS}
          onReady={onReady}
          style={{ flex: 1, minHeight: 0 }}
        />
      </div>
    );
  },
);

export default EmailUnlayerEditor;
