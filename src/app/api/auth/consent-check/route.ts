import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        console.log('[consent-check] session email:', session?.user?.email);
        if (!session?.user?.email) {
            return NextResponse.json({ needsConsent: false });
        }

        const user = await prisma.user.findFirst({
            where: { email: session.user.email },
            select: { termsAgreedAt: true, role: true }
        });

        console.log('[consent-check] user found:', !!user, 'termsAgreedAt:', user?.termsAgreedAt, 'role:', (user as any)?.role);

        if (!user) {
            return NextResponse.json({ needsConsent: false });
        }

        // Admin users don't need consent check
        if ((user as any).role === 'ADMIN') {
            return NextResponse.json({ needsConsent: false });
        }

        return NextResponse.json({ needsConsent: !user.termsAgreedAt });
    } catch (error) {
        console.error('Consent check error:', error);
        return NextResponse.json({ needsConsent: false });
    }
}
