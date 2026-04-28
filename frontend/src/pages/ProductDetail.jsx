import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { toast } from '../components/ui/Toast.jsx';
import { LoadingPage } from '../components/ui/Loading.jsx';
import { api } from '../lib/api.js';
import useAuthStore from '../store/authStore.js';
import { ApplicationMappingsCard } from '../components/product-detail/ApplicationMappingsCard.jsx';
import { DataFlowsCard } from '../components/product-detail/DataFlowsCard.jsx';
import { ProductDetailHeader } from '../components/product-detail/ProductDetailHeader.jsx';
import { ProductDetailModals } from '../components/product-detail/ProductDetailModals.jsx';
import { ProductDetailStickyBar } from '../components/product-detail/ProductDetailStickyBar.jsx';
import { ProductMetadataCard } from '../components/product-detail/ProductMetadataCard.jsx';

const OTHER_COMPONENT_VALUE = '__other__';
const INGRESS_LIKE_TYPE_MATCHERS = ['frontend', 'gateway', 'mobile'];
const APP_SOURCE_RULES = [
  {
    targetMatchers: ['backend api', 'internal api'],
    sourceMatchers: ['frontend', 'gateway'],
  },
  {
    targetMatchers: ['worker', 'job', 'data store', 'datastore'],
    sourceMatchers: ['backend api', 'internal api', 'gateway'],
  },
];

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
  const [removingIngressId, setRemovingIngressId] = useState(null);
  const [editFlowModalOpen, setEditFlowModalOpen] = useState(false);
  const [flowToEdit, setFlowToEdit] = useState(null);
  const [updatingFlow, setUpdatingFlow] = useState(false);
  const [addingFlow, setAddingFlow] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [editingMappingId, setEditingMappingId] = useState(null);
  const [product, setProduct] = useState(null);
  const [productScore, setProductScore] = useState(null);
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
    markAsIngress: false,
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
    requiresApiKey: false,
    notes: '',
    markSourceAsIngress: false,
    ingressChannel: '',
  });
  const [editFlowForm, setEditFlowForm] = useState({
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
      const [data, scoreData] = await Promise.all([
        api.getProduct(id),
        api.getProductScore(id).catch(() => null),
      ]);
      setProduct(data);
      setProductScore(scoreData);
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
      const sameCompanyApps = (Array.isArray(data) ? data : []).filter(
        (app) => app.companyId === companyId
      );
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
    () => (product?.applications || []).map((item) => item.application).filter(Boolean),
    [product?.applications]
  );
  const appTypeById = useMemo(() => {
    const map = {};
    (product?.applications || []).forEach((item) => {
      if (!item?.applicationId) return;
      map[item.applicationId] = item.componentType?.name || item.customComponentLabel || '';
    });
    return map;
  }, [product?.applications]);
  const mappedAppOptions = useMemo(
    () => mappedApps.map((app) => ({ value: app.id, label: app.name })),
    [mappedApps]
  );
  const appMetricsByApplicationId = useMemo(() => {
    const map = {};
    for (const row of productScore?.applications ?? []) {
      map[row.applicationId] = {
        totalScore: row.totalScore,
        policyCompliancePercent: row.policyCompliancePercent,
      };
    }
    return map;
  }, [productScore]);
  const dataFlows = product?.dataFlows || [];
  const ingressPoints = product?.ingressPoints || [];
  const selectedFlowApiKeyApplicationId = newFlow.markSourceAsIngress
    ? newFlow.sourceApplicationId
    : newFlow.targetApplicationId;
  const showApiKeyCheckbox = useMemo(() => {
    const typeName = String(appTypeById[selectedFlowApiKeyApplicationId] || '').toLowerCase();
    return typeName.includes('backend api') || typeName.includes('internal api') || typeName.includes('api');
  }, [appTypeById, selectedFlowApiKeyApplicationId]);

  const unmappedApps = useMemo(
    () => availableApps.filter((app) => !mappedAppIds.has(app.id)),
    [availableApps, mappedAppIds]
  );

  const componentTypeOptions = useMemo(
    () => [
      ...componentTypes.map((type) => ({ value: type.id, label: type.name })),
      { value: OTHER_COMPONENT_VALUE, label: 'Other' },
    ],
    [componentTypes]
  );
  const addMappingGridCols =
    newMapping.componentTypeId === OTHER_COMPONENT_VALUE
      ? 'grid-cols-1 md:grid-cols-3'
      : 'grid-cols-1 md:grid-cols-2';

  const getTypeNameFromMapping = useCallback(
    (mapping) =>
      (
        mapping?.componentType?.name ||
        componentTypes.find((type) => type.id === mapping?.componentTypeId)?.name ||
        mapping?.customComponentLabel ||
        ''
      ).toLowerCase(),
    [componentTypes]
  );

  const getSelectedTypeName = useMemo(() => {
    if (newMapping.componentTypeId === OTHER_COMPONENT_VALUE) {
      return (newMapping.customComponentLabel || '').toLowerCase();
    }
    return (
      componentTypes.find((type) => type.id === newMapping.componentTypeId)?.name || ''
    ).toLowerCase();
  }, [componentTypes, newMapping.componentTypeId, newMapping.customComponentLabel]);

  const likelyIngressType = useMemo(
    () => INGRESS_LIKE_TYPE_MATCHERS.some((matcher) => getSelectedTypeName.includes(matcher)),
    [getSelectedTypeName]
  );

  const suggestSourceApplicationId = useCallback(
    (targetTypeName) => {
      if (!targetTypeName || !product?.applications?.length) return '';
      for (const rule of APP_SOURCE_RULES) {
        const matchesTarget = rule.targetMatchers.some((matcher) =>
          targetTypeName.includes(matcher)
        );
        if (!matchesTarget) continue;
        const candidate = product.applications.find((mapping) => {
          const typeName = getTypeNameFromMapping(mapping);
          return rule.sourceMatchers.some((matcher) => typeName.includes(matcher));
        });
        if (candidate?.applicationId) return candidate.applicationId;
      }
      return '';
    },
    [getTypeNameFromMapping, product?.applications]
  );

  const handleNewMappingComponentTypeChange = useCallback(
    (selectedTypeValue) => {
      setNewMapping((prev) => {
        const next = {
          ...prev,
          componentTypeId: selectedTypeValue,
          customComponentLabel:
            selectedTypeValue === OTHER_COMPONENT_VALUE ? prev.customComponentLabel : '',
        };

        const resolvedTypeName =
          selectedTypeValue === OTHER_COMPONENT_VALUE
            ? next.customComponentLabel.toLowerCase()
            : (componentTypes.find((type) => type.id === selectedTypeValue)?.name || '').toLowerCase();

        const isIngress = INGRESS_LIKE_TYPE_MATCHERS.some((matcher) =>
          resolvedTypeName.includes(matcher)
        );
        if (isIngress) {
          next.markAsIngress = true;
        }

        if (!next.connectFromApplicationId && mappedApps.length > 0) {
          const suggestedSource = suggestSourceApplicationId(resolvedTypeName);
          if (suggestedSource) {
            next.connectFromApplicationId = suggestedSource;
            setShowInlineMappingFlowFields(true);
          }
        }

        return next;
      });
    },
    [componentTypes, mappedApps.length, suggestSourceApplicationId]
  );

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
    if (!product) return false;
    if (!newMapping.applicationId) {
      toast.error('Please select an application');
      return false;
    }
    if (!newMapping.componentTypeId) {
      toast.error('Please select a component type');
      return false;
    }
    if (
      newMapping.componentTypeId === OTHER_COMPONENT_VALUE &&
      !newMapping.customComponentLabel.trim()
    ) {
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
        markAsIngress: Boolean(newMapping.markAsIngress),
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
        markAsIngress: false,
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
      componentTypeId:
        mapping.componentTypeId || (mapping.customComponentLabel ? OTHER_COMPONENT_VALUE : ''),
      customComponentLabel: mapping.customComponentLabel || '',
    };
  };

  const hasMappingChanges = (mapping, edit) => {
    const originalType =
      mapping.componentTypeId || (mapping.customComponentLabel ? OTHER_COMPONENT_VALUE : '');
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

  const openEditFlowModal = (flowId) => {
    const flow = dataFlows.find((item) => item.id === flowId);
    if (!flow) return;
    setFlowToEdit(flow);
    setEditFlowForm({
      sourceApplicationId: flow.sourceApplicationId || '',
      targetApplicationId: flow.targetApplicationId || '',
      flowName: flow.flowName || '',
      dataClassification: flow.dataClassification || '',
      protocol: flow.protocol || '',
      direction: flow.direction || 'unidirectional',
      notes: flow.notes || '',
    });
    setEditFlowModalOpen(true);
  };

  const handleAddFlow = async () => {
    if (!product) return false;
    if (!newFlow.sourceApplicationId) {
      toast.error('Source application is required');
      return false;
    }
    const hasTarget = Boolean(newFlow.targetApplicationId);
    if (hasTarget && newFlow.sourceApplicationId === newFlow.targetApplicationId) {
      toast.error('Source and target must be different applications');
      return false;
    }
    if (!hasTarget && !newFlow.markSourceAsIngress) {
      toast.error('Select a target application or mark source as ingress');
      return false;
    }

    try {
      setAddingFlow(true);
      if (hasTarget) {
        await api.createProductDataFlow(product.id, newFlow);
      }
      if (newFlow.markSourceAsIngress && newFlow.sourceApplicationId) {
        await api.createProductIngressPoint(product.id, {
          applicationId: newFlow.sourceApplicationId,
          channel: newFlow.ingressChannel?.trim() || 'default',
          requiresApiKey: Boolean(newFlow.requiresApiKey),
        });
      }
      await reloadAll();
      setNewFlow({
        sourceApplicationId: '',
        targetApplicationId: '',
        flowName: '',
        dataClassification: '',
        protocol: '',
        direction: 'unidirectional',
        requiresApiKey: false,
        notes: '',
        markSourceAsIngress: false,
        ingressChannel: '',
      });
      if (hasTarget && newFlow.markSourceAsIngress) {
        toast.success('Data flow and ingress point added');
      } else if (hasTarget) {
        toast.success('Data flow added');
      } else {
        toast.success('Ingress point added');
      }
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

  const handleUpdateFlow = async () => {
    if (!product || !flowToEdit) return false;
    if (!editFlowForm.sourceApplicationId || !editFlowForm.targetApplicationId) {
      toast.error('Source and target applications are required');
      return false;
    }
    if (editFlowForm.sourceApplicationId === editFlowForm.targetApplicationId) {
      toast.error('Source and target must be different applications');
      return false;
    }

    try {
      setUpdatingFlow(true);
      await api.updateProductDataFlow(product.id, flowToEdit.id, editFlowForm);
      await reloadAll();
      setEditFlowModalOpen(false);
      setFlowToEdit(null);
      toast.success('Data flow updated');
      return true;
    } catch (error) {
      toast.error(error.message || 'Failed to update data flow');
      return false;
    } finally {
      setUpdatingFlow(false);
    }
  };

  const handleRemoveIngressPoint = async (ingressId) => {
    if (!product || !ingressId) return false;
    try {
      setRemovingIngressId(ingressId);
      await api.deleteProductIngressPoint(product.id, ingressId);
      await reloadAll();
      toast.success('Ingress point removed');
      return true;
    } catch (error) {
      toast.error(error.message || 'Failed to remove ingress point');
      return false;
    } finally {
      setRemovingIngressId(null);
    }
  };

  useEffect(() => {
    if (showApiKeyCheckbox) return;
    if (!newFlow.requiresApiKey) return;
    setNewFlow((prev) => ({ ...prev, requiresApiKey: false }));
  }, [newFlow.requiresApiKey, showApiKeyCheckbox]);

  if (loading) {
    return <LoadingPage message="Loading product..." />;
  }

  if (!product) return null;

  const getScoreColor = (score) => {
    if (score >= 76) return 'text-green-600';
    if (score >= 51) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBgColor = (score) => {
    if (score >= 76) return 'bg-green-100';
    if (score >= 51) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  return (
    <div className={isEditing ? 'pb-24' : ''}>
      <ProductDetailHeader
        product={product}
        onBack={() => navigate('/products')}
        isAdmin={isAdmin()}
        onDelete={() => setDeleteModalOpen(true)}
      />

      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {productScore ? (
            <div className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-lg p-5 border-2 border-gray-200 shadow-sm lg:col-span-1">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs text-gray-600">Product Security Score</div>
                  <div className={`text-5xl font-bold ${getScoreColor(productScore.avgTotalScore)} mt-1`}>
                    {productScore.avgTotalScore}
                  </div>
                  <div className="text-sm text-gray-600">average of mapped application scores</div>
                  <div className="mt-2">
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getScoreBgColor(productScore.avgTotalScore)} ${getScoreColor(productScore.avgTotalScore)}`}>
                      {productScore.avgTotalScore >= 76 ? 'Excellent' : productScore.avgTotalScore >= 51 ? 'Good' : 'Needs Improvement'}
                    </span>
                  </div>
                  {productScore.avgPolicyCompliancePercent != null && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="text-xs text-gray-600">Average policy compliance</div>
                      <div className={`text-2xl font-semibold ${getScoreColor(productScore.avgPolicyCompliancePercent)} mt-0.5`}>
                        {productScore.avgPolicyCompliancePercent}%
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Mean of each mapped app&apos;s compliance with applicable controls
                      </div>
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-600">Apps included</div>
                  <a
                    href="#product-applications"
                    className="inline-block text-2xl font-bold text-blue-700 hover:text-blue-800 mt-1"
                    title="Jump to application mappings"
                  >
                    {productScore.applicationCount}
                  </a>
                  {productScore.calculatedAt && (
                    <div className="text-xs text-gray-600 mt-3">
                      Updated {new Date(productScore.calculatedAt).toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-lg p-5 border-2 border-gray-200 shadow-sm lg:col-span-1">
              <div className="text-xs text-gray-600">Product Security Score</div>
              <div className="text-sm text-gray-600 mt-1">No applications mapped yet.</div>
            </div>
          )}

          <div className="lg:col-span-2">
            <ProductMetadataCard
              isEditing={isEditing}
              canEdit={canEdit()}
              handleFieldClick={handleFieldClick}
              formData={formData}
              handleFieldChange={handleFieldChange}
            />
          </div>
        </div>

        <div id="product-applications">
          <ApplicationMappingsCard
            product={product}
            appMetricsByApplicationId={appMetricsByApplicationId}
            componentTypes={componentTypes}
            componentTypeOptions={componentTypeOptions}
            editingMappingId={editingMappingId}
            setEditingMappingId={setEditingMappingId}
            getRowEdit={getRowEdit}
            setEditForRow={setEditForRow}
            hasMappingChanges={hasMappingChanges}
            handleSaveRow={handleSaveRow}
            openRemoveMappingModal={openRemoveMappingModal}
            setShowTypeSettingsModal={setShowTypeSettingsModal}
            setShowAddMappingModal={setShowAddMappingModal}
            otherComponentValue={OTHER_COMPONENT_VALUE}
          />
        </div>

        <DataFlowsCard
          mappedApps={mappedApps}
          appTypeById={appTypeById}
          dataFlows={dataFlows}
          ingressPoints={ingressPoints}
          handleRemoveIngressPoint={handleRemoveIngressPoint}
          removingIngressId={removingIngressId}
          setShowAddFlowModal={setShowAddFlowModal}
          openRemoveFlowModal={openRemoveFlowModal}
          openEditFlowModal={openEditFlowModal}
        />
      </div>

      {isEditing && (
        <ProductDetailStickyBar
          hasUnsavedChanges={hasUnsavedChanges}
          handleCancel={handleCancel}
          handleSaveMetadata={handleSaveMetadata}
          savingMeta={savingMeta}
        />
      )}

      <ProductDetailModals
        product={product}
        removeFlowModalOpen={removeFlowModalOpen}
        setRemoveFlowModalOpen={setRemoveFlowModalOpen}
        removingFlow={removingFlow}
        flowToRemove={flowToRemove}
        setFlowToRemove={setFlowToRemove}
        handleRemoveFlow={handleRemoveFlow}
        editFlowModalOpen={editFlowModalOpen}
        setEditFlowModalOpen={setEditFlowModalOpen}
        flowToEdit={flowToEdit}
        setFlowToEdit={setFlowToEdit}
        editFlowForm={editFlowForm}
        setEditFlowForm={setEditFlowForm}
        handleUpdateFlow={handleUpdateFlow}
        updatingFlow={updatingFlow}
        showAddFlowModal={showAddFlowModal}
        setShowAddFlowModal={setShowAddFlowModal}
        addingFlow={addingFlow}
        newFlow={newFlow}
        showApiKeyCheckbox={showApiKeyCheckbox}
        setNewFlow={setNewFlow}
        handleAddFlow={handleAddFlow}
        mappedAppOptions={mappedAppOptions}
        showAddMappingModal={showAddMappingModal}
        setShowAddMappingModal={setShowAddMappingModal}
        addingMapping={addingMapping}
        setShowInlineMappingFlowFields={setShowInlineMappingFlowFields}
        newMapping={newMapping}
        setNewMapping={setNewMapping}
        likelyIngressType={likelyIngressType}
        handleNewMappingComponentTypeChange={handleNewMappingComponentTypeChange}
        handleAddMapping={handleAddMapping}
        addMappingGridCols={addMappingGridCols}
        unmappedApps={unmappedApps}
        componentTypeOptions={componentTypeOptions}
        mappedApps={mappedApps}
        showInlineMappingFlowFields={showInlineMappingFlowFields}
        removeMappingModalOpen={removeMappingModalOpen}
        setRemoveMappingModalOpen={setRemoveMappingModalOpen}
        removingMapping={removingMapping}
        mappingToRemove={mappingToRemove}
        setMappingToRemove={setMappingToRemove}
        handleRemoveMapping={handleRemoveMapping}
        showTypeSettingsModal={showTypeSettingsModal}
        setShowTypeSettingsModal={setShowTypeSettingsModal}
        newComponentType={newComponentType}
        setNewComponentType={setNewComponentType}
        handleCreateComponentType={handleCreateComponentType}
        creatingType={creatingType}
        componentTypes={componentTypes}
        showCancelModal={showCancelModal}
        setShowCancelModal={setShowCancelModal}
        discardChanges={discardChanges}
        deleteModalOpen={deleteModalOpen}
        setDeleteModalOpen={setDeleteModalOpen}
        deleteConfirmText={deleteConfirmText}
        setDeleteConfirmText={setDeleteConfirmText}
        deleting={deleting}
        handleDeleteProduct={handleDeleteProduct}
        otherComponentValue={OTHER_COMPONENT_VALUE}
      />
    </div>
  );
}
