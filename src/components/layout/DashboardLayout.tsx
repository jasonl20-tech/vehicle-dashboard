import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import { Menu } from "lucide-react";

export default function DashboardLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-paper text-ink-800">
      <div className="flex">
        <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
        <main className="relative flex-1 min-w-0">
          <div className="pointer-events-none absolute inset-0 bg-grid-fade" />
          <div className="relative px-5 sm:px-10 lg:px-14 py-8 lg:py-12 max-w-[1480px] mx-auto">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden mb-6 inline-flex items-center gap-2 text-sm text-ink-600 hover:text-ink-900"
            >
              <Menu className="h-4 w-4" />
              Menü
            </button>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
