import { useState, useEffect } from 'react';
import { api } from '../../lib/api.js';
import { toast } from '../ui/Toast.jsx';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card.jsx';
import { Button } from '../ui/Button.jsx';
import { LoadingPage } from '../ui/Loading.jsx';
import { Checkbox } from '../ui/Checkbox.jsx';
import { Modal } from '../ui/Modal.jsx';
import { Textarea } from '../ui/Textarea.jsx';
import useAuthStore from '../../store/authStore.js';

const HIDDEN_VERSION_FIELDS = new Set(['apiSecurityTool', 'apiSecurityIntegrationLevel']);
const visibleVersionFields = (fields = []) => fields.filter((field) => !HIDDEN_VERSION_FIELDS.has(field));

export function VersionHistory({ applicationId, alwaysExpanded = false, onVersionProcessed }) {
  const [versions, setVersions] = useState([]);
  const [totalVersionCount, setTotalVersionCount] = useState(0);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(alwaysExpanded);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [versionChanges, setVersionChanges] = useState({}); // Cache of changes for each version
  const [approvingVersion, setApprovingVersion] = useState(null); // Version ID being approved
  const [selectedFields, setSelectedFields] = useState([]); // Fields selected for approval
  const [rejectionReason, setRejectionReason] = useState(''); // Reason for rejection
  const [approvalNotes, setApprovalNotes] = useState(''); // Notes for approval
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [versionPage, setVersionPage] = useState(1);
  const versionsPerPage = 5;
  const [latestVersionSummary, setLatestVersionSummary] = useState(null);

  useEffect(() => {
    if (applicationId) {
      if (expanded || alwaysExpanded) {
        loadData();
      } else {
        // Load just the latest version for collapsed view
        loadLatestVersion();
      }
    }
  }, [applicationId, expanded, alwaysExpanded]);

  const loadLatestVersion = async () => {
    try {
      setLoading(true);
      const versionsData = await api.getApplicationVersions(applicationId);
      const versionsList = Array.isArray(versionsData) ? versionsData : [];
      // Store total count for display
      setTotalVersionCount(versionsList.length);
      // Only keep the latest version for collapsed view
      const latestVersion = versionsList.length > 0 ? versionsList[0] : null;
      setVersions(latestVersion ? [latestVersion] : []);
      setReviews([]);
      setVersionChanges({});
      
      // Calculate summary for the latest version
      if (latestVersion) {
        try {
          let changedFields = [];
          let isInitialVersion = versionsList.length === 1;
          
          if (!isInitialVersion && versionsList.length > 1) {
            // Compare with previous version
            const previousVersion = versionsList[1];
            const comparisonData = await api.compareApplicationVersions(
              applicationId,
              previousVersion.versionNumber,
              latestVersion.versionNumber
            );
            changedFields = visibleVersionFields(comparisonData.comparison?.changedFields || []);
          } else if (isInitialVersion) {
            // For initial version, get all non-null fields
            const fieldsToCheck = [
              'name', 'description', 'owner', 'repoUrl', 'language', 'framework',
              'serverEnvironment', 'facing', 'deploymentType', 'authProfiles', 'dataTypes',
              'status', 'businessCriticality', 'criticalAspects', 'devTeamContact',
              'securityTestingDescription', 'additionalNotes', 'sastTool', 'sastIntegrationLevel', 'sastIncludesSca',
              'dastTool', 'dastIntegrationLevel', 'scaTool', 'scaIntegrationLevel', 'appFirewallTool', 'appFirewallIntegrationLevel',
              'apiSecurityNA',
              'appFirewallNA',
              'currentVersion', 'deploymentEnvironment', 'gitBranch',
              'lastDastScanDate', 'lastSastScanDate', 'lastScaScanDate', 'interfaces',
            ];
            changedFields = fieldsToCheck.filter(field => latestVersion[field] !== null && latestVersion[field] !== undefined);
          }
          
          // Format summary similar to expanded view
          let summaryText = '';
          const wentThroughWorkflow = latestVersion.approvalStatus !== 'pending' && latestVersion.approvedBy;
          
          if (isInitialVersion) {
            const fieldsDisplay = changedFields.slice(0, 3).map(f => getFieldLabel(f)).join(', ');
            const moreCount = changedFields.length > 3 ? changedFields.length - 3 : 0;
            summaryText = `${changedFields.length} field${changedFields.length !== 1 ? 's' : ''} set: ${fieldsDisplay}${moreCount > 0 ? ` +${moreCount} more` : ''}`;
          } else if (latestVersion.approvalStatus === 'approved' && wentThroughWorkflow) {
            const approvedFieldsList = latestVersion.approvedFields ? latestVersion.approvedFields.split(',').map(f => f.trim()) : null;
            const approvedCount = approvedFieldsList ? approvedFieldsList.length : changedFields.length;
            const approvedFieldsDisplay = approvedFieldsList 
              ? approvedFieldsList.slice(0, 3).map(f => getFieldLabel(f)).join(', ')
              : changedFields.slice(0, 3).map(f => getFieldLabel(f)).join(', ');
            const moreCount = approvedFieldsList 
              ? (approvedFieldsList.length > 3 ? approvedFieldsList.length - 3 : 0)
              : (changedFields.length > 3 ? changedFields.length - 3 : 0);
            
            summaryText = `${changedFields.length} field${changedFields.length !== 1 ? 's' : ''} requested, ${approvedCount === changedFields.length ? 'all' : approvedCount} approved: ${approvedFieldsDisplay}${moreCount > 0 ? ` +${moreCount} more` : ''}`;
          } else if (latestVersion.approvalStatus === 'rejected' && wentThroughWorkflow) {
            const fieldsDisplay = changedFields.slice(0, 3).map(f => getFieldLabel(f)).join(', ');
            const moreCount = changedFields.length > 3 ? changedFields.length - 3 : 0;
            summaryText = `${changedFields.length} field${changedFields.length !== 1 ? 's' : ''} requested, rejected: ${fieldsDisplay}${moreCount > 0 ? ` +${moreCount} more` : ''}`;
          } else {
            const fieldsDisplay = changedFields.slice(0, 3).map(f => getFieldLabel(f)).join(', ');
            const moreCount = changedFields.length > 3 ? changedFields.length - 3 : 0;
            summaryText = `${changedFields.length} field${changedFields.length !== 1 ? 's' : ''} changed: ${fieldsDisplay}${moreCount > 0 ? ` +${moreCount} more` : ''}`;
          }
          
          setLatestVersionSummary({
            text: summaryText,
            requester: latestVersion.user?.email || latestVersion.requesterEmail,
            approver: latestVersion.approver?.email,
          });
        } catch (error) {
          console.error('Failed to calculate latest version summary:', error);
          setLatestVersionSummary(null);
        }
      } else {
        setLatestVersionSummary(null);
      }
    } catch (error) {
      console.error('Failed to load latest version:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [versionsData, reviewsData] = await Promise.all([
        api.getApplicationVersions(applicationId),
        api.getApplicationReviews(applicationId),
      ]);
      const versionsList = Array.isArray(versionsData) ? versionsData : [];
      setVersions(versionsList);
      setTotalVersionCount(versionsList.length);
      setReviews(Array.isArray(reviewsData) ? reviewsData : []);
      
      // Reset selected fields and pagination when loading new data
      setSelectedFields([]);
      setVersionPage(1);

      // Calculate changes for each version by comparing with the previous one
      const changes = {};
      
      // Process all comparisons in parallel for better performance
      const comparisonPromises = versionsList.map(async (currentVersion, i) => {
        const previousVersion = versionsList[i + 1]; // Next version (older) in the list

        if (previousVersion) {
          // Compare with previous version
          // Note: compareVersions(version1, version2) returns { from: version1, to: version2 }
          // We want { from: previousVersion (older), to: currentVersion (newer) }
          // So we pass previousVersion first, then currentVersion
          try {
            const comparisonData = await api.compareApplicationVersions(
              applicationId,
              previousVersion.versionNumber,
              currentVersion.versionNumber
            );
            comparisonData.comparison.changedFields = visibleVersionFields(comparisonData.comparison.changedFields);
            return { id: currentVersion.id, comparison: comparisonData.comparison };
          } catch (error) {
            console.error(`Failed to compare version ${currentVersion.versionNumber}:`, error);
            // If comparison fails, calculate changes manually
            const changedFields = [];
            const diff = {};
            const fieldsToCompare = [
              'name', 'description', 'owner', 'repoUrl', 'language', 'framework',
              'serverEnvironment', 'facing', 'deploymentType', 'authProfiles', 'dataTypes',
              'status', 'businessCriticality', 'criticalAspects', 'devTeamContact',
              'securityTestingDescription', 'additionalNotes', 'sastTool', 'sastIntegrationLevel', 'sastIncludesSca',
              'dastTool', 'dastIntegrationLevel', 'scaTool', 'scaIntegrationLevel', 'appFirewallTool', 'appFirewallIntegrationLevel',
              'apiSecurityNA',
              'appFirewallNA',
              'currentVersion', 'deploymentEnvironment', 'gitBranch',
              'lastDastScanDate', 'lastSastScanDate', 'lastScaScanDate', 'interfaces',
            ];
            
            for (const field of fieldsToCompare) {
              const val1 = previousVersion[field];
              const val2 = currentVersion[field];
              const val1Norm = val1 === null || val1 === undefined ? null : String(val1);
              const val2Norm = val2 === null || val2 === undefined ? null : String(val2);
              
              if (val1Norm !== val2Norm) {
                changedFields.push(field);
                diff[field] = { from: val1, to: val2 };
              }
            }
            
            return { id: currentVersion.id, comparison: { changedFields, diff } };
          }
        } else {
          // First version - mark as initial version (no comparison needed)
          const allFields = Object.keys(currentVersion).filter(
            key => !['id', 'applicationId', 'versionNumber', 'createdBy', 'createdAt', 'changeSource', 'user'].includes(key) &&
            currentVersion[key] !== null && currentVersion[key] !== undefined
          );
          return {
            id: currentVersion.id,
            comparison: {
              changedFields: visibleVersionFields(allFields),
              diff: allFields.reduce((acc, field) => {
                acc[field] = { from: null, to: currentVersion[field] };
                return acc;
              }, {}),
              isInitialVersion: true, // Flag to indicate this is the first version
            },
          };
        }
      });

      const comparisonResults = await Promise.all(comparisonPromises);
      comparisonResults.forEach(({ id, comparison }) => {
        changes[id] = comparison;
      });
      
      setVersionChanges(changes);
    } catch (error) {
      console.error('Failed to load version history:', error);
      toast.error('Failed to load version history');
    } finally {
      setLoading(false);
    }
  };


  const getChangeSourceLabel = (source) => {
    const labels = {
      web_form: 'Web Form',
      technical_form: 'Technical Form',
      executive_form: 'Executive Form',
      bulk_import: 'Bulk Import',
      api: 'API',
      deployment_token: 'Deployment Token',
    };
    return labels[source] || source || 'Unknown';
  };

  const { isAdmin } = useAuthStore();

  const handleApproveVersion = async (versionId, approvedFields, notes = '') => {
    try {
      setApprovingVersion(versionId);
      await api.approveVersion(applicationId, versionId, 'approve', approvedFields, notes);
      toast.success('Version approved successfully');
      await loadData(); // Reload to get updated status
      setSelectedVersion(null);
      setSelectedFields([]);
      setApprovalNotes('');
      setShowApproveModal(false);
      if (onVersionProcessed) {
        onVersionProcessed();
      }
    } catch (error) {
      toast.error(error.message || 'Failed to approve version');
    } finally {
      setApprovingVersion(null);
    }
  };

  const handleRejectVersion = async (versionId, reason) => {
    try {
      setApprovingVersion(versionId);
      await api.approveVersion(applicationId, versionId, 'reject', null, reason);
      toast.success('Version rejected');
      await loadData(); // Reload to get updated status
      setSelectedVersion(null);
      setRejectionReason('');
      setShowRejectModal(false);
      if (onVersionProcessed) {
        onVersionProcessed();
      }
    } catch (error) {
      toast.error(error.message || 'Failed to reject version');
    } finally {
      setApprovingVersion(null);
    }
  };

  const toggleFieldSelection = (field) => {
    setSelectedFields(prev => 
      prev.includes(field) 
        ? prev.filter(f => f !== field)
        : [...prev, field]
    );
  };

  const selectAllFields = (changedFields) => {
    setSelectedFields([...changedFields]);
  };

  const deselectAllFields = () => {
    setSelectedFields([]);
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

    if (diffMins < 1) {
      return 'Just now';
    } else if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return formatDate(dateString);
    }
  };

  const latestVersion = versions[0];
  const versionCount = expanded ? versions.length : totalVersionCount;
  const reviewCount = reviews.length;

  // Calculate pagination
  const totalPages = Math.ceil(versions.length / versionsPerPage);
  const startIndex = (versionPage - 1) * versionsPerPage;
  const endIndex = startIndex + versionsPerPage;
  const paginatedVersions = versions.slice(startIndex, endIndex);

  return (
    <Card className="border-gray-200">
      <CardContent>
        {!alwaysExpanded && (
          <div className="flex items-center justify-between mb-4">
            <div
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-2 text-left flex-1 cursor-pointer"
            >
              <h3 className="text-lg font-semibold text-gray-900">Version History</h3>
              {!expanded && latestVersion && (
                <span className="text-sm text-gray-500">
                  ({versionCount} version{versionCount !== 1 ? 's' : ''})
                </span>
              )}
              <svg
                className={`w-5 h-5 text-gray-500 transition-transform ${expanded ? 'transform rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        )}
        {!alwaysExpanded && !expanded && latestVersion && (
          <div className="text-sm text-gray-500 mb-2 space-y-1">
            {latestVersionSummary && (
              <div>
                {latestVersionSummary.text}
                {latestVersionSummary.requester && (
                  <> • requested by: <span className="font-medium">{latestVersionSummary.requester}</span></>
                )}
                {latestVersionSummary.approver && (
                  <> • approved by: <span className="font-medium">{latestVersionSummary.approver}</span></>
                )}
              </div>
            )}
            <div>
              {latestVersion.createdAt && (
                <span>{formatRelativeDate(latestVersion.createdAt)}</span>
              )}
              {reviewCount > 0 && (
                <> • <span>{reviewCount} review{reviewCount !== 1 ? 's' : ''}</span></>
              )}
            </div>
          </div>
        )}

        {(expanded || alwaysExpanded) && (
          <div className="mt-4">
          {loading ? (
            <LoadingPage message="Loading version history..." />
          ) : (
            <div className="space-y-4">
              {/* Reviews Section */}
              {reviewCount > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">
                    Metadata Reviews ({reviewCount})
                  </h4>
                  <div className="space-y-2">
                    {reviews.map((review) => (
                      <div
                        key={review.id}
                        className="flex items-center justify-between p-2 bg-gray-50 rounded text-xs"
                      >
                        <div>
                          <span className="font-medium text-gray-700">
                            {review.user?.email || 'Unknown'}
                          </span>
                          <span className="text-gray-500 ml-2">
                            {formatRelativeDate(review.reviewedAt)}
                          </span>
                        </div>
                        <span className="text-gray-400">
                          {formatDate(review.reviewedAt)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Versions Section */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">
                  Versions ({versionCount})
                </h4>
                {versionCount === 0 ? (
                  <p className="text-sm text-gray-500 py-4 text-center">
                    No version history available
                  </p>
                ) : (
                  <>
                    <div className="space-y-2">
                      {paginatedVersions.map((version, index) => {
                        // Find the actual index in the full versions array for comparison
                        const actualIndex = versions.findIndex(v => v.id === version.id);
                        return (
                      <div
                        key={version.id}
                        onClick={() => setSelectedVersion(
                          selectedVersion?.id === version.id ? null : version
                        )}
                        className={`p-3 rounded border cursor-pointer transition-all ${
                          selectedVersion?.id === version.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 bg-surface hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="text-xs font-semibold text-gray-700">
                                Version {version.versionNumber}
                              </span>
                              {version.approvalStatus === 'pending' && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-yellow-100 text-yellow-800 font-semibold">
                                  Pending Approval
                                </span>
                              )}
                              {version.approvalStatus === 'approved' && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-green-100 text-green-800 font-semibold">
                                  Approved
                                </span>
                              )}
                              {version.approvalStatus === 'rejected' && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-red-100 text-red-800 font-semibold">
                                  Rejected
                                </span>
                              )}
                              {version.changeSource && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700">
                                  {getChangeSourceLabel(version.changeSource)}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 space-y-0.5">
                              {(version.user || version.requesterEmail) && (
                                <div>
                                  Updated by <span className="font-medium">{version.user?.email || version.requesterEmail}</span>
                                </div>
                              )}
                              <div>{formatDate(version.createdAt)}</div>
                            </div>
                          </div>
                        </div>

                        {/* Show changed fields summary */}
                        {versionChanges[version.id] && versionChanges[version.id].changedFields.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-gray-200">
                            <div className="text-xs text-gray-600 mb-2">
                              {versionChanges[version.id].isInitialVersion ? (
                                <>
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-800 font-semibold mr-2">
                                    Initial Version
                                  </span>
                                  <span className="font-semibold">{versionChanges[version.id].changedFields.length}</span> field{versionChanges[version.id].changedFields.length !== 1 ? 's' : ''} set:
                                  <span className="ml-2 text-gray-500">
                                    {versionChanges[version.id].changedFields.slice(0, 5).map(f => getFieldLabel(f)).join(', ')}
                                    {versionChanges[version.id].changedFields.length > 5 && ` +${versionChanges[version.id].changedFields.length - 5} more`}
                                  </span>
                                </>
                              ) : version.approvalStatus === 'approved' && version.approvedBy && version.approvedFields ? (
                                <>
                                  <span className="font-semibold">{versionChanges[version.id].changedFields.length}</span> field{versionChanges[version.id].changedFields.length !== 1 ? 's' : ''} requested,
                                  {' '}
                                  <span className="font-semibold text-green-700">
                                    {version.approvedFields.split(',').length}
                                  </span>
                                  {' '}approved:
                                  <span className="ml-2 text-gray-500">
                                    {version.approvedFields.split(',').slice(0, 5).map(f => getFieldLabel(f.trim())).join(', ')}
                                    {version.approvedFields.split(',').length > 5 && ` +${version.approvedFields.split(',').length - 5} more`}
                                  </span>
                                </>
                              ) : version.approvalStatus === 'approved' && version.approvedBy ? (
                                <>
                                  <span className="font-semibold">{versionChanges[version.id].changedFields.length}</span> field{versionChanges[version.id].changedFields.length !== 1 ? 's' : ''} requested,
                                  {' '}
                                  <span className="font-semibold text-green-700">
                                    all
                                  </span>
                                  {' '}approved:
                                  <span className="ml-2 text-gray-500">
                                    {versionChanges[version.id].changedFields.slice(0, 5).map(f => getFieldLabel(f)).join(', ')}
                                    {versionChanges[version.id].changedFields.length > 5 && ` +${versionChanges[version.id].changedFields.length - 5} more`}
                                  </span>
                                </>
                              ) : version.approvalStatus === 'rejected' && version.approvedBy ? (
                                <>
                                  <span className="font-semibold">{versionChanges[version.id].changedFields.length}</span> field{versionChanges[version.id].changedFields.length !== 1 ? 's' : ''} requested,
                                  {' '}
                                  <span className="font-semibold text-red-700">
                                    rejected
                                  </span>
                                  :
                                  <span className="ml-2 text-gray-500">
                                    {versionChanges[version.id].changedFields.slice(0, 5).map(f => getFieldLabel(f)).join(', ')}
                                    {versionChanges[version.id].changedFields.length > 5 && ` +${versionChanges[version.id].changedFields.length - 5} more`}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <span className="font-semibold">{versionChanges[version.id].changedFields.length}</span> field{versionChanges[version.id].changedFields.length !== 1 ? 's' : ''} changed:
                                  <span className="ml-2 text-gray-500">
                                    {versionChanges[version.id].changedFields.slice(0, 5).map(f => getFieldLabel(f)).join(', ')}
                                    {versionChanges[version.id].changedFields.length > 5 && ` +${versionChanges[version.id].changedFields.length - 5} more`}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Expanded version details - show only changed fields */}
                        {selectedVersion?.id === version.id && versionChanges[version.id] && (
                          <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
                            {versionChanges[version.id].changedFields.length === 0 ? (
                              <p className="text-xs text-gray-500 italic">No changes detected</p>
                            ) : versionChanges[version.id].isInitialVersion ? (
                              // Initial version - show values without before/after
                              <div className="space-y-3">
                                <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded">
                                  <p className="text-xs text-blue-800 font-medium">
                                    This is the initial version. The following fields were set when the application was created:
                                  </p>
                                </div>
                                {versionChanges[version.id].changedFields.map((field) => {
                                  const currentValue = version[field];
                                  
                                  return (
                                    <div key={field} className="p-2 bg-gray-50 rounded border border-gray-200 text-xs">
                                      <div className="font-semibold text-gray-700 mb-1.5">
                                        {getFieldLabel(field)}
                                      </div>
                                      <div className="text-gray-700">
                                        {currentValue === null || currentValue === undefined ? (
                                          <span className="text-gray-400 italic">(empty)</span>
                                        ) : field === 'interfaces' ? (
                                          <span>{JSON.parse(currentValue || '[]').length} interface(s)</span>
                                        ) : field === 'repoUrl' ? (
                                          <a
                                            href={currentValue}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 hover:underline"
                                          >
                                            {currentValue}
                                          </a>
                                        ) : field === 'description' || field === 'securityTestingDescription' || field === 'additionalNotes' ? (
                                          <p className="whitespace-pre-wrap mt-1">{currentValue}</p>
                                        ) : (
                                          String(currentValue)
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              // Regular version - show before/after diff
                              <div className="space-y-3">
                                {[...versionChanges[version.id].changedFields].sort((fieldA, fieldB) => {
                                  // Sort approved fields above rejected fields
                                  const wentThroughWorkflow = version.approvedBy;
                                  const approvedFieldsList = version.approvedFields 
                                    ? version.approvedFields.split(',').map(f => f.trim())
                                    : null;
                                  
                                  const isApprovedA = version.approvalStatus === 'approved' && wentThroughWorkflow && (
                                    approvedFieldsList 
                                      ? approvedFieldsList.includes(fieldA)
                                      : true
                                  );
                                  const isRejectedA = wentThroughWorkflow && (
                                    version.approvalStatus === 'rejected' ||
                                    (version.approvalStatus === 'approved' && approvedFieldsList && !approvedFieldsList.includes(fieldA))
                                  );
                                  
                                  const isApprovedB = version.approvalStatus === 'approved' && wentThroughWorkflow && (
                                    approvedFieldsList 
                                      ? approvedFieldsList.includes(fieldB)
                                      : true
                                  );
                                  const isRejectedB = wentThroughWorkflow && (
                                    version.approvalStatus === 'rejected' ||
                                    (version.approvalStatus === 'approved' && approvedFieldsList && !approvedFieldsList.includes(fieldB))
                                  );
                                  
                                  // Approved first, then rejected, then others
                                  if (isApprovedA && !isApprovedB) return -1;
                                  if (!isApprovedA && isApprovedB) return 1;
                                  if (isRejectedA && !isRejectedB && !isApprovedB) return 1;
                                  if (!isRejectedA && isRejectedB && !isApprovedA) return -1;
                                  return 0;
                                }).map((field) => {
                                  const diff = versionChanges[version.id].diff[field];
                                  const currentValue = version[field];
                                  const isPending = version.approvalStatus === 'pending';
                                  const isSelected = selectedFields.includes(field);
                                  const isClickable = isPending && isAdmin();
                                  
                                  // Check if this field was approved or rejected (only show badge if it went through approval workflow)
                                  const wentThroughWorkflow = version.approvedBy;
                                  const approvedFieldsList = version.approvedFields 
                                    ? version.approvedFields.split(',').map(f => f.trim())
                                    : null;
                                  
                                  const isApproved = version.approvalStatus === 'approved' && wentThroughWorkflow && (
                                    approvedFieldsList 
                                      ? approvedFieldsList.includes(field)
                                      : true // All fields approved
                                  );
                                  const isRejected = wentThroughWorkflow && (
                                    version.approvalStatus === 'rejected' || // Entire version rejected
                                    (version.approvalStatus === 'approved' && approvedFieldsList && !approvedFieldsList.includes(field)) // Field not in approved list
                                  );
                                  
                                  return (
                                    <div
                                      key={field}
                                      onClick={isClickable ? (e) => {
                                        e.stopPropagation();
                                        toggleFieldSelection(field);
                                      } : undefined}
                                      className={`p-2 rounded border text-xs transition-all ${
                                        isPending && isAdmin()
                                          ? isSelected
                                            ? 'bg-blue-50 border-blue-300 cursor-pointer ring-2 ring-blue-200'
                                            : 'bg-gray-50 border-gray-200 cursor-pointer hover:bg-gray-100 hover:border-gray-300'
                                          : 'bg-gray-50 border-gray-200'
                                      }`}
                                    >
                                      <div className="flex items-center gap-2 mb-2">
                                        <div className="font-semibold text-gray-700 flex-1">
                                          {getFieldLabel(field)}
                                        </div>
                                        {isApproved ? (
                                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-green-100 text-green-800 font-semibold">
                                            Approved
                                          </span>
                                        ) : isRejected ? (
                                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-red-100 text-red-800 font-semibold">
                                            Rejected
                                          </span>
                                        ) : null}
                                        {isPending && isAdmin() && (
                                          <div className="flex items-center gap-1">
                                            {isSelected && (
                                              <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                              </svg>
                                            )}
                                            <Checkbox
                                              checked={isSelected}
                                              onChange={() => toggleFieldSelection(field)}
                                              onClick={(e) => e.stopPropagation()}
                                            />
                                          </div>
                                        )}
                                      </div>
                                      {diff && (diff.from !== null && diff.from !== undefined || diff.to !== null && diff.to !== undefined) ? (
                                        <div className="grid grid-cols-2 gap-2">
                                          <div>
                                            <div className="text-gray-500 text-xs mb-1">Previous:</div>
                                            <div className="text-gray-700 bg-red-50 p-1.5 rounded text-xs break-words">
                                              {diff.from === null || diff.from === undefined ? (
                                                <span className="text-gray-400 italic">(empty)</span>
                                              ) : field === 'interfaces' ? (
                                                <span>{JSON.parse(diff.from || '[]').length} interface(s)</span>
                                              ) : (
                                                String(diff.from)
                                              )}
                                            </div>
                                          </div>
                                          <div>
                                            <div className="text-gray-500 text-xs mb-1">Current:</div>
                                            <div className="text-gray-700 bg-green-50 p-1.5 rounded text-xs break-words">
                                              {diff.to === null || diff.to === undefined ? (
                                                <span className="text-gray-400 italic">(empty)</span>
                                              ) : field === 'interfaces' ? (
                                                <span>{JSON.parse(diff.to || '[]').length} interface(s)</span>
                                              ) : field === 'repoUrl' ? (
                                                <a
                                                  href={diff.to}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="text-blue-600 hover:underline"
                                                  onClick={(e) => e.stopPropagation()}
                                                >
                                                  {diff.to}
                                                </a>
                                              ) : (
                                                String(diff.to)
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="text-gray-700">
                                          {currentValue === null || currentValue === undefined ? (
                                            <span className="text-gray-400 italic">(empty)</span>
                                          ) : field === 'interfaces' ? (
                                            <span>{JSON.parse(currentValue || '[]').length} interface(s)</span>
                                          ) : field === 'repoUrl' ? (
                                            <a
                                              href={currentValue}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-blue-600 hover:underline"
                                              onClick={(e) => e.stopPropagation()}
                                            >
                                              {currentValue}
                                            </a>
                                          ) : field === 'description' || field === 'securityTestingDescription' || field === 'additionalNotes' ? (
                                            <p className="whitespace-pre-wrap">{currentValue}</p>
                                          ) : (
                                            String(currentValue)
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Approval actions for pending versions (Admin only) */}
                            {version.approvalStatus === 'pending' && isAdmin() && selectedVersion?.id === version.id && (
                              <div className="mt-4 pt-4 border-t border-gray-200">
                                  <div className="flex items-center justify-between gap-3" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex items-center gap-2 text-sm text-gray-600">
                                      <button
                                        type="button"
                                        onClick={() => selectAllFields(versionChanges[version.id].changedFields)}
                                        className="text-blue-600 hover:text-blue-700 font-medium underline"
                                      >
                                        Select All
                                      </button>
                                      <span className="text-gray-400">•</span>
                                      <button
                                        type="button"
                                        onClick={deselectAllFields}
                                        className="text-blue-600 hover:text-blue-700 font-medium underline"
                                      >
                                        Deselect All
                                      </button>
                                      {selectedFields.length > 0 && (
                                        <>
                                          <span className="text-gray-400">•</span>
                                          <span className="text-gray-700 font-medium">
                                            {selectedFields.length} selected
                                          </span>
                                        </>
                                      )}
                                    </div>
                                    <div className="flex gap-2">
                                      <Button
                                        variant="primary"
                                        size="sm"
                                        onClick={() => {
                                          setShowApproveModal(true);
                                        }}
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
                                    </div>
                                  </div>
                              </div>
                            )}

                            {/* Show approval/rejection info for processed versions */}
                            {version.approvalStatus !== 'pending' && version.approvedBy && (
                              <div className="mt-3 pt-3 border-t border-gray-200">
                                <div className="text-xs text-gray-600">
                                  {(version.user || version.requesterEmail) && (
                                    <div className="mb-1">
                                      Requested by <span className="font-medium">{version.user?.email || version.requesterEmail}</span>
                                      {version.createdAt && (
                                        <> on <span>{formatDate(version.createdAt)}</span></>
                                      )}
                                    </div>
                                  )}
                                  {version.approvalStatus === 'approved' ? (
                                    <>
                                      <span className="font-medium text-green-700">Approved</span>
                                      {version.approver && (
                                        <> by <span className="font-medium">{version.approver.email}</span></>
                                      )}
                                      {version.approvedAt && (
                                        <> on <span>{formatDate(version.approvedAt)}</span></>
                                      )}
                                      {version.approvalNotes && (
                                        <div className="mt-1 text-gray-700 italic">
                                          Note: {version.approvalNotes}
                                        </div>
                                      )}
                                    </>
                                  ) : (
                                    <>
                                      <span className="font-medium text-red-700">Rejected</span>
                                      {version.approver && (
                                        <> by <span className="font-medium">{version.approver.email}</span></>
                                      )}
                                      {version.approvedAt && (
                                        <> on <span>{formatDate(version.approvedAt)}</span></>
                                      )}
                                      {version.rejectionReason && (
                                        <div className="mt-1 text-red-600 italic">
                                          Reason: {version.rejectionReason}
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      );
                    })}
                    </div>
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                        <div className="text-sm text-gray-600">
                          Showing {startIndex + 1}-{Math.min(endIndex, versions.length)} of {versions.length} versions
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setVersionPage(prev => Math.max(1, prev - 1))}
                            disabled={versionPage === 1}
                          >
                            Previous
                          </Button>
                          <span className="text-sm text-gray-600">
                            Page {versionPage} of {totalPages}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setVersionPage(prev => Math.min(totalPages, prev + 1))}
                            disabled={versionPage === totalPages}
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Approve Modal */}
              <Modal
                isOpen={showApproveModal}
                onClose={() => {
                  setShowApproveModal(false);
                  setApprovalNotes('');
                }}
                title="Approve Version"
                size="md"
              >
                <div className="space-y-4">
                  {selectedVersion && versionChanges[selectedVersion.id] && (
                    <>
                      <div>
                        <p className="text-sm text-gray-700 mb-2">
                          {selectedFields.length === 0 
                            ? 'All fields will be approved:'
                            : `The following ${selectedFields.length} field${selectedFields.length !== 1 ? 's' : ''} will be approved:`}
                        </p>
                        <div className="bg-gray-50 rounded border border-gray-200 p-2 max-h-32 overflow-y-auto">
                          <ul className="text-sm text-gray-700 space-y-1">
                            {(selectedFields.length === 0 
                              ? versionChanges[selectedVersion.id].changedFields 
                              : selectedFields
                            ).map((field) => (
                              <li key={field} className="flex items-center gap-2">
                                <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                                {getFieldLabel(field)}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                      <Textarea
                        label="Approval Notes (optional)"
                        value={approvalNotes}
                        onChange={(e) => setApprovalNotes(e.target.value)}
                        rows={3}
                        placeholder="e.g., Changes look good, verified with team..."
                      />
                    </>
                  )}
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
                      onClick={() => {
                        if (selectedVersion) {
                          const fieldsToApprove = selectedFields.length > 0 
                            ? selectedFields 
                            : null; // null = approve all
                          handleApproveVersion(selectedVersion.id, fieldsToApprove, approvalNotes);
                        }
                      }}
                      disabled={approvingVersion === selectedVersion?.id}
                    >
                      {approvingVersion === selectedVersion?.id ? 'Approving...' : 'Approve Version'}
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
                size="md"
              >
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    Please provide a reason for rejecting this version (optional):
                  </p>
                  <Textarea
                    label="Rejection Reason"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    rows={3}
                    placeholder="e.g., Incorrect information, needs clarification..."
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
                      onClick={() => {
                        if (selectedVersion) {
                          handleRejectVersion(selectedVersion.id, rejectionReason);
                        }
                      }}
                      disabled={approvingVersion === selectedVersion?.id}
                      className="text-red-600 border-red-300 hover:bg-red-50"
                    >
                      Reject Version
                    </Button>
                  </div>
                </div>
              </Modal>

            </div>
          )}
        </div>
      )}
      </CardContent>
    </Card>
  );
}
