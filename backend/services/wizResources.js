import { prisma } from '../prisma/client.js';
import { resolveIntegrationForCompany } from '../integrations/resolve.js';
import { listWizResourcesForFolder } from '../integrations/wiz.js';

/**
 * Composing the Wiz resource filter for a product or an application.
 *
 * THE FILTER, IN ORDER
 *
 *   company -> Wiz folder       REQUIRED. No folder, no call is made at all.
 *   product -> assigned tag     optional
 *   application -> assigned tag required on an application page
 *
 * Environment and Role are read off each resource and returned as context. They
 * take no part in deciding which resources these are.
 *
 * ONE IMPLEMENTATION FOR BOTH PAGES. A product page and an application page ask
 * the same question with one more filter on it, and writing that twice is how
 * two screens come to disagree about which resources an application runs on.
 */

const PROVIDER_WIZ = 'WIZ';

/** No folder is not an error - it is a company that has not been linked yet. */
export const NOT_CONFIGURED = Object.freeze({
  configured: false,
  resources: [],
  scanned: 0,
  errors: [],
});

/**
 * The tag value assigned to a record, or null.
 * @param {{ filter?: unknown }|null|undefined} link
 */
function tagValueOf(link) {
  const filter = link?.filter;
  if (!filter || typeof filter !== 'object') return null;
  const value = /** @type {{ tagValue?: unknown }} */ (filter).tagValue;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/**
 * The folder for a company, or null when it has no Wiz link.
 * @param {string} companyId
 */
export async function wizFolderForCompany(companyId) {
  if (!companyId) return null;
  const link = await prisma.companyToolLink.findFirst({
    where: { companyId, provider: PROVIDER_WIZ },
    select: { filter: true },
  });
  const folderId = /** @type {{ folderId?: unknown }} */ (link?.filter)?.folderId;
  return typeof folderId === 'string' && folderId.trim() ? folderId.trim() : null;
}

/**
 * The product tag value to filter an application by, and why it is or is not set.
 *
 * An application in SEVERAL products is filtered by folder and application alone
 * rather than guessing which product. Less specific beats wrong: an application's
 * resources all have to come back, and losing one because the wrong product was
 * picked is the worse failure. The reason is returned so the UI can say so rather
 * than leaving someone wondering why a page is broader than they expected.
 *
 * @param {Array<{ product: { id: string, name: string } }>} productApplications
 * @returns {Promise<{ value: string|null, reason: string, productName: string|null }>}
 */
export async function productTagForApplication(productApplications) {
  const products = (productApplications || []).map((pa) => pa.product).filter(Boolean);

  if (products.length === 0) {
    return { value: null, reason: 'no_product', productName: null };
  }
  if (products.length > 1) {
    return { value: null, reason: 'multiple_products', productName: null };
  }

  const link = await prisma.productToolLink.findFirst({
    where: { productId: products[0].id, provider: PROVIDER_WIZ },
    select: { filter: true },
  });
  const value = tagValueOf(link);
  return {
    value,
    reason: value ? 'product' : 'product_untagged',
    productName: products[0].name || null,
  };
}

/**
 * Fetch the resources matching a folder, and optionally a product and application.
 *
 * Returns `configured: false` rather than throwing when the company has no folder
 * or the record has no assigned tag value. Neither is a failure - it is a thing
 * somebody has not set up yet, and a page should say which.
 *
 * @param {object} args
 * @param {string} args.companyId
 * @param {string|null} [args.productValue]
 * @param {string|null} [args.applicationValue]
 * @param {string[]} [args.types]
 */
export async function fetchWizResources({ companyId, productValue, applicationValue, types }) {
  const folderId = await wizFolderForCompany(companyId);
  if (!folderId) {
    return { ...NOT_CONFIGURED, missing: 'folder' };
  }
  if (!productValue && !applicationValue) {
    // Without either, this would be the whole folder - every resource the company
    // owns, on a page about one record. That is not a useful answer, and the
    // honest response is "nothing is assigned yet".
    return { ...NOT_CONFIGURED, missing: 'tagValue', folderId };
  }

  const creds = await resolveIntegrationForCompany(companyId, PROVIDER_WIZ);
  if (!creds?.decrypted?.clientId || !creds?.decrypted?.clientSecret) {
    return { ...NOT_CONFIGURED, missing: 'credentials', folderId };
  }

  const result = await listWizResourcesForFolder(creds.decrypted, creds.baseUrl || '', folderId, {
    productValue: productValue || null,
    applicationValue: applicationValue || null,
    types,
  });

  return {
    configured: true,
    folderId,
    productValue: productValue || null,
    applicationValue: applicationValue || null,
    ...result,
  };
}

/** The Wiz tag value assigned to one product. */
export async function wizTagForProduct(productId) {
  const link = await prisma.productToolLink.findFirst({
    where: { productId, provider: PROVIDER_WIZ },
    select: { filter: true },
  });
  return tagValueOf(link);
}

/** The Wiz tag value assigned to one application. */
export async function wizTagForApplication(applicationId) {
  const link = await prisma.applicationToolLink.findFirst({
    where: { applicationId, provider: PROVIDER_WIZ },
    select: { filter: true },
  });
  return tagValueOf(link);
}
