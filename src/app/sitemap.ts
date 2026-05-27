import { MetadataRoute } from 'next';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 3600; // Revalidate every hour

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = 'https://museummap.app';

    // Static pages
    const staticPages: MetadataRoute.Sitemap = [
        {
            url: baseUrl,
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: 1,
        },
        {
            url: `${baseUrl}/blog`,
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: 0.9,
        },
        {
            url: `${baseUrl}/artworks`,
            lastModified: new Date(),
            changeFrequency: 'weekly',
            priority: 0.75,
        },
        {
            url: `${baseUrl}/collections`,
            lastModified: new Date(),
            changeFrequency: 'weekly',
            priority: 0.7,
        },
        {
            url: `${baseUrl}/info`,
            lastModified: new Date(),
            changeFrequency: 'monthly',
            priority: 0.4,
        },
        {
            url: `${baseUrl}/terms`,
            lastModified: new Date(),
            changeFrequency: 'monthly',
            priority: 0.3,
        },
        {
            url: `${baseUrl}/feedback`,
            lastModified: new Date(),
            changeFrequency: 'monthly',
            priority: 0.3,
        },
    ];

    // Dynamic blog posts (with safe fallback)
    let blogPages: MetadataRoute.Sitemap = [];
    let museumPages: MetadataRoute.Sitemap = [];
    let artworkPages: MetadataRoute.Sitemap = [];
    try {
        const posts = await (prisma as any).story.findMany({
            where: { status: 'PUBLISHED' },
            select: { id: true, updatedAt: true },
        });
        blogPages = posts.map((post: any) => ({
            url: `${baseUrl}/blog/${post.id}`,
            lastModified: post.updatedAt,
            changeFrequency: 'weekly' as const,
            priority: 0.8,
        }));
    } catch (e) {
        console.error('Sitemap: failed to fetch blog posts', e);
    }

    // Dynamic museum pages
    try {
        const museums = await (prisma as any).museum.findMany({
            select: { id: true, updatedAt: true },
            orderBy: { popularityScore: 'desc' },
            take: 500,
        });
        museumPages = museums.map((m: any) => ({
            url: `${baseUrl}/museums/${m.id}`,
            lastModified: m.updatedAt,
            changeFrequency: 'weekly' as const,
            priority: 0.6,
        }));
    } catch (e) {
        console.error('Sitemap: failed to fetch museums', e);
    }

    // Dynamic artwork pages
    try {
        const artworks = await (prisma as any).artwork.findMany({
            where: { image: { not: null } },
            select: { id: true, updatedAt: true },
            orderBy: { updatedAt: 'desc' },
            take: 1000,
        });
        artworkPages = artworks.map((artwork: any) => ({
            url: `${baseUrl}/artworks/${artwork.id}`,
            lastModified: artwork.updatedAt,
            changeFrequency: 'monthly' as const,
            priority: 0.55,
        }));
    } catch (e) {
        console.error('Sitemap: failed to fetch artworks', e);
    }

    return [...staticPages, ...blogPages, ...museumPages, ...artworkPages];
}
