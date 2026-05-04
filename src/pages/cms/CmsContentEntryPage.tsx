import { useMemo } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import ContentEntryEditor from "../../components/cms/ContentEntryEditor";
import { CMS_ROOT } from "../../lib/cmsAccess";
import {
  CMS_CONTENT_MODELS_API,
  CMS_CONTENTS_API,
  parseSchemaJson,
  type CmsContentModelRow,
  type CmsContentRow,
} from "../../lib/cmsApi";
import {
  buildEmptyPayload,
  mergePayloadWithSchema,
} from "../../lib/cmsEntryPayload";
import { parseContentModelSchema } from "../../lib/cmsSchemaTypes";
import { useApi } from "../../lib/customerApi";

async function parseError(res: Response): Promise<string> {
  const j = (await res.json().catch(() => ({}))) as {
    error?: string;
    hint?: string;
  };
  const parts = [j.error || `HTTP ${res.status}`];
  if (j.hint) parts.push(`Hinweis: ${j.hint}`);
  return parts.join(" • ");
}

export default function CmsContentEntryPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { contentId: editContentId } = useParams<{ contentId: string }>();
  const [searchParams] = useSearchParams();

  const isNewRoute =
    location.pathname === `${CMS_ROOT}/entries/new` ||
    location.pathname.endsWith("/entries/new");

  const modelIdFromQuery = (searchParams.get("model") ?? "").trim();

  const contentIdForEdit =
    !isNewRoute && editContentId ? editContentId : null;

  const contentUrl = contentIdForEdit
    ? `${CMS_CONTENTS_API}/${encodeURIComponent(contentIdForEdit)}`
    : null;
  const contentRes = useApi<CmsContentRow>(contentUrl);

  const modelIdResolved = useMemo(() => {
    if (contentIdForEdit && contentRes.data?.content_model_id) {
      return contentRes.data.content_model_id;
    }
    if (isNewRoute) return modelIdFromQuery;
    return "";
  }, [
    contentIdForEdit,
    contentRes.data?.content_model_id,
    isNewRoute,
    modelIdFromQuery,
  ]);

  const modelUrl = modelIdResolved
    ? `${CMS_CONTENT_MODELS_API}/${encodeURIComponent(modelIdResolved)}`
    : null;
  const modelRes = useApi<CmsContentModelRow>(modelUrl);

  const schema = useMemo(() => {
    const raw = modelRes.data?.schema_json ?? "{}";
    return parseContentModelSchema(parseSchemaJson(raw));
  }, [modelRes.data?.schema_json]);

  const initialPayload = useMemo(() => {
    if (!modelRes.data) return {};
    if (isNewRoute) {
      return buildEmptyPayload(schema);
    }
    if (!contentRes.data?.payload_json) return buildEmptyPayload(schema);
    try {
      const parsed = JSON.parse(contentRes.data.payload_json) as unknown;
      return mergePayloadWithSchema(schema, parsed);
    } catch {
      return buildEmptyPayload(schema);
    }
  }, [
    modelRes.data,
    isNewRoute,
    contentRes.data?.payload_json,
    schema,
  ]);

  const initialStatus = contentRes.data?.status ?? "draft";
  const initialLocale = contentRes.data?.locale ?? "de-DE";
  const initialUpdatedAt = contentRes.data?.updated_at ?? null;

  const loading =
    Boolean(contentUrl && contentRes.loading) ||
    Boolean(modelUrl && modelRes.loading);

  const modelsListUrl = isNewRoute && !modelIdFromQuery
    ? `${CMS_CONTENT_MODELS_API}?limit=200`
    : null;
  const modelsList = useApi<{ rows: CmsContentModelRow[] }>(modelsListUrl);

  if (isNewRoute && !modelIdFromQuery) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <header className="mb-8">
          <Link
            to={`${CMS_ROOT}/entries`}
            className="mb-4 inline-block text-[13px] font-medium text-ink-600 hover:text-ink-900"
          >
            ← Zurück zu Content
          </Link>
          <h1 className="font-display text-[28px] font-semibold tracking-tighter2 text-ink-900">
            Content anlegen
          </h1>
          <p className="mt-2 text-[14px] text-ink-500">
            Content-Modell wählen, um einen neuen Eintrag zu bearbeiten.
          </p>
        </header>
        {modelsList.error ? (
          <pre className="whitespace-pre-wrap rounded-lg border border-rose-200 bg-rose-50/80 px-3 py-2 text-[13px] text-rose-900">
            {modelsList.error}
          </pre>
        ) : null}
        <ul className="space-y-2">
          {(modelsList.data?.rows ?? []).map((m) => (
            <li key={m.id}>
              <Link
                to={`${CMS_ROOT}/entries/new?model=${encodeURIComponent(m.id)}`}
                className="block rounded-xl border border-hair bg-white p-4 text-[14px] font-medium text-ink-900 shadow-sm transition hover:border-ink-200 hover:bg-ink-50/40"
              >
                {m.key}
                {m.description ? (
                  <span className="mt-1 block text-[12px] font-normal text-ink-500">
                    {m.description}
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const loadError = contentRes.error || modelRes.error;
  if (
    loadError ||
    (contentIdForEdit && !contentRes.loading && contentRes.data == null)
  ) {
    return (
      <div className="mx-auto max-w-2xl">
        <pre className="whitespace-pre-wrap rounded-lg border border-rose-200 bg-rose-50/80 px-3 py-2 text-[13px] text-rose-900">
          {loadError || "Eintrag nicht gefunden."}
        </pre>
        <Link
          to={`${CMS_ROOT}/entries`}
          className="mt-4 inline-block text-[13px] font-medium text-ink-600 hover:text-ink-900"
        >
          ← Zurück
        </Link>
      </div>
    );
  }

  if (loading || !modelRes.data) {
    return (
      <div className="py-16 text-center text-[14px] text-ink-500">
        Laden …
      </div>
    );
  }

  const model = modelRes.data;

  const onCreate = async (body: {
    payload: Record<string, unknown>;
    status: string;
    locale: string;
  }) => {
    const res = await fetch(CMS_CONTENTS_API, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content_model_id: model.id,
        payload_json: body.payload,
        status: body.status,
        locale: body.locale,
      }),
    });
    if (!res.ok) throw new Error(await parseError(res));
    const row = (await res.json()) as CmsContentRow;
    navigate(`${CMS_ROOT}/entries/${row.id}/edit`, { replace: true });
    return { id: row.id, updated_at: row.updated_at };
  };

  const onUpdate = async (
    id: string,
    body: {
      payload: Record<string, unknown>;
      status: string;
      locale: string;
    },
  ) => {
    const res = await fetch(
      `${CMS_CONTENTS_API}/${encodeURIComponent(id)}`,
      {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload_json: body.payload,
          status: body.status,
          locale: body.locale,
        }),
      },
    );
    if (!res.ok) throw new Error(await parseError(res));
    const row = (await res.json()) as CmsContentRow;
    return { updated_at: row.updated_at };
  };

  return (
    <ContentEntryEditor
      key={contentIdForEdit ?? `new-${model.id}`}
      modelKey={model.key}
      schema={schema}
      contentId={contentIdForEdit}
      initialPayload={initialPayload}
      initialStatus={initialStatus}
      initialLocale={initialLocale}
      initialUpdatedAt={initialUpdatedAt}
      onCreate={onCreate}
      onUpdate={onUpdate}
    />
  );
}
