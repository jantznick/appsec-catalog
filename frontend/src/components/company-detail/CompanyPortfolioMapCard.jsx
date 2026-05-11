import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { toast } from '../ui/Toast.jsx';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card.jsx';
import { Select } from '../ui/Select.jsx';
import { Button } from '../ui/Button.jsx';
import { CompanyPortfolioGraph } from './CompanyPortfolioGraph.jsx';

export function CompanyPortfolioMapCard({ companyId }) {
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState(null);
  const [excludedProductIds, setExcludedProductIds] = useState([]);
  const [facingFilter, setFacingFilter] = useState('all');

  const load = useCallback(async () => {
    if (!companyId) return;
    try {
      setLoading(true);
      const data = await api.getCompanyPortfolioArchitecture(companyId);
      setPayload(data);
    } catch (e) {
      console.error(e);
      toast.error(e.message || 'Failed to load portfolio map');
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    load();
  }, [load]);

  const products = payload?.products || [];
  const toggleProductExcluded = (productId) => {
    setExcludedProductIds((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
    );
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Application environment</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">Loading architecture…</p>
        </CardContent>
      </Card>
    );
  }

  if (!payload) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Application environment</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-3">Could not load this view.</p>
          <Button variant="secondary" size="sm" onClick={load}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Application environment</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-600">
          Framed areas are your products; lines show data flows and entry points from each product's
          diagram. The same application can appear in more than one area. Apps outside any frame are in
          your catalog but not assigned to a product yet. Click a name for details.
        </p>

        <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end">
          <div className="min-w-[200px]">
            <Select
              label="Facing filter"
              value={facingFilter}
              onChange={(e) => setFacingFilter(e.target.value)}
              options={[
                { value: 'all', label: 'All applications' },
                { value: 'internal', label: 'Internal only' },
                { value: 'external', label: 'External or both' },
                { value: 'unset', label: 'Facing not set' },
              ]}
            />
          </div>
          {products.length > 0 ? (
            <div className="flex-1 min-w-[240px]">
              <span className="block text-sm font-medium text-gray-700 mb-2">Products shown</span>
              <div className="flex flex-wrap gap-2">
                {products.map((p) => {
                  const checked = !excludedProductIds.includes(p.id);
                  return (
                    <label
                      key={p.id}
                      className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-800 cursor-pointer hover:bg-gray-100"
                    >
                      <input
                        type="checkbox"
                        className="rounded border-gray-300"
                        checked={checked}
                        onChange={() => toggleProductExcluded(p.id)}
                      />
                      <span className="max-w-[160px] truncate" title={p.name}>
                        {p.name}
                      </span>
                    </label>
                  );
                })}
              </div>
              {excludedProductIds.length > 0 ? (
                <button
                  type="button"
                  className="mt-2 text-xs font-medium text-blue-600 hover:text-blue-700"
                  onClick={() => setExcludedProductIds([])}
                >
                  Show all products
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        <CompanyPortfolioGraph
          applications={payload.applications}
          products={payload.products}
          mappings={payload.mappings}
          dataFlows={payload.dataFlows}
          ingressPoints={payload.ingressPoints}
          excludedProductIds={excludedProductIds}
          facingFilter={facingFilter}
        />
      </CardContent>
    </Card>
  );
}
