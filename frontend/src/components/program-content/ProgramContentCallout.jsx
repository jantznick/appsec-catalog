import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { Card, CardContent } from '../ui/index.js';

/**
 * Compact dashboard strip pointing at the program content a member most likely
 * wants right now: the next ASCOE session (with its agenda) and the current
 * Champions package.
 *
 * Renders nothing when there's nothing to show, so a company with no content
 * shared with it doesn't get an empty box on their dashboard. Failures are
 * swallowed for the same reason — this is a signpost, not a primary surface,
 * and it shouldn't put an error on an unrelated dashboard.
 */
function formatDate(value) {
  if (!value) return null;
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Next session at or after today, else the most recent past one. */
function pickAscoe(releases) {
  if (!releases?.length) return null;
  const now = Date.now();
  const upcoming = releases
    .filter((r) => r.sessionDate && new Date(r.sessionDate).getTime() >= now)
    .sort((a, b) => new Date(a.sessionDate) - new Date(b.sessionDate));
  return upcoming[0] || releases[0] || null;
}

/** The list arrives newest-first, so the current package is simply the head. */
function pickChampions(releases) {
  return releases?.[0] || null;
}

function Item({ label, release, to, meta }) {
  if (!release) return null;
  return (
    <div className="min-w-0 flex-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <Link
        to={to}
        className="mt-1 block text-sm font-medium text-blue-700 hover:text-blue-900 break-words"
      >
        {release.title}
      </Link>
      <p className="mt-0.5 text-xs text-gray-500">
        {[release.periodLabel, meta].filter(Boolean).join(' · ')}
      </p>
    </div>
  );
}

export function ProgramContentCallout() {
  const [ascoe, setAscoe] = useState(null);
  const [champions, setChampions] = useState(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      api.getProgramReleases('ascoe').catch(() => ({ releases: [] })),
      api.getProgramReleases('champions').catch(() => ({ releases: [] })),
    ]).then(([a, c]) => {
      if (cancelled) return;
      setAscoe(pickAscoe(a.releases || []));
      setChampions(pickChampions(c.releases || []));
    });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!ascoe && !champions) return null;

  const sessionDate = formatDate(ascoe?.sessionDate);
  const isUpcoming = ascoe?.sessionDate && new Date(ascoe.sessionDate).getTime() >= Date.now();

  return (
    <Card className="mt-6">
      <CardContent className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold text-gray-900">Program content</h2>
          <Link
            to="/program-content"
            className="text-xs font-medium text-blue-700 hover:text-blue-900"
          >
            View all
          </Link>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:gap-8">
          <Item
            label={isUpcoming ? 'Next ASCOE session' : 'Latest ASCOE session'}
            release={ascoe}
            to={ascoe ? `/program-content/ascoe/${ascoe.slug}` : '#'}
            meta={sessionDate}
          />
          <Item
            label="Current champions package"
            release={champions}
            to={champions ? `/program-content/champions/${champions.slug}` : '#'}
            meta={champions?.theme}
          />
        </div>
      </CardContent>
    </Card>
  );
}
