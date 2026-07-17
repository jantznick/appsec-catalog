import { useState } from 'react';
import { Modal, Button, Input } from '../ui';

/**
 * Adds a component node. Archetypes are presented as pickable cards so the user
 * gets prompted toward the main parts of an app (auth, payments, storage, ...).
 */
export function AddComponentModal({ isOpen, onClose, archetypes, existingArchetypes = [], onAdd, adding }) {
  const [archetype, setArchetype] = useState(null);
  const [name, setName] = useState('');

  const pick = (a) => {
    setArchetype(a.key);
    // Suggest the archetype label as the default name if the field is empty/untouched.
    if (!name.trim() || archetypes.some((x) => x.label === name)) {
      setName(a.label);
    }
  };

  const reset = () => {
    setArchetype(null);
    setName('');
  };

  const handleAdd = async () => {
    if (!name.trim()) return;
    await onAdd({ archetype: archetype || 'other', name: name.trim() });
    reset();
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Add a component"
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={handleClose}>Cancel</Button>
          <Button onClick={handleAdd} loading={adding} disabled={!name.trim()}>Add component</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Pick a common part of the application to model, or choose "Other" for anything else.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {archetypes.map((a) => {
            const already = existingArchetypes.filter((k) => k === a.key).length;
            const selected = archetype === a.key;
            return (
              <button
                key={a.key}
                type="button"
                onClick={() => pick(a)}
                className={`text-left rounded-lg border p-3 transition-colors ${
                  selected
                    ? 'border-blue-500 ring-2 ring-blue-200 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900">{a.label}</span>
                  {already > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
                      {already} added
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">{a.description}</p>
              </button>
            );
          })}
        </div>

        <Input
          label="Component name"
          placeholder="e.g. Login & sessions"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
    </Modal>
  );
}
