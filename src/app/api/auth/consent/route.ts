import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const TERMS_VERSION = '2026-03-04';

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // @ts-ignore
        const userId = session.user.id;
        if (!userId) {
            return NextResponse.json({ error: 'User ID not found' }, { status: 400 });
        }

        const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
        const userAgent = req.headers.get('user-agent') || 'unknown';
        const now = new Date();

        // Create consent records
        await prisma.$transaction([
            // Terms consent
            prisma.userConsent.create({
                data: {
                    userId,
                    consentType: 'terms',
                    version: TERMS_VERSION,
                    ipAddress: ip,
                    userAgent,
                }
            }),
            // Privacy consent
            prisma.userConsent.create({
                data: {
                    userId,
                    consentType: 'privacy',
                    version: TERMS_VERSION,
                    ipAddress: ip,
                    userAgent,
                }
            }),
            // Update user timestamps
            prisma.user.update({
                where: { id: userId },
                data: {
                    termsAgreedAt: now,
                    privacyAgreedAt: now,
                    lastIp: ip,
                    lastLoginAt: now,
                    lastLoginBrowser: userAgent.slice(0, 500),
                }
            }),
        ]);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Consent recording error:', error);
        return NextResponse.json({ error: 'Failed to record consent' }, { status: 500 });
    }
}
