import { getCurrentUser, jsonResponse, type AuthEnv } from "../_lib/auth";

export const onRequestGet: PagesFunction<AuthEnv> = async ({
  request,
  env,
}) => {
  const user = await getCurrentUser(env, request);
  if (!user) {
    return jsonResponse({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const row = await env.user
    .prepare(
      "SELECT totp_enabled, totp_secret, totp_verified_at FROM user WHERE id = ?1 LIMIT 1",
    )
    .bind(user.id)
    .first<{
      totp_enabled: number | null;
      totp_secret: string | null;
      totp_verified_at: string | null;
    }>();

  const enabled = Number(row?.totp_enabled) === 1;
  const hasSecret = ((row?.totp_secret ?? "") as string).trim().length > 0;
  const enrollmentPending = !enabled && hasSecret;

  return jsonResponse(
    {
      totpEnabled: enabled,
      enrollmentPending,
      totpVerifiedAt: row?.totp_verified_at ?? null,
    },
    { status: 200 },
  );
};
