/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./*.html", "./assets/js/**/*.js"],
  theme: {
    extend: {
      colors: {
        bm: {
          bg: "#ece4fb",
          admin: "#f6f5fb",
          purple: "#7c5cff",
          "purple-deep": "#5b3fd6",
          "purple-mid": "#8a6bff",
          ink: "#2b2540",
          pink: "#ff77a9",
          "pink-soft": "#ff9bc0",
          muted: "#9a93b8",
          "muted-2": "#6b6486",
          "muted-3": "#b6afce",
          border: "#ececf3",
          "border-2": "#e6ddf7",
          "border-3": "#f0eef7",
          surface: "#faf9fd",
          "surface-2": "#f1ecfb",
          "surface-3": "#f4f2fa",
          ok: "#22a06b",
          warn: "#d98324",
          danger: "#d64545",
        },
      },
      fontFamily: {
        display: ["Fredoka", "system-ui", "sans-serif"],
        sans: ["'DM Sans'", "system-ui", "sans-serif"],
      },
      keyframes: {
        "bm-fadeup": {
          from: { opacity: "0", transform: "translateY(14px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "bm-pop": {
          "0%": { opacity: "0", transform: "scale(.86)" },
          "60%": { transform: "scale(1.03)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "bm-floaty": {
          "0%,100%": { transform: "translateY(0) rotate(var(--r,0deg))" },
          "50%": { transform: "translateY(-9px) rotate(var(--r,0deg))" },
        },
        "bm-spin": { to: { transform: "rotate(360deg)" } },
        "bm-shine": {
          "0%": { backgroundPosition: "-140% 0" },
          "100%": { backgroundPosition: "240% 0" },
        },
        "bm-grow": { from: { transform: "scaleX(0)" }, to: { transform: "scaleX(1)" } },
      },
      animation: {
        "bm-fadeup": "bm-fadeup .5s ease both",
        "bm-fadeup-fast": "bm-fadeup .38s ease both",
        "bm-pop": "bm-pop .5s cubic-bezier(.2,.7,.3,1) both",
        "bm-floaty": "bm-floaty 7s ease-in-out infinite",
        "bm-spin": "bm-spin .8s linear infinite",
        "bm-grow": "bm-grow .6s ease both",
      },
    },
  },
  plugins: [],
};
