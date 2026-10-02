import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card.jsx';
import { Button } from '../ui/Button.jsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/Table.jsx';

/**
 * The cloud resources behind a product or an application, from Wiz.
 *
 * ONE PANEL FOR BOTH. A product page and an application page ask the same
 * question with one more filter on it, so they share a component; `load` is the
 * only thing that differs.
 *
 * Orbit does not store these. Wiz owns resources and findings - this is a live
 * read, and a slow or unreachable Wiz shows as a slow or unreachable panel
 * rather than as stale rows nobody can date.
 */

const MATCH_LABELS = {
  application: 'This application',
  shared: 'Shared',
  product: 'In this product',
  all: 'Matched',
};

const MATCH_HINTS = {
  shared: 'Serves the product rather than one named application — a host, a database, a proxy.',
};

export function CloudResourcesPanel({
  title = 'Cloud resources',
  description,
  load,
  emptyHint,
}) {
  const [state, setState] = useState({ status: 'idle', data: null, error: null });

  const run = async () => {
    setState({ status: 'loading', data: null, error: null });
    try {
      setState({ status: 'done', data: await load(), error: null });
    } catch (error) {
      setState({ status: 'error', data: null, error: error.message || 'Failed to load resources' });
    }
  };

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const grouped = useMemo(() => {
    const rows = state.data?.resources || [];
    const byMatch = new Map();
    for (const r of rows) {
      if (!byMatch.has(r.match)) byMatch.set(r.match, []);
      byMatch.get(r.match).push(r);
    }
    // This application's own resources first; shared infrastructure after.
    const order = ['application', 'product', 'all', 'shared'];
    return [...byMatch.entries()].sort(
      (a, b) => order.indexOf(a[0]) - order.indexOf(b[0]),
    );
  }, [state.data]);

  const data = state.data;
  const notConfigured = data && data.configured === false;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>{title}</CardTitle>
          {description && <p className="mt-1 text-sm text-gray-600">{description}</p>}
        </div>
        <Button variant="secondary" onClick={run} disabled={state.status === 'loading'}>
          {state.status === 'loading' ? 'Loading…' : 'Refresh'}
        </Button>
      </CardHeader>
      <CardContent>
        {state.status === 'loading' && <p className="text-sm text-gray-500">Asking Wiz…</p>}

        {state.status === 'error' && (
          <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {state.error}
          </p>
        )}

        {state.status === 'done' && notConfigured && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            {data.missing === 'folder' && (
              <>
                This company has no Wiz folder, so no resources can be looked up. Set one on the
                company&rsquo;s{' '}
                {data.companyId ? (
                  <Link to={`/companies/${data.companyId}`} className="underline">
                    Tools &amp; connections tab
                  </Link>
                ) : (
                  'Tools & connections tab'
                )}
                . The catalog-wide integration settings hold the credentials; the folder is
                per company.
              </>
            )}
            {data.missing === 'credentials' && 'No Wiz credentials are available for this company.'}
            {data.missing === 'tagValue' && (emptyHint || 'No Wiz tag value has been assigned yet.')}
          </div>
        )}

        {state.status === 'done' && data?.configured && (
          <>
            <p className="mb-3 text-sm text-gray-600">
              {data.resources.length} resource{data.resources.length === 1 ? '' : 's'} of{' '}
              {data.scanned} scanned
              {data.serverFiltered === false && ' (filtered locally — Wiz rejected the tag predicate)'}
            </p>

            {data.productFilterReason === 'multiple_products' && (
              <p className="mb-3 rounded-md border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
                This application belongs to several products, so the product tag is not applied —
                the list is filtered by this application&rsquo;s tag alone. Narrowing it would mean
                guessing which product, and dropping a resource is worse than showing an extra one.
              </p>
            )}
            {data.productFilterReason === 'product_untagged' && (
              <p className="mb-3 rounded-md border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
                {data.productName} has no Wiz tag value assigned, so the product filter is not
                applied. Shared infrastructure will not appear until it has one.
              </p>
            )}

            {(data.errors || []).map((e) => (
              <p key={e.type} className="mb-2 text-xs text-amber-700">
                {e.type}: {e.message}
              </p>
            ))}

            {data.resources.length === 0 ? (
              <p className="text-sm italic text-gray-500">
                Nothing in this company&rsquo;s Wiz folder carries that tag value.
              </p>
            ) : (
              grouped.map(([match, rows]) => (
                <div key={match} className="mb-5 last:mb-0">
                  <h4 className="text-sm font-semibold text-gray-900">
                    {MATCH_LABELS[match] || match}{' '}
                    <span className="font-normal text-gray-500">({rows.length})</span>
                  </h4>
                  {MATCH_HINTS[match] && (
                    <p className="mb-2 text-xs text-gray-500">{MATCH_HINTS[match]}</p>
                  )}
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Resource</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Environment</TableHead>
                        <TableHead>Role</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((r) => (
                        <TableRow key={r.id || `${r.type}-${r.name}`}>
                          <TableCell>
                            <span className="font-medium text-gray-900">
                              {r.name || r.id || '(unnamed)'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-gray-700">{r.type}</span>
                          </TableCell>
                          <TableCell>
                            {r.environment || <span className="text-sm italic text-gray-400">—</span>}
                          </TableCell>
                          <TableCell>
                            {r.role || <span className="text-sm italic text-gray-400">—</span>}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ))
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default CloudResourcesPanel;
