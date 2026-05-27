import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/lib/api-utils';

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
    try {
        const { slug } = await params;
        const collection = await prisma.collection.findUnique({
            where: { shareSlug: slug },
            include: {
                user: { select: { id: true, name: true, image: true } },
                items: {
                    include: {
                        museum: true,
                        review: true
                    },
                    orderBy: { order: 'asc' }
                }
            }
        });
        if (!collection || !collection.isPublic) {
            return errorResponse('NOT_FOUND', 'Public collection not found', 404);
        }
        return successResponse(collection);
    } catch (err: any) {
        return errorResponse('INTERNAL_SERVER_ERROR', 'Failed to fetch public collection', 500);
    }
}
