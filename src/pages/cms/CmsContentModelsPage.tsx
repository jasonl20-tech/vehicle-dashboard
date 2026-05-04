import { ChevronRight } from "lucide-react";

const MODELS = [
  {
    id: "landingPage",
    name: "Landing Page",
    fields: 8,
    desc: "Hero, Sektionen, SEO-Meta",
  },
  {
    id: "blogPost",
    name: "Blog Post",
    fields: 12,
    desc: "Rich Text, Teaser, Kategorie",
  },
  {
    id: "mediaAsset",
    name: "Medienreferenz",
    fields: 4,
    desc: "Titel, Datei, Alt-Text",
  },
];

export default function CmsContentModelsPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-8">
        <h1 className="font-display text-[26px] font-semibold tracking-tighter2 text-ink-900">
          Content-Modelle
        </h1>
        <p className="mt-1 text-[13px] text-ink-500">
          Schemas definieren Felder und Typen — hier als UI-Vorschau ohne
          Persistenz.
        </p>
      </header>

      <ul className="space-y-2">
        {MODELS.map((m) => (
          <li key={m.id}>
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-hair bg-white p-4 text-left shadow-sm transition hover:border-ink-200 hover:bg-ink-50/30"
            >
              <div>
                <p className="font-medium text-ink-900">{m.name}</p>
                <p className="mt-0.5 text-[12px] text-ink-500">{m.desc}</p>
                <p className="mt-2 text-[11px] text-ink-400">
                  {m.fields} Felder · ID <code className="font-mono">{m.id}</code>
                </p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-ink-300" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
