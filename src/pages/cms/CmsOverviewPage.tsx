import { ArrowRight, Box, Image as ImageIcon, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { CMS_ROOT } from "../../lib/cmsAccess";

const cards = [
  {
    title: "Content-Modelle",
    description:
      "Felder, Validierung und Beziehungen — ähnlich wie in Contentful.",
    to: `${CMS_ROOT}/models`,
    icon: Sparkles,
    stat: "Schemas folgen",
    tone: "from-accent-rose/15 to-brand-500/10",
  },
  {
    title: "Content",
    description:
      "Strukturierte Inhalte nach Content-Modell bearbeiten und veröffentlichen.",
    to: `${CMS_ROOT}/entries`,
    icon: Box,
    stat: "Noch keine API",
    tone: "from-brand-500/20 to-accent-mint/15",
  },
  {
    title: "Medien",
    description: "Assets zentral verwalten und in Content einbinden.",
    to: `${CMS_ROOT}/media`,
    icon: ImageIcon,
    stat: "Bibliothek",
    tone: "from-accent-mint/20 to-brand-500/15",
  },
];

export default function CmsOverviewPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-10">
        <h1 className="font-display text-[28px] font-semibold tracking-tighter2 text-ink-900 sm:text-[32px]">
          Content Management
        </h1>
        <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-ink-500">
          Dies ist die Oberfläche für strukturierte Inhalte: Spaces,
          Content-Modelle, Einträge und Medien — orientiert an Headless-CMS
          wie Contentful. Anbindung an Datenhaltung und API kommt als
          nächster Schritt.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Link
              key={c.title}
              to={c.to}
              className="group relative overflow-hidden rounded-2xl border border-hair bg-white p-5 shadow-[0_20px_50px_-38px_rgba(13,13,15,0.45)] transition hover:-translate-y-0.5 hover:border-ink-200"
            >
              <div
                aria-hidden
                className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${c.tone}`}
              />
              <div className="flex items-start justify-between gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ink-900 text-white">
                  <Icon className="h-5 w-5" />
                </div>
                <span className="rounded-full border border-hair bg-ink-50/80 px-2 py-0.5 text-[10.5px] font-medium text-ink-600">
                  {c.stat}
                </span>
              </div>
              <h2 className="mt-4 font-display text-lg font-semibold tracking-tight text-ink-900">
                {c.title}
              </h2>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-500">
                {c.description}
              </p>
              <span className="mt-4 inline-flex items-center gap-1 text-[12.5px] font-semibold text-ink-800">
                Öffnen
                <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
              </span>
            </Link>
          );
        })}
      </div>

      <section className="mt-12 rounded-2xl border border-dashed border-hair bg-white/60 p-6">
        <h3 className="text-[13px] font-semibold text-ink-800">
          Nächste Ausbaustufe
        </h3>
        <ul className="mt-3 list-inside list-disc space-y-1.5 text-[13px] text-ink-500">
          <li>D1 / API für Spaces, Modelle und Einträge</li>
          <li>Entwurf / Veröffentlichung und Verlauf</li>
          <li>Medien-Upload mit Referenzen in JSON-Feldern</li>
        </ul>
      </section>
    </div>
  );
}
