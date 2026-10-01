import { useMemo, useState } from 'react';
import { Card, CardContent } from '../ui/Card.jsx';
import { Modal } from '../ui/Modal.jsx';
import { BodyText } from './BodyText.jsx';
import {
  ROADMAP_PROGRESS_STATES,
  ROADMAP_STAGES,
  categoryBadgeClass,
  formatShortDate,
  progressStateLabel,
  progressStateMeta,
  stageMeta,
} from '../../lib/productCommunication.js';

function StageDot({ stage }) {
  return <span className={`h-2 w-2 rounded-full ${stage.dot}`} aria-hidden="true" />;
}

/** The one-line delivery state shown under an in-progress card's title. */
function ProgressBadge({ item }) {
  const meta = progressStateMeta(item.progressState);
  if (!meta) return null;
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${meta.badge}`}>
      {progressStateLabel(item)}
    </span>
  );
}

function RoadmapCard({ item, onOpen }) {
  const stage = stageMeta(item.stage);

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className={`w-full rounded-lg border border-gray-200 border-l-2 bg-gray-50 p-4 text-left transition-colors hover:bg-gray-100 ${stage.accent}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${categoryBadgeClass(item.category)}`}>
          {item.category}
        </span>
        {item.targetLabel && (
          <span className="text-xs font-medium text-gray-500">{item.targetLabel}</span>
        )}
      </div>
      <p className="mt-2 text-sm font-semibold text-gray-900">{item.title}</p>
      <p className="mt-1 line-clamp-3 text-sm leading-6 text-gray-600">{item.summary}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <ProgressBadge item={item} />
        {item.stage === 'SHIPPED' && item.shippedAt && (
          <span className="text-xs text-gray-500">Shipped {formatShortDate(item.shippedAt)}</span>
        )}
      </div>
    </button>
  );
}

/**
 * Split the in-progress column into the delivery states, in the order work
 * moves through them. Items with no state yet lead the column under "Being
 * built"; empty groups are dropped, and the headings disappear entirely when
 * everything sits in one group, so the column doesn't sprout labels it hasn't
 * earned.
 */
function progressGroups(items) {
  const groups = [
    { key: 'none', label: 'Being built', items: items.filter((item) => !item.progressState) },
    ...ROADMAP_PROGRESS_STATES.map((state) => ({
      key: state.key,
      label: state.label,
      items: items.filter((item) => item.progressState === state.key),
    })),
  ].filter((group) => group.items.length > 0);

  return groups.length > 1 ? groups : null;
}

function StageColumn({ stage, items, onOpen }) {
  const groups = stage.key === 'IN_PROGRESS' ? progressGroups(items) : null;

  return (
    <section className="flex min-w-0 flex-col">
      <div className="mb-3">
        <div className="flex items-center gap-2">
          <StageDot stage={stage} />
          <h2 className="text-sm font-semibold text-gray-900">{stage.label}</h2>
          <span className="ml-auto text-xs font-medium text-gray-500">{items.length}</span>
        </div>
        <p className="mt-1 text-xs text-gray-500">{stage.description}</p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 p-4">
          <p className="text-xs text-gray-500">Nothing here right now.</p>
        </div>
      ) : groups ? (
        <div className="space-y-5">
          {groups.map((group) => (
            <div key={group.key} className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                {group.label}
              </p>
              {group.items.map((item) => (
                <RoadmapCard key={item.id} item={item} onOpen={onOpen} />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <RoadmapCard key={item.id} item={item} onOpen={onOpen} />
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * The public roadmap: one column per stage, newest-first within a stage unless
 * an admin has pinned an order.
 *
 * The in-progress column is sub-grouped by delivery state (beta, HTS testing,
 * scheduled release) because that is the thing people actually want to know
 * once something is underway — "in progress" on its own says very little.
 */
export function RoadmapBoard({ items, stages, onViewUpdate }) {
  const [openItem, setOpenItem] = useState(null);
  const columns = useMemo(() => {
    const source = Array.isArray(stages) && stages.length > 0 ? stages : ROADMAP_STAGES;
    return source.map((stage) => {
      // The server owns which stages exist and how they're worded; the local
      // metadata owns the colour, which is no business of the API's.
      const meta = stageMeta(stage.key);
      return {
        ...meta,
        label: stage.label || meta.label,
        description: stage.description || meta.description,
        items: items.filter((item) => item.stage === stage.key),
      };
    });
  }, [items, stages]);

  if (items.length === 0) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-gray-500">
            Nothing is on the public roadmap yet. Once the Orbit admins publish what they&apos;re
            working on, it will show up here.
          </p>
        </CardContent>
      </Card>
    );
  }

  const openStage = openItem ? stageMeta(openItem.stage) : null;

  return (
    <>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        {columns.map((column) => (
          <StageColumn key={column.key} stage={column} items={column.items} onOpen={setOpenItem} />
        ))}
      </div>

      <Modal
        isOpen={Boolean(openItem)}
        onClose={() => setOpenItem(null)}
        title={openItem?.title || ''}
        size="lg"
      >
        {openItem && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${openStage.badge}`}>
                {openStage.label}
              </span>
              <span
                className={`px-2 py-0.5 rounded text-xs font-medium ${categoryBadgeClass(openItem.category)}`}
              >
                {openItem.category}
              </span>
              <ProgressBadge item={openItem} />
              {openItem.targetLabel && (
                <span className="text-xs font-medium text-gray-500">{openItem.targetLabel}</span>
              )}
            </div>

            <p className="text-base leading-7 text-gray-800">{openItem.summary}</p>
            <BodyText body={openItem.body} />

            {openItem.stage === 'SHIPPED' && (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="text-sm text-gray-700">
                  Shipped {formatShortDate(openItem.shippedAt, 'recently')}.
                  {openItem.linkedUpdate && (
                    <>
                      {' '}
                      <button
                        type="button"
                        className="font-medium text-blue-700 hover:text-blue-600"
                        onClick={() => {
                          setOpenItem(null);
                          onViewUpdate?.(openItem.linkedUpdate.id);
                        }}
                      >
                        Read the release note
                      </button>
                    </>
                  )}
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
