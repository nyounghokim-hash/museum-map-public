import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-utils';

export async function POST(req: NextRequest) {
    try {
        const user = await requireAuth();
        const { targetType, targetId, reason } = await req.json();

        if (!targetType || !targetId || !reason) {
            return errorResponse('BAD_REQUEST', 'targetType, targetId, and reason are required', 400);
        }

        const report = await prisma.report.create({
            data: {
                reporterId: user.id,
                targetType,
                targetId,
                reason
            }
        });

        return successResponse(report, 201);
    } catch (err: any) {
        if (err.message === 'UNAUTHORIZED') return errorResponse('UNAUTHORIZED', 'Auth required', 401);
        return errorResponse('INTERNAL_SERVER_ERROR', 'Failed to submit report', 500);
    }
}
