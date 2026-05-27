import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-utils';

/**
 * GET /api/admin/token-usage
 * Returns AI token usage statistics.
 * Query params:
 *   - days: number of days to look back (default: 30)
 *   - feature: filter by feature (translate, recommend, etc.)
 */
export async function GET(req: NextRequest) {
    try {
        await requireAdmin();
        const { searchParams } = new URL(req.url);
        const days = Math.min(Math.max(parseInt(searchParams.get('days') || '30', 10) || 30, 1), 365);
        const feature = searchParams.get('feature');

        const since = new Date();
        since.setDate(since.getDate() - days);

        const where: any = { createdAt: { gte: since } };
        if (feature) where.feature = feature;

        // Aggregate totals
        const agg = await (prisma as any).tokenUsage.aggregate({
            where,
            _sum: {
                promptTokens: true,
                completionTokens: true,
                totalTokens: true,
            },
            _count: true,
        });

        // Group by feature
        const byFeature = await (prisma as any).tokenUsage.groupBy({
            by: ['feature'],
            where,
            _sum: {
                promptTokens: true,
                completionTokens: true,
                totalTokens: true,
            },
            _count: true,
        });

        // Group by day (last N days)
        const dailyRaw = await (prisma as any).$queryRaw`
            SELECT 
                DATE("createdAt") as date,
                SUM("totalTokens")::int as tokens,
                COUNT(*)::int as requests
            FROM "TokenUsage"
            WHERE "createdAt" >= ${since}
            ${feature ? (prisma as any).$queryRaw`AND "feature" = ${feature}` : (prisma as any).$queryRaw``}
            GROUP BY DATE("createdAt")
            ORDER BY date DESC
            LIMIT ${days}
        `;

        // Group by locale
        const byLocale = await (prisma as any).tokenUsage.groupBy({
            by: ['locale'],
            where,
            _sum: { totalTokens: true },
            _count: true,
        });

        return successResponse({
            period: { days, since: since.toISOString() },
            totals: {
                requests: agg._count || 0,
                promptTokens: agg._sum?.promptTokens || 0,
                completionTokens: agg._sum?.completionTokens || 0,
                totalTokens: agg._sum?.totalTokens || 0,
            },
            byFeature: byFeature.map((f: any) => ({
                feature: f.feature,
                requests: f._count,
                promptTokens: f._sum?.promptTokens || 0,
                completionTokens: f._sum?.completionTokens || 0,
                totalTokens: f._sum?.totalTokens || 0,
            })),
            byLocale: byLocale.map((l: any) => ({
                locale: l.locale || 'unknown',
                requests: l._count,
                totalTokens: l._sum?.totalTokens || 0,
            })),
        });
    } catch (err: any) {
        if (err.message === 'UNAUTHORIZED') return errorResponse('UNAUTHORIZED', 'Admin access required', 401);
        if (err.message === 'FORBIDDEN') return errorResponse('FORBIDDEN', 'Admin access required', 403);
        console.error('[TokenUsage API] Error:', err);
        return errorResponse('INTERNAL_SERVER_ERROR', 'Failed to fetch token usage', 500);
    }
}
