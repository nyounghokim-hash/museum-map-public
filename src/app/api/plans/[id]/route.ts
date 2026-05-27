import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-utils';
import { transformNestedPhotos } from '@/lib/photo-proxy';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await requireAuth();
        const { id } = await params;
        const plan = await prisma.plan.findUnique({
            where: { id },
            include: {
                stops: {
                    include: { museum: { select: { id: true, name: true, nameKo: true, nameEn: true, nameTranslations: true, imageUrl: true, city: true, cityKo: true, cityTranslations: true, country: true, type: true, latitude: true, longitude: true, website: true, description: true, descriptionKo: true, openingHours: true, visitorInfo: true } } },
                    orderBy: { order: 'asc' }
                }
            }
        });
        if (!plan || plan.userId !== user.id) return errorResponse('NOT_FOUND', 'Plan not found', 404);
        return successResponse(transformNestedPhotos(plan));
    } catch (err: any) {
        if (err.message === 'UNAUTHORIZED') return errorResponse('UNAUTHORIZED', 'Auth required', 401);
        return errorResponse('INTERNAL_SERVER_ERROR', 'Failed to get plan', 500);
    }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await requireAuth();
        const { id } = await params;
        const body = await req.json();
        const plan = await prisma.plan.findUnique({ where: { id } });
        if (!plan || plan.userId !== user.id) return errorResponse('NOT_FOUND', 'Plan not found', 404);

        const updated = await prisma.plan.update({
            where: { id },
            data: {
                title: body.title !== undefined ? body.title : plan.title,
                date: body.date !== undefined ? new Date(body.date) : plan.date,
                startDate: body.startDate !== undefined ? (body.startDate ? new Date(body.startDate) : null) : plan.startDate,
                endDate: body.endDate !== undefined ? (body.endDate ? new Date(body.endDate) : null) : plan.endDate,
                isActive: body.isActive !== undefined ? body.isActive : plan.isActive,
            }
        });

        // Handle re-ordering of stops
        if (body.stops && Array.isArray(body.stops)) {
            for (const stop of body.stops) {
                if (stop.id && stop.order !== undefined) {
                    await prisma.planStop.update({
                        where: { id: stop.id },
                        data: { order: stop.order }
                    });
                }
            }
        }

        return successResponse(updated);
    } catch (err: any) {
        if (err.message === 'UNAUTHORIZED') return errorResponse('UNAUTHORIZED', 'Auth required', 401);
        return errorResponse('INTERNAL_SERVER_ERROR', 'Failed to update plan', 500);
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await requireAuth();
        const { id } = await params;
        const plan = await prisma.plan.findUnique({ where: { id } });
        if (!plan || plan.userId !== user.id) return errorResponse('NOT_FOUND', 'Plan not found', 404);
        // Delete stops first (foreign key), then plan
        await prisma.planStop.deleteMany({ where: { planId: id } });
        await prisma.plan.delete({ where: { id } });
        return successResponse({ deleted: true });
    } catch (err: any) {
        if (err.message === 'UNAUTHORIZED') return errorResponse('UNAUTHORIZED', 'Auth required', 401);
        return errorResponse('INTERNAL_SERVER_ERROR', 'Failed to delete plan', 500);
    }
}
