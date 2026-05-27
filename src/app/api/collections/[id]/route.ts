import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-utils';
import { transformNestedPhotos } from '@/lib/photo-proxy';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
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

        return successResponse(transformNestedPhotos(collection));
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
