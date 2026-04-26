import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    /**
     * Lokal: GET /api/… sonst 200 + index.html (kein JSON) → CRM-Tabellen leer / kaputt.
     * Parallel starten: `npx wrangler pages dev dist --compatibility-date=2024-01-15`
     * (ohne Vorschau-Build ggf. `build` + Port prüfen; Standard oft 8788).
     */
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8788",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
