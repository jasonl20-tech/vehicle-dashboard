/**
 * Hauptkomponente des selbst gebauten Email-Builders.
 *
 * Layout (Desktop):
 *   ┌──────────────────────────────────────────────────────────────────┐
 *   │ Topbar: Device-Toggle · Vorlagen · Undo/Redo                     │
 *   ├────────────┬───────────────────────────────────────┬─────────────┤
 *   │ BlockSidebar │             Canvas                  │  Settings   │
 *   │  (links)    │       (Live-Preview, edit-fähig)     │  (rechts)   │
 *   └────────────┴───────────────────────────────────────┴─────────────┘
 *
 * Imperative API (`EmailBuilderHandle`) für den Page-Container:
 *   - `getDesign()`         → aktuelles Design-Snapshot
 *   - `getEmailHtml()`      → gerendertes Mail-HTML zum Speichern
 *   - `replaceDesign(d)`    → Design ersetzen (Vorlage einfügen, Reload)
 *   - `insertVariable(tok)` → Variable in den fokussierten Text einfügen
 *                             (fällt zurück auf Clipboard, wenn Fokus
 *                             nicht in einem Text-Block ist)
 *
 * Die Komponente selbst ist "headless": sie speichert nichts in der
 * Datenbank, sie kümmert sich nur um Editor-State + UI. Save/Load
 * geschieht im Page-Container.
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
import {
  Monitor,
  Redo2,
  Smartphone,
  Sparkles,
  Undo2,
} from "lucide-react";
import BlockSidebar from "./BlockSidebar";
import Canvas from "./Canvas";
import SettingsSidebar from "./SettingsSidebar";
import { renderEmailHtml } from "./render";
import { freshSection } from "./sectionTemplates";
import { STARTERS, fresh } from "./starters";
import { useBuilderState } from "./useBuilderState";
import type {
  ContentBlockType,
  EmailDesign,
  Section,
  SectionLayout,
} from "./types";

export type EmailBuilderHandle = {
  getDesign: () => EmailDesign;
  getEmailHtml: () => string;
  replaceDesign: (design: EmailDesign) => void;
  /** Variable an den Cursor einfügen, wenn ein Text-Block fokussiert ist. */
  insertVariable: (token: string) => void;
};

type Props = {
  /** Initial-Design beim Laden / nach Template-Wechsel. */
  initialDesign: EmailDesign;
  /** Wird gerufen, wenn sich das Design durch Editor-Aktionen ändert. */
  onChange?: () => void;
};

