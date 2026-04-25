import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Logo, LogoMark } from "../components/brand/Logo";
import { useAuth } from "../lib/auth";

export default function LoginPage() {
  const { user, loading, login, setupPassword } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [benutzername, setBenutzername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Wenn der Server „needs-setup" antwortet, halten wir hier den
  // Setup-Token + Benutzername fest und zeigen das Modal.
  const [setup, setSetup] = useState<
    { token: string; benutzername: string } | null
  >(null);

  useEffect(() => {
    setError(null);
  }, [benutzername, password]);

  const target = useMemo(() => {
    const from = (location.state as { from?: string } | null)?.from;
    return from && from !== "/login" ? from : "/dashboard";
  }, [location.state]);

  if (loading) {
    return <FullScreenLoader />;
  }

  if (user) {
    return <Navigate to={target} replace />;
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await login(benutzername, password);
      if (res.kind === "needs-setup") {
        setSetup({ token: res.setupToken, benutzername: res.benutzername });
        return;
      }
      navigate(target, { replace: true });
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

      {setup && (
        <PasswordSetupModal
          benutzername={setup.benutzername}
          token={setup.token}
          onClose={() => setSetup(null)}
          onDone={async (newPassword) => {
            await setupPassword(setup.token, newPassword);
            setSetup(null);
            navigate(target, { replace: true });
          }}
        />
      )}
    </div>
  );
}

// ---------- Form-Field ----------

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
          className="block w-full border-0 border-b border-hair bg-transparent py-2 pr-9 text-[15px] text-ink-900 placeholder:text-ink-300 focus:border-ink-800 focus:outline-none focus:ring-0 disabled:opacity-60"
          placeholder=" "
        />
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

// ---------- Error / Footer / Loader ----------

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

// ---------- Hero (links, rein visuell) ----------

function Hero() {
  return (
    <div className="relative isolate hidden overflow-hidden bg-night-900 lg:block">
      {/* Aurora */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-32 opacity-80 [filter:blur(80px)]"
        style={{
          background:
            "radial-gradient(38% 32% at 22% 28%, rgba(109,82,255,0.45), transparent 60%)," +
            "radial-gradient(34% 30% at 82% 74%, rgba(255,93,143,0.28), transparent 60%)," +
            "radial-gradient(28% 26% at 70% 18%, rgba(124,199,255,0.20), transparent 60%)",
        }}
      />
      {/* Grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.05] [background-image:linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] [background-size:64px_64px]"
      />
      {/* Halftone-Dots */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.08] mix-blend-overlay"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "3px 3px",
        }}
      />

      {/* Großes V als architektonisches Element */}
      <LogoMark
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -right-20 h-[88vh] w-auto text-white/[0.035]"
      />

      {/* Inhalt: nur Logo, sonst nichts. */}
      <div className="relative flex h-full min-h-screen items-center justify-center p-12">
        <Logo className="h-9 w-auto text-white/95 xl:h-11" />
      </div>

      {/* Subtiler Status-Indicator unten */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between p-12 text-[10.5px] uppercase tracking-[0.22em] text-night-500">
        <span>Console</span>
        <span className="inline-flex items-center gap-1.5 normal-case tracking-normal text-night-400">
          <span className="relative inline-flex h-1.5 w-1.5">
            <span className="absolute inset-0 animate-ping rounded-full bg-accent-mint opacity-75" />
            <span className="relative inline-block h-1.5 w-1.5 rounded-full bg-accent-mint" />
          </span>
          Edge online
        </span>
      </div>
    </div>
  );
}

// ---------- Passwort-Setup-Modal ----------

function PasswordSetupModal({
  benutzername,
  onClose,
  onDone,
}: {
  benutzername: string;
  token: string;
  onClose: () => void;
  onDone: (password: string) => Promise<void>;
}) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checks = useMemo(() => {
    return {
      length: pw.length >= 8,
      letter: /[a-zA-ZäöüÄÖÜß]/.test(pw),
      digit: /\d/.test(pw),
      symbol: /[^A-Za-z0-9]/.test(pw),
    };
  }, [pw]);

  const score = Object.values(checks).filter(Boolean).length;
  const match = pw.length > 0 && pw === pw2;

  // ESC schließt
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !submitting) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, submitting]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    if (!checks.length) {
      setError("Passwort muss mindestens 8 Zeichen lang sein.");
      return;
    }
    if (!match) {
      setError("Die Passwörter stimmen nicht überein.");
      return;
    }

    setSubmitting(true);
    try {
      await onDone(pw);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Konnte Passwort nicht setzen",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="vh-modal-root fixed inset-0 z-50 grid place-items-center px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="setup-title"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Schließen"
        onClick={() => !submitting && onClose()}
        className="vh-modal-backdrop absolute inset-0 cursor-default bg-night-900/55 backdrop-blur-sm"
      />

      {/* Card */}
      <div className="vh-modal-card relative w-full max-w-[440px] overflow-hidden rounded-xl border border-hair bg-paper shadow-[0_30px_80px_-30px_rgba(15,18,30,0.45)]">
        {/* Top accent */}
        <div
          aria-hidden
          className="h-[3px] w-full bg-gradient-to-r from-brand-500 via-accent-rose to-accent-mint"
        />

        <div className="px-7 pt-7 pb-6">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-md bg-ink-900 text-white">
              <KeyRound className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10.5px] font-medium uppercase tracking-[0.2em] text-ink-400">
                Erste Anmeldung
              </p>
              <h2
                id="setup-title"
                className="font-display text-[22px] leading-tight tracking-tighter2 text-ink-900"
              >
                Lege dein Passwort fest
              </h2>
            </div>
          </div>

          <p className="mt-4 text-[13px] leading-relaxed text-ink-500">
            Für{" "}
            <span className="font-medium text-ink-900">
              {benutzername}
            </span>{" "}
            ist noch kein Passwort hinterlegt. Setze jetzt ein eigenes – damit
            wirst du anschließend direkt angemeldet.
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-6" noValidate>
            <Field
              id="newpw"
              label="Neues Passwort"
              value={pw}
              onChange={setPw}
              type={show ? "text" : "password"}
              autoFocus
              autoComplete="new-password"
              disabled={submitting}
              trailing={
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  className="rounded p-1 text-ink-400 transition-colors hover:text-ink-700"
                  aria-label={
                    show ? "Passwort verbergen" : "Passwort anzeigen"
                  }
                  tabIndex={-1}
                >
                  {show ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              }
            />

            <StrengthMeter score={score} />

            <Field
              id="newpw2"
              label="Passwort bestätigen"
              value={pw2}
              onChange={setPw2}
              type={show ? "text" : "password"}
              autoComplete="new-password"
              disabled={submitting}
              trailing={
                pw2.length > 0 ? (
                  match ? (
                    <Check className="h-4 w-4 text-accent-mint" />
                  ) : (
                    <span className="text-[11px] uppercase tracking-[0.16em] text-accent-rose">
                      ≠
                    </span>
                  )
                ) : null
              }
            />

            <ChecklistRow ok={checks.length} text="Mindestens 8 Zeichen" />
            <div className="-mt-3 grid grid-cols-3 gap-2 text-[11px] text-ink-500">
              <RuleChip ok={checks.letter} label="Buchstabe" />
              <RuleChip ok={checks.digit} label="Zahl" />
              <RuleChip ok={checks.symbol} label="Symbol" />
            </div>

            <ErrorMessage message={error} />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => !submitting && onClose()}
                disabled={submitting}
                className="rounded-md px-3 py-2 text-[12.5px] text-ink-500 transition-colors hover:text-ink-900 disabled:opacity-50"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                disabled={submitting || !checks.length || !match}
                className="group inline-flex items-center gap-2 rounded-md bg-ink-900 px-4 py-2 text-[12.5px] font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span>
                  {submitting ? "Speichere…" : "Passwort setzen"}
                </span>
                {submitting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                )}
              </button>
            </div>
          </form>
        </div>

        <div className="border-t border-hair bg-night-900/[0.02] px-7 py-3 text-[11px] text-ink-400">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-accent-mint" />
            Wird verschlüsselt übertragen, danach in deiner Vehicleimagery-Datenbank
            gespeichert.
          </span>
        </div>
      </div>

      <style>{`
        @keyframes vh-modal-in {
          from { opacity: 0; transform: translateY(8px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0)   scale(1);    }
        }
        @keyframes vh-modal-fade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .vh-modal-card     { animation: vh-modal-in   .22s cubic-bezier(.2,.8,.2,1) both; }
        .vh-modal-backdrop { animation: vh-modal-fade .18s ease-out both; }
      `}</style>
    </div>
  );
}

