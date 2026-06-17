/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/renderer/index.html",
    "./src/renderer/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Space Grotesk"', "system-ui", "sans-serif"],
      },
      colors: {
        brand: {
          purple: "#8B5CF6",
          "purple-light": "#A78BFA",
          "purple-dark": "#7C3AED",
          cyan: "#06B6D4",
        },
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(16px) scale(0.98)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "200% center" },
          "100%": { backgroundPosition: "-200% center" },
        },
        pulse: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.4" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.22s cubic-bezier(0.23, 1, 0.32, 1)",
        "slide-up": "slide-up 0.3s cubic-bezier(0.23, 1, 0.32, 1)",
        shimmer: "shimmer 3s linear infinite",
        pulse: "pulse 2s ease-in-out infinite",
      },
      boxShadow: {
        "glow-sm": "0 0 15px rgba(139,92,246,0.15)",
        "glow-md": "0 0 30px rgba(139,92,246,0.12), 0 0 60px rgba(139,92,246,0.06)",
        "glow-lg": "0 0 40px rgba(139,92,246,0.2), 0 0 80px rgba(139,92,246,0.1)",
      },
    },
  },
  plugins: [],
};
