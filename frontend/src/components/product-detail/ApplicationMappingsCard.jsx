import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card.jsx';
import { Input } from '../ui/Input.jsx';
import { Modal } from '../ui/Modal.jsx';
import { Select } from '../ui/Select.jsx';
import { Textarea } from '../ui/Textarea.jsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/Table.jsx';

function bandClass0to100(value) {
  if (value == null || Number.isNaN(Number(value))) return 'text-gray-400';
  const n = Number(value);
  if (n >= 76) return 'text-green-600 font-semibold tabular-nums';
  if (n >= 51) return 'text-yellow-600 font-semibold tabular-nums';
  return 'text-red-600 font-semibold tabular-nums';
}

const emptyFlowDraft = () => ({
  connectFromApplicationId: '',
  flowName: '',
  dataClassification: '',
  protocol: '',
  direction: 'unidirectional',
  notes: '',
});

export function ApplicationMappingsCard({
  product,
  appMetricsByApplicationId = {},
  componentTypes,
  componentTypeOptions,
  mappedAppOptions = [],
  editingMappingId,
  setEditingMappingId,
  getRowEdit,
  setEditForRow,
  hasMappingChanges,
  handleSaveRow,
  cancelEditMappingRow,
  savingMappingId = null,
  openRemoveMappingModal,
  setShowTypeSettingsModal,
  setShowAddMappingModal,
  otherComponentValue,
}) {
  const [mappingFlowModal, setMappingFlowModal] = useState(null);
  /** { targetApplicationId, targetAppName, draft } */

  const clearFlowFieldsForRow = (applicationId) => {
    setEditForRow(applicationId, 'connectFromApplicationId', '');
    setEditForRow(applicationId, 'flowName', '');
    setEditForRow(applicationId, 'dataClassification', '');
    setEditForRow(applicationId, 'protocol', '');
    setEditForRow(applicationId, 'direction', 'unidirectional');
    setEditForRow(applicationId, 'notes', '');
  };

  const openMappingFlowModal = (mapping) => {
    const edit = getRowEdit(mapping);
    setMappingFlowModal({
      targetApplicationId: mapping.applicationId,
      targetAppName: mapping.application?.name || mapping.applicationId,
      draft: {
        connectFromApplicationId: edit.connectFromApplicationId || '',
        flowName: edit.flowName || '',
        dataClassification: edit.dataClassification || '',
        protocol: edit.protocol || '',
        direction: edit.direction || 'unidirectional',
        notes: edit.notes || '',
      },
    });
  };

  const applyMappingFlowModal = () => {
    if (!mappingFlowModal) return;
    const { targetApplicationId, draft } = mappingFlowModal;
    setEditForRow(targetApplicationId, 'connectFromApplicationId', draft.connectFromApplicationId);
    setEditForRow(targetApplicationId, 'flowName', draft.flowName);
    setEditForRow(targetApplicationId, 'dataClassification', draft.dataClassification);
    setEditForRow(targetApplicationId, 'protocol', draft.protocol);
    setEditForRow(targetApplicationId, 'direction', draft.direction);
    setEditForRow(targetApplicationId, 'notes', draft.notes);
    setMappingFlowModal(null);
  };

  const connectFromOptionsForModal =
    mappingFlowModal != null
      ? mappedAppOptions.filter((opt) => opt.value !== mappingFlowModal.targetApplicationId)
      : [];

  return (
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
                <TableHead className="text-right whitespace-nowrap">Security score</TableHead>
                <TableHead className="text-right whitespace-nowrap">Policy Compliance</TableHead>
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
                const metrics = appMetricsByApplicationId[mapping.applicationId];
                const totalScore = metrics?.totalScore;
                const policyPct = metrics?.policyCompliancePercent;
                const connectFromOptions = mappedAppOptions.filter(
                  (opt) => opt.value !== mapping.applicationId
                );
                const fromLabel = connectFromOptions.find(
                  (o) => o.value === edit.connectFromApplicationId
                )?.label;

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
                    <TableCell className={`text-right ${bandClass0to100(totalScore)}`}>
                      {totalScore != null ? totalScore : '—'}
                    </TableCell>
                    <TableCell className={`text-right ${bandClass0to100(policyPct)}`}>
                      {policyPct != null ? `${policyPct}%` : '—'}
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
                          {edit.componentTypeId === otherComponentValue && (
                            <Input
                              value={edit.customComponentLabel || ''}
                              onChange={(e) =>
                                setEditForRow(mapping.applicationId, 'customComponentLabel', e.target.value)
                              }
                              placeholder="Custom label"
                            />
                          )}
                          {connectFromOptions.length > 0 ? (
                            <div className="mt-1" onClick={(e) => e.stopPropagation()}>
                              {edit.connectFromApplicationId ? (
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-xs text-gray-700">
                                    New data flow:{' '}
                                    <span className="font-medium text-gray-900">{fromLabel}</span>
                                    <span className="text-gray-500"> → this app</span>
                                  </span>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => openMappingFlowModal(mapping)}
                                  >
                                    Edit flow
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => clearFlowFieldsForRow(mapping.applicationId)}
                                  >
                                    Clear
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => openMappingFlowModal(mapping)}
                                >
                                  Add data flow…
                                </Button>
                              )}
                            </div>
                          ) : null}
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
                              disabled={
                                !hasMappingChanges(mapping, edit) || savingMappingId === mapping.applicationId
                              }
                              loading={savingMappingId === mapping.applicationId}
                            >
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={(e) => {
                                e.stopPropagation();
                                cancelEditMappingRow(mapping.applicationId);
                              }}
                              disabled={savingMappingId === mapping.applicationId}
                            >
                              Cancel
                            </Button>
                          </>
                        ) : null}
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

      <Modal
        isOpen={mappingFlowModal != null}
        onClose={() => setMappingFlowModal(null)}
        title={
          mappingFlowModal
            ? `Data flow into ${mappingFlowModal.targetAppName}`
            : 'Data flow'
        }
        size="lg"
        footer={
          <>
            <Button variant="secondary" type="button" onClick={() => setMappingFlowModal(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                if (mappingFlowModal) {
                  setMappingFlowModal({
                    ...mappingFlowModal,
                    draft: emptyFlowDraft(),
                  });
                }
              }}
            >
              Reset fields
            </Button>
            <Button type="button" onClick={applyMappingFlowModal}>
              Apply
            </Button>
          </>
        }
      >
        {mappingFlowModal ? (
          <div className="space-y-3 text-sm" onClick={(e) => e.stopPropagation()}>
            <p className="text-gray-600">
              Optional: define a new data flow from another mapped application into{' '}
              <strong>{mappingFlowModal.targetAppName}</strong>. It will be created when you save the row.
            </p>
            <Select
              label="Connect from"
              value={mappingFlowModal.draft.connectFromApplicationId}
              onChange={(e) =>
                setMappingFlowModal((prev) =>
                  prev
                    ? {
                        ...prev,
                        draft: { ...prev.draft, connectFromApplicationId: e.target.value },
                      }
                    : prev
                )
              }
              options={[{ value: '', label: 'None' }, ...connectFromOptionsForModal]}
              placeholder="Another mapped app"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select
                label="Direction"
                value={mappingFlowModal.draft.direction}
                onChange={(e) =>
                  setMappingFlowModal((prev) =>
                    prev
                      ? { ...prev, draft: { ...prev.draft, direction: e.target.value } }
                      : prev
                  )
                }
                options={[
                  { value: 'unidirectional', label: 'Unidirectional' },
                  { value: 'bidirectional', label: 'Bidirectional' },
                ]}
              />
              <Input
                label="Flow name"
                value={mappingFlowModal.draft.flowName}
                onChange={(e) =>
                  setMappingFlowModal((prev) =>
                    prev ? { ...prev, draft: { ...prev.draft, flowName: e.target.value } } : prev
                  )
                }
                placeholder="e.g. User profile sync"
              />
              <Input
                label="Data classification"
                value={mappingFlowModal.draft.dataClassification}
                onChange={(e) =>
                  setMappingFlowModal((prev) =>
                    prev
                      ? { ...prev, draft: { ...prev.draft, dataClassification: e.target.value } }
                      : prev
                  )
                }
                placeholder="e.g. PII, Internal"
              />
              <Input
                label="Protocol"
                value={mappingFlowModal.draft.protocol}
                onChange={(e) =>
                  setMappingFlowModal((prev) =>
                    prev ? { ...prev, draft: { ...prev.draft, protocol: e.target.value } } : prev
                  )
                }
                placeholder="e.g. REST, Kafka"
              />
            </div>
            <Textarea
              label="Flow notes"
              value={mappingFlowModal.draft.notes}
              onChange={(e) =>
                setMappingFlowModal((prev) =>
                  prev ? { ...prev, draft: { ...prev.draft, notes: e.target.value } } : prev
                )
              }
              rows={3}
              placeholder="Optional"
            />
          </div>
        ) : null}
      </Modal>
    </Card>
  );
}
