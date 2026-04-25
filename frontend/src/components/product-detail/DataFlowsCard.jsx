import { useState } from 'react';
import { Button } from '../ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card.jsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/Table.jsx';
import { ProductDataFlowGraph } from './ProductDataFlowGraph.jsx';

export function DataFlowsCard({
  mappedApps,
  appTypeById,
  dataFlows,
  ingressPoints,
  handleRemoveIngressPoint,
  removingIngressId,
  setShowAddFlowModal,
  openRemoveFlowModal,
  openEditFlowModal,
}) {
  const [showIngressRows, setShowIngressRows] = useState(true);
  const hasTableRows = dataFlows.length > 0 || (ingressPoints?.length || 0) > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Data Flows</CardTitle>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowAddFlowModal(true)}
            className="whitespace-nowrap"
            disabled={mappedApps.length < 1}
          >
            Add Data Flow
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {mappedApps.length === 0 ? (
          <p className="text-sm text-gray-500">Add application mappings to begin architecture modeling.</p>
        ) : (
          <>
            <div className="mb-4">
              <ProductDataFlowGraph
                mappedApps={mappedApps}
                appTypeById={appTypeById}
                dataFlows={dataFlows}
                ingressPoints={ingressPoints}
                onEdgeClickFlow={openEditFlowModal}
              />
            </div>
            {!hasTableRows ? (
              <p className="text-sm text-gray-500 mb-4">No data flows defined yet.</p>
            ) : null}
            {hasTableRows ? (
              <>
                <div className="mb-2 flex items-center justify-end">
                  <label className="inline-flex items-center gap-2 text-xs text-gray-600">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300"
                      checked={showIngressRows}
                      onChange={(e) => setShowIngressRows(e.target.checked)}
                    />
                    Show ingress
                  </label>
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
                    {showIngressRows &&
                      (ingressPoints || []).map((ingress) => (
                      <TableRow key={`ingress-${ingress.id}`}>
                        <TableCell className="font-medium">Client</TableCell>
                        <TableCell className="font-medium">
                          {ingress.application?.name || '-'}
                        </TableCell>
                        <TableCell>Ingress</TableCell>
                        <TableCell>-</TableCell>
                        <TableCell>{ingress.channel || 'default'}</TableCell>
                        <TableCell>unidirectional</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="danger"
                            loading={removingIngressId === ingress.id}
                            onClick={() => handleRemoveIngressPoint?.(ingress.id)}
                          >
                            Remove
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {dataFlows.map((flow) => (
                      <TableRow
                        key={flow.id}
                        className="cursor-pointer"
                        onClick={() => openEditFlowModal(flow.id)}
                      >
                        <TableCell className="font-medium">{flow.sourceApplication?.name || '-'}</TableCell>
                        <TableCell className="font-medium">{flow.targetApplication?.name || '-'}</TableCell>
                        <TableCell>{flow.flowName || '-'}</TableCell>
                        <TableCell>{flow.dataClassification || '-'}</TableCell>
                        <TableCell>{flow.protocol || '-'}</TableCell>
                        <TableCell>{flow.direction || '-'}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={(e) => {
                              e.stopPropagation();
                              openRemoveFlowModal(flow);
                            }}
                          >
                            Remove
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
