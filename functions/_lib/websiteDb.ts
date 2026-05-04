import { jsonResponse, type AuthEnv } from "./auth";

/** D1-Binding `website` (Submissions, CRM, E-Mail-Templates, CMS, …). */
export function requireWebsiteDb(env: AuthEnv): D1Database | Response {
  if (!env.website) {
    return jsonResponse(
      {
        error:
          "D1-Binding `website` fehlt. Im Cloudflare-Dashboard → Functions → D1, Variable `website` (env.website) setzen.",
      },
      { status: 503 },
    );
  }
  return env.website;
}
