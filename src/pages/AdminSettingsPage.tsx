import {
  ArrowLeft,
  Loader2,
  LogOut,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Logo } from "../components/brand/Logo";
import SplitView from "../components/layout/SplitView";
import AdminStructuredConfigEditor from "../components/admin/AdminStructuredConfigEditor";
import { useAuth } from "../lib/auth";
import {
  adminInitialDraft,
  adminSerializeForPut,
  hasStructuredAdminEditor,
} from "../lib/adminSettingsFormModel";
import {
  ADMIN_SETTINGS_LABELS,
  type AdminSettingRow,
  configToAdminEditorText,
  fetchAdminSettings,
  putAdminSetting,
  sortAdminSettingRows,
} from "../lib/adminSettingsApi";

const NEW_KEY_RE = /^[a-zA-Z0-9_-]{1,100}$/;

export default function AdminSettingsPage() {
  const { user, logout } = useAuth();
  const [rows, setRows] = useState<AdminSettingRow[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** Nur für bekannte strukturierte Keys; sonst undefined. */
  const [structuredDraft, setStructuredDraft] = useState<unknown>(undefined);
  const [fallbackJsonText, setFallbackJsonText] = useState("");
  const [description, setDescription] = useState("");
  const [hydratedKey, setHydratedKey] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [savedPing, setSavedPing] = useState(false);
  const [parseErr, setParseErr] = useState<string | null>(null);

  const [newKey, setNewKey] = useState("");
  const [newKeyErr, setNewKeyErr] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setLoadErr(null);
    try {
      const data = await fetchAdminSettings();
      const sorted = sortAdminSettingRows(data.rows ?? []);
      setRows(sorted);
      setHydratedKey(null);
    } catch (e) {
      setRows(null);
      setLoadErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const filteredRows = useMemo(() => {
    if (!rows) return [];
    const t = q.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter(
      (r) =>
        r.id.toLowerCase().includes(t) ||
        (r.description && r.description.toLowerCase().includes(t)),
    );
  }, [rows, q]);

  useEffect(() => {
    if (!rows || rows.length === 0) {
      setSelectedId(null);
      return;
    }
    if (selectedId && rows.some((r) => r.id === selectedId)) return;
    setSelectedId(rows[0]?.id ?? null);
  }, [rows, selectedId]);

  useEffect(() => {
    if (!selectedId || !rows) return;
    if (hydratedKey === selectedId) return;
    const row = rows.find((r) => r.id === selectedId);
    if (!row) return;
    setDescription(row.description ?? "");
    setParseErr(null);
    setSaveErr(null);
    if (hasStructuredAdminEditor(selectedId)) {
      setStructuredDraft(adminInitialDraft(selectedId, row.config));
      setFallbackJsonText("");
    } else {
      setFallbackJsonText(configToAdminEditorText(row.config));
      setStructuredDraft(undefined);
    }
    setHydratedKey(selectedId);
  }, [selectedId, rows, hydratedKey]);

  const onSave = useCallback(async () => {
    if (!selectedId) return;
    setSaveErr(null);
    setParseErr(null);
    let parsed: unknown;
    if (hasStructuredAdminEditor(selectedId)) {
      parsed = adminSerializeForPut(selectedId, structuredDraft);
    } else {
      try {
        parsed = JSON.parse(fallbackJsonText) as unknown;
      } catch {
        setParseErr("config ist kein gültiges JSON.");
        return;
      }
    }
    setSaving(true);
    try {
      await putAdminSetting({
        id: selectedId,
        config: parsed,
        description: description.trim() === "" ? null : description.trim(),
      });
      setSavedPing(true);
      window.setTimeout(() => setSavedPing(false), 1400);
      await reload();
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [selectedId, structuredDraft, fallbackJsonText, description, reload]);

  const onCreate = useCallback(async () => {
    const k = newKey.trim();
    if (!k || !NEW_KEY_RE.test(k)) {
      setNewKeyErr("1–100 Zeichen: Buchstaben, Ziffern, _ und -");
      return;
    }
    if (rows?.some((r) => r.id === k)) {
      setNewKeyErr("Dieser Key existiert bereits.");
      return;
    }
    setCreating(true);
    setNewKeyErr(null);
    try {
      await putAdminSetting({
        id: k,
        config: {},
        description: null,
      });
      setNewKey("");
      await reload();
      setHydratedKey(null);
      setSelectedId(k);
    } catch (er) {
      setNewKeyErr(er instanceof Error ? er.message : String(er));
    } finally {
      setCreating(false);
    }
  }, [newKey, rows, reload]);

  const aside = (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-hair p-3 pr-9">
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink-400">
          Settings ({rows?.length ?? "—"})
        </p>
        <div className="relative mt-2">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Suche …"
            className="w-full rounded-md border border-hair bg-white py-1.5 pl-8 pr-2 text-[12.5px] text-ink-800 placeholder:text-ink-400 focus:border-ink-400 focus:outline-none"
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading && !rows?.length ? (
          <div className="flex items-center gap-2 p-4 text-[12px] text-ink-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Lade …
          </div>
        ) : loadErr ? (
          <p className="border-l-2 border-accent-rose px-3 py-2 text-[12px] text-accent-rose">
            {loadErr}
          </p>
        ) : (
          <ul className="divide-y divide-hair">
            {filteredRows.map((r) => {
              const label = ADMIN_SETTINGS_LABELS[r.id];
              const active = r.id === selectedId;
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(r.id);
                      setHydratedKey(null);
                    }}
                    className={`flex w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left transition ${
                      active
                        ? "bg-ink-900/[0.06]"
                        : "hover:bg-night-900/[0.04]"
                    }`}
                  >
                    <span className="font-mono text-[12.5px] text-ink-900">
                      {r.id}
                    </span>
                    {label && (
                      <span className="text-[11px] text-ink-500">{label}</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <form
        className="shrink-0 border-t border-hair bg-ink-50/80 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          void onCreate();
        }}
      >
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink-400">
          Neuer Key
        </p>
        <div className="mt-2 flex gap-2">
          <input
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            placeholder="z. B. maintenance_mode"
            className="min-w-0 flex-1 rounded-md border border-hair bg-white px-2 py-1.5 font-mono text-[12px] text-ink-800 focus:border-ink-400 focus:outline-none"
          />
          <button
            type="submit"
            disabled={creating}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-hair bg-white px-2.5 py-1.5 text-[11px] font-medium text-ink-800 transition hover:bg-night-900/[0.04] disabled:opacity-50"
          >
            {creating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            Anlegen
          </button>
        </div>
        {newKeyErr && (
          <p className="mt-2 text-[11px] text-accent-rose">{newKeyErr}</p>
        )}
      </form>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink-900">
      <header className="shrink-0 border-b border-hair bg-paper">
        <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-[12px] text-ink-500 transition-colors hover:text-ink-900"
            >
              <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
              Plattform
            </Link>
            <span aria-hidden className="h-4 w-px shrink-0 bg-hair" />
            <Link to="/" className="inline-flex min-w-0 items-center gap-2">
              <Logo className="h-[15px] w-auto shrink-0 text-ink-900/80" />
              <span className="hidden truncate text-[11px] uppercase tracking-[0.18em] text-ink-400 sm:inline">
                Admin Settings
              </span>
            </Link>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => void reload()}
              className="inline-flex items-center gap-1.5 rounded-md border border-hair bg-white px-2.5 py-1.5 text-[11px] font-medium text-ink-700 transition hover:bg-night-900/[0.04]"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Aktualisieren</span>
            </button>
            {user && (
              <span className="hidden max-w-[120px] truncate text-[12px] text-ink-500 md:inline">
                {user.benutzername}
              </span>
            )}
            <button
              type="button"
              onClick={() => void logout()}
              className="inline-flex items-center gap-2 rounded-md border border-hair bg-white px-2.5 py-1.5 text-[12px] font-medium text-ink-800 transition-colors hover:bg-night-900/[0.04]"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Abmelden</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">
        <SplitView
          storageKey="ui.adminSettings.aside"
          asideLabel="Settings"
          asideWidthClass="md:w-[320px]"
          asideContent={aside}
          className="min-h-0 flex-1"
        >
          {selectedId ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-hair bg-white px-4 py-2.5">
                <div className="min-w-0">
                  <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-ink-400">
                    Einstellung
                  </p>
                  <p
                    className="mt-0.5 truncate font-mono text-[14px] text-ink-900"
                    title={selectedId}
                  >
                    {selectedId}
                  </p>
                  {ADMIN_SETTINGS_LABELS[selectedId] && (
                    <p className="mt-0.5 text-[12px] text-ink-500">
                      {ADMIN_SETTINGS_LABELS[selectedId]}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {savedPing && (
                    <span className="text-[11.5px] text-accent-mint">
                      Gespeichert.
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => void onSave()}
                    disabled={saving || loading}
                    className="btn-shine press rounded-md bg-ink-900 px-3 py-1.5 text-[12.5px] font-medium text-white shadow-[0_4px_16px_-6px_rgba(13,13,15,0.3)] transition-colors hover:bg-ink-800 disabled:opacity-50 disabled:shadow-none"
                  >
                    {saving ? "Speichere…" : "Speichern"}
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8">
                <div className="mx-auto max-w-3xl space-y-5">
                  {(saveErr || parseErr) && (
                    <p className="border-l-2 border-accent-rose px-3 py-2 text-[12.5px] text-accent-rose">
                      {parseErr || saveErr}
                    </p>
                  )}
                  <label className="block">
                    <span className="mb-1.5 block text-[10.5px] font-medium uppercase tracking-[0.12em] text-ink-400">
                      Beschreibung (description)
                    </span>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={2}
                      className="w-full rounded-md border border-hair bg-white px-2.5 py-2 text-[13px] text-ink-800 focus:border-ink-400 focus:outline-none"
                      placeholder="Kurznotiz, was dieser Eintrag steuert …"
                    />
                  </label>

                  {selectedId && hasStructuredAdminEditor(selectedId) ? (
                    hydratedKey === selectedId ? (
                      <AdminStructuredConfigEditor
                        settingId={selectedId}
                        draft={structuredDraft}
                        onDraftChange={setStructuredDraft}
                        disabled={saving || loading}
                      />
                    ) : (
                      <div className="flex items-center gap-2 py-12 text-[13px] text-ink-400">
                        <Loader2 className="h-4 w-4 animate-spin" /> Formular
                        wird geladen …
                      </div>
                    )
                  ) : (
                    <>
                      <label className="block">
                        <span className="mb-1.5 block text-[10.5px] font-medium uppercase tracking-[0.12em] text-ink-400">
                          config (JSON)
                        </span>
                        <textarea
                          value={fallbackJsonText}
                          onChange={(e) => {
                            setFallbackJsonText(e.target.value);
                            setParseErr(null);
                          }}
                          spellCheck={false}
                          className="min-h-[320px] w-full resize-y rounded-md border border-hair bg-ink-50/50 px-2.5 py-2 font-mono text-[12px] leading-relaxed text-ink-800 focus:border-ink-400 focus:outline-none"
                        />
                      </label>
                      <p className="text-[12px] leading-relaxed text-ink-500">
                        Für diesen Key gibt es kein Spezialformular — gültiges
                        JSON verwenden. Bekannte Keys mit UI:{" "}
                        <span className="font-mono text-ink-600">
                          controll_buttons, preview_images,
                          active_controll_mode, generation_views,
                          google_image_search, first_views, image_ai,
                          inside_views
                        </span>
                        .
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-12">
              <div className="max-w-md text-center">
                <p className="text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-400">
                  Admin · Konfiguration
                </p>
                <h2 className="mt-2 font-display text-[22px] tracking-tightish text-ink-900">
                  Wähle eine Einstellung links
                </h2>
                <p className="mt-3 text-[13px] leading-relaxed text-ink-500">
                  Tabelle <span className="font-mono">settings</span> im D1-Binding{" "}
                  <span className="font-mono">configs</span>. Zugriff nur mit
                  freigegebenem Pfad{" "}
                  <span className="font-mono text-ink-700">/admin-settings</span>{" "}
                  in der Sicherheitsstufe.
                </p>
              </div>
            </div>
          )}
        </SplitView>
      </div>
    </div>
  );
}
