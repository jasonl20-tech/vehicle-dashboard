import { Check, Pencil, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "../components/ui/PageHeader";
import { useJsonApi } from "../lib/billingApi";
import {
  asStr,
  deleteMappingRow,
  mappingListUrl,
  MAPPING_TABLE_OPTIONS,
  postMappingRow,
  putMappingRow,
  type MappingListResponse,
  type MappingTableId,
} from "../lib/mappingApi";

const TEXT_IN =
  "w-full rounded border border-hair bg-white px-2 py-1.5 text-[12.5px] text-ink-800 focus:border-ink-400 focus:outline-none";
const TH =
  "px-2 py-2 text-left text-[10px] font-medium uppercase tracking-[0.1em] text-ink-400";
const TD = "px-2 py-2 align-top text-[12.5px] text-ink-800";

export default function SystemeMappingPage() {
  const [table, setTable] = useState<MappingTableId>("manufacture_mapping");
  const [qIn, setQIn] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setQ(qIn), 400);
    return () => clearTimeout(t);
  }, [qIn]);

  const listUrl = useMemo(
    () => mappingListUrl(table, { q, limit: 200, offset: 0 }),
    [table, q],
  );
  const api = useJsonApi<MappingListResponse>(listUrl);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [edit, setEdit] = useState<Record<string, string>>({});
  const [add, setAdd] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setEditingId(null);
    setEdit({});
    setAdd({ name: "", alias: "", manufacture: "", model: "" });
  }, [table]);

  const reload = useCallback(() => api.reload(), [api]);
  const label = MAPPING_TABLE_OPTIONS.find((o) => o.id === table)?.label ?? table;

  const startEdit = (r: Record<string, unknown>) => {
    setEditingId(Number(r.id));
    setEdit({
      name: asStr(r.name),
      alias: asStr(r.alias),
      manufacture: asStr(r.manufacture),
      model: asStr(r.model),
    });
    setErr(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEdit({});
  };

  const saveEdit = async () => {
    if (editingId == null) return;
    setBusy(true);
    setErr(null);
    try {
      let row: Record<string, unknown>;
      if (table === "manufacture_mapping") {
        row = { name: edit.name, alias: edit.alias };
      } else {
        row = {
          name: edit.name,
          alias: edit.alias,
          manufacture: edit.manufacture.trim() || null,
        };
        if (table === "body_mapping" || table === "trim_mapping") {
          row.model = edit.model.trim() || null;
        }
      }
      await putMappingRow(table, editingId, row);
      cancelEdit();
      reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (id: number) => {
    if (!window.confirm("Diesen Eintrag wirklich löschen?")) return;
    setBusy(true);
    setErr(null);
    try {
      await deleteMappingRow(table, id);
      if (editingId === id) cancelEdit();
      reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const saveNew = async () => {
    setBusy(true);
    setErr(null);
    try {
      let row: Record<string, unknown>;
      if (table === "manufacture_mapping") {
        row = { name: add.name, alias: add.alias };
      } else {
        row = {
          name: add.name,
          alias: add.alias,
          manufacture: add.manufacture?.trim() || null,
        };
        if (table === "body_mapping" || table === "trim_mapping") {
          row.model = add.model?.trim() || null;
        }
      }
      await postMappingRow(table, row);
      setAdd({ name: "", alias: "", manufacture: "", model: "" });
      reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Systeme"
        title="Mapping"
        hideCalendarAndNotifications
        description={
          <>
            D1{" "}
            <span className="font-mono text-[12.5px] text-ink-700">mapping</span>
            : Dubletten / Aliase (Hersteller, Modell, Farbe, Karosserie, Trim).{" "}
            Suche, bearbeiten, anlegen, löschen.
          </>
        }
        rightSlot={
          <button
            type="button"
            onClick={reload}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-hair bg-white text-ink-500 transition-colors hover:border-ink-300 hover:text-ink-800"
            title="Aktualisieren"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${api.loading ? "animate-spin" : ""}`}
            />
          </button>
        }
      />

      {api.error && (
        <p className="mb-4 border-l-2 border-accent-rose px-3 py-2 text-[12.5px] text-accent-rose">
          {api.error}
        </p>
      )}
      {err && (
        <p className="mb-4 border-l-2 border-accent-amber px-3 py-2 text-[12.5px] text-ink-800">
          {err}
        </p>
      )}

      <div className="mb-6 flex flex-wrap gap-1.5">
        {MAPPING_TABLE_OPTIONS.map((o) => {
          const active = o.id === table;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => setTable(o.id)}
              className={`rounded-md border px-3 py-1.5 text-[12.5px] transition-colors ${
                active
                  ? "border-ink-400 bg-ink-50 text-ink-900"
                  : "border-hair bg-white text-ink-600 hover:border-ink-300"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>

      <div className="mb-4 flex max-w-md flex-col gap-2 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label className="mb-1 block text-[10px] font-medium uppercase tracking-[0.1em] text-ink-400">
            Suche
          </label>
          <input
            value={qIn}
            onChange={(e) => setQIn(e.target.value)}
            placeholder="In Namen, Alias, Hersteller, Modell …"
            className={TEXT_IN}
          />
        </div>
        <p className="text-[11px] text-ink-400">
          {api.data != null
            ? `${api.data.total} Zeilen · ${label}`
            : "…"}
        </p>
      </div>

      {api.loading && !api.data ? (
        <p className="py-8 text-center text-[12.5px] text-ink-400">Lade …</p>
      ) : (
        <div className="space-y-8">
          <div className="overflow-x-auto border border-hair">
            <table className="min-w-full text-left">
              <thead className="border-b border-hair bg-paper/80">
                <tr>
                  <th className={TH}>id</th>
                  {table !== "manufacture_mapping" && <th className={TH}>Herst.</th>}
                  {(table === "body_mapping" || table === "trim_mapping") && (
                    <th className={TH}>Modell</th>
                  )}
                  <th className={TH}>name</th>
                  <th className={TH}>alias</th>
                  <th className={`${TH} w-[1%] whitespace-nowrap`}>Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hair/90">
                {(api.data?.rows ?? []).map((r) => {
                  const id = Number(r.id);
                  const isEd = editingId === id;
                  return (
                    <tr key={id} className="hover:bg-ink-50/40">
                      <td className={`${TD} font-mono text-ink-500`}>{id}</td>
                      {table !== "manufacture_mapping" && (
                        <td className={TD}>
                          {isEd ? (
                            <input
                              className={TEXT_IN}
                              value={edit.manufacture}
                              onChange={(e) =>
                                setEdit((d) => ({ ...d, manufacture: e.target.value }))
                              }
                            />
                          ) : (
                            asStr(r.manufacture) || "—"
                          )}
                        </td>
                      )}
                      {(table === "body_mapping" || table === "trim_mapping") && (
                        <td className={TD}>
                          {isEd ? (
                            <input
                              className={TEXT_IN}
                              value={edit.model}
                              onChange={(e) =>
                                setEdit((d) => ({ ...d, model: e.target.value }))
                              }
                            />
                          ) : (
                            asStr(r.model) || "—"
                          )}
                        </td>
                      )}
                      <td className={TD}>
                        {isEd ? (
                          <input
                            className={TEXT_IN}
                            value={edit.name}
                            onChange={(e) =>
                              setEdit((d) => ({ ...d, name: e.target.value }))
                            }
                          />
                        ) : (
                          asStr(r.name)
                        )}
                      </td>
                      <td className={TD}>
                        {isEd ? (
                          <input
                            className={TEXT_IN}
                            value={edit.alias}
                            onChange={(e) =>
                              setEdit((d) => ({ ...d, alias: e.target.value }))
                            }
                          />
                        ) : (
                          asStr(r.alias)
                        )}
                      </td>
                      <td className={TD}>
                        <div className="flex flex-nowrap items-center gap-0.5">
                          {isEd ? (
                            <>
                              <button
                                type="button"
                                onClick={saveEdit}
                                disabled={busy}
                                className="rounded p-1.5 text-ink-600 hover:bg-ink-100"
                                title="Speichern"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={cancelEdit}
                                className="rounded p-1.5 text-ink-500 hover:bg-ink-100"
                                title="Abbrechen"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => startEdit(r)}
                                disabled={busy}
                                className="rounded p-1.5 text-ink-500 hover:text-ink-900"
                                title="Bearbeiten"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onDelete(id)}
                                disabled={busy}
                                className="rounded p-1.5 text-ink-500 hover:text-accent-rose"
                                title="Löschen"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {(api.data?.rows.length ?? 0) === 0 && (
              <p className="px-3 py-8 text-center text-[12.5px] text-ink-500">
                Keine Zeilen. Unten neu anlegen.
              </p>
            )}
          </div>

          <section>
            <h2 className="mb-2 text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-400">
              Neuer Eintrag
            </h2>
            <div className="grid gap-2 rounded-md border border-dashed border-hair bg-paper/40 p-3 sm:grid-cols-2 lg:max-w-4xl">
              {table !== "manufacture_mapping" && (
                <div>
                  <span className="mb-0.5 block text-[10px] text-ink-400">Hersteller</span>
                  <input
                    className={TEXT_IN}
                    value={add.manufacture ?? ""}
                    onChange={(e) => setAdd((a) => ({ ...a, manufacture: e.target.value }))}
                    placeholder="optional"
                  />
                </div>
              )}
              {(table === "body_mapping" || table === "trim_mapping") && (
                <div>
                  <span className="mb-0.5 block text-[10px] text-ink-400">Modell</span>
                  <input
                    className={TEXT_IN}
                    value={add.model ?? ""}
                    onChange={(e) => setAdd((a) => ({ ...a, model: e.target.value }))}
                    placeholder="optional"
                  />
                </div>
              )}
              <div>
                <span className="mb-0.5 block text-[10px] text-ink-400">name *</span>
                <input
                  className={TEXT_IN}
                  value={add.name}
                  onChange={(e) => setAdd((a) => ({ ...a, name: e.target.value }))}
                />
              </div>
              <div>
                <span className="mb-0.5 block text-[10px] text-ink-400">alias *</span>
                <input
                  className={TEXT_IN}
                  value={add.alias}
                  onChange={(e) => setAdd((a) => ({ ...a, alias: e.target.value }))}
                />
              </div>
              <div className="sm:col-span-2">
                <button
                  type="button"
                  onClick={saveNew}
                  disabled={busy || !add.name?.trim() || !add.alias?.trim()}
                  className="inline-flex items-center gap-1.5 rounded-md border border-hair bg-white px-3 py-2 text-[12.5px] text-ink-800 hover:border-ink-300 disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Anlegen
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
