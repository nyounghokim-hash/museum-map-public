import { Prisma } from '../generated_v2/client';

export const privateMuseumWhere = {
    OR: [
        { sourceAttribution: { equals: Prisma.DbNull } },
        { sourceAttribution: { path: ['visibility'], equals: Prisma.AnyNull } },
        { sourceAttribution: { path: ['visibility'], equals: 'PUBLIC' } },
        { sourceAttribution: { path: ['visibility'], equals: 'public' } },
    ],
} as const;
