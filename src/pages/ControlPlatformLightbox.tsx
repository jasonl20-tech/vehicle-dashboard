import {
  Check,
  ExternalLink,
  Eye,
  ImageIcon,
  Loader2,
  Pause,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type CarControlAction,
  type CarControlDetailView,
  type CarControlVariant,
  type CarVariantIdentity,
  carControlImageUrl,
  regenerateView,
  variantKey,
} from "../lib/carControlApi";
import { useApi } from "../lib/customerApi";
import {
  PREVIEW_IMAGES_SETTINGS_PATH,
  type PreviewImagesSettingsApiResponse,
  previewImageForSlug,
} from "../lib/previewImagesConfig";

/** Reihenfolge im Streifen (wie alte Lightbox) + Innen + Zusatz. */
const STRIP_ORDER = [
  "front_left",
  "front",
  "front_right",
  "right",
  "rear_right",
  "rear",
  "rear_left",
  "left",
  "dashboard",
  "center_console",
];

const VIEW_LABEL: Record<string, string> = {
  front: "Front",
  rear: "Heck",
  left: "Links",
  right: "Rechts",
  front_left: "Vorne links",
  front_right: "Vorne rechts",
  rear_left: "Hinten links",
  rear_right: "Hinten rechts",
  dashboard: "Armaturenbrett",
  center_console: "Mittelkonsole",
};
const label = (v: string) => VIEW_LABEL[v] || v;

type Item = { view: string; vo?: CarControlDetailView; missing?: boolean };
type Tone = "approved" | "error" | "hold" | "open";
const TONE_RING: Record<Tone, string> = {
  approved: "ring-2 ring-emerald-400",
  error: "ring-2 ring-rose-400",
  hold: "ring-2 ring-amber-400",
  open: "ring-1 ring-white/20",
};
const TONE_DOT: Record<Tone, string> = {
  approved: "bg-emerald-400",
  error: "bg-rose-400",
  hold: "bg-amber-400",
  open: "bg-white/40",
};

