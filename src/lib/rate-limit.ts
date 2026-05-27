/**
 * Simple in-memory rate limiter for API routes.
 * Uses a sliding window approach.
 *
 * Usage in API route:
 *   import { rateLimit } from '@/lib/rate-limit';
 *   const limiter = rateLimit({ interval: 60_000, limit: 30 });
 *   // In handler:
 *   const { success } = limiter.check(ip);
 *   if (!success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
 */

interface RateLimitOptions {
    interval: number;   // Time window in ms
    limit: number;      // Max requests per window
}

interface TokenBucket {
    count: number;
    lastReset: number;
}

export function rateLimit({ interval, limit }: RateLimitOptions) {
    const tokens = new Map<string, TokenBucket>();

    // Clean up old entries every 5 minutes
    setInterval(() => {
        const now = Date.now();
        for (const [key, bucket] of tokens) {
            if (now - bucket.lastReset > interval * 2) {
                tokens.delete(key);
            }
        }
    }, 300_000);

    return {
        check(identifier: string): { success: boolean; remaining: number } {
            const now = Date.now();
            const bucket = tokens.get(identifier);

            if (!bucket || now - bucket.lastReset > interval) {
                tokens.set(identifier, { count: 1, lastReset: now });
                return { success: true, remaining: limit - 1 };
            }

            if (bucket.count >= limit) {
                return { success: false, remaining: 0 };
            }

            bucket.count++;
            return { success: true, remaining: limit - bucket.count };
        },
    };
}

// Pre-configured limiters for common use cases
export const adminLimiter = rateLimit({ interval: 60_000, limit: 60 });     // 60 req/min for admin
export const photoLimiter = rateLimit({ interval: 60_000, limit: 10 });     // 10 uploads/min
export const apiLimiter = rateLimit({ interval: 60_000, limit: 120 });      // 120 req/min general
export const authLimiter = rateLimit({ interval: 300_000, limit: 20 });     // 20 attempts/5min
export const aiLimiter = rateLimit({ interval: 60_000, limit: 10 });        // 10 req/min for AI (Gemini) — prevents cost bomb
export const spamLimiter = rateLimit({ interval: 60_000, limit: 5 });       // 5 req/min for anonymous endpoints

export function getClientIp(request: Request): string {
    return (
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        request.headers.get('x-real-ip') ||
        'unknown'
    );
}
