/**
 * MJML-Editor mit Live-HTML-Preview.
 *
 * Linke Spalte: rohe MJML-Source in einer Textarea (mit Tab-Insertion).
 * Rechte Spalte: in einem iframe gerenderter, kompilierter HTML-Output.
 *
 * Kompilierung läuft komplett im Browser via `mjml-browser`. Wir
 * debouncen 300 ms, damit das Tippen nicht ruckelt.
 *
 * Die Komponente ist absichtlich State-arm, hält aber die Quelle der
 * Wahrheit für `mjml` und `compiled.html`. Die Page liest den Stand
 * über den `EmailMjmlEditorHandle` (`getMjml()`, `getHtml()`).
 */
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import mjml2html, { type MjmlError } from "mjml-browser";
import { AlertTriangle, Monitor, Smartphone } from "lucide-react";

export type EmailMjmlEditorHandle = {
  /** Aktueller MJML-Source-Text (was in der Textarea steht). */
  getMjml: () => string;
  /** Zuletzt erfolgreich kompiliertes HTML – Fallback: leerer String. */
  getHtml: () => string;
  /** Token / MJML-Snippet an der Cursor-Position der Textarea einfügen. */
  insertMjml: (text: string) => void;
  /** Komplettes Neuladen der Source – verwirft den bisherigen Stand. */
  reload: (next: string) => void;
};

type Props = {
  initialMjml: string;
  onDirtyChange?: (dirty: boolean) => void;
};

const COMPILE_DEBOUNCE_MS = 300;

function compile(source: string): { html: string; errors: MjmlError[] } {
  if (!source.trim()) return { html: "", errors: [] };
  try {
    const result = mjml2html(source, {
      validationLevel: "soft",
      keepComments: false,
    });
    return {
      html: typeof result.html === "string" ? result.html : "",
      errors: Array.isArray(result.errors) ? result.errors : [],
    };
  } catch (err) {
    return {
      html: "",
      errors: [
        {
          line: 0,
          message: err instanceof Error ? err.message : String(err),
          formattedMessage:
            err instanceof Error ? err.message : String(err),
        },
      ],
    };
  }
}

