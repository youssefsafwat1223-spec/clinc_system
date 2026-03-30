const { PrismaClient } = require('@prisma/client');

// Singleton PrismaClient to prevent multiple connections
let prisma;
const runtimeDbUrl =
  process.env.PRISMA_RUNTIME_URL ||
  (process.env.NODE_ENV !== 'production' && process.env.DIRECT_URL) ||
  process.env.DATABASE_URL;

const createPrismaClient = () =>
  new PrismaClient(
    runtimeDbUrl
      ? {
          datasources: {
            db: {
              url: runtimeDbUrl,
            },
          },
        }
      : undefined
  );

if (process.env.NODE_ENV === 'production') {
  prisma = createPrismaClient();
} else {
  // In development, reuse the same instance across hot reloads
  if (!global.__prisma) {
    global.__prisma = createPrismaClient();
  }
  prisma = global.__prisma;
}

module.exports = prisma;
