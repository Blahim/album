/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        bg: "rgb(var(--color-bg) / <alpha-value>)",
        surface: "rgb(var(--color-surface) / <alpha-value>)",
        panel: "rgb(var(--color-panel) / <alpha-value>)",
        line: "rgb(var(--color-line) / <alpha-value>)",
        accent: "rgb(var(--color-accent) / <alpha-value>)",
        accentSoft: "rgb(var(--color-accent-soft) / <alpha-value>)",
        text: "rgb(var(--color-text) / <alpha-value>)",
        muted: "rgb(var(--color-muted) / <alpha-value>)"
      },
      fontFamily: {
        display: ['"Space Grotesk"', "sans-serif"],
        sans: ['"Manrope"', "sans-serif"]
      },
      boxShadow: {
        glow: "0 20px 80px rgba(11, 201, 166, 0.15)",
        soft: "0 24px 60px rgba(15, 23, 42, 0.18)"
      },
      keyframes: {
        rise: {
          "0%": { opacity: 0, transform: "translateY(18px)" },
          "100%": { opacity: 1, transform: "translateY(0)" }
        },
        pulseBorder: {
          "0%, 100%": { borderColor: "rgba(11, 201, 166, 0.22)" },
          "50%": { borderColor: "rgba(11, 201, 166, 0.55)" }
        }
      },
      animation: {
        rise: "rise 420ms ease forwards",
        pulseBorder: "pulseBorder 2.8s ease-in-out infinite"
      }
    }
  },
  plugins: []
};
