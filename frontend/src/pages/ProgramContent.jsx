import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import useAuthStore from '../store/authStore.js';
import { Card, CardContent } from '../components/ui/index.js';
import { kindLabel } from '../components/program-content/AssetList.jsx';
import { renderProse } from '../utils/prose.jsx';

const PROGRAMS = [
  {
    key: 'ascoe',
    name: 'AppSec Center of Excellence',
    blurb: 'Quarterly cross-company gathering — agendas beforehand, decks and recordings after.',
    docPath: '/docs/program-center-of-excellence',
    upcomingLabel: 'Next session',
    pastLabel: 'Past sessions',
  },
  {
    key: 'champions',
    name: 'Security Champions',
    blurb: 'A ready-to-run meeting package every month — articles, lessons learned, games, challenges.',
    docPath: '/docs/program-security-champions',
    upcomingLabel: 'Current package',
    pastLabel: 'Earlier packages',
  },
];

function formatDate(value) {
  if (!value) return null;
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function releaseDate(release) {
  return release.sessionDate || release.periodStart || release.date || null;
}

/**
 * Split releases into what's still ahead and what's behind, so the thing a
 * reader most likely wants — the agenda for the meeting they haven't attended
 * yet — leads the page instead of being buried under the back catalog.
 */
function splitUpcoming(releases) {
  const now = Date.now();
  const upcoming = [];
  const past = [];

  for (const release of releases) {
    const date = releaseDate(release);
    if (date && new Date(date).getTime() >= now) {
      upcoming.push(release);
    } else {
      past.push(release);
    }
  }

  // Soonest-first for what's ahead; most-recent-first for what's behind.
  upcoming.sort((a, b) => new Date(releaseDate(a)) - new Date(releaseDate(b)));
  return { upcoming, past };
}

function ReleaseCard({ release, program, featured = false }) {
  const date = formatDate(releaseDate(release));

  return (
    <Link
      to={`/program-content/${program.key}/${release.slug}`}
      className={`block rounded-lg border bg-surface-2 p-4 transition-colors hover:border-blue-400 ${
        featured ? 'border-blue-300 shadow-sm' : 'border-gray-200'
      }`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            {release.periodLabel}
          </p>
          <h3 className="mt-1 text-base font-semibold text-gray-900 break-words">
            {release.title}
          </h3>
        </div>
        {date && <p className="text-sm text-gray-500 shrink-0">{date}</p>}
      </div>

      {release.theme && <p className="mt-1 text-sm text-gray-600">{release.theme}</p>}
      {release.location && <p className="mt-1 text-sm text-gray-500">{release.location}</p>}

      {release.summary && <div className="mt-2 space-y-2">{renderProse(release.summary)}</div>}

      <p className="mt-3 text-xs text-gray-500">
        {release.assetCount === 0
          ? 'No materials attached yet'
          : `${release.assetCount} item${release.assetCount === 1 ? '' : 's'}`}
      </p>
    </Link>
  );
}

/** The anonymous view: enough to understand the programs, then a way in. */
function PublicCatalog({ catalog }) {
  return (
    <div className="space-y-6">
      {PROGRAMS.map((program) => {
        const releases = catalog?.[program.key] || [];
        return (
          <Card key={program.key}>
            <CardContent className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{program.name}</h2>
                <p className="mt-1 text-sm text-gray-600">{program.blurb}</p>
                <Link
                  to={program.docPath}
                  className="mt-2 inline-block text-sm font-medium text-blue-700 hover:text-blue-900"
                >
                  How the program works
                </Link>
              </div>

              {releases.length === 0 ? (
                <p className="text-sm text-gray-500">Nothing published yet.</p>
              ) : (
                <ul className="space-y-3">
                  {releases.map((release) => (
                    <li
                      key={`${program.key}-${release.slug}`}
                      className="rounded-lg border border-gray-200 bg-surface-2 p-4"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                            {release.periodLabel}
                          </p>
                          <h3 className="mt-1 text-base font-semibold text-gray-900 break-words">
                            {release.title}
                          </h3>
                        </div>
                        {formatDate(release.date) && (
                          <p className="text-sm text-gray-500 shrink-0">
                            {formatDate(release.date)}
                          </p>
                        )}
                      </div>

                      {release.publicSummary && (
                        <div className="mt-2 space-y-2">{renderProse(release.publicSummary)}</div>
                      )}

                      {release.assetCount > 0 && (
                        <p className="mt-3 text-xs text-gray-500">
                          {release.assetCount} item{release.assetCount === 1 ? '' : 's'}
                          {release.assetKinds?.length
                            ? ` — ${release.assetKinds.map(kindLabel).join(', ')}`
                            : ''}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function MemberProgram({ program, releases }) {
  const { upcoming, past } = useMemo(() => splitUpcoming(releases), [releases]);

  return (
    <Card>
      <CardContent className="space-y-5">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{program.name}</h2>
          <p className="mt-1 text-sm text-gray-600">{program.blurb}</p>
        </div>

        {releases.length === 0 ? (
          <p className="text-sm text-gray-500">
            Nothing has been shared with your company yet.
          </p>
        ) : (
          <>
            {upcoming.length > 0 && (
              <section className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                  {program.upcomingLabel}
                </h3>
                {upcoming.map((release) => (
                  <ReleaseCard key={release.id} release={release} program={program} featured />
                ))}
              </section>
            )}

            {past.length > 0 && (
              <section className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                  {upcoming.length > 0 ? program.pastLabel : 'All releases'}
                </h3>
                {past.map((release) => (
                  <ReleaseCard key={release.id} release={release} program={program} />
                ))}
              </section>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function ProgramContent() {
  const { isAuthenticated, isVerified } = useAuthStore();
  const signedIn = isAuthenticated() && isVerified();

  const [catalog, setCatalog] = useState(null);
  const [memberContent, setMemberContent] = useState({ ascoe: [], champions: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');
      try {
        if (signedIn) {
          const [ascoe, champions] = await Promise.all([
            api.getProgramReleases('ascoe'),
            api.getProgramReleases('champions'),
          ]);
          if (!cancelled) {
            setMemberContent({
              ascoe: ascoe.releases || [],
              champions: champions.releases || [],
            });
          }
        } else {
          const data = await api.getPublicProgramContent();
          if (!cancelled) setCatalog(data);
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load program content');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Program Content</h1>
        <p className="mt-1 text-sm text-gray-600">
          Materials from the AppSec Center of Excellence and the Security Champions program.
        </p>
      </div>

      {!signedIn && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-700">
              Session materials and monthly packages are available to AppSec program members.
            </p>
            <Link
              to="/login"
              className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Log in to get content
            </Link>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : error ? (
        <Card>
          <CardContent>
            <p className="text-sm text-red-600">{error}</p>
          </CardContent>
        </Card>
      ) : signedIn ? (
        <div className="space-y-6">
          {PROGRAMS.map((program) => (
            <MemberProgram
              key={program.key}
              program={program}
              releases={memberContent[program.key] || []}
            />
          ))}
        </div>
      ) : (
        <PublicCatalog catalog={catalog} />
      )}
    </div>
  );
}
