/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dark: {
          900: '#0d1117',
          800: '#161b22',
          700: '#21262d',
          600: '#30363d',
          500: '#484f58',
          100: '#c9d1d9',
          50: '#f0f6fc',
        },
        brand: {
          500: '#238636',
          600: '#2ea043',
        }
      }
    },
  },
  plugins: [],
}

