import {
  ClipboardCopy,
  KeyRound,
  Loader2,
  Shield,
  ShieldCheck,
  ShieldOff,
  XCircle,
} from "lucide-react";
import { type FormEvent, useCallback, useEffect, useState } from "react";

type Status = {
  totpEnabled: boolean;
  enrollmentPending: boolean;
};

export default function MfaSection() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** Lauft Enrollment: otpauth URI + Secret (vom Server) */
  const [draft, setDraft] = useState<{
    secret: string;
    otpauthUri: string;
  } | null>(null);
  const [confirmCode, setConfirmCode] = useState("");
  const [busy, setBusy] = useState(false);

  /** Deaktivieren */
  const [disablePw, setDisablePw] = useState("");
  const [disableOpen, setDisableOpen] = useState(false);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/mfa/status", { credentials: "include" });
      const data = (await res.json().catch(() => ({}))) as Partial<Status>;
      if (!res.ok) throw new Error("Status konnte nicht geladen werden.");
      setStatus({
        totpEnabled: !!data.totpEnabled,
        enrollmentPending: !!data.enrollmentPending,
      });
      setError(null);
    } catch (e) {
      setStatus(null);
      setError(e instanceof Error ? e.message : "Netzwerkfehler");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  async function onStartEnrollment() {
    setError(null);
    setBusy(true);
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
      if (!res.ok) throw new Error(data.error || "Einrichtung fehlgeschlagen");
      setDraft({
        secret: data.secret || "",
        otpauthUri: data.otpauthUri || "",
      });
      setConfirmCode("");
      await loadStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Einrichtung fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  async function onConfirmEnrollment(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/mfa/enroll-confirm", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: confirmCode.replace(/\s/g, "").trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "Code ungueltig");
      setDraft(null);
      setConfirmCode("");
      await loadStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bestaetigung fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  async function onDisable(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/mfa/disable", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: disablePw }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Deaktivieren fehlgeschlagen");
      setDisableOpen(false);
      setDisablePw("");
      await loadStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Deaktivieren fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  async function copyText(label: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      setError(`${label} konnte nicht kopiert werden`);
    }
  }

  return (
    <section className="rounded-xl border border-hair bg-white/55 p-5 shadow-[0_24px_70px_-50px_rgba(13,13,15,0.35)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-night-900 text-white">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-[18px] leading-tight text-ink-900">
              Zwei-Faktor-Authentifizierung (TOTP)
            </h2>
            <p className="mt-1 max-w-xl text-[12.5px] leading-relaxed text-ink-500">
              Schuetze dieses Konto mit einer Authenticator-App (RFC 6238,
              SHA-1, 30&nbsp;s). Nach Aktivierung ist beim Login zusaetzlich ein
              6-stelliger Code erforderlich.
            </p>
          </div>
        </div>
        {!loading && status?.totpEnabled && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-accent-mint/35 bg-accent-mint/12 px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.12em] text-ink-800">
            <ShieldCheck className="h-3.5 w-3.5 text-accent-mint" />
            Aktiv
          </span>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="mt-4 rounded-md border border-accent-rose/40 bg-accent-rose/[0.07] px-3 py-2 text-[12.5px] text-ink-800"
        >
          {error}
        </div>
      )}

      {loading ? (
        <div className="mt-8 flex items-center gap-2 text-[12px] text-ink-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Lade Status…
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {status?.totpEnabled && !draft ? (
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setDisableOpen(true);
                  setError(null);
                }}
                className="inline-flex items-center gap-2 rounded-md border border-hair bg-white px-3 py-2 text-[12.5px] font-medium text-ink-800 transition-colors hover:bg-night-900/[0.04] disabled:opacity-50"
              >
                <ShieldOff className="h-4 w-4 text-ink-600" /> 2FA
                deaktivieren
              </button>
            </div>
          ) : null}

          {!status?.totpEnabled && !draft && !status?.enrollmentPending ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void onStartEnrollment()}
              className="inline-flex items-center gap-2 rounded-md bg-ink-900 px-4 py-2.5 text-[12.5px] font-medium text-white transition-colors hover:bg-ink-800 disabled:opacity-50"
            >
              {busy ?
                <Loader2 className="h-4 w-4 animate-spin" />
              : <KeyRound className="h-4 w-4 opacity-95" />}
              Authenticator einrichten
            </button>
          ) : null}

          {(draft || status?.enrollmentPending) && !status?.totpEnabled ? (
            <div className="rounded-lg border border-hair bg-paper px-4 py-4 space-y-4">
              {!draft && status?.enrollmentPending ?
                <>
                  <p className="text-[12.5px] text-ink-600">
                    Einrichtung begonnen, aber noch nicht fertiggestellt. Starte neu
                    oder scanne wieder den zuletzt erhaltenen Schlüssel.
                  </p>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void onStartEnrollment()}
                    className="text-[12.5px] font-medium text-ink-800 underline underline-offset-2 hover:text-ink-900"
                  >
                    Einrichtung neu starten (generiert neuen Schluessel)
                  </button>
                </>
              : null}

              {draft ?
                <>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-400">
                      otpauth-Link (kopieren oder in unterstützte Apps einfuegen)
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <code className="max-h-16 flex-1 min-w-[12rem] overflow-auto rounded-md border border-hair bg-white px-2 py-1 font-mono text-[10px] text-ink-700">
                        {draft.otpauthUri}
                      </code>
                      <button
                        type="button"
                        aria-label="otpauth-Link kopieren"
                        onClick={() =>
                          copyText(
                            "otpauth-Link",
                            draft.otpauthUri,
                          )
                        }
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
                        aria-label="Schluessel kopieren"
                        onClick={() =>
                          copyText("Schluessel", draft.secret)
                        }
                        className="rounded-md border border-hair bg-white p-2 text-night-700 hover:bg-night-900/[0.03]"
                      >
                        <ClipboardCopy className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <form onSubmit={(e) => void onConfirmEnrollment(e)} className="space-y-3">
                    <label className="block">
                      <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-400">
                        Erster Code aus der App bestaetigen
                      </span>
                      <input
                        value={confirmCode}
                        onChange={(ev) =>
                          setConfirmCode(ev.target.value.replace(/\D/g, "").slice(0, 6))
                        }
                        inputMode="numeric"
                        placeholder="● ● ● ● ● ●"
                        autoComplete="one-time-code"
                        className="mt-2 block w-full max-w-[200px] border-0 border-b border-hair bg-transparent py-2 text-[18px] font-mono tracking-[0.3em] text-ink-900 focus:border-ink-900 focus:outline-none"
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={
                        busy || confirmCode.trim().replace(/\s/g, "").length !== 6
                      }
                      className="inline-flex items-center gap-2 rounded-md bg-ink-900 px-4 py-2 text-[12.5px] font-medium text-white disabled:opacity-50"
                    >
                      {busy ?
                        <Loader2 className="h-4 w-4 animate-spin" />
                      : null}
                      2FA aktivieren
                    </button>
                  </form>
                </>
              : null}
            </div>
          ) : null}
        </div>
      )}

      {disableOpen ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mfa-disable-title"
        >
          <button
            type="button"
            aria-label="Schliessen"
            className="absolute inset-0 cursor-default bg-night-900/50 backdrop-blur-sm"
            onClick={() =>
              !busy && (setDisableOpen(false), setDisablePw(""))
            }
          />
          <div className="relative w-full max-w-md rounded-xl border border-hair bg-paper p-6 shadow-xl">
            <button
              type="button"
              className="absolute right-4 top-4 text-night-400 hover:text-ink-900"
              onClick={() =>
                !busy && (setDisableOpen(false), setDisablePw(""))
              }
              aria-label="Schliessen"
            >
              <XCircle className="h-5 w-5" />
            </button>
            <h3
              id="mfa-disable-title"
              className="font-display text-lg tracking-tighter2 text-ink-900 pr-10"
            >
              2FA deaktivieren
            </h3>
            <p className="mt-2 text-[12.5px] leading-relaxed text-ink-500">
              Zur Bestätigung hier dein Anmeldepasswort eingeben. Danach gilt
              nur noch Passwort ohne Authenticator-Codes (bis du 2FA erneut einrichtest).
            </p>
            <form onSubmit={(e) => void onDisable(e)} className="mt-5 space-y-4">
              <input
                type="password"
                value={disablePw}
                onChange={(e) => setDisablePw(e.target.value)}
                placeholder="Passwort"
                autoComplete="current-password"
                className="block w-full border border-hair rounded-md px-3 py-2 text-[14px]"
              />
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    !busy && (setDisableOpen(false), setDisablePw(""))
                  }
                  className="rounded-md px-3 py-2 text-[12px] text-ink-500 hover:text-ink-900 disabled:opacity-50"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={busy || !disablePw.trim()}
                  className="inline-flex min-h-[42px] min-w-[10rem] items-center justify-center gap-2 rounded-md bg-accent-rose/90 px-4 py-2 text-[12.5px] font-medium text-white disabled:opacity-50"
                >
                  {busy ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                      Bitte warten ...
                    </>
                  ) : (
                    "Endgueltig deaktivieren"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
