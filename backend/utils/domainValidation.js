/**
 * Validates a domain name format
 * @param {string} domain - The domain to validate
 * @returns {boolean} - True if valid, false otherwise
 */
export function isValidDomain(domain) {
  if (!domain || typeof domain !== 'string') {
    return false;
  }

  // Trim whitespace
  const trimmed = domain.trim();

  // Must not be empty
  if (trimmed.length === 0) {
    return false;
  }

  // Must not include http:// or https://
  if (trimmed.toLowerCase().startsWith('http://') || trimmed.toLowerCase().startsWith('https://')) {
    return false;
  }

  // Must not include protocol or path
  if (trimmed.includes('://') || trimmed.includes('/') || trimmed.includes('?')) {
    return false;
  }

  // Basic domain regex: allows subdomains, letters, numbers, dots, and hyphens
  // Pattern: (subdomain.)*domain.tld
  // Examples: example.com, subdomain.example.com, api.v1.example.com
  const domainRegex = /^([a-z0-9]([a-z0-9\-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

  if (!domainRegex.test(trimmed)) {
    return false;
  }

  // Additional checks
  // Must not start or end with a dot or hyphen
  if (trimmed.startsWith('.') || trimmed.endsWith('.') || trimmed.startsWith('-') || trimmed.endsWith('-')) {
    return false;
  }

  // Must not have consecutive dots
  if (trimmed.includes('..')) {
    return false;
  }

  // Must have at least one dot (for TLD)
  if (!trimmed.includes('.')) {
    return false;
  }

  // Each part between dots must be 1-63 characters
  const parts = trimmed.split('.');
  for (const part of parts) {
    if (part.length === 0 || part.length > 63) {
      return false;
    }
  }

  // TLD must be at least 2 characters
  const tld = parts[parts.length - 1];
  if (tld.length < 2) {
    return false;
  }

  return true;
}

/**
 * Normalizes a domain name (lowercase, trim)
 * @param {string} domain - The domain to normalize
 * @returns {string} - Normalized domain
 */
export function normalizeDomain(domain) {
  if (!domain || typeof domain !== 'string') {
    return '';
  }
  return domain.trim().toLowerCase();
}







