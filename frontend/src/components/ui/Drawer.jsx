import { useEffect } from 'react';

/**
 * A panel that slides in from the right.
 *
 * WHY THIS EXISTS ALONGSIDE Modal
 *
 * A centred modal is the wrong shape for a long form. It is capped at `max-h-[80vh]`,
 * so its body scrolls inside a box that is itself floating in a scrollable page, and a
 * form with nested repeating rows — the policy control editor's field checks — ends up
 * either cramped or needing a second modal on top of the first.
 *
 * A drawer is full height by construction: header and footer pin, only the body moves,
 * and the width is set by content rather than by a `max-w` that has to suit every
 * caller. Repeating rows get the horizontal room to stay on one line.
 *
 * The API deliberately matches Modal's (`isOpen`, `onClose`, `title`, `footer`,
 * `size`, `closeOnOverlayClick`, `closeOnEscape`) so moving a form between the two is
 * a tag change, not a rewrite.
 */
export function Drawer({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'lg',
  closeOnOverlayClick = true,
  closeOnEscape = true,
}) {
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e) => {
      if (closeOnEscape && e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    // Matches Modal: the page behind must not scroll while this is open, or a wheel
    // event that misses the panel moves the wrong thing.
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose, closeOnEscape]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-xl',
    lg: 'max-w-3xl',
    xl: 'max-w-5xl',
    full: 'max-w-none',
  };

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="fixed inset-0 bg-navy-950/50 backdrop-blur-sm transition-opacity"
        onClick={closeOnOverlayClick ? onClose : undefined}
      />

      {/* `w-full` with a max-width, so it fills a narrow viewport instead of leaving a
          strip of unusable backdrop beside it. */}
      <div
        className={`fixed inset-y-0 right-0 z-10 flex w-full ${sizeClasses[size]} flex-col bg-surface shadow-2xl ring-1 ring-white/10`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
      >
        {title && (
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-gray-200 px-6 py-4">
            <div className="min-w-0">
              <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
              {description && <p className="mt-1 text-sm text-gray-600">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 text-gray-400 transition-colors hover:text-gray-600"
              aria-label="Close"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* The only scrolling region. `min-h-0` is required: without it a flex child
            refuses to shrink below its content and the footer is pushed off-screen. */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {footer && (
          <div className="flex shrink-0 items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
