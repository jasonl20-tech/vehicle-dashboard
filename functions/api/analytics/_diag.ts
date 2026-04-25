import {
  diagnoseAe,
  getMergedAnalyticsSources,
} from "../../_lib/analytics";
import {
  getCurrentUser,
  jsonResponse,
  type AuthEnv,
} from "../../_lib/auth";

/**
 * Diagnose für alle genutzten Analytics-Quellen (primär + optional Konto 2).
 *
 *   GET /api/analytics/_diag
 *
 * Nur für eingeloggte Benutzer.
 */
export const onRequestGet: PagesFunction<AuthEnv> = async ({
  request,
  env,
}) => {
  const user = await getCurrentUser(env, request);
  if (!user) {
    return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const { sources, error: srcErr } = getMergedAnalyticsSources(env);
  if (srcErr) {
    return jsonResponse({ error: srcErr, ok: false }, { status: 500 });
  }

  const primary = await diagnoseAe(env, { binding: "primary" });
  let secondary: Awaited<ReturnType<typeof diagnoseAe>> | null = null;
  if (sources.length > 1) {
    secondary = await diagnoseAe(env, { binding: "secondary" });
  }

  const ok = primary.ok && (secondary == null || secondary.ok);
  return jsonResponse(
    {
      ok,
      mergedSources: sources.map((s) => s.dataset),
      primary,
      secondary,
    },
    { status: ok ? 200 : 500 },
  );
};
