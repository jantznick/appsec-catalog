import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { Card, CardContent } from '../components/ui/index.js';
import { AssetSections } from '../components/program-content/AssetList.jsx';
import { renderProse } from '../utils/prose.jsx';

/**
 * Detail view for one ASCOE session or one Champions package.
 *
 * The two programs have separate models and read differently — a session has a
 * date and location, a package has a theme and facilitator notes — but the
 * fetch, entitlement handling, and sectioned asset list are identical, so they
 * share this page and differ only in the header and prose blocks below.
 */
const PROGRAM_META = {
  ascoe: {
    name: 'AppSec Center of Excellence',
    notFound: 'That session could not be found, or it has not been shared with your company.',
  },
  champions: {
    name: 'Security Champions',
    notFound: 'That package could not be found, or it has not been shared with your company.',
  },
};

function formatDate(value) {
  if (!value) return null;
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function ProgramReleaseDetail() {
  const { program, slug } = useParams();
  const meta = PROGRAM_META[program];

  const [release, setRelease] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!meta) {
      setLoading(false);
      setError('Unknown program');
      return undefined;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const data = await api.getProgramRelease(program, slug);
        if (!cancelled) setRelease(data);
      } catch (err) {
        if (!cancelled) {
          // The API returns 404 for a release the member isn't entitled to, so
          // a missing release and a restricted one read the same here by design.
          setError(err.status === 404 ? meta.notFound : err.message || 'Failed to load content');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [program, slug, meta]);

  const sessionDate = formatDate(release?.sessionDate);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link
        to="/program-content"
        className="inline-block text-sm font-medium text-blue-700 hover:text-blue-900"
      >
        ← All program content
      </Link>

      {loading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : error ? (
        <Card>
          <CardContent>
            <p className="text-sm text-red-600">{error}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  {meta.name} · {release.periodLabel}
                </p>
                <h1 className="mt-1 text-2xl font-bold text-gray-900">{release.title}</h1>
              </div>

              <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-600">
                {sessionDate && <span>{sessionDate}</span>}
                {release.location && <span>{release.location}</span>}
                {release.theme && <span>{release.theme}</span>}
              </div>

              {release.summary && <div className="space-y-2">{renderProse(release.summary)}</div>}
              {release.body && <div className="space-y-2 pt-1">{renderProse(release.body)}</div>}
            </CardContent>
          </Card>

          {/* Champions only: the "how to run this meeting" narrative. Grouped
              under its own card rather than hidden — anyone who can see the
              package can read it. */}
          {release.facilitatorNotes && (
            <Card>
              <CardContent className="space-y-2">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                  Running the meeting
                </h2>
                {renderProse(release.facilitatorNotes)}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent>
              <AssetSections sections={release.sections} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
