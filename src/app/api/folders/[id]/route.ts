import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-utils';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await requireAuth();
        const { id } = await params;
        const body = await req.json();
        const folder = await prisma.folder.findUnique({ where: { id } });
        if (!folder || folder.userId !== user.id) return errorResponse('NOT_FOUND', 'Folder not found', 404);
        const updated = await prisma.folder.update({
            where: { id },
            data: {
                name: body.name !== undefined ? body.name : folder.name,
                isPrivate: body.isPrivate !== undefined ? body.isPrivate : folder.isPrivate,
            }
        });
        return successResponse(updated);
    } catch (err: any) {
        if (err.message === 'UNAUTHORIZED') return errorResponse('UNAUTHORIZED', 'Auth required', 401);
        return errorResponse('INTERNAL_SERVER_ERROR', 'Failed to update folder', 500);
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await requireAuth();
        const { id } = await params;
        const folder = await prisma.folder.findUnique({ where: { id } });
        if (!folder || folder.userId !== user.id) return errorResponse('NOT_FOUND', 'Folder not found', 404);
        await prisma.folder.delete({ where: { id } });
        return successResponse({ deleted: true });
    } catch (err: any) {
        if (err.message === 'UNAUTHORIZED') return errorResponse('UNAUTHORIZED', 'Auth required', 401);
        return errorResponse('INTERNAL_SERVER_ERROR', 'Failed to delete folder', 500);
    }
}
