export default function Logo({ className = '' }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg viewBox="0 0 64 64" className="h-8 w-8 shrink-0">
        <defs>
          <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ff2e88" />
            <stop offset="1" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
        <path d="M10 50 L34 12 L40 16 L18 54 Z" fill="url(#lg)" />
        <path d="M54 50 L30 12 L24 16 L46 54 Z" fill="#22e1ff" opacity="0.85" />
        <circle cx="32" cy="32" r="4.5" fill="#fff" />
      </svg>
      <span className="font-display text-lg leading-none tracking-tight">
        ANIME<span className="text-neon">CLASH</span>
      </span>
    </span>
  )
}
