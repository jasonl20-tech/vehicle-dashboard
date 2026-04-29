/**
 * AssetBrowser — wiederverwendbare Komponente für den Asset-Manager.
 *
 * Wird genutzt von:
 *   - `pages/AssetsPage.tsx`     (Standalone-Browser, alle Aktionen erlaubt)
 *   - `components/assets/AssetPicker.tsx` (Modal-Picker, nur Auswahl)
 *
 * Inhalt:
 *   - Folder-Tree (links): zeigt alle bekannten Ordner als Baum mit
 *     Direkt-Kind-Counts. Klick selektiert. Doppelklick öffnet.
 *   - Header (rechts oben): Breadcrumb-Pfad, Suche, Sort, Upload,
 *     "Neuer Ordner".
 *   - File-Grid (rechts): Karten mit Vorschau (Bilder), Datei-Icon
 *     (alles andere). Klick selektiert; je nach `mode` mit Detail-
 *     Panel oder Pick-Callback.
 *   - Drag-and-Drop: ganzer rechter Bereich akzeptiert Drop für Upload
 *     in den aktuellen Folder.
 *
 * Modi:
 *   - `mode="manage"` (Default): vollständige UI mit Edit/Delete/Copy.
 *   - `mode="pick"`: kompakt, kein Detail-Panel; statt dessen wird beim
 *     Klick auf eine Datei `onPick(asset)` gefeuert. Optional `accept`
 *     zum Filtern (z. B. nur Bilder).
 */
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  File as FileIcon,
  FileImage,
  FileText,
  FileVideo,
  Film,
  Folder as FolderIcon,
  FolderOpen,
  FolderPlus,
  Image as ImageIcon,
  Loader2,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  type DragEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type Asset,
  type AssetFolder,
  createFolder as apiCreateFolder,
  deleteAsset,
  formatBytes,
  isImage,
  isVideo,
  listAssets,
  listFolders,
  updateAsset,
  uploadAsset,
} from "../../lib/assetsApi";

export type AssetBrowserMode = "manage" | "pick";

export type AssetBrowserProps = {
  mode?: AssetBrowserMode;
  /** Bei mode="pick": Filter (z. B. ["image/"]) — nur passende werden klickbar. */
  accept?: ("image/" | "video/" | "*")[];
  /** Bei mode="pick": Callback, wenn der User eine Datei auswählt. */
  onPick?: (asset: Asset) => void;
  /** Initial-Folder beim Öffnen (z. B. "email"). */
  initialFolder?: string;
  /** Bei mode="pick": Schließen-Handler (für Modal). */
  onClose?: () => void;
  /** Optionale Klasse für äußeren Container. */
  className?: string;
};

type SortKey = "newest" | "name" | "size";

type UploadJob = {
  id: string;
  fileName: string;
  loaded: number;
  total: number;
  done: boolean;
  error: string | null;
};

const PAGE_SIZE = 200;

