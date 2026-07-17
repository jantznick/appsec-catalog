import { useState } from 'react';
import { Button, Textarea, Select, Checkbox } from '../ui';
import { ThreatEditor } from './ThreatEditor.jsx';

// Join a list into "a", "a and b", or "a, b, and c".
function joinAnd(items) {
  if (items.length <= 1) return items[0] || '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function QuestionBlock({ number, title, hint, children }) {
  return (
    <section className="border-t border-gray-100 pt-5 first:border-t-0 first:pt-0">
      <div className="flex items-baseline gap-2 mb-1">
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold shrink-0">
          {number}
        </span>
        <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
      </div>
      {hint && <p className="text-xs text-gray-500 mb-3 ml-8">{hint}</p>}
      <div className="ml-8">{children}</div>
    </section>
  );
}

/**
 * Editor for one node of the threat model (the application root, or a component).
 * Walks through Adam Shostack's four questions.
 */
export function FourQuestionEditor({ node, isRoot, options, saving, onSave, onDelete, requiredByBoxes = [] }) {
  // The parent remounts this editor (via `key`) when a different node is selected
  // or when server data refreshes after a save, so initializing from props once is
  // correct — and it means unsaved edits survive unrelated parent re-renders.
  const [draft, setDraft] = useState(node);
  const [dirty, setDirty] = useState(false);

  const set = (patch) => {
    setDraft((d) => ({ ...d, ...patch }));
    setDirty(true);
  };

  const archetype = options.archetypes.find((a) => a.key === draft.archetype);

  const toggleInList = (list, key) =>
    list.includes(key) ? list.filter((k) => k !== key) : [...list, key];

  const handleSave = () => {
    if (isRoot) {
      onSave({
        scope: draft.scope,
        actors: draft.actors,
        dataTypes: draft.dataTypes,
        threats: draft.threats,
        status: draft.status,
        reviewer: draft.reviewer,
      });
    } else {
      onSave({
        name: draft.name,
        archetype: draft.archetype,
        scope: draft.scope,
        threats: draft.threats,
        reviewed: draft.reviewed,
      });
    }
    setDirty(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900">
            {isRoot ? 'Whole application' : draft.name}
          </h3>
          {isRoot ? (
            <p className="text-sm text-gray-500">
              Answer the four questions for the application as a whole.
            </p>
          ) : requiredByBoxes.length > 0 ? (
            <p className="text-sm text-amber-700">
              Auto-added because app contains {joinAnd(requiredByBoxes)}.
            </p>
          ) : archetype?.label && archetype.label !== draft.name ? (
            <p className="text-sm text-gray-500">{archetype.label}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!isRoot && (
            <Button variant="ghost" size="sm" onClick={onDelete} className="text-red-600 hover:bg-red-50">
              Delete
            </Button>
          )}
          <Button size="sm" onClick={handleSave} loading={saving} disabled={!dirty && !saving}>
            {dirty ? 'Save changes' : 'Saved'}
          </Button>
        </div>
      </div>

      {/* Q1 — What are we working on? */}
      <QuestionBlock
        number={1}
        title="What are we working on?"
        hint={isRoot ? 'Describe the application and its purpose.' : 'Describe this part of the application.'}
      >
        <div className="space-y-4">
          {!isRoot && (
            <Select
              label="Component type"
              options={options.archetypes.map((a) => ({ value: a.key, label: a.label }))}
              value={draft.archetype}
              onChange={(e) => set({ archetype: e.target.value })}
            />
          )}
          <Textarea
            placeholder={
              isRoot
                ? 'e.g. Customer-facing web app for booking appointments; used by end users and support staff.'
                : 'e.g. OAuth-based login and session handling for the web and mobile clients.'
            }
            value={draft.scope || ''}
            onChange={(e) => set({ scope: e.target.value })}
          />

          {isRoot && (
            <p className="text-xs text-gray-500 -mt-1">
              Checking a sensitive data type or a privileged actor adds a matching component below
              to model on its own (e.g. payment data → a Payment processing component).
            </p>
          )}

          {isRoot && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Who interacts with it?</p>
                <div className="space-y-1">
                  {options.actors.map((a) => (
                    <Checkbox
                      key={a.key}
                      label={a.label}
                      checked={(draft.actors || []).includes(a.key)}
                      onChange={() => set({ actors: toggleInList(draft.actors || [], a.key) })}
                    />
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Sensitive data handled?</p>
                <div className="space-y-1">
                  {options.dataTypes.map((d) => (
                    <Checkbox
                      key={d.key}
                      label={d.label}
                      checked={(draft.dataTypes || []).includes(d.key)}
                      onChange={() => set({ dataTypes: toggleInList(draft.dataTypes || [], d.key) })}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </QuestionBlock>

      {/* Q2 + Q3 — threats and mitigations */}
      <QuestionBlock
        number={2}
        title="What can go wrong? — and what will we do about it?"
        hint="List threats. STRIDE tags are optional prompts to jog your thinking; add a mitigation and status for each."
      >
        <ThreatEditor
          threats={draft.threats || []}
          stride={options.stride}
          threatStatuses={options.threatStatuses}
          relevantStride={archetype?.relevantStride || []}
          starterThreats={archetype?.starterThreats || []}
          onChange={(threats) => set({ threats })}
        />
      </QuestionBlock>

      {/* Q4 — Did we do a good job? */}
      <QuestionBlock
        number={4}
        title="Did we do a good job?"
        hint={isRoot ? 'Track review status and sign-off for the model.' : 'Mark this component as reviewed once it has been worked through.'}
      >
        {isRoot ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Status"
              options={options.modelStatuses.map((s) => ({
                value: s,
                label: s.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
              }))}
              value={draft.status}
              onChange={(e) => set({ status: e.target.value })}
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Reviewer</label>
              <input
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Reviewer name / email"
                value={draft.reviewer || ''}
                onChange={(e) => set({ reviewer: e.target.value })}
              />
            </div>
          </div>
        ) : (
          <Checkbox
            label="This component has been reviewed"
            checked={draft.reviewed || false}
            onChange={() => set({ reviewed: !draft.reviewed })}
          />
        )}
      </QuestionBlock>
    </div>
  );
}
