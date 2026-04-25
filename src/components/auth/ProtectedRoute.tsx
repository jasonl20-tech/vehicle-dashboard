import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../lib/auth";

export default function ProtectedRoute({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const location = useLocation();

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

  if (!user) {
    return (
      <Navigate
        to="/login"
        state={{ from: `${location.pathname}${location.search}` }}
        replace
      />
    );
  }

  return <>{children}</>;
}
