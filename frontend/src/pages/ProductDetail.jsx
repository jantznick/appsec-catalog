import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { toast } from '../components/ui/Toast.jsx';
import { LoadingPage } from '../components/ui/Loading.jsx';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Input } from '../components/ui/Input.jsx';
import { Select } from '../components/ui/Select.jsx';
import { Textarea } from '../components/ui/Textarea.jsx';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table.jsx';
import { Modal } from '../components/ui/Modal.jsx';
import useAuthStore from '../store/authStore.js';

const OTHER_COMPONENT_VALUE = '__other__';

export function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin, user } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [savingMeta, setSavingMeta] = useState(false);
  const [addingMapping, setAddingMapping] = useState(false);
  const [creatingType, setCreatingType] = useState(false);
  const [showTypeSettingsModal, setShowTypeSettingsModal] = useState(false);
  const [showAddMappingModal, setShowAddMappingModal] = useState(false);
  const [showAddFlowModal, setShowAddFlowModal] = useState(false);
  const [showInlineMappingFlowFields, setShowInlineMappingFlowFields] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [removeMappingModalOpen, setRemoveMappingModalOpen] = useState(false);
  const [mappingToRemove, setMappingToRemove] = useState(null);
  const [removingMapping, setRemovingMapping] = useState(false);
  const [removeFlowModalOpen, setRemoveFlowModalOpen] = useState(false);
  const [flowToRemove, setFlowToRemove] = useState(null);
  const [removingFlow, setRemovingFlow] = useState(false);
  const [addingFlow, setAddingFlow] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [editingMappingId, setEditingMappingId] = useState(null);
  const [product, setProduct] = useState(null);
  const [availableApps, setAvailableApps] = useState([]);
  const [componentTypes, setComponentTypes] = useState([]);
  const [rowEdits, setRowEdits] = useState({});
  const [originalFormData, setOriginalFormData] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    owner: '',
    facing: '',
    status: 'active',
    lifecycleStage: '',
    businessCriticality: '',
    dataSensitivity: '',
    complianceNotes: '',
  });
  const [newMapping, setNewMapping] = useState({
    applicationId: '',
    componentTypeId: '',
    customComponentLabel: '',
    connectFromApplicationId: '',
    flowName: '',
    dataClassification: '',
    protocol: '',
    direction: 'unidirectional',
    notes: '',
  });
  const [newComponentType, setNewComponentType] = useState('');
  const [newFlow, setNewFlow] = useState({
    sourceApplicationId: '',
    targetApplicationId: '',
    flowName: '',
    dataClassification: '',
    protocol: '',
    direction: 'unidirectional',
    notes: '',
  });

  const syncForm = useCallback((nextProduct) => {
    const mapped = {
      name: nextProduct.name || '',
      description: nextProduct.description || '',
      owner: nextProduct.owner || '',
      facing: nextProduct.facing || '',
      status: nextProduct.status || 'active',
      lifecycleStage: nextProduct.lifecycleStage || '',
      businessCriticality: nextProduct.businessCriticality ?? '',
      dataSensitivity: nextProduct.dataSensitivity || '',
      complianceNotes: nextProduct.complianceNotes || '',
    };
    setFormData(mapped);
    setOriginalFormData(JSON.parse(JSON.stringify(mapped)));
    setHasUnsavedChanges(false);
  }, []);

  const loadProduct = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await api.getProduct(id);
      setProduct(data);
      syncForm(data);
    } catch (error) {
      toast.error(error.message || 'Failed to load product');
      navigate('/products');
    } finally {
      setLoading(false);
    }
  }, [id, navigate, syncForm]);

  const loadComponentTypes = useCallback(async (companyId) => {
    if (!companyId) return;
    try {
      const data = await api.getProductComponentTypes(companyId);
      setComponentTypes(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load product component types:', error);
    }
  }, []);

  const loadApps = useCallback(async (companyId) => {
    if (!companyId) return;
    try {
      const data = await api.getApplications();
      const sameCompanyApps = (Array.isArray(data) ? data : []).filter((app) => app.companyId === companyId);
      setAvailableApps(sameCompanyApps);
    } catch (error) {
      console.error('Failed to load applications:', error);
    }
  }, []);

  useEffect(() => {
    loadProduct();
  }, [loadProduct]);

  useEffect(() => {
    if (!product?.companyId) return;
    loadComponentTypes(product.companyId);
    loadApps(product.companyId);
  }, [product?.companyId, loadApps, loadComponentTypes]);

  const mappedAppIds = useMemo(
    () => new Set((product?.applications || []).map((item) => item.applicationId)),
    [product?.applications]
  );
  const mappedApps = useMemo(
    () =>
      (product?.applications || [])
        .map((item) => item.application)
        .filter(Boolean),
    [product?.applications]
  );
  const mappedAppOptions = useMemo(
    () => mappedApps.map((app) => ({ value: app.id, label: app.name })),
    [mappedApps]
  );
  const dataFlows = product?.dataFlows || [];

  const unmappedApps = useMemo(
    () => availableApps.filter((app) => !mappedAppIds.has(app.id)),
    [availableApps, mappedAppIds]
  );

  const componentTypeOptions = useMemo(
    () => [...componentTypes.map((type) => ({ value: type.id, label: type.name })), { value: OTHER_COMPONENT_VALUE, label: 'Other' }],
    [componentTypes]
  );
  const addMappingGridCols =
    newMapping.componentTypeId === OTHER_COMPONENT_VALUE
      ? 'grid-cols-1 md:grid-cols-3'
      : 'grid-cols-1 md:grid-cols-2';

  const reloadAll = async () => {
    await loadProduct();
  };

  const canEdit = () => {
    if (isAdmin()) return true;
    if (product && user?.companyId === product.companyId) return true;
    return false;
  };

  const handleEditClick = () => {
    if (!canEdit()) return;
    setIsEditing(true);
    setOriginalFormData(JSON.parse(JSON.stringify(formData)));
    setHasUnsavedChanges(false);
  };

  const handleFieldClick = (e) => {
    if (!canEdit() || isEditing) return;

    const clickedButton = e.target.closest('button:not([disabled])');
    const clickedLink = e.target.closest('a');
    if (clickedButton || clickedLink) return;

    handleEditClick();

    const input = e.target.closest('input, select, textarea');
    if (input) {
      setTimeout(() => {
        input.focus();
        if (input.type === 'text' || input.type === 'url' || input.tagName === 'TEXTAREA') {
          input.select();
        }
      }, 10);
    }
  };

  const handleFieldChange = (field, value) => {
    const next = { ...formData, [field]: value };
    setFormData(next);
    if (isEditing && originalFormData) {
      setHasUnsavedChanges(JSON.stringify(next) !== JSON.stringify(originalFormData));
    }
  };

  const handleCancel = () => {
    if (hasUnsavedChanges) {
      setShowCancelModal(true);
      return;
    }
    setIsEditing(false);
  };

  const discardChanges = () => {
    setShowCancelModal(false);
    setIsEditing(false);
    setHasUnsavedChanges(false);
    if (originalFormData) {
      setFormData(JSON.parse(JSON.stringify(originalFormData)));
    }
  };

  const handleSaveMetadata = async () => {
    if (!product) return;
    if (!formData.name.trim()) {
      toast.error('Product name is required');
      return;
    }

    try {
      setSavingMeta(true);
      const updated = await api.updateProduct(product.id, formData);
      setProduct((prev) => ({ ...prev, ...updated }));
      setIsEditing(false);
      setHasUnsavedChanges(false);
      setOriginalFormData(JSON.parse(JSON.stringify(formData)));
      toast.success('Product updated');
    } catch (error) {
      toast.error(error.message || 'Failed to update product');
    } finally {
      setSavingMeta(false);
    }
  };

  const handleCreateComponentType = async () => {
    if (!product?.companyId) return;
    if (!newComponentType.trim()) {
      toast.error('Component type name is required');
      return;
    }

    try {
      setCreatingType(true);
      await api.createProductComponentType({
        companyId: product.companyId,
        name: newComponentType.trim(),
      });
      setNewComponentType('');
      await loadComponentTypes(product.companyId);
      toast.success('Component type added');
    } catch (error) {
      toast.error(error.message || 'Failed to create component type');
    } finally {
      setCreatingType(false);
    }
  };

  const handleAddMapping = async () => {
    if (!product) return;
    if (!newMapping.applicationId) {
      toast.error('Please select an application');
      return false;
    }
    if (!newMapping.componentTypeId) {
      toast.error('Please select a component type');
      return false;
    }
    if (newMapping.componentTypeId === OTHER_COMPONENT_VALUE && !newMapping.customComponentLabel.trim()) {
      toast.error('Custom label is required when component type is Other');
      return false;
    }
    try {
      setAddingMapping(true);
      await api.addApplicationToProduct(product.id, {
        applicationId: newMapping.applicationId,
        componentTypeId:
          newMapping.componentTypeId === OTHER_COMPONENT_VALUE ? null : newMapping.componentTypeId,
        customComponentLabel:
          newMapping.componentTypeId === OTHER_COMPONENT_VALUE
            ? newMapping.customComponentLabel.trim()
            : null,
        ...(newMapping.connectFromApplicationId && {
          connectFromApplicationId: newMapping.connectFromApplicationId,
          flowName: newMapping.flowName,
          dataClassification: newMapping.dataClassification,
          protocol: newMapping.protocol,
          direction: newMapping.direction,
          notes: newMapping.notes,
        }),
      });
      setNewMapping({
        applicationId: '',
        componentTypeId: '',
        customComponentLabel: '',
        connectFromApplicationId: '',
        flowName: '',
        dataClassification: '',
        protocol: '',
        direction: 'unidirectional',
        notes: '',
      });
      setShowInlineMappingFlowFields(false);
      await reloadAll();
      toast.success('Application mapped to product');
      return true;
    } catch (error) {
      toast.error(error.message || 'Failed to add application mapping');
      return false;
    } finally {
      setAddingMapping(false);
    }
  };

  const setEditForRow = (applicationId, key, value) => {
    setRowEdits((prev) => ({
      ...prev,
      [applicationId]: {
        ...prev[applicationId],
        [key]: value,
      },
    }));
  };

  const getRowEdit = (mapping) => {
    const existing = rowEdits[mapping.applicationId];
    if (existing) return existing;
    return {
      componentTypeId: mapping.componentTypeId || (mapping.customComponentLabel ? OTHER_COMPONENT_VALUE : ''),
      customComponentLabel: mapping.customComponentLabel || '',
    };
  };

  const hasMappingChanges = (mapping, edit) => {
    const originalType = mapping.componentTypeId || (mapping.customComponentLabel ? OTHER_COMPONENT_VALUE : '');
    const originalCustom = mapping.customComponentLabel || '';
    return (
      originalType !== (edit.componentTypeId || '') ||
      originalCustom !== (edit.customComponentLabel || '')
    );
  };

  const handleSaveRow = async (mapping) => {
    const edit = getRowEdit(mapping);
    if (!edit.componentTypeId) {
      toast.error('Select a component type');
      return;
    }
    if (edit.componentTypeId === OTHER_COMPONENT_VALUE && !edit.customComponentLabel.trim()) {
      toast.error('Custom label is required when component type is Other');
      return;
    }

    try {
      await api.updateProductApplicationMapping(product.id, mapping.applicationId, {
        componentTypeId: edit.componentTypeId === OTHER_COMPONENT_VALUE ? null : edit.componentTypeId,
        customComponentLabel:
          edit.componentTypeId === OTHER_COMPONENT_VALUE ? edit.customComponentLabel.trim() : null,
      });
      await reloadAll();
      setEditingMappingId(null);
      toast.success('Mapping updated');
    } catch (error) {
      toast.error(error.message || 'Failed to update mapping');
    }
  };

  const openRemoveMappingModal = (mapping) => {
    setMappingToRemove(mapping);
    setRemoveMappingModalOpen(true);
  };

  const handleRemoveMapping = async () => {
    if (!mappingToRemove) return;
    setRemovingMapping(true);
    try {
      await api.removeApplicationFromProduct(product.id, mappingToRemove.applicationId);
      await reloadAll();
      setEditingMappingId(null);
      setRemoveMappingModalOpen(false);
      setMappingToRemove(null);
      toast.success('Application removed from product');
    } catch (error) {
      toast.error(error.message || 'Failed to remove application');
    } finally {
      setRemovingMapping(false);
    }
  };

  const handleDeleteProduct = async () => {
    if (!product || !isAdmin()) return;
    if (deleteConfirmText !== `delete ${product.name}`) return;

    setDeleting(true);
    try {
      await api.deleteProduct(product.id);
      toast.success(`Product "${product.name}" deleted successfully`);
      navigate('/products');
    } catch (error) {
      toast.error(error.message || 'Failed to delete product');
    } finally {
      setDeleting(false);
    }
  };

  const openRemoveFlowModal = (flow) => {
    setFlowToRemove(flow);
    setRemoveFlowModalOpen(true);
  };

  const handleAddFlow = async () => {
    if (!product) return false;
    if (!newFlow.sourceApplicationId || !newFlow.targetApplicationId) {
      toast.error('Source and target applications are required');
      return false;
    }
    if (newFlow.sourceApplicationId === newFlow.targetApplicationId) {
      toast.error('Source and target must be different applications');
      return false;
    }

    try {
      setAddingFlow(true);
      await api.createProductDataFlow(product.id, newFlow);
      await reloadAll();
      setNewFlow({
        sourceApplicationId: '',
        targetApplicationId: '',
        flowName: '',
        dataClassification: '',
        protocol: '',
        direction: 'unidirectional',
        notes: '',
      });
      toast.success('Data flow added');
      return true;
    } catch (error) {
      toast.error(error.message || 'Failed to add data flow');
      return false;
    } finally {
      setAddingFlow(false);
    }
  };

  const handleRemoveFlow = async () => {
    if (!product || !flowToRemove) return;
    try {
      setRemovingFlow(true);
      await api.deleteProductDataFlow(product.id, flowToRemove.id);
      await reloadAll();
      setFlowToRemove(null);
      setRemoveFlowModalOpen(false);
      toast.success('Data flow removed');
    } catch (error) {
      toast.error(error.message || 'Failed to remove data flow');
    } finally {
      setRemovingFlow(false);
    }
  };

  if (loading) {
    return <LoadingPage message="Loading product..." />;
  }

  if (!product) return null;

  return (
    <div className={isEditing ? 'pb-24' : ''}>
      <div className="mb-8">
        <button
          onClick={() => navigate('/products')}
          className="text-blue-600 hover:text-blue-700 mb-4"
        >
          ← Back to Products
        </button>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">{product.name}</h1>
            <p className="text-gray-600">Company: <Link to={`/companies/${product.company.id}`} className="text-blue-600 hover:text-blue-700">{product.company?.name || '—'}</Link></p>
          </div>
          <div className="flex items-center gap-3">
            {isAdmin() && (
              <Button variant="danger" onClick={() => setDeleteModalOpen(true)}>
                Delete Product
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Product Metadata</CardTitle>
              {!isEditing && canEdit() && (
                <span className="text-xs text-gray-500">Click any field to edit</span>
              )}
            </div>
          </CardHeader>
          <CardContent className="relative">
            {canEdit() && !isEditing && (
              <div
                onClick={handleFieldClick}
                className="absolute inset-0 z-10 cursor-pointer"
                style={{ backgroundColor: 'transparent' }}
              />
            )}
            {isEditing ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Name"
                    value={formData.name}
                    onChange={(e) => handleFieldChange('name', e.target.value)}
                    required
                  />
                  <Input
                    label="Owner"
                    value={formData.owner}
                    onChange={(e) => handleFieldChange('owner', e.target.value)}
                  />
                  <Select
                    label="Facing"
                    value={formData.facing}
                    onChange={(e) => handleFieldChange('facing', e.target.value)}
                    options={[
                      { value: 'Internal', label: 'Internal' },
                      { value: 'External', label: 'External' },
                      { value: 'Both', label: 'Both' },
                    ]}
                    placeholder="Select facing"
                  />
                  <Select
                    label="Status"
                    value={formData.status}
                    onChange={(e) => handleFieldChange('status', e.target.value)}
                    options={[
                      { value: 'active', label: 'Active' },
                      { value: 'planned', label: 'Planned' },
                      { value: 'retired', label: 'Retired' },
                    ]}
                  />
                  <Input
                    label="Lifecycle Stage"
                    value={formData.lifecycleStage}
                    onChange={(e) => handleFieldChange('lifecycleStage', e.target.value)}
                  />
                  <Input
                    label="Business Criticality (1-5)"
                    type="number"
                    min="1"
                    max="5"
                    value={formData.businessCriticality}
                    onChange={(e) => handleFieldChange('businessCriticality', e.target.value)}
                  />
                  <Input
                    label="Data Sensitivity"
                    value={formData.dataSensitivity}
                    onChange={(e) => handleFieldChange('dataSensitivity', e.target.value)}
                  />
                </div>
                <div className="mt-4">
                  <Textarea
                    label="Description"
                    value={formData.description}
                    onChange={(e) => handleFieldChange('description', e.target.value)}
                    rows={3}
                  />
                </div>
                <div className="mt-4">
                  <Textarea
                    label="Compliance Notes"
                    value={formData.complianceNotes}
                    onChange={(e) => handleFieldChange('complianceNotes', e.target.value)}
                    rows={3}
                  />
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Name</label>
                    <p className="text-base text-gray-900 font-medium">{formData.name || <span className="text-gray-400 italic">Not set</span>}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Owner</label>
                    <p className="text-sm text-gray-900">{formData.owner || <span className="text-gray-400 italic">Not set</span>}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Facing</label>
                    <p className="text-sm text-gray-900">{formData.facing || <span className="text-gray-400 italic">Not set</span>}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Status</label>
                    <p className="text-sm text-gray-900">{formData.status || <span className="text-gray-400 italic">Not set</span>}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Lifecycle Stage</label>
                    <p className="text-sm text-gray-900">{formData.lifecycleStage || <span className="text-gray-400 italic">Not set</span>}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Business Criticality</label>
                    <p className="text-sm text-gray-900">{formData.businessCriticality ? `${formData.businessCriticality}/5` : <span className="text-gray-400 italic">Not set</span>}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Data Sensitivity</label>
                    <p className="text-sm text-gray-900">{formData.dataSensitivity || <span className="text-gray-400 italic">Not set</span>}</p>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Description</label>
                  <p className="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed">
                    {formData.description || <span className="text-gray-400 italic">Not set</span>}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Compliance Notes</label>
                  <p className="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed">
                    {formData.complianceNotes || <span className="text-gray-400 italic">Not set</span>}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Application Mappings</CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowTypeSettingsModal(true)}
                  className="whitespace-nowrap"
                >
                  Component Type Settings
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setShowAddMappingModal(true)}
                  className="whitespace-nowrap"
                >
                  Add Application Mapping
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {product.applications.length === 0 ? (
              <p className="text-sm text-gray-500">No applications mapped yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Application</TableHead>
                    <TableHead>Component Type</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {product.applications.map((mapping) => {
                    const edit = getRowEdit(mapping);
                    const isRowEditing = editingMappingId === mapping.applicationId;
                    const typeName = componentTypes.find((t) => t.id === mapping.componentTypeId)?.name;
                    const displayType = typeName || `Other: ${mapping.customComponentLabel || 'Custom'}`;
                    return (
                      <TableRow
                        key={`${mapping.productId}-${mapping.applicationId}`}
                        onClick={() => {
                          if (!isRowEditing) setEditingMappingId(mapping.applicationId);
                        }}
                      >
                        <TableCell className="font-medium">
                          {mapping.application?.id ? (
                            <Link
                              to={`/applications/${mapping.application.id}`}
                              className="text-blue-600 hover:text-blue-700"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {mapping.application?.name || mapping.applicationId}
                            </Link>
                          ) : (
                            mapping.application?.name || mapping.applicationId
                          )}
                        </TableCell>
                        <TableCell>
                          {isRowEditing ? (
                            <div className="flex flex-col gap-2">
                              <Select
                                value={edit.componentTypeId || ''}
                                onChange={(e) =>
                                  setEditForRow(mapping.applicationId, 'componentTypeId', e.target.value)
                                }
                                options={componentTypeOptions}
                                placeholder="Select type"
                              />
                              {edit.componentTypeId === OTHER_COMPONENT_VALUE && (
                                <Input
                                  value={edit.customComponentLabel || ''}
                                  onChange={(e) =>
                                    setEditForRow(mapping.applicationId, 'customComponentLabel', e.target.value)
                                  }
                                  placeholder="Custom label"
                                />
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-800 border border-blue-100">
                              {displayType}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {isRowEditing ? (
                              <>
                                <Button
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSaveRow(mapping);
                                  }}
                                  disabled={!hasMappingChanges(mapping, edit)}
                                >
                                  Save
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingMappingId(null);
                                  }}
                                >
                                  Cancel
                                </Button>
                              </>
                            ) : (
                              null
                            )}
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={(e) => {
                                e.stopPropagation();
                                openRemoveMappingModal(mapping);
                              }}
                            >
                              Remove
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Data Flows</CardTitle>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowAddFlowModal(true)}
                className="whitespace-nowrap"
                disabled={mappedApps.length < 2}
              >
                Add Data Flow
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {mappedApps.length < 2 ? (
              <p className="text-sm text-gray-500">
                Add at least two application mappings before defining data flows.
              </p>
            ) : dataFlows.length === 0 ? (
              <p className="text-sm text-gray-500">No data flows defined yet.</p>
            ) : (
              <>
                <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                  {dataFlows.map((flow) => (
                    <div key={flow.id} className="rounded-lg border border-gray-200 p-3 bg-gray-50">
                      <div className="text-sm font-medium text-gray-900">
                        {flow.sourceApplication?.name || 'Unknown'} {' '}
                        {flow.direction === 'bidirectional' ? '<->' : '->'}{' '}
                        {flow.targetApplication?.name || 'Unknown'}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        {(flow.flowName || 'Unnamed flow')}
                        {flow.dataClassification ? ` | ${flow.dataClassification}` : ''}
                        {flow.protocol ? ` | ${flow.protocol}` : ''}
                        {flow.direction ? ` | ${flow.direction}` : ''}
                      </div>
                    </div>
                  ))}
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Source</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead>Flow</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Protocol</TableHead>
                      <TableHead>Direction</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dataFlows.map((flow) => (
                      <TableRow key={flow.id}>
                        <TableCell className="font-medium">{flow.sourceApplication?.name || '—'}</TableCell>
                        <TableCell className="font-medium">{flow.targetApplication?.name || '—'}</TableCell>
                        <TableCell>{flow.flowName || '—'}</TableCell>
                        <TableCell>{flow.dataClassification || '—'}</TableCell>
                        <TableCell>{flow.protocol || '—'}</TableCell>
                        <TableCell>{flow.direction || '—'}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => openRemoveFlowModal(flow)}
                          >
                            Remove
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {isEditing && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {hasUnsavedChanges ? (
                  <div className="flex items-center gap-2 text-sm text-amber-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>You have unsaved changes</span>
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">No changes made</div>
                )}
              </div>
              <div className="flex gap-3">
                <Button variant="secondary" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button onClick={handleSaveMetadata} loading={savingMeta} disabled={!hasUnsavedChanges}>
                  Save Changes
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Modal
        isOpen={removeFlowModalOpen}
        onClose={() => {
          if (!removingFlow) {
            setRemoveFlowModalOpen(false);
            setFlowToRemove(null);
          }
        }}
        title="Remove Data Flow"
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setRemoveFlowModalOpen(false);
                setFlowToRemove(null);
              }}
              disabled={removingFlow}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleRemoveFlow}
              loading={removingFlow}
              disabled={removingFlow}
            >
              Remove
            </Button>
          </>
        }
      >
        <div className="space-y-2 text-sm text-gray-700">
          <p>
            Remove this flow:
            {' '}
            <strong>
              {flowToRemove?.sourceApplication?.name || 'Unknown'}
              {' '}
              {flowToRemove?.direction === 'bidirectional' ? '<->' : '->'}
              {' '}
              {flowToRemove?.targetApplication?.name || 'Unknown'}
            </strong>
            ?
          </p>
          <p className="text-xs text-gray-500">This removes only the flow record.</p>
        </div>
      </Modal>

      <Modal
        isOpen={showAddFlowModal}
        onClose={() => {
          if (!addingFlow) {
            setShowAddFlowModal(false);
            setNewFlow({
              sourceApplicationId: '',
              targetApplicationId: '',
              flowName: '',
              dataClassification: '',
              protocol: '',
              direction: 'unidirectional',
              notes: '',
            });
          }
        }}
        title="Add Data Flow"
        size="xl"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setShowAddFlowModal(false);
                setNewFlow({
                  sourceApplicationId: '',
                  targetApplicationId: '',
                  flowName: '',
                  dataClassification: '',
                  protocol: '',
                  direction: 'unidirectional',
                  notes: '',
                });
              }}
              disabled={addingFlow}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                const success = await handleAddFlow();
                if (success) {
                  setShowAddFlowModal(false);
                }
              }}
              loading={addingFlow}
            >
              Add Flow
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Select
            label="Source Application"
            value={newFlow.sourceApplicationId}
            onChange={(e) => setNewFlow((prev) => ({ ...prev, sourceApplicationId: e.target.value }))}
            options={mappedAppOptions}
            placeholder="Select source"
          />
          <Select
            label="Target Application"
            value={newFlow.targetApplicationId}
            onChange={(e) => setNewFlow((prev) => ({ ...prev, targetApplicationId: e.target.value }))}
            options={mappedAppOptions}
            placeholder="Select target"
          />
          <Input
            label="Flow Name"
            value={newFlow.flowName}
            onChange={(e) => setNewFlow((prev) => ({ ...prev, flowName: e.target.value }))}
            placeholder="e.g. User Profile Sync"
          />
          <Input
            label="Data Classification"
            value={newFlow.dataClassification}
            onChange={(e) => setNewFlow((prev) => ({ ...prev, dataClassification: e.target.value }))}
            placeholder="e.g. PII, Internal"
          />
          <Input
            label="Protocol"
            value={newFlow.protocol}
            onChange={(e) => setNewFlow((prev) => ({ ...prev, protocol: e.target.value }))}
            placeholder="e.g. REST, Kafka"
          />
          <Select
            label="Direction"
            value={newFlow.direction}
            onChange={(e) => setNewFlow((prev) => ({ ...prev, direction: e.target.value }))}
            options={[
              { value: 'unidirectional', label: 'Unidirectional' },
              { value: 'bidirectional', label: 'Bidirectional' },
            ]}
          />
        </div>
        <div className="mt-3">
          <Textarea
            label="Flow Notes"
            value={newFlow.notes}
            onChange={(e) => setNewFlow((prev) => ({ ...prev, notes: e.target.value }))}
            rows={2}
            placeholder="Optional flow context"
          />
        </div>
      </Modal>

      <Modal
        isOpen={showAddMappingModal}
        onClose={() => {
          if (!addingMapping) {
            setShowAddMappingModal(false);
            setShowInlineMappingFlowFields(false);
            setNewMapping({
              applicationId: '',
              componentTypeId: '',
              customComponentLabel: '',
              connectFromApplicationId: '',
              flowName: '',
              dataClassification: '',
              protocol: '',
              direction: 'unidirectional',
              notes: '',
            });
          }
        }}
        title="Add Application Mapping"
        size="xl"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setShowAddMappingModal(false);
                setShowInlineMappingFlowFields(false);
                setNewMapping({
                  applicationId: '',
                  componentTypeId: '',
                  customComponentLabel: '',
                  connectFromApplicationId: '',
                  flowName: '',
                  dataClassification: '',
                  protocol: '',
                  direction: 'unidirectional',
                  notes: '',
                });
              }}
              disabled={addingMapping}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                const success = await handleAddMapping();
                if (success) {
                  setShowAddMappingModal(false);
                }
              }}
              loading={addingMapping}
            >
              Add Mapping
            </Button>
          </>
        }
      >
        <div className={`grid ${addMappingGridCols} gap-3`}>
          <Select
            label="Application"
            value={newMapping.applicationId}
            onChange={(e) => setNewMapping((prev) => ({ ...prev, applicationId: e.target.value }))}
            options={unmappedApps.map((app) => ({ value: app.id, label: app.name }))}
            placeholder="Select application"
          />
          <Select
            label="Component Type"
            value={newMapping.componentTypeId}
            onChange={(e) =>
              setNewMapping((prev) => ({
                ...prev,
                componentTypeId: e.target.value,
                customComponentLabel:
                  e.target.value === OTHER_COMPONENT_VALUE ? prev.customComponentLabel : '',
              }))
            }
            options={componentTypeOptions}
            placeholder="Select type"
          />
          {newMapping.componentTypeId === OTHER_COMPONENT_VALUE ? (
            <Input
              label="Custom Label"
              value={newMapping.customComponentLabel}
              onChange={(e) =>
                setNewMapping((prev) => ({ ...prev, customComponentLabel: e.target.value }))
              }
              placeholder="Enter custom component label"
            />
          ) : null}
        </div>
        {mappedApps.length > 0 && (
          <div className="mt-4 border-t border-gray-200 pt-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-gray-800">Optional Data Flow</p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setShowInlineMappingFlowFields((prev) => !prev)}
              >
                {showInlineMappingFlowFields ? 'Hide Flow Fields' : 'Add Flow to This Mapping'}
              </Button>
            </div>
            {showInlineMappingFlowFields && (
              <>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Select
                    label="Connect From Existing Application"
                    value={newMapping.connectFromApplicationId}
                    onChange={(e) => setNewMapping((prev) => ({ ...prev, connectFromApplicationId: e.target.value }))}
                    options={mappedAppOptions}
                    placeholder="Select existing app"
                  />
                  <Select
                    label="Direction"
                    value={newMapping.direction}
                    onChange={(e) => setNewMapping((prev) => ({ ...prev, direction: e.target.value }))}
                    options={[
                      { value: 'unidirectional', label: 'Unidirectional' },
                      { value: 'bidirectional', label: 'Bidirectional' },
                    ]}
                  />
                  <Input
                    label="Flow Name"
                    value={newMapping.flowName}
                    onChange={(e) => setNewMapping((prev) => ({ ...prev, flowName: e.target.value }))}
                    placeholder="e.g. User Profile Sync"
                  />
                  <Input
                    label="Data Classification"
                    value={newMapping.dataClassification}
                    onChange={(e) => setNewMapping((prev) => ({ ...prev, dataClassification: e.target.value }))}
                    placeholder="e.g. PII, Internal"
                  />
                  <Input
                    label="Protocol"
                    value={newMapping.protocol}
                    onChange={(e) => setNewMapping((prev) => ({ ...prev, protocol: e.target.value }))}
                    placeholder="e.g. REST, Kafka"
                  />
                </div>
                <div className="mt-3">
                  <Textarea
                    label="Flow Notes"
                    value={newMapping.notes}
                    onChange={(e) => setNewMapping((prev) => ({ ...prev, notes: e.target.value }))}
                    rows={2}
                    placeholder="Optional flow context"
                  />
                </div>
              </>
            )}
          </div>
        )}
      </Modal>

      <Modal
        isOpen={removeMappingModalOpen}
        onClose={() => {
          if (!removingMapping) {
            setRemoveMappingModalOpen(false);
            setMappingToRemove(null);
          }
        }}
        title="Remove Application Mapping"
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setRemoveMappingModalOpen(false);
                setMappingToRemove(null);
              }}
              disabled={removingMapping}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleRemoveMapping}
              loading={removingMapping}
              disabled={removingMapping}
            >
              Remove
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-700">
            Remove <strong>{mappingToRemove?.application?.name || 'this application'}</strong> from this product?
          </p>
          <p className="text-xs text-gray-500">
            This only removes the mapping, not the application itself.
          </p>
        </div>
      </Modal>

      <Modal
        isOpen={showTypeSettingsModal}
        onClose={() => setShowTypeSettingsModal(false)}
        title="Component Type Settings"
      >
        <div className="space-y-4">
          <div className="flex gap-3">
            <Input
              value={newComponentType}
              onChange={(e) => setNewComponentType(e.target.value)}
              placeholder="Create custom type (e.g. Shared Service)"
            />
            <Button
              onClick={handleCreateComponentType}
              loading={creatingType}
              className="whitespace-nowrap min-w-[110px]"
            >
              Add Type
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {componentTypes.map((type) => (
              <span
                key={type.id}
                className={`px-2 py-1 rounded text-xs ${
                  type.isDefault ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                }`}
              >
                {type.name}
              </span>
            ))}
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        title="Discard changes?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCancelModal(false)}>
              Keep editing
            </Button>
            <Button variant="danger" onClick={discardChanges}>
              Discard
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          You have unsaved changes. If you leave edit mode now, your changes will be lost.
        </p>
      </Modal>

      <Modal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setDeleteConfirmText('');
        }}
        title="Delete Product"
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setDeleteModalOpen(false);
                setDeleteConfirmText('');
              }}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteProduct}
              disabled={deleteConfirmText !== `delete ${product?.name || ''}` || deleting}
              loading={deleting}
            >
              Delete
            </Button>
          </>
        }
      >
        {product && (
          <div className="space-y-4">
            <p className="text-gray-700">
              Are you sure you want to delete <strong>{product.name}</strong>?
            </p>
            <p className="text-sm text-red-600">
              This action cannot be undone. All data associated with this product will be permanently deleted.
            </p>
            <div className="mt-4">
              <Input
                label={`Type "delete ${product.name}" to confirm`}
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={`delete ${product.name}`}
                className="font-mono"
              />
              <p className="text-xs text-gray-500 mt-1">
                You must type the exact text above to confirm deletion
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
