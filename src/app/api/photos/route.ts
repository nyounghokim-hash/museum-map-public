import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-utils';

// GET /api/photos?museumId=xxx or ?artworkId=xxx or ?status=PENDING (admin)
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const museumId = searchParams.get('museumId');
        const artworkId = searchParams.get('artworkId');
        const status = searchParams.get('status');
        const userId = searchParams.get('userId');

        const where: any = {};

        if (museumId) where.museumId = museumId;
        if (artworkId) where.artworkId = artworkId;
        if (status) {
            // Only admin can view PENDING/REJECTED
            if (status !== 'APPROVED') {
                const user = await requireAuth();
                if (user.role !== 'ADMIN') {
                    return errorResponse('FORBIDDEN', 'Admin only', 403);
                }
            }
            where.status = status;
        } else {
            where.status = 'APPROVED'; // default: only show approved
        }
        if (userId) where.userId = userId;

        const photos = await prisma.userPhoto.findMany({
            where,
            orderBy: [{ isPrimary: 'desc' }, { order: 'asc' }, { createdAt: 'desc' }],
            include: {
                user: { select: { id: true, name: true, image: true } },
                museum: { select: { id: true, name: true, nameKo: true } },
                artwork: { select: { id: true, title: true, titleKo: true } },
            },
            take: 50,
        });

        return successResponse(photos);
    } catch (err: any) {
        if (err.message === 'UNAUTHORIZED') return errorResponse('UNAUTHORIZED', 'Auth required', 401);
        console.error('API Error /photos GET:', err);
        return errorResponse('INTERNAL_SERVER_ERROR', 'Failed to fetch photos', 500);
    }
}

// POST /api/photos — Submit a new photo (auth required)
// Note: actual file upload will be added when Supabase Storage is connected.
// For now, accepts imageUrl directly for testing.
export async function POST(req: NextRequest) {
    try {
        const user = await requireAuth();
        const userId = user.id;
        if (!userId) return errorResponse('UNAUTHORIZED', 'Auth required', 401);

        const body = await req.json();
        const { museumId, artworkId, imageUrl, thumbnailUrl, caption, fileSize } = body;

        if (!museumId && !artworkId) {
            return errorResponse('BAD_REQUEST', 'museumId or artworkId is required', 400);
        }
        if (!imageUrl) {
            return errorResponse('BAD_REQUEST', 'imageUrl is required', 400);
        }

        // Check daily upload limit (10/day)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dailyCount = await prisma.userPhoto.count({
            where: { userId, createdAt: { gte: today } },
        });
        if (dailyCount >= 10) {
            return errorResponse('TOO_MANY_REQUESTS', 'Daily upload limit (10) reached', 429);
        }

        const photo = await prisma.userPhoto.create({
            data: {
                userId,
                museumId: museumId || null,
                artworkId: artworkId || null,
                imageUrl,
                thumbnailUrl: thumbnailUrl || null,
                caption: caption || null,
                fileSize: fileSize || null,
                status: 'PENDING',
            },
        });

        return successResponse(photo);
    } catch (err: any) {
        if (err.message === 'UNAUTHORIZED') return errorResponse('UNAUTHORIZED', 'Auth required', 401);
        console.error('API Error /photos POST:', err);
        return errorResponse('INTERNAL_SERVER_ERROR', 'Failed to upload photo', 500);
    }
}
