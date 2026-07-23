import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "var(--c-canvas)",
        surface: "var(--c-surface)",
        raised: "var(--c-raised)",
        edge: "var(--c-edge)",
        "edge-strong": "var(--c-edge-strong)",
        ink: "var(--c-ink)",
        "ink-dim": "var(--c-ink-dim)",
        "ink-faint": "var(--c-ink-faint)",
        accent: "var(--c-accent)",
        "accent-soft": "var(--c-accent-soft)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
    },
  },
  plugins: [],
};
export default config;
