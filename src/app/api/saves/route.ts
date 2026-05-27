import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-utils';

export async function POST(req: NextRequest) {
    try {
        const user = await requireAuth();
        const body = await req.json();
        const { museumId, folderId } = body;

        if (!museumId) {
            return errorResponse('BAD_REQUEST', 'museumId is required', 400);
        }

        // Check if duplicate
        const existing = await prisma.save.findUnique({
            where: {
                userId_museumId: {
                    userId: user.id,
                    museumId,
                }
            }
        });

        if (existing) {
            // Update folder if needed
            if (folderId && existing.folderId !== folderId) {
                const updated = await prisma.save.update({
                    where: { id: existing.id },
                    data: { folderId }
                });
                return successResponse(updated);
            }
            return successResponse(existing);
        }

        const save = await prisma.save.create({
            data: {
                userId: user.id,
                museumId,
                folderId: folderId || null
            }
        });

        return successResponse(save, 201);
    } catch (err: any) {
        if (err.message === 'UNAUTHORIZED') return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
        console.error('API Error /saves:', err);
        return errorResponse('INTERNAL_SERVER_ERROR', 'Failed to save museum', 500, err.message);
    }
}