export default function AssetBrowser({
  mode = "manage",
  accept,
  onPick,
  initialFolder = "",
  onClose,
  className,
}: AssetBrowserProps) {
  const [folder, setFolder] = useState<string>(initialFolder);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [folders, setFolders] = useState<AssetFolder[]>([]);
  const [foldersLoading, setFoldersLoading] = useState(false);
  const [foldersError, setFoldersError] = useState<string | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [assetsError, setAssetsError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Asset | null>(null);
  const [uploads, setUploads] = useState<UploadJob[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [renameId, setRenameId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [dragActive, setDragActive] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 220);
    return () => clearTimeout(t);
  }, [search]);

  const reloadFolders = useCallback(async () => {
    setFoldersLoading(true);
    setFoldersError(null);
    try {
      const r = await listFolders();
      setFolders(r.folders);
    } catch (e) {
      setFoldersError((e as Error).message);
    } finally {
      setFoldersLoading(false);
    }
  }, []);

  const reloadAssets = useCallback(async () => {
    setAssetsLoading(true);
    setAssetsError(null);
    try {
      const r = await listAssets({
        folder: debouncedSearch ? undefined : folder,
        q: debouncedSearch || undefined,
        sort,
        limit: PAGE_SIZE,
      });
      setAssets(r.rows);
    } catch (e) {
      setAssetsError((e as Error).message);
    } finally {
      setAssetsLoading(false);
    }
  }, [folder, debouncedSearch, sort]);

  useEffect(() => {
    reloadFolders();
  }, [reloadFolders]);
  useEffect(() => {
    reloadAssets();
  }, [reloadAssets]);

  const acceptable = useCallback(
    (a: Asset) => {
      if (mode !== "pick" || !accept || accept.length === 0) return true;
      if (accept.includes("*")) return true;
      const t = a.content_type || "";
      if (accept.includes("image/") && t.startsWith("image/")) return true;
      if (accept.includes("video/") && t.startsWith("video/")) return true;
      return false;
    },
    [mode, accept],
  );

  const tree = useMemo(() => buildTree(folders), [folders]);

  const fileAssets = useMemo(
    () => assets.filter((a) => a.kind === "file"),
    [assets],
  );
  const folderAssets = useMemo(
    () => (debouncedSearch ? [] : assets.filter((a) => a.kind === "folder")),
    [assets, debouncedSearch],
  );

  // ── Upload-Logik ───────────────────────────────────────────────────
  const performUpload = useCallback(
    async (file: File, opts?: { overwrite?: boolean }) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setUploads((u) => [
        ...u,
        { id, fileName: file.name, loaded: 0, total: file.size, done: false, error: null },
      ]);
      try {
        const asset = await uploadAsset({
          file,
          folder,
          overwrite: opts?.overwrite,
          onProgress: (loaded, total) => {
            setUploads((u) =>
              u.map((j) => (j.id === id ? { ...j, loaded, total } : j)),
            );
          },
        });
        setUploads((u) =>
          u.map((j) => (j.id === id ? { ...j, done: true, loaded: j.total } : j)),
        );
        // Optimistisch ins Grid einfügen
        setAssets((a) => [asset, ...a.filter((x) => x.id !== asset.id)]);
        setTimeout(() => {
          setUploads((u) => u.filter((j) => j.id !== id));
        }, 1500);
        // Folder-Tree-Counts aktualisieren
        reloadFolders();
      } catch (e) {
        const msg = (e as Error).message;
        setUploads((u) =>
          u.map((j) => (j.id === id ? { ...j, error: msg, done: true } : j)),
        );
        if (/existiert bereits/.test(msg)) {
          if (
            window.confirm(
              `${file.name}\n\nEine Datei mit diesem Namen existiert bereits in \`${folder || "/"}\`. Überschreiben?`,
            )
          ) {
            setUploads((u) => u.filter((j) => j.id !== id));
            await performUpload(file, { overwrite: true });
          }
        }
      }
    },
    [folder, reloadFolders],
  );

  const handleFiles = useCallback(
    async (files: FileList | File[] | null) => {
      if (!files) return;
      const arr = Array.from(files);
      for (const f of arr) {
        await performUpload(f);
      }
    },
    [performUpload],
  );

  const onDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }, []);
  const onDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);
  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles],
  );

  // ── Folder-Operationen ─────────────────────────────────────────────
  const submitCreateFolder = useCallback(async () => {
    const name = createName.trim();
    if (!name) return;
    const path = folder ? `${folder}/${name}` : name;
    try {
      await apiCreateFolder(path);
      setCreateOpen(false);
      setCreateName("");
      await reloadFolders();
    } catch (e) {
      alert((e as Error).message);
    }
  }, [createName, folder, reloadFolders]);

  // ── Datei-Operationen ──────────────────────────────────────────────
  const onCopyUrl = useCallback(async (a: Asset) => {
    try {
      await navigator.clipboard.writeText(a.url);
    } catch {
      // ignore
    }
  }, []);

  const onDeleteAsset = useCallback(
    async (a: Asset) => {
      const label = a.kind === "folder" ? `den Ordner` : `die Datei`;
      if (!window.confirm(`${a.kind === "folder" ? `Ordner \`${a.key}\`` : `Datei \`${a.name}\``} wirklich löschen?\n\nDies kann nicht rückgängig gemacht werden.`)) {
        return;
      }
      try {
        await deleteAsset(a.id);
        setAssets((arr) => arr.filter((x) => x.id !== a.id));
        if (selected?.id === a.id) setSelected(null);
        reloadFolders();
      } catch (e) {
        alert(`Löschen ${label} fehlgeschlagen: ${(e as Error).message}`);
      }
    },
    [reloadFolders, selected],
  );

  const onSubmitRename = useCallback(
    async (asset: Asset) => {
      const trimmed = renameValue.trim();
      if (!trimmed || trimmed === asset.name) {
        setRenameId(null);
        return;
      }
      try {
        const updated = await updateAsset(asset.id, { name: trimmed });
        setAssets((arr) => arr.map((x) => (x.id === asset.id ? updated : x)));
        if (selected?.id === asset.id) setSelected(updated);
        setRenameId(null);
      } catch (e) {
        alert((e as Error).message);
      }
    },
    [renameValue, selected],
  );

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div
      className={`flex h-full min-h-0 flex-col bg-neutral-50 dark:bg-neutral-950 ${className ?? ""}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }}
      />

      <div className="flex min-h-0 flex-1">
        {/* Folder-Sidebar */}
        <aside className="hidden w-60 shrink-0 flex-col border-r border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 lg:flex">
          <div className="flex items-center justify-between border-b border-neutral-200 px-3 py-2 dark:border-neutral-800">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Ordner
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                title="Neuer Ordner"
                onClick={() => setCreateOpen(true)}
                className="inline-flex h-7 w-7 items-center justify-center rounded text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
              >
                <FolderPlus className="h-4 w-4" />
              </button>
              <button
                type="button"
                title="Ordner-Liste neu laden"
                onClick={reloadFolders}
                className="inline-flex h-7 w-7 items-center justify-center rounded text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${foldersLoading ? "animate-spin" : ""}`}
                />
              </button>
            </div>
          </div>
          <nav className="min-h-0 flex-1 overflow-y-auto p-2 text-sm">
            <FolderRow
              path=""
              label="Alle Assets"
              count={null}
              active={folder === "" && !debouncedSearch}
              onSelect={() => {
                setFolder("");
                setSearch("");
              }}
              icon={<FolderIcon className="h-4 w-4 text-neutral-500" />}
            />
            {tree.map((node) => (
              <FolderTreeNode
                key={node.path}
                node={node}
                depth={0}
                activePath={debouncedSearch ? null : folder}
                onSelect={(p) => {
                  setFolder(p);
                  setSearch("");
                }}
              />
            ))}
            {foldersError && (
              <div className="mt-2 rounded border border-red-300 bg-red-50 p-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
                {foldersError}
              </div>
            )}
          </nav>
        </aside>

        {/* Hauptbereich */}
        <section className="flex min-h-0 flex-1 flex-col">
          <header className="flex flex-wrap items-center gap-2 border-b border-neutral-200 bg-white px-4 py-2.5 dark:border-neutral-800 dark:bg-neutral-900">
            {mode === "pick" && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-8 w-8 items-center justify-center rounded text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
                title="Schließen"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <Breadcrumbs
              folder={debouncedSearch ? "" : folder}
              onSelect={(p) => {
                setFolder(p);
                setSearch("");
              }}
            />
            {debouncedSearch && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                Suche: {debouncedSearch}
              </span>
            )}
            <div className="ml-auto flex items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Suchen…"
                  className="h-8 w-44 rounded border border-neutral-300 bg-white pl-7 pr-2 text-sm focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900"
                />
              </div>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="h-8 rounded border border-neutral-300 bg-white px-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
              >
                <option value="newest">Neuste zuerst</option>
                <option value="name">Name (A–Z)</option>
                <option value="size">Größe absteigend</option>
              </select>
              <button
                type="button"
                onClick={reloadAssets}
                title="Liste neu laden"
                className="inline-flex h-8 w-8 items-center justify-center rounded border border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${assetsLoading ? "animate-spin" : ""}`}
                />
              </button>
              {mode === "manage" && (
                <>
                  <button
                    type="button"
                    onClick={() => setCreateOpen(true)}
                    className="inline-flex h-8 items-center gap-1.5 rounded border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
                  >
                    <FolderPlus className="h-3.5 w-3.5" />
                    Neuer Ordner
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex h-8 items-center gap-1.5 rounded bg-neutral-900 px-3 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Hochladen
                  </button>
                </>
              )}
            </div>
          </header>

          {/* Upload-Progress */}
          {uploads.length > 0 && (
            <div className="border-b border-neutral-200 bg-amber-50 px-4 py-2 dark:border-neutral-800 dark:bg-amber-950/30">
              <div className="space-y-1">
                {uploads.map((j) => (
                  <div key={j.id} className="text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-amber-900 dark:text-amber-200">
                        {j.fileName}
                      </span>
                      <span className="text-amber-800 dark:text-amber-300">
                        {j.error
                          ? `Fehler: ${j.error}`
                          : j.done
                            ? "Fertig"
                            : `${Math.round((j.loaded / j.total) * 100)}%`}
                      </span>
                    </div>
                    {!j.error && (
                      <div className="mt-1 h-1 w-full overflow-hidden rounded bg-amber-200 dark:bg-amber-900">
                        <div
                          className="h-full bg-amber-600 transition-[width] dark:bg-amber-400"
                          style={{
                            width: `${Math.min(100, Math.round((j.loaded / Math.max(1, j.total)) * 100))}%`,
                          }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Drop-Overlay */}
          <div className="relative min-h-0 flex-1 overflow-hidden">
            {dragActive && mode === "manage" && (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-neutral-900/20 backdrop-blur-sm">
                <div className="rounded-lg border-2 border-dashed border-neutral-900 bg-white px-6 py-8 text-center text-neutral-900 shadow-lg dark:border-white dark:bg-neutral-900 dark:text-white">
                  <Upload className="mx-auto h-10 w-10" />
                  <div className="mt-2 text-base font-medium">
                    Dateien hier ablegen
                  </div>
                  <div className="mt-1 text-xs text-neutral-500">
                    Upload nach `{folder || "/"}`
                  </div>
                </div>
              </div>
            )}

            <div className="flex h-full min-h-0">
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                {assetsError && (
                  <div className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
                    {assetsError}
                  </div>
                )}

                {assetsLoading && assets.length === 0 ? (
                  <div className="flex h-40 items-center justify-center text-sm text-neutral-500">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Lade Assets…
                  </div>
                ) : !assetsLoading &&
                  assets.length === 0 &&
                  !debouncedSearch ? (
                  <EmptyState
                    onUpload={() => fileInputRef.current?.click()}
                    folder={folder}
                    canEdit={mode === "manage"}
                  />
                ) : (
                  <>
                    {folderAssets.length > 0 && (
                      <div className="mb-4">
                        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                          Ordner
                        </h3>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                          {folderAssets.map((a) => (
                            <FolderCard
                              key={a.id}
                              asset={a}
                              onOpen={() => setFolder(a.key)}
                              canDelete={mode === "manage"}
                              onDelete={() => onDeleteAsset(a)}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                    {fileAssets.length > 0 ? (
                      <>
                        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                          Dateien · {fileAssets.length}
                        </h3>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                          {fileAssets.map((a) => {
                            const usable = acceptable(a);
                            return (
                              <AssetCard
                                key={a.id}
                                asset={a}
                                selected={selected?.id === a.id}
                                disabled={mode === "pick" && !usable}
                                onClick={() => {
                                  if (mode === "pick") {
                                    if (usable && onPick) onPick(a);
                                    return;
                                  }
                                  setSelected(a);
                                }}
                                onCopy={() => onCopyUrl(a)}
                                onDelete={() => onDeleteAsset(a)}
                                renameId={renameId}
                                renameValue={renameValue}
                                setRenameId={setRenameId}
                                setRenameValue={setRenameValue}
                                onSubmitRename={() => onSubmitRename(a)}
                                showActions={mode === "manage"}
                              />
                            );
                          })}
                        </div>
                      </>
                    ) : debouncedSearch ? (
                      <div className="py-12 text-center text-sm text-neutral-500">
                        Keine Treffer für "{debouncedSearch}"
                      </div>
                    ) : null}
                  </>
                )}
              </div>

              {mode === "manage" && selected && (
                <DetailPanel
                  asset={selected}
                  onClose={() => setSelected(null)}
                  onCopy={() => onCopyUrl(selected)}
                  onDelete={() => onDeleteAsset(selected)}
                  onUpdated={(updated) => {
                    setAssets((arr) =>
                      arr.map((x) => (x.id === updated.id ? updated : x)),
                    );
                    setSelected(updated);
                    reloadFolders();
                  }}
                />
              )}
            </div>
          </div>
        </section>
      </div>

      {createOpen && (
        <CreateFolderModal
          parent={folder}
          name={createName}
          onChangeName={setCreateName}
          onSubmit={submitCreateFolder}
          onClose={() => {
            setCreateOpen(false);
            setCreateName("");
          }}
        />
      )}
    </div>
  );
}

// ───────────────────────── Hilfs-Komponenten ──────────────────────────

type FolderTreeNodeData = {
  path: string;
  name: string;
  count: number;
  children: FolderTreeNodeData[];
};

function buildTree(folders: AssetFolder[]): FolderTreeNodeData[] {
  const map = new Map<string, FolderTreeNodeData>();
  const sorted = [...folders].sort((a, b) =>
    a.path.localeCompare(b.path, "de"),
  );
  for (const f of sorted) {
    map.set(f.path, {
      path: f.path,
      name: f.name,
      count: f.count,
      children: [],
    });
  }
  const roots: FolderTreeNodeData[] = [];
  for (const f of sorted) {
    const node = map.get(f.path)!;
    if (f.parent && map.has(f.parent)) {
      map.get(f.parent)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

function FolderTreeNode({
  node,
  depth,
  activePath,
  onSelect,
}: {
  node: FolderTreeNodeData;
  depth: number;
  activePath: string | null;
  onSelect: (path: string) => void;
}) {
  // Auto-expand wenn der active-path in diesem Subtree liegt
  const containsActive =
    activePath != null &&
    (activePath === node.path || activePath.startsWith(node.path + "/"));
  const [open, setOpen] = useState(containsActive);
  useEffect(() => {
    if (containsActive) setOpen(true);
  }, [containsActive]);
  const hasChildren = node.children.length > 0;
  const isActive = activePath === node.path;
  return (
    <div>
      <div
        className={`group flex items-center rounded px-1 py-1 ${
          isActive
            ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
            : "hover:bg-neutral-100 dark:hover:bg-neutral-800"
        }`}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
      >
        <button
          type="button"
          onClick={() => hasChildren && setOpen((v) => !v)}
          className={`mr-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center ${
            hasChildren
              ? "text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
              : "text-transparent"
          }`}
          aria-label={open ? "Einklappen" : "Ausklappen"}
        >
          {hasChildren ? (
            open ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )
          ) : null}
        </button>
        <button
          type="button"
          onClick={() => onSelect(node.path)}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
        >
          {open ? (
            <FolderOpen className="h-3.5 w-3.5 shrink-0 text-amber-500" />
          ) : (
            <FolderIcon className="h-3.5 w-3.5 shrink-0 text-amber-500" />
          )}
          <span className="truncate">{node.name}</span>
          {node.count > 0 && (
            <span
              className={`ml-auto rounded-full px-1.5 text-[10px] ${
                isActive
                  ? "bg-white/20 text-white dark:bg-neutral-900/20 dark:text-neutral-900"
                  : "bg-neutral-200 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300"
              }`}
            >
              {node.count}
            </span>
          )}
        </button>
      </div>
      {hasChildren && open && (
        <div>
          {node.children.map((c) => (
            <FolderTreeNode
              key={c.path}
              node={c}
              depth={depth + 1}
              activePath={activePath}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FolderRow({
  path,
  label,
  count,
  active,
  onSelect,
  icon,
}: {
  path: string;
  label: string;
  count: number | null;
  active: boolean;
  onSelect: () => void;
  icon: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      data-path={path}
      className={`flex w-full items-center gap-1.5 rounded px-2 py-1 text-left ${
        active
          ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
          : "hover:bg-neutral-100 dark:hover:bg-neutral-800"
      }`}
    >
      {icon}
      <span className="truncate">{label}</span>
      {count != null && count > 0 && (
        <span className="ml-auto rounded-full bg-neutral-200 px-1.5 text-[10px] text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300">
          {count}
        </span>
      )}
    </button>
  );
}

function Breadcrumbs({
  folder,
  onSelect,
}: {
  folder: string;
  onSelect: (path: string) => void;
}) {
  const parts = folder ? folder.split("/") : [];
  return (
    <nav className="flex flex-wrap items-center gap-1 text-sm">
      <button
        type="button"
        onClick={() => onSelect("")}
        className="rounded px-1.5 py-0.5 font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800"
      >
        Root
      </button>
      {parts.map((part, idx) => {
        const path = parts.slice(0, idx + 1).join("/");
        return (
          <span key={path} className="flex items-center gap-1">
            <ChevronRight className="h-3.5 w-3.5 text-neutral-400" />
            <button
              type="button"
              onClick={() => onSelect(path)}
              className="rounded px-1.5 py-0.5 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              {part}
            </button>
          </span>
        );
      })}
    </nav>
  );
}

function FolderCard({
  asset,
  onOpen,
  canDelete,
  onDelete,
}: {
  asset: Asset;
  onOpen: () => void;
  canDelete: boolean;
  onDelete: () => void;
}) {
  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center gap-2 rounded border border-neutral-200 bg-white px-3 py-2.5 text-left hover:border-neutral-400 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-600 dark:hover:bg-neutral-800"
      >
        <FolderIcon className="h-5 w-5 shrink-0 text-amber-500" />
        <span className="truncate text-sm font-medium">{asset.name}</span>
        {asset.kind === "folder" && (
          <span className="ml-auto text-[10px] uppercase text-neutral-400">
            leer
          </span>
        )}
      </button>
      {canDelete && (
        <button
          type="button"
          onClick={onDelete}
          title="Ordner löschen"
          className="absolute right-1 top-1 hidden h-6 w-6 items-center justify-center rounded text-neutral-400 hover:bg-red-100 hover:text-red-600 group-hover:flex"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

function fileIconFor(asset: Asset): ReactNode {
  if (isImage(asset)) return <FileImage className="h-8 w-8 text-neutral-400" />;
  if (isVideo(asset)) return <FileVideo className="h-8 w-8 text-neutral-400" />;
  if ((asset.content_type || "").startsWith("text/"))
    return <FileText className="h-8 w-8 text-neutral-400" />;
  return <FileIcon className="h-8 w-8 text-neutral-400" />;
}

function AssetCard({
  asset,
  selected,
  disabled,
  onClick,
  onCopy,
  onDelete,
  renameId,
  renameValue,
  setRenameId,
  setRenameValue,
  onSubmitRename,
  showActions,
}: {
  asset: Asset;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
  onCopy: () => void;
  onDelete: () => void;
  renameId: number | null;
  renameValue: string;
  setRenameId: (n: number | null) => void;
  setRenameValue: (s: string) => void;
  onSubmitRename: () => void;
  showActions: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const [imgErr, setImgErr] = useState(false);
  const renaming = renameId === asset.id;
  const usable = !disabled;

  return (
    <div
      className={`group relative overflow-hidden rounded-lg border bg-white transition-shadow dark:bg-neutral-900 ${
        selected
          ? "border-neutral-900 shadow-lg dark:border-white"
          : "border-neutral-200 dark:border-neutral-800"
      } ${disabled ? "opacity-50" : ""}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className={`block w-full cursor-default ${usable ? "hover:bg-neutral-50 dark:hover:bg-neutral-800" : ""}`}
      >
        <div className="flex aspect-square items-center justify-center bg-neutral-100 dark:bg-neutral-800">
          {isImage(asset) && !imgErr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={asset.url}
              alt={asset.alt_text || asset.name}
              loading="lazy"
              onError={() => setImgErr(true)}
              className="h-full w-full object-contain"
            />
          ) : isVideo(asset) ? (
            <Film className="h-12 w-12 text-neutral-400" />
          ) : (
            fileIconFor(asset)
          )}
        </div>
        <div className="border-t border-neutral-200 bg-white px-2 py-1.5 dark:border-neutral-800 dark:bg-neutral-900">
          {renaming ? (
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSubmitRename();
                if (e.key === "Escape") setRenameId(null);
              }}
              onBlur={onSubmitRename}
              onClick={(e) => e.stopPropagation()}
              className="w-full rounded border border-neutral-300 px-1 py-0.5 text-xs dark:border-neutral-600 dark:bg-neutral-800"
            />
          ) : (
            <div
              className="truncate text-xs font-medium text-neutral-900 dark:text-neutral-100"
              title={asset.name}
            >
              {asset.name}
            </div>
          )}
          <div className="mt-0.5 flex items-center justify-between gap-2 text-[10px] text-neutral-500">
            <span className="truncate">{asset.content_type}</span>
            <span className="shrink-0">{formatBytes(asset.size)}</span>
          </div>
        </div>
      </button>

      {showActions && hovered && !renaming && (
        <div className="absolute right-1 top-1 flex gap-1 rounded bg-white/90 p-0.5 shadow dark:bg-neutral-900/90">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setRenameId(asset.id);
              setRenameValue(asset.name);
            }}
            title="Umbenennen"
            className="inline-flex h-6 w-6 items-center justify-center rounded text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCopy();
            }}
            title="URL kopieren"
            className="inline-flex h-6 w-6 items-center justify-center rounded text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            <Copy className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title="Löschen"
            className="inline-flex h-6 w-6 items-center justify-center rounded text-neutral-600 hover:bg-red-100 hover:text-red-600 dark:text-neutral-300 dark:hover:bg-red-950"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}

function EmptyState({
  onUpload,
  folder,
  canEdit,
}: {
  onUpload: () => void;
  folder: string;
  canEdit: boolean;
}) {
  return (
    <div className="flex h-64 flex-col items-center justify-center text-center">
      <ImageIcon className="h-10 w-10 text-neutral-400" />
      <div className="mt-3 text-sm font-medium text-neutral-700 dark:text-neutral-200">
        Keine Dateien in `{folder || "/"}`
      </div>
      <div className="mt-1 text-xs text-neutral-500">
        Lade Dateien per Drag-and-Drop oder Button hoch.
      </div>
      {canEdit && (
        <button
          type="button"
          onClick={onUpload}
          className="mt-4 inline-flex items-center gap-1.5 rounded bg-neutral-900 px-3 py-1.5 text-sm text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          <Upload className="h-3.5 w-3.5" />
          Dateien hochladen
        </button>
      )}
    </div>
  );
}

function CreateFolderModal({
  parent,
  name,
  onChangeName,
  onSubmit,
  onClose,
}: {
  parent: string;
  name: string;
  onChangeName: (s: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl dark:bg-neutral-900">
        <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
          Neuer Ordner
        </h3>
        <p className="mt-1 text-xs text-neutral-500">
          Wird angelegt in: <code className="font-mono">{parent || "/"}</code>
        </p>
        <input
          autoFocus
          value={name}
          onChange={(e) => onChangeName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSubmit();
            if (e.key === "Escape") onClose();
          }}
          placeholder="Ordnername"
          className="mt-4 w-full rounded border border-neutral-300 px-3 py-1.5 text-sm focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900"
        />
        <p className="mt-1 text-[11px] text-neutral-400">
          Erlaubt: a–z, A–Z, 0–9 und . _ -
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 items-center rounded border border-neutral-300 bg-white px-3 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={onSubmit}
            className="inline-flex h-8 items-center rounded bg-neutral-900 px-3 text-sm text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            Anlegen
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailPanel({
  asset,
  onClose,
  onCopy,
  onDelete,
  onUpdated,
}: {
  asset: Asset;
  onClose: () => void;
  onCopy: () => void;
  onDelete: () => void;
  onUpdated: (a: Asset) => void;
}) {
  const [altText, setAltText] = useState(asset.alt_text ?? "");
  const [description, setDescription] = useState(asset.description ?? "");
  const [savedFlash, setSavedFlash] = useState(false);
  useEffect(() => {
    setAltText(asset.alt_text ?? "");
    setDescription(asset.description ?? "");
  }, [asset.id, asset.alt_text, asset.description]);

  const dirty =
    altText !== (asset.alt_text ?? "") ||
    description !== (asset.description ?? "");

  const onSave = useCallback(async () => {
    try {
      const updated = await updateAsset(asset.id, {
        alt_text: altText || null,
        description: description || null,
      });
      onUpdated(updated);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1200);
    } catch (e) {
      alert((e as Error).message);
    }
  }, [asset.id, altText, description, onUpdated]);

  return (
    <aside className="hidden w-80 shrink-0 flex-col border-l border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 md:flex">
      <header className="flex items-center justify-between border-b border-neutral-200 px-3 py-2 dark:border-neutral-800">
        <h3 className="truncate text-sm font-semibold">Details</h3>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-6 w-6 items-center justify-center rounded text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <div className="flex aspect-square items-center justify-center overflow-hidden rounded bg-neutral-100 dark:bg-neutral-800">
          {isImage(asset) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={asset.url}
              alt={asset.alt_text || asset.name}
              className="h-full w-full object-contain"
            />
          ) : isVideo(asset) ? (
            <video src={asset.url} controls className="h-full w-full" />
          ) : (
            fileIconFor(asset)
          )}
        </div>
        <div className="mt-3 space-y-2 text-xs">
          <Field label="Name">{asset.name}</Field>
          <Field label="Pfad">
            <code className="break-all font-mono text-[11px]">{asset.key}</code>
          </Field>
          <Field label="Typ">{asset.content_type}</Field>
          <Field label="Größe">{formatBytes(asset.size)}</Field>
          <Field label="Hochgeladen">
            {new Date(asset.uploaded_at.replace(" ", "T") + "Z").toLocaleString(
              "de-DE",
            )}
          </Field>
          <div>
            <div className="mb-1 text-[10px] uppercase tracking-wider text-neutral-500">
              Public-URL
            </div>
            <div className="flex items-stretch gap-1">
              <input
                value={asset.url}
                readOnly
                onFocus={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 rounded border border-neutral-300 bg-neutral-50 px-2 py-1 font-mono text-[11px] dark:border-neutral-700 dark:bg-neutral-800"
              />
              <button
                type="button"
                onClick={onCopy}
                title="URL kopieren"
                className="inline-flex h-7 w-7 items-center justify-center rounded border border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                <Copy className="h-3 w-3" />
              </button>
              <a
                href={asset.url}
                target="_blank"
                rel="noopener noreferrer"
                title="Öffnen"
                className="inline-flex h-7 w-7 items-center justify-center rounded border border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                <Download className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>
        <div className="mt-4 space-y-2 border-t border-neutral-200 pt-4 dark:border-neutral-800">
          <label className="block">
            <span className="mb-1 block text-[10px] uppercase tracking-wider text-neutral-500">
              Alt-Text (für Mails)
            </span>
            <input
              value={altText}
              onChange={(e) => setAltText(e.target.value)}
              className="w-full rounded border border-neutral-300 px-2 py-1 text-xs focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] uppercase tracking-wider text-neutral-500">
              Beschreibung
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded border border-neutral-300 px-2 py-1 text-xs focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900"
            />
          </label>
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={onDelete}
              className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline dark:text-red-400"
            >
              <Trash2 className="h-3 w-3" />
              Löschen
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={!dirty}
              className="inline-flex h-7 items-center rounded bg-neutral-900 px-3 text-xs text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              {savedFlash ? "Gespeichert ✓" : "Speichern"}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[80px_1fr] gap-2">
      <span className="text-[10px] uppercase tracking-wider text-neutral-500">
        {label}
      </span>
      <span className="break-all">{children}</span>
    </div>
  );
}
