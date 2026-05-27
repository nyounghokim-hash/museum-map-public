import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-utils';

// Helper for Haversine distance
function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2)
        ;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

export async function POST(req: NextRequest) {
    try {
        await requireAuth(); // require login
        const { museumIds } = await req.json();

        if (!museumIds || !Array.isArray(museumIds) || museumIds.length === 0) {
            return errorResponse('BAD_REQUEST', 'museumIds array is required', 400);
        }

        const museums = await prisma.museum.findMany({
            where: { id: { in: museumIds } },
            select: { id: true, latitude: true, longitude: true, name: true, nameKo: true, nameEn: true, nameTranslations: true }
        });

        if (museums.length === 0) return errorResponse('NOT_FOUND', 'Museums not found', 404);

        // Simple Nearest Neighbor approach for TSP starting from the first item
        const unvisited = [...museums];
        let current = unvisited.shift()!;
        const route = [current];

        while (unvisited.length > 0) {
            let nearestIdx = 0;
            let minDistance = Infinity;

            unvisited.forEach((target, index) => {
                const dist = getDistanceFromLatLonInKm(current.latitude, current.longitude, target.latitude, target.longitude);
                if (dist < minDistance) {
                    minDistance = dist;
                    nearestIdx = index;
                }
            });

            current = unvisited.splice(nearestIdx, 1)[0];
            route.push(current);
        }

        // Mocking an arrival time schedule linearly assuming 2 hours per museum
        const now = new Date();
        const stopsResponse = route.map((m, idx) => ({
            museumId: m.id,
            name: m.name,
            nameKo: m.nameKo,
            nameEn: m.nameEn,
            nameTranslations: m.nameTranslations,
            order: idx,
            expectedArrival: new Date(now.getTime() + (idx * 2 * 60 * 60 * 1000))
        }));

        return successResponse({ route: stopsResponse });
    } catch (err: any) {
        if (err.message === 'UNAUTHORIZED') return errorResponse('UNAUTHORIZED', 'Auth required', 401);
        console.error('API Error /route/generate:', err);
        return errorResponse('INTERNAL_SERVER_ERROR', 'Failed to generate route', 500);
    }
}
