import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import useAuthStore from '../store/authStore.js';
import { api } from '../lib/api.js';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card.jsx';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Select } from '../components/ui/Select.jsx';
import { Input } from '../components/ui/Input.jsx';
import { toast } from '../components/ui/Toast.jsx';

const formatDateTime = (value) => {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not recorded';
  return date.toLocaleString();
};

const displayValue = (value) => value || <span className="text-gray-400 italic">Not set</span>;

export function SettingsDeploy() {
  const { isAdmin } = useAuthStore();
  const [target, setTarget] = useState('auto');
  const [version, setVersion] = useState('');
  const [deploying, setDeploying] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [deploymentData, setDeploymentData] = useState({
    deployments: [],
    latest: null,
    latestByApplication: [],
  });
  const [loadingDeployments, setLoadingDeployments] = useState(true);
  const [deploymentError, setDeploymentError] = useState('');

  const loadDeployments = async () => {
    try {
      setLoadingDeployments(true);
      setDeploymentError('');
      const data = await api.getAdminDeployments(50);
      setDeploymentData({
        deployments: data.deployments || [],
        latest: data.latest || null,
        latestByApplication: data.latestByApplication || [],
      });
    } catch (e) {
      setDeploymentError(e?.message || 'Failed to load deployment history');
    } finally {
      setLoadingDeployments(false);
    }
  };

  useEffect(() => {
    if (isAdmin()) {
      loadDeployments();
    }
  }, []);

  if (!isAdmin()) {
    return <Navigate to="/dashboard" replace />;
  }

  const latestDeployment = deploymentData.latest;
  const currentVersion = latestDeployment?.version || '';
  const currentEnvironment = latestDeployment?.environment || latestDeployment?.application?.deploymentEnvironment || '';
  const currentGitBranch = latestDeployment?.gitBranch || latestDeployment?.application?.gitBranch || '';
  const uniqueApplications = new Set(deploymentData.deployments.map((deployment) => deployment.applicationId)).size;

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
      await loadDeployments();
    } catch (e) {
      setLastResult(e?.details ? { ok: false, ...e.details } : null);
      toast.error(e?.message || 'Failed to trigger deploy');
    } finally {
      setDeploying(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings • Deploy</h1>
        <p className="text-sm text-gray-600 mt-1">
          Admin-only. Triggers a production git pull + deploy on this VM. Auto uses the commit
          before pull versus after pull (not the running container image) and rebuilds only what
          changed under <code className="text-xs">frontend/</code>, <code className="text-xs">backend/</code>, or
          compose / <code className="text-xs">scripts/prod-deploy.sh</code>.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs font-medium text-gray-500 uppercase">Current version</p>
            <p className="mt-2 text-xl font-semibold text-gray-900 truncate">{displayValue(currentVersion)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs font-medium text-gray-500 uppercase">Last deployed</p>
            <p className="mt-2 text-sm font-medium text-gray-900">{formatDateTime(latestDeployment?.deployedAt)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs font-medium text-gray-500 uppercase">Environment</p>
            <p className="mt-2 text-xl font-semibold text-gray-900 truncate">{displayValue(currentEnvironment)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs font-medium text-gray-500 uppercase">Git branch</p>
            <p className="mt-2 text-xl font-semibold text-gray-900 truncate">{displayValue(currentGitBranch)}</p>
          </CardContent>
        </Card>
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
                {
                  value: 'auto',
                  label: 'Auto (git diff: frontend / backend / both)',
                },
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

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Deployment history</CardTitle>
              <p className="text-sm text-gray-600 mt-1">
                Recent deployment records across {uniqueApplications} application{uniqueApplications === 1 ? '' : 's'}.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={loadDeployments} disabled={loadingDeployments}>
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingDeployments ? (
            <p className="text-sm text-gray-500">Loading deployment history...</p>
          ) : deploymentError ? (
            <p className="text-sm text-red-600">{deploymentError}</p>
          ) : deploymentData.deployments.length === 0 ? (
            <p className="text-sm text-gray-500">
              No deployments recorded yet. Configure deployment token environment variables so deploys can log records here.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Deployed</TableHead>
                  <TableHead>Application</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Environment</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Deployed by</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deploymentData.deployments.map((deployment) => (
                  <TableRow key={deployment.id}>
                    <TableCell>{formatDateTime(deployment.deployedAt)}</TableCell>
                    <TableCell className="font-medium">{deployment.application?.name || 'Unknown application'}</TableCell>
                    <TableCell>{deployment.application?.company?.name || 'Unknown company'}</TableCell>
                    <TableCell>
                      <span className="px-2 py-1 text-xs font-medium rounded bg-blue-100 text-blue-800">
                        {deployment.environment}
                      </span>
                    </TableCell>
                    <TableCell>{displayValue(deployment.version)}</TableCell>
                    <TableCell>{displayValue(deployment.gitBranch)}</TableCell>
                    <TableCell>{displayValue(deployment.deployedBy)}</TableCell>
                    <TableCell className="max-w-xs truncate">{displayValue(deployment.notes)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
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
    </div>
  );
}
