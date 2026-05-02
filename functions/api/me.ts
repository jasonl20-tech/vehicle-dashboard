import { getCurrentUser, jsonResponse, type AuthEnv } from "../_lib/auth";
import { fetchPathsForSecurityLevel } from "../_lib/routeAccess";

export const onRequestGet: PagesFunction<AuthEnv> = async ({
  request,
  env,
}) => {
  const user = await getCurrentUser(env, request);
  if (!user) {
    return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  }
  let erlaubtePfade: string[];
  try {
    erlaubtePfade = await fetchPathsForSecurityLevel(env, user.sicherheitsstufe);
  } catch {
    return jsonResponse(
      { error: "Berechtigungsdaten sind derzeit nicht verfügbar" },
      { status: 503 },
    );
  }
  return jsonResponse({ user, erlaubtePfade }, { status: 200 });
};
