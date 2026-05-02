import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type SessionUser = {
  id: number;
  benutzername: string;
  titel: string | null;
  sicherheitsstufe: number;
  profilbild: string | null;
  bannerfarbe: string | null;
};

/**
 * Ergebnis eines `login`-Aufrufs.
 * - `ok`: Anmeldung war erfolgreich, der User ist im Context.
 * - `needs-setup`: Der Account existiert, hat aber noch kein Passwort.
 *   Mit `setupToken` muss anschließend `setupPassword` aufgerufen werden.
 */
export type LoginResult =
  | { kind: "ok" }
  | { kind: "needs-setup"; setupToken: string; benutzername: string };

type AuthState = {
  user: SessionUser | null;
  /** Pfade aus D1-Tabelle sicherheitsstufen; abgestimmt mit API-Middleware */
  erlaubtePfade: string[];
  loading: boolean;
  refresh: () => Promise<void>;
  login: (benutzername: string, password: string) => Promise<LoginResult>;
  setupPassword: (setupToken: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [erlaubtePfade, setErlaubtePfade] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/me", { credentials: "include" });
      if (res.ok) {
        const data: { user: SessionUser; erlaubtePfade?: string[] } =
          await res.json();
        setUser(data.user);
        const p = data.erlaubtePfade;
        setErlaubtePfade(
          Array.isArray(p) && p.length > 0 ? p : ["*"],
        );
      } else {
        setUser(null);
        setErlaubtePfade([]);
      }
    } catch {
      setUser(null);
      setErlaubtePfade([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback<AuthState["login"]>(
    async (benutzername, password) => {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ benutzername, password }),
      });

      const data = (await res
        .json()
        .catch(() => ({}))) as Partial<{
        ok: boolean;
        needsPasswordSetup: boolean;
        setupToken: string;
        benutzername: string;
        error: string;
      }>;

      if (!res.ok) {
        throw new Error(data.error || "Anmeldung fehlgeschlagen");
      }

      if (data.needsPasswordSetup && data.setupToken) {
        return {
          kind: "needs-setup",
          setupToken: data.setupToken,
          benutzername: data.benutzername || benutzername,
        };
      }

      await refresh();
      return { kind: "ok" };
    },
    [refresh],
  );

  const setupPassword = useCallback<AuthState["setupPassword"]>(
    async (setupToken, password) => {
      const res = await fetch("/api/setup-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ setupToken, password }),
      });
      if (!res.ok) {
        const data = (await res
          .json()
          .catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Passwort konnte nicht gesetzt werden");
      }
      await refresh();
    },
    [refresh],
  );

  const logout = useCallback(async () => {
    try {
      await fetch("/api/logout", {
        method: "POST",
        credentials: "include",
      });
    } finally {
      setUser(null);
      setErlaubtePfade([]);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <AuthContext.Provider
      value={{
        user,
        erlaubtePfade,
        loading,
        refresh,
        login,
        setupPassword,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx)
    throw new Error("useAuth muss innerhalb von <AuthProvider> genutzt werden");
  return ctx;
}
