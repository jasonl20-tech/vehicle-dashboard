# Vehicle Dashboard

Modernes Fleet-Dashboard auf Basis von **Vite + React + TypeScript + TailwindCSS + Recharts**.
Backend (Auth + DB-Zugriff) läuft als **Cloudflare Pages Functions** mit einer **D1-Datenbank**.

Repository: [`jasonl20-tech/vehicle-dashboard`](https://github.com/jasonl20-tech/vehicle-dashboard)

## Features

- Editorial-/Linear-artiges UI ohne Card-/Bubble-Look
- Dunkle Sidebar mit ⌘K-Suche und User-Profil (Profilbild, Titel, Banner, Sicherheitsstufe)
- Login-Flow mit signierter Session (HMAC-SHA256, HttpOnly-Cookie)
- Geschützte Routen via `<ProtectedRoute>`
- Sortier-/such-/exportierbare Performance-Tabelle
- Übersicht, Flotte, Fahrten, Fahrer, Wartung, Einstellungen

## Cloudflare-Setup

### Bindings (im Pages-Dashboard)

- **D1-Database-Binding:** `user`  ← Variable-Name in den Functions: `env.user`
- **Environment Variable (Production + Preview):** `SESSION_SECRET` (mind. 16 Zeichen, am besten 64 zufällige Bytes hex)

### Tabelle `user`

```sql
CREATE TABLE user (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  benutzername     TEXT    NOT NULL UNIQUE,
  password         TEXT    NOT NULL,
  active           INTEGER NOT NULL DEFAULT 1,
  last_login       TEXT,
  titel            TEXT,
  sicherheitsstufe INTEGER DEFAULT 0,
  profilbild       TEXT,
  bannerfarbe      TEXT DEFAULT '#ffffff'
);
```

> **Sicherheitshinweis:** `password` ist in der aktuellen Implementierung als **Klartext** gespeichert.
> Für Produktion bitte auf einen Hash (PBKDF2 / Argon2id / bcrypt) umstellen und die Funktion
> `verifyPassword` in [`functions/_lib/auth.ts`](functions/_lib/auth.ts) entsprechend anpassen.

### API-Routen (Pages Functions)

| Methode | Pfad         | Zweck                                                 |
|---------|--------------|--------------------------------------------------------|
| `POST`  | `/api/login` | Body `{benutzername, password}` → setzt Session-Cookie |
| `POST`  | `/api/logout`| Cookie löschen                                         |
| `GET`   | `/api/me`    | Aktuellen Benutzer holen (oder `401`)                  |

Session-Cookie: `vh_session`, `HttpOnly; Secure; SameSite=Lax`, 7 Tage Laufzeit.

### Deployment

In Cloudflare:

1. **Workers & Pages → Create → Pages → Connect to Git** → Repo `jasonl20-tech/vehicle-dashboard`.
2. Build-Settings:
   - **Framework preset:** `Vite`
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Environment variable:** `NODE_VERSION=22`
3. Im Pages-Projekt unter **Settings → Functions → Bindings**:
   - D1 Binding: Variable `user` → deine D1-Database
4. Unter **Settings → Environment variables**:
   - `SESSION_SECRET = <zufälliger String, ≥16 Zeichen>` (für Production **und** Preview)
5. **Save → Deployment startet automatisch.**

> Wrangler-Konfiguration (`wrangler.toml`) gibt es im Repo bewusst nicht – du verwaltest Bindings vollständig im Cloudflare-Dashboard.

## Lokale Entwicklung

```bash
npm install
npm run dev          # Vite Dev-Server (nur Frontend, /api ruft 404)
npm run typecheck:functions   # tsc-Check für /functions
npm run build
```

## Struktur

```
src/
  components/
    auth/          ProtectedRoute
    layout/        Sidebar + Layout
    tables/        Performance-Tabelle
    ui/            PageHeader
  lib/
    auth.tsx       AuthProvider, useAuth
  pages/
    OverviewPage  ·  FleetPage
    LoginPage      ·  TripsPage     ·  DriversPage
    MaintenancePage ·  SettingsPage
  App.tsx
  main.tsx
functions/
  _lib/auth.ts     HMAC-Token, Cookie, getCurrentUser
  api/login.ts     POST  /api/login
  api/logout.ts    POST  /api/logout
  api/me.ts        GET   /api/me
public/
  _redirects       SPA-Fallback (`/* → /index.html 200`)
```
