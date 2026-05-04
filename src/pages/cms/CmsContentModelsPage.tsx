import { ChevronRight } from "lucide-react";
import { useMemo } from "react";
import {
  CMS_CONTENT_MODELS_API,
  countSchemaFields,
  parseSchemaJson,
  type CmsContentModelRow,
  type CmsContentModelsListResponse,
} from "../../lib/cmsApi";
import { useApi } from "../../lib/customerApi";

export default function CmsContentModelsPage() {
  const url = `${CMS_CONTENT_MODELS_API}?limit=200`;
  const { data, error, loading } = useApi<CmsContentModelsListResponse>(url);

  const rows = useMemo(() => {
    const list = data?.rows ?? [];
    return list.map((m: CmsContentModelRow) => {
      const schema = parseSchemaJson(m.schema_json);
      const n = countSchemaFields(schema);
      return {
        id: m.id,
        key: m.key,
        fields: n,
        desc: m.description?.trim() || "",
      };
    });
  }, [data?.rows]);

  const errMsg =
    error && String(error).trim() ? String(error).trim() : null;

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-8">
        <h1 className="font-display text-[26px] font-semibold tracking-tighter2 text-ink-900">
          Content-Modelle
        </h1>
      </header>

      {errMsg ? (
        <pre className="mb-4 whitespace-pre-wrap rounded-lg border border-rose-200 bg-rose-50/80 px-3 py-2 font-sans text-[13px] text-rose-900">
          {errMsg}
        </pre>
      ) : null}

      {!loading && !errMsg ? (
        <ul className="space-y-2">
          {rows.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-hair bg-white p-4 text-left shadow-sm transition hover:border-ink-200 hover:bg-ink-50/30"
              >
                <div className="min-w-0">
                  <p className="font-medium text-ink-900">{m.key}</p>
                  {m.desc ? (
                    <p className="mt-0.5 text-[12px] text-ink-500">{m.desc}</p>
                  ) : null}
                  <p className="mt-2 text-[11px] text-ink-400">
                    {m.fields} Felder ·{" "}
                    <code className="font-mono">{m.key}</code>
                    <span className="text-ink-300">
                      {" "}
                      · id {m.id.slice(0, 8)}…
                    </span>
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-ink-300" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
