import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-utils';
import { adminLimiter, getClientIp } from '@/lib/rate-limit';

function checkRate(req: NextRequest) {
    const ip = getClientIp(req);
    const { success } = adminLimiter.check(ip);
    if (!success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    return null;
}

export async function GET(req: NextRequest) {
    try {
        await requireAdmin();
        const { searchParams } = new URL(req.url);
        const query = searchParams.get('query') || '';
        const page = parseInt(searchParams.get('page') || '1', 10);
        const limit = parseInt(searchParams.get('limit') || '20', 10);
        const offset = (page - 1) * limit;

        const where: any = {};
        if (query) {
            where.OR = [
                { name: { contains: query, mode: 'insensitive' } },
                { nameKo: { contains: query, mode: 'insensitive' } },
                { nameEn: { contains: query, mode: 'insensitive' } },
                { city: { contains: query, mode: 'insensitive' } },
                { cityKo: { contains: query, mode: 'insensitive' } },
                { country: { contains: query, mode: 'insensitive' } },
                { type: { contains: query, mode: 'insensitive' } },
                { summary: { contains: query, mode: 'insensitive' } },
                { descriptionKo: { contains: query, mode: 'insensitive' } },
            ];
        }

        const [data, total] = await Promise.all([
            prisma.museum.findMany({
                where,
                skip: offset,
                take: limit,
                orderBy: { updatedAt: 'desc' },
            }),
            prisma.museum.count({ where }),
        ]);

        return successResponse({ data, total, page, limit });
    } catch (err: any) {
        if (err.message === 'UNAUTHORIZED') return errorResponse('UNAUTHORIZED', 'Admin access required', 401);
        if (err.message === 'FORBIDDEN') return errorResponse('FORBIDDEN', 'Admin access required', 403);
        console.error('Admin Museum GET Error:', err);
        return errorResponse('INTERNAL_SERVER_ERROR', 'Failed to fetch museums', 500);
    }
}

export async function POST(req: NextRequest) {
    try {
        await requireAdmin();
        const body = await req.json();
        const { name, description, country, city, type, latitude, longitude, imageUrl, website } = body;

        if (!name || !country || !city || !type || latitude === undefined || longitude === undefined) {
            return errorResponse('BAD_REQUEST', 'Missing required fields', 400);
        }

        const museum = await prisma.museum.create({
            data: {
                name,
                description,
                country,
                city,
                type,
                latitude,
                longitude,
                imageUrl,
                website,
                popularityScore: 0,
            },
        });

        return successResponse(museum, 201);
    } catch (err: any) {
        if (err.message === 'UNAUTHORIZED') return errorResponse('UNAUTHORIZED', 'Admin access required', 401);
        if (err.message === 'FORBIDDEN') return errorResponse('FORBIDDEN', 'Admin access required', 403);
        console.error('Admin Museum POST Error:', err);
        return errorResponse('INTERNAL_SERVER_ERROR', 'Failed to create museum', 500);
    }
}

export async function PUT(req: NextRequest) {
    try {
        await requireAdmin();
        const body = await req.json();
        const { id } = body;

        if (!id) return errorResponse('BAD_REQUEST', 'Museum ID is required', 400);

        // Explicitly pick only allowed Museum fields to avoid Prisma errors.
        // Prisma's @updatedAt keeps the public "최근 업데이트" chip in sync when
        // visit information, operating hours, or photos change through admin.
        const updateData: any = {};
        const allowedFields = ['name', 'nameKo', 'description', 'descriptionKo', 'country', 'city', 'cityKo', 'type', 'latitude', 'longitude', 'imageUrl', 'website', 'popularityScore', 'visitorInfo', 'openingHours', 'placePhotos', 'cachedPhotoUrls', 'lastPhotoSync', 'lastSyncedAt', 'sourceAttribution', 'primaryImageSource', 'primaryImageLicense', 'primaryImageAttribution'];
        for (const field of allowedFields) {
            if (body[field] !== undefined) {
                updateData[field] = body[field];
            }
        }

        const updated = await prisma.museum.update({
            where: { id },
            data: updateData,
        });

        return successResponse(updated);
    } catch (err: any) {
        if (err.message === 'UNAUTHORIZED') return errorResponse('UNAUTHORIZED', 'Admin access required', 401);
        if (err.message === 'FORBIDDEN') return errorResponse('FORBIDDEN', 'Admin access required', 403);
        console.error('Admin Museum PUT Error:', err);
        return errorResponse('INTERNAL_SERVER_ERROR', 'Failed to update museum', 500);
    }
}

export async function DELETE(req: NextRequest) {
    try {
        await requireAdmin();
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) return errorResponse('BAD_REQUEST', 'Museum ID is required', 400);

        await prisma.museum.delete({ where: { id } });
        return successResponse({ success: true });
    } catch (err: any) {
        if (err.message === 'UNAUTHORIZED') return errorResponse('UNAUTHORIZED', 'Admin access required', 401);
        if (err.message === 'FORBIDDEN') return errorResponse('FORBIDDEN', 'Admin access required', 403);
        console.error('Admin Museum DELETE Error:', err);
        return errorResponse('INTERNAL_SERVER_ERROR', 'Failed to delete museum', 500);
    }
}
