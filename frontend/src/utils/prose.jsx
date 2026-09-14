/**
 * Render admin-authored prose stored in the database.
 *
 * These fields are plain text, not Markdown: blank lines separate paragraphs
 * and nothing else is interpreted. Rendering as React children rather than
 * through `dangerouslySetInnerHTML` means there is no HTML-injection path from
 * a form field to a reader's browser, and no sanitizer to keep current.
 *
 * (`marked` is used elsewhere in the app, but only for Markdown files committed
 * to the repo — see Docs.jsx — which is a different trust situation.)
 *
 * @param {string|null|undefined} text
 * @param {{ className?: string }} [options] - classes for each paragraph
 * @returns {JSX.Element[]|null}
 */
export function renderProse(text, { className = 'text-sm text-gray-700 leading-6' } = {}) {
  if (!text) return null;

  return String(text)
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph, index) => (
      <p key={`${paragraph.slice(0, 24)}-${index}`} className={className}>
        {paragraph}
      </p>
    ));
}
