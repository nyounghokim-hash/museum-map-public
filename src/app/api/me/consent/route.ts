import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/me/consent — get current user's consent status
export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { marketingConsent: true, locationConsent: true }
    });
    if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json(user);
}

// PATCH /api/me/consent — update consent toggles
export async function PATCH(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const update: any = {};
    if (typeof body.marketingConsent === 'boolean') update.marketingConsent = body.marketingConsent;
    if (typeof body.locationConsent === 'boolean') update.locationConsent = body.locationConsent;

    if (Object.keys(update).length === 0) {
        return NextResponse.json({ error: 'No valid fields' }, { status: 400 });
    }

    const user = await prisma.user.update({
        where: { email: session.user.email },
        data: update,
        select: { marketingConsent: true, locationConsent: true }
    });

    return NextResponse.json(user);
}
