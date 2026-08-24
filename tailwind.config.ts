import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#07080a",
        panel: "#101216",
        line: "#292c33",
        soft: "#a7adb8",
        brand: "#d6b66c",
        success: "#34d399"
      },
      boxShadow: {
        glow: "0 18px 60px rgba(0, 0, 0, 0.42)"
      }
    }
  },
  plugins: []
};

export default config;
