import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';

/** Creates/updates the first ADMIN from ADMIN_EMAIL / ADMIN_PASSWORD (.env). */
const email = process.env.ADMIN_EMAIL?.toLowerCase();
const password = process.env.ADMIN_PASSWORD;
if (!email || !password) throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD');

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const passwordHash = await bcrypt.hash(password, 10);
await prisma.user.upsert({
  where: { email },
  create: { email, passwordHash, name: process.env.ADMIN_NAME ?? 'Admin', role: 'ADMIN' },
  update: { passwordHash, role: 'ADMIN' },
});
console.log(`Admin ready: ${email}`);
await prisma.$disconnect();
