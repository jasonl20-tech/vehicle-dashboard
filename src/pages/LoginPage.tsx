import {
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Logo, LogoMark } from "../components/brand/Logo";
import { useAuth } from "../lib/auth";

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [benutzername, setBenutzername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setError(null);
  }, [benutzername, password]);

  if (loading) {
    return <FullScreenLoader />;
  }

  if (user) {
    const from = (location.state as { from?: string } | null)?.from;
    return (
      <Navigate to={from && from !== "/login" ? from : "/analytics"} replace />
    );
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
      <div className="grid min-h-screen lg:grid-cols-[1.1fr_minmax(0,1fr)]">
        <Hero />
        <div className="relative flex flex-col">
          {/* Mobile Brand */}
          <div className="px-6 pt-8 lg:hidden">
            <Logo className="h-5 w-auto text-ink-900" />
          </div>

          <div className="flex flex-1 items-center justify-center px-6 py-12 lg:px-16">
            <form
              onSubmit={onSubmit}
              noValidate
              className="w-full max-w-[380px]"
            >
              <div className="mb-10 hidden lg:flex">
                <Logo className="h-[18px] w-auto text-ink-900/70" />
              </div>

              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-ink-400">
                Anmeldung
              </p>
              <h1 className="mt-2 font-display text-[34px] leading-[1.05] tracking-tighter2 text-ink-900">
                Willkommen zurück.
              </h1>
              <p className="mt-2 text-[13.5px] leading-relaxed text-ink-500">
                Melde dich mit deinen Vehicleimagery-Zugangsdaten an, um deine
                Konsole zu öffnen.
              </p>

              <div className="mt-10 space-y-7">
                <Field
                  id="benutzername"
                  label="Benutzername"
                  value={benutzername}
                  onChange={setBenutzername}
                  autoFocus
                  autoComplete="username"
                  disabled={submitting}
                />
                <Field
                  id="password"
                  label="Passwort"
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={setPassword}
                  autoComplete="current-password"
                  disabled={submitting}
                  trailing={
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      className="rounded p-1 text-ink-400 transition-colors hover:text-ink-700"
                      aria-label={
                        showPw ? "Passwort verbergen" : "Passwort anzeigen"
                      }
                      tabIndex={-1}
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

              <div className="mt-6 flex items-center justify-between text-[12px]">
                <label className="inline-flex cursor-pointer select-none items-center gap-2 text-ink-600">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="sr-only"
                  />
                  <span
                    className={`grid h-[14px] w-[14px] place-items-center rounded-[3px] border transition-colors ${
                      remember
                        ? "border-ink-900 bg-ink-900"
                        : "border-ink-300 bg-white"
                    }`}
                    aria-hidden
                  >
                    <svg
                      viewBox="0 0 16 16"
                      className={`h-2.5 w-2.5 text-white transition-transform duration-150 ${
                        remember ? "scale-100" : "scale-0"
                      }`}
                      aria-hidden
                    >
                      <path
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3.5 8.5l3 3 6-7"
                      />
                    </svg>
                  </span>
                  Angemeldet bleiben
                </label>
                <button
                  type="button"
                  className="text-ink-500 underline-offset-4 transition-colors hover:text-ink-900 hover:underline"
                  onClick={() =>
                    setError(
                      "Bitte wende dich an deinen Workspace-Admin – Self-Service ist noch nicht aktiviert.",
                    )
                  }
                >
                  Hilfe?
                </button>
              </div>

              <ErrorMessage message={error} />

              <button
                type="submit"
                disabled={submitting}
                className="group relative mt-7 inline-flex w-full items-center justify-between gap-2 overflow-hidden rounded-md bg-ink-900 px-4 py-3 text-[13.5px] font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-70"
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-700 group-hover:translate-x-full"
                />
                <span className="relative">
                  {submitting ? "Authentifiziere…" : "Anmelden"}
                </span>
                <span className="relative inline-flex h-5 w-5 items-center justify-center">
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin opacity-90" />
                  ) : (
                    <ArrowRight className="h-4 w-4 opacity-90 transition-transform group-hover:translate-x-0.5" />
                  )}
                </span>
              </button>

              <div className="mt-8 flex items-center gap-2 text-[11px] text-ink-400">
                <ShieldCheck className="h-3.5 w-3.5 text-accent-mint" />
                <span>
                  Sitzung verschlüsselt gesigned (HMAC-SHA256), HttpOnly Cookie.
                </span>
              </div>
            </form>
          </div>

          <Footer />
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
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
  autoFocus?: boolean;
  trailing?: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <div className="group">
      <div className="flex items-center justify-between">
        <label
          htmlFor={id}
          className="text-[11px] font-medium uppercase tracking-[0.18em] text-ink-400 transition-colors group-focus-within:text-ink-900"
        >
          {label}
        </label>
      </div>
      <div className="relative mt-2">
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          disabled={disabled}
          required
          className="block w-full border-0 border-b border-hair bg-transparent py-2 pr-9 text-[15px] text-ink-900 placeholder:text-ink-300 focus:border-ink-800 focus:outline-none focus:ring-0 disabled:opacity-60"
          placeholder=" "
        />
        {/* animated focus underline */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -bottom-px h-px origin-left scale-x-0 bg-ink-900 transition-transform duration-300 group-focus-within:scale-x-100"
        />
        {trailing && (
          <div className="absolute right-0 top-1/2 -translate-y-1/2">
            {trailing}
          </div>
        )}
      </div>
    </div>
  );
}

