import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/lib/api-utils';

const ADMIN_PW = process.env.ADMIN_PASSWORD || '';

function getClientIP(req: NextRequest): string {
    return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        || req.headers.get('x-real-ip')
        || '0.0.0.0';
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const clientIP = getClientIP(req);

        // Check admin password in header (env var)
        const adminPass = req.headers.get('x-admin-password');
        const isAdmin = !!adminPass && adminPass === ADMIN_PW;

        const review = await prisma.review.findUnique({ where: { id } });
        if (!review) {
            return errorResponse('NOT_FOUND', 'Review not found', 404);
        }

        // Allow delete if admin OR same IP
        if (!isAdmin && review.ipAddress !== clientIP) {
            return errorResponse('FORBIDDEN', 'You can only delete your own reviews', 403);
        }

        await prisma.review.delete({ where: { id } });
        return successResponse({ deleted: true });
    } catch (err: any) {
        return errorResponse('INTERNAL_SERVER_ERROR', 'Failed to delete review', 500);
    }
}
