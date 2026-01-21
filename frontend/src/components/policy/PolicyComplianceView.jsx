import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card.jsx';
import { LoadingPage } from '../ui/Loading.jsx';
import { Button } from '../ui/Button.jsx';
import { api } from '../../lib/api.js';

export function PolicyComplianceView({ applicationId, compliance, loading, onLoad, onRefresh }) {
  const [availableFields, setAvailableFields] = useState([]);
  const [loadingFields, setLoadingFields] = useState(false);
  const [expandedPolicies, setExpandedPolicies] = useState(new Set());

  useEffect(() => {
    // Load compliance data when component mounts (tab becomes active)
    if (!compliance && !loading) {
      onLoad();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId]); // Only depend on applicationId to reload if it changes

  useEffect(() => {
    // Load available fields for label mapping
    const loadFields = async () => {
      try {
        setLoadingFields(true);
        const data = await api.getAvailableFields();
        setAvailableFields(data);
      } catch (error) {
        console.error('Failed to load available fields:', error);
      } finally {
        setLoadingFields(false);
      }
    };
    loadFields();
  }, []);

  const togglePolicy = (policyId) => {
    const newExpanded = new Set(expandedPolicies);
    if (newExpanded.has(policyId)) {
      newExpanded.delete(policyId);
    } else {
      newExpanded.add(policyId);
    }
    setExpandedPolicies(newExpanded);
  };

  const getFieldLabel = (fieldPath) => {
    const field = availableFields.find(f => f.path === fieldPath);
    return field ? field.label : fieldPath.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim();
  };

  if (loading) {
    return <LoadingPage />;
  }

  if (!compliance) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-gray-500">
          No policy compliance data available
        </CardContent>
      </Card>
    );
  }

  const { policies, summary } = compliance;
  
  // Flatten all controls from all policies for display
  const allControls = policies ? policies.flatMap(policy => 
    policy.controls.map(control => ({
      ...control,
      policyName: policy.policy.name,
      policyScope: policy.policy.scope,
    }))
  ) : [];

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Compliance Summary</CardTitle>
            {onRefresh && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRefresh}
                disabled={loading}
              >
                {loading ? 'Refreshing...' : 'Refresh'}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-800">{summary?.total || 0}</div>
              <div className="text-sm text-gray-600 mt-1">Total Controls</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-700">{summary?.meeting || 0}</div>
              <div className="text-sm text-green-600 mt-1">Meeting Requirements</div>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-700">{summary?.not_meeting || 0}</div>
              <div className="text-sm text-red-600 mt-1">Not Meeting</div>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-700">{summary?.compliance_percentage || 0}%</div>
              <div className="text-sm text-blue-600 mt-1">Compliance Rate</div>
            </div>
          </div>
          {summary?.total_policies && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="text-sm text-gray-600">
                <span className="font-medium">{summary.total_policies}</span> polic{summary.total_policies !== 1 ? 'ies' : 'y'} applicable
                {' • '}
                <span className="font-medium">{summary.compliant_policies}</span> fully compliant
                {summary.all_policies_compliant && (
                  <span className="ml-2 text-green-600 font-medium">✓ All policies met</span>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Policies List */}
      {policies && policies.length > 0 && (
        <div className="space-y-6">
          {policies.map((policyEntry) => {
            const isExpanded = expandedPolicies.has(policyEntry.policy.id);
            return (
              <Card key={policyEntry.policy.id} className="border-l-4 border-l-blue-500">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <button
                        onClick={() => togglePolicy(policyEntry.policy.id)}
                        className="flex items-center gap-2 text-left hover:opacity-80 transition-opacity"
                      >
                        <span className="text-xl">
                          {isExpanded ? '▼' : '▶'}
                        </span>
                        <div>
                          <CardTitle className="text-lg">{policyEntry.policy.name}</CardTitle>
                          <div className="text-sm text-gray-500 mt-1">
                            {policyEntry.reason || `Scope: ${policyEntry.policy.scope}`}
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            {policyEntry.summary.meeting} of {policyEntry.summary.total} controls meeting ({policyEntry.summary.compliance_percentage}%)
                          </div>
                        </div>
                      </button>
                    </div>
                    <span className={`px-3 py-1 text-sm font-semibold rounded ${
                      policyEntry.summary.compliance_percentage === 100
                        ? 'bg-green-100 text-green-800'
                        : policyEntry.summary.compliance_percentage === 0
                        ? 'bg-red-100 text-red-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {policyEntry.summary.compliance_percentage === 100 
                        ? 'Compliant' 
                        : policyEntry.summary.compliance_percentage === 0
                        ? 'Not Compliant'
                        : 'Partial'}
                    </span>
                  </div>
                </CardHeader>
                {isExpanded && (
                  <CardContent>
                <div className="space-y-3">
                  {policyEntry.controls.length === 0 ? (
                    <p className="text-sm text-gray-500">No controls in this policy</p>
                  ) : (
                    policyEntry.controls.map((controlResult) => {
                      const { control, status, evidence, details } = controlResult;
                      const isMeeting = status === 'meeting';

                      return (
                        <Card key={control.id} className={`bg-gray-50 ${isMeeting ? 'border-green-200' : 'border-red-200'}`}>
                          <CardHeader>
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3">
                                  <CardTitle className="text-base">{control.name}</CardTitle>
                                  <span
                                    className={`px-2 py-1 text-xs font-semibold rounded ${
                                      isMeeting
                                        ? 'bg-green-100 text-green-800'
                                        : 'bg-red-100 text-red-800'
                                    }`}
                                  >
                                    {isMeeting ? 'Meeting' : 'Not Meeting'}
                                  </span>
                                </div>
                                {control.controlId && (
                                  <div className="text-sm text-gray-500 mt-1">Control ID: {control.controlId}</div>
                                )}
                                {control.category && (
                                  <div className="text-sm text-gray-500">{control.category}</div>
                                )}
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3">
                              {control.description && (
                                <p className="text-gray-700 text-sm">{control.description}</p>
                              )}

                              {/* Combined Field Evaluations */}
                              {details?.fieldResults && details.fieldResults.length > 0 && (
                                <div className="space-y-2">
                                  {details.fieldResults.map((fieldResult, index) => {
                                    const fieldPassed = fieldResult.result === true;
                                    return (
                                      <div
                                        key={index}
                                        className={`p-3 rounded-lg border ${
                                          fieldPassed
                                            ? 'bg-green-50 border-green-200'
                                            : 'bg-red-50 border-red-200'
                                        }`}
                                      >
                                        <div className="flex items-start gap-3">
                                          <span className={`text-lg flex-shrink-0 ${fieldPassed ? 'text-green-600' : 'text-red-600'}`}>
                                            {fieldPassed ? '✓' : '✗'}
                                          </span>
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                              <span className="text-sm font-medium text-gray-800">
                                                {getFieldLabel(fieldResult.fieldPath)}
                                              </span>
                                              <span
                                                className={`px-2 py-0.5 text-xs font-semibold rounded ${
                                                  fieldPassed
                                                    ? 'bg-green-100 text-green-800'
                                                    : 'bg-red-100 text-red-800'
                                                }`}
                                              >
                                                {fieldPassed ? 'Pass' : 'Fail'}
                                              </span>
                                            </div>
                                            <div className="text-xs text-gray-600 mt-1 space-y-0.5">
                                              {fieldResult.fieldValue !== null && fieldResult.fieldValue !== undefined && (
                                                <div>
                                                  <span className="font-medium">Current value:</span> {String(fieldResult.fieldValue)}
                                                </div>
                                              )}
                                              <div>
                                                <span className="font-medium">Requirement:</span> {fieldResult.operator === 'exists' 
                                                  ? 'Field must exist'
                                                  : fieldResult.operator === 'not_exists'
                                                  ? 'Field must not exist'
                                                  : fieldResult.operator === 'equals'
                                                  ? `Must equal "${String(fieldResult.value)}"`
                                                  : fieldResult.operator === 'not_equals'
                                                  ? `Must not equal "${String(fieldResult.value)}"`
                                                  : fieldResult.operator === 'gte'
                                                  ? `Must be ≥ ${String(fieldResult.value)}`
                                                  : fieldResult.operator === 'gt'
                                                  ? `Must be > ${String(fieldResult.value)}`
                                                  : fieldResult.operator === 'lte'
                                                  ? `Must be ≤ ${String(fieldResult.value)}`
                                                  : fieldResult.operator === 'lt'
                                                  ? `Must be < ${String(fieldResult.value)}`
                                                  : fieldResult.operator === 'contains'
                                                  ? `Must contain "${String(fieldResult.value)}"`
                                                  : fieldResult.operator === 'in'
                                                  ? `Must be one of: ${Array.isArray(fieldResult.value) ? fieldResult.value.join(', ') : String(fieldResult.value)}`
                                                  : fieldResult.operator === 'not_in'
                                                  ? `Must not be one of: ${Array.isArray(fieldResult.value) ? fieldResult.value.join(', ') : String(fieldResult.value)}`
                                                  : `${fieldResult.operator} ${fieldResult.value !== null && fieldResult.value !== undefined ? String(fieldResult.value) : ''}`
                                                }
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                  {details.evaluationLogic && details.fieldResults.length > 1 && (
                                    <div className="text-xs text-gray-500 mt-2 pt-2 border-t border-gray-200">
                                      <span className="font-medium">Evaluation Logic:</span> All fields must {details.evaluationLogic === 'AND' ? 'pass' : 'at least one must pass'} for this control to be met
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {(!policies || policies.length === 0) && (
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            No policy controls configured
          </CardContent>
        </Card>
      )}
    </div>
  );
}
