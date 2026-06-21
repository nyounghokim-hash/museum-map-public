import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-utils';
import fs from 'fs';
import path from 'path';
import { translateText } from '@/lib/translate';
import { transformNestedPhotos } from '@/lib/photo-proxy';

// Sanitize HTML — simple regex-based (no jsdom dependency for serverless)
function sanitizeHtml(html: string): string {
    // Strip script tags and event handlers
    return html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/\son\w+\s*=\s*(['"])[^'"]*\1/gi, '')
        .replace(/\son\w+\s*=\s*[^\s>]+/gi, '')
        .replace(/javascript\s*:/gi, '');
}

function sanitizeText(text: string): string {
    return text.replace(/<[^>]*>/g, '').trim();
}

const BLOG_MUSEUM_LIST_SELECT = {
    id: true,
    name: true,
    nameKo: true,
    nameEn: true,
    city: true,
    cityKo: true,
    country: true,
    imageUrl: true,
    cachedPhotoUrls: true,
    placePhotos: true,
    latitude: true,
    longitude: true,
};

const BLOG_MUSEUM_FULL_SELECT = {
    ...BLOG_MUSEUM_LIST_SELECT,
    nameTranslations: true,
    cityTranslations: true,
};

const BLOG_LIST_SELECT = {
    id: true,
    title: true,
    titleEn: true,
    author: true,
    previewImage: true,
    status: true,
    category: true,
    views: true,
    createdAt: true,
    museums: {
        include: {
            museum: { select: BLOG_MUSEUM_LIST_SELECT },
        },
    },
    storyArtworks: {
        include: {
            artwork: { select: { image: true } },
        },
        orderBy: { order: 'asc' as const },
        take: 1,
    },
};

const BLOG_FULL_INCLUDE = {
    museums: {
        include: {
            museum: { select: BLOG_MUSEUM_FULL_SELECT },
        },
    },
    storyArtworks: {
        include: {
            artwork: { select: { image: true } },
        },
        orderBy: { order: 'asc' as const },
        take: 1,
    },
};

function stripBlogListPayload(post: any) {
    const result = { ...post };
    if (Array.isArray(result.museums)) {
        result.museums = result.museums.map((item: any) => {
            if (!item?.museum) return item;
            const museum = { ...item.museum };
            delete museum.imageUrl;
            delete museum.cachedPhotoUrls;
            delete museum.placePhotos;
            return { museum };
        });
    }
    return result;
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        let includeDrafts = false;
        if (searchParams.get('includeDrafts') === 'true') {
            try {
                await requireAdmin();
                includeDrafts = true;
            } catch {
                includeDrafts = false;
            }
        }
        const category = searchParams.get('category');
        const listView = !includeDrafts && searchParams.get('view') !== 'full';

        const posts = await (prisma as any).story.findMany({
            where: {
                status: includeDrafts ? { not: 'DELETED' } : 'PUBLISHED',
                ...(category ? { category } : {}),
            },
            orderBy: { createdAt: 'desc' },
            ...(listView ? { select: BLOG_LIST_SELECT } : { include: BLOG_FULL_INCLUDE }),
        });

        let transformed = transformNestedPhotos(posts);
        // 썸네일 기준은 상세 커버 이미지(previewImage) — 없을 때만 연결 박물관 이미지로 대체
        for (const post of transformed) {
            if (post.previewImage) continue;
            const museumImages = (post.museums || [])
                .map((sm: any) => sm.museum?.imageUrl)
                .filter((u: any) => typeof u === 'string' && u.length > 0);
            if (museumImages.length > 0) {
                let hash = 0;
                for (let i = 0; i < post.id.length; i++) hash = (hash * 31 + post.id.charCodeAt(i)) >>> 0;
                post.previewImage = museumImages[hash % museumImages.length];
            }
        }
        if (listView) transformed = transformed.map(stripBlogListPayload);

        return NextResponse.json(
            { data: transformed },
            {
                headers: listView
                    ? { 'Cache-Control': 'public, max-age=300, s-maxage=1800, stale-while-revalidate=86400' }
                    : { 'Cache-Control': 'private, no-store' },
            }
        );
    } catch (err: any) {
        console.error('Fetch blog error:', err);
        return errorResponse('INTERNAL_SERVER_ERROR', 'Failed to fetch blog posts', 500);
    }
}

export async function POST(req: NextRequest) {
    try {
        console.log('Blog POST request received');
        const user = await requireAdmin();
        console.log('User authenticated:', user.id);

        const body = await req.json();
        const { title, content, description, author, previewImage, status, category, museumIds, artworks, artworkIds } = body;
        console.log('Request body:', { title, author, status, museumIds });

        if (!title || !content) {
            return errorResponse('BAD_REQUEST', 'Title and content are required', 400);
        }

        // Server-side sanitization — prevents stored XSS
        const cleanTitle = sanitizeText(title);
        const cleanContent = sanitizeHtml(content);
        const cleanDescription = description ? sanitizeText(description) : null;

        // Automatic Translation
        const titleEn = await translateText(cleanTitle, 'en');
        const contentEn = await translateText(cleanContent, 'en');

        // ── 카테고리 자동 결정 ──────────────────────────────────────
        // TRAVEL + 박물관 1곳 → 박물관 type으로 MUSEUM/ART 재분류
        let finalCategory = category || 'MUSEUM';
        if (finalCategory === 'TRAVEL' && museumIds && museumIds.length === 1) {
            try {
                const museum = await (prisma as any).museum.findUnique({
                    where: { id: museumIds[0] },
                    select: { type: true },
                });
                const mtype = (museum?.type || '').toLowerCase();
                finalCategory = (mtype === 'art' || mtype === 'gallery' || mtype === 'art_gallery' || mtype === 'contemporary')
                    ? 'ART'
                    : 'MUSEUM';
                console.log(`[AutoCategory] TRAVEL+1museum → ${finalCategory} (museum type: ${museum?.type})`);
            } catch (e) {
                console.error('[AutoCategory] museum type lookup failed:', e);
                finalCategory = 'MUSEUM';
            }
        }

        // Try to create the story with museum connections
        const post = await (prisma as any).story.create({
            data: {
                title: cleanTitle,
                titleEn,
                content: cleanContent,
                contentEn,
                description: cleanDescription,
                author: author || user.name || 'Anonymous',
                previewImage,
                status: status || 'DRAFT',
                category: finalCategory,
                artworks: artworks && artworks.length > 0 ? artworks : undefined,
                ...(museumIds && museumIds.length > 0 ? {
                    museums: {
                        create: museumIds.map((mid: string) => ({ museumId: mid }))
                    }
                } : {})
            },
            include: {
                museums: {
                    include: { museum: { select: { id: true, name: true, nameKo: true, nameEn: true, nameTranslations: true, city: true, cityKo: true, cityTranslations: true, country: true } } }
                }
            }
        });

        // Auto-create Artwork records from artworks array
        if (artworks && artworks.length > 0) {
            for (let i = 0; i < artworks.length; i++) {
                const aw = artworks[i];
                if (aw.title || aw.artist) {
                    const artwork = await (prisma as any).artwork.create({
                        data: {
                            title: aw.title || '제목 없음',
                            artist: aw.artist || null,
                            image: aw.image || null,
                            description: aw.description || null,
                            sourceStoryId: post.id,
                            stories: { create: { storyId: post.id, order: i } }
                        }
                    });
                }
            }
        }

        // Link existing artworks by IDs
        if (artworkIds && artworkIds.length > 0) {
            await (prisma as any).storyArtwork.createMany({
                data: artworkIds.map((aid: string, i: number) => ({
                    storyId: post.id,
                    artworkId: aid,
                    order: (artworks?.length || 0) + i
                })),
                skipDuplicates: true
            });
        }

        // ── 자동 컬렉션 생성 (2곳 이상 박물관 태그 시) ───────────────────
        let createdCollectionId: string | null = null;
        if (museumIds && museumIds.length >= 2) {
            try {
                const shareSlug = cleanTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 40)
                    + '-' + Math.random().toString(36).substring(2, 6);
                const collection = await (prisma as any).collection.create({
                    data: {
                        userId: user.id,
                        title: cleanTitle,
                        description: cleanDescription || null,
                        isPublic: true,
                        shareSlug,
                        items: {
                            create: museumIds.map((mid: string, index: number) => ({
                                museumId: mid,
                                order: index,
                            }))
                        }
                    },
                    select: { id: true }
                });
                createdCollectionId = collection.id;
                await (prisma as any).story.update({
                    where: { id: post.id },
                    data: { collectionId: createdCollectionId }
                });
                console.log(`[AutoCollection] Created collection ${createdCollectionId} for story ${post.id} (${museumIds.length} museums)`);
            } catch (e) {
                console.error('[AutoCollection] Failed to create collection:', e);
            }
        }

        console.log('Story created successfully:', post.id);
        return successResponse({ ...post, category: finalCategory, collectionId: createdCollectionId }, 201);
    } catch (err: any) {
        const errorDetail = `[${new Date().toISOString()}] Create blog error: ${err.message}\nStack: ${err.stack}\n`;
        fs.appendFileSync(path.join(process.cwd(), 'blog_error.log'), errorDetail);

        console.error('Create blog error details:', err);
        if (err.message === 'UNAUTHORIZED') return errorResponse('UNAUTHORIZED', 'Admin access required', 401);
        if (err.message === 'FORBIDDEN') return errorResponse('FORBIDDEN', 'Admin access required', 403);

        // Provide more detail in the response for debugging
        return errorResponse('INTERNAL_SERVER_ERROR', `Failed to create blog post: ${err.message || 'Unknown error'}`, 500);
    }
}
