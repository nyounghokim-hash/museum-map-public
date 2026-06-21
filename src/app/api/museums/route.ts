import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/lib/api-utils';
import { transformMuseumPhotos } from '@/lib/photo-proxy';
import { privateMuseumWhere } from '@/lib/museumVisibility';

const MAP_MUSEUM_SELECT_BASE = {
    id: true,
    name: true,
    nameKo: true,
    nameEn: true,
    country: true,
    city: true,
    cityKo: true,
    type: true,
    imageUrl: true,
    latitude: true,
    longitude: true,
    createdAt: true,
    googleRating: true,
    cachedPhotoUrls: true,
} as const;

const MAP_CACHE_REVALIDATE_SECONDS = 300;
const MAP_RESPONSE_MEMORY_TTL_MS = 5 * 60 * 1000;
const mapResponseMemoryCache = new Map<string, { ts: number; body: string }>();

function getMapResponseHeaders(cacheStatus: 'HIT' | 'MISS') {
    return {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': `public, max-age=120, s-maxage=${MAP_CACHE_REVALIDATE_SECONDS}, stale-while-revalidate=1800`,
        'X-Museum-Map-Cache': cacheStatus,
    };
}

function mapJsonResponse(body: string, cacheStatus: 'HIT' | 'MISS') {
    return new NextResponse(body, {
        status: 200,
        headers: getMapResponseHeaders(cacheStatus),
    });
}

function getMapMuseumSelect(locale: string) {
    const needsTranslations = locale !== 'ko' && locale !== 'en';
    if (!needsTranslations) return MAP_MUSEUM_SELECT_BASE;
    return {
        ...MAP_MUSEUM_SELECT_BASE,
        nameTranslations: true,
        cityTranslations: true,
    } as const;
}

async function fetchMapMuseums(locale: string, offset: number, limit: number) {
    const data = await prisma.museum.findMany({
        where: { AND: [privateMuseumWhere as any] },
        orderBy: { popularityScore: 'desc' },
        skip: offset,
        take: limit,
        select: getMapMuseumSelect(locale),
    });
    return data.map(museum => toMapMuseum(museum, locale));
}

function pickLocaleTranslations(value: unknown, locale: string) {
    if (!locale || locale === 'ko' || locale === 'en' || !value || typeof value !== 'object') return undefined;
    const translated = (value as Record<string, unknown>)[locale];
    return typeof translated === 'string' && translated ? { [locale]: translated } : undefined;
}

