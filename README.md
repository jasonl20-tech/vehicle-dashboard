# Vehicle Dashboard

Modernes Fleet-/Fahrzeug-Analytics-Dashboard auf Basis von **Vite + React + TypeScript + TailwindCSS + Recharts**.
Deployment-Ziel: **Cloudflare Pages**.

Repository: [`jasonl20-tech/vehicle-dashboard`](https://github.com/jasonl20-tech/vehicle-dashboard)

## Features

- Sidebar-Navigation mit Suche und User-Card
- Übersichts-Dashboard mit KPI-Kacheln
- Fahrzeug-Analytics-Seite
  - Sparkline-KPIs (aktive Fahrzeuge / geplante Touren)
  - Auslastungs-Linienchart (Auslastung vs. Leerlauf)
  - Performance-Bar-Chart nach Fahrzeugtyp
  - Tabelle „Alle Fahrzeug-Performance" mit Suche, Tabs, Sortierung, Spaltenverwaltung & Export
- Tab-bare Sub-Seiten (Flotte, Fahrten, Fahrer, Wartung, Einstellungen)
- Mobile-freundliches Layout

## Tech Stack

- [Vite 5](https://vitejs.dev/)
- [React 18](https://react.dev/) + TypeScript
- [TailwindCSS 3](https://tailwindcss.com/)
- [Recharts](https://recharts.org/)
- [lucide-react](https://lucide.dev/)
- [react-router-dom](https://reactrouter.com/)

## Lokale Entwicklung

```bash
npm install
npm run dev
```

Build:

```bash
npm run build
npm run preview
```

## Deployment auf Cloudflare Pages

### Variante A – Über Git-Integration (empfohlen)

1. In Cloudflare Dashboard: **Workers & Pages → Create → Pages → Connect to Git**.
2. Repository `jasonl20-tech/vehicle-dashboard` auswählen.
3. Build-Einstellungen:
   - **Framework preset:** Vite
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Node version:** `22` (Environment Variable `NODE_VERSION=22`)
4. **Save & Deploy.**

Bei jedem Push auf `main` wird automatisch ein neues Deployment ausgerollt.

### Variante B – Direkt deployen via Wrangler

```bash
npm run build
npx wrangler pages deploy dist --project-name vehicle-dashboard
```

## Struktur

```
src/
  components/
    charts/      Sparkline / Line / Bar Charts
    layout/      Sidebar + Layout
    tables/      Performance-Tabelle
    ui/          Card, Tag, PageHeader
  pages/         Routen / Seiten
  App.tsx        Routing
  main.tsx       Entrypoint
public/
  _redirects     SPA-Fallback für Cloudflare Pages
```
