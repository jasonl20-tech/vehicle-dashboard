import { Loader2, Plus, RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import PromptFieldWithPlaceholders from "../components/prompts/PromptFieldWithPlaceholders";
import SplitView from "../components/layout/SplitView";
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
  const [form, setForm] = useState<SystemPromptValue>(() =>
    defaultSystemPrompt(),
  );
  const [newKey, setNewKey] = useState("");
  const [newKeyError, setNewKeyError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [savedPing, setSavedPing] = useState(false);

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

  const onSave = useCallback(async () => {
    if (!selectedKey) return;
    setSaving(true);
    setSaveErr(null);
    try {
      await putSystemPrompt(selectedKey, form);
      setSavedPing(true);
      window.setTimeout(() => setSavedPing(false), 1600);
      list.reload();
      one.reload();
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [selectedKey, form, list, one]);

  const onCreate = useCallback(async () => {
    const k = newKey.trim();
    if (!k) return;
    setCreating(true);
    setNewKeyError(null);
    try {
      await putSystemPrompt(k, defaultSystemPrompt());
      setNewKey("");
      list.reload();
      setSelectedKey(k);
    } catch (er) {
      setNewKeyError(er instanceof Error ? er.message : String(er));
    } finally {
      setCreating(false);
    }
  }, [newKey, list]);

  const aside = (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-hair p-3 pr-9">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-500">
            Prompts
          </p>
          <button
            type="button"
            onClick={reloadAll}
            title="Aktualisieren"
            aria-label="Aktualisieren"
            className="inline-flex h-6 w-6 items-center justify-center rounded text-ink-400 hover:bg-ink-100 hover:text-ink-700"
          >
            <RefreshCw
              className={`h-3 w-3 ${list.loading ? "animate-spin" : ""}`}
            />
          </button>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-hair bg-paper/60 px-2.5 py-1.5">
          <Search className="h-3.5 w-3.5 shrink-0 text-ink-400" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Key suchen…"
            className="min-w-0 flex-1 border-0 bg-transparent text-[12.5px] text-ink-900 placeholder:text-ink-400 focus:outline-none"
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] tabular-nums text-ink-500">
          <span>
            {filtered.length}
            {q.trim() ? ` / ${keys.length}` : ` Einträge`}
          </span>
          {list.loading && <Loader2 className="h-3 w-3 animate-spin" />}
        </div>
      </div>

      {list.error && (
        <p className="border-b border-accent-rose/50 bg-accent-rose/10 px-3 py-2 text-[11.5px] text-accent-rose">
          {list.error}
        </p>
      )}

      <ul className="min-h-0 flex-1 divide-y divide-hair overflow-y-auto">
        {!list.loading && filtered.length === 0 && (
          <li className="px-3 py-6 text-center text-[12.5px] text-ink-500">
            {keys.length === 0
              ? "Noch keine Einträge — unten anlegen."
              : "Keine Treffer."}
          </li>
        )}
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
                className={`flex w-full items-center justify-between px-3 py-2 text-left font-mono text-[12px] transition-colors ${
                  active
                    ? "bg-ink-100 text-ink-900"
                    : "text-ink-700 hover:bg-ink-50/70"
                }`}
              >
                <span className="truncate">{k}</span>
                {active && (
                  <span className="ml-2 h-1.5 w-1.5 shrink-0 rounded-full bg-ink-900" />
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <form
        className="shrink-0 border-t border-hair bg-paper/40 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          onCreate();
        }}
      >
        <p className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-ink-400">
          Neue Ansicht
        </p>
        <div className="flex items-center gap-2">
          <input
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            placeholder="z. B. front_right"
            className="min-w-0 flex-1 rounded border border-hair bg-white px-2 py-1 font-mono text-[11.5px] text-ink-800 placeholder:text-ink-400 focus:border-ink-400 focus:outline-none"
          />
          <button
            type="submit"
            disabled={creating || !newKey.trim()}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-hair bg-white px-2 py-1 text-[11.5px] text-ink-700 hover:border-ink-300 hover:text-ink-900 disabled:opacity-50"
          >
            <Plus className="h-3 w-3" />
            Anlegen
          </button>
        </div>
        {newKeyError && (
          <p className="mt-2 border-l-2 border-accent-rose px-2 py-1 text-[11.5px] text-accent-rose">
            {newKeyError}
          </p>
        )}
      </form>
    </div>
  );

  return (
    <SplitView
      storageKey="ui.systemePrompts.aside"
      asideLabel="Prompts"
      asideWidthClass="md:w-[300px]"
      asideContent={aside}
    >
      {selectedKey ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-hair bg-white px-4 py-2.5">
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-ink-400">
                Prompt
              </p>
              <p
                className="mt-0.5 truncate font-mono text-[14px] text-ink-900"
                title={selectedKey}
              >
                {selectedKey}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {savedPing && (
                <span className="text-[11.5px] text-accent-mint">
                  Gespeichert.
                </span>
              )}
              <button
                type="button"
                onClick={onSave}
                disabled={saving || one.loading}
                className="btn-shine press rounded-md bg-ink-900 px-3 py-1.5 text-[12.5px] font-medium text-white shadow-[0_4px_16px_-6px_rgba(13,13,15,0.3)] transition-colors hover:bg-ink-800 disabled:opacity-50 disabled:shadow-none"
              >
                {saving ? "Speichere…" : "Speichern"}
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8">
            {one.loading && !one.data ? (
              <p className="text-[12.5px] text-ink-400">Lade Eintrag …</p>
            ) : one.error ? (
              <p className="border-l-2 border-accent-rose px-3 py-2 text-[12.5px] text-accent-rose">
                {one.error}
              </p>
            ) : (
              <div className="mx-auto max-w-3xl space-y-5">
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
                    Klick auf einen Platzhalter fügt{" "}
                    <span className="font-mono text-ink-600">
                      {`{{name}}`}-Variablen
                    </span>{" "}
                    an der Cursor-Position bzw. ersetzt die Markierung.
                  </p>
                  <div className="rounded-md border border-hair bg-paper/60 p-3">
                    <PromptFieldWithPlaceholders
                      value={form.prompt}
                      onChange={(v) =>
                        setForm((f) => ({ ...f, prompt: v }))
                      }
                      className="w-full"
                      promptJsonSafety={promptJsonSafety}
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <label className="block">
                    <span className="mb-1.5 block text-[10.5px] font-medium uppercase tracking-[0.12em] text-ink-400">
                      Seitenverhältnis
                    </span>
                    <input
                      value={form.aspect_ratio}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          aspect_ratio: e.target.value,
                        }))
                      }
                      className="w-full rounded-md border border-hair bg-white px-2.5 py-1.5 font-mono text-[12.5px] text-ink-800 focus:border-ink-400 focus:outline-none"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-[10.5px] font-medium uppercase tracking-[0.12em] text-ink-400">
                      Output-Format
                    </span>
                    <input
                      value={form.output_format}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          output_format: e.target.value,
                        }))
                      }
                      className="w-full rounded-md border border-hair bg-white px-2.5 py-1.5 font-mono text-[12.5px] text-ink-800 focus:border-ink-400 focus:outline-none"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-[10.5px] font-medium uppercase tracking-[0.12em] text-ink-400">
                      Auflösung
                    </span>
                    <input
                      value={form.resolution}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          resolution: e.target.value,
                        }))
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
                        setForm((f) => ({
                          ...f,
                          google_search: e.target.checked,
                        }))
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
                        setForm((f) => ({
                          ...f,
                          image_search: e.target.checked,
                        }))
                      }
                      className="h-3.5 w-3.5 rounded border-hair text-brand-600 focus:ring-brand-500"
                    />
                    Bildsuche
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-12">
          <div className="max-w-md text-center">
            <p className="text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-400">
              Systeme · Prompts
            </p>
            <h2 className="mt-2 font-display text-[22px] tracking-tightish text-ink-900">
              Wähle einen Prompt links aus
            </h2>
            <p className="mt-3 text-[13px] leading-relaxed text-ink-500">
              Suche nach einem Key oder lege links unten eine neue Ansicht an.
              Jede Ansicht enthält Prompt, Format und Suchoptionen.
            </p>
          </div>
        </div>
      )}
    </SplitView>
  );
}