function toMapMuseum(museum: any, locale: string) {
    const transformed = transformMuseumPhotos(museum);
    return {
        id: transformed.id,
        name: transformed.name,
        nameKo: transformed.nameKo,
        nameEn: transformed.nameEn && transformed.nameEn !== transformed.name ? transformed.nameEn : undefined,
        nameTranslations: pickLocaleTranslations(transformed.nameTranslations, locale),
        country: transformed.country,
        city: transformed.city,
        cityKo: transformed.cityKo && transformed.cityKo !== transformed.city ? transformed.cityKo : undefined,
        cityTranslations: pickLocaleTranslations(transformed.cityTranslations, locale),
        type: transformed.type,
        imageUrl: transformed.imageUrl || '',
        latitude: transformed.latitude,
        longitude: transformed.longitude,
        createdAt: transformed.createdAt ? new Date(transformed.createdAt).toISOString().slice(0, 10) : undefined,
        googleRating: transformed.googleRating,
    };
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const query = searchParams.get('query');
        const country = searchParams.get('country');
        const bbox = searchParams.get('bbox'); // format: minLng,minLat,maxLng,maxLat
        const page = parseInt(searchParams.get('page') || '1', 10);
        const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 5000);
        const offset = (page - 1) * limit;
        const isMapView = searchParams.get('view') === 'map' || searchParams.get('fields') === 'map';
        const locale = searchParams.get('locale') || 'ko';

        // Support fetching multiple museums by IDs (for compare feature)
        const ids = searchParams.get('ids');
        if (ids) {
            const idList = ids.split(',').filter(Boolean).slice(0, 10);
            if (idList.length === 0) {
                return successResponse({ data: [], total: 0, page: 1, limit: 0 });
            }
            const museums = await prisma.museum.findMany({
                where: { AND: [{ id: { in: idList } }, privateMuseumWhere as any] },
                select: {
                    id: true, name: true, nameKo: true, nameEn: true, nameTranslations: true,
                    description: true, descriptionKo: true, summary: true, summaryTranslations: true, country: true, city: true, cityKo: true, cityTranslations: true,
                    type: true, website: true, imageUrl: true, latitude: true, longitude: true, popularityScore: true,
                    createdAt: true, googleRating: true, googleRatingsTotal: true, placePhotos: true, cachedPhotoUrls: true,
                    openingHours: true, visitorInfo: true, address: true, phone: true,
                }
            });
            return successResponse({ data: museums.map(transformMuseumPhotos), total: museums.length, page: 1, limit: museums.length });
        }

        const where: any = { AND: [privateMuseumWhere] };

        if (bbox) {
            const parts = bbox.split(',').map(Number);
            if (parts.length !== 4 || parts.some(isNaN)) {
                return errorResponse('INVALID_BBOX', 'Invalid bounding box parameters. Expected minLng,minLat,maxLng,maxLat', 400);
            }
            const [minLng, minLat, maxLng, maxLat] = parts;
            where.AND.push({
                longitude: { gte: minLng, lte: maxLng },
                latitude: { gte: minLat, lte: maxLat },
            });
        }

        const q = searchParams.get('q') || query;
        if (q) {
            where.AND.push({
                OR: [
                    { name: { contains: q, mode: 'insensitive' } },
                    { nameKo: { contains: q, mode: 'insensitive' } },
                    { nameEn: { contains: q, mode: 'insensitive' } },
                    { city: { contains: q, mode: 'insensitive' } },
                    { cityKo: { contains: q, mode: 'insensitive' } },
                    { country: { contains: q, mode: 'insensitive' } },
                    { type: { contains: q, mode: 'insensitive' } },
                    { summary: { contains: q, mode: 'insensitive' } },
                    { descriptionKo: { contains: q, mode: 'insensitive' } },
                ],
            });
        }
        if (country && !q) {
            where.AND.push({ country });
        }

        if (isMapView && !bbox && !q && !country) {
            const responseCacheKey = `${locale}:${offset}:${limit}`;
            const cachedResponse = mapResponseMemoryCache.get(responseCacheKey);
            if (cachedResponse && Date.now() - cachedResponse.ts < MAP_RESPONSE_MEMORY_TTL_MS) {
                return mapJsonResponse(cachedResponse.body, 'HIT');
            }
            const data = await fetchMapMuseums(locale, offset, limit);
            const body = JSON.stringify({ data: { data, total: data.length, page, limit } });
            mapResponseMemoryCache.set(responseCacheKey, { ts: Date.now(), body });
            return mapJsonResponse(body, 'MISS');
        }

        const data = await prisma.museum.findMany({
            where,
            orderBy: { popularityScore: 'desc' },
            skip: offset,
            take: limit,
            select: isMapView ? getMapMuseumSelect(locale) : {
                id: true, name: true, nameKo: true, nameEn: true, nameTranslations: true, description: true, descriptionKo: true, summary: true, summaryTranslations: true, country: true, city: true, cityKo: true, cityTranslations: true,
                type: true, website: true, imageUrl: true, latitude: true, longitude: true, popularityScore: true,
                createdAt: true, googleRating: true, googleRatingsTotal: true, placePhotos: true, cachedPhotoUrls: true,
                openingHours: true, visitorInfo: true, address: true, phone: true
            }
        });
        const count = isMapView ? data.length : await prisma.museum.count({ where });

        return successResponse({ data: isMapView ? data.map(museum => toMapMuseum(museum, locale)) : data.map(transformMuseumPhotos), total: count, page, limit });
    } catch (err: any) {
        console.error('API Error /museums:', err);
        return errorResponse('INTERNAL_SERVER_ERROR', 'Failed to fetch museums', 500, err.message);
    }
}
