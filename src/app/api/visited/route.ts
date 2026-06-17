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

        const existing = await prisma.review.findFirst({
            where: {
                userId: user.id,
                museumId: resolvedMuseumId,
                content: '',
            },
            orderBy: { visitedAt: 'desc' },
        });

        if (existing) {
            if (planStopId) {
                const updated = await prisma.review.update({
                    where: { id: existing.id },
                    data: { visitedAt: new Date() },
                });
                return successResponse(updated);
            }
            return successResponse(existing);
        }

        // Creating an empty stub Review to mark as simply "Visited".
        const visitedRecord = await prisma.review.create({
            data: {
                userId: user.id,
                museumId: resolvedMuseumId,
                content: '',
                visitedAt: new Date(),
            },
        });

        return successResponse(visitedRecord, 201);
    } catch (err: any) {
        if (err.message === 'UNAUTHORIZED') return errorResponse('UNAUTHORIZED', 'Auth required', 401);
        return errorResponse('INTERNAL_SERVER_ERROR', 'Failed to mark visited', 500);
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const user = await requireAuth();
        const { museumId, planStopId, reviewId } = await req.json();

        if (!museumId && !planStopId && !reviewId) {
            return errorResponse('BAD_REQUEST', 'museumId, planStopId, or reviewId is required', 400);
        }

        let resolvedMuseumId = museumId;

        if (planStopId) {
            const pStop = await prisma.planStop.findUnique({
                where: { id: planStopId },
                include: { plan: true },
            });
            if (!pStop || pStop.plan.userId !== user.id) return errorResponse('NOT_FOUND', 'Plan stop not found', 404);
            resolvedMuseumId = pStop.museumId;
        }

        const where = reviewId
            ? { id: reviewId, userId: user.id, content: '' }
            : { userId: user.id, museumId: resolvedMuseumId, content: '' };

        const existing = await prisma.review.findFirst({
            where,
            orderBy: { visitedAt: 'desc' },
        });

        if (!existing) return successResponse({ deleted: false });

        await prisma.review.delete({ where: { id: existing.id } });

        return successResponse({ deleted: true, id: existing.id });
    } catch (err: any) {
        if (err.message === 'UNAUTHORIZED') return errorResponse('UNAUTHORIZED', 'Auth required', 401);
        return errorResponse('INTERNAL_SERVER_ERROR', 'Failed to unmark visited', 500);
    }
}
