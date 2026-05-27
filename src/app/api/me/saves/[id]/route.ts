import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-utils';

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await requireAuth();
        const { id } = await params;

        const save = await prisma.save.findUnique({ where: { id } });

        if (!save || save.userId !== user.id) {
            return errorResponse('NOT_FOUND', 'Save not found', 404);
        }

        await prisma.save.delete({ where: { id } });

        return successResponse({ deleted: true });
    } catch (err: any) {
        if (err.message === 'UNAUTHORIZED') return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
        console.error('API Error DELETE /me/saves/[id]:', err);
        return errorResponse('INTERNAL_SERVER_ERROR', 'Failed to delete save', 500, err.message);
    }
}
