import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { toast } from '../components/ui/Toast.jsx';
import { LoadingPage } from '../components/ui/Loading.jsx';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card.jsx';
import { Button } from '../components/ui/Button.jsx';
import useAuthStore from '../store/authStore.js';
import {
  getOperatorLabel,
  getPolicyFieldLabel,
  formatPolicyFieldValue,
} from '../lib/policyDisplay.js';

const SCOPE_LABELS = {
  global: 'Global',
  division: 'Division',
  company: 'Company',
  conditional: 'Conditional',
};

/**
 * Read-only policy + controls (field checks). Layout aligned with PolicyControls expanded policy view.
 */
export function PolicyViewer() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuthStore();
  const [policy, setPolicy] = useState(null);
  const [availableFields, setAvailableFields] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const [policyRes, fieldsRes] = await Promise.all([
          api.getPolicy(id),
          api.getAvailableFields().catch(() => []),
        ]);
        if (!cancelled) {
          setPolicy(policyRes);
          setAvailableFields(Array.isArray(fieldsRes) ? fieldsRes : []);
        }
      } catch (e) {
        if (!cancelled) {
          toast.error(e.message || 'Failed to load policy');
          setPolicy(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return <LoadingPage message="Loading policy…" />;
  }

  if (!policy) {
    return (
      <div className="max-w-3xl mx-auto">
        <p className="text-gray-600 mb-4">Policy could not be loaded.</p>
        <Button variant="secondary" onClick={() => navigate(-1)}>
          Go back
        </Button>
      </div>
    );
  }

  const controls = Array.isArray(policy.controls) ? policy.controls : [];
  const sortedControls = [...controls].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
  const readOnly = Boolean(policy.readOnly);

  return (
    <div className="max-w-5xl mx-auto pb-16">
      <div className="mb-8">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-sm text-blue-600 hover:text-blue-700 mb-3"
        >
          ← Back
        </button>
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Policy</h1>
        <p className="text-gray-600">
          Policy overview and control requirements.
        </p>
        {isAdmin() && !readOnly && (
          <p className="text-sm text-gray-600 mt-2">
            <Link to="/policy-controls" className="text-blue-600 hover:text-blue-700 font-medium">
              Edit in Policy & Controls
            </Link>
          </p>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-1">
            <CardTitle className="text-lg text-gray-900">{policy.name}</CardTitle>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="px-2 py-1 text-xs font-medium rounded bg-blue-100 text-blue-800">
                {SCOPE_LABELS[policy.scope] || policy.scope}
              </span>
              {!policy.isActive && (
                <span className="px-2 py-1 text-xs font-medium rounded bg-gray-100 text-gray-600">
                  Inactive
                </span>
              )}
              <span className="text-sm text-gray-500">
                {sortedControls.length} control{sortedControls.length !== 1 ? 's' : ''}
              </span>
            </div>
            {policy.description && (
              <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap leading-relaxed">
                {policy.description}
              </p>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {sortedControls.length === 0 ? (
            <div className="text-center py-10 text-gray-500 rounded-lg border border-dashed border-gray-200 bg-gray-50/80">
              <p className="text-sm">No controls in this policy.</p>
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              {sortedControls.map((control) => {
                const fields = Array.isArray(control.fields) ? control.fields : [];
                return (
                  <Card key={control.id} className="bg-gray-50 shadow-sm border border-gray-200/80">
                    <CardHeader>
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <CardTitle className="text-base text-gray-900">
                              {control.controlId} - {control.name}
                            </CardTitle>
                            {!control.isActive && (
                              <span className="px-2 py-1 text-xs font-medium rounded bg-gray-200 text-gray-700">
                                Inactive
                              </span>
                            )}
                            {control.category && (
                              <span className="px-2 py-1 text-xs font-medium rounded bg-blue-100 text-blue-800">
                                {control.category}
                              </span>
                            )}
                          </div>
                          {control.description && (
                            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                              {control.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardHeader>

                    {fields.length > 0 ? (
                      <CardContent>
                        <div className="border-t border-gray-200 pt-4 mt-2">
                          <span className="text-sm font-medium text-gray-700 mb-3 block">
                            Field mappings
                          </span>
                          <p className="text-xs text-gray-500 mb-3">
                            Combined with <strong>{control.evaluationLogic || 'AND'}</strong> -{' '}
                            {control.evaluationLogic === 'OR'
                              ? 'at least one check must pass.'
                              : 'all checks must pass.'}
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            {fields.map((field, idx) => {
                              const fieldLabel = getPolicyFieldLabel(availableFields, field.fieldPath);
                              const operatorLabel = getOperatorLabel(field.operator);
                              const displayVal = formatPolicyFieldValue(field.value);
                              const hasValue = displayVal !== '';
                              const isLast = idx === fields.length - 1;
                              const showLogic = !isLast && control.evaluationLogic;

                              return (
                                <div key={field.id || idx} className="flex items-center gap-2 flex-wrap">
                                  <div className="inline-flex items-center gap-2 px-3 py-2 bg-surface rounded-lg border border-gray-200 text-sm shadow-sm">
                                    <span className="font-medium text-gray-800">{fieldLabel}</span>
                                    <span className="text-gray-300">·</span>
                                    <span className="text-gray-600">{operatorLabel}</span>
                                    {hasValue && (
                                      <>
                                        <span className="text-gray-300">·</span>
                                        <span className="px-2 py-0.5 bg-gray-50 rounded text-gray-800 border border-gray-200 font-mono text-xs max-w-[min(100%,280px)] break-all">
                                          {displayVal}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                  {showLogic && (
                                    <span className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                      {control.evaluationLogic}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </CardContent>
                    ) : (
                      <CardContent>
                        <div className="border-t border-gray-200 pt-4 mt-2">
                          <p className="text-sm text-gray-500">
                            No field mappings - compliance may rely on admin overrides or other rules.
                          </p>
                        </div>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
