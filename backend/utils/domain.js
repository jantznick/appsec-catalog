import { prisma } from '../prisma/client.js';

/**
 * Extract domain from email address
 * @param {string} email - Email address
 * @returns {string} Domain (e.g., "example.com")
 */
export function extractDomain(email) {
  const parts = email.split('@');
  if (parts.length !== 2) {
    return null;
  }
  return parts[1].toLowerCase();
}

/**
 * Find company by domain match
 * @param {string} domain - Domain to match
 * @returns {Promise<{id: string, name: string} | null>} Company if found
 */
export async function findCompanyByDomain(domain) {
  if (!domain) {
    return null;
  }

  // Companies can have multiple domains (comma-separated)
  // We need to check if the domain matches any of them
  const companies = await prisma.company.findMany({
    where: {
      domains: {
        not: null,
      },
    },
  });

  for (const company of companies) {
    if (!company.domains) continue;
    
    const companyDomains = company.domains
      .split(',')
      .map(d => d.trim().toLowerCase());
    
    if (companyDomains.includes(domain)) {
      return { id: company.id, name: company.name };
    }
  }

  return null;
}

