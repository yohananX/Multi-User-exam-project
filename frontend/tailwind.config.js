/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: '#1a1a1d',
        'surface-hover': '#222225',
        'sidebar-bg': '#161618',
        'main-bg': '#111113',
        accent: '#5B4FCF',
        'accent-hover': '#6B5FD9',
        border: '#2a2a2e',
      },
    },
  },
  plugins: [],
}
