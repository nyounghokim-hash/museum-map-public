import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/lib/api-utils';

type MuseumSnapshot = {
    id: string;
    name: string | null;
    nameKo: string | null;
    nameEn: string | null;
    nameTranslations: unknown;
    city: string | null;
    cityKo: string | null;
    cityTranslations: unknown;
    country: string | null;
    imageUrl: string | null;
};

type ArtworkRawRow = Record<string, unknown> & {
    museum_json: MuseumSnapshot | null;
};

type ArtworkWithMuseum = Record<string, unknown> & {
    id: string;
    museum?: MuseumSnapshot | null;
};

type ArtworkDb = {
    artwork: {
        count: (args: unknown) => Promise<number>;
        findMany: (args: unknown) => Promise<ArtworkWithMuseum[]>;
    };
    $queryRaw: <T>(strings: TemplateStringsArray, ...values: unknown[]) => Promise<T>;
};

const db = prisma as unknown as ArtworkDb;

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const limit = Math.min(parseInt(searchParams.get('limit') || '12'), 100);
        const cursor = searchParams.get('cursor') || undefined;
        const query = searchParams.get('q') || '';
        const random = searchParams.get('random') === 'true';
        const museumId = searchParams.get('museumId') || '';

        // Random mode: use a stable seeded order so offset pagination does not repeat items.
        if (random && !query && !museumId) {
            const offset = parseInt(searchParams.get('offset') || '0');
            const seed = (searchParams.get('seed') || 'museum-map').slice(0, 64);
            const totalCount = await db.artwork.count({ where: { image: { not: null } } });
            const artworks = await db.$queryRaw<ArtworkRawRow[]>`
                SELECT a.*, row_to_json(m.*) as museum_json
                FROM "Artwork" a
                LEFT JOIN "Museum" m ON a."museumId" = m.id
                WHERE a.image IS NOT NULL
                ORDER BY md5(a.id || ${seed}), a.id
                OFFSET ${offset}
                LIMIT ${limit}
            `;
            const result = artworks.map((a) => {
                const { museum_json: museum, ...artwork } = a;
                return {
                    ...artwork,
                    museums: museum ? [{
                        id: museum.id, name: museum.name, nameKo: museum.nameKo,
                        nameEn: museum.nameEn, nameTranslations: museum.nameTranslations,
                        city: museum.city, cityKo: museum.cityKo, cityTranslations: museum.cityTranslations,
                        country: museum.country, imageUrl: museum.imageUrl
                    }] : [],
                };
            });
            const newOffset = offset + result.length;
            const hasMore = newOffset < totalCount;
            return successResponse({ artworks: result, hasMore, nextCursor: hasMore ? String(newOffset) : null, seed });
        }

        const where = {
            ...(museumId ? { museumId } : {}),
            ...(query
                ? {
                    OR: [
                        { title: { contains: query, mode: 'insensitive' as const } },
                        { artist: { contains: query, mode: 'insensitive' as const } },
                    ],
                }
                : {}),
        };

        // Fetch artworks with direct museum relation
        const artworks = await db.artwork.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: limit + 1,
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
            include: {
                museum: {
                    select: { id: true, name: true, nameKo: true, nameEn: true, nameTranslations: true, city: true, cityKo: true, cityTranslations: true, country: true, imageUrl: true }
                }
            }
        });

        const hasMore = artworks.length > limit;
        const items = hasMore ? artworks.slice(0, limit) : artworks;
        const nextCursor = hasMore ? items[items.length - 1].id : null;

        // Transform: put museum in museums array for backward compatibility
        const result = items.map((a) => ({
            ...a,
            museums: a.museum ? [a.museum] : [],
            museum: undefined,
        }));

        return successResponse({ artworks: result, hasMore, nextCursor });
    } catch (err: unknown) {
        console.error('Fetch artworks error:', err);
        return errorResponse('INTERNAL_SERVER_ERROR', 'Failed to fetch artworks', 500);
    }
}
