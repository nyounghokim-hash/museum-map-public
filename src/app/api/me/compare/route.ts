import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-utils';

const MAX_COMPARE = 3;

export async function GET() {
    try {
        const user = await requireAuth();
        const row = await prisma.user.findUnique({
            where: { id: user.id },
            select: { preferences: true },
        });
        const prefs = (row?.preferences as Record<string, any>) || {};
        const ids = Array.isArray(prefs.compareIds) ? prefs.compareIds.filter((x: unknown) => typeof x === 'string') : [];
        return successResponse({ ids });
    } catch (err: any) {
        if (err.message === 'UNAUTHORIZED') return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
        console.error('API Error GET /me/compare:', err);
        return errorResponse('INTERNAL_SERVER_ERROR', 'Failed to fetch compare list', 500, err.message);
    }
}

export async function PUT(req: NextRequest) {
    try {
        const user = await requireAuth();
        const body = await req.json();
        const raw: unknown[] = Array.isArray(body?.ids) ? body.ids : [];
        const ids: string[] = Array.from(new Set(raw.filter((x): x is string => typeof x === 'string' && x.length > 0))).slice(0, MAX_COMPARE);

        const existing = (user.preferences as Record<string, any>) || {};
        await prisma.user.update({
            where: { id: user.id },
            data: { preferences: { ...existing, compareIds: ids } },
        });

        return successResponse({ ids });
    } catch (err: any) {
        if (err.message === 'UNAUTHORIZED') return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
        console.error('API Error PUT /me/compare:', err);
        return errorResponse('INTERNAL_SERVER_ERROR', 'Failed to update compare list', 500, err.message);
    }
}
