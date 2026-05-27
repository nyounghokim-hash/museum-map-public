import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-utils';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await requireAuth();
        const { id: challengeId } = await params;

        const challenge = await prisma.challenge.findUnique({
            where: { id: challengeId }
        });
        if (!challenge) return errorResponse('NOT_FOUND', 'Challenge not found', 404);

        const existing = await prisma.challengeProgress.findUnique({
            where: { userId_challengeId: { userId: user.id, challengeId } }
        });

        if (existing) return successResponse(existing); // Already joined

        const progress = await prisma.challengeProgress.create({
            data: {
                userId: user.id,
                challengeId,
            }
        });

        return successResponse(progress, 201);

    } catch (err: any) {
        if (err.message === 'UNAUTHORIZED') return errorResponse('UNAUTHORIZED', 'Auth required', 401);
        return errorResponse('INTERNAL_SERVER_ERROR', 'Failed to join challenge', 500);
    }
}
