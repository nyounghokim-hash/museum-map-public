import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-utils';

export async function POST(req: NextRequest) {
    try {
        const user = await requireAuth();
        const { name, isPrivate = true } = await req.json();

        if (!name) return errorResponse('BAD_REQUEST', 'Folder name is required', 400);

        const folder = await prisma.folder.create({
            data: {
                userId: user.id,
                name,
                isPrivate,
            }
        });

        return successResponse(folder, 201);
    } catch (err: any) {
        if (err.message === 'UNAUTHORIZED') return errorResponse('UNAUTHORIZED', 'Auth required', 401);
        console.error('API Error /folders:', err);
        return errorResponse('INTERNAL_SERVER_ERROR', 'Failed to create folder', 500);
    }
}
