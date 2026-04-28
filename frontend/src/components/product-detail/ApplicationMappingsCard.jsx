import { Link } from 'react-router-dom';
import { Button } from '../ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card.jsx';
import { Input } from '../ui/Input.jsx';
import { Select } from '../ui/Select.jsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/Table.jsx';

function bandClass0to100(value) {
  if (value == null || Number.isNaN(Number(value))) return 'text-gray-400';
  const n = Number(value);
  if (n >= 76) return 'text-green-600 font-semibold tabular-nums';
  if (n >= 51) return 'text-yellow-600 font-semibold tabular-nums';
  return 'text-red-600 font-semibold tabular-nums';
}

export function ApplicationMappingsCard({
  product,
  appMetricsByApplicationId = {},
  componentTypes,
  componentTypeOptions,
  editingMappingId,
  setEditingMappingId,
  getRowEdit,
  setEditForRow,
  hasMappingChanges,
  handleSaveRow,
  openRemoveMappingModal,
  setShowTypeSettingsModal,
  setShowAddMappingModal,
  otherComponentValue,
}) {
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
    </Card>
  );
}
