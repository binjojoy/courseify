/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "bg-canvas": "var(--bg-canvas, #F4F5F7)",
        "bg-surface": "var(--bg-surface, #FFFFFF)",
        "bg-hover": "var(--bg-hover, #EEF0F3)",
        "bg-elevated": "var(--bg-elevated, #FFFFFF)",
        "border-default": "var(--border-default, #DDE1E7)",
        "border-strong": "var(--border-strong, #C3C9D3)",
        "text-primary": "var(--text-primary, #161A22)",
        "text-secondary": "var(--text-secondary, #4A5361)",
        "text-muted": "var(--text-muted, #667085)",
        "accent": "var(--accent, #2456D6)",
        "accent-hover": "var(--accent-hover, #1C46B5)",
        "accent-pressed": "var(--accent-pressed, #163A96)",
        "accent-subtle": "var(--accent-subtle, #E6EDFB)",
        "on-accent": "#FFFFFF",
        "success": "var(--success, #1B7A4B)",
        "success-subtle": "var(--success-subtle, #E3F3EA)",
        "error": "var(--error, #C2372E)",
        "error-subtle": "var(--error-subtle, #FBE9E7)",
        "warning": "var(--warning, #9A6100)",
        "warning-subtle": "var(--warning-subtle, #FBF0DA)",
        "player-black": "#030712",
        "scrim": "var(--scrim, rgba(15,18,25,0.50))",

        // Aliases from reference HTMLs
        "primary": "var(--accent, #2456D6)",
        "surface-container": "var(--surface-container, #ebedf9)",
        "surface-container-low": "var(--surface-container-low, #f1f3ff)",
        "surface-container-highest": "var(--surface-container-highest, #dfe2ee)",
        "outline-variant": "var(--outline-variant, #c3c5d7)"
      },
      borderRadius: {
        DEFAULT: "0.25rem",
        lg: "0.5rem",
        xl: "0.75rem",
        "2xl": "1rem",
        full: "9999px"
      },
      spacing: {
        "gutter-mobile": "1rem",
        "gutter-tablet": "1.5rem",
        "gutter": "2rem",
        "space-xs": "0.25rem",
        "space-sm": "0.5rem",
        "space-md": "0.75rem",
        "space-lg": "1rem",
        "space-xl": "1.5rem"
      },
      fontFamily: {
        sans: ["\"Google Sans\"", "Arial", "sans-serif"],
        "display-lg": ["\"Google Sans\"", "Arial", "sans-serif"],
        "display-md": ["\"Google Sans\"", "Arial", "sans-serif"],
        "display-sm": ["\"Google Sans\"", "Arial", "sans-serif"],
        "title": ["\"Google Sans\"", "Arial", "sans-serif"],
        "heading": ["\"Google Sans\"", "Arial", "sans-serif"],
        "card-title": ["\"Google Sans\"", "Arial", "sans-serif"],
        "body": ["\"Google Sans\"", "Arial", "sans-serif"],
        "body-sm": ["\"Google Sans\"", "Arial", "sans-serif"],
        "body-sm-medium": ["\"Google Sans\"", "Arial", "sans-serif"],
        "caption": ["\"Google Sans\"", "Arial", "sans-serif"],
        "caption-medium": ["\"Google Sans\"", "Arial", "sans-serif"],
        "stat": ["\"Google Sans\"", "Arial", "sans-serif"],
        "wordmark": ["\"Google Sans\"", "Arial", "sans-serif"],
        "mono": ["\"JetBrains Mono\"", "\"SF Mono\"", "ui-monospace", "monospace"]
      },
      fontSize: {
        "display-lg": ["40px", { lineHeight: "48px", letterSpacing: "-0.01em", fontWeight: "600" }],
        "display-md": ["32px", { lineHeight: "40px", letterSpacing: "-0.01em", fontWeight: "600" }],
        "display-sm": ["28px", { lineHeight: "36px", letterSpacing: "-0.01em", fontWeight: "600" }],
        "title": ["22px", { lineHeight: "30px", fontWeight: "600" }],
        "heading": ["18px", { lineHeight: "26px", fontWeight: "600" }],
        "card-title": ["15px", { lineHeight: "22px", fontWeight: "600" }],
        "body": ["15px", { lineHeight: "24px", fontWeight: "400" }],
        "body-sm": ["14px", { lineHeight: "20px", fontWeight: "400" }],
        "body-sm-medium": ["14px", { lineHeight: "20px", fontWeight: "500" }],
        "caption": ["12px", { lineHeight: "16px", fontWeight: "400" }],
        "caption-medium": ["12px", { lineHeight: "16px", fontWeight: "500" }],
        "stat": ["24px", { lineHeight: "32px", fontWeight: "600" }],
        "wordmark": ["17px", { lineHeight: "24px", fontWeight: "600" }]
      }
    }
  },
  plugins: []
};
