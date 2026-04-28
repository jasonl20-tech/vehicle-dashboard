import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";

/**
 * Sortier-Zustandsanzeige wie in CRM / Standard-Tabellen.
 */
export default function SortGlyph({
  active,
  asc,
}: {
  active: boolean;
  asc: boolean;
}) {
  if (!active) {
    return (
      <ChevronsUpDown
        className="h-3 w-3 shrink-0 text-ink-300 opacity-50"
        aria-hidden
      />
    );
  }
  return asc ? (
    <ArrowUp className="h-3 w-3 shrink-0 text-brand-600" aria-hidden />
  ) : (
    <ArrowDown className="h-3 w-3 shrink-0 text-brand-600" aria-hidden />
  );
}
