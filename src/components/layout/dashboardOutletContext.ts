import type { ReactNode } from "react";

/** Von `DashboardLayout` bereitgestellt; z. B. CRM setzt Toolbar in den Header. */
export type DashboardOutletContext = {
  setHeaderTrailing: (node: ReactNode | null) => void;
};
