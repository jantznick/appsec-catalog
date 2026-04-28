import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import useAuthStore from '../store/authStore.js';
import { api } from '../lib/api.js';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Select } from '../components/ui/Select.jsx';
import { Input } from '../components/ui/Input.jsx';
import { toast } from '../components/ui/Toast.jsx';

export function SettingsDeploy() {
  const { isAdmin } = useAuthStore();
  const [target, setTarget] = useState('both');
  const [version, setVersion] = useState('');
  const [deploying, setDeploying] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  if (!isAdmin()) {
    return <Navigate to="/dashboard" replace />;
  }

  const triggerDeploy = async () => {
    try {
      setDeploying(true);
      setLastResult(null);
      const result = await api.adminTriggerDeploy({
        target,
        version: version?.trim() || undefined,
      });
      setLastResult(result || null);
      toast.success(result?.output ? 'Deploy finished. See output below.' : 'Deploy triggered.');
    } catch (e) {
      setLastResult(e?.details ? { ok: false, ...e.details } : null);
      toast.error(e?.message || 'Failed to trigger deploy');
    } finally {
      setDeploying(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings • Deploy</h1>
        <p className="text-sm text-gray-600 mt-1">
          Admin-only. Triggers a production deploy on this VM.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Trigger deploy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Target"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              options={[
                { value: 'frontend', label: 'Frontend only' },
                { value: 'backend', label: 'Backend only' },
                { value: 'both', label: 'Frontend + Backend' },
              ]}
            />
            <Input
              label="Version (optional)"
              placeholder="e.g. v1.2.3 or git sha"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              helperText="If set, will be recorded in deployments (when deployment token env vars are configured)."
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              variant="primary"
              loading={deploying}
              onClick={triggerDeploy}
            >
              Trigger deploy
            </Button>
          </div>
        </CardContent>
      </Card>

      {lastResult && (
        <Card>
          <CardHeader>
            <CardTitle>Last deploy output</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-gray-50 border border-gray-200 rounded-lg p-3 overflow-auto max-h-96 whitespace-pre-wrap">
              {lastResult.output || lastResult.stdout || ''}
              {lastResult.stderr ? `\n\n[stderr]\n${lastResult.stderr}` : ''}
            </pre>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Prerequisites</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-700 space-y-2">
          <div>
            The backend container must be able to start a short-lived docker runner container. In compose, this is enabled by mounting the docker socket.
          </div>
          <div>
            Set <code className="px-1 py-0.5 bg-gray-100 rounded">DEPLOY_HOST_WORKDIR</code> to the absolute path of this repo on the VM (e.g. <code className="px-1 py-0.5 bg-gray-100 rounded">/opt/appsec-catalog</code>).
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

