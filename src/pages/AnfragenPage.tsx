import {
  ExternalLink,
  Filter,
  ListFilter,
  Mail,
  MoreHorizontal,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { useOutletContext } from "react-router-dom";
import SortGlyph from "../components/ui/SortGlyph";
import type { DashboardOutletContext } from "../components/layout/dashboardOutletContext";
import { fmtNumber, useApi } from "../lib/customerApi";
import {
  DASHBOARD_MAIN_INSET_X,
  DASH_SORT_COLUMN_BTN,
  DASH_TABLE_GRID as GRID,
  DASH_TD as TD,
  DASH_TD_INNER,
  DASH_TH_LABEL,
  DASH_TH_SORT as THSORT,
} from "../lib/dashboardTableStyle";
import {
  type WebsiteSubmissionRow,
  type WebsiteSubmissionsListResponse,
  patchWebsiteSubmissionErledigt,
  websiteSubmissionsListUrl,
} from "../lib/websiteSubmissionsApi";
import {
  type WebsiteTrialSubmissionsListResponse,
  websiteTrialSubmissionsListUrl,
} from "../lib/websiteTrialSubmissionsApi";

const PAGE_SIZE = 35;

const TABLE_SCROLL = `min-h-0 flex-1 overflow-auto border-b border-hair bg-gradient-to-b from-ink-50/25 via-white to-ink-50/20 py-2 sm:py-2.5 ${DASHBOARD_MAIN_INSET_X}`;
const TABLE_CARD =
  "w-full min-w-0 overflow-hidden rounded-xl border border-ink-200/70 bg-white shadow-sm shadow-ink-900/[0.06] ring-1 ring-ink-100/90 sm:rounded-2xl";
const FOOT_ROW = `flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-hair bg-paper/90 py-1.5 text-[12px] text-ink-600 ${DASHBOARD_MAIN_INSET_X}`;

function fmtWhen(s: string | null | undefined): string {
  if (!s?.trim()) return "—";
  const raw = s.trim();
  const t = raw.includes("T")
    ? Date.parse(raw)
    : Date.parse(raw.replace(" ", "T") + "Z");
  if (isNaN(t)) return s;
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(t));
}

