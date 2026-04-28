import { useLayoutEffect, useMemo, useRef } from "react";
import {
  analyzePromptJsonSafety,
  type PromptJsonSafetyResult,
} from "../../lib/promptJsonSafety";
import {
  PROMPT_PLACEHOLDER_NAMES,
  type PromptPlaceholderName,
} from "../../lib/promptsTemplate";

type Props = {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  /** Optional: vom Parent (z. B. eine gemeinsame `useMemo`-Berechnung pro Prompt). */
  promptJsonSafety?: PromptJsonSafetyResult;
};

const LABEL: Record<PromptPlaceholderName, string> = {
  jahrgang: "Jahrgang",
  marke: "Marke",
  model: "Modell",
  bodytyp: "Karosserie",
  trim: "Trim / Ausstattung",
};

/**
 * Ein großes Textfeld; die fünf Variablen stammen nur per Klick aus der Seitenleiste
 * (Einfügen an Cursor / Ersetzung der Auswahl).
 */
export default function PromptFieldWithPlaceholders({
  value,
  onChange,
  className = "",
  promptJsonSafety: safetyProp,
}: Props) {
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const cursorAfterInsert = useRef<number | null>(null);

  const safetyInternal = useMemo(
    () => analyzePromptJsonSafety(value),
    [value],
  );
  const safety = safetyProp ?? safetyInternal;

  useLayoutEffect(() => {
    const el = taRef.current;
    const pos = cursorAfterInsert.current;
    if (el == null || pos == null) return;
    cursorAfterInsert.current = null;
    el.setSelectionRange(pos, pos);
    el.focus();
  }, [value]);

  function insertName(name: PromptPlaceholderName) {
    const el = taRef.current;
    const ins = `{{${name}}}`;
    if (el) {
      const s = el.selectionStart;
      const e = el.selectionEnd;
      const next = value.slice(0, s) + ins + value.slice(e);
      cursorAfterInsert.current = s + ins.length;
      onChange(next);
    } else {
      onChange(value + ins);
    }
  }

  return (
    <div
      className={`grid gap-4 lg:grid-cols-[min(14rem,100%)_1fr] lg:items-stretch ${className}`}
    >
      <aside
        className="order-2 flex flex-col gap-1.5 rounded-md border border-hair bg-paper/80 p-2 lg:order-1 lg:max-w-[14rem] lg:justify-start"
        aria-label="Variable einfügen"
      >
        <p className="mb-0.5 px-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-ink-400">
          Einfügen
        </p>
        {PROMPT_PLACEHOLDER_NAMES.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => insertName(name)}
            className="w-full rounded border border-transparent bg-white px-2.5 py-2 text-left text-[12.5px] text-ink-800 shadow-sm transition-colors hover:border-hair hover:bg-ink-50/60"
          >
            <span className="block font-sans text-[12px] text-ink-800">
              {LABEL[name]}
            </span>
            <span className="mt-0.5 block font-mono text-[11px] text-ink-500">
              {`{{${name}}}`}
            </span>
          </button>
        ))}
      </aside>
      <div className="order-1 space-y-2 lg:order-2">
        <textarea
          ref={taRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={18}
          spellCheck
          aria-invalid={!safety.ok}
          className={
            safety.ok
              ? "min-h-[20rem] w-full rounded-md border border-hair bg-white px-3 py-2.5 text-[13px] leading-relaxed text-ink-800 placeholder:text-ink-400 focus:border-ink-400 focus:outline-none"
              : "min-h-[20rem] w-full rounded-md border-2 border-accent-rose bg-rose-50/40 px-3 py-2.5 text-[13px] leading-relaxed text-ink-800 placeholder:text-ink-400 focus:border-accent-rose focus:outline-none"
          }
          placeholder="Prompt tippen; Variablen links per Klick an der Cursor-Position einfügen."
          aria-label="Prompt"
        />
        {!safety.ok && safety.reasons.length > 0 && (
          <div
            className="rounded-md border border-accent-rose/60 bg-rose-50/80 px-3 py-2 text-[12px] leading-snug text-accent-rose"
            role="alert"
          >
            <p className="font-medium text-ink-800">
              JSON-/Pipeline-Hinweis (Platzhalter{" "}
              <span className="font-mono text-ink-700">{`{{…}}`}</span> sind
              unkritisch):
            </p>
            <ul className="mt-1.5 list-disc space-y-1 pl-4 text-ink-800">
              {safety.reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
