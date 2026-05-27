import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-utils';
import { translateText } from '@/lib/translate';
import { transformNestedPhotos } from '@/lib/photo-proxy';

function sanitizeHtml(html: string): string {
    return html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/\son\w+\s*=\s*(['"])[^'"]*\1/gi, '')
        .replace(/\son\w+\s*=\s*[^\s>]+/gi, '')
        .replace(/javascript\s*:/gi, '');
}

function sanitizeText(text: string): string {
    return text.replace(/<[^>]*>/g, '').trim();
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const post = await (prisma as any).story.findUnique({
            where: { id },
            include: {
                museums: {
                    include: {
                        museum: { select: { id: true, name: true, nameKo: true, nameEn: true, nameTranslations: true, city: true, cityKo: true, cityTranslations: true, country: true, imageUrl: true, cachedPhotoUrls: true, placePhotos: true, latitude: true, longitude: true } }
                    }
                },
                storyArtworks: {
                    include: {
                        artwork: true
                    },
                    orderBy: { order: 'asc' }
                }
            }
        });

        if (!post) {
            return errorResponse('NOT_FOUND', 'Blog post not found', 404);
        }

        // Increment views
        await (prisma as any).story.update({
            where: { id },
            data: { views: { increment: 1 } }
        });

        return successResponse(transformNestedPhotos(post));
    } catch (err: any) {
        console.error('Fetch single blog error:', err);
        return errorResponse('INTERNAL_SERVER_ERROR', 'Failed to fetch blog post', 500);
    }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const user = await requireAdmin();
        const body = await req.json();
        const { museumIds, artworks, artworkIds, ...updateData } = body;

        if (updateData.title) {
            updateData.title = sanitizeText(updateData.title);
            updateData.titleEn = await translateText(updateData.title, 'en');
        }
        if (updateData.content) {
            updateData.content = sanitizeHtml(updateData.content);
            updateData.contentEn = await translateText(updateData.content, 'en');
        }
        if (updateData.description) {
            updateData.description = sanitizeText(updateData.description);
        }

        // Update museum connections if provided
        if (museumIds !== undefined) {
            // Delete existing connections and recreate
            await (prisma as any).storyMuseum.deleteMany({ where: { storyId: id } });
            if (museumIds.length > 0) {
                await (prisma as any).storyMuseum.createMany({
                    data: museumIds.map((mid: string) => ({ storyId: id, museumId: mid }))
                });
            }
        }

        // ── TRAVEL + 1곳: 카테고리 자동 재분류 ────────────────────
        const effectiveMuseumIds = museumIds ?? [];
        const effectiveCategory: string = updateData.category || '';
        if (effectiveCategory === 'TRAVEL' && effectiveMuseumIds.length === 1) {
            try {
                const museum = await (prisma as any).museum.findUnique({
                    where: { id: effectiveMuseumIds[0] },
                    select: { type: true },
                });
                const mtype = (museum?.type || '').toLowerCase();
                updateData.category = (mtype === 'art' || mtype === 'gallery' || mtype === 'art_gallery' || mtype === 'contemporary')
                    ? 'ART'
                    : 'MUSEUM';
                console.log(`[AutoCategory PUT] TRAVEL+1museum → ${updateData.category}`);
            } catch (e) {
                console.error('[AutoCategory PUT] lookup failed:', e);
                updateData.category = 'MUSEUM';
            }
        }

        const post = await (prisma as any).story.update({
            where: { id },
            data: updateData,
            include: {
                museums: {
                    include: { museum: { select: { id: true, name: true, nameKo: true, nameEn: true, nameTranslations: true, city: true, cityKo: true, cityTranslations: true, country: true } } }
                },
                storyArtworks: {
                    include: { artwork: true },
                    orderBy: { order: 'asc' }
                }
            }
        });

        // Auto-create Artwork records from new artworks array
        if (artworks && artworks.length > 0) {
            for (let i = 0; i < artworks.length; i++) {
                const aw = artworks[i];
                if (aw.title || aw.artist) {
                    await (prisma as any).artwork.create({
                        data: {
                            title: aw.title || '제목 없음',
                            artist: aw.artist || null,
                            image: aw.image || null,
                            description: aw.description || null,
                            sourceStoryId: id,
                            stories: { create: { storyId: id, order: i } }
                        }
                    });
                }
            }
        }

        // Link existing artworks by IDs  
        if (artworkIds !== undefined) {
            // Remove existing links not in new list
            await (prisma as any).storyArtwork.deleteMany({
                where: { storyId: id, artworkId: { notIn: artworkIds } }
            });
            // Add new links
            if (artworkIds.length > 0) {
                for (let i = 0; i < artworkIds.length; i++) {
                    await (prisma as any).storyArtwork.upsert({
                        where: { storyId_artworkId: { storyId: id, artworkId: artworkIds[i] } },
                        create: { storyId: id, artworkId: artworkIds[i], order: i },
                        update: { order: i }
                    });
                }
            }
        }

        // ── 자동 컬렉션 생성/업데이트/삭제 (2곳 이상 박물관 태그 시) ───
        const finalMuseumIds = museumIds ?? [];
        const existingCollectionId = post.collectionId;

        if (finalMuseumIds.length >= 2) {
            try {
                if (existingCollectionId) {
                    // 기존 컬렉션 아이템 갱신
                    await (prisma as any).collectionItem.deleteMany({ where: { collectionId: existingCollectionId } });
                    await (prisma as any).collectionItem.createMany({
                        data: finalMuseumIds.map((mid: string, index: number) => ({
                            collectionId: existingCollectionId,
                            museumId: mid,
                            order: index,
                        }))
                    });
                    console.log(`[AutoCollection PUT] Updated collection ${existingCollectionId} items`);
                } else {
                    // 새 컬렉션 생성
                    const storyTitle = updateData.title || post.title;
                    const shareSlug = storyTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 40)
                        + '-' + Math.random().toString(36).substring(2, 6);
                    const collection = await (prisma as any).collection.create({
                        data: {
                            userId: user.id,
                            title: storyTitle,
                            description: null,
                            isPublic: true,
                            shareSlug,
                            items: {
                                create: finalMuseumIds.map((mid: string, index: number) => ({
                                    museumId: mid,
                                    order: index,
                                }))
                            }
                        },
                        select: { id: true }
                    });
                    await (prisma as any).story.update({
                        where: { id },
                        data: { collectionId: collection.id }
                    });
                    console.log(`[AutoCollection PUT] Created collection ${collection.id} for story ${id}`);
                }
            } catch (e) {
                console.error('[AutoCollection PUT] Failed:', e);
            }
        } else if (finalMuseumIds.length < 2 && existingCollectionId) {
            // 박물관 1개 이하로 줄면 기존 컬렉션 연결 해제
            try {
                await (prisma as any).story.update({
                    where: { id },
                    data: { collectionId: null }
                });
                console.log(`[AutoCollection PUT] Unlinked collection from story ${id}`);
            } catch (e) {
                console.error('[AutoCollection PUT] Unlink failed:', e);
            }
        }

        // Invalidate translation cache for this story
        try {
            await (prisma as any).translationCache.deleteMany({
                where: { entityType: 'story', entityId: id },
            });
        } catch (e) { console.error('[TranslationCache] Invalidation error:', e); }

        return successResponse(post);
    } catch (err: any) {
        if (err.message === 'UNAUTHORIZED') return errorResponse('UNAUTHORIZED', 'Admin access required', 401);
        if (err.message === 'FORBIDDEN') return errorResponse('FORBIDDEN', 'Admin access required', 403);
        console.error('Update blog error:', err);
        return errorResponse('INTERNAL_SERVER_ERROR', 'Failed to update blog post', 500);
    }

}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        await requireAdmin();

        // Soft delete by setting status to DELETED
        const post = await (prisma as any).story.update({
            where: { id },
            data: { status: 'DELETED' }
        });

        return successResponse({ message: 'Post marked as deleted', post });
    } catch (err: any) {
        if (err.message === 'UNAUTHORIZED') return errorResponse('UNAUTHORIZED', 'Admin access required', 401);
        if (err.message === 'FORBIDDEN') return errorResponse('FORBIDDEN', 'Admin access required', 403);
        console.error('Delete blog error:', err);
        return errorResponse('INTERNAL_SERVER_ERROR', 'Failed to delete blog post', 500);
    }
}
