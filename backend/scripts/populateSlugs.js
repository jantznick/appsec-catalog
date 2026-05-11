import { prisma } from '../prisma/client.js';
import { generateSlug, ensureUniqueSlug } from '../utils/slug.js';

async function populateSlugs() {
  try {
    console.log('Fetching all companies...');
    const companies = await prisma.company.findMany();

    console.log(`Found ${companies.length} companies without slugs`);

    for (const company of companies) {
      const baseSlug = generateSlug(company.name);
      const slug = await ensureUniqueSlug(baseSlug, company.id);
      
      await prisma.company.update({
        where: { id: company.id },
        data: { slug },
      });
      
      console.log(`Updated ${company.name} -> ${slug}`);
    }

    console.log('Done! All companies now have slugs.');
  } catch (error) {
    console.error('Error populating slugs:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

populateSlugs();

