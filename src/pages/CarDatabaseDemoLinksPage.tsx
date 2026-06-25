import { useEffect, useState } from "react";
import { Check, Copy, Link2, Sparkles, Trash2 } from "lucide-react";
import {
  STANDARD_FEATURED,
  STANDARD_SHOWROOM,
  DEMO_LINK_COLOR_CHOICES,
} from "../lib/demoCars";
import {
  createDemoLink,
  demoLinkUrl,
  listDemoLinks,
  revokeDemoLink,
  type DemoLinkListItem,
} from "../lib/demoLinksApi";

const COLOR_HEX: Record<string, string> = {
  white: "#e9ebee",
  black: "#1b1b1d",
  blue: "#1d4ed8",
  orange: "#ea580c",
  wine_red: "#7c2d3a",
};

function fmtDate(unix: number): string {
  if (!unix) return "–";
  try {
    return new Intl.DateTimeFormat("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(unix * 1000));
  } catch {
    return "–";
  }
}

const STANDARD_CAR_COUNT = STANDARD_FEATURED.length + STANDARD_SHOWROOM.length;

export default function CarDatabaseDemoLinksPage() {
  const [name, setName] = useState("");
  const [days, setDays] = useState(7);
  const [colors, setColors] = useState<string[]>(["white", "black"]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justCreated, setJustCreated] = useState<string | null>(null);

  const [links, setLinks] = useState<DemoLinkListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    listDemoLinks()
      .then((l) => setLinks(l))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const toggleColor = (c: string) =>
    setColors((cur) =>
      cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c],
    );

  const copy = async (token: string) => {
    try {
      await navigator.clipboard.writeText(demoLinkUrl(token));
      setCopied(token);
      window.setTimeout(() => setCopied((t) => (t === token ? null : t)), 1800);
    } catch {
      /* Clipboard nicht verfügbar → ignorieren */
    }
  };

  const handleCreate = async () => {
    setError(null);
    if (!colors.length) {
      setError("Bitte mindestens eine Farbe auswählen.");
      return;
    }
    setCreating(true);
    try {
      const link = await createDemoLink({
        name: name.trim(),
        allowedColors: colors,
        featured: STANDARD_FEATURED,
        showroom: STANDARD_SHOWROOM,
        expiresInDays: days,
      });
      setJustCreated(link.token);
      setName("");
      await copy(link.token);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (token: string) => {
    try {
      await revokeDemoLink(token);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div>
      <div className="mb-5">
        <h1 className="font-display text-[22px] font-semibold tracking-tight text-ink-900">
          Demo-Links
        </h1>
        <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-ink-500">
          Erzeuge einen versendbaren Link, mit dem ein Kunde die Demo selbst
          testet — ohne Login. Du legst fest, welche Farben er sieht und wie
          lange der Link gültig ist. Die Fahrzeuge sind der aktuelle Standard-Satz
          ({STANDARD_CAR_COUNT}); eine Katalog-Suche gibt es im Kunden-Link
          nicht.
        </p>
      </div>

      {/* Erstellen */}
      <div className="rounded-2xl border border-hair bg-white p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-2 text-[13px] font-semibold text-ink-900">
          <Sparkles className="h-4 w-4 text-brand-600" />
          Neuen Demo-Link erstellen
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Name */}
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-ink-400">
              Name / Kunde (optional)
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z. B. Autohaus Müller"
              className="w-full rounded-lg border border-hair bg-white px-3 py-2 text-[13px] text-ink-900 outline-none focus:border-ink-400"
            />
          </label>

          {/* Gültigkeit */}
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-ink-400">
              Gültigkeit (Tage)
            </span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={365}
                value={days}
                onChange={(e) =>
                  setDays(
                    Math.min(365, Math.max(1, Number(e.target.value) || 1)),
                  )
                }
                className="w-24 rounded-lg border border-hair bg-white px-3 py-2 text-[13px] text-ink-900 outline-none focus:border-ink-400"
              />
              <div className="flex gap-1">
                {[7, 14, 30].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDays(d)}
                    className={`rounded-md px-2.5 py-1 text-[12px] font-medium transition ${
                      days === d
                        ? "bg-ink-900 text-white"
                        : "border border-hair text-ink-500 hover:text-ink-900"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </label>
        </div>

        {/* Farben */}
        <div className="mt-4">
          <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-ink-400">
            Erlaubte Farben
          </span>
          <div className="flex flex-wrap gap-2">
            {DEMO_LINK_COLOR_CHOICES.map((c) => {
              const active = colors.includes(c.value);
              return (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => toggleColor(c.value)}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-medium transition ${
                    active
                      ? "border-ink-900 bg-ink-900 text-white"
                      : "border-ink-200 bg-white text-ink-600 hover:bg-ink-50"
                  }`}
                >
                  <span
                    className="h-3.5 w-3.5 rounded-full border border-black/10"
                    style={{ backgroundColor: COLOR_HEX[c.value] }}
                  />
                  {c.label}
                  {active && <Check className="h-3.5 w-3.5" />}
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700">
            {error}
          </div>
        )}

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating || !colors.length}
            className="inline-flex items-center gap-1.5 rounded-lg bg-ink-900 px-4 py-2 text-[13px] font-medium text-white transition hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Link2 className="h-4 w-4" />
            {creating ? "Erstelle …" : "Demo-Link erstellen"}
          </button>
          {justCreated && (
            <span className="text-[12px] text-emerald-600">
              Link erstellt &amp; in die Zwischenablage kopiert.
            </span>
          )}
        </div>
      </div>

      {/* Liste */}
      <div className="mt-7">
        <div className="mb-2 text-[13px] font-semibold text-ink-900">
          Erstellte Links
        </div>
        {loading ? (
          <div className="rounded-xl border border-hair bg-white px-4 py-8 text-center text-[13px] text-ink-400">
            Lädt …
          </div>
        ) : links.length === 0 ? (
          <div className="rounded-xl border border-hair bg-white px-4 py-8 text-center text-[13px] text-ink-400">
            Noch keine Demo-Links erstellt.
          </div>
        ) : (
          <div className="space-y-2">
            {links.map((l) => {
              const inactive = l.status !== "active" || l.expired;
              return (
                <div
                  key={l.token}
                  className={`flex flex-wrap items-center gap-3 rounded-xl border bg-white px-4 py-3 ${
                    inactive ? "border-hair opacity-70" : "border-hair"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[13px] font-medium text-ink-900">
                        {l.name || "Ohne Namen"}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                          l.status === "revoked"
                            ? "bg-rose-100 text-rose-700"
                            : l.expired
                              ? "bg-amber-100 text-amber-700"
                              : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {l.status === "revoked"
                          ? "Gesperrt"
                          : l.expired
                            ? "Abgelaufen"
                            : "Aktiv"}
                      </span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-ink-500">
                      <span>Bis {fmtDate(l.expiresAt)}</span>
                      <span className="inline-flex items-center gap-1">
                        Farben:
                        {l.allowedColors.map((c) => (
                          <span
                            key={c}
                            title={c}
                            className="inline-block h-3 w-3 rounded-full border border-black/10"
                            style={{ backgroundColor: COLOR_HEX[c] || "#bbb" }}
                          />
                        ))}
                      </span>
                      <span>Abrufe heute: {l.hitsToday}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => copy(l.token)}
                      disabled={inactive}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-hair bg-white px-3 py-1.5 text-[12px] font-medium text-ink-700 transition hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-40"
                      title="Link kopieren"
                    >
                      {copied === l.token ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                          Kopiert
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          Link kopieren
                        </>
                      )}
                    </button>
                    {l.status === "active" && (
                      <button
                        type="button"
                        onClick={() => handleRevoke(l.token)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-hair bg-white px-2.5 py-1.5 text-[12px] font-medium text-rose-600 transition hover:bg-rose-50"
                        title="Link sperren"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Sperren
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
