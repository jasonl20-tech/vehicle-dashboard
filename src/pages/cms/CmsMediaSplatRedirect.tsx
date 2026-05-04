import { Navigate, useParams } from "react-router-dom";
import { CMS_ROOT, cmsMediaAssetEditUrl } from "../../lib/cmsAccess";

/**
 * Leitet `/cms/media/{r2-key…}` (alte Splat-URLs) auf `?key=` um.
 */
export default function CmsMediaSplatRedirect() {
  const { "*": rest } = useParams();
  const key = (rest ?? "").replace(/^\/+/, "");
  if (!key) return <Navigate to={`${CMS_ROOT}/media`} replace />;
  return <Navigate to={cmsMediaAssetEditUrl(key)} replace />;
}
