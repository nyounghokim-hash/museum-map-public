import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/lib/api-utils';
import { privateMuseumWhere } from '@/lib/museumVisibility';
import { Prisma } from '@/generated_v2/client';

const OFFICIAL_EXHIBITION_SOURCE_PREFIX = 'OFFICIAL_';

function getKoreaDateStart() {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(new Date());
    const year = parts.find(part => part.type === 'year')?.value;
    const month = parts.find(part => part.type === 'month')?.value;
    const day = parts.find(part => part.type === 'day')?.value;
    if (!year || !month || !day) return new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z');
    return new Date(`${year}-${month}-${day}T00:00:00.000Z`);
}

export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const limit = parseInt(url.searchParams.get('limit') || '100');
        const offset = parseInt(url.searchParams.get('offset') || '0');
        const today = getKoreaDateStart();
        const where: Prisma.ExhibitionWhereInput = {
            source: { startsWith: OFFICIAL_EXHIBITION_SOURCE_PREFIX },
            endDate: { gte: today },
            museum: { is: privateMuseumWhere as unknown as Prisma.MuseumWhereInput },
        };

        const exhibitions = await prisma.exhibition.findMany({
            where,
            include: {
                museum: {
                    select: {
                        id: true,
                        name: true,
                        nameKo: true,
                        nameEn: true,
                        nameTranslations: true,
                        city: true,
                        cityKo: true,
                        cityTranslations: true,
                        country: true,
                        type: true,
                        latitude: true,
                        longitude: true,
                        imageUrl: true,
                        cachedPhotoUrls: true,
                    },
                },
            },
            orderBy: [
                { startDate: 'asc' },
                { endDate: 'asc' },
                { createdAt: 'desc' },
            ],
            take: limit,
            skip: offset,
        });

        const total = await prisma.exhibition.count({ where });

        return successResponse({ exhibitions, total });
    } catch {
        return errorResponse('INTERNAL_SERVER_ERROR', 'Failed to fetch exhibitions', 500);
    }
}
