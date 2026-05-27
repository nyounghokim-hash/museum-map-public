import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/lib/api-utils';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const limit = Math.min(parseInt(searchParams.get('limit') || '12'), 100);
        const cursor = searchParams.get('cursor') || undefined;
        const query = searchParams.get('q') || '';
        const random = searchParams.get('random') === 'true';

        // Random mode: use raw SQL ORDER BY RANDOM() for true randomness
        // Support pagination via offset parameter
        if (random && !query) {
            const offset = parseInt(searchParams.get('offset') || '0');
            const totalCount = await (prisma as any).artwork.count({ where: { image: { not: null } } });
            const artworks = await (prisma as any).$queryRaw`
                SELECT a.*, row_to_json(m.*) as museum_json
                FROM "Artwork" a
                LEFT JOIN "Museum" m ON a."museumId" = m.id
                WHERE a.image IS NOT NULL
                ORDER BY RANDOM()
                LIMIT ${limit}
            `;
            const result = (artworks as any[]).map((a: any) => {
                const museum = a.museum_json;
                delete a.museum_json;
                return {
                    ...a,
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
            return successResponse({ artworks: result, hasMore, nextCursor: hasMore ? String(newOffset) : null });
        }

        const where = query
            ? {
                OR: [
                    { title: { contains: query, mode: 'insensitive' as const } },
                    { artist: { contains: query, mode: 'insensitive' as const } },
                ],
            }
            : {};

        // Fetch artworks with direct museum relation
        const artworks = await (prisma as any).artwork.findMany({
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
        const result = items.map((a: any) => ({
            ...a,
            museums: a.museum ? [a.museum] : [],
            museum: undefined,
        }));

        return successResponse({ artworks: result, hasMore, nextCursor });
    } catch (err: any) {
        console.error('Fetch artworks error:', err);
        return errorResponse('INTERNAL_SERVER_ERROR', 'Failed to fetch artworks', 500);
    }
}

