import { diagnoseAe } from "../../_lib/analytics";
import {
  getCurrentUser,
  jsonResponse,
  type AuthEnv,
} from "../../_lib/auth";

/**
 * Diagnose-Endpoint für die Analytics-Engine-Anbindung.
 *
 *   GET /api/analytics/_diag
 *   GET /api/analytics/_diag?binding=secondary
 *
 * Zeigt (maskiert) ob CF_ACCOUNT_ID und CF_API_TOKEN gesetzt sind, ob die
 * Account-ID syntaktisch valide ist und ob ein einfacher Probe-Call gegen
 * die Analytics-Engine SQL-API funktioniert (inkl. Statuscode + CF-Ray +
 * Body-Vorschau, ohne den Token preiszugeben).
 *
 * Nur für eingeloggte Benutzer erreichbar.
 */
export const onRequestGet: PagesFunction<AuthEnv> = async ({
  request,
  env,
}) => {
  const user = await getCurrentUser(env, request);
  if (!user) {
    return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const url = new URL(request.url);
  const bindingRaw = (url.searchParams.get("binding") || "primary").toLowerCase();
  const binding =
    bindingRaw === "secondary" ? "secondary" : "primary";

  const result = await diagnoseAe(env, { binding });
  return jsonResponse(result, { status: result.ok ? 200 : 500 });
};
