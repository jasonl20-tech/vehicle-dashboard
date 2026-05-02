import {
  BarChart3,
  Database,
  Globe,
  LayoutDashboard,
  LineChart,
  type LucideIcon,
  Mail,
  ScrollText,
  Server,
  Settings,
  UserPlus,
  Users,
  View,
  Wallet,
} from "lucide-react";
import { pathDirectlyAllowed } from "../../lib/routeAccess";

export type NavChild = { label: string; to: string; end?: boolean };
export type NavItem = {
  label: string;
  icon: LucideIcon;
  to?: string;
  children?: NavChild[];
};

export const NAV_PRIMARY: NavItem[] = [
  { label: "Übersicht", icon: LayoutDashboard, to: "/dashboard" },
  {
    label: "Ansichten",
    icon: View,
    children: [
      { label: "Bildaustrahlung", to: "/dashboard/ansichten/bildaustrahlung" },
      { label: "Bildempfang", to: "/dashboard/ansichten/bildempfang" },
      { label: "Anfragen Karte", to: "/dashboard/ansichten/anfragen-karte" },
    ],
  },
  {
    label: "Kundenmanagement",
    icon: Users,
    children: [
      { label: "CRM", to: "/dashboard/kunden/crm" },
      { label: "Anfragen", to: "/dashboard/kunden/anfragen" },
      { label: "Test Anfragen", to: "/dashboard/kunden/test-anfragen" },
      { label: "Kunden keys", to: "/dashboard/kunden/keys" },
      { label: "Kundentest keys", to: "/dashboard/kunden/test-keys" },
      { label: "Newsletter", to: "/dashboard/kunden/newsletter" },
    ],
  },
  { label: "Leads", icon: UserPlus, to: "/dashboard/leads" },
  {
    label: "API Analytics",
    icon: BarChart3,
    children: [
      { label: "Kunden API", to: "/dashboard/analytics/kunden-api" },
      { label: "Oneauto API", to: "/dashboard/analytics/oneauto-api" },
      { label: "Oneauto Reports", to: "/dashboard/analytics/oneauto-reports" },
    ],
  },
  {
    label: "Intern Analytics",
    icon: LineChart,
    children: [
      { label: "Controlling", to: "/dashboard/intern-analytics/controlling" },
      { label: "Job Übersicht", to: "/dashboard/intern-analytics/jobs" },
    ],
  },
  {
    label: "Zahlungen",
    icon: Wallet,
    children: [
      { label: "Zahlungslinks", to: "/dashboard/zahlungen/zahlungslinks" },
      { label: "Pläne", to: "/dashboard/zahlungen/plaene" },
    ],
  },
  {
    label: "Emails",
    icon: Mail,
    children: [
      { label: "Email Logs", to: "/dashboard/emails/logs" },
      { label: "Email Tracking", to: "/dashboard/emails/tracking" },
      { label: "Email Templates", to: "/dashboard/emails/templates" },
      { label: "Email Sending", to: "/dashboard/emails/sending" },
      { label: "Email Automator", to: "/dashboard/emails/automator" },
    ],
  },
  {
    label: "Webseite",
    icon: Globe,
    children: [
      { label: "Blogs", to: "/dashboard/website/blogs" },
      { label: "Landing Pages", to: "/dashboard/website/landing-pages" },
      { label: "FAQ", to: "/dashboard/website/faq" },
      { label: "Tutorials", to: "/dashboard/website/tutorials" },
      { label: "Whitepaper", to: "/dashboard/website/whitepaper" },
      { label: "Company Info", to: "/dashboard/website/company" },
      { label: "Changelog", to: "/dashboard/website/changelog" },
    ],
  },
  {
    label: "Datenbanken",
    icon: Database,
    children: [
      { label: "Produktions Datenbank", to: "/dashboard/databases/production" },
      { label: "Produktions Images", to: "/dashboard/databases/production-images" },
      { label: "Status", to: "/dashboard/databases/status" },
      { label: "Assets", to: "/dashboard/databases/assets" },
    ],
  },
  {
    label: "Systeme",
    icon: Server,
    children: [
      { label: "Prompts", to: "/dashboard/systeme/prompts" },
      { label: "Blockierte Fahrzeuge", to: "/dashboard/systeme/blockierte-fahrzeuge" },
      { label: "Mapping", to: "/dashboard/systeme/mapping" },
    ],
  },
  {
    label: "Logs",
    icon: ScrollText,
    children: [
      { label: "Skalierungs Worker", to: "/dashboard/logs/skalierungs-worker" },
      { label: "Generierungs Worker", to: "/dashboard/logs/generierungs-worker" },
    ],
  },
];

export const NAV_FOOTER: NavItem[] = [
  { label: "Einstellungen", icon: Settings, to: "/dashboard/settings" },
];

export type FlatRoute = {
  to: string;
  label: string;
  section: string;
  parentLabel?: string;
};

export function flattenNav(items: NavItem[] = [...NAV_PRIMARY, ...NAV_FOOTER]): FlatRoute[] {
  const out: FlatRoute[] = [];
  for (const it of items) {
    if (it.to) {
      out.push({ to: it.to, label: it.label, section: it.label });
    }
    if (it.children) {
      for (const c of it.children) {
        out.push({
          to: c.to,
          label: c.label,
          section: it.label,
          parentLabel: it.label,
        });
      }
    }
  }
  return out;
}

/** Sidebar: Untereinträge bzw. Top-Level nur anzeigen, wenn ein direktes Recht besteht. */
export function filterNavByAccess(
  items: NavItem[],
  erlaubtePfade: readonly string[],
): NavItem[] {
  const next: NavItem[] = [];
  for (const it of items) {
    if (it.children) {
      const children = it.children.filter((c) =>
        pathDirectlyAllowed(c.to, erlaubtePfade),
      );
      if (children.length > 0) {
        next.push({ ...it, children });
      }
    } else if (it.to && pathDirectlyAllowed(it.to, erlaubtePfade)) {
      next.push(it);
    }
  }
  return next;
}

/**
 * Erste tatsächlich erlaubte Navigationsroute (für Plattform-Kachel
 * „Dashboard" als Einstiegspunkt).
 */
export function firstAllowedNavRoute(
  items: NavItem[],
  erlaubtePfade: readonly string[],
): string | null {
  for (const it of items) {
    if (it.to && pathDirectlyAllowed(it.to, erlaubtePfade)) return it.to;
    if (it.children) {
      for (const c of it.children) {
        if (pathDirectlyAllowed(c.to, erlaubtePfade)) return c.to;
      }
    }
  }
  return null;
}
