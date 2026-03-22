import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const DEFAULT_PREFERENCES = {
  timeZone: 'UTC',
  campaignUpdate: true,
  responseAlerts: true,
  influencerActivity: true,
};

async function main() {
  console.log('Seeding preferences for existing users...');

  // Set default preferences for all users (idempotent - safe to run multiple times)
  const result = await prisma.user.updateMany({
    data: DEFAULT_PREFERENCES,
  });

  console.log(`Updated preferences for ${result.count} user(s)`);
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
