/**
 * Generate a URL-friendly slug from a company name
 * Converts to lowercase, replaces spaces with underscores, removes special chars
 * @param {string} name - Company name
 * @returns {string} Slug
 */
export function generateSlug(name) {
  if (!name || typeof name !== 'string') {
    throw new Error('Name must be a non-empty string');
  }

  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/_+/g, '_') // Replace multiple underscores with single
    .replace(/^_|_$/g, ''); // Remove leading/trailing underscores
}

/**
 * Ensure slug is unique by appending a number if needed
 * @param {string} baseSlug - Base slug to check
 * @param {string} excludeId - Company ID to exclude from check (for updates)
 * @returns {Promise<string>} Unique slug
 */
export async function ensureUniqueSlug(baseSlug, excludeId = null) {
  const { prisma } = await import('../prisma/client.js');
  
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await prisma.company.findUnique({
      where: { slug },
      select: { id: true },
    });

    // If no existing company, or it's the same company (for updates), we're good
    if (!existing || (excludeId && existing.id === excludeId)) {
      return slug;
    }

    // Try with a number suffix
    slug = `${baseSlug}_${counter}`;
    counter++;
  }
}





