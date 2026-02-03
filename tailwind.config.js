/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'midnight-deepblue': '#0a0e27',
        'midnight-spaceblue': '#1a1d3a',
        'midnight-purple': '#4a1a8f',
        'midnight-bright-purple': '#8b5cf6',
        'midnight-glow': '#a78bfa',
        'midnight-silver': '#e0e7ff',
        'midnight-accent': '#6d28d9',
      },
      fontFamily: {
        'cinzel': ['Cinzel', 'serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.8s ease-out',
        'shimmer': 'shimmer 3s infinite',
        'nebula': 'nebula 20s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(30px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { transform: 'translateX(-100%) translateY(-100%) rotate(45deg)' },
          '100%': { transform: 'translateX(100%) translateY(100%) rotate(45deg)' },
        },
        nebula: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)', opacity: '0.5' },
          '50%': { transform: 'translate(-5%, 5%) scale(1.1)', opacity: '0.7' },
        },
      },
    },
  },
  plugins: [],
}