const EmailBuilder = forwardRef<EmailBuilderHandle, Props>(function EmailBuilder(
  { initialDesign, onChange },
  ref,
) {
  const api = useBuilderState(initialDesign);
  const [tab, setTab] = useState<"content" | "layout" | "templates">(
    "templates",
  );
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [showStarters, setShowStarters] = useState(false);

  // ─── Change-Notifier ───────────────────────────────────────
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    onChange?.();
    // Wir wollen NUR auf design-Änderungen reagieren
  }, [api.design, onChange]);

  // ─── Block-Insertion-Logik ─────────────────────────────────
  // Wo wird ein neu hinzugefügter Block platziert?
  //   1) Eine Section-/Block-Selection ist vorhanden? → in deren Spalte
  //   2) Sonst: in die letzte Spalte der letzten Section
  //   3) Wenn keine Section existiert: erst eine 1-Spalten-Section
  //      anlegen, dann den Block einfügen.
  const onAddBlock = useCallback(
    (type: ContentBlockType) => {
      const sel = api.selection;
      let secIdx = -1;
      let colIdx = 0;
      if (sel && sel.kind === "block") {
        secIdx = sel.path.sectionIndex;
        colIdx = sel.path.columnIndex;
      } else if (sel && sel.kind === "section") {
        secIdx = sel.sectionIndex;
        colIdx = 0;
      } else if (api.design.sections.length > 0) {
        secIdx = api.design.sections.length - 1;
        colIdx = 0;
      }
      if (secIdx < 0) {
        api.addSection("1");
        // Section liegt jetzt am Ende; Block in die nächste Tick-
        // Iteration einfügen, damit der State aktualisiert ist.
        requestAnimationFrame(() => {
          // `api.design` ist beim nächsten Frame aktualisiert
          api.addBlock(0, 0, type);
        });
        return;
      }
      api.addBlock(secIdx, colIdx, type);
    },
    [api],
  );

  const onAddSectionFromSidebar = useCallback(
    (layout: SectionLayout) => {
      api.addSection(layout);
    },
    [api],
  );

  /**
   * Eine vorgefertigte Section-Vorlage einfügen. Wenn aktuell eine
   * Section ausgewählt ist, fügen wir die neue direkt darunter ein —
   * sonst hängen wir sie ans Ende. Das ist die natürliche Erwartung,
   * wenn der User z. B. zuerst einen Header anklickt und dann einen
   * Hero-Block direkt darunter haben will.
   */
  const onAddSectionTemplate = useCallback(
    (factory: () => Section) => {
      const section = freshSection(factory());
      const sel = api.selection;
      let afterIndex: number | undefined;
      if (sel && sel.kind === "section") {
        afterIndex = sel.sectionIndex;
      } else if (sel && sel.kind === "block") {
        afterIndex = sel.path.sectionIndex;
      }
      api.insertSection(section, afterIndex);
    },
    [api],
  );

  // ─── Imperative-API ────────────────────────────────────────
  useImperativeHandle(
    ref,
    () => ({
      getDesign: () => api.design,
      getEmailHtml: () => renderEmailHtml(api.design),
      replaceDesign: (design: EmailDesign) => {
        api.replace(design);
      },
      insertVariable: (token: string) => {
        // Wenn ein Text/Heading-Block fokussiert ist, fügen wir den Token
        // direkt am Cursor ein. Sonst: Clipboard (Fallback).
        const active = document.activeElement as HTMLElement | null;
        if (active && active.isContentEditable) {
          try {
            document.execCommand("insertText", false, token);
            return;
          } catch {
            // ignore – Fallback unten
          }
        }
        try {
          navigator.clipboard?.writeText(token);
        } catch {
          // ignore
        }
      },
    }),
    [api],
  );

  // ─── Keyboard-Shortcuts ────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Nur reagieren, wenn der Fokus im Builder-Container ist
      const target = e.target as HTMLElement | null;
      const inEditableField =
        !!target &&
        ((target.tagName === "INPUT" && (target as HTMLInputElement).type !== "checkbox") ||
          target.tagName === "TEXTAREA" ||
          (target.isContentEditable && !target.closest("[data-builder-shortcut-allow]")));
      // Bei Inputs/Textareas erlauben wir Cmd+Z dem Browser/Field
      if (inEditableField) return;
      const cmd = e.metaKey || e.ctrlKey;
      if (cmd && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        api.undo();
      } else if (
        (cmd && e.key.toLowerCase() === "y") ||
        (cmd && e.shiftKey && e.key.toLowerCase() === "z")
      ) {
        e.preventDefault();
        api.redo();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [api]);

  // ─── Render ────────────────────────────────────────────────
  const startersList = useMemo(() => STARTERS, []);

  return (
    <div className="absolute inset-0 flex flex-col bg-paper">
      {/* Topbar */}
      <div className="flex shrink-0 items-center gap-2 border-b border-hair bg-white px-3 py-2">
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowStarters((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-md border border-hair bg-white px-2.5 py-1.5 text-[12px] font-medium text-ink-700 transition hover:border-ink-300 hover:text-ink-900"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Vorlage einfügen
          </button>
          {showStarters && (
            <>
              <button
                type="button"
                aria-label="Schließen"
                onClick={() => setShowStarters(false)}
                className="fixed inset-0 z-30 cursor-default"
              />
              <div className="absolute left-0 top-full z-40 mt-1 w-72 rounded-lg border border-hair bg-white p-1 shadow-xl">
                {startersList.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      api.replace(fresh(s.build()), { resetHistory: false });
                      setShowStarters(false);
                    }}
                    className="block w-full rounded px-2 py-1.5 text-left transition hover:bg-ink-50"
                  >
                    <div className="text-[12.5px] font-medium text-ink-900">
                      {s.label}
                    </div>
                    <div className="mt-0.5 text-[11px] text-ink-500">
                      {s.description}
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="ml-auto inline-flex items-center gap-1">
          <button
            type="button"
            onClick={api.undo}
            disabled={!api.canUndo}
            title="Rückgängig (⌘Z)"
            className={`inline-flex h-7 w-7 items-center justify-center rounded-md border border-hair bg-white transition ${
              api.canUndo
                ? "text-ink-700 hover:border-ink-300 hover:text-ink-900"
                : "cursor-not-allowed text-ink-300"
            }`}
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={api.redo}
            disabled={!api.canRedo}
            title="Wiederholen (⌘⇧Z)"
            className={`inline-flex h-7 w-7 items-center justify-center rounded-md border border-hair bg-white transition ${
              api.canRedo
                ? "text-ink-700 hover:border-ink-300 hover:text-ink-900"
                : "cursor-not-allowed text-ink-300"
            }`}
          >
            <Redo2 className="h-3.5 w-3.5" />
          </button>
          <span className="mx-2 inline-block h-5 w-px bg-hair" />
          <div className="inline-flex rounded-md border border-hair bg-white p-0.5">
            <button
              type="button"
              onClick={() => setDevice("desktop")}
              title="Desktop-Vorschau"
              className={`inline-flex h-6 items-center gap-1 rounded px-1.5 text-[11.5px] font-medium ${
                device === "desktop"
                  ? "bg-ink-900 text-white"
                  : "text-ink-700 hover:text-ink-900"
              }`}
            >
              <Monitor className="h-3.5 w-3.5" />
              Desktop
            </button>
            <button
              type="button"
              onClick={() => setDevice("mobile")}
              title="Mobile-Vorschau"
              className={`inline-flex h-6 items-center gap-1 rounded px-1.5 text-[11.5px] font-medium ${
                device === "mobile"
                  ? "bg-ink-900 text-white"
                  : "text-ink-700 hover:text-ink-900"
              }`}
            >
              <Smartphone className="h-3.5 w-3.5" />
              Mobile
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <BlockSidebar
          tab={tab}
          onTabChange={setTab}
          onAddBlock={onAddBlock}
          onAddSection={onAddSectionFromSidebar}
          onAddSectionTemplate={onAddSectionTemplate}
        />
        <main className="relative min-h-0 flex-1 overflow-hidden bg-paper">
          <Canvas
            api={api}
            device={device}
            onRequestAddBlock={(secIdx, colIdx) => {
              setTab("content");
              // Wenn die Spalte leer ist, gibt es keinen Block mit Index 0,
              // den wir auswählen könnten — also nur die Section markieren.
              api.setSelection({
                kind: "section",
                sectionIndex: secIdx,
              });
              void colIdx; /* noop: der Tab-Switch genügt */
            }}
          />
        </main>
        <SettingsSidebar api={api} />
      </div>
    </div>
  );
});

export default EmailBuilder;
