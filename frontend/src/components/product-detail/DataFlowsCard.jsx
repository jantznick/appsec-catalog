import { Button } from '../ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card.jsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/Table.jsx';

export function DataFlowsCard({ mappedApps, dataFlows, setShowAddFlowModal, openRemoveFlowModal }) {
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
                    {flow.sourceApplication?.name || 'Unknown'}{' '}
                    {flow.direction === 'bidirectional' ? '<->' : '->'}{' '}
                    {flow.targetApplication?.name || 'Unknown'}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    {flow.flowName || 'Unnamed flow'}
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
                      <Button size="sm" variant="danger" onClick={() => openRemoveFlowModal(flow)}>
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
  );
}
