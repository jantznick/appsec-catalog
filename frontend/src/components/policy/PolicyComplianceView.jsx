import { useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card.jsx';
import { LoadingPage } from '../ui/Loading.jsx';
import { Button } from '../ui/Button.jsx';

export function PolicyComplianceView({ applicationId, compliance, loading, onLoad, onRefresh }) {
  useEffect(() => {
    // Load compliance data when component mounts (tab becomes active)
    if (!compliance && !loading) {
      onLoad();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId]); // Only depend on applicationId to reload if it changes

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

  const { controls, summary } = compliance;

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
              <div className="text-2xl font-bold text-gray-800">{summary.total}</div>
              <div className="text-sm text-gray-600 mt-1">Total Controls</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-700">{summary.meeting}</div>
              <div className="text-sm text-green-600 mt-1">Meeting Requirements</div>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-700">{summary.not_meeting}</div>
              <div className="text-sm text-red-600 mt-1">Not Meeting</div>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-700">{summary.compliance_percentage}%</div>
              <div className="text-sm text-blue-600 mt-1">Compliance Rate</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Controls List */}
      <div className="space-y-4">
        {controls.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-gray-500">
              No policy controls configured
            </CardContent>
          </Card>
        ) : (
          controls.map((controlResult) => {
            const { control, status, evidence, details } = controlResult;
            const isMeeting = status === 'meeting';

            return (
              <Card key={control.id} className={isMeeting ? 'border-green-200' : 'border-red-200'}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <CardTitle className="text-lg">{control.name}</CardTitle>
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

                    {/* Combined Field Evaluations - More compact and clear */}
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
                                      {fieldResult.fieldPath}
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
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
