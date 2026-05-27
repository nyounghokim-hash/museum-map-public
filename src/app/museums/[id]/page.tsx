import { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import MuseumClient from './MuseumClient';
import { headers } from 'next/headers';
import { transformMuseumPhotos } from '@/lib/photo-proxy';

const SITE_URL = 'https://museummap.app';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
    const resolvedParams = await params;
    const museum = await (prisma as any).museum.findUnique({
        where: { id: resolvedParams.id },
        select: { name: true, nameKo: true, nameEn: true, description: true, descriptionKo: true, imageUrl: true, city: true, cityKo: true, country: true, type: true, googleRating: true, googleRatingsTotal: true }
    });

    if (!museum) {
        return { title: 'Museum Not Found - Museum Map' };
    }

    const headerList = headers();
    const acceptLanguage = (await headerList).get('accept-language') || 'en';
    const isKo = acceptLanguage.includes('ko');

    const title = isKo ? (museum.nameKo || museum.name) : museum.name;
    const description = isKo
        ? (museum.descriptionKo || museum.description || `${museum.nameKo || museum.name} - ${museum.cityKo || museum.city || ''}`).substring(0, 160)
        : (museum.description || `${museum.name} - ${museum.city || ''}, ${museum.country || ''}`).substring(0, 160);
    const canonicalUrl = `${SITE_URL}/museums/${resolvedParams.id}`;

    const keywords = isKo
        ? [museum.nameKo || museum.name, museum.cityKo || museum.city, '미술관', '박물관', '여행', '관람정보', '전시회'].filter(Boolean)
        : [museum.name, museum.city, 'museum', 'art gallery', 'travel', 'visitor info', 'exhibitions'].filter(Boolean);

    return {
        title: `${title} | Museum Map`,
        description,
        keywords,
        alternates: {
            canonical: canonicalUrl,
            languages: {
                'ko-KR': canonicalUrl, 'en-US': canonicalUrl, 'ja-JP': canonicalUrl,
                'zh-CN': canonicalUrl, 'zh-TW': canonicalUrl, 'de-DE': canonicalUrl,
                'fr-FR': canonicalUrl, 'es-ES': canonicalUrl, 'pt-PT': canonicalUrl,
                'da-DK': canonicalUrl, 'fi-FI': canonicalUrl, 'sv-SE': canonicalUrl,
                'et-EE': canonicalUrl,
            },
        },
        openGraph: {
            title,
            description,
            url: canonicalUrl,
            siteName: 'Museum Map',
            images: museum.imageUrl ? [{
                url: museum.imageUrl,
                width: 1200,
                height: 630,
                alt: title,
            }] : [{
                url: `${SITE_URL}/og-image.png?v=2`,
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
            images: museum.imageUrl ? [museum.imageUrl] : [`${SITE_URL}/og-image.png?v=2`],
        },
        robots: { index: true, follow: true },
    };
}

export default async function MuseumDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = await params;

    // Fetch full museum data server-side (shared for JSON-LD + initialData)
    const museum = await (prisma as any).museum.findUnique({
        where: { id: resolvedParams.id },
        include: {
            artworks: {
                select: { id: true, title: true, titleKo: true, titleTranslations: true, artist: true, artistKo: true, artistTranslations: true, image: true, description: true, descriptionKo: true, year: true },
                orderBy: { createdAt: 'asc' }
            },
            exhibitions: true,
            reviews: {
                take: 5,
                orderBy: { createdAt: 'desc' },
                include: { user: { select: { id: true, name: true, image: true } } }
            },
        }
    });

    const headerList = await headers();
    const acceptLanguage = headerList.get('accept-language') || 'en';
    const isKo = acceptLanguage.includes('ko');

    // Prepare initialData for client (apply photo proxy transform, strip geometry)
    let initialData = null;
    if (museum) {
        const { location, ...safeMuseumData } = museum as any;
        initialData = transformMuseumPhotos(safeMuseumData);
    }

    const museumJsonLd = museum ? {
        "@context": "https://schema.org",
        "@type": "Museum",
        "@id": `${SITE_URL}/museums/${resolvedParams.id}`,
        "name": museum.name,
        ...(museum.nameKo && { "alternateName": museum.nameKo }),
        "description": (isKo ? museum.descriptionKo : museum.description)?.substring(0, 300) || museum.description?.substring(0, 300),
        "url": `${SITE_URL}/museums/${resolvedParams.id}`,
        ...(museum.website && { "sameAs": museum.website }),
        "image": museum.placePhotos?.[0] || museum.imageUrl || `${SITE_URL}/og-image.png`,
        ...(museum.address && {
            "address": {
                "@type": "PostalAddress",
                "streetAddress": museum.address,
                ...(museum.city && { "addressLocality": museum.city }),
                ...(museum.country && { "addressCountry": museum.country }),
            }
        }),
        ...(!museum.address && museum.city && {
            "address": {
                "@type": "PostalAddress",
                "addressLocality": museum.city,
                ...(museum.country && { "addressCountry": museum.country }),
            }
        }),
        ...(museum.latitude && museum.longitude && {
            "geo": {
                "@type": "GeoCoordinates",
                "latitude": museum.latitude,
                "longitude": museum.longitude,
            }
        }),
        ...(museum.googleRating && {
            "aggregateRating": {
                "@type": "AggregateRating",
                "ratingValue": museum.googleRating,
                "bestRating": 5,
                ...(museum.googleRatingsTotal && { "ratingCount": museum.googleRatingsTotal }),
            }
        }),
        ...(museum.type && { "additionalType": museum.type }),
        "isAccessibleForFree": true,
    } : null;

    return (
        <>
            {museumJsonLd && (
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(museumJsonLd) }}
                />
            )}
            <MuseumClient museumId={resolvedParams.id} initialData={initialData} />
        </>
    );
}
