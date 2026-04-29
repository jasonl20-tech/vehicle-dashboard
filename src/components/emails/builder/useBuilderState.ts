/**
 * Builder-State-Hook: zentraler Zustand für `EmailDesign` + Selection
 * + Undo/Redo + Mutations-API.
 *
 * Design ist immutabel: Mutationen klonen den betroffenen Zweig (Section
 * → Column → Block) und ersetzen den Stand atomar. Jede Top-Level-
 * Mutation pusht den vorherigen Stand auf den Undo-Stack.
 *
 * Selection ist eine separate Ref/State: ändert sich der Block-Pfad
 * nach einer Mutation (z. B. Section gelöscht), kümmert sich der Caller
 * darum, sie zu aktualisieren oder zu leeren.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  makeBlock,
  makeColumn,
  makeSection,
} from "./defaults";
import type {
  BlockPath,
  Column,
  ContentBlock,
  ContentBlockType,
  EmailDesign,
  Section,
  SectionLayout,
  SelectionTarget,
} from "./types";

const HISTORY_LIMIT = 80;

export type BuilderApi = {
  design: EmailDesign;
  selection: SelectionTarget;
  setSelection: (s: SelectionTarget) => void;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  /** Komplettes Design ersetzen (z. B. beim Template-Wechsel). */
  replace: (next: EmailDesign, opts?: { resetHistory?: boolean }) => void;

  // ─── Body ───
  updateBody: (patch: Partial<EmailDesign["body"]>) => void;

  // ─── Sections ───
  addSection: (layout: SectionLayout) => void;
  removeSection: (sectionIndex: number) => void;
  moveSection: (sectionIndex: number, direction: -1 | 1) => void;
  duplicateSection: (sectionIndex: number) => void;
  updateSection: (sectionIndex: number, patch: Partial<Section>) => void;
  setSectionLayout: (sectionIndex: number, layout: SectionLayout) => void;

  // ─── Blocks ───
  addBlock: (
    sectionIndex: number,
    columnIndex: number,
    type: ContentBlockType,
  ) => BlockPath | null;
  removeBlock: (path: BlockPath) => void;
  duplicateBlock: (path: BlockPath) => void;
  moveBlock: (path: BlockPath, direction: -1 | 1) => void;
  updateBlock: <T extends ContentBlock>(
    path: BlockPath,
    patch: Partial<T>,
  ) => void;
};

function clone<T>(v: T): T {
  // Strukturklon ist ausreichend, Designs sind reine Daten.
  return JSON.parse(JSON.stringify(v)) as T;
}

function reshapeColumns(section: Section, layout: SectionLayout): Column[] {
  const target =
    layout === "1" ? 1 : layout === "1-1-1" ? 3 : 2;
  const next = section.columns.slice(0, target);
  while (next.length < target) next.push(makeColumn());
  return next;
}

