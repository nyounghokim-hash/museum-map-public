import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
    const session = await getServerSession(authOptions);

    // Build query: get broadcast notifications (userId=null) + user-specific if logged in
    const conditions: any[] = [{ userId: null }]; // Broadcast notifications
    let marketingConsent = false;
    let notificationsEnabled = true;

    if (session?.user?.email) {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: { id: true, marketingConsent: true, preferences: true }
        });
        if (user) {
            conditions.push({ userId: user.id });
            marketingConsent = user.marketingConsent;
            const preferences = (user.preferences as Record<string, any>) || {};
            notificationsEnabled = preferences.notificationsEnabled !== false;
        }
    }

    if (!notificationsEnabled) {
        return NextResponse.json([]);
    }

    const notifications = await prisma.notification.findMany({
        where: { OR: conditions },
        orderBy: { createdAt: 'desc' },
        take: 20
    });

    // Filter: hide marketing notifications for users who didn't consent
    const filtered = marketingConsent
        ? notifications
        : notifications.filter(n => n.type !== 'marketing');

    return NextResponse.json(filtered);
}
