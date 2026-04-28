import { Plus, RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import PromptFieldWithPlaceholders from "../components/prompts/PromptFieldWithPlaceholders";
import PageHeader from "../components/ui/PageHeader";
import { useJsonApi } from "../lib/billingApi";
import {
  defaultSystemPrompt,
  parsePromptValue,
  promptsUrlOne,
  putSystemPrompt,
  SYSTEM_PROMPTS_URL,
  type PromptsListResponse,
  type PromptOneResponse,
  type SystemPromptValue,
} from "../lib/promptsApi";
import { analyzePromptJsonSafety } from "../lib/promptJsonSafety";

export default function SystemePromptsPage() {
  const list = useJsonApi<PromptsListResponse>(SYSTEM_PROMPTS_URL);

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const one = useJsonApi<PromptOneResponse>(
    selectedKey ? promptsUrlOne(selectedKey) : null,
  );

  const [q, setQ] = useState("");
  const [form, setForm] = useState<SystemPromptValue>(() => defaultSystemPrompt());
  const [newKey, setNewKey] = useState("");
  const [newKeyError, setNewKeyError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const promptJsonSafety = useMemo(
    () => analyzePromptJsonSafety(form.prompt),
    [form.prompt],
  );

  const keys = list.data?.keys ?? [];
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return keys;
    return keys.filter((k) => k.toLowerCase().includes(t));
  }, [keys, q]);

  useEffect(() => {
    setForm(defaultSystemPrompt());
  }, [selectedKey]);

  useEffect(() => {
    if (!one.data || one.data.key !== selectedKey) return;
    setForm(parsePromptValue(one.data.value));
    setSaveErr(null);
  }, [selectedKey, one.data]);

  const reloadAll = useCallback(() => {
    list.reload();
    if (selectedKey) one.reload();
  }, [list, selectedKey, one]);

  const onSave = async () => {
    if (!selectedKey) return;
    setSaving(true);
    setSaveErr(null);
    try {
      await putSystemPrompt(selectedKey, form);
      list.reload();
      one.reload();
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Systeme"
        title="Prompts"
        hideCalendarAndNotifications
        description={
          <>
            KV{" "}
            <span className="font-mono text-[12.5px] text-ink-700">prompts</span>
            : Ansichten (z.&nbsp;B. <span className="font-mono">front_right</span>)
            mit Prompt, Format und Optionen. Links suchen und auswählen, rechts
            bearbeiten.
          </>
        }
        rightSlot={
          <button
            type="button"
            onClick={reloadAll}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-hair bg-white text-ink-500 transition-colors hover:border-ink-300 hover:text-ink-800"
            title="Aktualisieren"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${list.loading || one.loading ? "animate-spin" : ""}`}
            />
          </button>
        }
      />

      {list.error && (
        <p className="mb-6 border-l-2 border-accent-rose px-3 py-2 text-[12.5px] text-accent-rose">
          {list.error}
        </p>
      )}

      {list.loading && !list.data ? (
        <p className="py-12 text-center text-[12.5px] text-ink-400">Lade …</p>
      ) : (
        <div className="grid gap-10 border-t border-hair pt-10 lg:grid-cols-12 lg:gap-0">
          <aside className="lg:col-span-3 lg:border-r lg:border-hair lg:pr-8">
            <div className="mb-3 flex items-baseline justify-between">
              <p className="text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-400">
                Ansichten
              </p>
              <span className="text-[11px] tabular-nums text-ink-400">
                {filtered.length}
                {q.trim() ? ` / ${keys.length}` : ""}
              </span>
            </div>
            <div className="relative mb-3">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Key suchen …"
                className="w-full rounded-md border border-hair bg-white py-1.5 pl-8 pr-3 text-[12.5px] text-ink-800 placeholder:text-ink-400 focus:border-ink-400 focus:outline-none"
              />
            </div>
            {filtered.length === 0 ? (
              <p className="border border-dashed border-hair px-3 py-6 text-center text-[12px] text-ink-500">
                {keys.length === 0
                  ? "Noch keine Einträge — unten neu anlegen."
                  : "Keine Treffer für die Suche."}
              </p>
            ) : (
              <ul className="divide-y divide-hair border-y border-hair max-h-[min(24rem,55vh)] overflow-y-auto">
                {filtered.map((k) => {
                  const active = selectedKey === k;
                  return (
                    <li key={k}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedKey(k);
                          setNewKeyError(null);
                        }}
                        className={`group flex w-full items-center justify-between px-2 py-2 text-left font-mono text-[12px] transition-colors ${
                          active
                            ? "bg-ink-50 text-ink-900"
                            : "text-ink-600 hover:bg-ink-50/60 hover:text-ink-900"
                        }`}
                      >
                        <span className="truncate">{k}</span>
                        {active && (
                          <span className="ml-2 h-1.5 w-1.5 shrink-0 bg-ink-900" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            <form
              className="mt-5"
              onSubmit={async (e) => {
                e.preventDefault();
                const k = newKey.trim();
                if (!k) return;
                setSaving(true);
                setNewKeyError(null);
                try {
                  await putSystemPrompt(k, defaultSystemPrompt());
                  setNewKey("");
                  list.reload();
                  setSelectedKey(k);
                } catch (er) {
                  setNewKeyError(
                    er instanceof Error ? er.message : String(er),
                  );
                } finally {
                  setSaving(false);
                }
              }}
            >
              <p className="mb-2 text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-400">
                Neue Ansicht
              </p>
              <div className="flex items-center gap-2">
                <input
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  placeholder="z.B. front_right"
                  className="min-w-0 flex-1 border-b border-hair bg-transparent py-1.5 font-mono text-[12px] text-ink-800 outline-none placeholder:text-ink-400 focus:border-ink-700"
                />
                <button
                  type="submit"
                  disabled={saving || !newKey.trim()}
                  className="inline-flex items-center gap-1 rounded-md border border-hair bg-white px-2.5 py-1.5 text-[12px] text-ink-700 hover:border-ink-300 hover:text-ink-900 disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Anlegen
                </button>
              </div>
              {newKeyError && (
                <p className="mt-2 border-l-2 border-accent-rose px-3 py-1.5 text-[12px] text-accent-rose">
                  {newKeyError}
                </p>
              )}
            </form>
          </aside>

          <div className="lg:col-span-9 lg:pl-10">
            {selectedKey ? (
              <>
                <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3 border-b border-hair pb-4">
                  <div className="min-w-0">
                    <p className="text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-400">
                      Bearbeiten
                    </p>
                    <p
                      className="mt-1 truncate font-mono text-[16px] text-ink-900"
                      title={selectedKey}
                    >
                      {selectedKey}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onSave}
                    disabled={saving || one.loading}
                    className="rounded-md border border-hair bg-white px-3 py-1.5 text-[12.5px] font-medium text-ink-800 transition-colors hover:border-ink-300 disabled:opacity-50"
                  >
                    {saving ? "Speichern …" : "Speichern"}
                  </button>
                </div>

                {one.loading && !one.data ? (
                  <p className="text-[12.5px] text-ink-400">Lade Eintrag …</p>
                ) : one.error ? (
                  <p className="border-l-2 border-accent-rose px-3 py-2 text-[12.5px] text-accent-rose">
                    {one.error}
                  </p>
                ) : (
                  <div className="space-y-5 max-w-3xl">
                    {saveErr && (
                      <p className="border-l-2 border-accent-rose px-3 py-2 text-[12.5px] text-accent-rose">
                        {saveErr}
                      </p>
                    )}
                    <div className="block">
                      <span className="mb-1.5 block text-[10.5px] font-medium uppercase tracking-[0.12em] text-ink-400">
                        Prompt
                      </span>
                      <p className="mb-2 text-[12px] text-ink-500">
                        Ein großes Textfeld. Die fünf Variablen in der
                        Seitenleiste: Klick fügt{" "}
                        <span className="font-mono text-ink-600">
                          {`{{name}}`}-Platzhalter
                        </span>{" "}
                        an der Cursor-Position bzw. ersetzt die Markierung
                        (Auswahl) im Text.
                      </p>
                      <div className="rounded-md border border-hair bg-paper/60 p-3">
                        <PromptFieldWithPlaceholders
                          value={form.prompt}
                          onChange={(v) => setForm((f) => ({ ...f, prompt: v }))}
                          className="w-full"
                          promptJsonSafety={promptJsonSafety}
                        />
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <label className="block sm:col-span-1">
                        <span className="mb-1.5 block text-[10.5px] font-medium uppercase tracking-[0.12em] text-ink-400">
                          Seitenverhältnis
                        </span>
                        <input
                          value={form.aspect_ratio}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, aspect_ratio: e.target.value }))
                          }
                          className="w-full rounded-md border border-hair bg-white px-2.5 py-1.5 font-mono text-[12.5px] text-ink-800 focus:border-ink-400 focus:outline-none"
                        />
                      </label>
                      <label className="block sm:col-span-1">
                        <span className="mb-1.5 block text-[10.5px] font-medium uppercase tracking-[0.12em] text-ink-400">
                          Output-Format
                        </span>
                        <input
                          value={form.output_format}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, output_format: e.target.value }))
                          }
                          className="w-full rounded-md border border-hair bg-white px-2.5 py-1.5 font-mono text-[12.5px] text-ink-800 focus:border-ink-400 focus:outline-none"
                        />
                      </label>
                      <label className="block sm:col-span-1">
                        <span className="mb-1.5 block text-[10.5px] font-medium uppercase tracking-[0.12em] text-ink-400">
                          Auflösung
                        </span>
                        <input
                          value={form.resolution}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, resolution: e.target.value }))
                          }
                          className="w-full rounded-md border border-hair bg-white px-2.5 py-1.5 font-mono text-[12.5px] text-ink-800 focus:border-ink-400 focus:outline-none"
                        />
                      </label>
                    </div>
                    <div className="flex flex-wrap gap-6">
                      <label className="inline-flex cursor-pointer items-center gap-2.5 text-[13px] text-ink-800">
                        <input
                          type="checkbox"
                          checked={form.google_search}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, google_search: e.target.checked }))
                          }
                          className="h-3.5 w-3.5 rounded border-hair text-brand-600 focus:ring-brand-500"
                        />
                        Google-Suche
                      </label>
                      <label className="inline-flex cursor-pointer items-center gap-2.5 text-[13px] text-ink-800">
                        <input
                          type="checkbox"
                          checked={form.image_search}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, image_search: e.target.checked }))
                          }
                          className="h-3.5 w-3.5 rounded border-hair text-brand-600 focus:ring-brand-500"
                        />
                        Bildsuche
                      </label>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex h-full min-h-[240px] flex-col items-start justify-center border border-dashed border-hair px-6 py-10">
                <p className="text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-400">
                  Keine Ansicht ausgewählt
                </p>
                <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-ink-500">
                  Suche und wähle links einen Key, oder lege unten eine neue
                  Ansicht an, um den Prompt zu bearbeiten.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
