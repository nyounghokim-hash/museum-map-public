import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-utils';

export async function GET(req: NextRequest) {
    try {
        await requireAdmin();
        const { searchParams } = new URL(req.url);
        const query = searchParams.get('query') || '';
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');

        const where = query
            ? {
                OR: [
                    { title: { contains: query, mode: 'insensitive' as const } },
                    { titleKo: { contains: query, mode: 'insensitive' as const } },
                    { artist: { contains: query, mode: 'insensitive' as const } },
                    { artistKo: { contains: query, mode: 'insensitive' as const } },
                ],
            }
            : {};

        const [artworks, total] = await Promise.all([
            (prisma as any).artwork.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
                include: {
                    museum: { select: { id: true, name: true, nameKo: true } },
                    stories: {
                        include: {
                            story: {
                                include: {
                                    museums: {
                                        include: {
                                            museum: true
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }),
            (prisma as any).artwork.count({ where }),
        ]);

        return successResponse({ data: artworks, total });
    } catch (err: any) {
        if (err.message === 'UNAUTHORIZED') return errorResponse('UNAUTHORIZED', 'Admin access required', 401);
        if (err.message === 'FORBIDDEN') return errorResponse('FORBIDDEN', 'Admin access required', 403);
        console.error('Fetch artworks error:', err);
        return errorResponse('INTERNAL_SERVER_ERROR', 'Failed to fetch artworks', 500);
    }
}

export async function POST(req: NextRequest) {
    try {
        await requireAdmin();
        const body = await req.json();
        const { title, titleKo, artist, artistKo, image, description, descriptionKo, year, storyIds, museumId } = body;

        if (!title) {
            return errorResponse('BAD_REQUEST', 'Title is required', 400);
        }

        // Duplicate check: same title + artist
        const existing = await (prisma as any).artwork.findFirst({
            where: {
                title: { equals: title, mode: 'insensitive' },
                ...(artist ? { artist: { equals: artist, mode: 'insensitive' } } : {})
            }
        });
        if (existing) {
            return errorResponse('CONFLICT', `이미 동일한 작품이 등록되어 있습니다: "${existing.title}" by ${existing.artist || 'Unknown'}`, 409);
        }

        const artwork = await (prisma as any).artwork.create({
            data: {
                title,
                titleKo: titleKo || null,
                artist: artist || null,
                artistKo: artistKo || null,
                image: image || null,
                description: description || null,
                descriptionKo: descriptionKo || null,
                year: year || null,
                ...(museumId ? { museum: { connect: { id: museumId } } } : {}),
                ...(storyIds && storyIds.length > 0 ? {
                    stories: {
                        create: storyIds.map((sid: string, i: number) => ({ storyId: sid, order: i }))
                    }
                } : {})
            },
            include: {
                stories: {
                    include: {
                        story: { select: { id: true, title: true } }
                    }
                }
            }
        });

        return successResponse(artwork, 201);
    } catch (err: any) {
        if (err.message === 'UNAUTHORIZED') return errorResponse('UNAUTHORIZED', 'Admin access required', 401);
        if (err.message === 'FORBIDDEN') return errorResponse('FORBIDDEN', 'Admin access required', 403);
        console.error('Create artwork error:', err);
        return errorResponse('INTERNAL_SERVER_ERROR', 'Failed to create artwork', 500);
    }
}

export async function PUT(req: NextRequest) {
    try {
        await requireAdmin();
        const body = await req.json();
        const { id, title, titleKo, artist, artistKo, image, description, descriptionKo, year, storyIds, museumId } = body;

        if (!id) {
            return errorResponse('BAD_REQUEST', 'ID is required', 400);
        }

        // Update story connections if provided
        if (storyIds !== undefined) {
            await (prisma as any).storyArtwork.deleteMany({ where: { artworkId: id } });
            if (storyIds.length > 0) {
                await (prisma as any).storyArtwork.createMany({
                    data: storyIds.map((sid: string, i: number) => ({ storyId: sid, artworkId: id, order: i }))
                });
            }
        }

        const artwork = await (prisma as any).artwork.update({
            where: { id },
            data: {
                ...(title !== undefined && { title }),
                ...(titleKo !== undefined && { titleKo: titleKo || null }),
                ...(artist !== undefined && { artist: artist || null }),
                ...(artistKo !== undefined && { artistKo: artistKo || null }),
                ...(image !== undefined && { image: image || null }),
                ...(description !== undefined && { description: description || null }),
                ...(descriptionKo !== undefined && { descriptionKo: descriptionKo || null }),
                ...(year !== undefined && { year: year || null }),
                ...(museumId !== undefined && { museumId: museumId || null }),
            },
            include: {
                stories: {
                    include: {
                        story: { select: { id: true, title: true } }
                    }
                }
            }
        });

        return successResponse(artwork);
    } catch (err: any) {
        if (err.message === 'UNAUTHORIZED') return errorResponse('UNAUTHORIZED', 'Admin access required', 401);
        if (err.message === 'FORBIDDEN') return errorResponse('FORBIDDEN', 'Admin access required', 403);
        console.error('Update artwork error:', err);
        return errorResponse('INTERNAL_SERVER_ERROR', 'Failed to update artwork', 500);
    }
}

export async function DELETE(req: NextRequest) {
    try {
        await requireAdmin();
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) {
            return errorResponse('BAD_REQUEST', 'ID is required', 400);
        }

        await (prisma as any).artwork.delete({ where: { id } });
        return successResponse({ message: 'Artwork deleted' });
    } catch (err: any) {
        if (err.message === 'UNAUTHORIZED') return errorResponse('UNAUTHORIZED', 'Admin access required', 401);
        if (err.message === 'FORBIDDEN') return errorResponse('FORBIDDEN', 'Admin access required', 403);
        console.error('Delete artwork error:', err);
        return errorResponse('INTERNAL_SERVER_ERROR', 'Failed to delete artwork', 500);
    }
}
