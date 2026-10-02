import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { Card, CardContent } from '../components/ui/Card.jsx';
import { UpdatesFeed } from '../components/whatsnew/UpdatesFeed.jsx';
import { RoadmapBoard } from '../components/whatsnew/RoadmapBoard.jsx';
import { FeatureRequestPanel } from '../components/whatsnew/FeatureRequestPanel.jsx';

const TABS = [
  { key: 'updates', label: 'Updates' },
  { key: 'roadmap', label: 'Roadmap' },
  { key: 'requests', label: 'Request a feature' },
];

/**
 * Tab strip styled to match the shared Tabs component. It isn't that component
 * because the selection lives in the URL — a roadmap card linking to its
 * release note has to be able to switch tabs, and `/whats-new?tab=roadmap`
 * being shareable is worth the handful of lines.
 */
function TabStrip({ active, counts, onSelect }) {
  return (
    <div className="border-b border-gray-200 scroll-x-hidden-bar overscroll-x-contain">
      <nav className="-mb-px flex min-w-max space-x-8" aria-label="What's New sections">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={active === tab.key}
            onClick={() => onSelect(tab.key)}
            className={`whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium transition-colors ${
              active === tab.key
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            <span className="flex items-center gap-2">
              {tab.label}
              {counts[tab.key] > 0 && (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                  {counts[tab.key]}
                </span>
              )}
            </span>
          </button>
        ))}
      </nav>
    </div>
  );
}

function ErrorCard({ message }) {
  return (
    <Card>
      <CardContent>
        <p className="text-sm text-red-600">{message}</p>
      </CardContent>
    </Card>
  );
}

export function WhatsNew() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = TABS.some((tab) => tab.key === searchParams.get('tab'))
    ? searchParams.get('tab')
    : 'updates';
  const highlightId = searchParams.get('update');

  const [updates, setUpdates] = useState([]);
  const [roadmap, setRoadmap] = useState({ items: [], stages: [] });
  const [myRequests, setMyRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  // Each section carries its own error: a roadmap query that fails shouldn't
  // take the release notes down with it.
  const [errors, setErrors] = useState({ updates: '', roadmap: '', requests: '' });

  const load = useCallback(async () => {
    setLoading(true);
    const [updateResult, roadmapResult, mineResult] = await Promise.allSettled([
      api.getPublishedProductUpdates(100),
      api.getRoadmap(),
      api.listMyFeatureRequests(),
    ]);

    const nextErrors = { updates: '', roadmap: '', requests: '' };

    if (updateResult.status === 'fulfilled') {
      setUpdates(updateResult.value.updates || []);
    } else {
      nextErrors.updates = updateResult.reason?.message || 'Failed to load product updates';
    }

    if (roadmapResult.status === 'fulfilled') {
      setRoadmap({
        items: roadmapResult.value.items || [],
        stages: roadmapResult.value.stages || [],
      });
    } else {
      nextErrors.roadmap = roadmapResult.reason?.message || 'Failed to load the roadmap';
    }

    if (mineResult.status === 'fulfilled') {
      setMyRequests(mineResult.value.requests || []);
    } else {
      nextErrors.requests = mineResult.reason?.message || 'Failed to load your feature requests';
    }

    setErrors(nextErrors);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const selectTab = (key) => {
    setSearchParams(key === 'updates' ? {} : { tab: key }, { replace: true });
  };

  /** Jump from a shipped roadmap card to its release note. */
  const viewUpdate = (updateId) => {
    setSearchParams({ tab: 'updates', update: updateId }, { replace: true });
  };

  // Scroll to the linked note once the updates tab has actually rendered it —
  // the jump above only changes the URL, and the card doesn't exist until the
  // feed is on screen.
  useEffect(() => {
    if (loading || activeTab !== 'updates' || !highlightId) return;
    document.getElementById(`update-${highlightId}`)?.scrollIntoView({ block: 'center' });
  }, [loading, activeTab, highlightId]);

  const counts = useMemo(
    () => ({
      updates: updates.length,
      roadmap: roadmap.items.length,
      requests: myRequests.length,
    }),
    [updates, roadmap.items, myRequests],
  );

  const addRequest = (request) => {
    if (request) setMyRequests((current) => [request, ...current]);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">What&apos;s New</h1>
        <p className="mt-1 text-sm text-gray-600">
          What shipped recently, what&apos;s coming next, and a direct line to ask for what you need.
        </p>
      </div>

      <TabStrip active={activeTab} counts={counts} onSelect={selectTab} />

      {loading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : activeTab === 'updates' ? (
        errors.updates ? (
          <ErrorCard message={errors.updates} />
        ) : (
          <UpdatesFeed updates={updates} highlightId={highlightId} />
        )
      ) : activeTab === 'roadmap' ? (
        errors.roadmap ? (
          <ErrorCard message={errors.roadmap} />
        ) : (
          <RoadmapBoard items={roadmap.items} stages={roadmap.stages} onViewUpdate={viewUpdate} />
        )
      ) : (
        <FeatureRequestPanel
          myRequests={myRequests}
          error={errors.requests}
          onSubmitted={addRequest}
        />
      )}
    </div>
  );
}
