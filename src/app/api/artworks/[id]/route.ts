import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const resolvedParams = await params;
        const artwork = await (prisma as any).artwork.findUnique({
            where: { id: resolvedParams.id },
            include: {
                museum: {
                    select: {
                        id: true,
                        name: true,
                        nameKo: true,
                        nameEn: true,
                        nameTranslations: true,
                        city: true,
                        cityKo: true,
                        cityTranslations: true,
                        country: true,
                        imageUrl: true,
                        type: true,
                    }
                },
                stories: {
                    include: {
                        story: {
                            select: {
                                id: true,
                                title: true,
                                titleEn: true,
                                previewImage: true,
                                description: true,
                                status: true,
                            }
                        }
                    }
                }
            }
        });

        if (!artwork) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        // Build museums array (from direct relation)
        const museums: any[] = [];
        if (artwork.museum) {
            museums.push(artwork.museum);
        }

        // Build related stories
        const relatedStories: any[] = [];
        for (const sa of artwork.stories || []) {
            if (sa.story && sa.story.status === 'PUBLISHED') {
                relatedStories.push({
                    id: sa.story.id,
                    title: sa.story.title,
                    titleEn: sa.story.titleEn,
                    previewImage: sa.story.previewImage,
                    description: sa.story.description,
                });
            }
        }

        const result = {
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
            createdAt: artwork.createdAt,
            museums,
            relatedStories,
        };

        return NextResponse.json({ data: result });
    } catch (err: any) {
        console.error('Fetch artwork detail error:', err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
