import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser, requireAuth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-utils';
import { transformNestedPhotos } from '@/lib/photo-proxy';

async function getCollectionTripCount(userId: string | undefined, museumIds: string[]) {
    if (!userId || museumIds.length === 0) return 0;
    const plans = await prisma.plan.findMany({
        where: { userId, stops: { some: { museumId: { in: museumIds } } } },
        select: { id: true },
    });
    return plans.length;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const sessionUser = await getSessionUser();
        const collection = await prisma.collection.findUnique({
            where: { id },
            include: {
                user: { select: { name: true, email: true, image: true } },
                items: {
                    include: { museum: { select: { id: true, name: true, nameKo: true, nameEn: true, nameTranslations: true, imageUrl: true, cachedPhotoUrls: true, city: true, cityKo: true, cityTranslations: true, country: true, type: true, googleRating: true } } },
                    orderBy: { order: 'asc' }
                },
                stories: {
                    where: { status: 'PUBLISHED' },
                    select: { id: true, title: true, titleEn: true, previewImage: true, createdAt: true, author: true, category: true, views: true,
                        museums: { include: { museum: { select: { imageUrl: true, cachedPhotoUrls: true } } } }
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 6
                }
            }
        });

        if (!collection) return errorResponse('NOT_FOUND', 'Collection not found', 404);

        const items = collection.items || [];
        const tripCount = await getCollectionTripCount(sessionUser?.id, items.map((item: any) => item.museumId).filter(Boolean));
        return successResponse(transformNestedPhotos({
            ...collection,
            isVisitedCollection: items.length > 0 && items.every((item: any) => !!item.reviewId),
            tripCount,
        }));
    } catch (err) {
        return errorResponse('INTERNAL_SERVER_ERROR', 'Failed to fetch collection', 500);
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await requireAuth();
        const { id } = await params;

        const collection = await prisma.collection.findUnique({ where: { id } });
        if (!collection || collection.userId !== user.id) {
            return errorResponse('NOT_FOUND', 'Collection not found', 404);
        }

        // Delete items first (foreign key), then collection
        await prisma.collectionItem.deleteMany({ where: { collectionId: id } });
        await prisma.collection.delete({ where: { id } });

        return successResponse({ deleted: true });
    } catch (err: any) {
        if (err.message === 'UNAUTHORIZED') return errorResponse('UNAUTHORIZED', 'Auth required', 401);
        return errorResponse('INTERNAL_SERVER_ERROR', 'Failed to delete collection', 500);
    }
}