export default function ControlPlatformLightbox({
  identity,
  views,
  missingExt,
  missingInt,
  startView,
  busy,
  variants,
  easyMode,
  onToggleEasy,
  onSwitchVariant,
  onClose,
  onAct,
  onReload,
}: {
  identity: CarVariantIdentity;
  views: CarControlDetailView[];
  missingExt: string[];
  missingInt: string[];
  startView: string;
  busy: boolean;
  variants: CarControlVariant[];
  easyMode: boolean;
  onToggleEasy: () => void;
  onSwitchVariant: (id: CarVariantIdentity) => void;
  onClose: () => void;
  onAct: (action: CarControlAction, ids: number[]) => void | Promise<void>;
  onReload: () => void;
}) {
  const items: Item[] = useMemo(() => {
    const present = new Map(views.map((v) => [v.view, v]));
    const out: Item[] = [];
    for (const view of STRIP_ORDER) {
      const vo = present.get(view);
      if (vo) out.push({ view, vo });
      else if (missingExt.includes(view) || missingInt.includes(view))
        out.push({ view, missing: true });
    }
    for (const v of views)
      if (!STRIP_ORDER.includes(v.view)) out.push({ view: v.view, vo: v });
    return out;
  }, [views, missingExt, missingInt]);

  const [curView, setCurView] = useState(startView);
  const [genView, setGenView] = useState<string | null>(null);
  const [genMsg, setGenMsg] = useState<string | null>(null);

  // Beim Wechsel auf ein anderes Auto auf dessen erste bearbeitbare Ansicht.
  const idKey = variantKey(identity);
  const prevId = useRef(idKey);
  useEffect(() => {
    if (prevId.current !== idKey) {
      prevId.current = idKey;
      const fw = items.find((it) => it.missing || it.vo?.status === "open");
      setCurView(fw ? fw.view : (items[0]?.view ?? startView));
    }
  }, [idKey, items, startView]);

  const idx = Math.max(
    0,
    items.findIndex((it) => it.view === curView),
  );
  const cur = items[idx];

  const move = useCallback(
    (delta: number) => {
      if (items.length === 0) return;
      const ni = (idx + delta + items.length) % items.length;
      setCurView(items[ni].view);
    },
    [idx, items],
  );

  // Zum nächsten Auto springen (Easy-Mode: nur Autos mit offenen Ansichten).
  const switchToNextVariant = useCallback(() => {
    if (!variants || variants.length === 0) return false;
    const curKey = variantKey(identity);
    const i = variants.findIndex((v) => variantKey(v) === curKey);
    if (i < 0) return false;
    for (let j = 1; j <= variants.length; j++) {
      const v = variants[(i + j) % variants.length];
      if (variantKey(v) === curKey) break;
      if (!easyMode || v.open > 0) {
        onSwitchVariant(v);
        return true;
      }
    }
    return false;
  }, [variants, identity, easyMode, onSwitchVariant]);

  // Nächste bearbeitbare Ansicht (offen/fehlend); sonst → nächstes Auto.
  const goNextWorkable = useCallback(() => {
    if (items.length > 0) {
      for (let i = 1; i <= items.length; i++) {
        const it = items[(idx + i) % items.length];
        if (it.missing || it.vo?.status === "open") {
          setCurView(it.view);
          return;
        }
      }
    }
    switchToNextVariant();
  }, [idx, items, switchToNextVariant]);

  const doRegen = useCallback(
    async (view: string, replaceId?: number) => {
      if (genView) return;
      setGenView(view);
      setGenMsg(`Generiere „${label(view)}" … (kann 1–3 Min dauern)`);
      try {
        const ok = await regenerateView(identity, view, replaceId);
        setGenMsg(
          ok
            ? `„${label(view)}" generiert + übernommen.`
            : `„${label(view)}": Generierung fehlgeschlagen.`,
        );
        if (ok) onReload();
      } catch (e) {
        setGenMsg(e instanceof Error ? e.message : "Fehler.");
      } finally {
        setGenView(null);
      }
    },
    [genView, identity, onReload],
  );

  // Verstellbarer Thumbnail-Streifen (Breite gemerkt).
  const [stripW, setStripW] = useState(() => {
    const v = Number(localStorage.getItem("cpNeu.stripW"));
    return v >= 90 && v <= 420 ? v : 150;
  });
  const dragging = useRef(false);
  const stripWRef = useRef(stripW);
  stripWRef.current = stripW;
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (dragging.current) setStripW(Math.min(420, Math.max(90, e.clientX)));
    };
    const onUp = () => {
      if (dragging.current) {
        dragging.current = false;
        try {
          localStorage.setItem("cpNeu.stripW", String(stripWRef.current));
        } catch {
          /* ignore */
        }
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  const googleUrl = useMemo(() => {
    const q = [
      identity.marke,
      identity.modell.replace(/_/g, " "),
      identity.jahr,
      cur ? label(cur.view) : "",
    ]
      .filter(Boolean)
      .join(" ");
    return `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(q)}`;
  }, [identity, cur]);

  // Preview-Referenzbild-Overlay (Config lazy erst beim Einschalten laden).
  const [previewOn, setPreviewOn] = useState(
    () => localStorage.getItem("cpNeu.preview") === "1",
  );
  const previewApi = useApi<PreviewImagesSettingsApiResponse>(
    previewOn ? PREVIEW_IMAGES_SETTINGS_PATH : null,
  );
  const previewSrc = previewOn
    ? previewImageForSlug(previewApi.data?.images ?? null, cur?.view)
    : null;
  const togglePreview = () =>
    setPreviewOn((s) => {
      const n = !s;
      try {
        localStorage.setItem("cpNeu.preview", n ? "1" : "0");
      } catch {
        /* ignore */
      }
      return n;
    });

  // Tastatur
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && /^(input|textarea|select)$/i.test(t.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (e.key === "Escape") return onClose();
      if (e.key === "ArrowRight" || e.key === "ArrowDown")
        return e.preventDefault(), move(1);
      if (e.key === "ArrowLeft" || e.key === "ArrowUp")
        return e.preventDefault(), move(-1);
      const vo = cur?.vo;
      if (genView || busy) return;
      if ((k === "1" || k === "r") && vo && !vo.approved) {
        void onAct("approve", [vo.id]);
        goNextWorkable();
      } else if ((k === "2" || k === "g") && cur) {
        void doRegen(cur.view, vo?.id);
      } else if ((k === "3" || k === "h") && vo && !vo.hold) {
        void onAct("hold", [vo.id]);
      } else if ((k === "4" || k === "f") && vo && !vo.fehler) {
        void onAct("error", [vo.id]);
      } else if ((k === "0" || k === "u") && vo && vo.status !== "open") {
        void onAct("reset", [vo.id]);
      } else if ((e.key === "Delete" || e.key === "Backspace") && vo) {
        e.preventDefault();
        void onAct("delete", [vo.id]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cur, genView, busy, move, onAct, onClose, doRegen, goNextWorkable]);

  const tone = (it: Item): Tone => (it.vo?.status as Tone) ?? "open";
  const bigSrc = cur?.vo ? carControlImageUrl(cur.vo.imageKey) : null;

  const HeadBtn = ({
    onClick,
    title,
    active,
    children,
  }: {
    onClick: () => void;
    title: string;
    active?: boolean;
    children: ReactNode;
  }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`inline-flex h-8 items-center gap-1 rounded px-2 text-[12px] ${
        active
          ? "bg-brand-500/30 text-white"
          : "text-white/70 hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );

  return (
    <div
      className="fixed inset-0 z-[90] flex flex-col bg-black/95"
      role="dialog"
      aria-modal="true"
    >
      {/* Kopf */}
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-white/10 px-3 text-white">
        <div className="min-w-0">
          <span className="text-[13px] font-semibold">
            {identity.marke} {identity.modell}
          </span>{" "}
          <span className="text-[12px] text-white/50">
            {identity.jahr} · {identity.farbe} · {cur ? label(cur.view) : ""}
          </span>
        </div>
        {genMsg && (
          <span className="ml-2 max-w-[30vw] truncate text-[12px] text-white/70">
            {genMsg}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <HeadBtn
            onClick={togglePreview}
            title="Referenzbild der Ansicht einblenden"
            active={previewOn}
          >
            <Eye className="h-4 w-4" /> Preview
          </HeadBtn>
          <HeadBtn onClick={onToggleEasy} title="Fertige Autos überspringen" active={easyMode}>
            <Zap className="h-4 w-4" /> Easy
          </HeadBtn>
          <HeadBtn
            onClick={() => window.open(googleUrl, "_blank", "noopener")}
            title="Google-Bildersuche (mit echten Fotos vergleichen)"
          >
            <Search className="h-4 w-4" /> Google
          </HeadBtn>
          <HeadBtn
            onClick={() =>
              bigSrc && window.open(bigSrc, "_blank", "noopener")
            }
            title="Bild in neuem Tab öffnen"
          >
            <ExternalLink className="h-4 w-4" />
          </HeadBtn>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded text-white hover:bg-white/10"
            aria-label="Schließen"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Streifen */}
        <aside
          className="shrink-0 overflow-y-auto border-r border-white/10 p-2"
          style={{ width: stripW }}
        >
          {items.map((it) => {
            const active = it.view === curView;
            const src = it.vo ? carControlImageUrl(it.vo.imageKey) : null;
            return (
              <button
                key={it.view}
                type="button"
                onClick={() => setCurView(it.view)}
                className={`mb-2 block w-full overflow-hidden rounded ${
                  active ? "ring-2 ring-brand-400" : "ring-1 ring-white/10"
                }`}
              >
                <div className="relative grid aspect-[3/2] w-full place-items-center bg-white/5">
                  {src ? (
                    <img
                      src={src}
                      alt={it.view}
                      loading="lazy"
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <span className="text-[10px] text-white/40">fehlt</span>
                  )}
                  {it.vo && (
                    <span
                      className={`absolute right-1 top-1 h-2 w-2 rounded-full ${TONE_DOT[tone(it)]}`}
                    />
                  )}
                </div>
                <div className="truncate px-1 py-0.5 text-left text-[10px] text-white/70">
                  {label(it.view)}
                </div>
              </button>
            );
          })}
        </aside>

        {/* Zieh-Trenner (Streifenbreite) */}
        <div
          onPointerDown={() => {
            dragging.current = true;
          }}
          onDoubleClick={() => {
            setStripW(150);
            try {
              localStorage.setItem("cpNeu.stripW", "150");
            } catch {
              /* ignore */
            }
          }}
          title="Ziehen zum Verstellen · Doppelklick = Standard"
          className="w-1 shrink-0 cursor-col-resize bg-white/10 hover:bg-brand-400/60"
        />

        {/* Großbild */}
        <div className="relative flex min-w-0 flex-1 items-center justify-center p-4">
          {cur?.vo && bigSrc ? (
            <img
              src={bigSrc}
              alt={cur.view}
              className={`max-h-full max-w-full rounded object-contain ${TONE_RING[tone(cur)]}`}
            />
          ) : cur ? (
            <div className="flex flex-col items-center gap-2 text-white/50">
              <ImageIcon className="h-10 w-10" />
              <span className="text-[13px]">
                „{label(cur.view)}" fehlt — generieren mit dem Stern-Knopf.
              </span>
            </div>
          ) : null}
          {previewSrc && (
            <div className="absolute right-3 top-3 w-1/3 max-w-[280px] overflow-hidden rounded border border-white/30 bg-black/40 shadow-lg">
              <div className="bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white/80">
                Referenz
              </div>
              <img
                src={previewSrc}
                alt="Referenz"
                className="w-full object-contain"
              />
            </div>
          )}
          {genView && (
            <div className="absolute inset-0 grid place-items-center bg-black/50">
              <Loader2 className="h-8 w-8 animate-spin text-white" />
            </div>
          )}
        </div>
      </div>

      {/* Aktions-Leiste */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-white/10 px-3 py-2">
        {cur?.vo && (
          <>
            <BarBtn
              label="Freigeben"
              k="1"
              disabled={busy || !!genView || cur.vo.approved}
              onClick={() => {
                void onAct("approve", [cur.vo!.id]);
                goNextWorkable();
              }}
              cls="bg-emerald-600 hover:bg-emerald-700"
            >
              <Check className="h-4 w-4" />
            </BarBtn>
            <BarBtn
              label="Hold"
              k="3"
              disabled={busy || !!genView || cur.vo.hold}
              onClick={() => void onAct("hold", [cur.vo!.id])}
              cls="bg-amber-600 hover:bg-amber-700"
            >
              <Pause className="h-4 w-4" />
            </BarBtn>
            <BarBtn
              label="Fehler"
              k="4"
              disabled={busy || !!genView || cur.vo.fehler}
              onClick={() => void onAct("error", [cur.vo!.id])}
              cls="bg-rose-600 hover:bg-rose-700"
            >
              <X className="h-4 w-4" />
            </BarBtn>
            <BarBtn
              label="Zurücksetzen"
              k="0"
              disabled={busy || !!genView || cur.vo.status === "open"}
              onClick={() => void onAct("reset", [cur.vo!.id])}
              cls="bg-white/10 hover:bg-white/20"
            >
              <RotateCcw className="h-4 w-4" />
            </BarBtn>
          </>
        )}
        <BarBtn
          label={cur?.vo ? "Neu generieren" : "Generieren"}
          k="2"
          disabled={busy || !!genView || !cur}
          onClick={() => cur && void doRegen(cur.view, cur.vo?.id)}
          cls="bg-brand-600 hover:bg-brand-700"
        >
          <Sparkles className="h-4 w-4" />
        </BarBtn>
        {cur?.vo && (
          <BarBtn
            label="Löschen"
            k="Entf"
            disabled={busy || !!genView}
            onClick={() => void onAct("delete", [cur.vo!.id])}
            cls="bg-white/10 hover:bg-rose-600/40"
          >
            <Trash2 className="h-4 w-4" />
          </BarBtn>
        )}
        <span className="ml-auto text-[11px] text-white/40">
          ESC schließen · ← → blättern · 1 Freigeben · 2 Generieren · 3 Hold · 4
          Fehler · Entf Löschen
        </span>
      </div>
    </div>
  );
}

function BarBtn({
  label: lbl,
  k,
  disabled,
  onClick,
  cls,
  children,
}: {
  label: string;
  k: string;
  disabled: boolean;
  onClick: () => void;
  cls: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] font-medium text-white disabled:opacity-30 ${cls}`}
    >
      {children}
      {lbl}
      <kbd className="rounded bg-black/20 px-1 text-[10px]">{k}</kbd>
    </button>
  );
}
