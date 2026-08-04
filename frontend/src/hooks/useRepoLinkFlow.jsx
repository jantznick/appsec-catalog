import { useState } from 'react';
import { api } from '../lib/api.js';
import { toast } from '../components/ui/Toast.jsx';
import { Modal } from '../components/ui/Modal.jsx';
import { Button } from '../components/ui/Button.jsx';
import { GithubRepoPickerModal } from '../components/integrations/GithubRepoPickerModal.jsx';
import { GithubLanguageFrameworkModal } from '../components/integrations/GithubLanguageFrameworkModal.jsx';

/** Detected language/framework strings from a serialized repo (languages + dependencies). */
function computeDetected(repo) {
  const language = Object.entries(repo?.languages || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([l]) => l)
    .join(', ');
  const framework = [
    ...new Set((repo?.dependencies || []).filter((d) => d.isFramework && d.framework).map((d) => d.framework)),
  ].join(', ');
  return { language, framework };
}

/**
 * Encapsulates the entire GitHub repo link/change/sync/unlink flow as a self-contained unit that is
 * INDEPENDENT of any metadata edit form. Link/change/sync each open the Language/Framework modal
 * afterward (prefilled with detected values, showing the previous value as helper text); saving
 * persists immediately. Unlink just unlinks. After any change it calls `onChanged()` to refresh.
 *
 * Returns action triggers, in-flight flags, and a `modals` element the caller renders once.
 *
 * @param {object} application  the current application (for id + previous language/framework)
 * @param {() => Promise<void>} onChanged  called after any successful change
 */
export function useRepoLinkFlow(application, onChanged) {
  const applicationId = application?.id;

  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false); // linking or syncing
  const [unlinkConfirmOpen, setUnlinkConfirmOpen] = useState(false);
  const [unlinking, setUnlinking] = useState(false);

  const [lfOpen, setLfOpen] = useState(false);
  const [lfLang, setLfLang] = useState('');
  const [lfFramework, setLfFramework] = useState('');
  const [prevLang, setPrevLang] = useState('');
  const [prevFramework, setPrevFramework] = useState('');
  const [saving, setSaving] = useState(false);

  // Open the Language/Framework modal only when GitHub actually detected something; otherwise there
  // is nothing to confirm, so we skip it.
  const openLangFrameworkModal = (repo, previousLanguage, previousFramework) => {
    const det = computeDetected(repo);
    if (!det.language && !det.framework) return;
    setPrevLang(previousLanguage || '');
    setPrevFramework(previousFramework || '');
    setLfLang(det.language);
    setLfFramework(det.framework);
    setLfOpen(true);
  };

  const openLinkPicker = () => setPickerOpen(true);

  const onPickRepo = async (repo) => {
    if (!applicationId) return;
    const prevL = application?.language || '';
    const prevF = application?.framework || '';
    setBusy(true);
    try {
      const res = await api.linkApplicationGithubRepo(applicationId, { owner: repo.owner, name: repo.name });
      setPickerOpen(false);
      toast.success(`Linked ${repo.fullName}`);
      await onChanged();
      openLangFrameworkModal(res.repo, prevL, prevF);
    } catch (e) {
      toast.error(e.message || 'Failed to link repository');
    } finally {
      setBusy(false);
    }
  };

  const sync = async () => {
    if (!applicationId) return;
    const prevL = application?.language || '';
    const prevF = application?.framework || '';
    setBusy(true);
    try {
      const res = await api.syncApplicationGithubRepo(applicationId);
      toast.success('Repository synced');
      await onChanged();
      openLangFrameworkModal(res.repo, prevL, prevF);
    } catch (e) {
      toast.error(e.message || 'Failed to sync repository');
    } finally {
      setBusy(false);
    }
  };

  const unlink = () => setUnlinkConfirmOpen(true);

  const confirmUnlink = async () => {
    if (!applicationId) return;
    setUnlinking(true);
    try {
      await api.unlinkApplicationGithubRepo(applicationId);
      toast.success('Repository unlinked');
      setUnlinkConfirmOpen(false);
      await onChanged();
    } catch (e) {
      toast.error(e.message || 'Failed to unlink repository');
    } finally {
      setUnlinking(false);
    }
  };

  const saveLangFramework = async () => {
    if (!applicationId) return;
    setSaving(true);
    try {
      await api.applyApplicationGithubData(applicationId, { language: lfLang, framework: lfFramework });
      toast.success('Language and framework updated');
      setLfOpen(false);
      await onChanged();
    } catch (e) {
      toast.error(e.message || 'Failed to save language and framework');
    } finally {
      setSaving(false);
    }
  };

  const modals = (
    <>
      <GithubRepoPickerModal
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={onPickRepo}
        title="Link a GitHub repository"
        confirmLabel="Link repository"
        submitting={busy}
      />
      <GithubLanguageFrameworkModal
        isOpen={lfOpen}
        onClose={() => setLfOpen(false)}
        language={lfLang}
        framework={lfFramework}
        setLanguage={setLfLang}
        setFramework={setLfFramework}
        previousLanguage={prevLang}
        previousFramework={prevFramework}
        onSave={saveLangFramework}
        saving={saving}
      />
      <Modal
        isOpen={unlinkConfirmOpen}
        onClose={() => !unlinking && setUnlinkConfirmOpen(false)}
        title="Unlink repository?"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setUnlinkConfirmOpen(false)} disabled={unlinking}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmUnlink} loading={unlinking}>
              Unlink
            </Button>
          </>
        }
      >
        <p className="text-gray-700">
          Unlink this repository from the application? This also clears the Repository URL. The
          repository&apos;s cached data stays available for any other applications linked to it.
        </p>
      </Modal>
    </>
  );

  return { openLinkPicker, sync, unlink, busy, unlinking, modals };
}
