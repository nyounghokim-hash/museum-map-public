import { PrismaClient } from '../generated_v2/client'

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined
}

const prisma = globalForPrisma.prisma ?? new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
})

// Cache in ALL environments (critical for serverless connection pooling)
globalForPrisma.prisma = prisma

export { prisma }
