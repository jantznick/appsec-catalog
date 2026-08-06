import { useState, useEffect } from 'react';
import { api } from '../lib/api.js';
import { toast } from '../components/ui/Toast.jsx';
import { LoadingPage } from '../components/ui/Loading.jsx';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Input } from '../components/ui/Input.jsx';
import { Textarea } from '../components/ui/Textarea.jsx';
import { Select } from '../components/ui/Select.jsx';
import { Checkbox } from '../components/ui/Checkbox.jsx';
import { Modal } from '../components/ui/Modal.jsx';
import useAuthStore from '../store/authStore.js';
import { POLICY_OPERATORS as OPERATORS } from '../lib/policyDisplay.js';

// Get available operators for a field
const getOperatorsForField = (fieldPath, availableFields) => {
  const field = availableFields.find(f => f.path === fieldPath);
  if (!field) return OPERATORS;
  
  // If field has specific allowedOperators, use those
  if (field.allowedOperators && field.allowedOperators.length > 0) {
    return OPERATORS.filter(op => field.allowedOperators.includes(op.value));
  }
  
  // Fallback to type-based filtering (backward compatibility)
  const fieldType = field.fieldType;
  if (fieldType === 'number') {
    return OPERATORS.filter(op => ['exists', 'not_exists', 'equals', 'not_equals', 'gte', 'gt', 'lte', 'lt'].includes(op.value));
  } else if (fieldType === 'boolean') {
    return OPERATORS.filter(op => ['exists', 'not_exists', 'equals', 'not_equals'].includes(op.value));
  } else if (fieldType === 'date') {
    return OPERATORS.filter(op => ['exists', 'not_exists', 'equals', 'not_equals', 'gte', 'gt', 'lte', 'lt'].includes(op.value));
  }
  return OPERATORS;
};

