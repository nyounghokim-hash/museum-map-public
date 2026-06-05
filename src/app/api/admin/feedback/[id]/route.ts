import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || (session.user as any).role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const resolvedParams = await params;
        const { reply } = await req.json();

        if (!reply || typeof reply !== 'string') {
            return NextResponse.json({ error: 'Reply text is required' }, { status: 400 });
        }

        const updated = await (prisma.feedback as any).update({
            where: { id: resolvedParams.id },
            data: { reply },
            include: { user: { select: { id: true, username: true } } }
        });

        // Send notification to the feedback author
        if (updated.userId) {
            await (prisma as any).notification.create({
                data: {
                    userId: updated.userId,
                    type: 'feedback_reply',
                    title: '💬 피드백에 답변이 도착했습니다',
                    titleEn: '💬 Your feedback got a reply',
                    message: reply.length > 80 ? reply.substring(0, 80) + '...' : reply,
                    messageEn: reply.length > 80 ? reply.substring(0, 80) + '...' : reply,
                    link: '/feedback',
                }
            });
        }

        return NextResponse.json({ data: updated });
    } catch (error: any) {
        console.error('Feedback reply error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
