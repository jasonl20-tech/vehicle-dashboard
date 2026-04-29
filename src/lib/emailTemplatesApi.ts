export const EMAIL_TEMPLATES_API = "/api/emails/templates" as const;

export type EmailTemplateRow = {
  id: string;
  subject: string;
  updated_at: string;
  /** Länge des HTML-Body (vom Server berechnet, in der Liste). */
  length: number;
};

export type EmailTemplate = {
  id: string;
  subject: string;
  body_html: string;
  updated_at: string;
};

export type EmailTemplatesListResponse = {
  rows: EmailTemplateRow[];
  total: number;
  limit: number;
  offset: number;
  hint?: string;
  schemaWarning?: string;
};

export function emailTemplatesListUrl(opts: {
  q?: string;
  limit?: number;
  offset?: number;
}): string {
  const p = new URLSearchParams();
  if (opts.q) p.set("q", opts.q);
  if (opts.limit != null) p.set("limit", String(opts.limit));
  if (opts.offset != null) p.set("offset", String(opts.offset));
  const qs = p.toString();
  return `${EMAIL_TEMPLATES_API}${qs ? `?${qs}` : ""}`;
}

export function emailTemplateUrl(id: string): string {
  return `${EMAIL_TEMPLATES_API}/${encodeURIComponent(id)}`;
}

async function asJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // bewusst leer
  }
  if (!res.ok) {
    const j = (json ?? {}) as { error?: string; hint?: string };
    const parts: string[] = [j.error || `HTTP ${res.status}`];
    if (j.hint) parts.push(`Hinweis: ${j.hint}`);
    throw new Error(parts.join(" • "));
  }
  return (json ?? null) as T;
}

export async function createEmailTemplate(input: {
  id: string;
  subject?: string;
  body_html?: string;
  copy_from_id?: string;
}): Promise<EmailTemplate> {
  const res = await fetch(EMAIL_TEMPLATES_API, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return asJson<EmailTemplate>(res);
}

export async function updateEmailTemplate(
  id: string,
  patch: { subject?: string; body_html?: string; new_id?: string },
): Promise<EmailTemplate> {
  const res = await fetch(emailTemplateUrl(id), {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return asJson<EmailTemplate>(res);
}

export async function deleteEmailTemplate(id: string): Promise<void> {
  const res = await fetch(emailTemplateUrl(id), {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as {
      error?: string;
      hint?: string;
    };
    const parts: string[] = [j.error || `HTTP ${res.status}`];
    if (j.hint) parts.push(`Hinweis: ${j.hint}`);
    throw new Error(parts.join(" • "));
  }
}

/**
 * Verfügbare Variablen-Platzhalter im Template-Editor.
 * Werden vom externen Mail-Worker zur Laufzeit ersetzt.
 */
export const EMAIL_TEMPLATE_VARIABLES: { token: string; label: string }[] = [
  { token: "{{name}}", label: "Name (Anrede)" },
  { token: "{{email}}", label: "E-Mail-Adresse" },
  { token: "{{company}}", label: "Firmenname" },
  { token: "{{first_name}}", label: "Vorname" },
  { token: "{{last_name}}", label: "Nachname" },
  { token: "{{key}}", label: "API-Key" },
  { token: "{{plan}}", label: "Plan-Name" },
  { token: "{{dashboard_url}}", label: "Dashboard-Link" },
  { token: "{{unsubscribe_url}}", label: "Abmeldelink" },
  { token: "{{date}}", label: "Aktuelles Datum" },
];
