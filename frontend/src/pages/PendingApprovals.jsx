import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { toast } from '../components/ui/Toast.jsx';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card.jsx';
import { Button } from '../components/ui/Button.jsx';
import { LoadingPage } from '../components/ui/Loading.jsx';
import { Modal } from '../components/ui/Modal.jsx';
import { Textarea } from '../components/ui/Textarea.jsx';
import { Checkbox } from '../components/ui/Checkbox.jsx';

export function PendingApprovals() {
  const navigate = useNavigate();
  const [pendingVersions, setPendingVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [selectedFields, setSelectedFields] = useState([]);
  const [approvingVersion, setApprovingVersion] = useState(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [versionChanges, setVersionChanges] = useState({});

  useEffect(() => {
    loadPendingVersions();
  }, []);

  const loadPendingVersions = async () => {
    try {
      setLoading(true);
      const versions = await api.getPendingVersions();
      setPendingVersions(versions);
      
      // Load comparison data for each version
      const changes = {};
      for (const version of versions) {
        try {
          // Get previous version to compare
          const allVersions = await api.getApplicationVersions(version.applicationId);
          const currentIndex = allVersions.findIndex(v => v.id === version.id);
          const previousVersion = allVersions[currentIndex + 1];
          
          if (previousVersion) {
            const comparison = await api.compareApplicationVersions(
              version.applicationId,
              previousVersion.versionNumber,
              version.versionNumber
            );
            changes[version.id] = comparison.comparison;
          } else {
            // Initial version - get all non-null fields
            const fieldsToCheck = [
              'name', 'description', 'owner', 'repoUrl', 'language', 'framework',
              'serverEnvironment', 'facing', 'deploymentType', 'authProfiles', 'dataTypes',
              'status', 'businessCriticality', 'criticalAspects', 'devTeamContact',
              'securityTestingDescription', 'additionalNotes', 'sastTool', 'sastIntegrationLevel', 'sastIncludesSca',
              'dastTool', 'dastIntegrationLevel', 'scaTool', 'scaIntegrationLevel', 'appFirewallTool', 'appFirewallIntegrationLevel',
              'apiSecurityTool', 'apiSecurityIntegrationLevel', 'apiSecurityNA',
              'appFirewallNA',
              'currentVersion', 'deploymentEnvironment', 'gitBranch',
              'lastDastScanDate', 'lastSastScanDate', 'lastScaScanDate', 'interfaces',
            ];
            const changedFields = fieldsToCheck.filter(field => version[field] !== null && version[field] !== undefined);
            changes[version.id] = {
              changedFields,
              diff: {},
              isInitialVersion: true,
            };
          }
        } catch (error) {
          console.error(`Failed to load comparison for version ${version.id}:`, error);
        }
      }
      setVersionChanges(changes);
    } catch (error) {
      toast.error('Failed to load pending approvals');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getFieldLabel = (field) => {
    const labels = {
      name: 'Name',
      description: 'Description',
      owner: 'Owner',
      repoUrl: 'Repository URL',
      language: 'Language',
      framework: 'Framework',
      serverEnvironment: 'Server Environment',
      facing: 'Facing',
      deploymentType: 'Deployment Type',
      authProfiles: 'Auth Profiles',
      dataTypes: 'Data Types',
      status: 'Status',
      businessCriticality: 'Business Criticality',
      criticalAspects: 'Critical Aspects',
      devTeamContact: 'Dev Team Contact',
      securityTestingDescription: 'Security Testing Description',
      additionalNotes: 'Additional Notes',
      sastTool: 'SAST Tool',
      sastIntegrationLevel: 'SAST Integration Level',
      sastIncludesSca: 'SAST includes SCA',
      dastTool: 'DAST Tool',
      dastIntegrationLevel: 'DAST Integration Level',
      scaTool: 'SCA Tool',
      scaIntegrationLevel: 'SCA Integration Level',
      appFirewallTool: 'App Firewall Tool',
      appFirewallIntegrationLevel: 'App Firewall Integration Level',
      apiSecurityTool: 'API Security Tool',
      apiSecurityIntegrationLevel: 'API Security Integration Level',
      apiSecurityNA: 'API Security N/A',
      appFirewallNA: 'App Firewall N/A',
      currentVersion: 'Current Version',
      deploymentEnvironment: 'Deployment Environment',
      gitBranch: 'Git Branch',
      lastDastScanDate: 'Last DAST Scan Date',
      lastSastScanDate: 'Last SAST Scan Date',
      lastScaScanDate: 'Last SCA Scan Date',
      interfaces: 'Interfaces',
    };
    return labels[field] || field.replace(/([A-Z])/g, ' $1').trim();
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatRelativeDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(dateString);
  };

  const toggleFieldSelection = (field) => {
    setSelectedFields(prev => 
      prev.includes(field) 
        ? prev.filter(f => f !== field)
        : [...prev, field]
    );
  };

  const selectAllFields = () => {
    if (!selectedVersion || !versionChanges[selectedVersion.id]) return;
    setSelectedFields(versionChanges[selectedVersion.id].changedFields);
  };

  const deselectAllFields = () => {
    setSelectedFields([]);
  };

  const handleApprove = async () => {
    if (!selectedVersion) return;
    
    try {
      setApprovingVersion(selectedVersion.id);
      const approvedFields = selectedFields.length > 0 ? selectedFields : null;
      await api.approveVersion(
        selectedVersion.applicationId,
        selectedVersion.id,
        'approve',
        approvedFields,
        null,
        approvalNotes.trim() || null
      );
      toast.success('Version approved successfully');
      setShowApproveModal(false);
      setApprovalNotes('');
      setSelectedFields([]);
      setSelectedVersion(null);
      await loadPendingVersions();
    } catch (error) {
      toast.error(error.message || 'Failed to approve version');
    } finally {
      setApprovingVersion(null);
    }
  };

  const handleReject = async () => {
    if (!selectedVersion) return;
    
    try {
      setApprovingVersion(selectedVersion.id);
      await api.approveVersion(
        selectedVersion.applicationId,
        selectedVersion.id,
        'reject',
        null,
        rejectionReason.trim() || null
      );
      toast.success('Version rejected');
      setShowRejectModal(false);
      setRejectionReason('');
      setSelectedVersion(null);
      await loadPendingVersions();
    } catch (error) {
      toast.error(error.message || 'Failed to reject version');
    } finally {
      setApprovingVersion(null);
    }
  };

  const handleVersionClick = (version) => {
    if (selectedVersion?.id === version.id) {
      setSelectedVersion(null);
      setSelectedFields([]);
    } else {
      setSelectedVersion(version);
      setSelectedFields([]);
    }
  };

  if (loading) {
    return <LoadingPage message="Loading pending approvals..." />;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Pending Approvals</h1>
        <p className="text-gray-600">
          Review and approve or reject pending application version changes
        </p>
      </div>

      {pendingVersions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500 text-lg">No pending approvals</p>
            <p className="text-gray-400 text-sm mt-2">All version requests have been processed</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {pendingVersions.map((version) => {
            const changes = versionChanges[version.id];
            const changedFields = changes?.changedFields || [];
            const isExpanded = selectedVersion?.id === version.id;

            return (
              <Card key={version.id} className="border-gray-200">
                <CardContent className="p-4">
                  <div
                    onClick={() => handleVersionClick(version)}
                    className="cursor-pointer"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {version.application?.name || 'Unknown Application'}
                          </h3>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-yellow-100 text-yellow-800 font-semibold">
                            Pending Approval
                          </span>
                        </div>
                        <div className="text-sm text-gray-600 space-y-1">
                          <div>
                            Company: <span className="font-medium">{version.application?.company?.name || 'Unknown'}</span>
                          </div>
                          <div>
                            Requested by: <span className="font-medium">{version.user?.email || version.requesterEmail || 'Unknown'}</span>
                            {' • '}
                            <span>{formatRelativeDate(version.createdAt)}</span>
                          </div>
                          {version.changeSource && (
                            <div>
                              Source: <span className="font-medium">{version.changeSource.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <svg
                        className={`w-5 h-5 text-gray-500 transition-transform ${isExpanded ? 'transform rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>

                    {changedFields.length > 0 && (
                      <div className="mt-2 text-sm text-gray-600">
                        <span className="font-semibold">{changedFields.length}</span> field{changedFields.length !== 1 ? 's' : ''} requested:
                        <span className="ml-2 text-gray-500">
                          {changedFields.slice(0, 5).map(f => getFieldLabel(f)).join(', ')}
                          {changedFields.length > 5 && ` +${changedFields.length - 5} more`}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Expanded view with field details */}
                  {isExpanded && changes && (
                    <div className="mt-4 pt-4 border-t border-gray-200" onClick={(e) => e.stopPropagation()}>
                      {changedFields.length === 0 ? (
                        <p className="text-sm text-gray-500 italic">No changes detected</p>
                      ) : (
                        <>
                          <div className="mb-4">
                            <div className="flex items-center justify-between mb-2">
                              <div className="text-sm text-gray-600">
                                <button
                                  onClick={selectAllFields}
                                  className="text-blue-600 hover:text-blue-800 font-medium"
                                >
                                  Select All
                                </button>
                                {' • '}
                                <button
                                  onClick={deselectAllFields}
                                  className="text-blue-600 hover:text-blue-800 font-medium"
                                >
                                  Deselect All
                                </button>
                                {selectedFields.length > 0 && (
                                  <>
                                    <span className="text-gray-400">•</span>
                                    <span className="text-gray-700 font-medium ml-1">
                                      {selectedFields.length} selected
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="space-y-2 mb-4">
                            {changedFields.map((field) => {
                              const isSelected = selectedFields.includes(field);
                              const diff = changes.diff[field];
                              const currentValue = version[field];
                              const previousValue = diff?.from;

                              return (
                                <div
                                  key={field}
                                  onClick={() => toggleFieldSelection(field)}
                                  className={`p-3 rounded border cursor-pointer transition-all ${
                                    isSelected
                                      ? 'border-blue-500 bg-blue-50'
                                      : 'border-gray-200 bg-white hover:bg-gray-50'
                                  }`}
                                >
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="font-semibold text-gray-700 text-sm">
                                          {getFieldLabel(field)}
                                        </span>
                                        {isSelected && (
                                          <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                          </svg>
                                        )}
                                      </div>
                                      {changes.isInitialVersion ? (
                                        <div className="text-xs text-gray-600">
                                          {currentValue === null || currentValue === undefined ? (
                                            <span className="text-gray-400 italic">(empty)</span>
                                          ) : (
                                            String(currentValue)
                                          )}
                                        </div>
                                      ) : (
                                        <div className="text-xs text-gray-600 space-y-1">
                                          <div>
                                            <span className="font-medium">From:</span>{' '}
                                            <span className={previousValue === null || previousValue === undefined ? 'text-gray-400 italic' : ''}>
                                              {previousValue === null || previousValue === undefined ? '(empty)' : String(previousValue)}
                                            </span>
                                          </div>
                                          <div>
                                            <span className="font-medium">To:</span>{' '}
                                            <span className={currentValue === null || currentValue === undefined ? 'text-gray-400 italic' : ''}>
                                              {currentValue === null || currentValue === undefined ? '(empty)' : String(currentValue)}
                                            </span>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          <div className="flex gap-2 pt-2 border-t border-gray-200">
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => setShowApproveModal(true)}
                              disabled={approvingVersion === version.id}
                            >
                              {selectedFields.length === 0 ? 'Approve All' :
                               `Approve ${selectedFields.length} Field${selectedFields.length !== 1 ? 's' : ''}`}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setShowRejectModal(true)}
                              disabled={approvingVersion === version.id}
                              className="text-red-600 border-red-300 hover:bg-red-50 hover:border-red-400"
                            >
                              Reject
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/applications/${version.applicationId}`)}
                            >
                              View Application
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Approve Modal */}
      <Modal
        isOpen={showApproveModal}
        onClose={() => {
          setShowApproveModal(false);
          setApprovalNotes('');
        }}
        title="Approve Version"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            {selectedFields.length === 0
              ? 'Approve all requested changes?'
              : `Approve ${selectedFields.length} selected field${selectedFields.length !== 1 ? 's' : ''}?`}
          </p>
          <Textarea
            label="Approval Notes (optional)"
            value={approvalNotes}
            onChange={(e) => setApprovalNotes(e.target.value)}
            placeholder="Add any notes about this approval..."
            rows={3}
          />
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setShowApproveModal(false);
                setApprovalNotes('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleApprove}
              disabled={approvingVersion === selectedVersion?.id}
            >
              {approvingVersion === selectedVersion?.id ? 'Approving...' : 'Approve'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Reject Modal */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => {
          setShowRejectModal(false);
          setRejectionReason('');
        }}
        title="Reject Version"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Are you sure you want to reject this version? Please provide a reason.
          </p>
          <Textarea
            label="Rejection Reason (optional)"
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="Explain why this version is being rejected..."
            rows={3}
          />
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setShowRejectModal(false);
                setRejectionReason('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={handleReject}
              disabled={approvingVersion === selectedVersion?.id}
              className="text-red-600 border-red-300 hover:bg-red-50 hover:border-red-400"
            >
              {approvingVersion === selectedVersion?.id ? 'Rejecting...' : 'Reject'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

