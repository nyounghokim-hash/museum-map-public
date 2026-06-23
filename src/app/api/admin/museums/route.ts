import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-utils';
import { Prisma } from '@/generated_v2/client';

type MuseumPayload = Record<string, unknown>;

const MUSEUM_WRITE_FIELDS = [
    'name',
    'nameKo',
    'nameEn',
    'description',
    'descriptionKo',
    'summary',
    'summaryTranslations',
    'country',
    'city',
    'cityKo',
    'cityTranslations',
    'type',
    'latitude',
    'longitude',
    'imageUrl',
    'website',
    'phone',
    'googleRating',
    'googleRatingsTotal',
    'placeId',
    'placePhotos',
    'cachedPhotoUrls',
    'lastPhotoSync',
    'lastSyncedAt',
    'openingHours',
    'visitorInfo',
    'popularityScore',
    'sourceAttribution',
    'primaryImageSource',
    'primaryImageLicense',
    'primaryImageAttribution',
] as const;

const NUMERIC_FIELDS = new Set(['latitude', 'longitude', 'googleRating', 'popularityScore']);
const INTEGER_FIELDS = new Set(['googleRatingsTotal']);
const DATE_FIELDS = new Set(['lastPhotoSync', 'lastSyncedAt']);
const JSON_ARRAY_FIELDS = new Set(['placePhotos', 'cachedPhotoUrls']);

function isPayloadRecord(value: unknown): value is MuseumPayload {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function unwrapMuseumPayload(body: unknown): MuseumPayload {
    if (!isPayloadRecord(body)) return {};
    return isPayloadRecord(body.data) ? body.data : body;
}

function parseOptionalNumber(value: unknown) {
    if (value === null) return null;
    if (value === '') return null;
    const num = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(num) ? num : undefined;
}

function parseOptionalInteger(value: unknown) {
    const num = parseOptionalNumber(value);
    if (num === undefined || num === null) return num;
    return Math.trunc(num);
}

function parseOptionalDate(value: unknown) {
    if (value === null) return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value;
    if (typeof value !== 'string' && typeof value !== 'number') return undefined;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
}

function parsePhotoArray(value: unknown) {
    const raw = typeof value === 'string' ? (() => {
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [value];
        } catch {
            return [value];
        }
    })() : value;

    if (!Array.isArray(raw)) return undefined;
    const photos = raw
        .filter((url): url is string => typeof url === 'string')
        .map(url => url.trim())
        .filter(Boolean);
    return Array.from(new Set(photos));
}

function normalizeMuseumPayload(input: MuseumPayload) {
    const payload = { ...input };

    if (payload.placeId === undefined && payload.place_id !== undefined) payload.placeId = payload.place_id;
    if (payload.googleRating === undefined && payload.rating !== undefined) payload.googleRating = payload.rating;
    if (payload.googleRatingsTotal === undefined && payload.ratingsTotal !== undefined) payload.googleRatingsTotal = payload.ratingsTotal;
    if (payload.googleRatingsTotal === undefined && payload.userRatingCount !== undefined) payload.googleRatingsTotal = payload.userRatingCount;
    if (payload.cachedPhotoUrls === undefined && payload.cached_photo_urls !== undefined) payload.cachedPhotoUrls = payload.cached_photo_urls;
    if (payload.placePhotos === undefined && payload.photos !== undefined) payload.placePhotos = payload.photos;

    const data: MuseumPayload = {};
    for (const field of MUSEUM_WRITE_FIELDS) {
        if (payload[field] === undefined) continue;

        if (NUMERIC_FIELDS.has(field)) {
            const num = parseOptionalNumber(payload[field]);
            if (num !== undefined) data[field] = num;
            continue;
        }

        if (INTEGER_FIELDS.has(field)) {
            const intValue = parseOptionalInteger(payload[field]);
            if (intValue !== undefined) data[field] = intValue;
            continue;
        }

        if (DATE_FIELDS.has(field)) {
            const date = parseOptionalDate(payload[field]);
            if (date !== undefined) data[field] = date;
            continue;
        }

        if (JSON_ARRAY_FIELDS.has(field)) {
            const photos = parsePhotoArray(payload[field]);
            if (photos !== undefined) data[field] = photos;
            continue;
        }

        data[field] = payload[field];
    }

    const cachedPhotoUrls = parsePhotoArray(data.cachedPhotoUrls);
    const placePhotos = parsePhotoArray(data.placePhotos);
    if (cachedPhotoUrls?.length && !data.imageUrl) data.imageUrl = cachedPhotoUrls[0];
    if (placePhotos?.length && !data.imageUrl) data.imageUrl = placePhotos[0];

    return data;
}

