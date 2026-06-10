import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/lib/api-utils';
import { transformMuseumPhotos } from '@/lib/photo-proxy';
import { privateMuseumWhere } from '@/lib/museumVisibility';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const query = searchParams.get('query');
        const country = searchParams.get('country');
        const bbox = searchParams.get('bbox'); // format: minLng,minLat,maxLng,maxLat
        const page = parseInt(searchParams.get('page') || '1', 10);
        const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 5000);
        const offset = (page - 1) * limit;

        // Support fetching multiple museums by IDs (for compare feature)
        const ids = searchParams.get('ids');
        if (ids) {
            const idList = ids.split(',').filter(Boolean).slice(0, 10);
            if (idList.length === 0) {
                return successResponse({ data: [], total: 0, page: 1, limit: 0 });
            }
            const museums = await prisma.museum.findMany({
                where: { AND: [{ id: { in: idList } }, privateMuseumWhere as any] },
                select: {
                    id: true, name: true, nameKo: true, nameEn: true, nameTranslations: true,
                    description: true, descriptionKo: true, summary: true, summaryTranslations: true, country: true, city: true, cityKo: true, cityTranslations: true,
                    type: true, website: true, imageUrl: true, latitude: true, longitude: true, popularityScore: true,
                    createdAt: true, googleRating: true, googleRatingsTotal: true, placePhotos: true, cachedPhotoUrls: true,
                    openingHours: true, visitorInfo: true, address: true, phone: true,
                }
            });
            return successResponse({ data: museums.map(transformMuseumPhotos), total: museums.length, page: 1, limit: museums.length });
        }

        const where: any = { AND: [privateMuseumWhere] };

        if (bbox) {
            const parts = bbox.split(',').map(Number);
            if (parts.length !== 4 || parts.some(isNaN)) {
                return errorResponse('INVALID_BBOX', 'Invalid bounding box parameters. Expected minLng,minLat,maxLng,maxLat', 400);
            }
            const [minLng, minLat, maxLng, maxLat] = parts;
            where.AND.push({
                longitude: { gte: minLng, lte: maxLng },
                latitude: { gte: minLat, lte: maxLat },
            });
        }

        const q = searchParams.get('q') || query;
        if (q) {
            where.AND.push({
                OR: [
                    { name: { contains: q, mode: 'insensitive' } },
                    { nameKo: { contains: q, mode: 'insensitive' } },
                    { nameEn: { contains: q, mode: 'insensitive' } },
                    { city: { contains: q, mode: 'insensitive' } },
                    { cityKo: { contains: q, mode: 'insensitive' } },
                    { country: { contains: q, mode: 'insensitive' } },
                    { type: { contains: q, mode: 'insensitive' } },
                    { summary: { contains: q, mode: 'insensitive' } },
                    { descriptionKo: { contains: q, mode: 'insensitive' } },
                ],
            });
        }
        if (country && !q) {
            where.AND.push({ country });
        }

        const [data, count] = await Promise.all([
            prisma.museum.findMany({
                where,
                orderBy: { popularityScore: 'desc' },
                skip: offset,
                take: limit,
                select: {
                    id: true, name: true, nameKo: true, nameEn: true, nameTranslations: true, description: true, descriptionKo: true, summary: true, summaryTranslations: true, country: true, city: true, cityKo: true, cityTranslations: true,
                    type: true, website: true, imageUrl: true, latitude: true, longitude: true, popularityScore: true,
                    createdAt: true, googleRating: true, googleRatingsTotal: true, placePhotos: true, cachedPhotoUrls: true,
                    openingHours: true, visitorInfo: true, address: true, phone: true
                }
            }),
            prisma.museum.count({ where })
        ]);

        return successResponse({ data: data.map(transformMuseumPhotos), total: count, page, limit });
    } catch (err: any) {
        console.error('API Error /museums:', err);
        return errorResponse('INTERNAL_SERVER_ERROR', 'Failed to fetch museums', 500, err.message);
    }
}
