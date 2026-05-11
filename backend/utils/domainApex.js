import { getDomain } from 'tldts';

/**
 * Compute the registrable/apex domain for a hostname.
 * Returns null when the input cannot be parsed as a valid domain.
 */
export function getApexDomain(domainName) {
  if (!domainName || typeof domainName !== 'string') {
    return null;
  }

  const normalized = domainName.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  return getDomain(normalized) || null;
}

/**
 * Build parent candidates from a full domain name.
 * Example: a.b.example.com -> [b.example.com, example.com]
 */
export function getParentDomainCandidates(domainName) {
  if (!domainName || typeof domainName !== 'string') {
    return [];
  }

  const labels = domainName.trim().toLowerCase().split('.').filter(Boolean);
  if (labels.length < 3) {
    return [];
  }

  const candidates = [];
  for (let i = 1; i < labels.length - 1; i += 1) {
    candidates.push(labels.slice(i).join('.'));
  }

  return candidates;
}
