import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Get Reviews/Rating for a museum
 * Uses DB-stored googleRating/googleRatingsTotal (synced via sync_places.js every 30 days)
 * No real-time Google API calls — cost: $0
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;

        // Fetch from DB — use include for reviews relation
        const museum = await prisma.museum.findUnique({
            where: { id },
            include: {
                reviews: {
                    orderBy: { createdAt: 'desc' },
                    take: 5,
                    include: { user: true }
                }
            }
        }) as any;

        if (!museum) {
            return NextResponse.json({ data: null });
        }

        return NextResponse.json({
            data: {
                rating: museum.googleRating ?? null,
                totalRatings: museum.googleRatingsTotal ?? null,
                reviews: (museum.reviews || []).map((r: any) => ({
                    author_name: r.user?.name || 'User',
                    profile_photo_url: r.user?.image || null,
                    rating: null,
                    text: r.content,
                    time: Math.floor(new Date(r.createdAt).getTime() / 1000),
                    relative_time_description: getRelativeTime(r.createdAt),
                }))
            }
        });

    } catch (error: any) {
        console.error('Reviews Error:', error);
        return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 });
    }
}

function getRelativeTime(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days < 1) return '오늘';
    if (days < 7) return `${days}일 전`;
    if (days < 30) return `${Math.floor(days / 7)}주 전`;
    if (days < 365) return `${Math.floor(days / 30)}개월 전`;
    return `${Math.floor(days / 365)}년 전`;
}
