import { useMemo, useState } from 'react';
import { Card, CardContent } from '../ui/Card.jsx';
import { Input } from '../ui/Input.jsx';
import { BodyText } from './BodyText.jsx';
import {
  UPDATE_CATEGORIES,
  categoryBadgeClass,
  formatDate,
  monthKey,
} from '../../lib/productCommunication.js';

/** Chip row used for the category filter; mirrors the tab-strip styling. */
function FilterChip({ active, children, count, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
        active ? 'bg-blue-100 text-blue-800' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
      }`}
    >
      {children}
      {count !== undefined && <span className="ml-1.5 text-xs text-gray-500">{count}</span>}
    </button>
  );
}

function UpdateCard({ update, highlighted }) {
  const [showCommits, setShowCommits] = useState(false);
  const commits = Array.isArray(update.relatedCommits) ? update.relatedCommits : [];

  return (
    <Card
      id={`update-${update.id}`}
      className={highlighted ? 'ring-2 ring-blue-500/60' : ''}
    >
      <CardContent className="space-y-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`px-2 py-1 rounded text-xs font-medium ${categoryBadgeClass(update.category)}`}
              >
                {update.category}
              </span>
              {update.releaseLabel && (
                <span className="text-xs font-medium text-gray-500">{update.releaseLabel}</span>
              )}
            </div>
            <h3 className="mt-2 text-xl font-semibold text-gray-900">{update.title}</h3>
          </div>
          <p className="shrink-0 text-sm text-gray-500">{formatDate(update.publishedAt)}</p>
        </div>

        <p className="text-base leading-7 text-gray-800">{update.summary}</p>
        <BodyText body={update.body} />

        {commits.length > 0 && (
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowCommits((open) => !open)}
              className="text-xs font-medium text-blue-700 hover:text-blue-600"
            >
              {showCommits ? 'Hide' : 'Show'} related changes ({commits.length})
            </button>
            {showCommits && (
              <ul className="mt-2 space-y-1">
                {commits.map((commit, index) => (
                  <li
                    key={commit.hash || commit.shortHash || `${commit.subject}-${index}`}
                    className="text-xs text-gray-500"
                  >
                    <code className="text-gray-400">
                      {commit.shortHash || String(commit.hash || '').slice(0, 7)}
                    </code>{' '}
                    {commit.subject}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * The release-note feed.
 *
 * Entries are grouped by the month they were published and hung off a vertical
 * rail, so a long history reads as a timeline rather than a wall of equal
 * cards. Filtering is client-side: the endpoint returns at most 100 updates,
 * which is far less than it would cost to round-trip every keystroke.
 */
export function UpdatesFeed({ updates, highlightId }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');

  const counts = useMemo(() => {
    const result = {};
    updates.forEach((update) => {
      result[update.category] = (result[update.category] || 0) + 1;
    });
    return result;
  }, [updates]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return updates.filter((update) => {
      // A roadmap card linking straight to its release note wins over the
      // filters; otherwise the link would land on an empty list.
      if (highlightId && update.id === highlightId) return true;
      if (category !== 'all' && update.category !== category) return false;
      if (!needle) return true;
      return [update.title, update.summary, update.body, update.releaseLabel]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(needle));
    });
  }, [updates, query, category, highlightId]);

  const groups = useMemo(() => {
    const byMonth = new Map();
    filtered.forEach((update) => {
      const key = monthKey(update.publishedAt);
      if (!byMonth.has(key)) byMonth.set(key, []);
      byMonth.get(key).push(update);
    });
    return [...byMonth.entries()].map(([month, items]) => ({ month, items }));
  }, [filtered]);

  const availableCategories = UPDATE_CATEGORIES.filter((name) => counts[name]);

  if (updates.length === 0) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-gray-500">No product updates have been published yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-1">
          <FilterChip active={category === 'all'} count={updates.length} onClick={() => setCategory('all')}>
            All
          </FilterChip>
          {availableCategories.map((name) => (
            <FilterChip
              key={name}
              active={category === name}
              count={counts[name]}
              onClick={() => setCategory(name)}
            >
              {name}
            </FilterChip>
          ))}
        </div>
        <div className="lg:w-72">
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search updates"
            aria-label="Search updates"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-sm text-gray-500">No updates match that filter.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-10">
          {groups.map((group) => (
            <section key={group.month}>
              <div className="mb-4 flex items-center gap-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                  {group.month}
                </h2>
                <span className="h-px flex-1 bg-gray-200" />
              </div>
              <ol className="ml-1.5 space-y-5 border-l border-gray-200 pl-6">
                {group.items.map((update) => (
                  <li key={update.id} className="relative">
                    {/* Sits on the rail; the ring punches the line out behind it. */}
                    <span
                      className="absolute -left-[30px] top-6 h-3 w-3 rounded-full bg-blue-500 ring-4 ring-navy-950"
                      aria-hidden="true"
                    />
                    <UpdateCard update={update} highlighted={update.id === highlightId} />
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
