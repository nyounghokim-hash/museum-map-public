import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-utils';

// PATCH /api/photos/[id] — Admin approve/reject, or set as primary
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await requireAuth();
        if (user.role !== 'ADMIN') {
            return errorResponse('FORBIDDEN', 'Admin only', 403);
        }

        const { id } = await params;
        const body = await req.json();
        const { status, rejectReason, isPrimary } = body;

        const photo = await prisma.userPhoto.findUnique({ where: { id } });
        if (!photo) return errorResponse('NOT_FOUND', 'Photo not found', 404);

        const updateData: any = { updatedAt: new Date() };

        // Approve or Reject
        if (status === 'APPROVED' || status === 'REJECTED') {
            updateData.status = status;
            updateData.reviewedAt = new Date();
            updateData.reviewedBy = user.id;
            if (status === 'REJECTED' && rejectReason) {
                updateData.rejectReason = rejectReason;
            }
        }

        // Set as primary
        if (isPrimary === true) {
            // Unset any existing primary for the same target
            const targetWhere: any = { isPrimary: true, id: { not: id } };
            if (photo.museumId) targetWhere.museumId = photo.museumId;
            if (photo.artworkId) targetWhere.artworkId = photo.artworkId;

            await prisma.userPhoto.updateMany({
                where: targetWhere,
                data: { isPrimary: false },
            });
            updateData.isPrimary = true;
        } else if (isPrimary === false) {
            updateData.isPrimary = false;
        }

        const updated = await prisma.userPhoto.update({
            where: { id },
            data: updateData,
        });

        return successResponse(updated);
    } catch (err: any) {
        if (err.message === 'UNAUTHORIZED') return errorResponse('UNAUTHORIZED', 'Auth required', 401);
        console.error('API Error /photos/[id] PATCH:', err);
        return errorResponse('INTERNAL_SERVER_ERROR', 'Failed to update photo', 500);
    }
}

// DELETE /api/photos/[id] — Admin or photo owner can delete
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await requireAuth();

        const { id } = await params;
        const photo = await prisma.userPhoto.findUnique({ where: { id } });
        if (!photo) return errorResponse('NOT_FOUND', 'Photo not found', 404);

        // Only admin or the photo owner can delete
        if (user.role !== 'ADMIN' && user.id !== photo.userId) {
            return errorResponse('FORBIDDEN', 'Not authorized', 403);
        }

        // TODO: When Supabase Storage is connected, also delete the file from storage
        await prisma.userPhoto.delete({ where: { id } });

        return successResponse({ deleted: true });
    } catch (err: any) {
        if (err.message === 'UNAUTHORIZED') return errorResponse('UNAUTHORIZED', 'Auth required', 401);
        console.error('API Error /photos/[id] DELETE:', err);
        return errorResponse('INTERNAL_SERVER_ERROR', 'Failed to delete photo', 500);
    }
}