export function PolicyControls() {
  const { isAdmin } = useAuthStore();
  const [policies, setPolicies] = useState([]);
  const [controls, setControls] = useState([]);
  const [availableFields, setAvailableFields] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingFields, setLoadingFields] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [editingControl, setEditingControl] = useState(null);
  const [editingPolicy, setEditingPolicy] = useState(null);
  const [expandedPolicies, setExpandedPolicies] = useState(new Set());
  const [formData, setFormData] = useState({
    controlId: '',
    name: '',
    description: '',
    category: '',
    evaluationLogic: 'AND',
    isActive: true,
    displayOrder: 0,
    policyId: '',
    fields: [],
  });
  const [policyFormData, setPolicyFormData] = useState({
    name: '',
    description: '',
    scope: 'global',
    isActive: true,
    displayOrder: 0,
    divisionIds: [],
    companyIds: [],
    targetingRules: null,
    conditionalLogic: 'AND',
    conditionalConditions: [],
  });
  const [saving, setSaving] = useState(false);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deletingPolicy, setDeletingPolicy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletePolicyTarget, setDeletePolicyTarget] = useState(null);

  useEffect(() => {
    if (isAdmin()) {
      loadData();
      loadAvailableFields();
      loadDivisions();
      loadCompanies();
    }
  }, [isAdmin]);

  const loadDivisions = async () => {
    try {
      const data = await api.getDivisions();
      setDivisions(data);
    } catch (error) {
      console.error('Failed to load divisions:', error);
    }
  };

  const loadCompanies = async () => {
    try {
      const data = await api.getCompanies();
      setCompanies(data);
    } catch (error) {
      console.error('Failed to load companies:', error);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [policiesData, controlsData] = await Promise.all([
        api.getPolicies(),
        api.getPolicyControls(),
      ]);
      setPolicies(policiesData);
      setControls(controlsData);
    } catch (error) {
      toast.error('Failed to load data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadControls = async () => {
    try {
      const data = await api.getPolicyControls();
      setControls(data);
    } catch (error) {
      toast.error('Failed to load policy controls');
      console.error(error);
    }
  };

  const loadAvailableFields = async () => {
    try {
      setLoadingFields(true);
      const data = await api.getAvailableFields();
      setAvailableFields(data);
    } catch (error) {
      toast.error('Failed to load available fields');
      console.error(error);
    } finally {
      setLoadingFields(false);
    }
  };

  const togglePolicy = (policyId) => {
    const newExpanded = new Set(expandedPolicies);
    if (newExpanded.has(policyId)) {
      newExpanded.delete(policyId);
    } else {
      newExpanded.add(policyId);
    }
    setExpandedPolicies(newExpanded);
  };

  const handleCreatePolicy = () => {
    setEditingPolicy(null);
    setPolicyFormData({
      name: '',
      description: '',
      scope: 'global',
      isActive: true,
      displayOrder: policies.length,
      divisionIds: [],
      companyIds: [],
      targetingRules: null,
      conditionalLogic: 'AND',
      conditionalConditions: [],
    });
    setShowPolicyModal(true);
  };

  const handleEditPolicy = async (policy) => {
    try {
      const fullPolicy = await api.getPolicy(policy.id);
      setEditingPolicy(fullPolicy);
      
      // Parse targeting rules if they exist
      let parsedTargetingRules = null;
      let conditionalLogic = 'AND';
      let conditionalConditions = [];
      
      if (fullPolicy.targetingRules) {
        try {
          parsedTargetingRules = JSON.parse(fullPolicy.targetingRules);
          if (parsedTargetingRules.conditions && Array.isArray(parsedTargetingRules.conditions)) {
            conditionalConditions = parsedTargetingRules.conditions.map((cond, idx) => {
              const fieldMetadata = getFieldMetadata(cond.fieldPath);
              let value = cond.value;
              
              // Parse value if it's a string
              if (typeof value === 'string') {
                try {
                  value = JSON.parse(value);
                } catch {
                  // Keep as string
                }
              }
              
              // For in/not_in operators, convert array to comma-separated string for editing
              if ((cond.operator === 'in' || cond.operator === 'not_in') && Array.isArray(value)) {
                value = value.join(', ');
              }
              
              return {
                fieldPath: cond.fieldPath,
                operator: cond.operator,
                value: value,
                displayOrder: idx,
              };
            });
          }
          conditionalLogic = parsedTargetingRules.logic || 'AND';
        } catch (e) {
          console.error('Error parsing targeting rules:', e);
        }
      }
      
      setPolicyFormData({
        name: fullPolicy.name,
        description: fullPolicy.description || '',
        scope: fullPolicy.scope,
        isActive: fullPolicy.isActive,
        displayOrder: fullPolicy.displayOrder || 0,
        divisionIds: fullPolicy.divisionPolicies?.map(dp => dp.division.id) || [],
        companyIds: fullPolicy.companyPolicies?.map(cp => cp.company.id) || [],
        targetingRules: parsedTargetingRules,
        conditionalLogic: conditionalLogic,
        conditionalConditions: conditionalConditions,
      });
      setShowPolicyModal(true);
    } catch (error) {
      toast.error('Failed to load policy details');
      console.error(error);
    }
  };

  const handleDeletePolicy = (policy) => {
    setDeletePolicyTarget(policy);
  };

  const confirmDeletePolicy = async () => {
    if (!deletePolicyTarget) return;

    try {
      setDeletingPolicy(true);
      await api.deletePolicy(deletePolicyTarget.id);
      toast.success('Policy deleted successfully');
      setDeletePolicyTarget(null);
      await loadData();
    } catch (error) {
      toast.error(error.message || 'Failed to delete policy');
    } finally {
      setDeletingPolicy(false);
    }
  };

  const handleSubmitPolicy = async (e) => {
    e.preventDefault();
    if (!policyFormData.name.trim()) {
      toast.error('Policy name is required');
      return;
    }

    try {
      setSavingPolicy(true);
      const payload = {
        name: policyFormData.name.trim(),
        description: policyFormData.description?.trim() || null,
        scope: policyFormData.scope,
        isActive: policyFormData.isActive,
        displayOrder: policyFormData.displayOrder || 0,
      };

      // Only include divisionIds/companyIds if scope matches and they're not empty
      if (policyFormData.scope === 'division') {
        if (policyFormData.divisionIds.length === 0) {
          toast.error('Please select at least one division for division-scoped policies');
          return;
        }
        payload.divisionIds = policyFormData.divisionIds;
      } else if (policyFormData.scope === 'company') {
        if (policyFormData.companyIds.length === 0) {
          toast.error('Please select at least one company for company-scoped policies');
          return;
        }
        payload.companyIds = policyFormData.companyIds;
      } else if (policyFormData.scope === 'conditional') {
        if (policyFormData.conditionalConditions.length === 0) {
          toast.error('Please add at least one condition for conditional-scoped policies');
          return;
        }
        
        // Validate each condition has required fields
        for (let i = 0; i < policyFormData.conditionalConditions.length; i++) {
          const cond = policyFormData.conditionalConditions[i];
          if (!cond.fieldPath || !cond.fieldPath.trim()) {
            toast.error(`Condition ${i + 1} is missing a field selection`);
            return;
          }
          if (!cond.operator) {
            toast.error(`Condition ${i + 1} is missing an operator`);
            return;
          }
          // Check if value is required (not for exists/not_exists)
          if (cond.operator !== 'exists' && cond.operator !== 'not_exists') {
            if (cond.value === null || cond.value === undefined || cond.value === '') {
              toast.error(`Condition ${i + 1} is missing a value`);
              return;
            }
          }
        }
        
        // Build targeting rules from conditions
        const conditions = policyFormData.conditionalConditions.map(cond => {
          let value = cond.value;
          
          // Convert comma-separated strings to arrays for in/not_in operators
          if ((cond.operator === 'in' || cond.operator === 'not_in') && typeof value === 'string' && value.trim() !== '') {
            const values = value.split(',').map(v => v.trim()).filter(v => v.length > 0);
            value = values.length > 0 ? values : value;
          }
          
          return {
            fieldPath: cond.fieldPath,
            operator: cond.operator,
            value: value !== null && value !== undefined ? value : null,
          };
        });
        
        payload.targetingRules = {
          type: 'conditional',
          conditions: conditions,
          logic: policyFormData.conditionalLogic || 'AND',
        };
      }

      if (editingPolicy) {
        await api.updatePolicy(editingPolicy.id, payload);
        toast.success('Policy updated successfully');
      } else {
        await api.createPolicy(payload);
        toast.success('Policy created successfully');
      }
      setShowPolicyModal(false);
      setPolicyFormData({
        name: '',
        description: '',
        scope: 'global',
        isActive: true,
        displayOrder: 0,
        divisionIds: [],
        companyIds: [],
        targetingRules: null,
        conditionalLogic: 'AND',
        conditionalConditions: [],
      });
      setEditingPolicy(null);
      await loadData();
    } catch (error) {
      toast.error(error.message || `Failed to ${editingPolicy ? 'update' : 'create'} policy`);
    } finally {
      setSavingPolicy(false);
    }
  };

  const handleCreate = () => {
    setEditingControl(null);
    setFormData({
      controlId: '',
      name: '',
      description: '',
      category: '',
      evaluationLogic: 'AND',
      isActive: true,
      displayOrder: controls.length,
      policyId: policies.length > 0 ? policies[0].id : '',
      fields: [],
    });
    setShowModal(true);
  };

  const handleEdit = (control) => {
    setEditingControl(control);
    setFormData({
      controlId: control.controlId,
      name: control.name,
      description: control.description,
      category: control.category || '',
      evaluationLogic: control.evaluationLogic,
      isActive: control.isActive,
      displayOrder: control.displayOrder,
      policyId: control.policyId || (policies.length > 0 ? policies[0].id : ''),
      fields: control.fields.map(f => {
        const fieldMetadata = getFieldMetadata(f.fieldPath);
        const availableOperators = getOperatorsForField(f.fieldPath, availableFields);
        const isValidOperator = availableOperators.some(op => op.value === f.operator);
        
        let value = f.value ? (() => {
          try {
            const parsed = JSON.parse(f.value);
            // Convert to number if field type is number and value is a string number
            if (fieldMetadata?.fieldType === 'number' && typeof parsed === 'string' && !isNaN(parsed)) {
              return Number(parsed);
            }
            return parsed;
          } catch {
            return f.value;
          }
        })() : null;
        
        // For in/not_in operators, convert array to comma-separated string for editing
        if ((f.operator === 'in' || f.operator === 'not_in') && Array.isArray(value)) {
          value = value.join(', ');
        }
        
        return {
          fieldPath: f.fieldPath,
          operator: isValidOperator ? f.operator : (availableOperators[0]?.value || 'exists'),
          value: value,
          displayOrder: f.displayOrder,
        };
      }),
    });
    setShowModal(true);
  };

  const handleDelete = (control) => {
    setDeleteTarget(control);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      setDeleting(true);
      await api.deletePolicyControl(deleteTarget.id);
      toast.success('Policy control deleted successfully');
      setDeleteTarget(null);
      await loadData();
    } catch (error) {
      toast.error(error.message || 'Failed to delete policy control');
    } finally {
      setDeleting(false);
    }
  };

  const handleAddField = () => {
    setFormData({
      ...formData,
      fields: [
        ...formData.fields,
        {
          fieldPath: '',
          operator: 'exists',
          value: null,
          displayOrder: formData.fields.length,
        },
      ],
    });
  };

  const handleRemoveField = (index) => {
    setFormData({
      ...formData,
      fields: formData.fields.filter((_, i) => i !== index).map((f, i) => ({
        ...f,
        displayOrder: i,
      })),
    });
  };

  const handleFieldChange = (index, field, value) => {
    const newFields = [...formData.fields];
    const updatedField = {
      ...newFields[index],
      [field]: value,
    };

    // If field path changed, validate/reset operator if needed
    if (field === 'fieldPath') {
      const fieldMetadata = getFieldMetadata(value);
      if (fieldMetadata) {
        const availableOperators = getOperatorsForField(value, availableFields);
        const currentOperator = updatedField.operator;
        
        // If current operator is not valid for this field, reset to first available
        if (currentOperator && !availableOperators.find(op => op.value === currentOperator)) {
          updatedField.operator = availableOperators[0]?.value || 'exists';
          // Clear value if operator changed to one that doesn't need a value
          if (updatedField.operator === 'exists' || updatedField.operator === 'not_exists') {
            updatedField.value = null;
          }
        }
      }
    }

    newFields[index] = updatedField;
    setFormData({
      ...formData,
      fields: newFields,
    });
  };

  const handleMoveField = (index, direction) => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === formData.fields.length - 1)
    ) {
      return;
    }

    const newFields = [...formData.fields];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newFields[index], newFields[targetIndex]] = [newFields[targetIndex], newFields[index]];
    
    // Update display orders
    newFields.forEach((f, i) => {
      f.displayOrder = i;
    });

    setFormData({
      ...formData,
      fields: newFields,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.controlId.trim()) {
      toast.error('Control ID is required');
      return;
    }
    if (!formData.name.trim()) {
      toast.error('Control name is required');
      return;
    }
    if (!formData.description.trim()) {
      toast.error('Control description is required');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        ...formData,
        fields: formData.fields.map(f => {
          // Convert comma-separated strings to arrays for in/not_in operators before saving
          let value = f.value;
          if ((f.operator === 'in' || f.operator === 'not_in') && typeof value === 'string' && value.trim() !== '') {
            const values = value.split(',').map(v => v.trim()).filter(v => v.length > 0);
            value = values.length > 0 ? values : null;
          }
          return {
            ...f,
            value: value !== null && value !== undefined ? value : null,
          };
        }),
      };

      if (editingControl) {
        await api.updatePolicyControl(editingControl.id, payload);
        toast.success('Policy control updated successfully');
      } else {
        await api.createPolicyControl(payload);
        toast.success('Policy control created successfully');
      }
      setShowModal(false);
      setFormData({
        controlId: '',
        name: '',
        description: '',
        category: '',
        evaluationLogic: 'AND',
        isActive: true,
        displayOrder: 0,
        fields: [],
      });
      setEditingControl(null);
      await loadControls();
    } catch (error) {
      toast.error(error.message || `Failed to ${editingControl ? 'update' : 'create'} policy control`);
    } finally {
      setSaving(false);
    }
  };

  const getFieldLabel = (fieldPath) => {
    const field = availableFields.find(f => f.path === fieldPath);
    return field ? field.label : fieldPath;
  };

  const getFieldType = (fieldPath) => {
    const field = availableFields.find(f => f.path === fieldPath);
    return field ? field.fieldType : 'string';
  };

  const getFieldMetadata = (fieldPath) => {
    return availableFields.find(f => f.path === fieldPath) || null;
  };

  const getCategoryFields = () => {
    const categories = {};
    availableFields.forEach(field => {
      if (!categories[field.category]) {
        categories[field.category] = [];
      }
      categories[field.category].push(field);
    });
    return categories;
  };

  if (!isAdmin()) {
    return (
      <div>
        <Card>
          <CardContent>
            <div className="text-center py-12">
              <p className="text-gray-500">You do not have permission to view this page.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading || loadingFields) {
    return <LoadingPage message="Loading policy controls..." />;
  }

  const categoryFields = getCategoryFields();

  return (
    <div>
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Policies & Controls</h1>
          <p className="text-gray-600">Manage policies and their InfoSec policy controls</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleCreatePolicy}>
            Create Policy
          </Button>
          <Button variant="primary" onClick={handleCreate}>
            Create Control
          </Button>
        </div>
      </div>

      {policies.length === 0 ? (
        <Card>
          <CardContent>
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">No policies found. Create a policy first, then add controls to it.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {policies
            .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
            .map((policy) => {
              const policyControls = controls
                .filter(c => c.policyId === policy.id)
                .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
              const isExpanded = expandedPolicies.has(policy.id);
              const scopeLabels = {
                global: 'Global',
                division: 'Division',
                company: 'Company',
                conditional: 'Conditional',
              };

              return (
                <Card key={policy.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <button
                          onClick={() => togglePolicy(policy.id)}
                          className="flex items-center gap-2 text-left hover:opacity-80 transition-opacity"
                        >
                          <span className="text-xl">
                            {isExpanded ? '▼' : '▶'}
                          </span>
                          <div>
                            <CardTitle className="text-lg">
                              {policy.name}
                            </CardTitle>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="px-2 py-1 text-xs font-medium rounded bg-blue-100 text-blue-800">
                                {scopeLabels[policy.scope] || policy.scope}
                              </span>
                              {!policy.isActive && (
                                <span className="px-2 py-1 text-xs font-medium rounded bg-gray-100 text-gray-600">
                                  Inactive
                                </span>
                              )}
                              <span className="text-sm text-gray-500">
                                {policyControls.length} control{policyControls.length !== 1 ? 's' : ''}
                              </span>
                            </div>
                            {policy.description && (
                              <p className="text-sm text-gray-600 mt-1">{policy.description}</p>
                            )}
                          </div>
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditPolicy(policy)}
                        >
                          Edit Policy
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeletePolicy(policy)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  {isExpanded && (
                    <CardContent>
                      {policyControls.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          <p className="text-sm">No controls in this policy. Create a control and assign it to this policy.</p>
                        </div>
                      ) : (
                        <div className="space-y-3 pt-2">
                          {policyControls.map((control) => (
                            <Card key={control.id} className="bg-gray-50">
                              <CardHeader>
                                <div className="flex justify-between items-start">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                      <CardTitle className="text-base">
                                        {control.controlId} - {control.name}
                                      </CardTitle>
                                      {!control.isActive && (
                                        <span className="px-2 py-1 text-xs font-medium rounded bg-gray-100 text-gray-600">
                                          Inactive
                                        </span>
                                      )}
                                      {control.category && (
                                        <span className="px-2 py-1 text-xs font-medium rounded bg-blue-100 text-blue-800">
                                          {control.category}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-sm text-gray-600 mt-1">{control.description}</p>
                                  </div>
                                  <div className="flex gap-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleEdit(control)}
                                    >
                                      Edit
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDelete(control)}
                                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                    >
                                      Delete
                                    </Button>
                                  </div>
                                </div>
                              </CardHeader>
                              {control.fields && control.fields.length > 0 && (
                                <CardContent>
                                  <div className="border-t border-gray-200 pt-4 mt-4">
                                    <span className="text-sm font-medium text-gray-700 mb-3 block">Field Mappings:</span>
                                    <div className="flex flex-wrap items-center gap-2">
                                      {control.fields.map((field, idx) => {
                                        const fieldLabel = getFieldLabel(field.fieldPath);
                                        const operatorLabel = OPERATORS.find(op => op.value === field.operator)?.label || field.operator;
                                        const hasValue = field.value !== null && field.value !== undefined && field.value !== '';
                                        const isLast = idx === control.fields.length - 1;
                                        const showLogic = !isLast && control.evaluationLogic;
                                        
                                        return (
                                          <div key={idx} className="flex items-center gap-2">
                                            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-surface rounded-lg border border-gray-200 text-sm">
                                              <span className="font-medium text-gray-700">{fieldLabel}</span>
                                              <span className="text-gray-400">•</span>
                                              <span className="text-gray-600">{operatorLabel}</span>
                                              {hasValue && (
                                                <>
                                                  <span className="text-gray-400">•</span>
                                                  <span className="px-1.5 py-0.5 bg-gray-50 rounded text-gray-700 border border-gray-200 font-mono text-xs">
                                                    {String(field.value)}
                                                  </span>
                                                </>
                                              )}
                                            </div>
                                            {showLogic && (
                                              <span className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase">
                                                {control.evaluationLogic}
                                              </span>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </CardContent>
                              )}
                            </Card>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  )}
                </Card>
              );
            })}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <Modal
          isOpen={showModal}
          onClose={() => {
            setShowModal(false);
            setFormData({
              controlId: '',
              name: '',
              description: '',
              category: '',
              evaluationLogic: 'AND',
              isActive: true,
              displayOrder: 0,
              policyId: policies.length > 0 ? policies[0].id : '',
              fields: [],
            });
            setEditingControl(null);
          }}
          title={editingControl ? 'Edit Policy Control' : 'Create Policy Control'}
          size="xl"
        >
          <form onSubmit={handleSubmit}>
            <div className="space-y-6 max-h-[80vh] overflow-y-auto pr-2">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Control ID"
                  value={formData.controlId}
                  onChange={(e) => setFormData({ ...formData, controlId: e.target.value })}
                  required
                  placeholder="e.g., 3.4.2"
                  helperText="Unique identifier for this control"
                />
                <Input
                  label="Display Order"
                  type="number"
                  value={formData.displayOrder}
                  onChange={(e) => setFormData({ ...formData, displayOrder: parseInt(e.target.value) || 0 })}
                  helperText="Order for display (lower numbers appear first)"
                />
              </div>

              <Select
                label="Policy"
                value={formData.policyId}
                onChange={(e) => setFormData({ ...formData, policyId: e.target.value })}
                required
                options={policies.map(p => ({ value: p.id, label: p.name }))}
                helperText="Select the policy this control belongs to"
              />

              <Input
                label="Control Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="e.g., Pre-Prod Scanning Required"
              />

              <Textarea
                label="Description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                required
                rows={3}
                placeholder="Full description of the control requirement"
              />

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="e.g., Security Testing"
                  helperText="Optional category for grouping"
                />
                <Select
                  label="Evaluation Logic"
                  value={formData.evaluationLogic}
                  onChange={(e) => setFormData({ ...formData, evaluationLogic: e.target.value })}
                  options={[
                    { value: 'AND', label: 'AND (all fields must pass)' },
                    { value: 'OR', label: 'OR (at least one field must pass)' },
                  ]}
                  helperText="How to combine field checks"
                />
              </div>

              <Checkbox
                id="isActive"
                label="Active"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                helperText="Only active controls are evaluated"
              />

              {/* Fields Section */}
              <div className="border-t pt-4">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">Field Mappings</h3>
                    <p className="text-sm text-gray-600">Define which application fields are checked for this control</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddField}
                  >
                    Add Field
                  </Button>
                </div>

                {formData.fields.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-sm text-gray-500">No field mappings. Click "Add Field" to add one.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {formData.fields.map((field, index) => (
                      <Card key={index} className="bg-gray-50">
                        <CardContent className="pt-4">
                          <div className="flex justify-between items-start mb-4">
                            <h4 className="text-sm font-semibold text-gray-700">Field {index + 1}</h4>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleMoveField(index, 'up')}
                                disabled={index === 0}
                                title="Move up"
                              >
                                ↑
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleMoveField(index, 'down')}
                                disabled={index === formData.fields.length - 1}
                                title="Move down"
                              >
                                ↓
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveField(index)}
                                className="text-red-600 hover:text-red-700"
                              >
                                Remove
                              </Button>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-4">
                            <Select
                              label="Field"
                              value={field.fieldPath}
                              onChange={(e) => handleFieldChange(index, 'fieldPath', e.target.value)}
                              required
                              options={Object.entries(categoryFields).flatMap(([category, fields]) => [
                                { value: `__category__${category}`, label: `--- ${category} ---`, disabled: true },
                                ...fields.map(f => ({ value: f.path, label: f.label })),
                              ])}
                              placeholder="Select field"
                            />
                            <Select
                              label="Operator"
                              value={field.operator}
                              onChange={(e) => handleFieldChange(index, 'operator', e.target.value)}
                              required
                              options={getOperatorsForField(field.fieldPath, availableFields)}
                              helperText={
                                (() => {
                                  const fieldMetadata = getFieldMetadata(field.fieldPath);
                                  if (fieldMetadata?.validationRules?.description) {
                                    return fieldMetadata.validationRules.description;
                                  }
                                  const fieldType = getFieldType(field.fieldPath);
                                  if (fieldType === 'number') {
                                    return 'Use comparison operators (≥, >, ≤, <) for numeric values';
                                  } else if (fieldType === 'boolean') {
                                    return 'Use equals/not equals for boolean values';
                                  } else if (fieldType === 'date') {
                                    return 'Use comparison operators for date values';
                                  }
                                  return '';
                                })()
                              }
                            />
                            {(() => {
                              const fieldMetadata = getFieldMetadata(field.fieldPath);
                              const valueType = fieldMetadata?.valueType || (getFieldType(field.fieldPath) === 'number' ? 'number' : getFieldType(field.fieldPath) === 'date' ? 'date' : 'text');
                              const needsValue = field.operator !== 'exists' && field.operator !== 'not_exists';
                              
                              // Dropdown for fields with valueOptions
                              if (valueType === 'dropdown' && fieldMetadata?.valueOptions && needsValue) {
                                return (
                                  <Select
                                    label="Value"
                                    value={field.value !== null && field.value !== undefined ? String(field.value) : ''}
                                    onChange={(e) => {
                                      let value = e.target.value;
                                      if (value === '') {
                                        value = null;
                                      } else {
                                        // Convert to number if field type is number
                                        if (fieldMetadata.fieldType === 'number') {
                                          value = Number(value);
                                        }
                                      }
                                      handleFieldChange(index, 'value', value);
                                    }}
                                    required={needsValue}
                                    options={[
                                      { value: '', label: 'Select value' },
                                      ...fieldMetadata.valueOptions
                                    ]}
                                    helperText={fieldMetadata?.validationRules?.description || 'Select a value from the dropdown'}
                                  />
                                );
                              }
                              
                              // Boolean dropdown
                              if (valueType === 'boolean' && fieldMetadata?.valueOptions && needsValue) {
                                return (
                                  <Select
                                    label="Value"
                                    value={field.value !== null && field.value !== undefined ? String(field.value) : ''}
                                    onChange={(e) => {
                                      let value = e.target.value;
                                      if (value === '') {
                                        value = null;
                                      } else {
                                        value = value === 'true';
                                      }
                                      handleFieldChange(index, 'value', value);
                                    }}
                                    required={needsValue}
                                    options={[
                                      { value: '', label: 'Select value' },
                                      ...fieldMetadata.valueOptions
                                    ]}
                                    helperText={fieldMetadata?.validationRules?.description || 'Select true or false'}
                                  />
                                );
                              }
                              
                              // Regular input for text, number, date
                              return (
                                <Input
                                  label="Value"
                                  type={valueType === 'number' ? 'number' : valueType === 'date' ? 'date' : 'text'}
                                  value={
                                    field.value !== null && field.value !== undefined
                                      ? Array.isArray(field.value)
                                        ? field.value.join(', ')
                                        : String(field.value)
                                      : ''
                                  }
                                  onChange={(e) => {
                                    let value = e.target.value;
                                    const fieldType = getFieldType(field.fieldPath);
                                    
                                    // Handle number fields
                                    if (fieldType === 'number') {
                                      if (value === '') {
                                        value = null;
                                      } else {
                                        const numValue = Number(value);
                                        value = !isNaN(numValue) ? numValue : value;
                                        // Apply min/max if specified
                                        if (fieldMetadata?.validationRules?.min !== undefined && value < fieldMetadata.validationRules.min) {
                                          value = fieldMetadata.validationRules.min;
                                        }
                                        if (fieldMetadata?.validationRules?.max !== undefined && value > fieldMetadata.validationRules.max) {
                                          value = fieldMetadata.validationRules.max;
                                        }
                                      }
                                    } else if (fieldType === 'boolean') {
                                      // For boolean, convert string to boolean
                                      if (value === 'true' || value === '1' || value.toLowerCase() === 'yes') {
                                        value = true;
                                      } else if (value === 'false' || value === '0' || value.toLowerCase() === 'no') {
                                        value = false;
                                      } else if (value === '') {
                                        value = null;
                                      }
                                    } else {
                                      // For in/not_in operators, keep as string while typing
                                      // Only convert to array on blur or save
                                      if (field.operator === 'in' || field.operator === 'not_in') {
                                        // Keep as string - will be converted to array on blur
                                        if (value === '') {
                                          value = null;
                                        }
                                        // Store as string for now
                                      } else {
                                        // Empty string becomes null
                                        if (value === '') {
                                          value = null;
                                        }
                                      }
                                    }
                                    handleFieldChange(index, 'value', value);
                                  }}
                                  onBlur={(e) => {
                                    // Convert comma-separated string to array for in/not_in operators
                                    if (field.operator === 'in' || field.operator === 'not_in') {
                                      const value = e.target.value;
                                      if (value === '') {
                                        handleFieldChange(index, 'value', null);
                                      } else {
                                        // Split by comma and trim each value
                                        const values = value.split(',').map(v => v.trim()).filter(v => v.length > 0);
                                        handleFieldChange(index, 'value', values.length > 0 ? values : null);
                                      }
                                    }
                                  }}
                                  min={fieldMetadata?.validationRules?.min}
                                  max={fieldMetadata?.validationRules?.max}
                                  placeholder={
                                    !needsValue
                                      ? 'No value needed'
                                      : valueType === 'number'
                                      ? `Enter number${fieldMetadata?.validationRules?.min !== undefined || fieldMetadata?.validationRules?.max !== undefined ? ` (${fieldMetadata?.validationRules?.min || ''}-${fieldMetadata?.validationRules?.max || ''})` : ''}`
                                      : valueType === 'date'
                                      ? 'Select date'
                                      : field.operator === 'in' || field.operator === 'not_in'
                                      ? 'Comma-separated values'
                                      : 'Enter value'
                                  }
                                  helperText={
                                    !needsValue
                                      ? 'No value needed'
                                      : fieldMetadata?.validationRules?.description
                                      ? fieldMetadata.validationRules.description
                                      : valueType === 'number'
                                      ? `Enter a numeric value${fieldMetadata?.validationRules?.min !== undefined || fieldMetadata?.validationRules?.max !== undefined ? ` between ${fieldMetadata?.validationRules?.min || 'any'} and ${fieldMetadata?.validationRules?.max || 'any'}` : ''}`
                                      : valueType === 'boolean'
                                      ? 'Enter true/false or yes/no'
                                      : field.operator === 'in' || field.operator === 'not_in'
                                      ? 'Comma-separated values (e.g., "value1, value2")'
                                      : 'Enter comparison value'
                                  }
                                />
                              );
                            })()}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-6 mt-6">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setShowModal(false);
                  setFormData({
                    controlId: '',
                    name: '',
                    description: '',
                    category: '',
                    evaluationLogic: 'AND',
                    isActive: true,
                    displayOrder: 0,
                    policyId: policies.length > 0 ? policies[0].id : '',
                    fields: [],
                  });
                  setEditingControl(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={saving}>
                {editingControl ? 'Update' : 'Create'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <Modal
          isOpen={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          title="Delete Policy Control"
        >
          <div className="space-y-4">
            <p className="text-gray-600">
              Are you sure you want to delete <strong>{deleteTarget.controlId} - {deleteTarget.name}</strong>?
            </p>
            <p className="text-sm text-gray-500">
              This action cannot be undone. All field mappings for this control will also be deleted.
            </p>
            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="secondary"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={confirmDelete}
                loading={deleting}
              >
                Delete
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Policy Create/Edit Modal */}
      {showPolicyModal && (
        <Modal
          isOpen={showPolicyModal}
          onClose={() => {
            setShowPolicyModal(false);
            setPolicyFormData({
              name: '',
              description: '',
              scope: 'global',
              isActive: true,
              displayOrder: 0,
              divisionIds: [],
              companyIds: [],
              targetingRules: null,
            });
            setEditingPolicy(null);
          }}
          title={editingPolicy ? 'Edit Policy' : 'Create Policy'}
          size="xl"
        >
          <form onSubmit={handleSubmitPolicy}>
            <div className="space-y-6 max-h-[80vh] overflow-y-auto pr-2">
              <Input
                label="Policy Name"
                value={policyFormData.name}
                onChange={(e) => setPolicyFormData({ ...policyFormData, name: e.target.value })}
                required
                placeholder="e.g., Global Security Baseline"
              />

              <Textarea
                label="Description"
                value={policyFormData.description}
                onChange={(e) => setPolicyFormData({ ...policyFormData, description: e.target.value })}
                rows={3}
                placeholder="Description of what this policy covers"
              />

              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="Scope"
                  value={policyFormData.scope}
                  onChange={(e) => {
                    const newScope = e.target.value;
                    setPolicyFormData({
                      ...policyFormData,
                      scope: newScope,
                      divisionIds: newScope === 'division' ? policyFormData.divisionIds : [],
                      companyIds: newScope === 'company' ? policyFormData.companyIds : [],
                      targetingRules: newScope === 'conditional' ? policyFormData.targetingRules : null,
                      conditionalLogic: newScope === 'conditional' ? policyFormData.conditionalLogic : 'AND',
                      conditionalConditions: newScope === 'conditional' ? policyFormData.conditionalConditions : [],
                    });
                  }}
                  required
                  options={[
                    { value: 'global', label: 'Global (All Applications)' },
                    { value: 'division', label: 'Division' },
                    { value: 'company', label: 'Company' },
                    { value: 'conditional', label: 'Conditional' },
                  ]}
                  helperText="Who this policy applies to"
                />
                <Input
                  label="Display Order"
                  type="number"
                  value={policyFormData.displayOrder}
                  onChange={(e) => setPolicyFormData({ ...policyFormData, displayOrder: parseInt(e.target.value) || 0 })}
                  helperText="Order for display (lower numbers appear first)"
                />
              </div>

              {policyFormData.scope === 'division' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Divisions <span className="text-red-500">*</span>
                  </label>
                  {divisions.length === 0 ? (
                    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                      <p className="text-sm text-gray-500">No divisions available. Create divisions first.</p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3 bg-surface">
                        {divisions.map((division) => (
                          <Checkbox
                            key={division.id}
                            id={`division-${division.id}`}
                            label={division.name}
                            checked={policyFormData.divisionIds.includes(division.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setPolicyFormData({
                                  ...policyFormData,
                                  divisionIds: [...policyFormData.divisionIds, division.id],
                                });
                              } else {
                                setPolicyFormData({
                                  ...policyFormData,
                                  divisionIds: policyFormData.divisionIds.filter(id => id !== division.id),
                                });
                              }
                            }}
                          />
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Select which divisions this policy applies to. {policyFormData.divisionIds.length > 0 && (
                          <span className="text-green-600 font-medium">
                            {policyFormData.divisionIds.length} selected
                          </span>
                        )}
                      </p>
                    </>
                  )}
                </div>
              )}

              {policyFormData.scope === 'company' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Companies <span className="text-red-500">*</span>
                  </label>
                  {companies.length === 0 ? (
                    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                      <p className="text-sm text-gray-500">No companies available. Create companies first.</p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3 bg-surface">
                        {companies.map((company) => (
                          <Checkbox
                            key={company.id}
                            id={`company-${company.id}`}
                            label={company.name}
                            checked={policyFormData.companyIds.includes(company.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setPolicyFormData({
                                  ...policyFormData,
                                  companyIds: [...policyFormData.companyIds, company.id],
                                });
                              } else {
                                setPolicyFormData({
                                  ...policyFormData,
                                  companyIds: policyFormData.companyIds.filter(id => id !== company.id),
                                });
                              }
                            }}
                          />
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Select which companies this policy applies to. {policyFormData.companyIds.length > 0 && (
                          <span className="text-green-600 font-medium">
                            {policyFormData.companyIds.length} selected
                          </span>
                        )}
                      </p>
                    </>
                  )}
                </div>
              )}

              {policyFormData.scope === 'conditional' && (
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <label className="block text-sm font-medium text-gray-700">
                      Conditional Rules <span className="text-red-500">*</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">Logic:</span>
                      <Select
                        value={policyFormData.conditionalLogic}
                        onChange={(e) => setPolicyFormData({ ...policyFormData, conditionalLogic: e.target.value })}
                        options={[
                          { value: 'AND', label: 'AND (all conditions must pass)' },
                          { value: 'OR', label: 'OR (at least one condition must pass)' },
                        ]}
                        className="w-64"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-3 mb-4">
                    {policyFormData.conditionalConditions.length === 0 ? (
                      <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
                        <p className="text-sm text-gray-500 mb-3">No conditions defined. Add a condition to get started.</p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setPolicyFormData({
                              ...policyFormData,
                              conditionalConditions: [
                                ...policyFormData.conditionalConditions,
                                {
                                  fieldPath: '',
                                  operator: 'exists',
                                  value: null,
                                  displayOrder: policyFormData.conditionalConditions.length,
                                },
                              ],
                            });
                          }}
                        >
                          Add Condition
                        </Button>
                      </div>
                    ) : (
                      policyFormData.conditionalConditions.map((condition, index) => {
                        const fieldMetadata = getFieldMetadata(condition.fieldPath);
                        const availableOperators = getOperatorsForField(condition.fieldPath, availableFields);
                        const needsValue = condition.operator !== 'exists' && condition.operator !== 'not_exists';
                        
                        return (
                          <Card key={index} className="bg-gray-50">
                            <CardContent className="pt-4">
                              <div className="flex justify-between items-start mb-4">
                                <h4 className="text-sm font-semibold text-gray-700">Condition {index + 1}</h4>
                                <div className="flex gap-2">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      const newConditions = [...policyFormData.conditionalConditions];
                                      if (index > 0) {
                                        [newConditions[index], newConditions[index - 1]] = [newConditions[index - 1], newConditions[index]];
                                        newConditions.forEach((c, i) => { c.displayOrder = i; });
                                        setPolicyFormData({ ...policyFormData, conditionalConditions: newConditions });
                                      }
                                    }}
                                    disabled={index === 0}
                                    title="Move up"
                                  >
                                    ↑
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      const newConditions = [...policyFormData.conditionalConditions];
                                      if (index < newConditions.length - 1) {
                                        [newConditions[index], newConditions[index + 1]] = [newConditions[index + 1], newConditions[index]];
                                        newConditions.forEach((c, i) => { c.displayOrder = i; });
                                        setPolicyFormData({ ...policyFormData, conditionalConditions: newConditions });
                                      }
                                    }}
                                    disabled={index === policyFormData.conditionalConditions.length - 1}
                                    title="Move down"
                                  >
                                    ↓
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setPolicyFormData({
                                        ...policyFormData,
                                        conditionalConditions: policyFormData.conditionalConditions.filter((_, i) => i !== index).map((c, i) => ({
                                          ...c,
                                          displayOrder: i,
                                        })),
                                      });
                                    }}
                                    className="text-red-600 hover:text-red-700"
                                  >
                                    Remove
                                  </Button>
                                </div>
                              </div>
                              <div className="grid grid-cols-3 gap-4">
                                <Select
                                  label="Field"
                                  value={condition.fieldPath}
                                  onChange={(e) => {
                                    const newConditions = [...policyFormData.conditionalConditions];
                                    const updatedCondition = {
                                      ...newConditions[index],
                                      fieldPath: e.target.value,
                                    };
                                    
                                    // Reset operator if field changed
                                    const fieldMeta = getFieldMetadata(e.target.value);
                                    if (fieldMeta) {
                                      const availableOps = getOperatorsForField(e.target.value, availableFields);
                                      if (!availableOps.find(op => op.value === updatedCondition.operator)) {
                                        updatedCondition.operator = availableOps[0]?.value || 'exists';
                                        if (updatedCondition.operator === 'exists' || updatedCondition.operator === 'not_exists') {
                                          updatedCondition.value = null;
                                        }
                                      }
                                    }
                                    
                                    newConditions[index] = updatedCondition;
                                    setPolicyFormData({ ...policyFormData, conditionalConditions: newConditions });
                                  }}
                                  required
                                  options={Object.entries(categoryFields).flatMap(([category, fields]) => [
                                    { value: '', label: `--- ${category} ---`, disabled: true },
                                    ...fields.map(f => ({ value: f.path, label: f.label })),
                                  ])}
                                  placeholder="Select field"
                                />
                                <Select
                                  label="Operator"
                                  value={condition.operator}
                                  onChange={(e) => {
                                    const newConditions = [...policyFormData.conditionalConditions];
                                    newConditions[index] = {
                                      ...newConditions[index],
                                      operator: e.target.value,
                                      value: (e.target.value === 'exists' || e.target.value === 'not_exists') ? null : newConditions[index].value,
                                    };
                                    setPolicyFormData({ ...policyFormData, conditionalConditions: newConditions });
                                  }}
                                  required
                                  options={availableOperators}
                                />
                                {(() => {
                                  const valueType = fieldMetadata?.valueType || (getFieldType(condition.fieldPath) === 'number' ? 'number' : getFieldType(condition.fieldPath) === 'date' ? 'date' : 'text');
                                  
                                  // Dropdown for fields with valueOptions
                                  if (valueType === 'dropdown' && fieldMetadata?.valueOptions && needsValue) {
                                    return (
                                      <Select
                                        label="Value"
                                        value={condition.value !== null && condition.value !== undefined ? String(condition.value) : ''}
                                        onChange={(e) => {
                                          const newConditions = [...policyFormData.conditionalConditions];
                                          let value = e.target.value;
                                          if (value === '') {
                                            value = null;
                                          } else if (fieldMetadata.fieldType === 'number') {
                                            value = Number(value);
                                          }
                                          newConditions[index] = { ...newConditions[index], value };
                                          setPolicyFormData({ ...policyFormData, conditionalConditions: newConditions });
                                        }}
                                        required={needsValue}
                                        options={[
                                          { value: '', label: 'Select value' },
                                          ...fieldMetadata.valueOptions
                                        ]}
                                      />
                                    );
                                  }
                                  
                                  // Boolean dropdown
                                  if (valueType === 'boolean' && fieldMetadata?.valueOptions && needsValue) {
                                    return (
                                      <Select
                                        label="Value"
                                        value={condition.value !== null && condition.value !== undefined ? String(condition.value) : ''}
                                        onChange={(e) => {
                                          const newConditions = [...policyFormData.conditionalConditions];
                                          let value = e.target.value;
                                          if (value === '') {
                                            value = null;
                                          } else {
                                            value = value === 'true';
                                          }
                                          newConditions[index] = { ...newConditions[index], value };
                                          setPolicyFormData({ ...policyFormData, conditionalConditions: newConditions });
                                        }}
                                        required={needsValue}
                                        options={[
                                          { value: '', label: 'Select value' },
                                          ...fieldMetadata.valueOptions
                                        ]}
                                      />
                                    );
                                  }
                                  
                                  // Regular input
                                  return (
                                    <Input
                                      label="Value"
                                      type={valueType === 'number' ? 'number' : valueType === 'date' ? 'date' : 'text'}
                                      value={
                                        condition.value !== null && condition.value !== undefined
                                          ? Array.isArray(condition.value)
                                            ? condition.value.join(', ')
                                            : String(condition.value)
                                          : ''
                                      }
                                      onChange={(e) => {
                                        const newConditions = [...policyFormData.conditionalConditions];
                                        let value = e.target.value;
                                        const fieldType = getFieldType(condition.fieldPath);
                                        
                                        if (fieldType === 'number') {
                                          value = value === '' ? null : Number(value);
                                        } else if (fieldType === 'boolean') {
                                          if (value === 'true' || value === '1') {
                                            value = true;
                                          } else if (value === 'false' || value === '0') {
                                            value = false;
                                          } else {
                                            value = value === '' ? null : value;
                                          }
                                        } else {
                                          if (condition.operator === 'in' || condition.operator === 'not_in') {
                                            // Keep as string for comma-separated values
                                            value = value === '' ? null : value;
                                          } else {
                                            value = value === '' ? null : value;
                                          }
                                        }
                                        
                                        newConditions[index] = { ...newConditions[index], value };
                                        setPolicyFormData({ ...policyFormData, conditionalConditions: newConditions });
                                      }}
                                      onBlur={(e) => {
                                        // Convert comma-separated string to array for in/not_in operators
                                        if (condition.operator === 'in' || condition.operator === 'not_in') {
                                          const newConditions = [...policyFormData.conditionalConditions];
                                          const value = e.target.value;
                                          if (value === '') {
                                            newConditions[index] = { ...newConditions[index], value: null };
                                          } else {
                                            const values = value.split(',').map(v => v.trim()).filter(v => v.length > 0);
                                            newConditions[index] = { ...newConditions[index], value: values.length > 0 ? values : null };
                                          }
                                          setPolicyFormData({ ...policyFormData, conditionalConditions: newConditions });
                                        }
                                      }}
                                      min={fieldMetadata?.validationRules?.min}
                                      max={fieldMetadata?.validationRules?.max}
                                      placeholder={
                                        !needsValue
                                          ? 'No value needed'
                                          : condition.operator === 'in' || condition.operator === 'not_in'
                                          ? 'Comma-separated values'
                                          : 'Enter value'
                                      }
                                      disabled={!needsValue}
                                    />
                                  );
                                })()}
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })
                    )}
                  </div>
                  
                  {policyFormData.conditionalConditions.length > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setPolicyFormData({
                          ...policyFormData,
                          conditionalConditions: [
                            ...policyFormData.conditionalConditions,
                            {
                              fieldPath: '',
                              operator: 'exists',
                              value: null,
                              displayOrder: policyFormData.conditionalConditions.length,
                            },
                          ],
                        });
                      }}
                    >
                      Add Condition
                    </Button>
                  )}
                  
                  <p className="text-xs text-gray-500 mt-2">
                    Define conditions that determine when this policy applies. All conditions must pass ({policyFormData.conditionalLogic}) for the policy to apply.
                  </p>
                </div>
              )}

              <Checkbox
                id="policyIsActive"
                label="Active"
                checked={policyFormData.isActive}
                onChange={(e) => setPolicyFormData({ ...policyFormData, isActive: e.target.checked })}
                helperText="Only active policies are evaluated"
              />
            </div>

            <div className="flex justify-end gap-3 pt-6 mt-6">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setShowPolicyModal(false);
                  setPolicyFormData({
                    name: '',
                    description: '',
                    scope: 'global',
                    isActive: true,
                    displayOrder: 0,
                    divisionIds: [],
                    companyIds: [],
                    targetingRules: null,
                  });
                  setEditingPolicy(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={savingPolicy}>
                {editingPolicy ? 'Update' : 'Create'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Policy Confirmation Modal */}
      {deletePolicyTarget && (
        <Modal
          isOpen={!!deletePolicyTarget}
          onClose={() => setDeletePolicyTarget(null)}
          title="Delete Policy"
        >
          <div className="space-y-4">
            <p className="text-gray-600">
              Are you sure you want to delete <strong>{deletePolicyTarget.name}</strong>?
            </p>
            <p className="text-sm text-gray-500">
              This action cannot be undone. All controls in this policy will also be deleted.
            </p>
            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="secondary"
                onClick={() => setDeletePolicyTarget(null)}
                disabled={deletingPolicy}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={confirmDeletePolicy}
                loading={deletingPolicy}
              >
                Delete
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
