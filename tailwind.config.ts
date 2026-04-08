import type { Config } from "tailwindcss";

const config: Config = {
  // ADICIONADO: Isso força o Tailwind a obedecer a nossa classe 'dark' e não o sistema
  darkMode: 'class', 
  
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
      keyframes: {
        'shrink-width': {
          '0%': { width: '100%' },
          '100%': { width: '0%' },
        },
        'shimmer': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 8px 0 rgba(var(--glow-color, 59 130 246), 0.3)' },
          '50%': { boxShadow: '0 0 20px 4px rgba(var(--glow-color, 59 130 246), 0.5)' },
        },
      },
      animation: {
        'shrink-width': 'shrink-width 5s linear forwards',
        'shimmer': 'shimmer 1.5s ease-in-out infinite',
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
export default config;