function isAdminError(error: unknown, code: 'UNAUTHORIZED' | 'FORBIDDEN') {
    return error instanceof Error && error.message === code;
}

export async function GET(req: NextRequest) {
    try {
        await requireAdmin();
        const { searchParams } = new URL(req.url);
        const query = searchParams.get('query') || '';
        const page = parseInt(searchParams.get('page') || '1', 10);
        const limit = parseInt(searchParams.get('limit') || '20', 10);
        const offset = (page - 1) * limit;

        const where: Prisma.MuseumWhereInput = {};
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
    } catch (err: unknown) {
        if (isAdminError(err, 'UNAUTHORIZED')) return errorResponse('UNAUTHORIZED', 'Admin access required', 401);
        if (isAdminError(err, 'FORBIDDEN')) return errorResponse('FORBIDDEN', 'Admin access required', 403);
        console.error('Admin Museum GET Error:', err);
        return errorResponse('INTERNAL_SERVER_ERROR', 'Failed to fetch museums', 500);
    }
}

export async function POST(req: NextRequest) {
    try {
        await requireAdmin();
        const body = unwrapMuseumPayload(await req.json());
        const createData = normalizeMuseumPayload(body);
        const { name, country, city, type, latitude, longitude } = createData;

        if (!name || !country || !city || !type || latitude === undefined || longitude === undefined) {
            return errorResponse('BAD_REQUEST', 'Missing required fields', 400);
        }

        const museum = await prisma.museum.create({
            data: {
                ...createData,
                popularityScore: createData.popularityScore ?? 0,
            } as Prisma.MuseumUncheckedCreateInput,
        });

        return successResponse(museum, 201);
    } catch (err: unknown) {
        if (isAdminError(err, 'UNAUTHORIZED')) return errorResponse('UNAUTHORIZED', 'Admin access required', 401);
        if (isAdminError(err, 'FORBIDDEN')) return errorResponse('FORBIDDEN', 'Admin access required', 403);
        console.error('Admin Museum POST Error:', err);
        return errorResponse('INTERNAL_SERVER_ERROR', 'Failed to create museum', 500);
    }
}

export async function PUT(req: NextRequest) {
    try {
        await requireAdmin();
        const body = unwrapMuseumPayload(await req.json());
        const id = typeof body.id === 'string' ? body.id : '';

        if (!id) return errorResponse('BAD_REQUEST', 'Museum ID is required', 400);

        // Explicitly pick only allowed Museum fields to avoid Prisma errors.
        // Prisma's @updatedAt keeps the public "최근 업데이트" chip in sync when
        // visit information, operating hours, ratings, or photos change through admin.
        const updateData = normalizeMuseumPayload(body);

        const updated = await prisma.museum.update({
            where: { id },
            data: updateData as Prisma.MuseumUncheckedUpdateInput,
        });

        return successResponse(updated);
    } catch (err: unknown) {
        if (isAdminError(err, 'UNAUTHORIZED')) return errorResponse('UNAUTHORIZED', 'Admin access required', 401);
        if (isAdminError(err, 'FORBIDDEN')) return errorResponse('FORBIDDEN', 'Admin access required', 403);
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
    } catch (err: unknown) {
        if (isAdminError(err, 'UNAUTHORIZED')) return errorResponse('UNAUTHORIZED', 'Admin access required', 401);
        if (isAdminError(err, 'FORBIDDEN')) return errorResponse('FORBIDDEN', 'Admin access required', 403);
        console.error('Admin Museum DELETE Error:', err);
        return errorResponse('INTERNAL_SERVER_ERROR', 'Failed to delete museum', 500);
    }
}
