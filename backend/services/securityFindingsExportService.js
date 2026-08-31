import { prisma } from '../prisma/client.js';
import { resolveIntegrationForCompany } from '../integrations/resolve.js';
import { PROVIDER_WIZ } from '../integrations/constants.js';
import { getWizSastCountsForProject } from '../integrations/wizSastFindings.js';

/**
 * @param {string} v
 */
function esc(v) {
  if (v == null) {
    return '';
  }
  const s = String(v);
  if (/[",\n#]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * @param {object} body
 * @returns { object & { all?: boolean, from?: string, to?: string } }
 */
export function parseTimeRange(body) {
  if (!body || body.type === 'all') {
    return { all: true };
  }
  if (body.type === 'lastDays' && body.days) {
    const d = Math.min(3650, Math.max(1, Number(body.days) || 30));
    const to = new Date();
    const from = new Date(to.getTime() - d * 86_400_000);
    return { from: from.toISOString(), to: to.toISOString() };
  }
  return { all: true };
}

/**
 * @param {string} p
 */
function labelProvider(p) {
  if (p === PROVIDER_WIZ) {
    return 'Wiz SAST';
  }
  return p;
}

/**
 * @param {string[]} providers
 */
function sourceColumn(providers) {
  if (!providers || providers.length === 0) {
    return '';
  }
  return providers.map(labelProvider).join(' + ');
}

/**
 * @param {Record<string, number>} a
 * @param {Record<string, number>|null|undefined} b
 */
function addSev(a, b) {
  if (!b) {
    return;
  }
  for (const k of ['critical', 'high', 'medium', 'low', 'info']) {
    a[k] = (a[k] || 0) + (b[k] || 0);
  }
}

/**
 * @param {string} companyId
 * @param {import('@prisma/client').Prisma.JsonValue} filter
 * @param {object} tr
 */
async function wizFor(companyId, filter, tr) {
  const res = await resolveIntegrationForCompany(companyId, PROVIDER_WIZ);
  if (!res) {
    return {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
      error: 'Wiz: no credentials for company',
    };
  }
  const f = filter && typeof filter === 'object' && !Array.isArray(filter) ? filter : {};
  const folderId = /** @type {{ folderId?: string }} */ (f).folderId;
  if (!folderId) {
    return { critical: 0, high: 0, medium: 0, low: 0, info: 0, error: 'Wiz: no folder in link' };
  }
  return getWizSastCountsForProject(
    { clientId: res.decrypted.accessKey, clientSecret: res.decrypted.secretKey },
    res.baseUrl,
    folderId,
    tr,
  );
}

const emptySev = () => ({
  critical: 0,
  high: 0,
  medium: 0,
  low: 0,
  info: 0,
  error: null,
});

/**
 * Which vendors to call for this export. Defaults true.
 * @param {unknown} raw
 * @returns {{ WIZ: boolean }}
 */
export function parseExportProviders(raw) {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { WIZ: true };
  }
  const o = /** @type {Record<string, unknown>} */(raw);
  return {
    WIZ: o[PROVIDER_WIZ] !== false,
  };
}

/**
 * @param {{ WIZ: boolean }} p
 */
export function assertAtLeastOneProvider(p) {
  if (p[PROVIDER_WIZ] === false) {
    const e = new Error('At least one integration must be selected');
    e.statusCode = 400;
    throw e;
  }
}

const USER_NOTE_INTEGRATION_INCOMPLETE =
  'One or more integrations could not be reached; some counts may be zero. Server logs have the technical detail.';

/**
 * Logs raw provider errors to the server console only; CSV/Notes use a non-technical line.
 * @param {object} t
 * @param {object} w
 */
function mergeSourceErrors(t, w) {
  const raw = [t?.error, w?.error].filter(Boolean);
  if (raw.length > 0) {
    console.warn(
      '[securityFindingsExport] integration error (not for end users, not raw in CSV):',
      raw.join(' | '),
    );
  }
  return raw.length > 0 ? USER_NOTE_INTEGRATION_INCOMPLETE : '';
}

/**
 * @param {object} t
 * @param {object} w
 * @param {string[]} pout
 * @param {string} err
 */
function combinedRowData(t, w, pout, err) {
  const row = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  addSev(row, t);
  addSev(row, w);
  const notes = err || '';
  return { ...row, sources: sourceColumn(pout), notes: notes || '' };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} companyId
 * @param { 'all' | { from?: string, to?: string, all?: boolean } } tr
 * @param { (s: string) => void | Promise<void> } [onProgress]
 * @param { { WIZ?: boolean } } [providers] - omit in practice disallowed; defaults true
 */
export async function buildSecurityFindingsCsv(
  prisma,
  {
    companyIds,
    /** @type { 'all' | { from?: string, to?: string, all?: boolean } } */ timeRange,
    /** @type { boolean } */ separateByApp,
    /** @type { (s: string) => void | Promise<void> } */ onProgress = () => {},
    /** @type { { WIZ?: boolean } } */ providers: providersArg,
  },
) {
  const pNorm = parseExportProviders(providersArg);
  const includeWiz = pNorm[PROVIDER_WIZ];
  const tr = timeRange;
  const ids = Array.isArray(companyIds) && companyIds.length > 0 ? companyIds : [];
  if (ids.length === 0) {
    return `\uFEFF# error: no companies selected\ncsv,empty\n`;
  }
  const companies = await prisma.company.findMany({
    where: { id: { in: ids } },
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { applications: true } },
      companyToolLinks: { select: { provider: true, filter: true } },
      applications: {
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          applicationToolLinks: { select: { provider: true, filter: true } },
        },
      },
    },
  });
  /** Admin, multiple companies, separate by app: company summary rows first, then all app rows; no "Applications total". */
  const isAdminMultiByApp = separateByApp && ids.length > 1;
  const meta1 = {
    type: 'security_findings',
    generatedAt: new Date().toISOString(),
    time: tr?.all ? 'all' : 'range',
    timeFrom: tr?.all ? '' : (tr && tr.from) || '',
    timeTo: tr?.all ? '' : (tr && tr.to) || '',
    companies: companyIds.length,
    providers: {
      WIZ_SAST: includeWiz,
    },
  };
  const firstLine = `# ${JSON.stringify(meta1)}`;
  const rows = /** @type {string[][]} */ ([
    [firstLine],
    [],
    [
      'Row',
      'Application',
      'Company',
      'Applications count',
      'Critical',
      'High',
      'Medium',
      'Low',
      'Info',
      'Total findings',
      'Sources used',
      'Notes',
    ],
  ]);
  let cIdx = 0;
  await Promise.resolve(
    onProgress(
      `Starting export for ${companies.length} company/companies - Wiz may take many minutes...`,
    ),
  );
  if (isAdminMultiByApp) {
    const companyBlock = /** @type {string[][]} */ ([]);
    const appBlock = /** @type {string[][]} */ ([]);
    for (const co of companies) {
      cIdx += 1;
      await Promise.resolve(
        onProgress(
          `Processing ${co.name} (${cIdx} of ${companies.length}) - Wiz in progress, may take minutes...`,
        ),
      );
      const coWlink = co.companyToolLinks.find((l) => l.provider === PROVIDER_WIZ);
      if (coWlink) {
        const w0 = includeWiz
          ? await wizFor(co.id, coWlink.filter, tr)
          : emptySev();
        const p0 = /** @type {string[]} */ ([]);
        if (includeWiz) p0.push(PROVIDER_WIZ);
        const wPart = w0 || { critical: 0, high: 0, medium: 0, low: 0, info: 0, error: null };
        const emsg = mergeSourceErrors(null, wPart);
        const cd = combinedRowData(
          null,
          wPart,
          p0,
          emsg,
        );
        const tot = cd.critical + cd.high + cd.medium + cd.low + cd.info;
        companyBlock.push([
          co.name,
          '',
          co.name,
          '',
          String(cd.critical),
          String(cd.high),
          String(cd.medium),
          String(cd.low),
          String(cd.info),
          String(tot),
          cd.sources,
          cd.notes,
        ]);
      }
      for (const app of co.applications) {
        const wL = app.applicationToolLinks.find((l) => l.provider === PROVIDER_WIZ);
        if (!wL) {
          appBlock.push([
            'Application',
            app.name,
            co.name,
            '1',
            '0',
            '0',
            '0',
            '0',
            '0',
            '0',
            '',
            '',
          ]);
          continue;
        }
        const w0 = includeWiz
          ? await wizFor(co.id, wL.filter, tr)
          : emptySev();
        const p0 = /** @type {string[]} */ ([]);
        if (includeWiz) {
          p0.push(PROVIDER_WIZ);
        }
        const emsg2 = mergeSourceErrors(null, w0);
        const cd = combinedRowData(
          null,
          w0,
          p0,
          emsg2,
        );
        const tot2 = cd.critical + cd.high + cd.medium + cd.low + cd.info;
        appBlock.push([
          'Application',
          app.name,
          co.name,
          '1',
          String(cd.critical),
          String(cd.high),
          String(cd.medium),
          String(cd.low),
          String(cd.info),
          String(tot2),
          cd.sources,
          cd.notes,
        ]);
      }
      await Promise.resolve(
        onProgress(
          cIdx < companies.length
            ? `Finished ${co.name} - continuing...`
            : `Finished ${co.name} - building CSV file...`,
        ),
      );
    }
    for (const r of companyBlock) {
      rows.push(r);
    }
    for (const r of appBlock) {
      rows.push(r);
    }
  } else {
  for (const co of companies) {
    cIdx += 1;
    await Promise.resolve(
      onProgress(
        `Processing ${co.name} (${cIdx} of ${companies.length}) - Wiz in progress, may take minutes...`,
      ),
    );

    const coWlink = co.companyToolLinks.find((l) => l.provider === PROVIDER_WIZ);
    if (!separateByApp) {
      let w0 = /** @type {{ critical: number, high: number, medium: number, low: number, info: number, error?: string | null }} */(emptySev());
      const p0 = /** @type {string[]} */ ([]);
      if (includeWiz) {
        if (coWlink) {
          w0 = await wizFor(co.id, coWlink.filter, tr);
          p0.push(PROVIDER_WIZ);
        } else {
          for (const app of co.applications) {
            const wL = app.applicationToolLinks.find((l) => l.provider === PROVIDER_WIZ);
            if (wL) {
              const part = await wizFor(co.id, wL.filter, tr);
              addSev(w0, part);
              if (!p0.includes(PROVIDER_WIZ)) {
                p0.push(PROVIDER_WIZ);
              }
            }
          }
        }
      } else {
        w0 = emptySev();
      }
      const emsg = mergeSourceErrors(null, w0);
      const cd = combinedRowData(null, w0, p0, emsg);
      const total =
        cd.critical + cd.high + cd.medium + cd.low + cd.info;
      rows.push([
        'Company (aggregated)',
        '',
        co.name,
        String(co._count.applications),
        String(cd.critical),
        String(cd.high),
        String(cd.medium),
        String(cd.low),
        String(cd.info),
        String(total),
        cd.sources,
        cd.notes,
      ]);
      continue;
    }
    const appSubtot = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    if (coWlink) {
      const w0 = includeWiz
        ? await wizFor(co.id, coWlink.filter, tr)
        : emptySev();
      const p0 = /** @type {string[]} */ ([]);
      if (includeWiz) p0.push(PROVIDER_WIZ);
      const wPart = w0 || { critical: 0, high: 0, medium: 0, low: 0, info: 0, error: null };
      const emsg = mergeSourceErrors(null, wPart);
      const cd = combinedRowData(
        null,
        wPart,
        p0,
        emsg,
      );
      const tot =
        cd.critical + cd.high + cd.medium + cd.low + cd.info;
      rows.push([
        co.name,
        '',
        co.name,
        '',
        String(cd.critical),
        String(cd.high),
        String(cd.medium),
        String(cd.low),
        String(cd.info),
        String(tot),
        cd.sources,
        cd.notes,
      ]);
    }
    for (const app of co.applications) {
      const wL = app.applicationToolLinks.find((l) => l.provider === PROVIDER_WIZ);
      if (!wL) {
        const z = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
        addSev(appSubtot, z);
        rows.push([
          'Application',
          app.name,
          co.name,
          '1',
          '0',
          '0',
          '0',
          '0',
          '0',
          '0',
          '',
          '',
        ]);
        continue;
      }
      const w0 = includeWiz
        ? await wizFor(co.id, wL.filter, tr)
        : emptySev();
      const p0 = /** @type {string[]} */ ([]);
      if (includeWiz) {
        p0.push(PROVIDER_WIZ);
      }
      const emsg2 = mergeSourceErrors(null, w0);
      const cd = combinedRowData(
        null,
        w0,
        p0,
        emsg2,
      );
      const tot =
        cd.critical + cd.high + cd.medium + cd.low + cd.info;
      rows.push([
        'Application',
        app.name,
        co.name,
        '1',
        String(cd.critical),
        String(cd.high),
        String(cd.medium),
        String(cd.low),
        String(cd.info),
        String(tot),
        cd.sources,
        cd.notes,
      ]);
      addSev(appSubtot, cd);
    }
    if (co.applications.length > 0) {
      const tsumA =
        appSubtot.critical +
        appSubtot.high +
        appSubtot.medium +
        appSubtot.low +
        appSubtot.info;
      rows.push([
        'Applications total',
        '',
        co.name,
        String(co._count.applications),
        String(appSubtot.critical),
        String(appSubtot.high),
        String(appSubtot.medium),
        String(appSubtot.low),
        String(appSubtot.info),
        String(tsumA),
        '',
        'Sum of application lines above. Compare to the company line if you use both; vendors may not match.',
      ]);
    }
    await Promise.resolve(
      onProgress(
        cIdx < companies.length
          ? `Finished ${co.name} - continuing...`
          : `Finished ${co.name} - building CSV file...`,
      ),
    );
  }
  }
  return '\uFEFF' + rows.map((r) => r.map(esc).join(',')).join('\n') + '\n';
}

