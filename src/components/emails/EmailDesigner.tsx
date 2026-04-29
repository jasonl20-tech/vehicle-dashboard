/**
 * GrapesJS-basierter Email-Designer.
 *
 * Wird per `React.lazy(() => import("./EmailDesigner"))` geladen, damit
 * GrapesJS (~700 KB) nur beim Editor-Aufruf gebündelt wird und nicht den
 * normalen Dashboard-Bundle aufbläht.
 *
 * Verfügbar gemacht über `forwardRef`:
 *   - getHtml(): liefert email-fertiges HTML (inline-CSS wenn das Newsletter-
 *                Preset es unterstützt, sonst `<style>` + body)
 *   - insertHtml(html): fügt HTML beim aktuell selektierten Block ein
 *                       (Fallback: appended an Body) — wird für Variablen-
 *                       Tokens wie `{{name}}` benutzt
 *   - reload(html): ersetzt den Editor-Inhalt komplett
 *   - undo() / redo(): klassische Tastatur-/UI-Aktionen, die wir auch in der
 *                      Toolbar im Editor anbieten
 */
import grapesjs, {
  type Editor as GrapesEditor,
  type EditorConfig,
} from "grapesjs";
import gjsPresetNewsletter from "grapesjs-preset-newsletter";
import "grapesjs/dist/css/grapes.min.css";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

export type EmailDesignerHandle = {
  getHtml: () => string;
  insertHtml: (html: string) => void;
  reload: (html: string) => void;
  undo: () => void;
  redo: () => void;
  /**
   * Erzwingt ein Re-Layout des GrapesJS-Canvas (iframe). Notwendig, wenn der
   * Container vorher per `display:none` versteckt war (z. B. HTML-Modus
   * aktiv) — sonst hat das Canvas u. U. 0×0-Dimensionen.
   */
  refresh: () => void;
};

type Props = {
  initialHtml: string;
  /** Wird gerufen, wenn der Editor `dirty` wechselt (für Save-Indikator). */
  onDirtyChange?: (dirty: boolean) => void;
};

/**
 * Liefert "nur den HTML-Inhalt" (ohne `<html>/<head>/<body>`-Wrapper).
 * CSS wird als `<style>`-Block am Anfang prepended, damit der externe
 * Mail-Worker das Template sauber laden und wahlweise inline-stylen kann
 * (z. B. mit `juice`).
 */
function exportEmailHtml(editor: GrapesEditor): string {
  const html = (editor.getHtml() ?? "").trim();
  const css = (editor.getCss() ?? "").trim();
  if (!css) return html;
  return `<style type="text/css">\n${css}\n</style>\n${html}`;
}

/**
 * GrapesJS will bei `setComponents` HTML mit `<html>` + `<body>` nicht
 * besonders gut behandeln; wir geben ihm nur den Body-Content. Vorhandene
 * `<style>`-Blöcke werden als CSS extrahiert, damit Stil-Angaben erhalten
 * bleiben.
 */
function splitHtmlForGrapes(html: string): { body: string; css: string } {
  const styleMatches = Array.from(
    html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi),
  );
  const css = styleMatches
    .map((m) => m[1] ?? "")
    .join("\n")
    .trim();
  let body = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");

  const bodyMatch = body.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (bodyMatch) {
    body = bodyMatch[1] ?? "";
  } else {
    body = body
      .replace(/<!DOCTYPE[^>]*>/gi, "")
      .replace(/<\/?html[^>]*>/gi, "")
      .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, "");
  }
  return { body: body.trim(), css };
}