function pickEmail(payload: unknown): string | null {
  if (payload == null || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const o = payload as Record<string, unknown>;
  const e = o.email;
  if (typeof e === "string" && e.includes("@")) return e.trim();
  return null;
}

function pickName(payload: unknown): string | null {
  if (payload == null || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const o = payload as Record<string, unknown>;
  for (const k of ["name", "Name", "fullName", "subject"]) {
    const v = o[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function pickMetaString(meta: unknown, key: string): string | null {
  if (meta == null || typeof meta !== "object" || Array.isArray(meta)) {
    return null;
  }
  const v = (meta as Record<string, unknown>)[key];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** Firma/Domain-ähnliche Felder im Payload (Referenz: Company + Unterzeile). */
function pickPayloadCompanyOrDomain(payload: unknown): string | null {
  if (payload == null || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const o = payload as Record<string, unknown>;
  for (const k of [
    "company",
    "Company",
    "firma",
    "Firma",
    "domain",
    "Domain",
    "website",
    "Website",
  ]) {
    const v = o[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function jsonPretty(x: unknown): string {
  try {
    return JSON.stringify(x, null, 2);
  } catch {
    return String(x);
  }
}

function formatPayloadValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return JSON.stringify(v, null, 2);
}

function payloadKvList(payload: unknown): { key: string; value: string }[] {
  if (payload == null) return [];
  if (typeof payload === "object" && !Array.isArray(payload)) {
    const o = payload as Record<string, unknown>;
    return Object.keys(o)
      .sort((a, b) => a.localeCompare(b, "de", { sensitivity: "base" }))
      .map((key) => ({ key, value: formatPayloadValue(o[key]) }));
  }
  return [{ key: "Inhalt", value: formatPayloadValue(payload) }];
}

function payloadSortString(payload: unknown): string {
  return payloadKvList(payload)
    .map((r) => `${r.key}:${r.value}`)
    .join("\u0001");
}

function PayloadAnfrageCell({
  payload,
  onOpenFull,
}: {
  payload: unknown;
  onOpenFull: () => void;
}) {
  const rows = payloadKvList(payload);
  return (
    <div
      role="button"
      tabIndex={0}
      className="group relative w-full min-w-[12rem] max-w-xl cursor-pointer rounded-lg border border-transparent px-2 py-1.5 text-left transition hover:border-ink-200 hover:bg-ink-50/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink-300/60"
      onClick={onOpenFull}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpenFull();
        }
      }}
      aria-label="Anfrage vollständig anzeigen"
    >
      <div className="max-h-[min(50vh,26rem)] overflow-y-auto overflow-x-hidden overscroll-contain pr-0.5">
        <dl className="space-y-2.5 text-left">
          {rows.map(({ key: k, value: v }) => (
            <div key={k} className="min-w-0">
              <dt className="text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-400">
                {k}
              </dt>
              <dd className="whitespace-pre-wrap break-words text-[12.5px] leading-relaxed text-ink-800">
                {v}
              </dd>
            </div>
          ))}
          {rows.length === 0 && (
            <p className="text-[12.5px] text-ink-400">—</p>
          )}
        </dl>
      </div>
      <p className="pointer-events-none mt-1.5 text-[10px] text-ink-400 opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
        Klicken für Vollansicht
      </p>
    </div>
  );
}

function PayloadKvDetail({ payload }: { payload: unknown }) {
  const rows = payloadKvList(payload);
  return (
    <dl className="space-y-3.5">
      {rows.map(({ key: k, value: v }) => (
        <div key={k} className="min-w-0">
          <dt className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-400">
            {k}
          </dt>
          <dd className="mt-0.5 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-ink-800">
            {v}
          </dd>
        </div>
      ))}
      {rows.length === 0 && (
        <p className="text-[13px] text-ink-400">—</p>
      )}
    </dl>
  );
}

type ProdSortKey =
  | "created_at"
  | "form_tag"
  | "contact"
  | "country"
  | "anfrage";

type TrialSortKey =
  | "created_at"
  | "eingang"
  | "kontakt"
  | "formular"
  | "herkunft"
  | "spam";

function rowProdParts(r: WebsiteSubmissionRow) {
  return {
    created_at: r.created_at,
    form_tag: (r.form_tag || "").trim(),
    contact: (pickEmail(r.payload) || pickName(r.payload) || "").trim(),
    country: (pickMetaString(r.metadata, "country") || "").trim(),
    anfrage: payloadSortString(r.payload),
  };
}

function cmpProd(
  a: WebsiteSubmissionRow,
  b: WebsiteSubmissionRow,
  key: ProdSortKey,
): number {
  const pa = rowProdParts(a);
  const pb = rowProdParts(b);
  let c = 0;
  switch (key) {
    case "created_at": {
      const ta = new Date(pa.created_at).getTime() || 0;
      const tb = new Date(pb.created_at).getTime() || 0;
      c = ta === tb ? 0 : ta < tb ? -1 : 1;
      break;
    }
    case "form_tag":
      c = pa.form_tag.localeCompare(pb.form_tag, "de", { sensitivity: "base" });
      break;
    case "contact":
      c = pa.contact.localeCompare(pb.contact, "de", { sensitivity: "base" });
      break;
    case "country":
      c = pa.country.localeCompare(pb.country, "de", { sensitivity: "base" });
      break;
    case "anfrage":
      c = pa.anfrage.localeCompare(pb.anfrage, "de", { sensitivity: "base" });
      break;
    default:
      c = 0;
  }
  return c;
}

function trialLeadTitle(r: WebsiteSubmissionRow): string {
  const email = pickEmail(r.payload);
  const name = pickName(r.payload);
  if (name && name !== email) return name.trim();
  return (email || name || "").trim();
}

function rowTrialParts(r: WebsiteSubmissionRow) {
  const companyLine = pickPayloadCompanyOrDomain(r.payload);
  return {
    created_at: r.created_at,
    eingang: trialLeadTitle(r),
    kontakt: (pickEmail(r.payload) || "").trim(),
    formular: `${(r.form_tag || "").trim()}\u0000${(companyLine || "").trim()}`,
    herkunft: `${(pickMetaString(r.metadata, "country") || "").trim()}\u0000${(pickMetaString(r.metadata, "ip") || "").trim()}`,
    spam: r.spam,
  };
}

function cmpTrial(
  a: WebsiteSubmissionRow,
  b: WebsiteSubmissionRow,
  key: TrialSortKey,
): number {
  const pa = rowTrialParts(a);
  const pb = rowTrialParts(b);
  let c = 0;
  switch (key) {
    case "created_at": {
      const ta = new Date(pa.created_at).getTime() || 0;
      const tb = new Date(pb.created_at).getTime() || 0;
      c = ta === tb ? 0 : ta < tb ? -1 : 1;
      break;
    }
    case "eingang":
      c = pa.eingang.localeCompare(pb.eingang, "de", { sensitivity: "base" });
      break;
    case "kontakt":
      c = pa.kontakt.localeCompare(pb.kontakt, "de", { sensitivity: "base" });
      break;
    case "formular":
      c = pa.formular.localeCompare(pb.formular, "de", { sensitivity: "base" });
      break;
    case "herkunft":
      c = pa.herkunft.localeCompare(pb.herkunft, "de", { sensitivity: "base" });
      break;
    case "spam":
      c = Number(pa.spam) - Number(pb.spam);
      break;
    default:
      c = 0;
  }
  return c;
}

type AnfragenVariant = "production" | "trial";

export default function AnfragenPage({
  variant = "production",
}: {
  /** `trial` = D1-Tabelle `trial_submissions` (Test Anfragen). */
  variant?: AnfragenVariant;
} = {}) {
  const isTrial = variant === "trial";
  const [qIn, setQIn] = useState("");
  const [q, setQ] = useState("");
  const [offset, setOffset] = useState(0);
  const [spam, setSpam] = useState<"all" | "0" | "1">("all");
  const [ansicht, setAnsicht] = useState<"offen" | "alle">("offen");
  const [filterOpen, setFilterOpen] = useState(false);
  const [ansichtOpen, setAnsichtOpen] = useState(false);
  const [patchingId, setPatchingId] = useState<string | null>(null);
  const [detail, setDetail] = useState<WebsiteSubmissionRow | null>(null);
  const { setHeaderTrailing } = useOutletContext<DashboardOutletContext>();

  const [prodSortKey, setProdSortKey] = useState<ProdSortKey>("created_at");
  const [prodSortAsc, setProdSortAsc] = useState(false);
  const [trialSortKey, setTrialSortKey] = useState<TrialSortKey>("created_at");
  const [trialSortAsc, setTrialSortAsc] = useState(false);

  useEffect(() => {
    setProdSortKey("created_at");
    setProdSortAsc(false);
    setTrialSortKey("created_at");
    setTrialSortAsc(false);
  }, [isTrial]);

  useEffect(() => {
    const t = setTimeout(() => setQ(qIn), 400);
    return () => clearTimeout(t);
  }, [qIn]);

  useEffect(() => {
    setOffset(0);
  }, [q, spam, ansicht]);

  useEffect(() => {
    if (!filterOpen && !ansichtOpen) return;
    let remove: (() => void) | undefined;
    const id = requestAnimationFrame(() => {
      const onDoc = (e: MouseEvent) => {
        const t = e.target as HTMLElement;
        if (t.closest?.("[data-anfragen-filter]")) return;
        if (t.closest?.("[data-anfragen-ansicht]")) return;
        setFilterOpen(false);
        setAnsichtOpen(false);
      };
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          setFilterOpen(false);
          setAnsichtOpen(false);
        }
      };
      document.addEventListener("mousedown", onDoc);
      window.addEventListener("keydown", onKey);
      remove = () => {
        document.removeEventListener("mousedown", onDoc);
        window.removeEventListener("keydown", onKey);
      };
    });
    return () => {
      cancelAnimationFrame(id);
      remove?.();
    };
  }, [filterOpen, ansichtOpen]);

  const closeFilters = useCallback(() => setFilterOpen(false), []);
  const closeAnsicht = useCallback(() => setAnsichtOpen(false), []);

  const handleProdSort = useCallback(
    (k: ProdSortKey) => {
      if (k === prodSortKey) setProdSortAsc((p) => !p);
      else {
        setProdSortKey(k);
        setProdSortAsc(k === "created_at" ? false : true);
      }
    },
    [prodSortKey],
  );

  const handleTrialSort = useCallback(
    (k: TrialSortKey) => {
      if (k === trialSortKey) setTrialSortAsc((p) => !p);
      else {
        setTrialSortKey(k);
        setTrialSortAsc(
          k === "created_at" ? false : k === "spam" ? false : true,
        );
      }
    },
    [trialSortKey],
  );

  const url = useMemo(
    () =>
      isTrial
        ? websiteTrialSubmissionsListUrl({
            q,
            limit: PAGE_SIZE,
            offset,
            spam,
            ansicht,
          })
        : websiteSubmissionsListUrl({
            q,
            limit: PAGE_SIZE,
            offset,
            spam,
            ansicht,
          }),
    [q, offset, spam, ansicht, isTrial],
  );
  const api = useApi<
    WebsiteSubmissionsListResponse | WebsiteTrialSubmissionsListResponse
  >(url);

  const toggleErledigt = useCallback(
    async (id: string, next: boolean) => {
      setPatchingId(id);
      try {
        await patchWebsiteSubmissionErledigt({
          trial: isTrial,
          id,
          erledigt: next,
        });
        api.reload();
      } catch (e) {
        alert((e as Error)?.message || "Speichern fehlgeschlagen");
      } finally {
        setPatchingId(null);
      }
    },
    [isTrial, api],
  );

  const rows = api.data?.rows ?? [];
  const sortedRows = useMemo(() => {
    const copy = [...rows];
    if (isTrial) {
      copy.sort((a, b) => {
        const c = cmpTrial(a, b, trialSortKey);
        return trialSortAsc ? c : -c;
      });
    } else {
      copy.sort((a, b) => {
        const c = cmpProd(a, b, prodSortKey);
        return prodSortAsc ? c : -c;
      });
    }
    return copy;
  }, [rows, isTrial, trialSortKey, trialSortAsc, prodSortKey, prodSortAsc]);

  const total = api.data?.total ?? 0;
  const limit = api.data?.limit ?? PAGE_SIZE;
  const atEnd = offset + rows.length >= total;
  const pageLabel =
    total === 0
      ? "0 / 0"
      : `${offset + 1}–${offset + rows.length} / ${fmtNumber(total)}`;

  const SPAM_OPTIONS = (
    [
      { id: "all" as const, label: "Alle" },
      { id: "0" as const, label: "Nur gültig" },
      { id: "1" as const, label: "Nur Spam" },
    ] as const
  );

  const ANSICHT_OPTIONS = (
    [
      { id: "offen" as const, label: "Nur offene" },
      { id: "alle" as const, label: "Alle anzeigen" },
    ] as const
  );

  const paginationControls =
    total > limit ? (
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={offset === 0 || api.loading}
          onClick={() => setOffset((o) => Math.max(0, o - limit))}
          className="press rounded border border-hair bg-white px-2 py-0.5 text-[12px] transition enabled:hover:bg-ink-50 disabled:opacity-40"
        >
          Zurück
        </button>
        <button
          type="button"
          disabled={atEnd || api.loading}
          onClick={() => setOffset((o) => o + limit)}
          className="press rounded border border-hair bg-white px-2 py-0.5 text-[12px] transition enabled:hover:bg-ink-50 disabled:opacity-40"
        >
          Weiter
        </button>
      </div>
    ) : null;

  const headerToolbar = useMemo(
    () => (
      <div className="flex min-w-0 w-full flex-1 items-center justify-end gap-1.5">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-ink-200/85 bg-white px-2.5 py-1.5 shadow-sm ring-1 ring-black/[0.05]">
          <Search className="h-3.5 w-3.5 shrink-0 text-ink-400" />
          <input
            type="search"
            value={qIn}
            onChange={(e) => setQIn(e.target.value)}
            placeholder={
              isTrial ? "Suchen" : "Begriffe, E-Mail, Formular …"
            }
            className="min-w-0 flex-1 border-0 bg-transparent text-[12.5px] text-ink-900 placeholder:text-ink-400 focus:outline-none"
            aria-label="Suche"
          />
        </div>
        <div className="relative" data-anfragen-filter>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setFilterOpen((o) => !o);
              setAnsichtOpen(false);
            }}
            className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border text-night-200 transition hover:bg-white/[0.08] hover:text-white ${
              spam !== "all"
                ? "border-brand-500/50 bg-brand-500/15 text-brand-200"
                : "border-white/[0.1] bg-white/[0.04]"
            }`}
            title="Spam-Filter"
            aria-expanded={filterOpen}
          >
            <Filter className="h-4 w-4" />
          </button>
          {filterOpen && (
            <div
              className="absolute right-0 top-full z-50 mt-1 w-[min(100vw-1rem,16rem)] rounded-lg border border-white/[0.1] bg-night-800 p-3 shadow-xl"
              data-anfragen-filter
              onClick={(e) => e.stopPropagation()}
            >
              <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-night-500">
                Spam
              </p>
              <div className="flex flex-col gap-1">
                {SPAM_OPTIONS.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => {
                      setSpam(o.id);
                      closeFilters();
                    }}
                    className={`rounded-md px-2 py-1.5 text-left text-[12.5px] ${
                      spam === o.id
                        ? "bg-white/15 text-white"
                        : "text-night-200 hover:bg-white/10"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="relative" data-anfragen-ansicht>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setAnsichtOpen((o) => !o);
              setFilterOpen(false);
            }}
            className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border text-night-200 transition hover:bg-white/[0.08] hover:text-white ${
              ansicht !== "offen"
                ? "border-brand-500/50 bg-brand-500/15 text-brand-200"
                : "border-white/[0.1] bg-white/[0.04]"
            }`}
            title="Welche Einträge anzeigen?"
            aria-expanded={ansichtOpen}
          >
            <ListFilter className="h-4 w-4" />
          </button>
          {ansichtOpen && (
            <div
              className="absolute right-0 top-full z-50 mt-1 w-[min(100vw-1rem,16rem)] rounded-lg border border-white/[0.1] bg-night-800 p-3 shadow-xl"
              data-anfragen-ansicht
              onClick={(e) => e.stopPropagation()}
            >
              <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-night-500">
                Erledigt
              </p>
              <div className="flex flex-col gap-1">
                {ANSICHT_OPTIONS.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => {
                      setAnsicht(o.id);
                      closeAnsicht();
                    }}
                    className={`rounded-md px-2 py-1.5 text-left text-[12.5px] ${
                      ansicht === o.id
                        ? "bg-white/15 text-white"
                        : "text-night-200 hover:bg-white/10"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => api.reload()}
          disabled={api.loading}
          className="press inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/[0.1] bg-white/[0.04] text-night-200 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-50"
          title="Aktualisieren"
        >
          <RefreshCw
            className={`h-4 w-4 ${api.loading ? "animate-spin" : ""}`}
          />
        </button>
      </div>
    ),
    [
      qIn,
      filterOpen,
      ansichtOpen,
      spam,
      ansicht,
      isTrial,
      api.loading,
      closeFilters,
      closeAnsicht,
    ],
  );

  useLayoutEffect(() => {
    setHeaderTrailing(headerToolbar);
    return () => setHeaderTrailing(null);
  }, [setHeaderTrailing, headerToolbar]);

  const CELL_STACK =
    "flex min-h-[3rem] w-full max-w-full flex-col items-center justify-center gap-0.5 px-3 py-2 text-center text-[12.5px] leading-snug text-ink-800";

  const productionTableBlock = (
    <>
      <div className={TABLE_SCROLL}>
        <div className={TABLE_CARD}>
          <table className="w-full min-w-[900px] border-collapse text-[12.5px]">
            <thead className="sticky top-0 z-10 bg-gradient-to-b from-ink-50/95 to-ink-100/90 backdrop-blur-sm shadow-[0_1px_0_0_rgba(15,15,15,0.05)]">
              <tr>
                <th className={`${THSORT} w-14 shrink-0`} scope="col">
                  <div className={DASH_TH_LABEL}>
                    <span title="Erledigt">✓</span>
                  </div>
                </th>
                <th className={`${THSORT} max-w-[9rem]`} scope="col">
                  <button
                    type="button"
                    className={DASH_SORT_COLUMN_BTN}
                    onClick={() => handleProdSort("created_at")}
                  >
                    <span>Zeit (UTC)</span>
                    <SortGlyph
                      active={prodSortKey === "created_at"}
                      asc={prodSortAsc}
                    />
                  </button>
                </th>
                <th className={THSORT} scope="col">
                  <button
                    type="button"
                    className={DASH_SORT_COLUMN_BTN}
                    onClick={() => handleProdSort("form_tag")}
                  >
                    <span>Formular</span>
                    <SortGlyph
                      active={prodSortKey === "form_tag"}
                      asc={prodSortAsc}
                    />
                  </button>
                </th>
                <th className={THSORT} scope="col">
                  <button
                    type="button"
                    className={DASH_SORT_COLUMN_BTN}
                    onClick={() => handleProdSort("contact")}
                  >
                    <span>Kontakt</span>
                    <SortGlyph
                      active={prodSortKey === "contact"}
                      asc={prodSortAsc}
                    />
                  </button>
                </th>
                <th className={`${THSORT} w-32`} scope="col">
                  <button
                    type="button"
                    className={DASH_SORT_COLUMN_BTN}
                    onClick={() => handleProdSort("country")}
                  >
                    <span>Land</span>
                    <SortGlyph
                      active={prodSortKey === "country"}
                      asc={prodSortAsc}
                    />
                  </button>
                </th>
                <th className={`${THSORT} min-w-[16rem]`} scope="col">
                  <button
                    type="button"
                    className={DASH_SORT_COLUMN_BTN}
                    onClick={() => handleProdSort("anfrage")}
                  >
                    <span>Anfrage</span>
                    <SortGlyph
                      active={prodSortKey === "anfrage"}
                      asc={prodSortAsc}
                    />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="stagger-children">
              {api.loading && rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className={`${GRID} bg-white/90 px-2 py-10 text-center text-[12.5px] text-ink-500`}
                  >
                    Wird geladen…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className={`${GRID} bg-white/90 px-2 py-10 text-center text-[12.5px] text-ink-500`}
                  >
                    Keine Einsendungen.
                  </td>
                </tr>
              ) : (
                sortedRows.map((r, idx) => {
                  const email = pickEmail(r.payload);
                  const name = pickName(r.payload);
                  const country = pickMetaString(r.metadata, "country");
                  return (
                    <tr
                      key={r.id}
                      style={{
                        animationDelay: idx < 24 ? `${idx * 14}ms` : "0ms",
                      }}
                      className="even:bg-ink-50/[0.45] animate-fade-up transition-colors hover:bg-ink-100/70"
                    >
                      <td className={`${TD} w-14 shrink-0`}>
                        <div className={DASH_TD_INNER}>
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-hair text-brand-600 focus:ring-2 focus:ring-brand-500/35"
                            checked={!!r.erledigt}
                            disabled={patchingId === r.id || api.loading}
                            onChange={(e) => {
                              e.stopPropagation();
                              toggleErledigt(r.id, e.target.checked);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            title={
                              r.erledigt
                                ? "Als offen markieren"
                                : "Als erledigt markieren"
                            }
                            aria-label="Erledigt"
                          />
                        </div>
                      </td>
                      <td className={`${TD} whitespace-nowrap`}>
                        <div className={`${DASH_TD_INNER} tabular-nums text-ink-500`}>
                          {fmtWhen(r.created_at)}
                        </div>
                      </td>
                      <td className={TD}>
                        <div className={DASH_TD_INNER}>
                          <span className="inline-block rounded border border-hair bg-ink-50/80 px-1.5 py-0.5 text-[11.5px]">
                            {r.form_tag}
                          </span>
                        </div>
                      </td>
                      <td className={TD}>
                        <div className={CELL_STACK}>
                          {email ? (
                            <a
                              href={`mailto:${email}`}
                              className="inline-flex max-w-full items-center justify-center gap-1 break-words text-brand-600 [overflow-wrap:anywhere] hover:underline sm:px-1"
                            >
                              <Mail className="h-3 w-3 shrink-0" />
                              <span>{email}</span>
                            </a>
                          ) : (
                            <span className="text-ink-400">—</span>
                          )}
                          {name && name !== email && (
                            <span className="line-clamp-2 text-[11.5px] text-ink-500">
                              {name}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className={TD}>
                        <div className={DASH_TD_INNER}>
                          {country || "—"}
                        </div>
                      </td>
                      <td className={`${TD} align-top`}>
                        <PayloadAnfrageCell
                          payload={r.payload}
                          onOpenFull={() => setDetail(r)}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className={FOOT_ROW}>
        <span className="min-w-0 truncate tabular-nums">
          {api.loading ? pageLabel + " · …" : pageLabel}
        </span>
        {paginationControls}
      </div>
    </>
  );

  const trialTableBlock = (
    <>
      <div className={TABLE_SCROLL}>
        <div className={TABLE_CARD}>
          <table className="w-full min-w-[900px] border-collapse text-[12.5px]">
            <thead className="sticky top-0 z-10 bg-gradient-to-b from-ink-50/95 to-ink-100/90 backdrop-blur-sm shadow-[0_1px_0_0_rgba(15,15,15,0.05)]">
              <tr>
                <th className={`${THSORT} w-14 shrink-0`} scope="col">
                  <div className={DASH_TH_LABEL}>
                    <span title="Erledigt">✓</span>
                  </div>
                </th>
                <th className={`${THSORT} min-w-[11rem]`} scope="col">
                  <button
                    type="button"
                    className={DASH_SORT_COLUMN_BTN}
                    onClick={() => handleTrialSort("eingang")}
                  >
                    <span>Eingang</span>
                    <SortGlyph
                      active={trialSortKey === "eingang"}
                      asc={trialSortAsc}
                    />
                  </button>
                </th>
                <th className={THSORT} scope="col">
                  <button
                    type="button"
                    className={DASH_SORT_COLUMN_BTN}
                    onClick={() => handleTrialSort("kontakt")}
                  >
                    <span>Kontakt</span>
                    <SortGlyph
                      active={trialSortKey === "kontakt"}
                      asc={trialSortAsc}
                    />
                  </button>
                </th>
                <th className={THSORT} scope="col">
                  <button
                    type="button"
                    className={DASH_SORT_COLUMN_BTN}
                    onClick={() => handleTrialSort("formular")}
                  >
                    <span>Formular</span>
                    <SortGlyph
                      active={trialSortKey === "formular"}
                      asc={trialSortAsc}
                    />
                  </button>
                </th>
                <th className={THSORT} scope="col">
                  <button
                    type="button"
                    className={DASH_SORT_COLUMN_BTN}
                    onClick={() => handleTrialSort("herkunft")}
                  >
                    <span>Herkunft</span>
                    <SortGlyph
                      active={trialSortKey === "herkunft"}
                      asc={trialSortAsc}
                    />
                  </button>
                </th>
                <th className={`${THSORT} w-28`} scope="col">
                  <button
                    type="button"
                    className={DASH_SORT_COLUMN_BTN}
                    onClick={() => handleTrialSort("spam")}
                  >
                    <span>Status</span>
                    <SortGlyph
                      active={trialSortKey === "spam"}
                      asc={trialSortAsc}
                    />
                  </button>
                </th>
                <th className={`${THSORT} max-w-[10rem]`} scope="col">
                  <button
                    type="button"
                    className={DASH_SORT_COLUMN_BTN}
                    onClick={() => handleTrialSort("created_at")}
                  >
                    <span>Angelegt (UTC)</span>
                    <SortGlyph
                      active={trialSortKey === "created_at"}
                      asc={trialSortAsc}
                    />
                  </button>
                </th>
                <th className={THSORT} scope="col">
                  <div className={DASH_TH_LABEL}>
                    <span className="sr-only">Aktion</span>
                    <MoreHorizontal
                      className="h-3.5 w-3.5 text-ink-400"
                      aria-hidden
                    />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {api.loading && rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className={`${GRID} bg-white/90 px-2 py-10 text-center text-[12.5px] text-ink-500`}
                  >
                    Wird geladen…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className={`${GRID} bg-white/90 px-2 py-10 text-center text-[12.5px] text-ink-500`}
                  >
                    Keine Test-Einsendungen (Tabelle leer oder Migration fehlt).
                  </td>
                </tr>
              ) : (
                sortedRows.map((r) => {
                  const email = pickEmail(r.payload);
                  const name = pickName(r.payload);
                  const companyLine = pickPayloadCompanyOrDomain(r.payload);
                  const ip = pickMetaString(r.metadata, "ip");
                  const country = pickMetaString(r.metadata, "country");
                  const leadTitle =
                    name && name !== email
                      ? name
                      : email || name || "—";
                  return (
                    <tr
                      key={r.id}
                      className="even:bg-ink-50/[0.45] transition-colors hover:bg-ink-100/70"
                    >
                      <td className={`${TD} w-14 shrink-0`}>
                        <div className={DASH_TD_INNER}>
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-hair text-brand-600 focus:ring-2 focus:ring-brand-500/35"
                            checked={!!r.erledigt}
                            disabled={patchingId === r.id || api.loading}
                            onChange={(e) => {
                              e.stopPropagation();
                              toggleErledigt(r.id, e.target.checked);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            title={
                              r.erledigt
                                ? "Als offen markieren"
                                : "Als erledigt markieren"
                            }
                            aria-label="Erledigt"
                          />
                        </div>
                      </td>
                      <td className={TD}>
                        <div className={DASH_TD_INNER}>
                          <span className="line-clamp-2 font-medium [overflow-wrap:anywhere]">
                            {leadTitle}
                          </span>
                        </div>
                      </td>
                      <td className={TD}>
                        <div className={CELL_STACK}>
                          {email ? (
                            <a
                              href={`mailto:${email}`}
                              className="line-clamp-2 break-words font-medium text-brand-600 [overflow-wrap:anywhere] hover:underline"
                            >
                              {email}
                            </a>
                          ) : (
                            <span className="text-ink-400">—</span>
                          )}
                          {name && name !== email && (
                            <span className="line-clamp-2 text-[11.5px] text-ink-500">
                              {name}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className={TD}>
                        <div className={CELL_STACK}>
                          <span className="line-clamp-2 font-medium [overflow-wrap:anywhere]">
                            {r.form_tag}
                          </span>
                          <span className="line-clamp-2 text-[11.5px] text-ink-500">
                            {companyLine || "—"}
                          </span>
                        </div>
                      </td>
                      <td className={TD}>
                        <div className={CELL_STACK}>
                          <span className="line-clamp-2 [overflow-wrap:anywhere]">
                            {country || "—"}
                          </span>
                          <span className="line-clamp-2 font-mono text-[11.5px] text-ink-500">
                            {ip || "—"}
                          </span>
                        </div>
                      </td>
                      <td className={TD}>
                        <div className={DASH_TD_INNER}>
                          {r.spam ? (
                            <span className="inline-flex rounded-md border border-amber-200/80 bg-amber-50 px-2 py-0.5 text-[11.5px] font-medium text-amber-900">
                              Spam
                            </span>
                          ) : (
                            <span className="inline-flex rounded-md border border-emerald-200/80 bg-emerald-50 px-2 py-0.5 text-[11.5px] font-medium text-emerald-800">
                              Gültig
                            </span>
                          )}
                        </div>
                      </td>
                      <td className={`${TD} whitespace-nowrap`}>
                        <div className={`${DASH_TD_INNER} tabular-nums text-ink-500`}>
                          {fmtWhen(r.created_at)}
                        </div>
                      </td>
                      <td className={TD}>
                        <div className={DASH_TD_INNER}>
                          <button
                            type="button"
                            onClick={() => setDetail(r)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-500 transition hover:bg-ink-100 hover:text-ink-800"
                            title="Details"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className={FOOT_ROW}>
        <span className="min-w-0 truncate tabular-nums">
          {api.loading ? pageLabel + " · …" : pageLabel}
        </span>
        {paginationControls}
      </div>
    </>
  );

  const tableBlock = (
    <>
      {api.error && (
        <p
          className={`shrink-0 border-b border-accent-rose/30 bg-accent-rose/10 py-1.5 text-[12.5px] text-accent-rose ${DASHBOARD_MAIN_INSET_X}`}
          role="alert"
        >
          {api.error}
        </p>
      )}
      {isTrial ? trialTableBlock : productionTableBlock}
    </>
  );

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
        {tableBlock}
      </div>
      {detail && (
        <SubmissionDetailDialog row={detail} onClose={() => setDetail(null)} />
      )}
    </div>
  );
}

function SubmissionDetailDialog({
  row,
  onClose,
}: {
  row: WebsiteSubmissionRow;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const ref = pickMetaString(row.metadata, "referer");
  const ua = pickMetaString(row.metadata, "userAgent");

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Einsendung"
    >
      <button
        type="button"
        className="absolute inset-0 bg-night-900/40 backdrop-blur-sm"
        aria-label="Schließen"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[min(92vh,920px)] w-full max-w-[min(96vw,720px)] flex-col overflow-hidden rounded-t-lg border border-hair bg-paper shadow-2xl sm:rounded-lg">
        <div className="flex items-center justify-between gap-2 border-b border-hair px-4 py-3">
          <div className="min-w-0">
            <p className="text-[10.5px] font-medium uppercase tracking-wider text-ink-400">
              {row.form_tag}
            </p>
            <p className="mt-0.5 truncate font-mono text-[12px] text-ink-700">
              {row.id}
            </p>
            <p className="text-[12px] text-ink-500">
              {fmtWhen(row.created_at)} UTC · {row.spam ? "Spam" : "Gültig"}
              {typeof row.erledigt === "boolean" && (
                <> · {row.erledigt ? "Erledigt" : "Offen"}</>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-md border border-hair"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <h3 className="mb-2 text-[10.5px] font-medium uppercase tracking-wider text-ink-400">
            Anfrage (Payload)
          </h3>
          <div className="mb-5 rounded-lg border border-hair bg-ink-50/40 px-3 py-3">
            <PayloadKvDetail payload={row.payload} />
          </div>
          <h3 className="mb-1 text-[10.5px] font-medium uppercase tracking-wider text-ink-400">
            Technische Metadaten
          </h3>
          <pre className="mb-3 max-h-56 overflow-auto rounded border border-hair bg-ink-50/50 p-2 font-mono text-[11.5px] text-ink-800">
            {jsonPretty(row.metadata)}
          </pre>
          {ref && (
            <p className="text-[12px] text-ink-600">
              <span className="text-ink-400">Referer: </span>
              <a
                href={ref}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all text-brand-600 hover:underline"
              >
                {ref}
                <ExternalLink className="ml-0.5 inline h-3 w-3" />
              </a>
            </p>
          )}
          {ua && (
            <p className="mt-2 line-clamp-3 text-[11px] text-ink-500" title={ua}>
              User-Agent: {ua}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
