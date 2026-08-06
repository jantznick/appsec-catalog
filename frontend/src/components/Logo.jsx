/**
 * Atlas logo. `mark` renders just the glyph; the default renders mark + wordmark.
 * Pure inline SVG (no asset dependency), inherits sizing from the `size` prop.
 */
export function AtlasMark({ size = 32, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="atlas-mark-grad" x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#16265a" />
          <stop offset="1" stopColor="#0e8397" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="44" height="44" rx="12" fill="url(#atlas-mark-grad)" />
      {/* Stylized "A" as a summit peak — a nod to Atlas / mapping. */}
      <path
        d="M24 12 L34.5 34 H29.2 L24 22.6 L18.8 34 H13.5 L24 12 Z"
        fill="white"
      />
      {/* Crossbar */}
      <rect x="19.4" y="27.4" width="9.2" height="3.2" rx="1.6" fill="white" fillOpacity="0.55" />
    </svg>
  );
}

export function Logo({ size = 32, className = '', textClassName = '', tone = 'dark' }) {
  const toneClass = tone === 'light' ? 'text-white' : 'text-gray-900';
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <AtlasMark size={size} />
      <span className={`font-bold tracking-tight ${toneClass} ${textClassName}`}>
        Atlas
      </span>
    </span>
  );
}
