import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card.jsx';
import { api } from '../../lib/api.js';

export function ApplicablePoliciesView({ entityType, entityId, entityData }) {
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (entityId) {
      loadApplicablePolicies();
    }
  }, [entityId, entityData]);

  const loadApplicablePolicies = async () => {
    try {
      setLoading(true);
      const allPolicies = await api.getPolicies();
      
      // Filter policies that might be applicable
      const candidatePolicies = allPolicies.filter(policy => {
        if (!policy.isActive) return false;
        
        if (policy.scope === 'global') {
          return true;
        }
        
        if (entityType === 'company') {
          if (policy.scope === 'company' || policy.scope === 'division') {
            return true; // Will check relationships after fetching details
          }
          if (policy.scope === 'conditional') {
            // Conditional policies depend on application data, skip for now
            return false;
          }
        }
        
        if (entityType === 'division') {
          if (policy.scope === 'division') {
            return true; // Will check relationships after fetching details
          }
          // Company and conditional policies don't apply at division level
          return false;
        }
        
        return false;
      });

      // Fetch full policy details to check relationships
      const applicablePolicies = [];
      
      for (const policy of candidatePolicies) {
        try {
          const fullPolicy = await api.getPolicy(policy.id);
          let applies = false;
          let reason = '';

          if (fullPolicy.scope === 'global') {
            applies = true;
            reason = 'Applies to all';
          } else if (entityType === 'company') {
            if (fullPolicy.scope === 'company') {
              const companyMatch = fullPolicy.companyPolicies?.some(
                cp => cp.company.id === entityId
              );
              if (companyMatch) {
                applies = true;
                reason = 'Assigned to this company';
              }
            } else if (fullPolicy.scope === 'division' && entityData?.divisionId) {
              const divisionMatch = fullPolicy.divisionPolicies?.some(
                dp => dp.division.id === entityData.divisionId
              );
              if (divisionMatch) {
                applies = true;
                const division = fullPolicy.divisionPolicies.find(
                  dp => dp.division.id === entityData.divisionId
                );
                reason = `Assigned to ${division?.division?.name || 'your'} division`;
              }
            }
          } else if (entityType === 'division') {
            if (fullPolicy.scope === 'division') {
              const divisionMatch = fullPolicy.divisionPolicies?.some(
                dp => dp.division.id === entityId
              );
              if (divisionMatch) {
                applies = true;
                reason = 'Assigned to this division';
              }
            }
          }

          if (applies) {
            applicablePolicies.push({
              id: fullPolicy.id,
              name: fullPolicy.name,
              description: fullPolicy.description,
              scope: fullPolicy.scope,
              isActive: fullPolicy.isActive,
              reason,
            });
          }
        } catch (error) {
          console.error(`Failed to load policy ${policy.id}:`, error);
        }
      }

      setPolicies(applicablePolicies);
    } catch (error) {
      console.error('Failed to load applicable policies:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-gray-500">
          Loading policies...
        </CardContent>
      </Card>
    );
  }

  if (policies.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Applicable Policies</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">No policies apply to this {entityType}.</p>
        </CardContent>
      </Card>
    );
  }

  const scopeLabels = {
    global: 'Global',
    division: 'Division',
    company: 'Company',
    conditional: 'Conditional',
  };

  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle>Applicable Policies ({policies.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {policies.map((policy) => (
            <div
              key={policy.id}
              className="p-3 bg-gray-50 rounded-lg border border-gray-200"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-gray-800">{policy.name}</span>
                    <span className="px-2 py-0.5 text-xs font-medium rounded bg-blue-100 text-blue-800">
                      {scopeLabels[policy.scope] || policy.scope}
                    </span>
                    {!policy.isActive && (
                      <span className="px-2 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-600">
                        Inactive
                      </span>
                    )}
                  </div>
                  {policy.description && (
                    <p className="text-sm text-gray-600 mt-1">{policy.description}</p>
                  )}
                  {policy.reason && (
                    <p className="text-xs text-gray-500 mt-1">{policy.reason}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
