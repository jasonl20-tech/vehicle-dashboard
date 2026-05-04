import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CMS_ROOT } from "../../lib/cmsAccess";
import {
  CMS_CONTENT_MODELS_API,
  CMS_CONTENTS_API,
  extractContentTitle,
  type CmsContentsListResponse,
  type CmsContentModelsListResponse,
  statusLabelDe,
} from "../../lib/cmsApi";
import { fmtRelative, useApi } from "../../lib/customerApi";

export default function CmsEntriesPage() {
  const [q, setQ] = useState("");

  const modelsUrl = `${CMS_CONTENT_MODELS_API}?limit=500`;
  const models = useApi<CmsContentModelsListResponse>(modelsUrl);

  const contentsUrl = useMemo(() => {
    const p = new URLSearchParams({ limit: "200" });
    const term = q.trim();
    if (term) p.set("q", term);
    return `${CMS_CONTENTS_API}?${p}`;
  }, [q]);

  const contents = useApi<CmsContentsListResponse>(contentsUrl);

  const modelKeyById = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of models.data?.rows ?? []) {
      m.set(r.id, r.key);
    }
    return m;
  }, [models.data?.rows]);

  const rows = useMemo(() => {
    const list = contents.data?.rows ?? [];
    return list.map((r) => {
      let payload: unknown = null;
      try {
        payload = JSON.parse(r.payload_json) as unknown;
      } catch {
        payload = null;
      }
      return {
        id: r.id,
        title: extractContentTitle(payload),
        type:
          modelKeyById.get(r.content_model_id) ??
          r.content_model_id.slice(0, 8),
        locale: r.locale,
        updated: fmtRelative(r.updated_at),
        state: statusLabelDe(r.status),
        statusRaw: r.status.trim().toLowerCase(),
      };
    });
  }, [contents.data?.rows, modelKeyById]);

  const loading = models.loading || contents.loading;
  const errMsg = useMemo(() => {
    const parts = [models.error, contents.error].filter(
      (x): x is string => Boolean(x && String(x).trim()),
    );
    return parts.length ? parts.join("\n") : null;
  }, [models.error, contents.error]);

  return (
    <div className="mx-auto w-full max-w-7xl">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-[28px] font-semibold tracking-tighter2 text-ink-900 sm:text-[32px]">
            Content
          </h1>
        </div>
        <Link
          to={`${CMS_ROOT}/entries/new`}
          className="inline-flex items-center justify-center rounded-lg bg-ink-900 px-4 py-2 text-[12.5px] font-medium text-white hover:bg-ink-800"
        >
          Content anlegen
        </Link>
      </header>

      {errMsg ? (
        <pre className="mb-4 whitespace-pre-wrap rounded-lg border border-rose-200 bg-rose-50/80 px-3 py-2 font-sans text-[13px] text-rose-900">
          {errMsg}
        </pre>
      ) : null}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Suche …"
            disabled={Boolean(errMsg)}
            className="w-full rounded-lg border border-hair bg-white py-2 pl-9 pr-3 text-[13px] text-ink-800 placeholder:text-ink-400 focus:border-ink-500 focus:outline-none focus:ring-1 focus:ring-ink-500/20 disabled:opacity-50"
          />
        </div>
        <p className="text-[12px] text-ink-400">
          {loading ? "—" : `${rows.length}`}
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-hair bg-white shadow-sm">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-hair bg-night-900/[0.02] text-[11px] font-semibold uppercase tracking-wide text-ink-500">
            <tr>
              <th className="px-4 py-3">Titel</th>
              <th className="px-4 py-3">Modell</th>
              <th className="hidden px-4 py-3 sm:table-cell">Locale</th>
              <th className="hidden px-4 py-3 md:table-cell">Geändert</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hair">
            {rows.map((r) => (
              <tr key={r.id} className="transition hover:bg-night-900/[0.02]">
                <td className="px-4 py-3 font-medium text-ink-900">
                  <Link
                    to={`${CMS_ROOT}/entries/${r.id}/edit`}
                    className="text-ink-900 hover:underline"
                  >
                    {r.title}
                  </Link>
                </td>
                <td className="px-4 py-3 text-ink-600">{r.type}</td>
                <td className="hidden px-4 py-3 text-ink-500 sm:table-cell">
                  {r.locale}
                </td>
                <td className="hidden px-4 py-3 text-ink-400 md:table-cell">
                  {r.updated}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={
                      r.statusRaw === "published"
                        ? "rounded-md border border-emerald-200 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-900"
                        : "rounded-md border border-hair bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-900"
                    }
                  >
                    {r.state}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
