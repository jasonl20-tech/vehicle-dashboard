import { useLayoutEffect, useRef } from "react";
import {
  PROMPT_PLACEHOLDER_NAMES,
  type PromptPlaceholderName,
} from "../../lib/promptsTemplate";

type Props = {
  value: string;
  onChange: (v: string) => void;
  className?: string;
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
}: Props) {
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const cursorAfterInsert = useRef<number | null>(null);

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
      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={18}
        spellCheck
        className="order-1 min-h-[20rem] w-full rounded-md border border-hair bg-white px-3 py-2.5 text-[13px] leading-relaxed text-ink-800 placeholder:text-ink-400 focus:border-ink-400 focus:outline-none lg:order-2"
        placeholder="Prompt tippen; Variablen links per Klick an der Cursor-Position einfügen."
        aria-label="Prompt"
      />
    </div>
  );
}
