import { getCurrentUser, jsonResponse, type AuthEnv } from "../_lib/auth";

export const onRequestGet: PagesFunction<AuthEnv> = async ({
  request,
  env,
}) => {
  const user = await getCurrentUser(env, request);
  if (!user) {
    return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  }
  return jsonResponse({ user }, { status: 200 });
};
