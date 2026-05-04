import { useMemo } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import ContentModelEditorForm from "../../components/cms/ContentModelEditorForm";
import { CMS_ROOT } from "../../lib/cmsAccess";
import { useAuth } from "../../lib/auth";
import {
  CMS_CONTENT_MODELS_API,
  parseSchemaJson,
  userMayWriteCmsContentModels,
  type CmsContentModelRow,
  type CmsContentModelsListResponse,
} from "../../lib/cmsApi";
import {
  emptyContentModelSchema,
  parseContentModelSchema,
} from "../../lib/cmsSchemaTypes";
import { useApi } from "../../lib/customerApi";

export default function CmsContentModelEditPage() {
  const { user, loading: authLoading } = useAuth();
  const { modelId: editId } = useParams<{ modelId: string }>();
  const location = useLocation();
  const isNew = /\/models\/new\/?$/.test(location.pathname);
  const modelId = isNew ? null : (editId ?? null);

  if (authLoading) {
    return (
      <p className="text-[13px] text-ink-500">Lade Berechtigung …</p>
    );
  }

  if (!user || !userMayWriteCmsContentModels(user.sicherheitsstufe)) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <div className="rounded-lg border border-amber-200 bg-amber-50/90 px-4 py-3 text-[14px] text-amber-950">
          <p className="font-semibold text-amber-950">Keine Berechtigung</p>
          <p className="mt-2 text-[13px] leading-relaxed">
            Content-Modelle anlegen und bearbeiten ist nur ab Sicherheitsstufe{" "}
            <span className="font-mono">8</span> erlaubt. Sie können unter{" "}
            <Link
              className="font-medium text-amber-900 underline"
              to={`${CMS_ROOT}/entries`}
            >
              Content
            </Link>{" "}
            weiterhin Einträge bearbeiten.
          </p>
        </div>
        <Link
          to={`${CMS_ROOT}/models`}
          className="inline-block text-[13px] font-medium text-ink-600 hover:text-ink-900"
        >
          ← Zur Übersicht Content-Modelle
        </Link>
      </div>
    );
  }

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
