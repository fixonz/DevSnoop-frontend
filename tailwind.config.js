/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'binance': ['Binance Plex', 'sans-serif'],
      },
      colors: {
        'dev-yellow': '#fbbf24',
        'dev-green': '#10b981',
        'dev-red': '#ef4444',
      }
    },
  },
  plugins: [],
}
