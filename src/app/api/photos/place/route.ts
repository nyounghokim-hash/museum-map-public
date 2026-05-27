import { NextRequest, NextResponse } from 'next/server';

/**
 * Google Places Photo Proxy — DISABLED
 * 
 * 2026-03-09: Google API 비용 방지를 위해 비활성화.
 * 모든 사진은 Supabase Storage cachedPhotoUrls를 통해 서빙됩니다.
 * 이 엔드포인트는 봇/크롤러의 잔여 호출을 차단하기 위해 유지합니다.
 */
export async function GET(req: NextRequest) {
    // Google API 호출 완전 차단 — 비용 발생 방지
    return NextResponse.json(
        { error: 'Photo proxy disabled. Use cachedPhotoUrls from Supabase Storage.' },
        {
            status: 410,  // 410 Gone
            headers: {
                'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=86400',
            }
        }
    );
}
