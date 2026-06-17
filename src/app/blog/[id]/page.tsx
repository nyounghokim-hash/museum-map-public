import { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { t } from '@/lib/i18n';
import Link from 'next/link';
import { cookies, headers } from 'next/headers';
import BlogContentClient from './BlogContentClient';
import { getMuseumImageSrc, isRenderableUrl } from '@/lib/getMuseumImage';
import { getDisplayStoryTitle } from '@/lib/storyTitle';

const SITE_URL = 'https://museummap.app';
const VALID_LOCALES = ['en', 'ko', 'ja', 'de', 'fr', 'es', 'pt', 'zh-CN', 'zh-TW', 'da', 'fi', 'sv', 'et'] as const;
type SupportedLocale = typeof VALID_LOCALES[number];

function normalizeLocale(value: string | null | undefined): SupportedLocale | null {
    if (!value) return null;
    const normalized = value.trim();
    if ((VALID_LOCALES as readonly string[]).includes(normalized)) return normalized as SupportedLocale;
    const lower = normalized.toLowerCase();
    if (lower.startsWith('zh-cn') || lower.startsWith('zh-hans')) return 'zh-CN';
    if (lower.startsWith('zh-tw') || lower.startsWith('zh-hant') || lower.startsWith('zh-hk')) return 'zh-TW';
    const short = lower.split('-')[0];
    return (VALID_LOCALES as readonly string[]).includes(short) ? short as SupportedLocale : null;
}

async function getRequestLocale(): Promise<SupportedLocale> {
    const cookieStore = await cookies();
    const cookieLocale = normalizeLocale(cookieStore.get('mm_locale')?.value || cookieStore.get('locale')?.value);
    if (cookieLocale) return cookieLocale;
    const headerList = await headers();
    const acceptLanguage = headerList.get('accept-language') || '';
    for (const part of acceptLanguage.split(',')) {
        const locale = normalizeLocale(part.split(';')[0]);
        if (locale) return locale;
    }
    return 'en';
}

function plainText(value: unknown) {
    return String(value || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
    const resolvedParams = await params;
    const post = await (prisma as any).story.findUnique({
        where: { id: resolvedParams.id },
        select: {
            title: true, titleEn: true, content: true, contentEn: true,
            description: true, previewImage: true, author: true,
            createdAt: true, updatedAt: true,
            museums: { include: { museum: { select: { name: true, nameKo: true, nameEn: true, nameTranslations: true, city: true, cityKo: true, cityTranslations: true, country: true } } } }
        }
    });

    if (!post) {
        return { title: 'Post Not Found - Museum Map' };
    }

    const locale = await getRequestLocale();
    const isKo = locale === 'ko';

    const displayTitle = getDisplayStoryTitle(isKo ? post.title : (post.titleEn || post.title), post.museums);
    const displayContent = isKo ? post.content : (post.contentEn || post.content);
    const plainContent = plainText(displayContent);
    const description = post.description || plainContent.substring(0, 160) + '...';
    const canonicalUrl = `${SITE_URL}/blog/${resolvedParams.id}`;

    // Extract museum names for keywords
    const museumNames = post.museums?.map((sm: any) => sm.museum?.name).filter(Boolean) || [];
    const museumCities = post.museums?.map((sm: any) => sm.museum?.city).filter(Boolean) || [];

    // Generate rich keywords from content
    const baseKeywords = isKo
        ? ['미술관', '박물관', '여행', '현대미술', '전시회', '미술관 추천', '박물관 여행', '아트 투어', '미술 여행']
        : ['museum', 'art gallery', 'travel', 'contemporary art', 'exhibition', 'museum guide', 'art tour', 'art travel'];
    const keywords = [...baseKeywords, ...museumNames, ...museumCities].filter(Boolean);

    return {
        title: `${displayTitle} | Museum Map Story`,
        description,
        keywords,
        authors: [{ name: post.author || 'MM Editor' }],
        creator: 'Museum Map',
        publisher: 'Museum Map',
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
            title: displayTitle,
            description,
            url: canonicalUrl,
            siteName: 'Museum Map',
            images: post.previewImage ? [{
                url: post.previewImage,
                width: 1200,
                height: 630,
                alt: displayTitle,
            }] : [{
                url: `${SITE_URL}/og-image.png?v=3`,
                width: 1200,
                height: 630,
                alt: 'Museum Map',
            }],
            type: 'article',
            publishedTime: post.createdAt?.toISOString(),
            modifiedTime: post.updatedAt?.toISOString(),
            authors: [post.author || 'MM Editor'],
            section: 'Museum & Art',
            tags: keywords.slice(0, 10),
        },
        twitter: {
            card: 'summary_large_image',
            title: displayTitle,
            description,
            images: post.previewImage ? [post.previewImage] : [`${SITE_URL}/og-image.png?v=3`],
            creator: '@museummap',
        },
        robots: {
            index: true,
            follow: true,
            googleBot: {
                index: true,
                follow: true,
                'max-video-preview': -1,
                'max-image-preview': 'large' as const,
                'max-snippet': -1,
            },
        },
    };
}

export default async function BlogPostDetail({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = await params;
    const post = await (prisma as any).story.findUnique({
        where: { id: resolvedParams.id },
        include: {
            museums: {
                include: {
                    museum: { select: { id: true, name: true, nameKo: true, nameEn: true, nameTranslations: true, city: true, cityKo: true, cityTranslations: true, country: true, imageUrl: true, cachedPhotoUrls: true, placePhotos: true, type: true, website: true, description: true } }
                }
            }
        }
    });


    const locale = await getRequestLocale();
    const isKo = locale === 'ko';

    if (!post) {
        return (
            <div className="w-full max-w-[1080px] mx-auto px-4 py-20 text-center">
                <h1 className="text-2xl font-bold dark:text-white">Story not found</h1>
                <Link href="/blog" className="text-blue-600 dark:text-blue-400 mt-4 inline-block hover:underline">
                    {t('blog.backToList', locale)}
                </Link>
            </div>
        );
    }

    const displayTitle = getDisplayStoryTitle(isKo ? post.title : (post.titleEn || post.title), post.museums);
    const displayContent = isKo ? post.content : (post.contentEn || post.content);
    const plainContent = plainText(displayContent);
    const description = post.description || plainContent.substring(0, 200);
    const canonicalUrl = `${SITE_URL}/blog/${resolvedParams.id}`;
    const museums = post.museums?.map((sm: any) => sm.museum).filter(Boolean) || [];
    const infoTableRows = Array.isArray(post.infoTable)
        ? post.infoTable.filter((row: any) => row?.label && row?.value)
        : [];

    // Rich JSON-LD with multiple schemas for SEO + AEO
    const jsonLd = {
        "@context": "https://schema.org",
        "@graph": [
            // 1. BlogPosting - Main article schema
            {
                "@type": "BlogPosting",
                "@id": `${canonicalUrl}#article`,
                "mainEntityOfPage": { "@type": "WebPage", "@id": canonicalUrl },
                "headline": displayTitle,
                "name": displayTitle,
                "description": description,
                "image": post.previewImage || `${SITE_URL}/logo.svg`,
                "datePublished": post.createdAt.toISOString(),
                "dateModified": post.updatedAt?.toISOString() || post.createdAt.toISOString(),
                "wordCount": plainContent.split(/\s+/).length,
                "inLanguage": locale,
                "author": {
                    "@type": "Person",
                    "name": post.author || "MM Editor",
                    "url": SITE_URL
                },
                "publisher": {
                    "@type": "Organization",
                    "name": "Museum Map",
                    "url": SITE_URL,
                    "logo": {
                        "@type": "ImageObject",
                        "url": `${SITE_URL}/icon.svg`
                    }
                },
                "about": museums.map((m: any) => ({
                    "@type": "Museum",
                    "name": m.name,
                    "url": `${SITE_URL}/museums/${m.id}`,
                    ...(m.city && { "address": { "@type": "PostalAddress", "addressLocality": m.city, "addressCountry": m.country } }),
                    ...(m.website && { "sameAs": m.website }),
                    ...(m.description && { "description": m.description.substring(0, 200) }),
                })),
                ...(infoTableRows.length > 0 && {
                    "additionalProperty": infoTableRows.map((row: any) => ({
                        "@type": "PropertyValue",
                        "name": String(row.label),
                        "value": String(row.value),
                    })),
                }),
                "mentions": museums.map((m: any) => ({
                    "@type": "Place",
                    "name": m.nameKo || m.name,
                    ...(m.city && { "address": `${m.city}, ${m.country}` }),
                    "url": `${SITE_URL}/museums/${m.id}`,
                })),
                ...(museums.length > 0 && {
                    "spatialCoverage": museums.map((m: any) => ({
                        "@type": "Place",
                        "name": [m.cityKo || m.city, m.country].filter(Boolean).join(", "),
                    })),
                }),
                "speakable": {
                    "@type": "SpeakableSpecification",
                    "cssSelector": ["h1", ".mm-content", ".mm-info-table"],
                },
                "keywords": [
                    ...museums.map((m: any) => m.name),
                    "museum", "art gallery", "travel guide",
                    isKo ? "미술관 여행" : "art travel",
                    isKo ? "박물관 추천" : "museum recommendation",
                ].filter(Boolean).join(", "),
                "articleSection": "Museum & Art Travel",
                "isAccessibleForFree": true,
            },
            // 2. BreadcrumbList - Navigation context for search engines
            {
                "@type": "BreadcrumbList",
                "itemListElement": [
                    { "@type": "ListItem", "position": 1, "name": "Home", "item": SITE_URL },
                    { "@type": "ListItem", "position": 2, "name": "MM Story", "item": `${SITE_URL}/blog` },
                    { "@type": "ListItem", "position": 3, "name": displayTitle, "item": canonicalUrl },
                ]
            },
            // 3. Museum entities for AEO - AI can extract museum info directly
            ...museums.map((m: any) => ({
                "@type": "Museum",
                "@id": `${SITE_URL}/museums/${m.id}`,
                "name": m.name,
                ...(m.description && { "description": m.description.substring(0, 300) }),
                ...(m.city && {
                    "address": {
                        "@type": "PostalAddress",
                        "addressLocality": m.city,
                        "addressCountry": m.country
                    }
                }),
                ...(m.imageUrl && { "image": m.imageUrl }),
                ...(m.website && { "sameAs": m.website }),
                ...(m.type && { "additionalType": m.type }),
                "url": `${SITE_URL}/museums/${m.id}`,
            })),
            // 4. WebPage schema for the page itself
            {
                "@type": "WebPage",
                "@id": canonicalUrl,
                "url": canonicalUrl,
                "name": displayTitle,
                "description": description,
                "isPartOf": { "@type": "WebSite", "@id": `${SITE_URL}/#website` },
                "inLanguage": locale,
                "potentialAction": {
                    "@type": "ReadAction",
                    "target": canonicalUrl,
                },
                "breadcrumb": { "@id": `${canonicalUrl}#breadcrumb` },
            }
        ]
    };

    // 스토리 previewImage 가 Google 원본 URL이면 무효로 간주하고 fallback 사용.
    // (DB에 Google lh3 URL이 저장된 레거시 레코드가 일부 있음)
    const previewIsRenderable = isRenderableUrl(post.previewImage);
    const autoPreviewImage = !previewIsRenderable
        ? (post.storyArtworks?.find((sa: any) => sa.artwork?.image)?.artwork?.image
            || (post.artworks as any[])?.find((a: any) => a.image)?.image
            || (() => {
                for (const sm of post.museums || []) {
                    const src = getMuseumImageSrc(sm.museum || {});
                    if (src) return src;
                }
                return null;
            })()
            || null)
        : null;

    const serializedPost = {
        ...post,
        createdAt: post.createdAt.toISOString(),
        updatedAt: post.updatedAt?.toISOString() || null,
        infoTable: post.infoTable || null,
        previewImage: previewIsRenderable ? post.previewImage : autoPreviewImage,
        artworks: await enrichArtworksFromDB(post.artworks || [], post.storyArtworks || []),
        museums: post.museums?.map((sm: any) => sm.museum) || [],
        collectionId: post.collectionId || null,
    };


    async function enrichArtworksFromDB(artworks: any[], storyArtworks: any[]) {
        // Merge storyArtworks (DB-linked) with inline artworks (JSON)
        const dbLinked = storyArtworks.map((sa: any) => ({
            id: sa.artwork?.id,
            title: sa.artwork?.title,
            titleKo: sa.artwork?.titleKo,
            artist: sa.artwork?.artist,
            artistKo: sa.artwork?.artistKo,
            image: sa.artwork?.image,
            description: sa.artwork?.description,
            descriptionKo: sa.artwork?.descriptionKo,
        })).filter((a: any) => a.title);

        if (!artworks || artworks.length === 0) return dbLinked;

        try {
            const titles = artworks.map((a: any) => a.title).filter(Boolean);
            const dbArtworks = await (prisma as any).artwork.findMany({
                where: { title: { in: titles } },
                select: { id: true, title: true, titleKo: true, artistKo: true, descriptionKo: true, image: true }
            });
            const dbMap: Record<string, any> = {};
            dbArtworks.forEach((a: any) => { dbMap[a.title] = a; });

            const enriched = artworks.map((a: any) => ({
                ...a,
                id: a.id || dbMap[a.title]?.id || null,
                image: a.image || dbMap[a.title]?.image || null,
                titleKo: a.titleKo || dbMap[a.title]?.titleKo || null,
                artistKo: a.artistKo || dbMap[a.title]?.artistKo || null,
                descriptionKo: a.descriptionKo || dbMap[a.title]?.descriptionKo || null,
            }));

            // Merge: DB-linked artworks first, then inline ones not already in DB-linked
            const dbLinkedTitles = new Set(dbLinked.map((a: any) => a.title));
            return [...dbLinked, ...enriched.filter((a: any) => !dbLinkedTitles.has(a.title))];
        } catch { return [...dbLinked, ...artworks]; }
    }

    return (
        <article className="w-full max-w-[1080px] mx-auto lg:px-4 lg:py-8 lg:mt-8 pb-0 lg:pb-8 relative">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />



            <div className="bg-white dark:bg-neutral-900 overflow-hidden lg:bg-transparent dark:lg:bg-transparent lg:overflow-visible">
                <BlogContentClient post={serializedPost} serverLocale={locale} />
            </div>
        </article>
    );
}