const EmailMjmlEditor = forwardRef<EmailMjmlEditorHandle, Props>(
  function EmailMjmlEditor({ initialMjml, onDirtyChange }, ref) {
    const [mjml, setMjml] = useState<string>(initialMjml);
    const [compiled, setCompiled] = useState<{
      html: string;
      errors: MjmlError[];
    }>(() => compile(initialMjml));
    const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">(
      "desktop",
    );
    const [errorsOpen, setErrorsOpen] = useState(false);

    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const initialMjmlRef = useRef(initialMjml);
    const dirtyRef = useRef(false);

    // initialMjml-Wechsel (Template gewechselt) → State zurücksetzen
    useEffect(() => {
      setMjml(initialMjml);
      setCompiled(compile(initialMjml));
      initialMjmlRef.current = initialMjml;
      dirtyRef.current = false;
      onDirtyChange?.(false);
    }, [initialMjml, onDirtyChange]);

    // Debounced Recompile bei jeder Änderung
    useEffect(() => {
      if (mjml === initialMjmlRef.current && !dirtyRef.current) {
        // Noch unverändert seit Reload – nichts zu tun
        return;
      }
      const t = setTimeout(() => {
        setCompiled(compile(mjml));
      }, COMPILE_DEBOUNCE_MS);
      return () => clearTimeout(t);
    }, [mjml]);

    const onChange = useCallback(
      (next: string) => {
        setMjml(next);
        if (!dirtyRef.current && next !== initialMjmlRef.current) {
          dirtyRef.current = true;
          onDirtyChange?.(true);
        }
      },
      [onDirtyChange],
    );

    // Tab-Stop in der Textarea (4 Spaces) – damit MJML-Verschachtelung
    // ergonomisch eingerückt werden kann, ohne den Fokus zu verlieren.
    const onKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key !== "Tab") return;
        e.preventDefault();
        const ta = e.currentTarget;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const indent = "  ";
        const next =
          ta.value.slice(0, start) + indent + ta.value.slice(end);
        onChange(next);
        requestAnimationFrame(() => {
          ta.selectionStart = ta.selectionEnd = start + indent.length;
        });
      },
      [onChange],
    );

    useImperativeHandle(
      ref,
      () => ({
        getMjml: () => mjml,
        getHtml: () => compiled.html,
        insertMjml: (text: string) => {
          const ta = textareaRef.current;
          if (!ta) {
            onChange(mjml + text);
            return;
          }
          const start = ta.selectionStart ?? ta.value.length;
          const end = ta.selectionEnd ?? ta.value.length;
          const next = ta.value.slice(0, start) + text + ta.value.slice(end);
          onChange(next);
          requestAnimationFrame(() => {
            ta.focus();
            const pos = start + text.length;
            ta.setSelectionRange(pos, pos);
          });
        },
        reload: (nextMjml: string) => {
          setMjml(nextMjml);
          setCompiled(compile(nextMjml));
          initialMjmlRef.current = nextMjml;
          dirtyRef.current = false;
          onDirtyChange?.(false);
        },
      }),
      [mjml, compiled.html, onChange, onDirtyChange],
    );

    const errorCount = compiled.errors.length;

    const previewDoc = useMemo(() => {
      // Wenn das HTML leer ist (z. B. zu fehlerhafter MJML), zeigen wir
      // einen sanften Hinweis, statt eines weißen Rechtecks.
      if (!compiled.html) {
        return `<!doctype html><html><head><meta charset="utf-8"/><style>
          html,body{margin:0;height:100%;display:flex;align-items:center;justify-content:center;font-family:Helvetica,Arial,sans-serif;color:#9999a0;background:#fafafa;}
          .b{padding:24px;text-align:center;font-size:13px;line-height:1.5;}
        </style></head><body><div class="b">MJML-Quelltext ist leer oder fehlerhaft —<br/>links etwas einfügen, um eine Vorschau zu sehen.</div></body></html>`;
      }
      return compiled.html;
    }, [compiled.html]);

    return (
      <div className="absolute inset-0 flex min-h-0 min-w-0 flex-col md:flex-row">
        {/* Code-Spalte */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col border-b border-hair bg-ink-900 md:border-b-0 md:border-r">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-ink-300">
            <span>MJML</span>
            <div className="flex items-center gap-3">
              {errorCount > 0 ? (
                <button
                  type="button"
                  onClick={() => setErrorsOpen((v) => !v)}
                  className="inline-flex items-center gap-1 rounded bg-accent-rose/20 px-1.5 py-0.5 text-[10.5px] font-medium uppercase tracking-[0.12em] text-accent-rose hover:bg-accent-rose/30"
                  title={`${errorCount} Validierungs-Hinweis(e)`}
                >
                  <AlertTriangle className="h-3 w-3" />
                  {errorCount} Hinweis{errorCount === 1 ? "" : "e"}
                </button>
              ) : (
                <span className="text-emerald-400/80">OK</span>
              )}
              <span className="tabular-nums text-ink-400">
                {mjml.length.toLocaleString("de-DE")} Zeichen
              </span>
            </div>
          </div>
          <div className="relative min-h-0 flex-1">
            <textarea
              ref={textareaRef}
              value={mjml}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={onKeyDown}
              spellCheck={false}
              className="absolute inset-0 h-full w-full resize-none border-0 bg-ink-900 p-4 font-mono text-[12.5px] leading-relaxed text-ink-100 placeholder:text-ink-500 focus:outline-none focus:ring-0"
              placeholder={'<mjml>\n  <mj-body>\n    <mj-section>\n      <mj-column>\n        <mj-text>Hallo {{name}},</mj-text>\n      </mj-column>\n    </mj-section>\n  </mj-body>\n</mjml>'}
            />
            {errorsOpen && errorCount > 0 && (
              <div
                role="dialog"
                aria-label="MJML-Validierungs-Hinweise"
                className="absolute inset-x-3 bottom-3 max-h-[40%] overflow-y-auto rounded-md border border-accent-rose/40 bg-ink-900/95 p-3 text-[12px] text-ink-100 shadow-lg backdrop-blur"
              >
                <div className="mb-2 flex items-center justify-between gap-2 text-[10.5px] uppercase tracking-[0.14em] text-accent-rose">
                  <span>Hinweise</span>
                  <button
                    type="button"
                    onClick={() => setErrorsOpen(false)}
                    className="rounded px-1.5 py-0.5 text-ink-300 hover:bg-white/10"
                  >
                    schließen
                  </button>
                </div>
                <ul className="space-y-1.5">
                  {compiled.errors.map((er, i) => (
                    <li key={i} className="font-mono text-[11.5px]">
                      <span className="text-ink-400">Zeile {er.line}:</span>{" "}
                      {er.formattedMessage || er.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Preview-Spalte */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-paper">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-hair bg-white px-3 py-1.5">
            <span className="text-[11px] uppercase tracking-[0.14em] text-ink-500">
              Vorschau
            </span>
            <div
              role="tablist"
              aria-label="Vorschau-Gerät"
              className="inline-flex rounded-md border border-hair bg-white p-0.5"
            >
              <button
                type="button"
                role="tab"
                aria-selected={previewMode === "desktop"}
                onClick={() => setPreviewMode("desktop")}
                className={`inline-flex items-center gap-1 rounded-[5px] px-2 py-0.5 text-[11.5px] font-medium transition ${
                  previewMode === "desktop"
                    ? "bg-ink-900 text-white"
                    : "text-ink-500 hover:text-ink-900"
                }`}
                title="Desktop-Vorschau"
              >
                <Monitor className="h-3.5 w-3.5" />
                Desktop
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={previewMode === "mobile"}
                onClick={() => setPreviewMode("mobile")}
                className={`inline-flex items-center gap-1 rounded-[5px] px-2 py-0.5 text-[11.5px] font-medium transition ${
                  previewMode === "mobile"
                    ? "bg-ink-900 text-white"
                    : "text-ink-500 hover:text-ink-900"
                }`}
                title="Mobile-Vorschau"
              >
                <Smartphone className="h-3.5 w-3.5" />
                Mobile
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <div
              className={`mx-auto h-full ${previewMode === "mobile" ? "max-w-[420px]" : "max-w-none"}`}
            >
              <iframe
                title="Email-Vorschau"
                srcDoc={previewDoc}
                sandbox=""
                className="h-full w-full border-0 bg-white"
              />
            </div>
          </div>
        </div>
      </div>
    );
  },
);

export default EmailMjmlEditor;
