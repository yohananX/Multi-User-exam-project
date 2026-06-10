/** @type {import('tailwindcss').Config} */
function hsl(varName) {
  return `hsl(var(${varName}) / <alpha-value>)`;
}

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],

  theme: {
    extend: {
      /* ── Colors ── */
      colors: {
        /* Backgrounds */
        background: hsl('--background'),
        'background-secondary': hsl('--background-secondary'),
        'background-tertiary': hsl('--background-tertiary'),

        /* Surfaces */
        surface: hsl('--surface'),
        'surface-raised': hsl('--surface-raised'),

        /* Text */
        text: {
          primary: hsl('--text-primary'),
          secondary: hsl('--text-secondary'),
          tertiary: hsl('--text-tertiary'),
          disabled: hsl('--text-disabled'),
        },

        /* Accent */
        accent: {
          DEFAULT: hsl('--accent'),
          hover: hsl('--accent-hover'),
          subtle: hsl('--accent-subtle'),
          foreground: hsl('--accent-foreground'),
        },

        /* Status */
        status: {
          pending: hsl('--status-pending'),
          'pending-bg': hsl('--status-pending-bg'),
          processing: hsl('--status-processing'),
          'processing-bg': hsl('--status-processing-bg'),
          completed: hsl('--status-completed'),
          'completed-bg': hsl('--status-completed-bg'),
          rejected: hsl('--status-rejected'),
          'rejected-bg': hsl('--status-rejected-bg'),
        },

        /* Borders */
        border: hsl('--border'),
        'border-focus': hsl('--border-focus'),

        /* ── Legacy aliases (backward compat with old components) ── */
        foreground: hsl('--text-primary'),
        primary: {
          DEFAULT: hsl('--accent'),
          foreground: hsl('--accent-foreground'),
        },
        secondary: {
          DEFAULT: hsl('--background-secondary'),
          foreground: hsl('--text-primary'),
        },
        muted: {
          DEFAULT: hsl('--background-tertiary'),
          foreground: hsl('--text-tertiary'),
        },
        destructive: {
          DEFAULT: hsl('--status-rejected'),
          foreground: 'hsl(0 0% 100%)',
        },
        popover: {
          DEFAULT: hsl('--surface-raised'),
          foreground: hsl('--text-primary'),
        },
        card: {
          DEFAULT: hsl('--surface'),
          foreground: hsl('--text-primary'),
        },
        ring: hsl('--border-focus'),
        input: hsl('--border'),

        sidebar: {
          DEFAULT: hsl('--background-secondary'),
          foreground: hsl('--text-secondary'),
          muted: hsl('--background-tertiary'),
          accent: hsl('--accent'),
          border: hsl('--border'),
        },
      },

      /* ── Border Radius ── */
      borderRadius: {
        xs: 'var(--radius-xs)',
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
        full: 'var(--radius-full)',
      },

      /* ── Box Shadow ── */
      boxShadow: {
        xs: 'var(--shadow-xs)',
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        xl: 'var(--shadow-xl)',
        card: 'var(--shadow-card)',
      },

      /* ── Font Family ── */
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Display"',
          '"SF Pro Text"',
          'Inter',
          'system-ui',
          'sans-serif',
        ],
        mono: ['"SF Mono"', '"JetBrains Mono"', 'monospace'],
      },

      /* ── Font Size ── */
      fontSize: {
        xs: ['var(--text-xs)', { lineHeight: 'var(--leading-normal)' }],
        sm: ['var(--text-sm)', { lineHeight: 'var(--leading-snug)' }],
        base: ['var(--text-base)', { lineHeight: 'var(--leading-normal)' }],
        lg: ['var(--text-lg)', { lineHeight: 'var(--leading-snug)' }],
        xl: ['var(--text-xl)', { lineHeight: 'var(--leading-tight)' }],
        '2xl': ['var(--text-2xl)', { lineHeight: 'var(--leading-tight)' }],
        '3xl': ['var(--text-3xl)', { lineHeight: 'var(--leading-tight)' }],
        '4xl': ['var(--text-4xl)', { lineHeight: 'var(--leading-tight)' }],
      },

      /* ── Transitions ── */
      transitionDuration: {
        instant: 'var(--duration-instant)',
        fast: 'var(--duration-fast)',
        normal: 'var(--duration-normal)',
        slow: 'var(--duration-slow)',
        deliberate: 'var(--duration-deliberate)',
      },

      transitionTimingFunction: {
        standard: 'var(--ease-standard)',
        decelerate: 'var(--ease-decelerate)',
        accelerate: 'var(--ease-accelerate)',
        spring: 'var(--ease-spring)',
        apple: 'var(--ease-apple)',
      },

      /* ── Line Height ── */
      lineHeight: {
        tight: 'var(--leading-tight)',
        snug: 'var(--leading-snug)',
        normal: 'var(--leading-normal)',
        relaxed: 'var(--leading-relaxed)',
      },

      /* ── Letter Spacing ── */
      letterSpacing: {
        tight: 'var(--tracking-tight)',
        normal: 'var(--tracking-normal)',
        wide: 'var(--tracking-wide)',
      },

      /* ── Animations ── */
      animation: {
        'fade-in': 'fadeIn var(--duration-normal) var(--ease-standard) forwards',
        'slide-up': 'slideUp var(--duration-normal) var(--ease-decelerate) forwards',
        'slide-in-right': 'slideInRight var(--duration-normal) var(--ease-decelerate) forwards',
        'scale-in': 'scaleIn var(--duration-fast) var(--ease-spring) forwards',
        shimmer: 'shimmer var(--duration-deliberate) var(--ease-standard) infinite',
      },

      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.97)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },

  plugins: [require('tailwindcss-animate')],
};
