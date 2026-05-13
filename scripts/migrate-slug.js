const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Generate random short slug
function generateShortSlug() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let slug = '';
  for (let i = 0; i < 8; i++) {
    slug += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return slug;
}

async function migrateSlug() {
  try {
    console.log('Starting slug migration...');

    // Get all businesses
    const businesses = await prisma.business.findMany();
    console.log(`Found ${businesses.length} businesses`);

    for (const business of businesses) {
      // Check if slug contains email-like pattern (has @ or .)
      if (business.slug.includes('@') || business.slug.includes('-') && business.slug.length > 20) {
        console.log(`Migrating slug for business ${business.id} (${business.name})`);
        console.log(`  Old slug: ${business.slug}`);

        // Generate unique short slug
        let newSlug;
        let attempts = 0;
        const maxAttempts = 10;

        do {
          newSlug = generateShortSlug();
          attempts++;
          const existing = await prisma.business.findUnique({ where: { slug: newSlug } });
          if (!existing) break;
        } while (attempts < maxAttempts);

        if (attempts >= maxAttempts) {
          console.error(`Failed to generate unique slug for business ${business.id}`);
          continue;
        }

        // Update business slug
        await prisma.business.update({
          where: { id: business.id },
          data: { slug: newSlug }
        });

        console.log(`  New slug: ${newSlug}`);
      }
    }

    console.log('Slug migration completed successfully');
  } catch (error) {
    console.error('Error during migration:', error);
  } finally {
    await prisma.$disconnect();
  }
}

migrateSlug();
