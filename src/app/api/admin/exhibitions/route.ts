import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session || (session.user as any).role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const stats = await prisma.museum.findMany({
            select: {
                id: true,
                name: true,
                lastExhibitionSync: true,
                _count: {
                    select: { exhibitions: true }
                }
            },
            orderBy: { lastExhibitionSync: 'desc' },
            take: 50
        });

        return NextResponse.json({ data: stats });
    } catch (error) {
        console.error('Exhibition Admin API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || (session.user as any).role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const museumId = searchParams.get('museumId');

        if (museumId) {
            await prisma.$transaction([
                prisma.exhibition.deleteMany({ where: { museumId, source: 'SERPER' } }),
                prisma.museum.update({
                    where: { id: museumId },
                    data: { lastExhibitionSync: null }
                })
            ]);
        } else {
            // Clear all caches
            await prisma.$transaction([
                prisma.exhibition.deleteMany({ where: { source: 'SERPER' } }),
                prisma.museum.updateMany({
                    data: { lastExhibitionSync: null }
                })
            ]);
        }

        return NextResponse.json({ message: 'Success' });
    } catch (error) {
        console.error('Exhibition Admin Delete Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
