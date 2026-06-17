import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-utils';
import { transformNestedPhotos } from '@/lib/photo-proxy';

async function attachVisitRecordsToPlan(plan: any, userId: string) {
    const museumIds = (plan.stops || []).map((stop: any) => stop.museumId).filter(Boolean);
    if (museumIds.length === 0) return plan;

    const visits = await prisma.review.findMany({
        where: { userId, museumId: { in: museumIds }, content: '' },
        orderBy: { visitedAt: 'desc' },
        select: { id: true, museumId: true, visitedAt: true },
    });
    const visitByMuseumId = new Map<string, { id: string; museumId: string; visitedAt: Date }>();
    visits.forEach((visit) => {
        if (!visitByMuseumId.has(visit.museumId)) visitByMuseumId.set(visit.museumId, visit);
    });

    return {
        ...plan,
        stops: (plan.stops || []).map((stop: any) => {
            const visit = visitByMuseumId.get(stop.museumId);
            return visit ? { ...stop, visitedAt: visit.visitedAt, reviewId: visit.id } : stop;
        }),
    };
}

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
        const enriched = await attachVisitRecordsToPlan(plan, user.id);
        return successResponse(transformNestedPhotos(enriched));
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
            const existingStops = await prisma.planStop.findMany({
                where: { planId: id },
                select: { id: true, museumId: true },
            });
            const stopIds = new Set(existingStops.map(stop => stop.id));
            const stopIdByMuseumId = new Map(existingStops.map(stop => [stop.museumId, stop.id]));
            const updates = [];

            for (const stop of body.stops) {
                if (stop.order === undefined) continue;
                const order = Number(stop.order);
                if (!Number.isFinite(order)) continue;
                const stopId = stop.id && stopIds.has(stop.id)
                    ? stop.id
                    : stop.museumId
                        ? stopIdByMuseumId.get(stop.museumId)
                        : null;
                if (!stopId) continue;
                updates.push(prisma.planStop.update({
                    where: { id: stopId },
                    data: { order },
                }));
            }
            if (updates.length > 0) await prisma.$transaction(updates);
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
