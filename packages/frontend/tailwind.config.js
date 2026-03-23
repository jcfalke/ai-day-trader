/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        buy: "#22c55e",
        sell: "#ef4444",
        hold: "#f59e0b",
      },
    },
  },
  plugins: [],
};
