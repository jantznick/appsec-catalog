const MAX_METADATA_SCORE = 50;
const MAX_DNS_SCORE = 50;

const DNS_CHECK_WEIGHTS = {
  spf: 10,
  dmarc: 10,
  dkim: 10,
  mxHygiene: 8,
  caa: 5,
  dnssec: 5,
  riskyTxt: 2,
};

function toLower(value) {
  return String(value || '').trim().toLowerCase();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function parseScoreBreakdown(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function calculateDomainMetadataScore(domain) {
  const checks = [
    {
      id: 'description',
      label: 'Description provided',
      passed: Boolean(domain?.description && String(domain.description).trim()),
      recommendation: 'Add a short description explaining domain purpose and environment.',
    },
    {
      id: 'owner',
      label: 'Owner/contact provided',
      passed: Boolean(domain?.owner && String(domain.owner).trim()),
      recommendation: 'Add owner or contact details for incident response and maintenance.',
    },
    {
      id: 'status',
      label: 'Status set',
      passed: Boolean(domain?.status && toLower(domain.status) !== 'unknown'),
      recommendation: 'Set domain status to active, parked, or deprecated.',
    },
  ];

  const passedCount = checks.filter((check) => check.passed).length;
  const metadataScore = Math.round((passedCount / checks.length) * MAX_METADATA_SCORE);

  return {
    metadataScore,
    checks,
    summary: `${passedCount}/${checks.length} metadata checks passed`,
  };
}

function hasDkimRecord(dkimRecords) {
  if (!dkimRecords || typeof dkimRecords !== 'object') return false;
  return Object.values(dkimRecords).some((selectorRecords) => (
    Array.isArray(selectorRecords) && selectorRecords.length > 0
  ));
}

function hasRiskyTxtPattern(txtRecords) {
  const riskyPatterns = ['v=spf1 +all', 'v=spf1 ?all', 'v=spf1 redirect='];
  const normalized = (txtRecords || []).map((value) => toLower(value));
  return normalized.some((value) => riskyPatterns.some((pattern) => value.includes(pattern)));
}

export function calculateDnsSecurityScore(checkResult) {
  const hasMx = Array.isArray(checkResult?.mxRecords) && checkResult.mxRecords.length > 0;
  const hasSpf = toLower(checkResult?.spfRecord).startsWith('v=spf1');
  const hasDmarc = toLower(checkResult?.dmarcRecord).startsWith('v=dmarc1');
  const hasDkim = hasDkimRecord(checkResult?.dkimRecords);
  const hasCaa = Array.isArray(checkResult?.caaRecords) && checkResult.caaRecords.length > 0;
  const hasDnssec = Boolean(checkResult?.dnssecEnabled);
  const riskyTxtDetected = hasRiskyTxtPattern(checkResult?.txtRecords);

  const checks = [
    {
      id: 'spf',
      label: 'SPF policy is configured',
      passed: hasSpf,
      points: DNS_CHECK_WEIGHTS.spf,
      recommendation: 'Publish SPF record starting with v=spf1.',
    },
    {
      id: 'dmarc',
      label: 'DMARC policy is configured',
      passed: hasDmarc,
      points: DNS_CHECK_WEIGHTS.dmarc,
      recommendation: 'Publish _dmarc TXT record starting with v=DMARC1.',
    },
    {
      id: 'dkim',
      label: 'At least one DKIM selector is published',
      passed: hasDkim,
      points: DNS_CHECK_WEIGHTS.dkim,
      recommendation: 'Publish at least one DKIM TXT record for active selectors.',
    },
    {
      id: 'mxHygiene',
      label: 'Email domain hygiene (MX + SPF + DMARC)',
      passed: !hasMx || (hasSpf && hasDmarc),
      points: DNS_CHECK_WEIGHTS.mxHygiene,
      recommendation: 'Domains with MX should have both SPF and DMARC configured.',
    },
    {
      id: 'caa',
      label: 'CAA certificate restrictions configured',
      passed: hasCaa,
      points: DNS_CHECK_WEIGHTS.caa,
      recommendation: 'Add CAA records to constrain certificate issuance.',
    },
    {
      id: 'dnssec',
      label: 'DNSSEC appears enabled',
      passed: hasDnssec,
      points: DNS_CHECK_WEIGHTS.dnssec,
      recommendation: 'Enable DNSSEC and publish DS records at the registrar.',
    },
  ];

  const baseScore = checks
    .filter((check) => check.passed)
    .reduce((total, check) => total + check.points, 0);

  const riskyTxtPenalty = riskyTxtDetected ? DNS_CHECK_WEIGHTS.riskyTxt : 0;
  const dnsSecurityScore = clamp(baseScore - riskyTxtPenalty, 0, MAX_DNS_SCORE);

  return {
    dnsSecurityScore,
    riskyTxtDetected,
    riskyTxtPenalty,
    checks,
    summary: `DNS checks score ${dnsSecurityScore}/${MAX_DNS_SCORE}`,
  };
}

export function buildDomainDnsScore(domain, checkResult) {
  const metadata = calculateDomainMetadataScore(domain);
  const dns = calculateDnsSecurityScore(checkResult);
  const totalSecurityScore = clamp(metadata.metadataScore + dns.dnsSecurityScore, 0, 100);

  const recommendations = [
    ...metadata.checks.filter((check) => !check.passed).map((check) => check.recommendation),
    ...dns.checks.filter((check) => !check.passed).map((check) => check.recommendation),
  ];
  if (dns.riskyTxtDetected) {
    recommendations.push('Remove risky TXT patterns (for example SPF +all, ?all, or unsafe redirect usage).');
  }

  return {
    metadataScore: metadata.metadataScore,
    dnsSecurityScore: dns.dnsSecurityScore,
    totalSecurityScore,
    breakdown: {
      metadata: {
        maxScore: MAX_METADATA_SCORE,
        score: metadata.metadataScore,
        summary: metadata.summary,
        checks: metadata.checks,
      },
      dns: {
        maxScore: MAX_DNS_SCORE,
        score: dns.dnsSecurityScore,
        summary: dns.summary,
        riskyTxtDetected: dns.riskyTxtDetected,
        riskyTxtPenalty: dns.riskyTxtPenalty,
        checks: dns.checks,
      },
      recommendations: [...new Set(recommendations)],
    },
  };
}

export function recomputeSnapshotScoreForMetadata(domain, snapshot) {
  const metadata = calculateDomainMetadataScore(domain);
  const existingBreakdown = parseScoreBreakdown(snapshot?.scoreBreakdown);
  const dnsChecks = Array.isArray(existingBreakdown?.dns?.checks) ? existingBreakdown.dns.checks : [];
  const riskyTxtDetected = Boolean(existingBreakdown?.dns?.riskyTxtDetected);
  const dnsSecurityScore = Number(snapshot?.dnsSecurityScore ?? existingBreakdown?.dns?.score ?? 0);
  const totalSecurityScore = clamp(metadata.metadataScore + dnsSecurityScore, 0, 100);

  const recommendations = [
    ...metadata.checks.filter((check) => !check.passed).map((check) => check.recommendation),
    ...dnsChecks.filter((check) => !check.passed && check.recommendation).map((check) => check.recommendation),
  ];
  if (riskyTxtDetected) {
    recommendations.push('Remove risky TXT patterns (for example SPF +all, ?all, or unsafe redirect usage).');
  }

  return {
    metadataScore: metadata.metadataScore,
    dnsSecurityScore,
    totalSecurityScore,
    breakdown: {
      metadata: {
        maxScore: MAX_METADATA_SCORE,
        score: metadata.metadataScore,
        summary: metadata.summary,
        checks: metadata.checks,
      },
      dns: {
        maxScore: MAX_DNS_SCORE,
        score: dnsSecurityScore,
        summary: existingBreakdown?.dns?.summary || `DNS checks score ${dnsSecurityScore}/${MAX_DNS_SCORE}`,
        riskyTxtDetected,
        riskyTxtPenalty: Number(existingBreakdown?.dns?.riskyTxtPenalty || 0),
        checks: dnsChecks,
      },
      recommendations: [...new Set(recommendations)],
    },
  };
}