export function useBuilderState(initialDesign: EmailDesign): BuilderApi {
  const [design, setDesign] = useState<EmailDesign>(() => clone(initialDesign));
  const [selection, setSelection] = useState<SelectionTarget>(null);

  const undoStack = useRef<EmailDesign[]>([]);
  const redoStack = useRef<EmailDesign[]>([]);
  const [, setHistoryRev] = useState(0);

  // Wenn ein neues `initialDesign` reinkommt (Template-Wechsel),
  // resetten wir Stack & Selection.
  useEffect(() => {
    setDesign(clone(initialDesign));
    setSelection(null);
    undoStack.current = [];
    redoStack.current = [];
    setHistoryRev((r) => r + 1);
  }, [initialDesign]);

  const pushHistory = useCallback((prev: EmailDesign) => {
    undoStack.current.push(prev);
    if (undoStack.current.length > HISTORY_LIMIT) {
      undoStack.current.shift();
    }
    redoStack.current = [];
    setHistoryRev((r) => r + 1);
  }, []);

  /** Wendet eine Mutationsfunktion an und legt den vorherigen Stand auf den Undo-Stack. */
  const mutate = useCallback(
    (fn: (draft: EmailDesign) => void) => {
      setDesign((current) => {
        const next = clone(current);
        fn(next);
        pushHistory(current);
        return next;
      });
    },
    [pushHistory],
  );

  const replace = useCallback(
    (next: EmailDesign, opts?: { resetHistory?: boolean }) => {
      if (opts?.resetHistory) {
        undoStack.current = [];
        redoStack.current = [];
        setSelection(null);
      } else {
        setDesign((current) => {
          pushHistory(current);
          return clone(next);
        });
        return;
      }
      setDesign(clone(next));
      setHistoryRev((r) => r + 1);
    },
    [pushHistory],
  );

  const undo = useCallback(() => {
    const prev = undoStack.current.pop();
    if (!prev) return;
    setDesign((current) => {
      redoStack.current.push(current);
      return prev;
    });
    setHistoryRev((r) => r + 1);
  }, []);

  const redo = useCallback(() => {
    const next = redoStack.current.pop();
    if (!next) return;
    setDesign((current) => {
      undoStack.current.push(current);
      return next;
    });
    setHistoryRev((r) => r + 1);
  }, []);

  // ─── Body ───────────────────────────────────────────────────
  const updateBody = useCallback(
    (patch: Partial<EmailDesign["body"]>) => {
      mutate((d) => {
        d.body = { ...d.body, ...patch };
      });
    },
    [mutate],
  );

  // ─── Sections ──────────────────────────────────────────────
  const addSection = useCallback(
    (layout: SectionLayout) => {
      mutate((d) => {
        d.sections.push(makeSection(layout));
      });
    },
    [mutate],
  );

  const removeSection = useCallback(
    (sectionIndex: number) => {
      mutate((d) => {
        d.sections.splice(sectionIndex, 1);
      });
      setSelection((s) =>
        s && s.kind === "section" && s.sectionIndex === sectionIndex
          ? null
          : s,
      );
    },
    [mutate],
  );

  const moveSection = useCallback(
    (sectionIndex: number, direction: -1 | 1) => {
      mutate((d) => {
        const target = sectionIndex + direction;
        if (target < 0 || target >= d.sections.length) return;
        const [s] = d.sections.splice(sectionIndex, 1);
        if (s) d.sections.splice(target, 0, s);
      });
    },
    [mutate],
  );

  const duplicateSection = useCallback(
    (sectionIndex: number) => {
      mutate((d) => {
        const src = d.sections[sectionIndex];
        if (!src) return;
        const copy = clone(src);
        copy.id = `sec_${Math.random().toString(36).slice(2, 10)}`;
        copy.columns.forEach((c) => {
          c.id = `col_${Math.random().toString(36).slice(2, 10)}`;
          c.blocks.forEach((b) => {
            b.id = `blk_${Math.random().toString(36).slice(2, 10)}`;
          });
        });
        d.sections.splice(sectionIndex + 1, 0, copy);
      });
    },
    [mutate],
  );

  const updateSection = useCallback(
    (sectionIndex: number, patch: Partial<Section>) => {
      mutate((d) => {
        const s = d.sections[sectionIndex];
        if (!s) return;
        Object.assign(s, patch);
      });
    },
    [mutate],
  );

  const setSectionLayout = useCallback(
    (sectionIndex: number, layout: SectionLayout) => {
      mutate((d) => {
        const s = d.sections[sectionIndex];
        if (!s) return;
        s.layout = layout;
        s.columns = reshapeColumns(s, layout);
      });
    },
    [mutate],
  );

  // ─── Blocks ────────────────────────────────────────────────
  const addBlock = useCallback(
    (
      sectionIndex: number,
      columnIndex: number,
      type: ContentBlockType,
    ): BlockPath | null => {
      let resultPath: BlockPath | null = null;
      mutate((d) => {
        const s = d.sections[sectionIndex];
        if (!s) return;
        const col = s.columns[columnIndex];
        if (!col) return;
        const block = makeBlock(type);
        col.blocks.push(block);
        resultPath = {
          sectionIndex,
          columnIndex,
          blockIndex: col.blocks.length - 1,
        };
      });
      if (resultPath) {
        setSelection({ kind: "block", path: resultPath });
      }
      return resultPath;
    },
    [mutate],
  );

  const removeBlock = useCallback(
    (path: BlockPath) => {
      mutate((d) => {
        const s = d.sections[path.sectionIndex];
        const col = s?.columns[path.columnIndex];
        if (!col) return;
        col.blocks.splice(path.blockIndex, 1);
      });
      setSelection((sel) => {
        if (
          sel &&
          sel.kind === "block" &&
          sel.path.sectionIndex === path.sectionIndex &&
          sel.path.columnIndex === path.columnIndex &&
          sel.path.blockIndex === path.blockIndex
        ) {
          return null;
        }
        return sel;
      });
    },
    [mutate],
  );

  const duplicateBlock = useCallback(
    (path: BlockPath) => {
      mutate((d) => {
        const s = d.sections[path.sectionIndex];
        const col = s?.columns[path.columnIndex];
        if (!col) return;
        const src = col.blocks[path.blockIndex];
        if (!src) return;
        const copy = clone(src);
        copy.id = `blk_${Math.random().toString(36).slice(2, 10)}`;
        col.blocks.splice(path.blockIndex + 1, 0, copy);
      });
    },
    [mutate],
  );

  const moveBlock = useCallback(
    (path: BlockPath, direction: -1 | 1) => {
      mutate((d) => {
        const s = d.sections[path.sectionIndex];
        const col = s?.columns[path.columnIndex];
        if (!col) return;
        const target = path.blockIndex + direction;
        if (target < 0 || target >= col.blocks.length) return;
        const [b] = col.blocks.splice(path.blockIndex, 1);
        if (b) col.blocks.splice(target, 0, b);
      });
      setSelection((sel) => {
        if (sel && sel.kind === "block") {
          if (
            sel.path.sectionIndex === path.sectionIndex &&
            sel.path.columnIndex === path.columnIndex &&
            sel.path.blockIndex === path.blockIndex
          ) {
            return {
              kind: "block",
              path: { ...path, blockIndex: path.blockIndex + direction },
            };
          }
        }
        return sel;
      });
    },
    [mutate],
  );

  const updateBlock = useCallback(
    <T extends ContentBlock>(path: BlockPath, patch: Partial<T>) => {
      mutate((d) => {
        const s = d.sections[path.sectionIndex];
        const col = s?.columns[path.columnIndex];
        const blk = col?.blocks[path.blockIndex];
        if (!blk) return;
        Object.assign(blk, patch);
      });
    },
    [mutate],
  );

  return {
    design,
    selection,
    setSelection,
    canUndo: undoStack.current.length > 0,
    canRedo: redoStack.current.length > 0,
    undo,
    redo,
    replace,
    updateBody,
    addSection,
    removeSection,
    moveSection,
    duplicateSection,
    updateSection,
    setSectionLayout,
    addBlock,
    removeBlock,
    duplicateBlock,
    moveBlock,
    updateBlock,
  };
}
