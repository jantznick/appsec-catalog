/**
 * Orbit logo. `OrbitMark` renders just the glyph; `Logo` renders mark + wordmark.
 * Pure inline SVG (no asset dependency), inherits sizing from the `size` prop.
 */
export function OrbitMark({ size = 32, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="18 20 144 144"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <g fill="none" strokeWidth="6" strokeLinecap="round">
        <ellipse cx="90" cy="90" rx="68" ry="28" transform="rotate(0 90 90)" stroke="#22b8cf" />
        <ellipse cx="90" cy="90" rx="68" ry="28" transform="rotate(60 90 90)" stroke="#4a86d6" />
        <ellipse cx="90" cy="90" rx="68" ry="28" transform="rotate(-60 90 90)" stroke="#1fa98f" />
      </g>
      <circle cx="90" cy="90" r="18" fill="#2f6fd0" />
      <circle cx="90" cy="90" r="18" fill="none" stroke="#FFFFFF" strokeWidth="3" />
      <circle cx="124" cy="148.9" r="8" fill="#22b8cf" stroke="#FFFFFF" strokeWidth="2.5" />
      <circle cx="56" cy="148.9" r="6" fill="#8ea6dd" stroke="#FFFFFF" strokeWidth="2.5" />
    </svg>
  );
}

export function Logo({ size = 32, className = '', textClassName = '', tone = 'dark' }) {
  const toneClass = tone === 'light' ? 'text-white' : 'text-gray-900';
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <OrbitMark size={size} />
      <span className={`font-bold tracking-tight ${toneClass} ${textClassName}`}>
        Orbit
      </span>
    </span>
  );
}