/**
 * Admin preview: companies with # apps and linked tools (company + per-app)
 */
export async function getExportPreviewList(prisma, { companyIds }) {
  const where = companyIds?.length
    ? { id: { in: companyIds } }
    : {};
  const list = await prisma.company.findMany({
    where: Object.keys(where).length ? where : undefined,
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { applications: true } },
      companyToolLinks: { select: { provider: true } },
    },
  });
  const cids = list.map((c) => c.id);
  const appLinks = cids.length
    ? await prisma.applicationToolLink.findMany({
        where: { application: { companyId: { in: cids } } },
        select: { provider: true, application: { select: { companyId: true } } },
      })
    : [];
  const byCompany = new Map();
  for (const al of appLinks) {
    const id = al.application?.companyId;
    if (!id) {
      continue;
    }
    if (!byCompany.has(id)) {
      byCompany.set(id, new Set());
    }
    byCompany.get(id).add(al.provider);
  }
  return list.map((c) => {
    const s = new Set(c.companyToolLinks.map((l) => l.provider));
    const a = byCompany.get(c.id);
    if (a) {
      for (const p of a) {
        s.add(p);
      }
    }
    return {
      id: c.id,
      name: c.name,
      applicationCount: c._count.applications,
      integrations: [...s].map(labelProvider),
    };
  });
}
