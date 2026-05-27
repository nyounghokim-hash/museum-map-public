import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-utils';

export async function POST(req: NextRequest) {
    try {
        const user = await requireAuth();
        const { museumId, planStopId } = await req.json();

        if (!museumId && !planStopId) {
            return errorResponse('BAD_REQUEST', 'museumId or planStopId is required', 400);
        }

        let resolvedMuseumId = museumId;

        if (planStopId) {
            const pStop = await prisma.planStop.findUnique({
                where: { id: planStopId },
                include: { plan: true }
            });
            if (!pStop || pStop.plan.userId !== user.id) return errorResponse('NOT_FOUND', 'Plan stop not found', 404);
            resolvedMuseumId = pStop.museumId;
        }

        // Creating an empty stub Review to mark as simply "Visited"
        const visitedRecord = await prisma.review.create({
            data: {
                userId: user.id,
                museumId: resolvedMuseumId,
                content: '', // Empty content indicates it's just a Visit check-in
                visitedAt: new Date()
            }
        });

        return successResponse(visitedRecord, 201);
    } catch (err: any) {
        if (err.message === 'UNAUTHORIZED') return errorResponse('UNAUTHORIZED', 'Auth required', 401);
        return errorResponse('INTERNAL_SERVER_ERROR', 'Failed to mark visited', 500);
    }
}
