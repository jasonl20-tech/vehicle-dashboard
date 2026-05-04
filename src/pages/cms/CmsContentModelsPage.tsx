import { ChevronRight, Plus } from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { CMS_ROOT } from "../../lib/cmsAccess";
import {
  CMS_CONTENT_MODELS_API,
  parseSchemaJson,
  userMayWriteCmsContentModels,
  type CmsContentModelRow,
  type CmsContentModelsListResponse,
} from "../../lib/cmsApi";
import { parseContentModelSchema } from "../../lib/cmsSchemaTypes";
import { useAuth } from "../../lib/auth";
import { useApi } from "../../lib/customerApi";

function prettySchemaJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw) as unknown, null, 2);
  } catch {
    return raw;
  }
}

export default function CmsContentModelsPage() {
  const { user, loading: authLoading } = useAuth();
  const canWriteModels =
    !!user && userMayWriteCmsContentModels(user.sicherheitsstufe);
  const showModelEditLinks = !authLoading && canWriteModels;

  const url = `${CMS_CONTENT_MODELS_API}?limit=200`;
  const { data, error, loading } = useApi<CmsContentModelsListResponse>(url);

  const rows = useMemo(() => {
    const list = data?.rows ?? [];
    return list.map((m: CmsContentModelRow) => {
      const parsed = parseContentModelSchema(
        parseSchemaJson(m.schema_json) ?? {},
      );
      return {
        id: m.id,
        key: m.key,
        fields: parsed.fields.length,
        deliveryEnvironment: parsed.deliveryEnvironment,
        desc: m.description?.trim() || "",
        schema_json: m.schema_json,
      };
    });
  }, [data?.rows]);

  const errMsg =
    error && String(error).trim() ? String(error).trim() : null;

  return (
    <div className="mx-auto w-full max-w-7xl">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="font-display text-[28px] font-semibold tracking-tighter2 text-ink-900 sm:text-[32px]">
          Content-Modelle
        </h1>
        {!authLoading && canWriteModels ? (
          <Link
            to={`${CMS_ROOT}/models/new`}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-ink-900 px-4 py-2 text-[12.5px] font-medium text-white hover:bg-ink-800"
          >
            <Plus className="h-4 w-4" />
            Neues Modell
          </Link>
        ) : null}
      </header>

      {!authLoading && user && !canWriteModels ? (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2 text-[13px] text-amber-950">
          Ihre Sicherheitsstufe erlaubt hier nur die <strong>Ansicht</strong> der
          Content-Typen. Anlegen und Bearbeiten von Modellen ist ab Stufe{" "}
          <span className="font-mono">8</span> möglich — Sie können weiterhin
          unter <Link className="font-medium underline" to={`${CMS_ROOT}/entries`}>Content</Link>{" "}
          Einträge pflegen.
        </p>
      ) : null}

      {errMsg ? (
        <pre className="mb-4 whitespace-pre-wrap rounded-lg border border-rose-200 bg-rose-50/80 px-3 py-2 font-sans text-[13px] text-rose-900">
          {errMsg}
        </pre>
      ) : null}

      {!loading && !errMsg ? (
        <ul className="space-y-2">
          {rows.map((m) => (
            <li
              key={m.id}
              className="overflow-hidden rounded-xl border border-hair bg-white shadow-sm"
            >
              {showModelEditLinks ? (
                <Link
                  to={`${CMS_ROOT}/models/${m.id}/edit`}
                  className="flex w-full items-center justify-between gap-4 p-5 text-left transition hover:border-ink-200 hover:bg-ink-50/30"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-ink-900">{m.key}</p>
                      {m.deliveryEnvironment === "preview" ? (
                        <span className="rounded-md bg-violet-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-900">
                          Preview
                        </span>
                      ) : (
                        <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-900">
                          Production
                        </span>
                      )}
                    </div>
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
                </Link>
              ) : (
                <div className="flex w-full items-center justify-between gap-4 p-5 text-left">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-ink-900">{m.key}</p>
                      {m.deliveryEnvironment === "preview" ? (
                        <span className="rounded-md bg-violet-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-900">
                          Preview
                        </span>
                      ) : (
                        <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-900">
                          Production
                        </span>
                      )}
                    </div>
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
                </div>
              )}
              <details className="border-t border-hair bg-ink-50/25">
                <summary className="cursor-pointer list-none px-4 py-2.5 text-[11px] font-medium text-ink-600 marker:content-none [&::-webkit-details-marker]:hidden">
                  JSON preview
                </summary>
                <pre className="max-h-64 overflow-auto border-t border-hair bg-[#0d1117] px-4 py-3 font-mono text-[10px] leading-relaxed text-[#e6edf3]">
                  {prettySchemaJson(m.schema_json)}
                </pre>
              </details>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
