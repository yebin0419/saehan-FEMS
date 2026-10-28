import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        run: "#22c55e",
        idle: "#f59e0b",
        stop: "#ef4444",
        brand: {
          DEFAULT: "#2563eb",
          dark: "#1d4ed8",
          deep: "#1e3a8a",
        },
      },
      fontFamily: {
        sans: ['"Segoe UI"', '"Malgun Gothic"', '"Apple SD Gothic Neo"', "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
