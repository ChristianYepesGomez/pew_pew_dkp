/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        indigo: '#0f0b20',
        cream: '#ffeccd',
        coral: '#ffaf9d',
        lilac: '#e0d8f6',
        lavender: {
          DEFAULT: '#b1a7d0',
          12: '#b1a7d01f',
          20: '#b1a7d033',
        },
        teal: '#40c7be',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Luckiest Guy', 'cursive'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
