/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#fafaf7",
        hair: "#ececea",
        ink: {
          50: "#f7f7f5",
          100: "#eeeeea",
          200: "#dededa",
          300: "#bfbfb9",
          400: "#8b8b86",
          500: "#666661",
          600: "#48484a",
          700: "#2d2d2f",
          800: "#1a1a1c",
          900: "#0d0d0f",
        },
        night: {
          900: "#0a0b0e",
          800: "#101218",
          700: "#171a22",
          600: "#1f232c",
          500: "#2a2f3a",
          400: "#9aa0aa",
          300: "#c9ccd3",
          200: "#e6e8ec",
        },
        brand: {
          50: "#f3f1ff",
          100: "#e9e5ff",
          200: "#d2caff",
          300: "#b3a6ff",
          400: "#8a76ff",
          500: "#6d52ff",
          600: "#5a3df0",
          700: "#4a2fce",
          800: "#3a249f",
          900: "#251665",
        },
        accent: {
          rose: "#ff5d8f",
          amber: "#f7b955",
          mint: "#3ecf8e",
          ice: "#7cc7ff",
        },
      },
      fontFamily: {
        sans: [
          "InterVariable",
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        display: [
          "InterVariable",
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
      },
      letterSpacing: {
        tightish: "-0.012em",
        tighter2: "-0.025em",
      },
      backgroundImage: {
        "grid-fade":
          "radial-gradient(1200px 600px at 100% -10%, rgba(109,82,255,0.08), transparent 60%), radial-gradient(800px 400px at -10% 110%, rgba(62,207,142,0.06), transparent 60%)",
      },
    },
  },
  plugins: [],
};
