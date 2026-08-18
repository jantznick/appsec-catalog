import { useMemo, useState } from 'react';
import { Modal, Button } from '../ui';

/**
 * Review UI for an AI-generated threat-model draft. Nothing here is saved until
 * the user clicks "Apply selected" — every suggestion is opt-in (checked by
 * default for fast review). The parent performs the actual writes through the
 * normal threat-model endpoints, so accepted content is re-validated server-side.
 */
export function AiDraftReviewModal({
  isOpen,
  onClose,
  draft,
  meta,
  options,
  existingModel,
  onApply,
  applying,
}) {
  const strideLabel = useMemo(() => {
    const m = {};
    for (const s of options?.stride || []) m[s.key] = s.label;
    return m;
  }, [options]);
  const actorLabel = useMemo(() => labelMap(options?.actors), [options]);
  const dataLabel = useMemo(() => labelMap(options?.dataTypes), [options]);

  const hasScopeSuggestion = Boolean(draft?.scope) && !existingModel?.scope;
  const [applyScope, setApplyScope] = useState(hasScopeSuggestion);
  const [applyActors, setApplyActors] = useState(true);
  const [applyDataTypes, setApplyDataTypes] = useState(true);
  const [appChecked, setAppChecked] = useState(() => (draft?.appThreats || []).map(() => true));
  const [compState, setCompState] = useState(() =>
    (draft?.components || []).map((c) => ({
      include: true,
      threats: (c.threats || []).map(() => true),
    }))
  );

  if (!draft) return null;

  const toggleApp = (i) =>
    setAppChecked((s) => s.map((v, idx) => (idx === i ? !v : v)));
  const toggleComp = (i) =>
    setCompState((s) => s.map((c, idx) => (idx === i ? { ...c, include: !c.include } : c)));
  const toggleCompThreat = (ci, ti) =>
    setCompState((s) =>
      s.map((c, idx) =>
        idx === ci ? { ...c, threats: c.threats.map((v, j) => (j === ti ? !v : v)) } : c
      )
    );

  const acceptedAppCount = appChecked.filter(Boolean).length;
  const acceptedCompCount = compState.filter((c) => c.include).length;
  const totalSelected =
    acceptedAppCount +
    compState.reduce((n, c) => n + (c.include ? c.threats.filter(Boolean).length : 0), 0);

  const handleApply = () => {
    const selection = {
      q1: {
        scope: applyScope ? draft.scope : null,
        actors: applyActors ? draft.actors || [] : [],
        dataTypes: applyDataTypes ? draft.dataTypes || [] : [],
      },
      appThreats: (draft.appThreats || []).filter((_, i) => appChecked[i]),
      components: (draft.components || [])
        .map((c, i) =>
          compState[i]?.include
            ? { ...c, threats: (c.threats || []).filter((_, j) => compState[i].threats[j]) }
            : null
        )
        .filter(Boolean),
    };
    onApply(selection);
  };

  const costText =
    meta?.cost?.totalCost != null
      ? `~$${Number(meta.cost.totalCost).toFixed(4)}`
      : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Review AI-drafted threats"
      size="lg"
      footer={
        <>
          <span className="mr-auto text-xs text-gray-500">
            {totalSelected} item{totalSelected === 1 ? '' : 's'} selected
            {meta?.model ? ` · ${meta.model}` : ''}
            {costText ? ` · ${costText}` : ''}
          </span>
          <Button variant="secondary" onClick={onClose} disabled={applying}>
            Cancel
          </Button>
          <Button onClick={handleApply} loading={applying} disabled={totalSelected === 0}>
            Apply selected
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <p className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-800">
          These are AI suggestions grounded in this application's details. Nothing is saved until you
          apply it — review, uncheck anything you disagree with, then apply. You can edit the wording
          afterward in the normal editor.
        </p>

        {/* Question 1 */}
        {(hasScopeSuggestion || draft.actors?.length > 0 || draft.dataTypes?.length > 0) && (
          <Section title="Question 1 — what are we working on?">
            {hasScopeSuggestion && (
              <label className="flex items-start gap-2">
                <input type="checkbox" className="mt-1 h-4 w-4" checked={applyScope} onChange={() => setApplyScope((v) => !v)} />
                <span className="text-sm text-gray-700"><span className="font-medium">Scope:</span> {draft.scope}</span>
              </label>
            )}
            {draft.actors?.length > 0 && (
              <label className="flex items-start gap-2">
                <input type="checkbox" className="mt-1 h-4 w-4" checked={applyActors} onChange={() => setApplyActors((v) => !v)} />
                <span className="text-sm text-gray-700">
                  <span className="font-medium">Actors:</span> {draft.actors.map((a) => actorLabel[a] || a).join(', ')}
                </span>
              </label>
            )}
            {draft.dataTypes?.length > 0 && (
              <label className="flex items-start gap-2">
                <input type="checkbox" className="mt-1 h-4 w-4" checked={applyDataTypes} onChange={() => setApplyDataTypes((v) => !v)} />
                <span className="text-sm text-gray-700">
                  <span className="font-medium">Data types:</span> {draft.dataTypes.map((d) => dataLabel[d] || d).join(', ')}
                </span>
              </label>
            )}
          </Section>
        )}

        {/* App-level threats */}
        {draft.appThreats?.length > 0 && (
          <Section title={`Application-level threats (${acceptedAppCount}/${draft.appThreats.length})`}>
            <div className="space-y-2">
              {draft.appThreats.map((t, i) => (
                <ThreatRow
                  key={i}
                  threat={t}
                  strideLabel={strideLabel}
                  checked={appChecked[i]}
                  onToggle={() => toggleApp(i)}
                />
              ))}
            </div>
          </Section>
        )}

        {/* Components */}
        {draft.components?.length > 0 && (
          <Section title={`Suggested components (${acceptedCompCount}/${draft.components.length})`}>
            <div className="space-y-3">
              {draft.components.map((c, ci) => (
                <div key={ci} className="rounded-lg border border-gray-200 p-3">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="h-4 w-4" checked={compState[ci].include} onChange={() => toggleComp(ci)} />
                    <span className="text-sm font-semibold text-gray-900">{c.name}</span>
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] uppercase text-gray-500">{c.archetype}</span>
                  </label>
                  {c.scope && <p className="ml-6 mt-1 text-xs text-gray-500">{c.scope}</p>}
                  {compState[ci].include && c.threats?.length > 0 && (
                    <div className="ml-6 mt-2 space-y-2">
                      {c.threats.map((t, ti) => (
                        <ThreatRow
                          key={ti}
                          threat={t}
                          strideLabel={strideLabel}
                          checked={compState[ci].threats[ti]}
                          onToggle={() => toggleCompThreat(ci, ti)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}
      </div>
    </Modal>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">{title}</h4>
      {children}
    </div>
  );
}

function ThreatRow({ threat, strideLabel, checked, onToggle }) {
  return (
    <label className="flex items-start gap-2 rounded-md border border-gray-100 bg-gray-50/50 p-2">
      <input type="checkbox" className="mt-1 h-4 w-4" checked={checked} onChange={onToggle} />
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900">{threat.title}</span>
          {threat.stride && (
            <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] text-indigo-700">
              {strideLabel[threat.stride] || threat.stride}
            </span>
          )}
        </div>
        {threat.description && <p className="mt-0.5 text-xs text-gray-600">{threat.description}</p>}
        {threat.mitigation && (
          <p className="mt-0.5 text-xs text-green-700"><span className="font-medium">Mitigation:</span> {threat.mitigation}</p>
        )}
      </div>
    </label>
  );
}

function labelMap(list) {
  const m = {};
  for (const item of list || []) m[item.key] = item.label;
  return m;
}
