import {
  ArrowRight,
  Car,
  Eye,
  EyeOff,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [benutzername, setBenutzername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setError(null);
  }, [benutzername, password]);

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-paper">
        <div className="flex items-center gap-2 text-[12px] uppercase tracking-[0.18em] text-ink-400">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-500" />
          Lade Sitzung
        </div>
      </div>
    );
  }

  if (user) {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from && from !== "/login" ? from : "/analytics"} replace />;
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await login(benutzername, password);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from && from !== "/login" ? from : "/analytics", {
        replace: true,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Anmeldung fehlgeschlagen");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen w-full bg-paper">
      <div className="grid min-h-screen lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        <Hero />
        <div className="flex items-center justify-center px-6 py-14 lg:px-14">
          <form
            onSubmit={onSubmit}
            className="w-full max-w-[380px]"
            noValidate
          >
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-ink-400">
              Anmeldung
            </p>
            <h1 className="mt-2 font-display text-[34px] leading-[1.05] tracking-tighter2 text-ink-900">
              Willkommen zurück.
            </h1>
            <p className="mt-2 text-[13.5px] leading-relaxed text-ink-500">
              Melde dich mit deinen Zugangsdaten an, um dein Fleet-Dashboard zu
              öffnen.
            </p>

            <div className="mt-10 space-y-6">
              <Field
                id="benutzername"
                label="Benutzername"
                value={benutzername}
                onChange={setBenutzername}
                autoFocus
                autoComplete="username"
              />
              <Field
                id="password"
                label="Passwort"
                type={showPw ? "text" : "password"}
                value={password}
                onChange={setPassword}
                autoComplete="current-password"
                trailing={
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="text-ink-400 hover:text-ink-700"
                    aria-label={showPw ? "Passwort verbergen" : "Passwort anzeigen"}
                  >
                    {showPw ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                }
              />
            </div>

            {error && (
              <div
                role="alert"
                className="mt-5 flex items-start gap-2 border-l-2 border-accent-rose bg-accent-rose/[0.06] px-3 py-2 text-[12.5px] text-accent-rose"
              >
                <span className="mt-0.5">●</span>
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="mt-8 inline-flex w-full items-center justify-between gap-2 rounded-md bg-ink-900 px-4 py-3 text-[13.5px] font-medium text-white transition hover:bg-ink-800 disabled:opacity-60"
            >
              <span>{submitting ? "Melde an…" : "Anmelden"}</span>
              <ArrowRight className="h-4 w-4 opacity-80" />
            </button>

            <p className="mt-8 text-[11.5px] text-ink-400">
              Probleme beim Anmelden? Wende dich an deinen Workspace-Admin.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  autoFocus,
  trailing,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
  autoFocus?: boolean;
  trailing?: React.ReactNode;
}) {
  return (
    <label htmlFor={id} className="block">
      <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.16em] text-ink-400">
        {label}
      </span>
      <div className="relative">
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          required
          className="block w-full border-0 border-b border-hair bg-transparent py-2 pr-8 text-[15px] text-ink-900 placeholder:text-ink-300 focus:border-ink-800 focus:outline-none focus:ring-0"
          placeholder=" "
        />
        {trailing && (
          <div className="absolute right-0 top-1/2 -translate-y-1/2">
            {trailing}
          </div>
        )}
      </div>
    </label>
  );
}

function Hero() {
  return (
    <div className="relative hidden overflow-hidden bg-night-900 text-night-200 lg:block">
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.45]"
        style={{
          background:
            "radial-gradient(900px 500px at 20% 10%, rgba(109,82,255,0.45), transparent 60%)," +
            "radial-gradient(700px 500px at 90% 90%, rgba(255,93,143,0.30), transparent 60%)," +
            "radial-gradient(500px 400px at 80% 20%, rgba(124,199,255,0.18), transparent 60%)",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] [background-size:48px_48px]"
      />
      <div className="relative flex h-full flex-col justify-between p-12">
        <div className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center overflow-hidden rounded-lg bg-gradient-to-br from-brand-500 via-brand-600 to-night-700 ring-1 ring-white/10">
            <Car className="h-4 w-4 text-white" />
          </div>
          <div className="leading-tight">
            <p className="text-[14px] font-semibold tracking-tight text-white">
              vehiclehub
            </p>
            <p className="text-[10.5px] uppercase tracking-[0.14em] text-night-400">
              Fleet OS
            </p>
          </div>
        </div>

        <div className="max-w-md">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-brand-300">
            Fleet Operations
          </p>
          <h2 className="mt-3 font-display text-[44px] leading-[1.05] tracking-tighter2 text-white">
            Deine Flotte –
            <br />
            <span className="text-brand-300">scharf gestellt.</span>
          </h2>
          <p className="mt-5 max-w-sm text-[14px] leading-relaxed text-night-300">
            Auslastung, Verbrauch, Wartung und Live-Standort jedes Fahrzeugs.
            Eine Konsole, alles im Griff – live aus deiner D1 in Cloudflare.
          </p>

          <div className="mt-10 grid grid-cols-1 gap-4 text-[12.5px] text-night-300">
            <Bullet icon={ShieldCheck}>
              Sicheres Login mit signierter Session.
            </Bullet>
            <Bullet icon={Zap}>
              Echtzeit-KPIs direkt aus Cloudflare D1.
            </Bullet>
            <Bullet icon={Sparkles}>
              Editorial-UI – ohne unnötige Boxen.
            </Bullet>
          </div>
        </div>

        <p className="text-[11px] uppercase tracking-[0.18em] text-night-400">
          © {new Date().getFullYear()} vehiclehub · Internal use only
        </p>
      </div>
    </div>
  );
}

function Bullet({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-7 w-7 place-items-center rounded-md bg-white/[0.05] ring-1 ring-white/10">
        <Icon className="h-3.5 w-3.5 text-brand-300" />
      </span>
      <span>{children}</span>
    </div>
  );
}
