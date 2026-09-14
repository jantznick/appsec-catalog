import { API_BASE_URL } from '../../lib/api.js';
import { renderProse } from '../../utils/prose.jsx';
import { VideoEmbed } from './VideoEmbed.jsx';

const KIND_LABELS = {
  slide_deck: 'Slides',
  recording: 'Recording',
  document: 'Document',
  article: 'Article',
  game: 'Game',
  challenge: 'Challenge',
  link: 'Link',
};

const KIND_STYLES = {
  slide_deck: 'bg-purple-100 text-purple-800',
  recording: 'bg-rose-100 text-rose-800',
  document: 'bg-blue-100 text-blue-800',
  article: 'bg-emerald-100 text-emerald-800',
  game: 'bg-amber-100 text-amber-800',
  challenge: 'bg-orange-100 text-orange-800',
  link: 'bg-gray-100 text-gray-700',
};

export function kindLabel(kind) {
  return KIND_LABELS[kind] || 'Material';
}

function formatSize(bytes) {
  if (!bytes || bytes <= 0) return null;
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value < 10 && unit > 0 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}

function AssetCard({ asset }) {
  const isRecording = asset.kind === 'recording' || Boolean(asset.embedUrl);
  const size = formatSize(asset.sizeBytes);

  return (
    <li className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`px-2 py-0.5 rounded text-xs font-medium ${
                KIND_STYLES[asset.kind] || KIND_STYLES.link
              }`}
            >
              {kindLabel(asset.kind)}
            </span>
            {size && <span className="text-xs text-gray-500">{size}</span>}
          </div>
          <h4 className="text-sm font-semibold text-gray-900 break-words">{asset.title}</h4>
        </div>
      </div>

      {asset.description && <div className="space-y-2">{renderProse(asset.description)}</div>}

      {isRecording ? (
        <VideoEmbed embedUrl={asset.embedUrl} externalUrl={asset.externalUrl} title={asset.title} />
      ) : (
        // An asset can carry a stored copy and a source link at the same time,
        // so both routes to the same material are offered side by side.
        <div className="flex flex-wrap items-center gap-3">
          {/* Dormant until Phase 2 adds uploads — `fileName` is only set for a
              stored copy, so today this never renders. Kept correct rather than
              left as a relative path that would hit the frontend origin. */}
          {asset.fileName && (
            <a
              href={`${API_BASE_URL}/api/program-content/assets/${asset.id}/download`}
              className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              Download
            </a>
          )}
          {asset.externalUrl && (
            <a
              href={asset.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:text-blue-900"
            >
              Open in SharePoint
              <span aria-hidden="true">↗</span>
            </a>
          )}
        </div>
      )}
    </li>
  );
}

/**
 * One section heading and its assets. The API omits sections with nothing in
 * them, so this never renders an empty heading.
 */
export function AssetSection({ section }) {
  if (!section?.assets?.length) return null;

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
        {section.heading}
      </h3>
      <ul className="space-y-3">
        {section.assets.map((asset) => (
          <AssetCard key={asset.id} asset={asset} />
        ))}
      </ul>
    </section>
  );
}

export function AssetSections({ sections }) {
  if (!sections?.length) {
    return (
      <p className="text-sm text-gray-500">
        No materials have been attached yet. Check back closer to the meeting.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {sections.map((section) => (
        <AssetSection key={section.section} section={section} />
      ))}
    </div>
  );
}
