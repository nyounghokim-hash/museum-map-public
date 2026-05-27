import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Auth required' }, { status: 401 });
    }

    // Check if admin (virtual admin from env)
    const isAdmin = session.user.email === 'admin' || (session.user as any).role === 'ADMIN';
    if (!isAdmin) {
        return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    try {
        const { title, message, link, targetUserId, marketingOnly } = await req.json();

        if (targetUserId) {
            // Send to specific user
            await (prisma.notification as any).create({
                data: {
                    userId: targetUserId,
                    type: 'ADMIN_PUSH',
                    title,
                    message,
                    link
                }
            });
            return NextResponse.json({ success: true, sent: 1 });
        }

        if (marketingOnly) {
            // Send only to marketing-consented users
            const users = await prisma.user.findMany({
                where: { marketingConsent: true },
                select: { id: true },
            });

            if (users.length === 0) {
                return NextResponse.json({ success: true, sent: 0, note: '마케팅 동의 사용자 없음' });
            }

            // Batch create individual notifications
            await (prisma.notification as any).createMany({
                data: users.map((u: { id: string }) => ({
                    userId: u.id,
                    type: 'ADMIN_PUSH',
                    title,
                    message,
                    link,
                })),
            });

            return NextResponse.json({ success: true, sent: users.length });
        }

        // Broadcast to all (including guests) — single row with userId=null
        await (prisma.notification as any).create({
            data: {
                type: 'ADMIN_PUSH',
                title,
                message,
                link
            }
        });

        return NextResponse.json({ success: true, sent: 'all' });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
