import { clearSessionCookie, jsonResponse } from "../_lib/auth";

export const onRequestPost: PagesFunction = async () => {
  return jsonResponse(
    { ok: true },
    {
      status: 200,
      headers: { "Set-Cookie": clearSessionCookie() },
    },
  );
};
