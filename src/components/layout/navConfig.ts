import {
  BarChart3,
  Database,
  Globe,
  LayoutDashboard,
  LineChart,
  type LucideIcon,
  ScrollText,
  Server,
  Settings,
  Users,
  Wallet,
} from "lucide-react";

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
    label: "Kundenmanagement",
    icon: Users,
    children: [
      { label: "Anfragen", to: "/kunden/anfragen" },
      { label: "CRM", to: "/kunden/crm" },
      { label: "Kunden keys", to: "/kunden/keys" },
      { label: "Kundentest keys", to: "/kunden/test-keys" },
      { label: "Newsletter", to: "/kunden/newsletter" },
    ],
  },
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
    children: [{ label: "Controlling", to: "/intern-analytics/controlling" }],
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
    children: [{ label: "Produktions Datenbank", to: "/databases/production" }],
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
  { label: "Logs", icon: ScrollText, to: "/logs" },
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
