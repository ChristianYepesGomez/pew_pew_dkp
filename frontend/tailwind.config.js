/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        midnight: {
          deepblue: '#0a0e27',
          spaceblue: '#1a1d3a',
          purple: '#4a1a8f',
          'bright-purple': '#8b5cf6',
          glow: '#a78bfa',
          silver: '#e0e7ff',
          accent: '#6d28d9',
        },
        wow: {
          warrior: '#C79C6E',
          paladin: '#F58CBA',
          hunter: '#ABD473',
          rogue: '#FFF569',
          priest: '#FFFFFF',
          shaman: '#0070DE',
          mage: '#69CCF0',
          warlock: '#9482C9',
          druid: '#FF7D0A',
          'death-knight': '#C41E3A',
          'demon-hunter': '#A330C9',
          monk: '#00FF96',
        },
        rarity: {
          common: '#9d9d9d',
          uncommon: '#1eff00',
          rare: '#0070dd',
          epic: '#a335ee',
          legendary: '#ff8000',
        },
      },
      fontFamily: {
        cinzel: ['Cinzel', 'serif'],
        crimson: ['Crimson Text', 'serif'],
      },
      animation: {
        'nebula': 'nebula 20s ease-in-out infinite',
        'stars-twinkle': 'starsTwinkle 10s ease-in-out infinite',
        'shimmer': 'shimmer 3s infinite',
        'fade-in': 'fadeIn 0.8s ease-out',
      },
      keyframes: {
        nebula: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)', opacity: '0.5' },
          '50%': { transform: 'translate(-5%, 5%) scale(1.1)', opacity: '0.7' },
        },
        starsTwinkle: {
          '0%, 100%': { opacity: '0.8' },
          '50%': { opacity: '0.4' },
        },
        shimmer: {
          '0%': { transform: 'translateX(-100%) translateY(-100%) rotate(45deg)' },
          '100%': { transform: 'translateX(100%) translateY(100%) rotate(45deg)' },
        },
        fadeIn: {
          'from': { opacity: '0', transform: 'translateY(30px)' },
          'to': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
