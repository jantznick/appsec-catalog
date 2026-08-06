import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card.jsx';
import { LoadingPage } from '../ui/Loading.jsx';
import { Button } from '../ui/Button.jsx';
import { Checkbox } from '../ui/Checkbox.jsx';
import { Textarea } from '../ui/Textarea.jsx';
import { Modal } from '../ui/Modal.jsx';
import { toast } from '../ui/Toast.jsx';
import { api } from '../../lib/api.js';
import useAuthStore from '../../store/authStore.js';

export function PolicyComplianceView({ applicationId, compliance, loading, onLoad, onRefresh }) {
  const { isAdmin } = useAuthStore();
  const [availableFields, setAvailableFields] = useState([]);
  const [loadingFields, setLoadingFields] = useState(false);
  const [expandedPolicies, setExpandedPolicies] = useState(new Set());
  const [overrides, setOverrides] = useState([]);
  const [loadingOverrides, setLoadingOverrides] = useState(false);
  const [editingOverrides, setEditingOverrides] = useState({}); // { controlId: { isCompliant, noteContent } }
  const [savingOverride, setSavingOverride] = useState(null);
  const [overrideModal, setOverrideModal] = useState(null); // { controlId, isCompliant, noteContent, mode: 'edit' | 'delete' }

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

  useEffect(() => {
    // Load overrides if user is admin
    const loadOverrides = async () => {
      if (!isAdmin() || !applicationId) return;
      try {
        setLoadingOverrides(true);
        const data = await api.getApplicationPolicyOverrides(applicationId);
        setOverrides(data);
      } catch (error) {
        console.error('Failed to load policy overrides:', error);
      } finally {
        setLoadingOverrides(false);
      }
    };
    loadOverrides();
  }, [applicationId, isAdmin]);

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

  const getOverrideForControl = (controlId) => {
    return overrides.find(o => o.controlId === controlId);
  };

  const handleOverrideChange = (controlId, isCompliant, noteContent = '') => {
    setEditingOverrides({
      ...editingOverrides,
      [controlId]: {
        isCompliant,
        noteContent,
      },
    });
  };

  const handleSaveOverride = async (controlId) => {
    if (!isAdmin()) return;
    
    try {
      setSavingOverride(controlId);
      const overrideData = editingOverrides[controlId];
      if (!overrideData) return;

      await api.createOrUpdatePolicyOverride(applicationId, {
        controlId,
        isCompliant: overrideData.isCompliant,
        noteContent: overrideData.noteContent || '',
      });

      // Reload overrides and compliance
      const data = await api.getApplicationPolicyOverrides(applicationId);
      setOverrides(data);
      
      // Clear editing state
      const newEditing = { ...editingOverrides };
      delete newEditing[controlId];
      setEditingOverrides(newEditing);

      if (onRefresh) {
        onRefresh();
      }

      toast.success('Override saved successfully');
    } catch (error) {
      toast.error(error.message || 'Failed to save override');
    } finally {
      setSavingOverride(null);
    }
  };

  const handleDeleteOverride = async (controlId) => {
    if (!isAdmin()) return;

    try {
      setSavingOverride(controlId);
      await api.deletePolicyOverride(applicationId, controlId);

      // Reload overrides and compliance
      const data = await api.getApplicationPolicyOverrides(applicationId);
      setOverrides(data);
      
      // Clear editing state
      const newEditing = { ...editingOverrides };
      delete newEditing[controlId];
      setEditingOverrides(newEditing);

      // Close modal
      setOverrideModal(null);

      if (onRefresh) {
        onRefresh();
      }

      toast.success('Override removed successfully');
    } catch (error) {
      toast.error(error.message || 'Failed to delete override');
    } finally {
      setSavingOverride(null);
    }
  };

  const handleOpenEditModal = (controlId) => {
    const existingOverride = getOverrideForControl(controlId);
    if (existingOverride) {
      setOverrideModal({
        controlId,
        isCompliant: existingOverride.isCompliant,
        noteContent: existingOverride.note?.content || '',
        mode: 'edit',
      });
    }
  };

  const handleOpenDeleteModal = (controlId) => {
    const existingOverride = getOverrideForControl(controlId);
    if (existingOverride) {
      setOverrideModal({
        controlId,
        isCompliant: existingOverride.isCompliant,
        noteContent: existingOverride.note?.content || '',
        mode: 'delete',
      });
    }
  };

  const handleSaveFromModal = async () => {
    if (!overrideModal) return;
    
    try {
      setSavingOverride(overrideModal.controlId);
      await api.createOrUpdatePolicyOverride(applicationId, {
        controlId: overrideModal.controlId,
        isCompliant: overrideModal.isCompliant,
        noteContent: overrideModal.noteContent || '',
      });

      // Reload overrides and compliance
      const data = await api.getApplicationPolicyOverrides(applicationId);
      setOverrides(data);

      // Close modal
      setOverrideModal(null);

      if (onRefresh) {
        onRefresh();
      }

      toast.success('Override saved successfully');
    } catch (error) {
      toast.error(error.message || 'Failed to save override');
    } finally {
      setSavingOverride(null);
    }
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

                              {/* Manual Override UI for controls without field mappings */}
                              {(!details?.fieldResults || details.fieldResults.length === 0) && (
                                <div className="border-t border-gray-200 pt-4 mt-4">
                                  {(() => {
                                    const existingOverride = getOverrideForControl(control.id);
                                    const overrideFromDetails = details?.override;
                                    const displayOverride = existingOverride || overrideFromDetails;
                                    
                                    // If override exists, show simplified view in blue box
                                    if (displayOverride) {
                                      const override = existingOverride || {
                                        isCompliant: overrideFromDetails.isCompliant,
                                        user: overrideFromDetails.user,
                                        overriddenAt: overrideFromDetails.overriddenAt,
                                        note: overrideFromDetails.note,
                                      };
                                      
                                      return (
                                        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                                          <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                              <div className="text-sm font-medium text-gray-800 mb-2">Manual Override Active</div>
                                              <div className="text-xs text-gray-700 space-y-1">
                                                <div>
                                                  <span className="font-medium">Status:</span> {override.isCompliant ? 'Compliant' : 'Not Compliant'}
                                                </div>
                                                {override.user && (
                                                  <div>
                                                    <span className="font-medium">Set by:</span> {override.user.email || override.user}
                                                  </div>
                                                )}
                                                {override.overriddenAt && (
                                                  <div>
                                                    <span className="font-medium">Date:</span> {new Date(override.overriddenAt).toLocaleString()}
                                                  </div>
                                                )}
                                                {override.note && override.note.content && (
                                                  <div className="mt-2 p-2 bg-surface rounded border border-blue-200">
                                                    <div className="font-medium text-gray-700 mb-1">Note:</div>
                                                    <div className="text-gray-600 whitespace-pre-wrap">{override.note.content}</div>
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                            {isAdmin() && existingOverride && (
                                              <div className="flex gap-2 ml-4">
                                                <button
                                                  onClick={() => handleOpenEditModal(control.id)}
                                                  className="p-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-100 rounded transition-colors"
                                                  title="Edit override"
                                                >
                                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                  </svg>
                                                </button>
                                                <button
                                                  onClick={() => handleOpenDeleteModal(control.id)}
                                                  className="p-1.5 text-red-600 hover:text-red-700 hover:bg-red-100 rounded transition-colors"
                                                  title="Delete override"
                                                >
                                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                  </svg>
                                                </button>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    }
                                    
                                    // If no override exists, show form for admins
                                    if (isAdmin()) {
                                      const editingOverride = editingOverrides[control.id];
                                      const currentOverride = editingOverride || null;
                                      
                                      return (
                                        <div className="space-y-3">
                                          <div className="text-sm font-medium text-gray-700">
                                            Manual Override (Admin Only)
                                          </div>
                                          <p className="text-xs text-gray-500">
                                            This control has no field mappings. Use the override below to manually mark compliance.
                                          </p>
                                          
                                          <Checkbox
                                            id={`override-${control.id}`}
                                            label="Manually mark as compliant"
                                            checked={currentOverride?.isCompliant || false}
                                            onChange={(e) => {
                                              handleOverrideChange(control.id, e.target.checked, currentOverride?.noteContent || '');
                                            }}
                                            disabled={savingOverride === control.id}
                                          />
                                          
                                          <Textarea
                                            label="Notes/Justification"
                                            placeholder="Explain why this control is marked as compliant (optional)"
                                            value={currentOverride?.noteContent || ''}
                                            onChange={(e) => {
                                              handleOverrideChange(control.id, currentOverride?.isCompliant || false, e.target.value);
                                            }}
                                            disabled={savingOverride === control.id}
                                            rows={3}
                                            helperText="This note will be linked to the override and visible in the timeline"
                                          />
                                          
                                          {currentOverride && (
                                            <Button
                                              variant="primary"
                                              size="sm"
                                              onClick={() => handleSaveOverride(control.id)}
                                              loading={savingOverride === control.id}
                                              disabled={savingOverride === control.id}
                                            >
                                              Save Override
                                            </Button>
                                          )}
                                        </div>
                                      );
                                    }
                                    
                                    // Non-admin view when no override exists
                                    return (
                                      <div className="text-sm text-gray-500 italic">
                                        Admin access required to set overrides
                                      </div>
                                    );
                                  })()}
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

      {/* Override Edit/Delete Modal */}
      {overrideModal && (
        <Modal
          isOpen={!!overrideModal}
          onClose={() => setOverrideModal(null)}
          title={overrideModal.mode === 'edit' ? 'Edit Manual Override' : 'Delete Manual Override'}
          size="md"
        >
          {overrideModal.mode === 'edit' ? (
            <div className="space-y-4">
              <Checkbox
                id="modal-override-compliant"
                label="Manually mark as compliant"
                checked={overrideModal.isCompliant}
                onChange={(e) => {
                  setOverrideModal({
                    ...overrideModal,
                    isCompliant: e.target.checked,
                  });
                }}
                disabled={savingOverride === overrideModal.controlId}
              />
              
              <Textarea
                label="Notes/Justification"
                placeholder="Explain why this control is marked as compliant (optional)"
                value={overrideModal.noteContent}
                onChange={(e) => {
                  setOverrideModal({
                    ...overrideModal,
                    noteContent: e.target.value,
                  });
                }}
                disabled={savingOverride === overrideModal.controlId}
                rows={4}
                helperText="This note will be linked to the override and visible in the timeline"
              />
              
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  variant="secondary"
                  onClick={() => setOverrideModal(null)}
                  disabled={savingOverride === overrideModal.controlId}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleSaveFromModal}
                  loading={savingOverride === overrideModal.controlId}
                  disabled={savingOverride === overrideModal.controlId}
                >
                  Save Changes
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-gray-600">
                Are you sure you want to remove this manual override? This action cannot be undone.
              </p>
              
              {overrideModal.noteContent && (
                <div className="p-3 bg-gray-50 rounded border border-gray-200">
                  <div className="text-sm font-medium text-gray-700 mb-1">Current Note:</div>
                  <div className="text-sm text-gray-600 whitespace-pre-wrap">{overrideModal.noteContent}</div>
                </div>
              )}
              
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  variant="secondary"
                  onClick={() => setOverrideModal(null)}
                  disabled={savingOverride === overrideModal.controlId}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  onClick={() => handleDeleteOverride(overrideModal.controlId)}
                  loading={savingOverride === overrideModal.controlId}
                  disabled={savingOverride === overrideModal.controlId}
                >
                  Delete Override
                </Button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
