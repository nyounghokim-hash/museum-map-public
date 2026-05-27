import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/lib/api-utils';

export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const limit = parseInt(url.searchParams.get('limit') || '100');
        const offset = parseInt(url.searchParams.get('offset') || '0');

        const exhibitions = await prisma.exhibition.findMany({
            where: { imageUrl: { not: null } },
            include: { museum: { select: { id: true, name: true, city: true, country: true, type: true } } },
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip: offset,
        });

        const total = await prisma.exhibition.count({ where: { imageUrl: { not: null } } });

        return successResponse({ exhibitions, total });
    } catch {
        return errorResponse('INTERNAL_SERVER_ERROR', 'Failed to fetch exhibitions', 500);
    }
}
