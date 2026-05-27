import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-utils';
import { generateNickname, countryToFlag } from '@/lib/nickname';

function getClientIP(req: NextRequest): string {
    return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        || req.headers.get('x-real-ip')
        || '0.0.0.0';
}

async function getCountryFromIP(ip: string): Promise<string> {
    if (ip === '0.0.0.0' || ip === '127.0.0.1' || ip === '::1') return 'XX';
    try {
        const res = await fetch(`http://ip-api.com/json/${ip}?fields=countryCode`, { signal: AbortSignal.timeout(3000) });
        const data = await res.json();
        return data.countryCode || 'XX';
    } catch {
        return 'XX';
    }
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const museumId = searchParams.get('museumId');

        const where = museumId ? { museumId } : {};
        const reviews = await prisma.review.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: 100,
            include: {
                museum: { select: { name: true } },
            }
        });

        // Generate nicknames + flags for display
        const clientIP = getClientIP(req);
        const enriched = reviews.map(r => ({
            ...r,
            nickname: generateNickname(r.ipAddress || 'anonymous'),
            flag: countryToFlag(r.country || 'XX'),
            isOwn: r.ipAddress === clientIP,
        }));

        return successResponse(enriched);
    } catch (err: any) {
        return errorResponse('INTERNAL_SERVER_ERROR', 'Failed to fetch reviews', 500);
    }
}

export async function POST(req: NextRequest) {
    try {
        const user = await requireAuth();
        const { museumId, content, photos } = await req.json();

        if (!museumId || !content) {
            return errorResponse('BAD_REQUEST', 'museumId and content are required', 400);
        }

        const lines = content.split(/\r\n|\r|\n/);
        if (lines.length > 3) {
            return errorResponse('VALIDATION_ERROR', 'Review content must not exceed 3 lines.', 400);
        }
        for (const line of lines) {
            if (line.length > 120) {
                return errorResponse('VALIDATION_ERROR', 'Each line must not exceed 120 characters.', 400);
            }
        }
        if (photos && Array.isArray(photos) && photos.length > 3) {
            return errorResponse('VALIDATION_ERROR', 'Maximum 3 photos allowed.', 400);
        }

        const clientIP = getClientIP(req);
        const country = await getCountryFromIP(clientIP);

        const review = await prisma.review.create({
            data: {
                userId: user.id,
                museumId,
                content,
                photos: photos || [],
                ipAddress: clientIP,
                country,
            }
        });

        return successResponse(review, 201);
    } catch (err: any) {
        if (err.message === 'UNAUTHORIZED') return errorResponse('UNAUTHORIZED', 'Auth required', 401);
        console.error('API Error /reviews:', err);
        return errorResponse('INTERNAL_SERVER_ERROR', 'Failed to create review', 500);
    }
}
