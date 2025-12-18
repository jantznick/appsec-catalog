import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

let prismaInstance = null;
let poolInstance = null;

function getPrisma() {
  if (prismaInstance) {
    return prismaInstance;
  }

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  // Create PostgreSQL connection pool
  poolInstance = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  // Handle pool errors (don't exit on pool errors)
  poolInstance.on('error', (err) => {
    console.error('Unexpected error on idle PostgreSQL client', err);
  });

  // Create Prisma adapter and client
  const adapter = new PrismaPg(poolInstance);
  prismaInstance = new PrismaClient({ adapter });

  return prismaInstance;
}

export const prisma = getPrisma();

export async function disconnectPrisma() {
  if (prismaInstance) {
    await prismaInstance.$disconnect();
    prismaInstance = null;
  }
  if (poolInstance) {
    await poolInstance.end();
    poolInstance = null;
  }
}
