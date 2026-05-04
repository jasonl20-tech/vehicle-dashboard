import { useMemo } from "react";
import { useLocation, useParams } from "react-router-dom";
import ContentModelEditorForm from "../../components/cms/ContentModelEditorForm";
import {
  CMS_CONTENT_MODELS_API,
  parseSchemaJson,
  type CmsContentModelRow,
  type CmsContentModelsListResponse,
} from "../../lib/cmsApi";
import {
  emptyContentModelSchema,
  parseContentModelSchema,
} from "../../lib/cmsSchemaTypes";
import { useApi } from "../../lib/customerApi";

export default function CmsContentModelEditPage() {
  const { modelId: editId } = useParams<{ modelId: string }>();
  const location = useLocation();
  const isNew = /\/models\/new\/?$/.test(location.pathname);
  const modelId = isNew ? null : (editId ?? null);

  const listUrl = `${CMS_CONTENT_MODELS_API}?limit=500`;
  const list = useApi<CmsContentModelsListResponse>(listUrl);

  const detailUrl =
    modelId && !isNew ? `${CMS_CONTENT_MODELS_API}/${modelId}` : null;
  const detail = useApi<CmsContentModelRow>(detailUrl);

  const otherModelKeys = useMemo(() => {
    const rows = list.data?.rows ?? [];
    const selfKey =
      !isNew && detail.data?.key ? detail.data.key : null;
    return rows.map((r) => r.key).filter((k) => k !== selfKey);
  }, [list.data?.rows, isNew, detail.data?.key]);

  if (!isNew) {
    if (detail.loading) {
      return (
        <p className="text-[13px] text-ink-500">Lade Modell …</p>
      );
    }
    if (detail.error) {
      return (
        <pre className="whitespace-pre-wrap rounded-lg border border-rose-200 bg-rose-50/80 px-3 py-2 font-sans text-[13px] text-rose-900">
          {detail.error}
        </pre>
      );
    }
    if (!detail.data) return null;
  }

  const initialSchema = isNew
    ? emptyContentModelSchema()
    : parseContentModelSchema(
        parseSchemaJson(detail.data!.schema_json) ?? {},
      );

  return (
    <ContentModelEditorForm
      key={isNew ? "new" : modelId}
      isNew={isNew}
      modelId={modelId}
      initialKey={isNew ? "" : detail.data!.key}
      initialDescription={isNew ? "" : detail.data!.description ?? ""}
      initialSchema={initialSchema}
      otherModelKeys={otherModelKeys}
    />
  );
}
