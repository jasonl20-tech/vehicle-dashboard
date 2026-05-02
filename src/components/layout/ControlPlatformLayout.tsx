import { Link, Outlet } from "react-router-dom";
import { Logo } from "../brand/Logo";

/**
 * Eigenständige Hülle für die Control Platform — ohne Dashboard-Navigation.
 */
export default function ControlPlatformLayout() {
  return (
    <div className="min-h-screen bg-paper text-ink-800">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-hair bg-paper px-4 sm:px-6">
        <Link
          to="/"
          className="inline-flex min-w-0 items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ink-400 focus-visible:ring-offset-2"
          aria-label="Back to platform selection"
        >
          <Logo className="h-[18px] w-auto text-ink-900" />
        </Link>
        <span className="truncate text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-500">
          Control Platform
        </span>
      </header>

      <main className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-8 sm:py-6 lg:px-10 lg:py-8">
        <Outlet />
      </main>
    </div>
  );
}
