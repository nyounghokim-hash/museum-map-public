import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
// requireAuth is not used so users can anonymously suggest updates
import { successResponse, errorResponse } from '@/lib/api-utils';
import { getSessionUser } from '@/lib/auth';
import { spamLimiter, getClientIp } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
    try {
        // Rate limit: 5 req/min per IP for anonymous endpoint
        const ip = getClientIp(req);
        const { success } = spamLimiter.check(ip);
        if (!success) {
            return errorResponse('TOO_MANY_REQUESTS', 'Too many requests. Please try again later.', 429);
        }

        // attempt optional fast login
        const user = await getSessionUser().catch(() => null);
        const { museumId, data } = await req.json();

        if (!data || typeof data !== 'object') {
            return errorResponse('BAD_REQUEST', 'data payload required', 400);
        }

        // Input size limit: prevent massive payloads
        const dataStr = JSON.stringify(data);
        if (dataStr.length > 10000) {
            return errorResponse('BAD_REQUEST', 'data payload too large (max 10KB)', 400);
        }

        const suggestion = await prisma.suggestion.create({
            data: {
                userId: user?.id || null, // Allows anonymous
                museumId: museumId || null, // Null indicates a suggestion for a totally new unseen museum
                data: data
            }
        });

        return successResponse(suggestion, 201);
    } catch (err: any) {
        return errorResponse('INTERNAL_SERVER_ERROR', 'Failed to submit suggestion', 500);
    }
}
