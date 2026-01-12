import { useState, useEffect } from 'react';
import { api } from '../../lib/api.js';
import { toast } from '../ui/Toast.jsx';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card.jsx';
import { Button } from '../ui/Button.jsx';
import { LoadingPage } from '../ui/Loading.jsx';

export function VersionHistory({ applicationId }) {
  const [versions, setVersions] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [versionChanges, setVersionChanges] = useState({}); // Cache of changes for each version

  useEffect(() => {
    if (applicationId && expanded) {
      loadData();
    }
  }, [applicationId, expanded]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [versionsData, reviewsData] = await Promise.all([
        api.getApplicationVersions(applicationId),
        api.getApplicationReviews(applicationId),
      ]);
      const versionsList = Array.isArray(versionsData) ? versionsData : [];
      setVersions(versionsList);
      setReviews(Array.isArray(reviewsData) ? reviewsData : []);

      // Calculate changes for each version by comparing with the previous one
      const changes = {};
      
      // Process all comparisons in parallel for better performance
      const comparisonPromises = versionsList.map(async (currentVersion, i) => {
        const previousVersion = versionsList[i + 1]; // Next version (older) in the list

        if (previousVersion) {
          // Compare with previous version
          try {
            const comparisonData = await api.compareApplicationVersions(
              applicationId,
              currentVersion.versionNumber,
              previousVersion.versionNumber
            );
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
              'securityTestingDescription', 'additionalNotes', 'sastTool', 'sastIntegrationLevel',
              'dastTool', 'dastIntegrationLevel', 'appFirewallTool', 'appFirewallIntegrationLevel',
              'apiSecurityTool', 'apiSecurityIntegrationLevel', 'apiSecurityNA',
              'currentVersion', 'deploymentEnvironment', 'gitBranch',
              'lastDastScanDate', 'lastSastScanDate', 'interfaces',
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
              changedFields: allFields,
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
      dastTool: 'DAST Tool',
      dastIntegrationLevel: 'DAST Integration Level',
      appFirewallTool: 'App Firewall Tool',
      appFirewallIntegrationLevel: 'App Firewall Integration Level',
      apiSecurityTool: 'API Security Tool',
      apiSecurityIntegrationLevel: 'API Security Integration Level',
      apiSecurityNA: 'API Security N/A',
      currentVersion: 'Current Version',
      deploymentEnvironment: 'Deployment Environment',
      gitBranch: 'Git Branch',
      lastDastScanDate: 'Last DAST Scan Date',
      lastSastScanDate: 'Last SAST Scan Date',
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
  const versionCount = versions.length;
  const reviewCount = reviews.length;

  return (
    <Card className="border-gray-200">
      <CardContent>
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
        {!expanded && latestVersion && (
          <div className="text-sm text-gray-500 mb-2">
            {latestVersion.user && (
              <>Last updated by <span className="font-medium">{latestVersion.user.email}</span></>
            )}
            {latestVersion.createdAt && (
              <> • <span>{formatRelativeDate(latestVersion.createdAt)}</span></>
            )}
            {reviewCount > 0 && (
              <> • <span>{reviewCount} review{reviewCount !== 1 ? 's' : ''}</span></>
            )}
          </div>
        )}

        {expanded && (
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
                  <div className="space-y-2">
                    {versions.map((version, index) => (
                      <div
                        key={version.id}
                        className={`p-3 rounded border ${
                          selectedVersion?.id === version.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 bg-white hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-semibold text-gray-700">
                                Version {version.versionNumber}
                              </span>
                              {version.changeSource && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700">
                                  {getChangeSourceLabel(version.changeSource)}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 space-y-0.5">
                              {version.user && (
                                <div>
                                  Updated by <span className="font-medium">{version.user.email}</span>
                                </div>
                              )}
                              <div>{formatDate(version.createdAt)}</div>
                            </div>
                          </div>
                          <div className="flex gap-1 ml-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedVersion(
                                selectedVersion?.id === version.id ? null : version
                              )}
                              className="text-xs"
                            >
                              {selectedVersion?.id === version.id ? 'Hide' : 'View'}
                            </Button>
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
                                {versionChanges[version.id].changedFields.map((field) => {
                                  const diff = versionChanges[version.id].diff[field];
                                  const currentValue = version[field];
                                  
                                  return (
                                    <div key={field} className="p-2 bg-gray-50 rounded border border-gray-200 text-xs">
                                      <div className="font-semibold text-gray-700 mb-2">
                                        {getFieldLabel(field)}
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
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      )}
      </CardContent>
    </Card>
  );
}

