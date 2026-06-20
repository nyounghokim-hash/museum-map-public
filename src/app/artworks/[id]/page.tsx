import { Metadata } from 'next';
import { cache } from 'react';
import { prisma } from '@/lib/prisma';
import { headers } from 'next/headers';
import ArtworkDetailClient from './ArtworkDetailClient';

const SITE_URL = 'https://museummap.app';

const getArtworkDetail = cache(async (id: string) => prisma.artwork.findUnique({
    where: { id },
    include: {
        museum: {
            select: { id: true, name: true, nameKo: true, nameEn: true, nameTranslations: true, city: true, cityKo: true, cityTranslations: true, country: true, imageUrl: true, type: true }
        },
        stories: {
            include: {
                story: {
                    select: { id: true, title: true, titleEn: true, previewImage: true, description: true, status: true }
                }
            }
        }
    }
}));

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
    const resolvedParams = await params;
    const artwork = await getArtworkDetail(resolvedParams.id);

    if (!artwork) {
        return { title: 'Artwork Not Found - Museum Map' };
    }

    const headerList = headers();
    const acceptLanguage = (await headerList).get('accept-language') || 'en';
    const isKo = acceptLanguage.includes('ko');

    const displayTitle = isKo ? (artwork.titleKo || artwork.title) : artwork.title;
    const displayArtist = isKo ? (artwork.artistKo || artwork.artist) : artwork.artist;
    const title = `${displayTitle}${displayArtist ? ' — ' + displayArtist : ''}`;
    const description = isKo
        ? (artwork.descriptionKo || artwork.description || `${displayTitle} 작품 상세 정보`).substring(0, 160)
        : (artwork.description || `Details about ${artwork.title}`).substring(0, 160);
    const canonicalUrl = `${SITE_URL}/artworks/${resolvedParams.id}`;

    const keywords = (isKo
        ? ['미술관', '작품', '예술', artwork.title, artwork.artist, '미술 여행']
        : ['artwork', 'art', 'museum', artwork.title, artwork.artist, 'art travel'])
        .filter((keyword): keyword is string => typeof keyword === 'string' && keyword.length > 0);

    return {
        title: `${title} | Museum Map`,
        description,
        keywords,
        openGraph: {
            title,
            description,
            url: canonicalUrl,
            siteName: 'Museum Map',
            images: artwork.image ? [{
                url: artwork.image,
                width: 1200,
                height: 630,
                alt: title,
            }] : [{
                url: `${SITE_URL}/og-image.png?v=3`,
                width: 1200,
                height: 630,
                alt: 'Museum Map',
            }],
            type: 'article',
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
            images: artwork.image ? [artwork.image] : [`${SITE_URL}/og-image.png?v=3`],
        },
        robots: { index: true, follow: true },
    };
}

export default async function ArtworkDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = await params;
    const headerList = headers();
    const acceptLanguage = (await headerList).get('accept-language') || 'en';
    const serverLocale = acceptLanguage.includes('ko') ? 'ko' : acceptLanguage.includes('ja') ? 'ja' : 'en';

    // SSR: Pre-fetch artwork data (like blog detail does)
    const artwork = await getArtworkDetail(resolvedParams.id);

    const initialData = artwork ? {
        id: artwork.id,
        title: artwork.title,
        titleKo: artwork.titleKo,
        titleTranslations: artwork.titleTranslations,
        artist: artwork.artist,
        artistKo: artwork.artistKo,
        artistTranslations: artwork.artistTranslations,
        image: artwork.image,
        description: artwork.description,
        descriptionKo: artwork.descriptionKo,
        year: artwork.year,
        createdAt: artwork.createdAt?.toISOString?.() || null,
        museums: artwork.museum ? [artwork.museum] : [],
        relatedStories: (artwork.stories || [])
            .filter(sa => sa.story?.status === 'PUBLISHED')
            .map(sa => ({
                id: sa.story.id,
                title: sa.story.title,
                titleEn: sa.story.titleEn,
                previewImage: sa.story.previewImage,
                description: sa.story.description,
            })),
    } : null;

    return <ArtworkDetailClient artworkId={resolvedParams.id} serverLocale={serverLocale} initialData={initialData} />;
}
