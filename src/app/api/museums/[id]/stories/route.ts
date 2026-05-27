import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;

        const stories = await (prisma as any).storyMuseum.findMany({
            where: { museumId: id },
            include: {
                story: {
                    select: {
                        id: true,
                        title: true,
                        titleEn: true,
                        previewImage: true,
                        author: true,
                        status: true,
                        createdAt: true,
                        views: true,
                    }
                }
            }
        });

        const published = stories
            .map((sm: any) => sm.story)
            .filter((s: any) => s && s.status === 'PUBLISHED');

        return NextResponse.json({ data: published });
    } catch (err: any) {
        console.error('Fetch museum stories error:', err);
        return NextResponse.json({ data: [] });
    }
}
