/**
 * API-Katalog — automatisch generiert.
 * `node scripts/generate-api-catalog.mjs` oder `npm run generate:api-catalog`
 */

export type ApiCatalogEntry = {
  /** Vollständiger Pfad inkl. /api
   * Dynamische Segmente: :param (aus [param] im Dateisystem).
   */
  path: string;
  methods: readonly string[];
  /** Quelldatei relativ zum Repo-Root */
  source: string;
};

export const API_CATALOG_GENERATED_AT = "2026-05-03T11:01:06.448Z" as const;

export const API_CATALOG: readonly ApiCatalogEntry[] = [
  { path: "/api/analytics/_diag", methods: ["GET"], source: "functions/api/analytics/_diag.ts" },
  { path: "/api/analytics/customer-keys", methods: ["GET"], source: "functions/api/analytics/customer-keys.ts" },
  { path: "/api/analytics/oneauto-reports", methods: ["GET"], source: "functions/api/analytics/oneauto-reports.ts" },
  { path: "/api/assets", methods: ["GET"], source: "functions/api/assets/index.ts" },
  { path: "/api/assets/folders", methods: ["GET", "POST", "DELETE"], source: "functions/api/assets/folders.ts" },
  { path: "/api/assets/item", methods: ["GET", "PATCH", "DELETE"], source: "functions/api/assets/item.ts" },
  { path: "/api/assets/upload", methods: ["POST"], source: "functions/api/assets/upload.ts" },
  { path: "/api/billing/payment-link", methods: ["POST"], source: "functions/api/billing/payment-link.ts" },
  { path: "/api/billing/payment-link-archive", methods: ["POST"], source: "functions/api/billing/payment-link-archive.ts" },
  { path: "/api/billing/payment-links", methods: ["GET", "POST"], source: "functions/api/billing/payment-links.ts" },
  { path: "/api/billing/plans", methods: ["GET", "PUT"], source: "functions/api/billing/plans.ts" },
  { path: "/api/billing/stripe-prices", methods: ["GET"], source: "functions/api/billing/stripe-prices.ts" },
  { path: "/api/configs/active-controll-mode", methods: ["GET"], source: "functions/api/configs/active-controll-mode.ts" },
  { path: "/api/configs/controll-buttons", methods: ["GET"], source: "functions/api/configs/controll-buttons.ts" },
  { path: "/api/configs/controll-status", methods: ["POST"], source: "functions/api/configs/controll-status.ts" },
  { path: "/api/configs/first-views", methods: ["GET"], source: "functions/api/configs/first-views.ts" },
  { path: "/api/configs/generation-views", methods: ["GET"], source: "functions/api/configs/generation-views.ts" },
  { path: "/api/configs/google-image-search", methods: ["GET"], source: "functions/api/configs/google-image-search.ts" },
  { path: "/api/configs/inside-views", methods: ["GET"], source: "functions/api/configs/inside-views.ts" },
  { path: "/api/configs/preview-images", methods: ["GET"], source: "functions/api/configs/preview-images.ts" },
  { path: "/api/crm/customers", methods: ["GET", "POST", "PUT"], source: "functions/api/crm/customers.ts" },
  { path: "/api/customers/keys", methods: ["GET", "PUT"], source: "functions/api/customers/keys.ts" },
  { path: "/api/databases/vehicle-imagery", methods: ["GET", "PUT"], source: "functions/api/databases/vehicle-imagery.ts" },
  { path: "/api/databases/vehicle-imagery-controlling", methods: ["GET", "PUT"], source: "functions/api/databases/vehicle-imagery-controlling.ts" },
  { path: "/api/databases/vehicle-imagery-status", methods: ["GET"], source: "functions/api/databases/vehicle-imagery-status.ts" },
  { path: "/api/emails/jobs", methods: ["GET", "POST"], source: "functions/api/emails/jobs.ts" },
  { path: "/api/emails/jobs/:id", methods: ["GET"], source: "functions/api/emails/jobs/[id].ts" },
  { path: "/api/emails/jobs/:id/events", methods: ["GET"], source: "functions/api/emails/jobs/[id]/events.ts" },
  { path: "/api/emails/template-ai", methods: ["GET", "POST"], source: "functions/api/emails/template-ai.ts" },
  { path: "/api/emails/templates", methods: ["GET", "POST"], source: "functions/api/emails/templates.ts" },
  { path: "/api/emails/templates/:id", methods: ["GET", "PUT", "DELETE"], source: "functions/api/emails/templates/[id].ts" },
  { path: "/api/emails/timeline", methods: ["GET"], source: "functions/api/emails/timeline.ts" },
  { path: "/api/emails/tracking", methods: ["GET"], source: "functions/api/emails/tracking.ts" },
  { path: "/api/intern-analytics/controll-jobs", methods: ["GET"], source: "functions/api/intern-analytics/controll-jobs.ts" },
  { path: "/api/intern-analytics/controll-platform-action", methods: ["POST"], source: "functions/api/intern-analytics/controll-platform-action.ts" },
  { path: "/api/intern-analytics/controlling", methods: ["GET"], source: "functions/api/intern-analytics/controlling.ts" },
  { path: "/api/intern-analytics/diag", methods: ["GET"], source: "functions/api/intern-analytics/diag.ts" },
  { path: "/api/intern-analytics/image-url-requests-customer-arcs", methods: ["GET"], source: "functions/api/intern-analytics/image-url-requests-customer-arcs.ts" },
  { path: "/api/intern-analytics/image-url-requests-geo", methods: ["GET"], source: "functions/api/intern-analytics/image-url-requests-geo.ts" },
  { path: "/api/intern-analytics/image-url-requests-ip-breakdown", methods: ["GET"], source: "functions/api/intern-analytics/image-url-requests-ip-breakdown.ts" },
  { path: "/api/login", methods: ["POST"], source: "functions/api/login.ts" },
  { path: "/api/login-totp", methods: ["POST"], source: "functions/api/login-totp.ts" },
  { path: "/api/logout", methods: ["POST"], source: "functions/api/logout.ts" },
  { path: "/api/mapping", methods: ["GET", "POST", "PUT", "DELETE"], source: "functions/api/mapping.ts" },
  { path: "/api/me", methods: ["GET"], source: "functions/api/me.ts" },
  { path: "/api/mfa/disable", methods: ["POST"], source: "functions/api/mfa/disable.ts" },
  { path: "/api/mfa/enroll-confirm", methods: ["POST"], source: "functions/api/mfa/enroll-confirm.ts" },
  { path: "/api/mfa/enroll-start", methods: ["POST"], source: "functions/api/mfa/enroll-start.ts" },
  { path: "/api/mfa/status", methods: ["GET"], source: "functions/api/mfa/status.ts" },
  { path: "/api/overview/stats", methods: ["GET"], source: "functions/api/overview/stats.ts" },
  { path: "/api/setup-password", methods: ["GET", "POST"], source: "functions/api/setup-password.ts" },
  { path: "/api/system/blocked-vehicles", methods: ["GET", "PUT"], source: "functions/api/system/blocked-vehicles.ts" },
  { path: "/api/system/prompts", methods: ["GET", "PUT"], source: "functions/api/system/prompts.ts" },
  { path: "/api/system/seed-missing-view-regen-status", methods: ["GET", "POST"], source: "functions/api/system/seed-missing-view-regen-status.ts" },
  { path: "/api/vehicle-imagery/catalog", methods: ["GET"], source: "functions/api/vehicle-imagery/catalog.ts" },
  { path: "/api/website/newsletter", methods: ["GET"], source: "functions/api/website/newsletter.ts" },
  { path: "/api/website/submissions", methods: ["GET", "PATCH"], source: "functions/api/website/submissions.ts" },
  { path: "/api/website/submissions-by-country", methods: ["GET"], source: "functions/api/website/submissions-by-country.ts" },
  { path: "/api/website/trial-submissions", methods: ["GET", "PATCH"], source: "functions/api/website/trial-submissions.ts" },
];
