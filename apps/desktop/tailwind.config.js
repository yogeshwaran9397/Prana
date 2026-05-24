/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/renderer/index.html", "./src/renderer/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        breath: {
          inhale: "#38bdf8",
          hold_in: "#a78bfa",
          exhale: "#34d399",
          hold_out: "#fbbf24",
          rest: "#94a3b8",
        },
      },
    },
  },
  plugins: [],
};
