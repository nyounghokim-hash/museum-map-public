import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiLimiter, getClientIp } from '@/lib/rate-limit';

// In-memory cache to avoid repeated API calls within same server instance
const cache = new Map<string, string>();

const LANG_MAP: Record<string, string> = {
    ko: 'ko', ja: 'ja', de: 'de', fr: 'fr', es: 'es', pt: 'pt',
    'zh-CN': 'zh-CN', 'zh-TW': 'zh-TW',
    sv: 'sv', fi: 'fi', da: 'da', et: 'et',
    en: 'en',
};

// Detect if text contains Korean characters
function containsKorean(text: string): boolean {
    return /[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/.test(text);
}

export async function POST(req: NextRequest) {
    try {
        const ip = getClientIp(req);
        const { success } = apiLimiter.check(ip);
        if (!success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

        const { text, targetLang } = await req.json();

        if (!text || !targetLang) {
            return NextResponse.json({ translated: text });
        }
        if (typeof text !== 'string' || text.length > 5000) {
            return NextResponse.json({ error: 'Text too long' }, { status: 400 });
        }

        const lang = LANG_MAP[targetLang];
        if (!lang) return NextResponse.json({ translated: text });

        // Auto-detect source language
        const isKorean = containsKorean(text);
        const sourceLang = isKorean ? 'ko' : 'en';

        // Skip if target = source
        if (lang === sourceLang) {
            return NextResponse.json({ translated: text });
        }

        const cacheKey = `${sourceLang}:${lang}:${text.slice(0, 200)}`;
        if (cache.has(cacheKey)) {
            return NextResponse.json({ translated: cache.get(cacheKey) });
        }

        // Use Google Translate free API (no daily limit)
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${lang}&dt=t&q=${encodeURIComponent(text.slice(0, 5000))}`;
        const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            signal: AbortSignal.timeout(8000),
        });
        const data = await res.json();

        if (data && data[0]) {
            const translated = data[0].map((item: any) => item[0]).join('');
            if (translated && translated !== text) {
                cache.set(cacheKey, translated);
                try { await prisma.auditLog.create({ data: { adminId: 'system', action: `translate:${sourceLang}>${lang}`, target: text.substring(0, 80) } }); } catch { }
                return NextResponse.json({ translated });
            }
        }

        return NextResponse.json({ translated: text });
    } catch {
        return NextResponse.json({ translated: '' });
    }
}