const EmailDesigner = forwardRef<EmailDesignerHandle, Props>(
  function EmailDesigner({ initialHtml, onDirtyChange }, ref) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const editorRef = useRef<GrapesEditor | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;

      try {
        const split = splitHtmlForGrapes(initialHtml || "");
        const cfg: EditorConfig = {
          container: el,
          height: "100%",
          width: "auto",
          fromElement: false,
          components: split.body,
          style: split.css,
          storageManager: false,
          // Newsletter-Preset
          plugins: [gjsPresetNewsletter as never],
          pluginsOpts: {
            "grapesjs-preset-newsletter": {
              modalLabelImport: "HTML einfügen",
              modalLabelExport: "Email-HTML exportieren",
              modalBtnImport: "Importieren",
              codeViewerTheme: "material",
              importPlaceholder:
                "<table>...dein Email-HTML hier einfügen...</table>",
              inlineCss: true,
            },
          },
          // Standard-Geräte (Desktop / Mobile) erweitern um Tablet
          deviceManager: {
            devices: [
              {
                id: "desktop",
                name: "Desktop",
                width: "",
              },
              {
                id: "tablet",
                name: "Tablet",
                width: "768px",
                widthMedia: "992px",
              },
              {
                id: "mobilePortrait",
                name: "Mobil",
                width: "375px",
                widthMedia: "480px",
              },
            ],
          },
        };

        const editor = grapesjs.init(cfg);
        editorRef.current = editor;

        const handleDirty = () => {
          if (!onDirtyChange) return;
          // GrapesJS bietet seit v0.20 `getDirtyCount()` als Public-API.
          let dirty = false;
          try {
            const ed = editor as unknown as { getDirtyCount?: () => number };
            if (typeof ed.getDirtyCount === "function") {
              dirty = (ed.getDirtyCount() ?? 0) > 0;
            } else {
              dirty = true;
            }
          } catch {
            dirty = true;
          }
          onDirtyChange(dirty);
        };

        editor.on("update", handleDirty);
        editor.on("component:update", handleDirty);
        editor.on("style:update", handleDirty);

        return () => {
          try {
            editor.destroy();
          } catch {
            // bewusst leer
          }
          editorRef.current = null;
        };
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
      // Achtung: Wir initialisieren GrapesJS nur einmal pro Mount. Wenn sich
      // `initialHtml` ändert (z. B. nach Reload), nutzen wir `reload()` von
      // außen statt eines Re-Initialisierens.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        getHtml: () => {
          const ed = editorRef.current;
          if (!ed) return "";
          return exportEmailHtml(ed);
        },
        insertHtml: (html: string) => {
          const ed = editorRef.current;
          if (!ed) return;
          const selected = ed.getSelected();
          const target = selected ?? ed.getWrapper();
          if (target && typeof target.append === "function") {
            try {
              target.append(html as never);
              return;
            } catch {
              // Fallback unten
            }
          }
          // Letzter Fallback: Komponentenliste neu setzen
          try {
            const current = ed.getHtml?.() ?? "";
            ed.setComponents(`${current}${html}`);
          } catch {
            // bewusst leer
          }
        },
        reload: (html: string) => {
          const ed = editorRef.current;
          if (!ed) return;
          const split = splitHtmlForGrapes(html || "");
          ed.setComponents(split.body);
          ed.setStyle(split.css);
          try {
            const um = ed.UndoManager as unknown as { clear?: () => void };
            um.clear?.();
          } catch {
            // bewusst leer
          }
        },
        undo: () => {
          try {
            const um = editorRef.current?.UndoManager as unknown as {
              undo?: () => void;
            };
            um?.undo?.();
          } catch {
            // bewusst leer
          }
        },
        redo: () => {
          try {
            const um = editorRef.current?.UndoManager as unknown as {
              redo?: () => void;
            };
            um?.redo?.();
          } catch {
            // bewusst leer
          }
        },
        refresh: () => {
          const ed = editorRef.current as
            | (GrapesEditor & { refresh?: () => void })
            | null;
          if (!ed) return;
          try {
            ed.refresh?.();
          } catch {
            // bewusst leer
          }
          // Fallback: synthetisches resize, damit Canvas + Tools neu messen
          try {
            window.dispatchEvent(new Event("resize"));
          } catch {
            // bewusst leer
          }
        },
      }),
      [],
    );

    if (error) {
      return (
        <div className="flex h-full items-center justify-center p-6">
          <p className="border-l-2 border-accent-rose px-3 py-2 text-[12.5px] text-accent-rose">
            Editor-Fehler: {error}
          </p>
        </div>
      );
    }

    return (
      <div className="email-designer-shell absolute inset-0">
        <div ref={containerRef} className="h-full w-full" />
      </div>
    );
  },
);

export default EmailDesigner;
