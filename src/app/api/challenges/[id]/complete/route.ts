import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-utils';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await requireAuth();
        const { id: challengeId } = await params;

        const progress = await prisma.challengeProgress.findUnique({
            where: { userId_challengeId: { userId: user.id, challengeId } }
        });

        if (!progress) return errorResponse('NOT_JOINED', 'Not joined', 400);

        if (progress.completed) return successResponse(progress);

        // Very basic MVP example: just setting complete to true.
        // In reality, this would evaluate actual criteria logic (e.g., number of reviews).
        const updated = await prisma.challengeProgress.update({
            where: {
                userId_challengeId: {
                    userId: user.id,
                    challengeId: challengeId
                }
            },
            data: { completed: true, completedAt: new Date() }
        });

        return successResponse(updated);

    } catch (err: any) {
        if (err.message === 'UNAUTHORIZED') return errorResponse('UNAUTHORIZED', 'Auth required', 401);
        return errorResponse('INTERNAL_SERVER_ERROR', 'Failed to complete challenge', 500);
    }
}
