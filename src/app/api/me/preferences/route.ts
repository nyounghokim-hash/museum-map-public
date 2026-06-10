import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const userId = (session.user as any).id;
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { preferences: true, marketingConsent: true },
        });

        return NextResponse.json({
            preferences: (user?.preferences as Record<string, any>) || {},
            marketingConsent: Boolean(user?.marketingConsent),
        });
    } catch (error) {
        console.error('Failed to read preferences:', error);
        return NextResponse.json({ error: 'Failed to read preferences' }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await req.json();
        const userId = (session.user as any).id;

        // Get existing preferences
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { preferences: true } });
        const existing = (user?.preferences as Record<string, any>) || {};

        const { marketingConsent, ...preferencePatch } = body || {};
        const updated = { ...existing, ...preferencePatch };

        await prisma.user.upsert({
            where: { id: userId },
            update: {
                preferences: updated,
                ...(typeof marketingConsent === 'boolean' ? { marketingConsent } : {}),
            },
            create: {
                id: userId,
                name: session.user.name || 'guest',
                preferences: updated,
                ...(typeof marketingConsent === 'boolean' ? { marketingConsent } : {}),
            }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to update preferences:', error);
        return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
    }
}
