import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const resolvedParams = await params;
    const notification = await prisma.notification.findUnique({
        where: { id: resolvedParams.id },
        include: { user: true }
    });

    if (!notification) {
        return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }

    // Broadcast notifications (userId=null) can be marked as read by anyone
    if (notification.userId !== null) {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Auth required' }, { status: 401 });
        }
        if (notification.user && notification.user.email !== session.user.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }
    }

    await prisma.notification.update({
        where: { id: resolvedParams.id },
        data: { isRead: true }
    });

    return NextResponse.json({ success: true });
}
