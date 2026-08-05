import { Modal } from '../ui/Modal.jsx';
import { Button } from '../ui/Button.jsx';
import { Input } from '../ui/Input.jsx';

/**
 * The Language/Framework step of the GitHub link/change/sync flow. Prefilled with the repo's
 * detected values; when a field already had a value, it is shown as "Previous: …" helper text so
 * the user can see what they're replacing. Saving persists immediately (its own flow — never
 * touches the metadata edit form).
 *
 * @param {{
 *   isOpen: boolean, onClose: () => void,
 *   language: string, framework: string,
 *   setLanguage: (v: string) => void, setFramework: (v: string) => void,
 *   previousLanguage?: string, previousFramework?: string,
 *   onSave: () => void, saving?: boolean,
 * }} props
 */
export function ScmLanguageFrameworkModal({
  isOpen,
  onClose,
  language,
  framework,
  setLanguage,
  setFramework,
  previousLanguage,
  previousFramework,
  onSave,
  saving = false,
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !saving && onClose()}
      title="Language & framework from GitHub"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onSave} loading={saving}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Detected from the repository. Edit if needed — saving updates the application directly.
        </p>
        <Input
          label="Language"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          helperText={previousLanguage ? `Previous: ${previousLanguage}` : undefined}
        />
        <Input
          label="Framework"
          value={framework}
          onChange={(e) => setFramework(e.target.value)}
          helperText={previousFramework ? `Previous: ${previousFramework}` : undefined}
        />
      </div>
    </Modal>
  );
}