function StrengthMeter({ score }: { score: number }) {
  const segs = 4;
  const colors = [
    "bg-accent-rose",
    "bg-accent-amber",
    "bg-brand-400",
    "bg-accent-mint",
  ];
  const labels = ["Schwach", "Okay", "Gut", "Stark"];
  const idx = Math.max(0, Math.min(score, segs)) - 1;
  return (
    <div>
      <div className="flex gap-1">
        {Array.from({ length: segs }).map((_, i) => (
          <span
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i < score ? colors[idx >= 0 ? idx : 0] : "bg-hair"
            }`}
          />
        ))}
      </div>
      <p className="mt-1.5 text-[10.5px] uppercase tracking-[0.18em] text-ink-400">
        Stärke{score > 0 ? `: ${labels[idx]}` : ""}
      </p>
    </div>
  );
}

function ChecklistRow({ ok, text }: { ok: boolean; text: string }) {
  return (
    <div className="flex items-center gap-2 text-[12px]">
      <span
        className={`grid h-4 w-4 place-items-center rounded-full transition-colors ${
          ok ? "bg-accent-mint/15 text-accent-mint" : "bg-night-900/[0.05] text-ink-300"
        }`}
      >
        <Check className="h-2.5 w-2.5" />
      </span>
      <span className={ok ? "text-ink-700" : "text-ink-400"}>{text}</span>
    </div>
  );
}

function RuleChip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-md border px-2 py-1 text-center transition-colors ${
        ok
          ? "border-accent-mint/30 bg-accent-mint/10 text-ink-700"
          : "border-hair bg-transparent text-ink-400"
      }`}
    >
      {label}
    </span>
  );
}
