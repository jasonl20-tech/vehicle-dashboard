# Vehicle Dashboard

Modernes Fleet-Dashboard auf Basis von **Vite + React + TypeScript + TailwindCSS + Recharts**.
Backend (Auth + DB-Zugriff) läuft als **Cloudflare Pages Functions** mit einer **D1-Datenbank**.

Repository: [`jasonl20-tech/vehicle-dashboard`](https://github.com/jasonl20-tech/vehicle-dashboard)

## Features

- Editorial-/Linear-artiges UI ohne Card-/Bubble-Look
- Dunkle Sidebar mit ⌘K-Suche und User-Profil (Profilbild, Titel, Banner, Sicherheitsstufe)
- Login-Flow mit signierter Session (HMAC-SHA256, HttpOnly-Cookie)
- Geschützte Routen via `<ProtectedRoute>` inkl. Sicherheitsstufen (D1-Tabelle `sicherheitsstufen`, Platzhalter `*`, Bereiche wie `/dashboard/*`)
- Sortier-/such-/exportierbare Performance-Tabelle
- Übersicht, Flotte, Fahrten, Fahrer, Wartung, Einstellungen

## Cloudflare-Setup

### Bindings (im Pages-Dashboard)

- **D1-Database-Binding:** `user`  ← Variable-Name in den Functions: `env.user`
- **KV-Namespace-Binding (Zahlungslinks / Pläne):** Variable **`plans`** → verweist auf `env.plans` in den Functions (Plan-JSON pro Key, Koppelung an Stripe Payment Link Metadaten `price_id`)
- **Environment Variable (Production + Preview):** `SESSION_SECRET` (mind. 16 Zeichen, am besten 64 zufällige Bytes hex)
- **`password_secret`:** Pepper für PBKDF2-SHA256 in `user.password` ([`functions/_lib/passwordHash.ts`](functions/_lib/passwordHash.ts)); in Cloudflare als Variable genau so angelegt (`env.password_secret`). **Mind. 16 Zeichen**, derselbe Wert auf allen Instanzen mit derselben `user`‑D1. Optional zusätzlich **`PASSWORD_SECRET`** (wird nur genutzt, wenn `password_secret` fehlt oder zu kurz ist).
- **Secret (ebenfalls Production + Preview):** `STRIPE_SECRET_KEY` = `sk_live_…` bzw. `sk_test_…` (nur serverseitig; kein `pk_` im Frontend nötig für diese Seite)

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

**Optional — TOTP (Authenticator-App):** zusätzliche Spalten per Migration [`migrations/001_totp_columns.sql`](migrations/001_totp_columns.sql):

```sql
ALTER TABLE user ADD COLUMN totp_secret TEXT;
ALTER TABLE user ADD COLUMN totp_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user ADD COLUMN totp_verified_at TEXT;
```

**Optional — 2FA-Pflicht pro Nutzer:** [`migrations/002_user_require_2fa.sql`](migrations/002_user_require_2fa.sql):

```sql
ALTER TABLE user ADD COLUMN require_2fa INTEGER NOT NULL DEFAULT 0;
```

- `require_2fa = 1`: 2FA ist Pflicht. Solange der Nutzer keinen Authenticator
  hinterlegt hat, sperrt das Frontend die UI mit einem nicht schließbaren
  Setup-Modal und die API-Middleware blockiert alle Routen ausser
  `/api/mfa/*`, `/api/me`, `/api/logout`. `/api/mfa/disable` ist in diesem
  Modus serverseitig deaktiviert.
- `require_2fa = 0` (Default): TOTP ist optional und kann unter
  `/account` selbst aktiviert/deaktiviert werden.

Die Spalte `user.password` speichert **PBKDF2-SHA256**-Strings (Format `v1|…`; siehe [`functions/_lib/passwordHash.ts`](functions/_lib/passwordHash.ts)) mit zufälligem Salt und gemeinsamem Pepper aus **`password_secret`** (bzw. Fallback `PASSWORD_SECRET`). **Ältere Klartext-Zeilen** werden weiter akzeptiert und beim nächsten erfolgreichen Login automatisch auf einen Hash umgestellt, sobald der Pepper gesetzt ist. Fehlt der Pepper bei bereits gehashten Accounts, schlagen Logins fehl, bis derselbe Wert wie beim Hashen wieder gesetzt ist.

### Tabelle `sicherheitsstufen` (Routen pro Sicherheitsstufe)

In derselben D1 wie `user` (`env.user`). Für jeden erlaubten Pfad eine Zeile:

```sql
CREATE TABLE sicherheitsstufen (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  sicherheitsstufe_id INTEGER NOT NULL,
  pfad                TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sicherheitsstufen_stufe ON sicherheitsstufen (sicherheitsstufe_id);
```

- `sicherheitsstufe_id` entspricht `user.sicherheitsstufe`.
- `pfad`: **`*`** = alles; **`/dashboard`** = nur genau diese Route; **`/dashboard/*`** = `/dashboard` und alle Unterpfade unter `/dashboard/…`; für JSON-Endpunkte z. B. **`/api/overview/*`** (Middleware prüft die URL ohne Query-String).

Whitelist-Modus: Sind für eine `sicherheitsstufe_id` **keine** Zeilen hinterlegt, gibt es **keinen** Zugriff auf irgendeine Route. Plattform-Start (`/`) bleibt sichtbar – damit ein User mit fehlenden Rechten zumindest abmelden kann.

#### Eltern-Pfad als „Transit"

Damit Index-Redirects funktionieren (z. B. `/kunden` → `/kunden/anfragen`, `/ansichten` → `/ansichten/bildaustrahlung`), gilt **nur im Frontend** (`ProtectedRoute`):

> Hat ein User **irgendeinen** erlaubten Pfad **unterhalb** von `X` (z. B. `/X/foo` oder `/X/*`), darf er auch `X` aufrufen – aber nur als Durchgang. In Sidebar, Befehlspalette und Plattform-Kacheln werden Pfade weiterhin **direkt** ausgewertet, damit dort nichts „Leeres" auftaucht.

In der API-Middleware gibt es **kein** Transit; jede `/api/...`-Route muss explizit erlaubt sein.

#### Plattform-Kachel „Dashboard"

Die Dashboard-Kachel auf der Startseite wird angezeigt, sobald **mindestens ein** Sidebar-Eintrag erlaubt ist. Klick landet auf der ersten erlaubten Route in der Reihenfolge der Navigation – also automatisch z. B. `/kunden/anfragen`, wenn `/dashboard` selbst nicht freigegeben ist.

#### Beispiele

Stufe 0 darf alles:

```sql
INSERT INTO sicherheitsstufen (sicherheitsstufe_id, pfad) VALUES (0, '*');
```

Stufe 2 sieht nur Kundenmanagement und benötigte APIs:

```sql
INSERT INTO sicherheitsstufen (sicherheitsstufe_id, pfad) VALUES
  (2, '/dashboard/kunden/*'),
  (2, '/api/crm/*'),
  (2, '/api/customers/*'),
  (2, '/api/website/submissions'),
  (2, '/api/website/trial-submissions');
```

Stufe 3 nur eine konkrete Unterseite:

```sql
INSERT INTO sicherheitsstufen (sicherheitsstufe_id, pfad) VALUES
  (3, '/dashboard/kunden/anfragen'),
  (3, '/api/website/submissions');
```

Stufe 4 darf alles im Dashboard inkl. aller Unterbereiche:

```sql
INSERT INTO sicherheitsstufen (sicherheitsstufe_id, pfad) VALUES
  (4, '/dashboard/*'),
  (4, '/api/*');
```

Routenstruktur (Auszug):

| Bereich | Pfad |
|---------|------|
| Übersicht | `/dashboard` |
| Ansichten | `/dashboard/ansichten/*` |
| Kundenmanagement | `/dashboard/kunden/*` |
| Leads | `/dashboard/leads` |
| API Analytics | `/dashboard/analytics/*` |
| Intern Analytics | `/dashboard/intern-analytics/*` |
| Zahlungen | `/dashboard/zahlungen/*` |
| Emails | `/dashboard/emails/*` |
| Webseite | `/dashboard/website/*` |
| Datenbanken | `/dashboard/databases/*` |
| Systeme | `/dashboard/systeme/*` |
| Logs | `/dashboard/logs/*` |
| User Settings | `/account` (eigene Top-Level-Route, nicht unter `/dashboard`) |
| Control Platform | `/control-platform` |
| N8N (Redirect) | `/n8n` |
| Social Media (Redirect) | `/socialmediamanager` |
| Docusign (Redirect) | `/docusign` |

Geschützte **SPA-Routen** über [`ProtectedRoute`](src/components/auth/ProtectedRoute.tsx) und gefilterte Navigation; geschützte **API-Aufrufe** über [`functions/api/_middleware.ts`](functions/api/_middleware.ts). Vor der Session ohne Routenliste: **`/api/login`**, **`/api/login-totp`** (TOTP-Zweitschritt nach Login), **`/api/setup-password`**, **`/api/logout`**. **`GET /api/me`** sowie alle **`/api/mfa/*`** (nur mit gültiger Session, ohne Pfadliste) laden bzw. verwalten den aktuellen User bzw. MFA.

### API-Routen (Pages Functions)

| Methode | Pfad         | Zweck                                                 |
|---------|--------------|--------------------------------------------------------|
| `POST`  | `/api/login` | Body `{benutzername, password}` → Session oder `{ needsTotp, mfaPendingToken }`, oder Passwort-Setup |
| `POST`  | `/api/login-totp` | Body `{ mfaPendingToken, code }` → Session nach erfolgreicher TOTP-Prüfung |
| `POST`  | `/api/logout`| Cookie löschen                                         |
| `GET`   | `/api/me`    | `{ user, erlaubtePfade }` oder `401` / bei D1-Fehler `503` |
| `GET`   | `/api/mfa/status` | (Login) TOTP-Status |
| `POST`  | `/api/mfa/enroll-start` | (Login) neues Secret, beginnt Enrollment |
| `POST`  | `/api/mfa/enroll-confirm` | (Login) 6-stelligen Code bestätigen, 2FA aktivieren |
| `POST`  | `/api/mfa/disable` | (Login) MFA mit Passwort deaktivieren |
| `GET`   | `/api/billing/payment-links` | (Login) Stripe Payment Links listen |
| `POST`  | `/api/billing/payment-links` | (Login) Payment Link in Stripe anlegen, nur `{"planKey"}`; `stripe_price_id` kommt aus dem Plan-JSON im KV |
| `POST`  | `/api/billing/payment-link`   | (Login) Metadaten am Payment Link setzen (`price_id` → KV-Key) |
| `POST`  | `/api/billing/payment-link-archive` | (Login) `{ paymentLinkId, active }` – archivieren (`false`) oder aktivieren (`true`) |
| `GET`   | `/api/billing/plans`         | (Login) alle KV-Keys; `?key=…` liefert JSON |
| `PUT`   | `/api/billing/plans`         | (Login) Plan-JSON speichern (kein Löschen) |

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
   - Optional KV: Variable **`plans`** → Namespace für Zahlungslink-/Pläne (siehe oben)
4. Unter **Settings → Environment variables**:
   - `SESSION_SECRET = <zufälliger String, ≥16 Zeichen>` (für Production **und** Preview)
   - `password_secret` (≥16 Zeichen, **`env.password_secret`**) — gleicher Wert auf allen Diensten mit derselben `user`-D1; bei Bedarf Fallback `PASSWORD_SECRET`
   - `STRIPE_SECRET_KEY` (Secret) für `/zahlungslinks`
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
    MaintenancePage ·  AccountPage
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
