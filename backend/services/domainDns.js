import dns from 'node:dns/promises';

const DEFAULT_DKIM_SELECTORS = ['default', 'selector1', 'selector2', 'google', 'k1'];
const NON_FATAL_DNS_ERROR_CODES = new Set(['ENODATA', 'ENOTFOUND', 'ESERVFAIL', 'ETIMEOUT']);

function stringifyRecords(value) {
  return JSON.stringify(value ?? null);
}

function parseJsonField(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function dedupeAndSortStrings(values = []) {
  return [...new Set(values.filter(Boolean).map((v) => String(v).trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function normalizeMxRecords(records = []) {
  const normalized = records
    .filter(Boolean)
    .map((record) => ({
      exchange: String(record.exchange || '').trim().toLowerCase(),
      priority: Number(record.priority || 0),
    }))
    .filter((record) => record.exchange);
  return normalized.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.exchange.localeCompare(b.exchange);
  });
}

function flattenTxtRecords(txtRecords = []) {
  return dedupeAndSortStrings(
    txtRecords
      .map((entry) => (Array.isArray(entry) ? entry.join('') : String(entry)))
      .map((value) => value.trim())
  );
}

async function safeResolve(hostname, type) {
  try {
    const records = await dns.resolve(hostname, type);
    return { records, error: null };
  } catch (error) {
    return { records: null, error };
  }
}

function classifyChange(previousValue, currentValue) {
  const prevEmpty = previousValue == null || (Array.isArray(previousValue) && previousValue.length === 0) || previousValue === '';
  const currEmpty = currentValue == null || (Array.isArray(currentValue) && currentValue.length === 0) || currentValue === '';

  if (prevEmpty && !currEmpty) return 'record_added';
  if (!prevEmpty && currEmpty) return 'record_removed';
  return 'record_changed';
}

function getSeverityForType(recordType) {
  if (['A', 'AAAA', 'CNAME', 'MX', 'NS', 'DMARC', 'DKIM'].includes(recordType)) {
    return 'warning';
  }
  return 'info';
}

export async function runDnsCheck(domainName) {
  const errors = [];

  const [cnameLookup, aLookup, aaaaLookup, txtLookup, mxLookup, nsLookup, dmarcLookup] = await Promise.all([
    safeResolve(domainName, 'CNAME'),
    safeResolve(domainName, 'A'),
    safeResolve(domainName, 'AAAA'),
    safeResolve(domainName, 'TXT'),
    safeResolve(domainName, 'MX'),
    safeResolve(domainName, 'NS'),
    safeResolve(`_dmarc.${domainName}`, 'TXT'),
  ]);

  const cnameRecords = dedupeAndSortStrings(cnameLookup.records || []);
  const aRecords = dedupeAndSortStrings(aLookup.records || []);
  const aaaaRecords = dedupeAndSortStrings(aaaaLookup.records || []);
  const txtRecords = flattenTxtRecords(txtLookup.records || []);
  const mxRecords = normalizeMxRecords(mxLookup.records || []);
  const nsRecords = dedupeAndSortStrings(nsLookup.records || []);
  const dmarcRecords = flattenTxtRecords(dmarcLookup.records || []);

  const spfRecord = txtRecords.find((record) => record.toLowerCase().startsWith('v=spf1')) || null;
  const dmarcRecord = dmarcRecords.find((record) => record.toLowerCase().startsWith('v=dmarc1')) || null;

  const dkimResult = {};
  for (const selector of DEFAULT_DKIM_SELECTORS) {
    const host = `${selector}._domainkey.${domainName}`;
    const lookup = await safeResolve(host, 'TXT');
    if (lookup.error && !NON_FATAL_DNS_ERROR_CODES.has(lookup.error?.code)) {
      errors.push(`DKIM ${selector}: ${lookup.error.message}`);
    }
    dkimResult[selector] = flattenTxtRecords(lookup.records || []);
  }

  const baseLookups = [
    ['CNAME', cnameLookup.error],
    ['A', aLookup.error],
    ['AAAA', aaaaLookup.error],
    ['TXT', txtLookup.error],
    ['MX', mxLookup.error],
    ['NS', nsLookup.error],
    ['DMARC', dmarcLookup.error],
  ];

  for (const [type, error] of baseLookups) {
    if (!error) continue;
    if (!NON_FATAL_DNS_ERROR_CODES.has(error?.code)) {
      errors.push(`${type}: ${error.message}`);
    }
  }

  const status = errors.length > 0 ? 'warning' : 'ok';

  return {
    status,
    error: errors.length > 0 ? errors.join('; ') : null,
    cnameRecords,
    aRecords,
    aaaaRecords,
    txtRecords,
    mxRecords,
    nsRecords,
    spfRecord,
    dmarcRecord,
    dkimRecords: dkimResult,
  };
}

export function buildSnapshotCreateData(domainId, userId, checkResult) {
  return {
    domainId,
    createdBy: userId || null,
    status: checkResult.status,
    error: checkResult.error,
    cnameRecords: stringifyRecords(checkResult.cnameRecords),
    aRecords: stringifyRecords(checkResult.aRecords),
    aaaaRecords: stringifyRecords(checkResult.aaaaRecords),
    txtRecords: stringifyRecords(checkResult.txtRecords),
    mxRecords: stringifyRecords(checkResult.mxRecords),
    nsRecords: stringifyRecords(checkResult.nsRecords),
    spfRecord: checkResult.spfRecord || null,
    dmarcRecord: checkResult.dmarcRecord || null,
    dkimRecords: stringifyRecords(checkResult.dkimRecords),
  };
}

export function detectDnsChanges(previousSnapshot, currentSnapshot) {
  if (!previousSnapshot) {
    return [];
  }

  const fields = [
    { type: 'CNAME', key: 'cnameRecords' },
    { type: 'A', key: 'aRecords' },
    { type: 'AAAA', key: 'aaaaRecords' },
    { type: 'TXT', key: 'txtRecords' },
    { type: 'MX', key: 'mxRecords' },
    { type: 'NS', key: 'nsRecords' },
    { type: 'DKIM', key: 'dkimRecords' },
    { type: 'SPF', key: 'spfRecord' },
    { type: 'DMARC', key: 'dmarcRecord' },
  ];

  const changes = [];
  for (const field of fields) {
    const previousValue = field.key.endsWith('Record') && !field.key.endsWith('Records')
      ? previousSnapshot[field.key] || null
      : parseJsonField(previousSnapshot[field.key]);
    const currentValue = field.key.endsWith('Record') && !field.key.endsWith('Records')
      ? currentSnapshot[field.key] || null
      : parseJsonField(currentSnapshot[field.key]);

    if (JSON.stringify(previousValue) === JSON.stringify(currentValue)) {
      continue;
    }

    changes.push({
      recordType: field.type,
      changeType: classifyChange(previousValue, currentValue),
      severity: getSeverityForType(field.type),
      summary: `${field.type} records changed`,
      details: JSON.stringify({
        previous: previousValue,
        current: currentValue,
      }),
    });
  }

  return changes;
}
