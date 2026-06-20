import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser, requireAuth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-utils';
import { transformNestedPhotos } from '@/lib/photo-proxy';

function generateSlug(title: string) {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.random().toString(36).substring(2, 6);
}

function markVisitedCollections(collections: any[]) {
    return collections.map((collection) => {
        const items = collection.items || [];
        const isVisitedCollection = items.length > 0 && items.every((item: any) => !!item.reviewId);
        return { ...collection, isVisitedCollection };
    });
}

async function getTripPlanIdsByMuseumId(userId?: string | null) {
    if (!userId) return new Map<string, Set<string>>();
    const plans = await prisma.plan.findMany({
        where: { userId },
        select: { id: true, stops: { select: { museumId: true } } },
    });
    const planIdsByMuseumId = new Map<string, Set<string>>();
    plans.forEach((plan) => {
        plan.stops.forEach((stop) => {
            if (!stop.museumId) return;
            const set = planIdsByMuseumId.get(stop.museumId) || new Set<string>();
            set.add(plan.id);
            planIdsByMuseumId.set(stop.museumId, set);
        });
    });
    return planIdsByMuseumId;
}

function attachTripCounts(collections: any[], tripPlanIdsByMuseumId: Map<string, Set<string>>) {
    if (tripPlanIdsByMuseumId.size === 0) return collections;
    return collections.map((collection) => {
        const collectionPlanIds = new Set<string>();
        (collection.items || []).forEach((item: any) => {
            const museumId = item.museumId || item.museum?.id;
            if (!museumId) return;
            tripPlanIdsByMuseumId.get(museumId)?.forEach((planId) => collectionPlanIds.add(planId));
        });
        return {
            ...collection,
            tripCount: collectionPlanIds.size,
        };
    });
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const isPublicQuery = searchParams.get('public') === 'true';

        if (isPublicQuery) {
            const sessionUser = await getSessionUser();
            // Public collections - no auth required
            const collections = await prisma.collection.findMany({
                where: { isPublic: true },
                include: {
                    _count: { select: { items: true } },
                    user: { select: { name: true, email: true } },
                    items: {
                        select: { museumId: true, reviewId: true, museum: { select: { id: true, imageUrl: true, cachedPhotoUrls: true, name: true, nameKo: true, nameEn: true, nameTranslations: true, type: true, googleRating: true } } },
                        take: 5,
                        orderBy: { order: 'asc' },
                    },
                },
                orderBy: { createdAt: 'desc' },
            });
            const tripCounts = await getTripPlanIdsByMuseumId(sessionUser?.id);
            return successResponse(attachTripCounts(markVisitedCollections(collections), tripCounts).map(transformNestedPhotos));
        }

        const user = await requireAuth();
        const collections = await prisma.collection.findMany({
            where: { userId: user.id },
            include: {
                _count: { select: { items: true } },
                items: {
                    select: { museumId: true, reviewId: true, museum: { select: { id: true, imageUrl: true, cachedPhotoUrls: true, name: true, nameKo: true, nameEn: true, nameTranslations: true, type: true, googleRating: true } } },
                    take: 5,
                    orderBy: { order: 'asc' },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        const tripCounts = await getTripPlanIdsByMuseumId(user.id);
        return successResponse(attachTripCounts(markVisitedCollections(collections), tripCounts).map(transformNestedPhotos));
    } catch (err: any) {
        if (err.message === 'UNAUTHORIZED') return errorResponse('UNAUTHORIZED', 'Auth required', 401);
        return errorResponse('INTERNAL_SERVER_ERROR', 'Failed to fetch collections', 500);
    }
}

export async function POST(req: NextRequest) {
    try {
        const user = await requireAuth();
        const { title, description, isPublic, items } = await req.json();

        if (!title || !items || !Array.isArray(items)) {
            return errorResponse('BAD_REQUEST', 'title and items array are required', 400);
        }

        const shareSlug = isPublic ? generateSlug(title) : null;

        const collection = await prisma.collection.create({
            data: {
                userId: user.id,
                title,
                description,
                isPublic: !!isPublic,
                shareSlug,
                items: {
                    create: items.map((item: any, index: number) => ({
                        museumId: item.museumId,
                        reviewId: item.reviewId || null,
                        order: item.order !== undefined ? item.order : index
                    }))
                }
            },
            include: { items: true }
        });

        return successResponse(collection, 201);
    } catch (err: any) {
        if (err.message === 'UNAUTHORIZED') return errorResponse('UNAUTHORIZED', 'Auth required', 401);
        return errorResponse('INTERNAL_SERVER_ERROR', 'Failed to create collection', 500);
    }
}
