/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0a0a0a',
        surface: '#121212',
        surfaceHighlight: '#1e1e1e',
        primary: '#3b82f6',
        primaryHover: '#2563eb',
        danger: '#ef4444',
        warning: '#f59e0b',
        success: '#10b981',
        text: '#f3f4f6',
        textMuted: '#9ca3af'
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
