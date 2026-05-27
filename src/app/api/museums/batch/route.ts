import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/lib/api-utils';
import { transformMuseumPhotos } from '@/lib/photo-proxy';
import { privateMuseumWhere } from '@/lib/museumVisibility';

// POST /api/museums/batch — fetch museums by array of IDs (for view history)
export async function POST(req: NextRequest) {
    try {
        const { ids } = await req.json();
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return errorResponse('BAD_REQUEST', 'ids array is required', 400);
        }
        // Max 20 IDs
        const safeIds = ids.slice(0, 20);
        const museums = await prisma.museum.findMany({
            where: { AND: [{ id: { in: safeIds } }, privateMuseumWhere as any] },
            select: {
                id: true, name: true, nameKo: true, nameEn: true, nameTranslations: true,
                country: true, city: true, cityKo: true, cityTranslations: true,
                type: true, imageUrl: true, googleRating: true,
                latitude: true, longitude: true,
                placePhotos: true, cachedPhotoUrls: true,
            }
        });
        return successResponse(museums.map(transformMuseumPhotos));
    } catch (err: any) {
        return errorResponse('INTERNAL_SERVER_ERROR', 'Failed to fetch museums', 500);
    }
}
