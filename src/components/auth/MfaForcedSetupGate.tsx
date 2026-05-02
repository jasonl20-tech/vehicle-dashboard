import {
  ClipboardCopy,
  KeyRound,
  Loader2,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { useAuth } from "../../lib/auth";
import TotpQrCode from "../settings/TotpQrCode";

/**
 * Globaler Sicherheits-Gate. Wird in `App` über jedem Inhalt gerendert.
 *
 * Bedingung zum Anzeigen:
 *   - eingeloggter User
 *   - `mfa.requireTotp = true` (Spalte `user.require_2fa = 1`)
 *   - `mfa.totpEnabled = false`
 *
 * Solange diese Bedingung erfüllt ist, sperrt die API-Middleware ohnehin alles
 * ausser `/api/mfa/*`, `/api/me`, `/api/logout`. Das Modal hier verhindert,
 * dass der Nutzer im Frontend etwas anderes anklickt, und führt ihn durch das
 * Authenticator-Setup.
 */
export default function MfaForcedSetupGate() {
  const { user, refresh, logout } = useAuth();

  if (!user) return null;
  if (!user.mfa.requireTotp || user.mfa.totpEnabled) return null;

  return (
    <ForcedSetupModal
      benutzername={user.benutzername}
      onLogout={() => void logout()}
      onSuccess={async () => {
        await refresh();
      }}
    />
  );
}

function ForcedSetupModal({
  benutzername,
  onSuccess,
  onLogout,
}: {
  benutzername: string;
  onSuccess: () => Promise<void>;
  onLogout: () => void;
}) {
  const [draft, setDraft] = useState<{
    secret: string;
    otpauthUri: string;
  } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/mfa/enroll-start", {
          method: "POST",
          credentials: "include",
        });
        const data = (await res.json().catch(() => ({}))) as {
          otpauthUri?: string;
          secret?: string;
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error || "Einrichtung fehlgeschlagen");
        setDraft({
          secret: data.secret || "",
          otpauthUri: data.otpauthUri || "",
        });
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Einrichtung fehlgeschlagen");
        }
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!draft || busy) return;
    const sanitized = code.replace(/\s/g, "").trim();
    if (!/^\d{6}$/.test(sanitized)) {
      setError("Bitte den 6-stelligen Code aus der App eingeben.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/mfa/enroll-confirm", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: sanitized }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Code ungültig");
      await onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bestätigung fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  async function copyText(label: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      setError(`${label} konnte nicht kopiert werden.`);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mfa-forced-title"
    >
      <div
        aria-hidden
        className="absolute inset-0 bg-night-900/65 backdrop-blur-md"
      />

      <div className="relative w-full max-w-[520px] overflow-hidden rounded-xl border border-hair bg-paper shadow-[0_30px_80px_-30px_rgba(15,18,30,0.55)]">
        <div
          aria-hidden
          className="h-[3px] w-full bg-gradient-to-r from-brand-500 via-accent-rose to-accent-mint"
        />
        <div className="px-7 pt-7 pb-6">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-md bg-ink-900 text-white">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10.5px] font-medium uppercase tracking-[0.2em] text-ink-400">
                Pflicht-Aktivierung
              </p>
              <h2
                id="mfa-forced-title"
                className="font-display text-[22px] leading-tight tracking-tighter2 text-ink-900"
              >
                2FA jetzt einrichten
              </h2>
            </div>
          </div>

          <p className="mt-4 text-[13px] leading-relaxed text-ink-500">
            Für{" "}
            <span className="font-medium text-ink-900">{benutzername}</span> ist
            Zwei-Faktor-Authentifizierung von einem Administrator erzwungen.
            Solange kein Authenticator hinterlegt ist, sind alle weiteren
            Aktionen gesperrt.
          </p>

          {error && (
            <div
              role="alert"
              className="mt-4 rounded-md border border-accent-rose/40 bg-accent-rose/[0.07] px-3 py-2 text-[12.5px] text-ink-800"
            >
              {error}
            </div>
          )}

          {bootstrapping ? (
            <div className="mt-8 flex items-center gap-2 text-[12px] text-ink-400">
              <Loader2 className="h-4 w-4 animate-spin" /> Schlüssel wird
              vorbereitet…
            </div>
          ) : draft ? (
            <div className="mt-6 space-y-5">
              <div className="flex flex-col items-center sm:items-start">
                <TotpQrCode otpauthUri={draft.otpauthUri} size={192} />
              </div>

              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-400">
                  otpauth-Link (kopieren oder in unterstützte Apps einfügen)
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <code className="max-h-16 flex-1 min-w-[12rem] overflow-auto rounded-md border border-hair bg-white px-2 py-1 font-mono text-[10px] text-ink-700">
                    {draft.otpauthUri}
                  </code>
                  <button
                    type="button"
                    aria-label="otpauth-Link kopieren"
                    onClick={() => copyText("otpauth-Link", draft.otpauthUri)}
                    className="rounded-md border border-hair bg-white p-2 text-night-700 hover:bg-night-900/[0.03]"
                  >
                    <ClipboardCopy className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-400">
                  Schlüssel (manuelle Eingabe)
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <code className="break-all rounded-md border border-hair bg-white px-2 py-1 font-mono text-[12px] text-ink-800">
                    {draft.secret}
                  </code>
                  <button
                    type="button"
                    aria-label="Schlüssel kopieren"
                    onClick={() => copyText("Schlüssel", draft.secret)}
                    className="rounded-md border border-hair bg-white p-2 text-night-700 hover:bg-night-900/[0.03]"
                  >
                    <ClipboardCopy className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
                <label className="block">
                  <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-400">
                    Erster Code aus der App
                  </span>
                  <input
                    value={code}
                    onChange={(ev) =>
                      setCode(ev.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    inputMode="numeric"
                    autoFocus
                    autoComplete="one-time-code"
                    placeholder="● ● ● ● ● ●"
                    className="mt-2 block w-full max-w-[220px] border-0 border-b border-hair bg-transparent py-2 text-[18px] font-mono tracking-[0.3em] text-ink-900 focus:border-ink-900 focus:outline-none"
                  />
                </label>
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <button
                    type="button"
                    onClick={onLogout}
                    className="inline-flex items-center gap-2 text-[12px] text-ink-500 hover:text-ink-900"
                  >
                    <LogOut className="h-3.5 w-3.5" /> Abmelden
                  </button>
                  <button
                    type="submit"
                    disabled={busy || code.length !== 6}
                    className="inline-flex items-center gap-2 rounded-md bg-ink-900 px-4 py-2.5 text-[12.5px] font-medium text-white shadow-sm transition-colors hover:bg-ink-800 disabled:opacity-50"
                  >
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <KeyRound className="h-4 w-4" />
                    )}
                    2FA aktivieren
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onLogout}
                className="inline-flex items-center gap-2 rounded-md border border-hair bg-white px-3 py-2 text-[12.5px] font-medium text-ink-800 hover:bg-night-900/[0.04]"
              >
                <LogOut className="h-4 w-4" /> Abmelden
              </button>
              <button
                type="button"
                onClick={() => location.reload()}
                className="text-[12px] text-ink-500 underline underline-offset-2 hover:text-ink-900"
              >
                Erneut versuchen
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
