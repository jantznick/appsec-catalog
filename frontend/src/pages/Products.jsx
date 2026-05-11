import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { toast } from '../components/ui/Toast.jsx';
import { LoadingPage } from '../components/ui/Loading.jsx';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card.jsx';
import { Input } from '../components/ui/Input.jsx';
import { Select } from '../components/ui/Select.jsx';
import { Textarea } from '../components/ui/Textarea.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table.jsx';
import { Modal } from '../components/ui/Modal.jsx';
import useAuthStore from '../store/authStore.js';

export function Products() {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [products, setProducts] = useState([]);
  const [applications, setApplications] = useState([]);
  const [componentTypes, setComponentTypes] = useState([]);
  const [newMapping, setNewMapping] = useState({
    applicationId: '',
    componentTypeId: '',
    customComponentLabel: '',
    displayOrder: 0,
  });
  const [createMappings, setCreateMappings] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [companyFilter, setCompanyFilter] = useState('');
  const [search, setSearch] = useState('');
  const [formData, setFormData] = useState({
    companyId: '',
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

  useEffect(() => {
    if (!isAdmin() && user?.companyId) {
      setFormData((prev) => ({ ...prev, companyId: user.companyId }));
    }
  }, [user?.companyId, isAdmin]);

  useEffect(() => {
    loadProducts();
  }, [companyFilter]);

  useEffect(() => {
    loadCompanies();
    loadApplications();
  }, []);

  useEffect(() => {
    if (!formData.companyId) {
      setComponentTypes([]);
      return;
    }
    loadComponentTypes(formData.companyId);
  }, [formData.companyId]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const data = await api.getProducts(isAdmin() ? { companyId: companyFilter || undefined } : {});
      setProducts(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.error(error.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const loadCompanies = async () => {
    try {
      const data = await api.getCompanies();
      setCompanies(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load companies:', error);
    }
  };

  const loadApplications = async () => {
    try {
      const data = await api.getApplications();
      setApplications(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load applications:', error);
    }
  };

  const loadComponentTypes = async (companyId) => {
    try {
      const data = await api.getProductComponentTypes(companyId);
      setComponentTypes(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load product component types:', error);
      setComponentTypes([]);
    }
  };

  const companyOptions = useMemo(
    () => companies.map((c) => ({ value: c.id, label: c.name })),
    [companies]
  );

  const componentTypeOptions = useMemo(
    () => componentTypes.map((type) => ({ value: type.id, label: type.name })),
    [componentTypes]
  );

  const selectedCompanyId = formData.companyId || user?.companyId || '';

  const availableApplications = useMemo(
    () =>
      applications.filter(
        (app) =>
          app.companyId === selectedCompanyId &&
          !createMappings.some((mapping) => mapping.applicationId === app.id)
      ),
    [applications, selectedCompanyId, createMappings]
  );

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((product) => {
      return (
        (product.name || '').toLowerCase().includes(q) ||
        (product.description || '').toLowerCase().includes(q) ||
        (product.company?.name || '').toLowerCase().includes(q)
      );
    });
  }, [products, search]);

  const resetForm = () => {
    setFormData((prev) => ({
      companyId: isAdmin() ? '' : user?.companyId || prev.companyId,
      name: '',
      description: '',
      owner: '',
      facing: '',
      status: 'active',
      lifecycleStage: '',
      businessCriticality: '',
      dataSensitivity: '',
      complianceNotes: '',
    }));
    setCreateMappings([]);
    setNewMapping({
      applicationId: '',
      componentTypeId: '',
      customComponentLabel: '',
      displayOrder: 0,
    });
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Product name is required');
      return;
    }
    if (!formData.companyId) {
      toast.error('Company is required');
      return;
    }

    try {
      setCreating(true);
      const product = await api.createProduct(formData);

      if (createMappings.length > 0) {
        for (const mapping of createMappings) {
          await api.addApplicationToProduct(product.id, {
            applicationId: mapping.applicationId,
            componentTypeId: mapping.componentTypeId || null,
            customComponentLabel: mapping.customComponentLabel || null,
            displayOrder: mapping.displayOrder || 0,
          });
        }
      }

      toast.success('Product created successfully');
      await loadProducts();
      resetForm();
      setCreateModalOpen(false);
      navigate(`/products/${product.id}`);
    } catch (error) {
      toast.error(error.message || 'Failed to create product');
    } finally {
      setCreating(false);
    }
  };

  const handleCompanySelection = (companyId) => {
    setFormData((prev) => ({ ...prev, companyId }));
    setCreateMappings([]);
    setNewMapping({
      applicationId: '',
      componentTypeId: '',
      customComponentLabel: '',
      displayOrder: 0,
    });
  };

  const handleAddMapping = () => {
    if (!newMapping.applicationId) {
      toast.error('Select an application to map');
      return;
    }

    if (!newMapping.componentTypeId) {
      toast.error('Select a component type');
      return;
    }

    if (newMapping.componentTypeId === '__other__' && !newMapping.customComponentLabel.trim()) {
      toast.error('Custom label is required when component type is Other');
      return;
    }

    const app = applications.find((item) => item.id === newMapping.applicationId);
    if (!app) return;

    setCreateMappings((prev) => [
      ...prev,
      {
        ...newMapping,
        customComponentLabel: newMapping.customComponentLabel.trim(),
        componentTypeId:
          newMapping.componentTypeId === '__other__' ? '' : newMapping.componentTypeId,
        applicationName: app.name,
      },
    ]);
    setNewMapping({
      applicationId: '',
      componentTypeId: '',
      customComponentLabel: '',
      displayOrder: 0,
    });
  };

  const removeMapping = (applicationId) => {
    setCreateMappings((prev) => prev.filter((item) => item.applicationId !== applicationId));
  };

  if (loading) {
    return <LoadingPage message="Loading products..." />;
  }

  return (
    <div>
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Products</h1>
          <p className="text-gray-600">
            {isAdmin() ? 'Manage products across all companies' : 'View your company products'}
          </p>
        </div>
        <Button variant="primary" onClick={() => setCreateModalOpen(true)}>
          New Product
        </Button>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, company, or description..."
            />
            {isAdmin() && (
              <Select
                label="Company"
                value={companyFilter}
                onChange={(e) => setCompanyFilter(e.target.value)}
                options={[
                  { value: '', label: 'All Companies' },
                  ...companyOptions,
                ]}
              />
            )}
          </div>
        </CardContent>
      </Card>

      {filteredProducts.length === 0 ? (
        <Card>
          <CardContent>
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">
                {isAdmin()
                  ? 'No products found. Create your first product to get started.'
                  : 'No products found in your company.'}
              </p>
              <Button variant="primary" onClick={() => setCreateModalOpen(true)}>
                Create Product
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent padding="none">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Facing</TableHead>
                  <TableHead>Apps</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((product) => (
                  <TableRow key={product.id} onClick={() => navigate(`/products/${product.id}`)}>
                    <TableCell className="font-medium text-blue-700">{product.name}</TableCell>
                    <TableCell>{product.company?.name || '-'}</TableCell>
                    <TableCell>{product.status || '-'}</TableCell>
                    <TableCell>{product.facing || '-'}</TableCell>
                    <TableCell>{product._count?.applications ?? 0}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Modal
        isOpen={createModalOpen}
        onClose={() => {
          if (!creating) {
            setCreateModalOpen(false);
          }
        }}
        title="New Product"
        size="xl"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setCreateModalOpen(false);
                resetForm();
              }}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button type="submit" form="create-product-form" loading={creating}>
              Create Product
            </Button>
          </>
        }
      >
        <form id="create-product-form" className="space-y-4" onSubmit={handleCreate}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Company"
              value={formData.companyId}
              onChange={(e) => handleCompanySelection(e.target.value)}
              options={companyOptions}
              placeholder="Select company"
              required
              disabled={!isAdmin()}
            />
            <Input
              label="Name"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              required
            />
            <Input
              label="Owner"
              value={formData.owner}
              onChange={(e) => setFormData((prev) => ({ ...prev, owner: e.target.value }))}
            />
            <Select
              label="Facing"
              value={formData.facing}
              onChange={(e) => setFormData((prev) => ({ ...prev, facing: e.target.value }))}
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
              onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value }))}
              options={[
                { value: 'active', label: 'Active' },
                { value: 'planned', label: 'Planned' },
                { value: 'retired', label: 'Retired' },
              ]}
            />
            <Input
              label="Lifecycle Stage"
              value={formData.lifecycleStage}
              onChange={(e) => setFormData((prev) => ({ ...prev, lifecycleStage: e.target.value }))}
              placeholder="e.g. Build, Launch, Operate"
            />
            <Input
              label="Business Criticality (1-5)"
              type="number"
              min="1"
              max="5"
              value={formData.businessCriticality}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, businessCriticality: e.target.value }))
              }
            />
            <Input
              label="Data Sensitivity"
              value={formData.dataSensitivity}
              onChange={(e) => setFormData((prev) => ({ ...prev, dataSensitivity: e.target.value }))}
              placeholder="e.g. Public, Internal, Confidential"
            />
          </div>
          <Textarea
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
            rows={3}
          />
          <Textarea
            label="Compliance Notes"
            value={formData.complianceNotes}
            onChange={(e) => setFormData((prev) => ({ ...prev, complianceNotes: e.target.value }))}
            rows={3}
          />

          <div className="border rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Add Applications</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <Select
                label="Application"
                value={newMapping.applicationId}
                onChange={(e) =>
                  setNewMapping((prev) => ({ ...prev, applicationId: e.target.value }))
                }
                options={availableApplications.map((app) => ({ value: app.id, label: app.name }))}
                placeholder="Select application"
                disabled={!selectedCompanyId}
              />
              <Select
                label="Component Type"
                value={newMapping.componentTypeId}
                onChange={(e) =>
                  setNewMapping((prev) => ({
                    ...prev,
                    componentTypeId: e.target.value,
                    customComponentLabel: e.target.value === '__other__' ? prev.customComponentLabel : '',
                  }))
                }
                options={[
                  ...componentTypeOptions,
                  { value: '__other__', label: 'Other' },
                ]}
                placeholder="Select type"
                disabled={!selectedCompanyId}
              />
              {newMapping.componentTypeId === '__other__' ? (
                <Input
                  label="Custom Label"
                  value={newMapping.customComponentLabel}
                  onChange={(e) =>
                    setNewMapping((prev) => ({ ...prev, customComponentLabel: e.target.value }))
                  }
                  placeholder="Enter custom component label"
                  disabled={!selectedCompanyId}
                />
              ) : (
                <div />
              )}
              <Input
                label="Display Order"
                type="number"
                value={newMapping.displayOrder}
                onChange={(e) =>
                  setNewMapping((prev) => ({ ...prev, displayOrder: Number(e.target.value || 0) }))
                }
                disabled={!selectedCompanyId}
              />
            </div>
            <div className="mt-3 flex justify-end">
              <Button type="button" variant="outline" onClick={handleAddMapping} disabled={!selectedCompanyId}>
                Add App Mapping
              </Button>
            </div>

            {createMappings.length > 0 && (
              <div className="mt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Application</TableHead>
                      <TableHead>Component</TableHead>
                      <TableHead>Display Order</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {createMappings.map((mapping) => {
                      const typeName = componentTypes.find((t) => t.id === mapping.componentTypeId)?.name;
                      return (
                        <TableRow key={mapping.applicationId}>
                          <TableCell>{mapping.applicationName}</TableCell>
                          <TableCell>{typeName || `Other: ${mapping.customComponentLabel}`}</TableCell>
                          <TableCell>{mapping.displayOrder}</TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="danger"
                              size="sm"
                              onClick={() => removeMapping(mapping.applicationId)}
                            >
                              Remove
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </form>
      </Modal>
    </div>
  );
}
