import defaultTheme from 'tailwindcss/defaultTheme'

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    fontSize: {
      ...defaultTheme.fontSize,
      xs: ['12px', { lineHeight: '16px' }],
      sm: ['14px', { lineHeight: '20px' }],
      base: ['16px', { lineHeight: '24px' }],
      lg: ['18px', { lineHeight: '28px' }],
      xl: ['20px', { lineHeight: '28px' }],
      '2xl': ['24px', { lineHeight: '32px' }],
    },
    borderWidth: {
      ...defaultTheme.borderWidth,
      2: '1.5px',
    },
    outlineWidth: {
      ...defaultTheme.outlineWidth,
      2: '1.5px',
    },
    extend: {
      colors: {
        indigo: '#0f0b20',
        cream: '#ffeccd',
        coral: '#ffaf9d',
        lilac: '#e0d8f6',
        lavender: {
          DEFAULT: '#b1a7d0',
          12: '#b1a7d01f',
          '12-solid': '#221e35',
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
