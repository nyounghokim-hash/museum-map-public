import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-utils';
import { transformNestedPhotos } from '@/lib/photo-proxy';
import { isTripEnded } from '@/lib/tripStatus';

async function attachVisitRecordsToPlans(plans: any[], userId: string) {
    const museumIds = Array.from(new Set(
        plans.flatMap((plan: any) => (plan.stops || []).map((stop: any) => stop.museumId).filter(Boolean))
    ));
    if (museumIds.length === 0) return plans;

    const visits = await prisma.review.findMany({
        where: { userId, museumId: { in: museumIds }, content: '' },
        orderBy: { visitedAt: 'desc' },
        select: { id: true, museumId: true, visitedAt: true },
    });
    const visitByMuseumId = new Map<string, { id: string; museumId: string; visitedAt: Date }>();
    visits.forEach((visit) => {
        if (!visitByMuseumId.has(visit.museumId)) visitByMuseumId.set(visit.museumId, visit);
    });

    return plans.map((plan: any) => ({
        ...plan,
        stops: (plan.stops || []).map((stop: any) => {
            const visit = visitByMuseumId.get(stop.museumId);
            return visit ? { ...stop, visitedAt: visit.visitedAt, reviewId: visit.id } : stop;
        }),
    }));
}

export async function POST(req: NextRequest) {
    try {
        const user = await requireAuth();
        const body = await req.json();
        const { title, date, startDate, endDate, stops } = body;

        console.log('[Plans POST] userId:', user.id, 'title:', title, 'stops count:', stops?.length, 'startDate:', startDate, 'endDate:', endDate);

        if (!stops || !Array.isArray(stops) || stops.length === 0) {
            return errorResponse('BAD_REQUEST', 'stops array required', 400);
        }

        // Validate museumIds
        const validStops = stops.filter((s: any) => s.museumId);
        console.log('[Plans POST] validStops:', validStops.length, 'museumIds:', validStops.map((s: any) => s.museumId));
        if (validStops.length === 0) {
            return errorResponse('BAD_REQUEST', 'No valid museumIds in stops', 400);
        }

        // Parse date safely
        let parsedDate: Date | undefined;
        if (date) {
            parsedDate = new Date(date);
            if (isNaN(parsedDate.getTime())) {
                parsedDate = new Date(); // fallback to now
            }
        }

        const plan = await prisma.plan.create({
            data: {
                userId: user.id,
                title: title || 'New Trip Plan',
                date: parsedDate,
                startDate: startDate ? new Date(startDate) : null,
                endDate: endDate ? new Date(endDate) : null,
                stops: {
                    create: validStops.map((s: any, i: number) => ({
                        museumId: s.museumId,
                        order: s.order ?? i,
                        expectedArrival: s.expectedArrival ? new Date(s.expectedArrival) : null
                    }))
                }
            },
            include: { stops: true }
        });

        console.log('[Plans POST] Created plan:', plan.id, 'with', plan.stops.length, 'stops');
        return successResponse(plan, 201);
    } catch (err: any) {
        if (err.message === 'UNAUTHORIZED') return errorResponse('UNAUTHORIZED', 'Auth required', 401);
        console.error('[Plans POST Error]', err);
        return errorResponse('INTERNAL_SERVER_ERROR', err.message || 'Failed to create plan', 500);
    }
}

export async function GET(req: NextRequest) {
    try {
        const user = await requireAuth();
        const plans = await prisma.plan.findMany({
            where: { userId: user.id },
            include: { stops: { include: { museum: { select: { name: true, nameKo: true, nameEn: true, nameTranslations: true, imageUrl: true, cachedPhotoUrls: true, city: true, cityKo: true, cityTranslations: true, country: true } } } } },
            orderBy: { createdAt: 'desc' }
        });
        const expiredActivePlanIds = plans
            .filter((plan: any) => plan.isActive && isTripEnded(plan))
            .map((plan: any) => plan.id);
        if (expiredActivePlanIds.length > 0) {
            await prisma.plan.updateMany({
                where: { id: { in: expiredActivePlanIds }, userId: user.id },
                data: { isActive: false },
            });
        }
        const normalizedPlans = expiredActivePlanIds.length > 0
            ? plans.map((plan: any) => expiredActivePlanIds.includes(plan.id) ? { ...plan, isActive: false } : plan)
            : plans;
        const enriched = await attachVisitRecordsToPlans(normalizedPlans, user.id);
        return successResponse(enriched.map(transformNestedPhotos));
    } catch (err: any) {
        if (err.message === 'UNAUTHORIZED') return errorResponse('UNAUTHORIZED', 'Auth required', 401);
        return errorResponse('INTERNAL_SERVER_ERROR', 'Failed to fetch plans', 500);
    }
}
