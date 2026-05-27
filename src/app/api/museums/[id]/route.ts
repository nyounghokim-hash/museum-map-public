import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/lib/api-utils';
import { transformMuseumPhotos } from '@/lib/photo-proxy';
import { privateMuseumWhere } from '@/lib/museumVisibility';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        if (!id) {
            return errorResponse('INVALID_ID', 'Museum ID is required', 400);
        }
        const museum = await prisma.museum.findFirst({
            where: { AND: [{ id }, privateMuseumWhere as any] },
            include: {
                artworks: {
                    select: { id: true, title: true, titleKo: true, titleTranslations: true, artist: true, artistKo: true, artistTranslations: true, image: true, description: true, descriptionKo: true, year: true },
                    orderBy: { createdAt: 'asc' }
                },
                exhibitions: true,
                reviews: {
                    take: 5,
                    orderBy: { createdAt: 'desc' },
                    include: { user: { select: { id: true, name: true, image: true } } }
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
