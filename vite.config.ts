import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "url";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // mjml-browser zieht cheerio als CommonJS-External — wir aliassen
      // auf einen Stub, damit Vite nicht versucht, die Server-Variante
      // ins Browser-Bundle zu packen (würde Build-Warnings + ggf.
      // Runtime-Fehler erzeugen).
      cheerio: `${projectRoot}src/vendor/cheerio-stub.ts`,
    },
  },
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
