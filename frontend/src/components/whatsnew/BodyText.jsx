import { parseBody } from '../../lib/productCommunication.js';

/**
 * Renders the free-text body of an update or roadmap item.
 *
 * There is no rich-text editor behind these fields, so the only structure we
 * can rely on is blank lines between paragraphs and "-" bullets — which is
 * exactly what `parseBody` recognises.
 */
export function BodyText({ body, className = '' }) {
  const blocks = parseBody(body);
  if (blocks.length === 0) return null;

  return (
    <div className={`space-y-3 ${className}`}>
      {blocks.map((block, index) =>
        block.type === 'list' ? (
          <ul key={`list-${index}`} className="list-disc space-y-1 pl-5 text-sm leading-6 text-gray-700">
            {block.items.map((item, itemIndex) => (
              <li key={`${item.slice(0, 24)}-${itemIndex}`}>{item}</li>
            ))}
          </ul>
        ) : (
          <p key={`p-${index}`} className="text-sm leading-6 text-gray-700">
            {block.text}
          </p>
        ),
      )}
    </div>
  );
}