function ErrorMessage({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="login-error mt-5 flex items-start gap-2.5 border-l-2 border-accent-rose bg-accent-rose/[0.06] px-3 py-2 text-[12.5px]"
    >
      <span
        aria-hidden
        className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-rose"
      />
      <span className="text-ink-700">{message}</span>
      <style>{`
        @keyframes vh-error-in {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .login-error { animation: vh-error-in .25s ease-out both; }
      `}</style>
    </div>
  );
}

function Footer() {
  return (
    <div className="hidden items-center justify-between border-t border-hair px-16 py-4 text-[11px] text-ink-400 lg:flex">
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5">
          <span className="relative inline-flex h-1.5 w-1.5">
            <span className="absolute inset-0 animate-ping rounded-full bg-accent-mint opacity-75" />
            <span className="relative inline-block h-1.5 w-1.5 rounded-full bg-accent-mint" />
          </span>
          Alle Systeme online
        </span>
        <span className="h-3 w-px bg-hair" />
        <span>Powered by Cloudflare D1</span>
      </div>
      <span>© {new Date().getFullYear()} Vehicleimagery</span>
    </div>
  );
}

function Hero() {
  return (
    <div className="relative isolate hidden overflow-hidden bg-night-900 text-night-200 lg:block">
      {/* Aurora */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-20 opacity-90 [filter:blur(60px)]"
        style={{
          background:
            "radial-gradient(40% 35% at 18% 22%, rgba(109,82,255,0.55), transparent 60%)," +
            "radial-gradient(35% 32% at 88% 78%, rgba(255,93,143,0.45), transparent 60%)," +
            "radial-gradient(30% 30% at 75% 18%, rgba(124,199,255,0.30), transparent 60%)",
        }}
      />
      {/* Grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] [background-size:56px_56px]"
      />
      {/* Subtle grain via radial dot */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.10] mix-blend-overlay"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.65) 1px, transparent 1px)",
          backgroundSize: "3px 3px",
        }}
      />
      {/* Watermark mark */}
      <LogoMark
        aria-hidden
        className="pointer-events-none absolute -bottom-16 -right-12 h-[70vh] w-auto text-white/[0.04]"
      />

      <div className="relative flex h-full flex-col justify-between p-12 xl:p-16">
        <div className="flex items-center gap-4">
          <Logo className="h-7 w-auto text-white" />
          <span className="hidden h-4 w-px bg-white/15 xl:block" />
          <span className="hidden text-[11px] font-medium uppercase tracking-[0.22em] text-night-400 xl:inline">
            Console
          </span>
        </div>

        <div className="max-w-xl">
          <p className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-brand-300">
            <span className="h-px w-6 bg-brand-300/60" />
            Imagery · Insights · Inventory
          </p>
          <h2 className="mt-5 font-display text-[clamp(40px,5vw,60px)] leading-[1.02] tracking-tighter2 text-white">
            Sieh jedes Fahrzeug –
            <br />
            <span className="bg-gradient-to-r from-brand-300 via-white to-accent-rose bg-clip-text text-transparent">
              bevor jemand anderes es tut.
            </span>
          </h2>
          <p className="mt-6 max-w-md text-[14.5px] leading-relaxed text-night-300">
            Die Vehicleimagery-Konsole bündelt Aufnahmen, Auswertungen und
            Bestand jedes Fahrzeugs an einem Ort – live aus deiner Cloudflare-D1.
          </p>

          <div className="mt-12 grid grid-cols-2 gap-6 max-w-md">
            <Stat value="142" label="Fahrzeuge erfasst" />
            <Stat value="9.8k" label="Aufnahmen verarbeitet" />
            <Stat value="76,2 %" label="Ø Auslastung" />
            <Stat value="< 200 ms" label="Edge-Latenz weltweit" />
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-night-400">
          <span>© {new Date().getFullYear()} Vehicleimagery</span>
          <span className="inline-flex items-center gap-1.5 normal-case tracking-normal">
            <span className="relative inline-flex h-1.5 w-1.5">
              <span className="absolute inset-0 animate-ping rounded-full bg-accent-mint opacity-75" />
              <span className="relative inline-block h-1.5 w-1.5 rounded-full bg-accent-mint" />
            </span>
            <span className="text-night-300">Edge online</span>
          </span>
        </div>
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="font-display text-[26px] leading-none tracking-tighter2 text-white">
        {value}
      </p>
      <p className="mt-1.5 text-[11px] uppercase tracking-[0.16em] text-night-400">
        {label}
      </p>
    </div>
  );
}

function FullScreenLoader() {
  return (
    <div className="min-h-screen grid place-items-center bg-paper">
      <div className="flex items-center gap-2 text-[12px] uppercase tracking-[0.18em] text-ink-400">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-500" />
        Lade Sitzung
      </div>
    </div>
  );
}
