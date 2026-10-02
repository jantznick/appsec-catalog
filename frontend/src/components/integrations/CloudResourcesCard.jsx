import { useCallback, useEffect, useState } from 'react';
import { toast } from '../ui/Toast.jsx';
import { Button } from '../ui/Button.jsx';
import { Input } from '../ui/Input.jsx';
import { Modal } from '../ui/Modal.jsx';
import { CloudResourcesPanel } from './CloudResourcesPanel.jsx';

/**
 * A record's cloud resources, plus the tag value they are found by.
 *
 * One card for a product and for an application: both assign a Wiz tag value and
 * both show what carries it, so writing it twice would mean two screens drifting
 * apart about how assignment works.
 *
 * The tag value is ASSIGNED here rather than matched against the product's name.
 * A company's tag values will not equal Orbit's record names, and depending on
 * that would make the whole feature rest on a naming convention nobody agreed
 * to. It is free text, because a company writing its tagging standard alongside
 * the catalog has to be able to assign a value before any resource carries it.
 */
export function CloudResourcesCard({
  tagKeyLabel,
  getTag,
  setTag,
  getResources,
  canEdit,
  emptyHint,
  placeholder,
  clearedHint,
}) {
  const [tagValue, setTagValue] = useState(null);
  const [showEdit, setShowEdit] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  // Changing the tag value changes the answer, so the panel has to re-ask.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getTag()
      .then((r) => !cancelled && setTagValue(r.tagValue))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(() => getResources(), [reloadKey]);

  const handleSave = async () => {
    try {
      setSaving(true);
      const result = await setTag(draft);
      setTagValue(result.tagValue);
      setShowEdit(false);
      setReloadKey((k) => k + 1);
      toast.success(result.tagValue ? 'Wiz tag value saved' : 'Wiz tag value cleared');
    } catch (error) {
      toast.error(error.message || 'Failed to save the Wiz tag value');
    } finally {
      setSaving(false);
    }
  };

  const description = (
    <>
      Resources in this company&rsquo;s Wiz folder tagged{' '}
      {tagValue ? (
        <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">{tagKeyLabel}: {tagValue}</code>
      ) : (
        <span className="italic">no value assigned yet</span>
      )}
      .{' '}
      {canEdit && (
        <button
          type="button"
          className="underline"
          onClick={() => {
            setDraft(tagValue || '');
            setShowEdit(true);
          }}
        >
          {tagValue ? 'Change' : 'Assign one'}
        </button>
      )}
    </>
  );

  return (
    <>
      <CloudResourcesPanel
        key={reloadKey}
        title="Cloud resources"
        description={description}
        load={load}
        emptyHint={emptyHint}
      />

      <Modal isOpen={showEdit} onClose={() => setShowEdit(false)} title={`Wiz ${tagKeyLabel} tag value`}>
        <div className="space-y-4">
          <Input
            label="Tag value"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={placeholder}
            helperText={`Exactly the value your resources carry in their Wiz ${tagKeyLabel} tag. Case matters: Wiz filters server-side and its match is exact. Not validated against existing tags — you can assign it before anything is tagged.`}
          />
          <p className="text-xs text-gray-500">{clearedHint}</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowEdit(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

export default CloudResourcesCard;
