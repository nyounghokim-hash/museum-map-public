import { Metadata } from 'next';
import { headers } from 'next/headers';

const SITE_URL = 'https://museummap.app';

export async function generateMetadata(): Promise<Metadata> {
    const headersList = await headers();
    const acceptLanguage = headersList.get('accept-language') || '';
    const isKo = acceptLanguage.toLowerCase().includes('ko');

    const title = isKo
        ? 'MM Story - 세계의 숨은 미술관/박물관 이야기 | Museum Map'
        : 'MM Story - Hidden Museum & Art Gallery Stories | Museum Map';
    const description = isKo
        ? '전 세계 숨겨진 미술관과 박물관의 이야기를 만나보세요. 큐레이터가 엄선한 미술관 여행 가이드, 작품 해설, 전시 리뷰를 제공합니다.'
        : 'Discover stories about hidden museums and art galleries worldwide. Curated travel guides, artwork insights, and exhibition reviews by Museum Map editorial team.';

    return {
        title,
        description,
        keywords: isKo
            ? ['미술관 이야기', '박물관 여행 가이드', '미술관 추천', '숨은 미술관', '전시회 리뷰', '아트 투어', '세계 박물관', '현대미술관', '미술 여행 블로그']
            : ['museum stories', 'art gallery guide', 'museum travel', 'hidden museums', 'exhibition review', 'art tour guide', 'world museums', 'contemporary art', 'museum blog'],
        alternates: {
            canonical: `${SITE_URL}/blog`,
        },
        openGraph: {
            title,
            description,
            url: `${SITE_URL}/blog`,
            siteName: 'Museum Map',
            type: 'website',
            images: [{
                url: `${SITE_URL}/og-image.png?v=2`,
                width: 1200,
                height: 630,
                alt: 'Museum Map Stories',
            }],
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
            images: [`${SITE_URL}/og-image.png?v=2`],
        },
        robots: {
            index: true,
            follow: true,
            googleBot: {
                index: true,
                follow: true,
                'max-image-preview': 'large' as const,
                'max-snippet': -1,
            },
        },
    };
}

export default function BlogLayout({ children }: { children: React.ReactNode }) {
    return children;
}
