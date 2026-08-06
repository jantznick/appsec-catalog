import { Button, Input, Textarea, Select } from '../ui';

const STATUS_LABELS = {
  open: 'Open',
  mitigated: 'Mitigated',
  accepted: 'Accepted (risk)',
  ticketed: 'Ticketed',
};

const STATUS_BADGE = {
  open: 'bg-red-100 text-red-700',
  mitigated: 'bg-green-100 text-green-700',
  accepted: 'bg-yellow-100 text-yellow-700',
  ticketed: 'bg-blue-100 text-blue-700',
};

function newThreat(seed = {}) {
  return {
    id: (crypto.randomUUID && crypto.randomUUID()) || `t-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
    title: '',
    stride: null,
    description: '',
    mitigation: '',
    status: 'open',
    ticketUrl: '',
    ...seed,
  };
}

/**
 * Question 2 ("what can go wrong") + Question 3 ("what will we do about it").
 * A list of threats, each optionally STRIDE-tagged, with a mitigation + status.
 */
export function ThreatEditor({ threats, stride, threatStatuses, relevantStride = [], starterThreats = [], onChange }) {
  const strideOptions = [
    { value: '', label: '— No STRIDE tag —' },
    ...stride.map((s) => ({ value: s.key, label: s.label })),
  ];
  const statusOptions = threatStatuses.map((s) => ({ value: s, label: STATUS_LABELS[s] || s }));

  const update = (id, patch) => onChange(threats.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  const remove = (id) => onChange(threats.filter((t) => t.id !== id));
  const add = (seed) => onChange([...threats, newThreat(seed)]);

  const relevant = stride.filter((s) => relevantStride.includes(s.key));

  return (
    <div className="space-y-4">
      {relevant.length > 0 && (
        <div className="rounded-lg bg-blue-50 border border-blue-100 p-3">
          <p className="text-xs font-medium text-blue-800 mb-2">
            For this kind of component, pay special attention to:
          </p>
          <div className="flex flex-wrap gap-2">
            {relevant.map((s) => (
              <button
                key={s.key}
                type="button"
                title={s.question}
                onClick={() => add({ stride: s.key })}
                className="text-xs px-2 py-1 rounded-full bg-surface border border-blue-200 text-blue-700 hover:bg-blue-100"
              >
                + {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {starterThreats.length > 0 && threats.length === 0 && (
        <div className="rounded-lg bg-gray-50 border border-gray-200 p-3">
          <p className="text-xs font-medium text-gray-600 mb-2">Common starting points (click to add):</p>
          <div className="flex flex-wrap gap-2">
            {starterThreats.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => add({ title: s.title, stride: s.stride || null })}
                className="text-xs px-2 py-1 rounded-full bg-surface border border-gray-300 text-gray-700 hover:bg-gray-100"
              >
                + {s.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {threats.length === 0 && (
        <p className="text-sm text-gray-500 italic">No threats identified yet.</p>
      )}

      {threats.map((t) => (
        <div key={t.id} className="rounded-lg border border-gray-200 p-4 space-y-3 bg-surface">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <Input
                placeholder="What could go wrong? (e.g. Stolen session token)"
                value={t.title}
                onChange={(e) => update(t.id, { title: e.target.value })}
              />
            </div>
            <span className={`shrink-0 mt-2 text-xs px-2 py-1 rounded-full ${STATUS_BADGE[t.status] || 'bg-gray-100 text-gray-600'}`}>
              {STATUS_LABELS[t.status] || t.status}
            </span>
            <button
              type="button"
              onClick={() => remove(t.id)}
              className="shrink-0 mt-2 text-gray-400 hover:text-red-600 text-sm"
              title="Remove threat"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              options={strideOptions}
              value={t.stride || ''}
              onChange={(e) => update(t.id, { stride: e.target.value || null })}
            />
            <Select
              options={statusOptions}
              value={t.status}
              onChange={(e) => update(t.id, { status: e.target.value })}
            />
          </div>

          <Textarea
            placeholder="Q3 — What are we going to do about it? (mitigation, control, or plan)"
            value={t.mitigation}
            onChange={(e) => update(t.id, { mitigation: e.target.value })}
            className="min-h-[70px]"
          />
          <Input
            placeholder="Ticket / reference URL (optional)"
            value={t.ticketUrl}
            onChange={(e) => update(t.id, { ticketUrl: e.target.value })}
          />
        </div>
      ))}

      <Button variant="outline" size="sm" onClick={() => add()}>
        + Add threat
      </Button>
    </div>
  );
}
