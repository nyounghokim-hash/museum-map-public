import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/lib/api-utils';
import { transformMuseumPhotos } from '@/lib/photo-proxy';
import { privateMuseumWhere } from '@/lib/museumVisibility';

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

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        if (!id) {
            return errorResponse('INVALID_ID', 'Museum ID is required', 400);
        }
        const today = getKoreaDateStart();
        const museum = await prisma.museum.findFirst({
            where: { AND: [{ id }, privateMuseumWhere as any] },
            include: {
                artworks: {
                    select: { id: true, title: true, titleKo: true, titleTranslations: true, artist: true, artistKo: true, artistTranslations: true, image: true, description: true, descriptionKo: true, year: true },
                    orderBy: [{ image: { sort: 'desc', nulls: 'last' } }, { createdAt: 'asc' }],
                    take: 20,
                },
                exhibitions: {
                    where: {
                        source: { startsWith: OFFICIAL_EXHIBITION_SOURCE_PREFIX },
                        endDate: { gte: today },
                    },
                    orderBy: [
                        { startDate: 'asc' },
                        { endDate: 'asc' },
                        { createdAt: 'desc' },
                    ],
                },
                reviews: {
                    take: 5,
                    orderBy: { createdAt: 'desc' },
                    include: { user: { select: { id: true, name: true, image: true } } }
                },
                _count: {
                    select: { artworks: true },
                },
            }
        });
        if (!museum) {
            return errorResponse('NOT_FOUND', 'Museum not found', 404);
        }
        // strip geometry column mapping if any
        const { location, ...safeMuseumData } = museum as any;
        return successResponse(transformMuseumPhotos(safeMuseumData));
    } catch (err: any) {
        console.error('API Error /museums/[id]:', err);
        return errorResponse('INTERNAL_SERVER_ERROR', 'Failed to fetch museum details', 500, err.message);
    }
}
