import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";

export default function DashboardLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-ink-50 text-ink-800">
      <div className="flex">
        <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
        <main className="flex-1 min-w-0">
          <div className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8 max-w-[1600px] mx-auto">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden mb-4 inline-flex items-center gap-2 rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm shadow-card"
            >
              Menü
            </button>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
