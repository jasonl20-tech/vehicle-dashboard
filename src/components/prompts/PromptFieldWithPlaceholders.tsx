import {
  parsePromptWithPlaceholders,
  setPromptTextAtSegment,
} from "../../lib/promptsTemplate";
import type {
  PromptPlaceholderName,
  PromptSegment,
} from "../../lib/promptsTemplate";

type Props = {
  value: string;
  onChange: (v: string) => void;
  className?: string;
};

/**
 * Prompt mit festen Kacheln für {{jahrgang}}, {{marke}}, … — nicht
 * zeichenweise im Fließtext, daher kein Löschen/Einfügen einzelner Zeichen
 * innerhalb des Platzhalter-Strings.
 */
export default function PromptFieldWithPlaceholders({
  value,
  onChange,
  className = "",
}: Props) {
  const segments: PromptSegment[] = parsePromptWithPlaceholders(value);

  return (
    <div
      className={`flex flex-wrap items-start gap-x-1.5 gap-y-2 ${className}`}
    >
      {segments.map((seg, i) =>
        seg.kind === "var" ? (
          <VarChip key={i} name={seg.name} />
        ) : (
          <textarea
            key={i}
            value={seg.text}
            onChange={(e) =>
              onChange(setPromptTextAtSegment(value, i, e.target.value))
            }
            rows={Math.min(20, Math.max(3, (seg.text.match(/\n/g)?.length ?? 0) + 2))}
            spellCheck={true}
            className="min-h-[5rem] min-w-[4rem] flex-1 basis-[14rem] rounded-md border border-hair bg-white px-2.5 py-2 text-[13px] leading-relaxed text-ink-800 focus:border-ink-400 focus:outline-none"
            aria-label="Prompt-Text"
          />
        ),
      )}
    </div>
  );
}

function VarChip({ name }: { name: PromptPlaceholderName }) {
  return (
    <span
      className="inline-flex shrink-0 select-none items-center rounded border border-hair bg-ink-100 px-2 py-1.5 font-mono text-[12.5px] leading-none text-ink-800"
      title="Platzhalter (fest, nicht einzeln editierbar)"
      contentEditable={false}
    >
      {`{{${name}}}`}
    </span>
  );
}
