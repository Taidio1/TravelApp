export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        spanish: {
          bg: '#F5F5F0',
          orange: '#FF8C00',
          red: '#D62828',
        }
      },
      boxShadow: {
        'neu-flat': '8px 8px 16px #d9d9d4, -8px -8px 16px #ffffff',
        'neu-pressed': 'inset 8px 8px 16px #d9d9d4, inset -8px -8px 16px #ffffff',
      }
    },
  },
  plugins: [],
}
