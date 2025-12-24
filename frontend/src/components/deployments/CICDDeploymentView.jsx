import { useState, useEffect } from 'react';
import { api } from '../../lib/api.js';
import { toast } from '../ui/Toast.jsx';
import { Button } from '../ui/Button.jsx';
import { Input } from '../ui/Input.jsx';
import { Select } from '../ui/Select.jsx';
import { copyToClipboard, isClipboardAvailable } from '../../utils/clipboard.js';
import useAuthStore from '../../store/authStore.js';

export function CICDDeploymentView({
  applicationId,
  applicationName,
  applicationCompanyId,
  deploymentTokens,
  loadingTokens,
  newTokenName,
  setNewTokenName,
  creatingToken,
  selectedTokenForApp,
  setSelectedTokenForApp,
  addingToToken,
  onLoadAllTokens,
  onCreateToken,
  onAddToToken,
  onRefreshTokens,
}) {
  const [allTokens, setAllTokens] = useState([]);
  const [loadingAllTokens, setLoadingAllTokens] = useState(false);
  const [createdToken, setCreatedToken] = useState(null);
  const [addedToTokenId, setAddedToTokenId] = useState(null); // Track which token we just added to
  const [initialHasToken, setInitialHasToken] = useState(false); // Track if there was a token when component mounted
  const [hasCapturedInitialState, setHasCapturedInitialState] = useState(false); // Track if we've captured initial state
  const [frontendUrl, setFrontendUrl] = useState('');
  const [commandTab, setCommandTab] = useState('curl'); // 'curl' or 'wget'

  // The backend already filters by companyId, so all tokens in deploymentTokens are valid
  const hasToken = deploymentTokens && deploymentTokens.length > 0;

  // Initialize on mount
  useEffect(() => {
    // Get frontend URL from window location
    const url = window.location.origin;
    setFrontendUrl(url);
    
    // Load all tokens when component mounts
    loadAllTokens();
  }, []); // Only run on mount

  // Capture initial state the first time deploymentTokens has data (after loading completes)
  useEffect(() => {
    // Only capture initial state once, when we first have data and we're not loading
    if (!hasCapturedInitialState && !loadingTokens) {
      setInitialHasToken(deploymentTokens && deploymentTokens.length > 0);
      setHasCapturedInitialState(true);
    }
  }, [deploymentTokens, loadingTokens, hasCapturedInitialState]);

  const { user, isAdmin } = useAuthStore();

  const loadAllTokens = async () => {
    try {
      setLoadingAllTokens(true);
      const tokens = await onLoadAllTokens();
      // Filter tokens by company if not admin
      if (!isAdmin() && user?.companyId) {
        setAllTokens(tokens.filter(t => t.companyId === user.companyId));
      } else {
        setAllTokens(tokens);
      }
    } catch (error) {
      console.error('Failed to load all tokens:', error);
    } finally {
      setLoadingAllTokens(false);
    }
  };

  const handleCreateToken = async () => {
    if (!newTokenName || !newTokenName.trim()) {
      toast.error('Token name is required');
      return;
    }
    
    try {
      const token = await onCreateToken();
      setCreatedToken(token);
      setAddedToTokenId(null); // Clear addedToTokenId when creating a new token
      await loadAllTokens();
      await onRefreshTokens();
    } catch (error) {
      // Error handling is done in parent
    }
  };

  const handleAddToToken = async () => {
    if (!selectedTokenForApp) {
      toast.error('Please select a token');
      return;
    }
    
    try {
      await onAddToToken();
      setAddedToTokenId(selectedTokenForApp); // Track which token we just added to
      await loadAllTokens();
      await onRefreshTokens();
    } catch (error) {
      // Error handling is done in parent
    }
  };

  // Get the token to display (either newly created, just added to, or existing)
  // If we just added to a token, prefer that one; otherwise use the first available
  const displayToken = createdToken || 
    (addedToTokenId && deploymentTokens?.find(t => t.id === addedToTokenId)) ||
    (hasToken ? deploymentTokens[0] : null);
  // Use plaintextToken if available (from creation), otherwise use token field
  const tokenValue = displayToken?.plaintextToken || displayToken?.token || displayToken?.tokenHash || '';

  // Generate curl command
  const generateCurlCommand = () => {
    const apiUrl = `${frontendUrl}/api/applications/deployments`;
    const token = tokenValue;
    
    return `curl -X POST ${apiUrl} \\
  -H "Content-Type: application/json" \\
  -d '{
    "token": "${token}",
    "applicationId": "${applicationId}",
    "deployedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "environment": "{env}",
    "version": "{version}",
    "gitBranch": "{gitBranch}",
    "deployedBy": "CI/CD Pipeline",
    "notes": "Automated deployment"
  }'`;
  };

  // Generate wget command
  const generateWgetCommand = () => {
    const apiUrl = `${frontendUrl}/api/applications/deployments`;
    const token = tokenValue;
    
    return `wget --method=POST \\
  --header="Content-Type: application/json" \\
  --body-data='{
    "token": "${token}",
    "applicationId": "${applicationId}",
    "deployedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "environment": "{env}",
    "version": "{version}",
    "gitBranch": "{gitBranch}",
    "deployedBy": "CI/CD Pipeline",
    "notes": "Automated deployment"
  }' \\
  ${apiUrl}`;
  };

  const copyCommand = (command) => {
    copyToClipboard(
      command,
      () => toast.success('Command copied to clipboard!'),
      (error) => toast.error(error || 'Failed to copy command')
    );
  };

  // Filter tokens that aren't from this company
  const availableTokens = allTokens.filter(token => {
    return token.companyId === applicationCompanyId;
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left Column: Forms and Info */}
      <div className="space-y-6">
        {/* Token Status - Only show if there was a token initially (before any user action) */}
        {initialHasToken && !createdToken && !addedToTokenId && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-900">
                  This application already has a deployment token configured.
                </p>
                <p className="text-sm text-blue-700 mt-1">
                  It may already be integrated into a CI/CD pipeline. You can add it to an existing token or create a new one below.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Create New Token */}
        <div className="border border-gray-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Create New Token</h3>
          <div className="space-y-3">
            <Input
              label="Token Name"
              value={newTokenName}
              onChange={(e) => setNewTokenName(e.target.value)}
              placeholder="e.g., Production Pipeline Token"
            />
            <Button
              onClick={handleCreateToken}
              disabled={!newTokenName?.trim() || creatingToken}
              loading={creatingToken}
              size="sm"
            >
              Create Token
            </Button>
          </div>
        </div>

        {/* Add to Existing Token */}
        {availableTokens.length > 0 && (
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Add to Existing Token</h3>
            <div className="space-y-3">
              <Select
                label="Select Token"
                value={selectedTokenForApp}
                onChange={(e) => setSelectedTokenForApp(e.target.value)}
                options={[
                  { value: '', label: 'Select a token...' },
                  ...availableTokens.map(token => ({
                    value: token.id,
                    label: `${token.name || 'Unnamed Token'} (${token.applications?.length || 0} application${(token.applications?.length || 0) !== 1 ? 's' : ''})`,
                  })),
                ]}
              />
              <Button
                onClick={handleAddToToken}
                disabled={!selectedTokenForApp || addingToToken}
                loading={addingToToken}
                size="sm"
                variant="outline"
              >
                Add Application to Token
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Right Column: Token Display and Commands */}
      {displayToken && tokenValue && (
        <div className="space-y-4">
          {/* Token Display */}
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Deployment Token</label>
              {isClipboardAvailable() && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    copyToClipboard(
                      tokenValue,
                      () => toast.success('Token copied to clipboard!'),
                      (error) => toast.error(error || 'Failed to copy token')
                    );
                  }}
                >
                  Copy Token
                </Button>
              )}
            </div>
            <div className="bg-white border border-gray-300 rounded p-3 font-mono text-sm break-all">
              {tokenValue}
            </div>
            {!isClipboardAvailable() && (
              <p className="text-xs text-gray-500 mt-2">
                Copy to clipboard is only available over HTTPS
              </p>
            )}
          </div>

          {/* Command Examples - Tabbed */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <label className="text-sm font-medium text-gray-700">CI/CD Command Examples</label>
              {isClipboardAvailable() && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyCommand(commandTab === 'curl' ? generateCurlCommand() : generateWgetCommand())}
                >
                  Copy
                </Button>
              )}
            </div>
            
            {/* Tabs */}
            <div className="flex gap-2 mb-4 border-b border-gray-200">
              <button
                onClick={() => setCommandTab('curl')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  commandTab === 'curl'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                cURL
              </button>
              <button
                onClick={() => setCommandTab('wget')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  commandTab === 'wget'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                wget
              </button>
            </div>

            {/* Command Content */}
            <pre className="bg-gray-900 text-gray-100 p-4 rounded text-xs overflow-x-auto">
              <code>{commandTab === 'curl' ? generateCurlCommand() : generateWgetCommand()}</code>
            </pre>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-sm text-yellow-800">
              <strong>Note:</strong> Replace the example values (environment, version, gitBranch, etc.) with your actual deployment data. 
              The token is pre-filled and should be kept secure.
            </p>
          </div>
        </div>
      )}

      {!displayToken && (
        <div className="text-center py-8 text-gray-500">
          <p>Create a token or add this application to an existing token to see CI/CD integration commands.</p>
        </div>
      )}
    </div>
  );
}

