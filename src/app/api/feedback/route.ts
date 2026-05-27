import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser, authOptions } from '@/lib/auth';
import { getServerSession } from 'next-auth';

const ADMIN_PW = process.env.ADMIN_PASSWORD || '';

function getAdminPw(req: Request): string | null {
    return req.headers.get('x-admin-password');
}

async function isAdmin(req: Request): Promise<boolean> {
    const pw = getAdminPw(req);
    if (pw && pw === ADMIN_PW) return true;
    const session = await getServerSession(authOptions);
    if (session && (session.user as any).role === 'ADMIN') return true;
    return false;
}

export async function POST(req: Request) {
    try {
        const session = await getSessionUser();
        const body = await req.json();
        const { content, type, category, targetId, targetName } = body;

        if (!content || typeof content !== 'string' || content.trim().length === 0) {
            return NextResponse.json({ error: 'Feedback content is required' }, { status: 400 });
        }
        if (content.length > 5000) {
            return NextResponse.json({ error: 'Feedback content too long (max 5000 chars)' }, { status: 400 });
        }

        const feedback = await prisma.feedback.create({
            data: {
                content: content.trim(),
                type: type || 'general',
                category: category || null,
                targetId: targetId || null,
                targetName: targetName || null,
                userId: session?.id || null,
            },
        });

        return NextResponse.json(feedback, { status: 201 });
    } catch (error) {
        console.error('Error creating feedback:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function GET(req: Request) {
    try {
        if (!(await isAdmin(req))) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const url = new URL(req.url);
        const typeFilter = url.searchParams.get('type');
        const where = typeFilter ? { type: typeFilter } : {};

        const feedbacks = await prisma.feedback.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: { user: { select: { name: true, email: true } } }
        });

        return NextResponse.json(feedbacks);
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PATCH(req: Request) {
    try {
        const body = await req.json();
        const { id, reply } = body;
        if (!(await isAdmin(req))) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (!id) {
            return NextResponse.json({ error: 'Feedback ID is required' }, { status: 400 });
        }
        const updated = await prisma.feedback.update({
            where: { id },
            data: { reply: reply || null },
        });
        return NextResponse.json(updated);
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        if (!(await isAdmin(req))) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const url = new URL(req.url);
        const id = url.searchParams.get('id');
        if (!id) {
            return NextResponse.json({ error: 'Feedback ID is required' }, { status: 400 });
        }
        await prisma.feedback.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
