import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
    try {
        const user = await requireAuth();
        if ((user as any).role !== 'ADMIN') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Use KST (UTC+9) for date boundaries
        const now = new Date();
        const kstOffset = 9 * 60 * 60 * 1000;
        const kstNow = new Date(now.getTime() + kstOffset);
        const today = new Date(Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate()) - kstOffset);
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

        // ── 1. Real token usage from TokenUsage table ──
        let tokenData = { today: { requests: 0, tokens: 0 }, week: { requests: 0, tokens: 0 }, month: { requests: 0, tokens: 0 }, total: { requests: 0, tokens: 0 } };
        let dailyBreakdown: any[] = [];
        let recentTokenLogs: any[] = [];

        try {
            const [todayAgg, weekAgg, monthAgg, totalAgg] = await Promise.all([
                (prisma as any).tokenUsage.aggregate({ where: { createdAt: { gte: today } }, _sum: { totalTokens: true }, _count: true }),
                (prisma as any).tokenUsage.aggregate({ where: { createdAt: { gte: weekAgo } }, _sum: { totalTokens: true }, _count: true }),
                (prisma as any).tokenUsage.aggregate({ where: { createdAt: { gte: monthAgo } }, _sum: { totalTokens: true }, _count: true }),
                (prisma as any).tokenUsage.aggregate({ _sum: { totalTokens: true }, _count: true }),
            ]);

            tokenData = {
                today: { requests: todayAgg._count || 0, tokens: todayAgg._sum?.totalTokens || 0 },
                week: { requests: weekAgg._count || 0, tokens: weekAgg._sum?.totalTokens || 0 },
                month: { requests: monthAgg._count || 0, tokens: monthAgg._sum?.totalTokens || 0 },
                total: { requests: totalAgg._count || 0, tokens: totalAgg._sum?.totalTokens || 0 },
            };

            // Daily breakdown for chart (last 7 days)
            for (let i = 6; i >= 0; i--) {
                const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
                const nextDate = new Date(date.getTime() + 24 * 60 * 60 * 1000);
                const dayAgg = await (prisma as any).tokenUsage.aggregate({
                    where: { createdAt: { gte: date, lt: nextDate } },
                    _sum: { totalTokens: true, promptTokens: true, completionTokens: true },
                    _count: true,
                });

                // Feature breakdown per day
                const featureGroups = await (prisma as any).tokenUsage.groupBy({
                    by: ['feature'],
                    where: { createdAt: { gte: date, lt: nextDate } },
                    _count: true,
                });

                const featureCounts: Record<string, number> = {};
                featureGroups.forEach((g: any) => { featureCounts[g.feature] = g._count; });

                dailyBreakdown.push({
                    date: date.toISOString().split('T')[0],
                    requests: dayAgg._count || 0,
                    tokens: dayAgg._sum?.totalTokens || 0,
                    promptTokens: dayAgg._sum?.promptTokens || 0,
                    completionTokens: dayAgg._sum?.completionTokens || 0,
                    recommend: (featureCounts['recommend_parse'] || 0) + (featureCounts['recommend_reason'] || 0),
                    translate: featureCounts['translate'] || 0,
                });
            }

            // Recent logs
            recentTokenLogs = await (prisma as any).tokenUsage.findMany({
                orderBy: { createdAt: 'desc' },
                take: 30,
                select: {
                    id: true, feature: true, model: true,
                    promptTokens: true, completionTokens: true, totalTokens: true,
                    locale: true, entityType: true, createdAt: true,
                },
            });
        } catch (e) {
            // TokenUsage table might not exist yet
        }

        // ── 2. Legacy AuditLog data (keep for older data) ──
        let legacyLogs: any[] = [];
        try {
            legacyLogs = await (prisma as any).auditLog.findMany({
                where: {
                    OR: [
                        { action: { contains: 'recommend', mode: 'insensitive' } },
                        { action: { contains: 'translate', mode: 'insensitive' } },
                        { action: { contains: 'ai', mode: 'insensitive' } },
                        { action: { contains: 'gemini', mode: 'insensitive' } },
                    ]
                },
                orderBy: { timestamp: 'desc' },
                take: 100,
            });
        } catch { }

        // For daily breakdown fallback: if tokenData is empty, use legacy estimates
        if (tokenData.total.requests === 0 && legacyLogs.length > 0) {
            const estimateTokens = (logs: any[]) => logs.reduce((sum: number, l: any) => {
                if (l.action?.includes('recommend')) return sum + 150;
                if (l.action?.includes('translate')) return sum + 80;
                return sum + 100;
            }, 0);

            const todayLogs = legacyLogs.filter((l: any) => new Date(l.timestamp) >= today);
            const weekLogs = legacyLogs.filter((l: any) => new Date(l.timestamp) >= weekAgo);
            const monthLogs = legacyLogs.filter((l: any) => new Date(l.timestamp) >= monthAgo);

            tokenData = {
                today: { requests: todayLogs.length, tokens: estimateTokens(todayLogs) },
                week: { requests: weekLogs.length, tokens: estimateTokens(weekLogs) },
                month: { requests: monthLogs.length, tokens: estimateTokens(monthLogs) },
                total: { requests: legacyLogs.length, tokens: estimateTokens(legacyLogs) },
            };

            dailyBreakdown = [];
            for (let i = 6; i >= 0; i--) {
                const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
                const nextDate = new Date(date.getTime() + 24 * 60 * 60 * 1000);
                const dayLogs = legacyLogs.filter((l: any) => {
                    const d = new Date(l.timestamp);
                    return d >= date && d < nextDate;
                });
                dailyBreakdown.push({
                    date: date.toISOString().split('T')[0],
                    requests: dayLogs.length,
                    tokens: estimateTokens(dayLogs),
                    recommend: dayLogs.filter((l: any) => l.action?.includes('recommend')).length,
                    translate: dayLogs.filter((l: any) => l.action?.includes('translate')).length,
                });
            }
        }

        // ── 3. Combine recent logs (new TokenUsage + legacy AuditLog) ──
        const combinedLogs = [
            ...recentTokenLogs.map((l: any) => ({
                id: l.id,
                action: `${l.feature} (${l.model})`,
                detail: `${l.totalTokens} tokens (prompt: ${l.promptTokens}, completion: ${l.completionTokens})${l.locale ? ` • locale: ${l.locale}` : ''}`,
                createdAt: l.createdAt,
                userId: 'system',
                source: 'token',
            })),
            ...legacyLogs.slice(0, 10).map((l: any) => ({
                id: l.id,
                action: l.action,
                detail: l.target?.substring(0, 100),
                createdAt: l.timestamp,
                userId: l.adminId,
                source: 'audit',
            })),
        ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 30);

        // ── 4. Token-based cost estimation (Gemini Flash) ──
        // Gemini 2.0 Flash pricing: $0.10/1M input tokens, $0.40/1M output tokens
        // Simplified: average ~$0.20/1M tokens for mixed usage
        const COST_PER_1M_TOKENS = 0.20; // USD
        const KRW_RATE = 1450;
        const monthTokens = tokenData.month.tokens || 0;
        const totalTokens = tokenData.total.tokens || 0;
        const monthCostUSD = parseFloat((monthTokens / 1_000_000 * COST_PER_1M_TOKENS).toFixed(4));
        const totalCostUSD = parseFloat((totalTokens / 1_000_000 * COST_PER_1M_TOKENS).toFixed(4));

        return NextResponse.json({
            data: {
                ...tokenData,
                dailyBreakdown,
                recentLogs: combinedLogs,
                costEstimate: {
                    monthUSD: monthCostUSD,
                    monthKRW: Math.round(monthCostUSD * KRW_RATE),
                    totalUSD: totalCostUSD,
                    totalKRW: Math.round(totalCostUSD * KRW_RATE),
                    monthTokens,
                    totalTokens,
                    note: 'Gemini 2.0 Flash 기준 추정치 (~$0.20/1M tokens)',
                },
            }
        });
    } catch (err: any) {
        if (err.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Auth required' }, { status: 401 });
        return NextResponse.json({
            data: {
                today: { requests: 0, tokens: 0 },
                week: { requests: 0, tokens: 0 },
                month: { requests: 0, tokens: 0 },
                total: { requests: 0, tokens: 0 },
                dailyBreakdown: [],
                recentLogs: [],
            }
        });
    }
}
