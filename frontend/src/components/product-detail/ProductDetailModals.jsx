import { Button } from '../ui/Button.jsx';
import { Input } from '../ui/Input.jsx';
import { Modal } from '../ui/Modal.jsx';
import { Select } from '../ui/Select.jsx';
import { Textarea } from '../ui/Textarea.jsx';

export function ProductDetailModals({
  product,
  removeFlowModalOpen,
  setRemoveFlowModalOpen,
  removingFlow,
  flowToRemove,
  setFlowToRemove,
  handleRemoveFlow,
  showAddFlowModal,
  setShowAddFlowModal,
  addingFlow,
  newFlow,
  setNewFlow,
  handleAddFlow,
  mappedAppOptions,
  showAddMappingModal,
  setShowAddMappingModal,
  addingMapping,
  setShowInlineMappingFlowFields,
  newMapping,
  setNewMapping,
  handleAddMapping,
  addMappingGridCols,
  unmappedApps,
  componentTypeOptions,
  mappedApps,
  showInlineMappingFlowFields,
  removeMappingModalOpen,
  setRemoveMappingModalOpen,
  removingMapping,
  mappingToRemove,
  setMappingToRemove,
  handleRemoveMapping,
  showTypeSettingsModal,
  setShowTypeSettingsModal,
  newComponentType,
  setNewComponentType,
  handleCreateComponentType,
  creatingType,
  componentTypes,
  showCancelModal,
  setShowCancelModal,
  discardChanges,
  deleteModalOpen,
  setDeleteModalOpen,
  deleteConfirmText,
  setDeleteConfirmText,
  deleting,
  handleDeleteProduct,
  otherComponentValue,
}) {
  return (
    <>
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
            Remove this flow:{' '}
            <strong>
              {flowToRemove?.sourceApplication?.name || 'Unknown'}{' '}
              {flowToRemove?.direction === 'bidirectional' ? '<->' : '->'}{' '}
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
                  e.target.value === otherComponentValue ? prev.customComponentLabel : '',
              }))
            }
            options={componentTypeOptions}
            placeholder="Select type"
          />
          {newMapping.componentTypeId === otherComponentValue ? (
            <Input
              label="Custom Label"
              value={newMapping.customComponentLabel}
              onChange={(e) => setNewMapping((prev) => ({ ...prev, customComponentLabel: e.target.value }))}
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
                    onChange={(e) =>
                      setNewMapping((prev) => ({ ...prev, connectFromApplicationId: e.target.value }))
                    }
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
                    onChange={(e) =>
                      setNewMapping((prev) => ({ ...prev, dataClassification: e.target.value }))
                    }
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
              This action cannot be undone. All data associated with this product will be permanently
              deleted.
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
    </>
  );
}
