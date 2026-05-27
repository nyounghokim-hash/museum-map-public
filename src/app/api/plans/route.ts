import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-utils';
import { transformNestedPhotos } from '@/lib/photo-proxy';

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
        return successResponse(plans.map(transformNestedPhotos));
    } catch (err: any) {
        if (err.message === 'UNAUTHORIZED') return errorResponse('UNAUTHORIZED', 'Auth required', 401);
        return errorResponse('INTERNAL_SERVER_ERROR', 'Failed to fetch plans', 500);
    }
}
