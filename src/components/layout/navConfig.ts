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
      { label: "Bildaustrahlung", to: "/ansichten/bildaustrahlung" },
      { label: "Bildempfang", to: "/ansichten/bildempfang" },
      { label: "Anfragen Karte", to: "/ansichten/anfragen-karte" },
    ],
  },
  {
    label: "Kundenmanagement",
    icon: Users,
    children: [
      { label: "CRM", to: "/kunden/crm" },
      { label: "Anfragen", to: "/kunden/anfragen" },
      { label: "Test Anfragen", to: "/kunden/test-anfragen" },
      { label: "Kunden keys", to: "/kunden/keys" },
      { label: "Kundentest keys", to: "/kunden/test-keys" },
      { label: "Newsletter", to: "/kunden/newsletter" },
    ],
  },
  { label: "Leads", icon: UserPlus, to: "/leads" },
  {
    label: "API Analytics",
    icon: BarChart3,
    children: [
      { label: "Kunden API", to: "/analytics/kunden-api" },
      { label: "Oneauto API", to: "/analytics/oneauto-api" },
      { label: "Oneauto Reports", to: "/analytics/oneauto-reports" },
    ],
  },
  {
    label: "Intern Analytics",
    icon: LineChart,
    children: [
      { label: "Controlling", to: "/intern-analytics/controlling" },
      { label: "Job Übersicht", to: "/intern-analytics/jobs" },
    ],
  },
  {
    label: "Zahlungen",
    icon: Wallet,
    children: [
      { label: "Zahlungslinks", to: "/zahlungen/zahlungslinks" },
      { label: "Pläne", to: "/zahlungen/plaene" },
    ],
  },
  {
    label: "Emails",
    icon: Mail,
    children: [
      { label: "Email Logs", to: "/emails/logs" },
      { label: "Email Tracking", to: "/emails/tracking" },
      { label: "Email Templates", to: "/emails/templates" },
      { label: "Email Sending", to: "/emails/sending" },
      { label: "Email Automator", to: "/emails/automator" },
    ],
  },
  {
    label: "Webseite",
    icon: Globe,
    children: [
      { label: "Blogs", to: "/website/blogs" },
      { label: "Landing Pages", to: "/website/landing-pages" },
      { label: "FAQ", to: "/website/faq" },
      { label: "Tutorials", to: "/website/tutorials" },
      { label: "Whitepaper", to: "/website/whitepaper" },
      { label: "Company Info", to: "/website/company" },
      { label: "Changelog", to: "/website/changelog" },
    ],
  },
  {
    label: "Datenbanken",
    icon: Database,
    children: [
      { label: "Produktions Datenbank", to: "/databases/production" },
      { label: "Produktions Images", to: "/databases/production-images" },
      { label: "Status", to: "/databases/status" },
      { label: "Assets", to: "/databases/assets" },
    ],
  },
  {
    label: "Systeme",
    icon: Server,
    children: [
      { label: "Prompts", to: "/systeme/prompts" },
      { label: "Blockierte Fahrzeuge", to: "/systeme/blockierte-fahrzeuge" },
      { label: "Mapping", to: "/systeme/mapping" },
    ],
  },
  {
    label: "Logs",
    icon: ScrollText,
    children: [
      { label: "Skalierungs Worker", to: "/logs/skalierungs-worker" },
      { label: "Generierungs Worker", to: "/logs/generierungs-worker" },
    ],
  },
];

export const NAV_FOOTER: NavItem[] = [
  { label: "Einstellungen", icon: Settings, to: "/settings" },
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
