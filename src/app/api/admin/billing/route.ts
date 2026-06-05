import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * Google Maps/Places API 사용량 — DB 기반 자체 카운팅
 * 2025.03~ 새 가격 체계: $200 월 크레딧 폐지, SKU별 무료 cap
 * 
 * 무료 사용량 (월):
 *   Essentials: 10,000회 (Place Details)
 *   Pro:         5,000회 (Text Search)
 *   Place Photos: 무료 cap 없음 (유료)
 * 
 * 참고: https://developers.google.com/maps/billing-and-pricing/pricing
 */

// Google Maps Platform 단가 + 무료 cap (2025.03~)
const SKUS = {
    textSearch: {
        perRequest: 0.032,
        freeCap: 5000,       // Pro tier: 5,000/월
        tier: 'Pro',
        label: 'Text Search',
        labelKo: '장소 검색 (PlaceID)',
    },
    placeDetails: {
        perRequest: 0.017,
        freeCap: 10000,      // Essentials tier: 10,000/월
        tier: 'Essentials',
        label: 'Place Details',
        labelKo: '상세 정보 (평점/운영시간)',
    },
    placePhotos: {
        perRequest: 0.007,
        freeCap: 0,          // 무료 cap 없음
        tier: 'Essentials',
        label: 'Place Photos',
        labelKo: '사진 다운로드',
    },
} as const;

function calcSkuCost(calls: number, sku: typeof SKUS[keyof typeof SKUS]) {
    const billable = Math.max(0, calls - sku.freeCap);
    return {
        calls,
        freeCap: sku.freeCap,
        billableCalls: billable,
        cost: +(billable * sku.perRequest).toFixed(2),
        tier: sku.tier,
        perRequest: sku.perRequest,
        label: sku.label,
        labelKo: sku.labelKo,
    };
}

export async function GET() {
    try {
        await requireAdmin();
    } catch (err: any) {
        if (err.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (err.message === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        throw err;
    }

    try {
        // 1. 전체 통계 (누적)
        const stats: any[] = await prisma.$queryRaw`
            SELECT 
                COUNT(*)::int as total_museums,
                COUNT(place_id)::int as with_place_id,
                COUNT("googleRating")::int as with_rating,
                COUNT(cached_photo_urls)::int as with_photos
            FROM "Museum"
        `;
        const s = stats[0];

        // 2. 총 사진 수
        const photoStats: any[] = await prisma.$queryRaw`
            SELECT COALESCE(SUM(jsonb_array_length(cached_photo_urls::jsonb)), 0)::int as total_photos
            FROM "Museum" WHERE cached_photo_urls IS NOT NULL
        `;
        const totalPhotos = photoStats[0].total_photos;

        // 3. 최근 30일 동기화
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const recentStats: any[] = await prisma.$queryRaw`
            SELECT COUNT(*)::int as synced_count
            FROM "Museum" WHERE last_synced_at >= ${thirtyDaysAgo}
        `;
        const recentPhotoStats: any[] = await prisma.$queryRaw`
            SELECT COALESCE(SUM(jsonb_array_length(cached_photo_urls::jsonb)), 0)::int as total_photos
            FROM "Museum" WHERE last_synced_at >= ${thirtyDaysAgo} AND cached_photo_urls IS NOT NULL
        `;
        const recentSynced = recentStats[0].synced_count;
        const recentPhotos = recentPhotoStats[0].total_photos;

        // 4. 월간 비용 계산 (SKU별 무료 cap 적용)
        const monthly = {
            textSearch: calcSkuCost(recentSynced, SKUS.textSearch),
            placeDetails: calcSkuCost(recentSynced, SKUS.placeDetails),
            placePhotos: calcSkuCost(recentPhotos, SKUS.placePhotos),
        };
        const monthlyTotal = monthly.textSearch.cost + monthly.placeDetails.cost + monthly.placePhotos.cost;

        // 5. 누적 비용 (참고용, 무료 cap 미적용)
        const allTimeRaw = s.with_place_id * (SKUS.textSearch.perRequest + SKUS.placeDetails.perRequest)
            + totalPhotos * SKUS.placePhotos.perRequest;

        return NextResponse.json({
            status: 'db_tracking',
            pricingModel: 'SKU별 무료 cap (2025.03~)',
            pricingUrl: 'https://developers.google.com/maps/billing-and-pricing/pricing',

            // 월간 (30일)
            summary: {
                period: '30일',
                lastUpdated: new Date().toISOString(),
                totalCalls: recentSynced * 2 + recentPhotos,
                totalEstimatedCostUSD: +monthlyTotal.toFixed(2),
                totalEstimatedCostKRW: Math.round(monthlyTotal * 1450),
                skus: monthly,
            },

            // 누적 (전체)
            allTime: {
                totalMuseums: s.total_museums,
                withPlaceId: s.with_place_id,
                withRating: s.with_rating,
                totalPhotos,
                totalCostUSD: +allTimeRaw.toFixed(2),
                totalCostKRW: Math.round(allTimeRaw * 1450),
                note: '무료 cap 미적용 최대 비용 (실제 청구액은 더 적음)',
            },

            // 무료 사용량 정보
            freeTiers: {
                textSearch: { free: 5000, tier: 'Pro', used: recentSynced, remaining: Math.max(0, 5000 - recentSynced) },
                placeDetails: { free: 10000, tier: 'Essentials', used: recentSynced, remaining: Math.max(0, 10000 - recentSynced) },
                placePhotos: { free: 0, tier: 'Essentials', note: '무료 cap 없음' },
            },
        });
    } catch (error: any) {
        console.error('Billing API error:', error.message);
        return NextResponse.json({ error: 'Failed to calculate', message: error.message?.substring(0, 200) }, { status: 500 });
    }
}
