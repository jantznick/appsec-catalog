/**
 * Inline player for a recording hosted in SharePoint or Stream.
 *
 * The iframe authenticates as the viewer, so someone without access to the
 * source library sees a sign-in frame rather than the video — which is the
 * intended behavior: the recording stays gated by SharePoint and Orbit never
 * proxies the bytes. The fallback link below the player is what makes that
 * recoverable, so it renders whether or not the embed loads.
 */
export function VideoEmbed({ embedUrl, externalUrl, title }) {
  if (!embedUrl) {
    if (!externalUrl) return null;
    return (
      <a
        href={externalUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:text-blue-900"
      >
        Watch in SharePoint
        <span aria-hidden="true">↗</span>
      </a>
    );
  }

  return (
    <div className="space-y-2">
      {/* bg-field, not bg-gray-900 — the neutral ramp is inverted in this
          theme, so gray-900 is near-white and would flash bright before the
          player paints. */}
      <div className="relative w-full overflow-hidden rounded-lg bg-field" style={{ paddingTop: '56.25%' }}>
        <iframe
          src={embedUrl}
          title={title || 'Session recording'}
          className="absolute inset-0 h-full w-full"
          allow="fullscreen"
          allowFullScreen
          loading="lazy"
          // The embed is a third-party document; no same-origin access needed.
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
      <p className="text-xs text-gray-500">
        Not loading? You may need to sign in to SharePoint first
        {externalUrl ? (
          <>
            {' — '}
            <a
              href={externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-blue-700 hover:text-blue-900"
            >
              open it there instead
            </a>
          </>
        ) : null}
        .
      </p>
    </div>
  );
}
