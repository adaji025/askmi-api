import 'dotenv/config';
import bcrypt from 'bcrypt';
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

const SEED_ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@askmi.com';
const SEED_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'Admin@123';
const SEED_ADMIN_FULLNAME = process.env.SEED_ADMIN_FULLNAME || 'Admin User';

async function main() {
  console.log('Seeding...');

  // 1. Seed admin user (upsert - creates if not exists, updates password if exists)
  const hashedPassword = await bcrypt.hash(SEED_ADMIN_PASSWORD, 10);
  const admin = await prisma.user.upsert({
    where: { email: SEED_ADMIN_EMAIL },
    update: { password: hashedPassword, fullName: SEED_ADMIN_FULLNAME },
    create: {
      email: SEED_ADMIN_EMAIL,
      fullName: SEED_ADMIN_FULLNAME,
      password: hashedPassword,
      role: 'admin',
      isApproved: true,
    },
  });
  console.log(`Admin user: ${admin.email} (id: ${admin.id})`);
  if (!process.env.SEED_ADMIN_PASSWORD) {
    console.warn('Using default password. Set SEED_ADMIN_PASSWORD in .env for production.');
  }

  // 2. Set default preferences for all users
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
