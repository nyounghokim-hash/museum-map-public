import { requireAuth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-utils';
import { prisma } from '@/lib/prisma';

export async function DELETE() {
    try {
        const user = await requireAuth();
        await prisma.plan.updateMany({
            where: { userId: user.id, isActive: true },
            data: { isActive: false },
        });
        return successResponse({ ended: true });
    } catch (err: any) {
        if (err.message === 'UNAUTHORIZED') return errorResponse('UNAUTHORIZED', 'Auth required', 401);
        return errorResponse('INTERNAL_SERVER_ERROR', 'Failed to end active trip', 500);
    }
}
