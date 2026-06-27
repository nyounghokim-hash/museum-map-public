import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { transformMuseumPhotos } from '@/lib/photo-proxy';
import { aiLimiter, getClientIp } from '@/lib/rate-limit';
import { privateMuseumWhere } from '@/lib/museumVisibility';

const LOCALE_LANG: Record<string, string> = {
    ko: '한국어', en: 'English', ja: '日本語', 'zh-CN': '简体中文', 'zh-TW': '繁體中文',
    de: 'Deutsch', fr: 'Français', es: 'Español', pt: 'Português',
    da: 'Dansk', fi: 'Suomi', sv: 'Svenska', et: 'Eesti',
};

const GEMINI_PERSONALIZED_ALLOWED =
    process.env.ALLOW_BILLABLE_API === '1' &&
    process.env.ALLOW_GEMINI_API === '1' &&
    process.env.BILLABLE_API_APPROVAL === 'gemini:personalized-recommend';

// In-memory cache: userId -> { data, timestamp }
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h

export async function GET(req: NextRequest) {
    try {
        // Rate limit: 10 req/min per IP for AI-powered endpoint
        const ip = getClientIp(req);
        const { success } = aiLimiter.check(ip);
        if (!success) {
            return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
        }

        const locale = req.nextUrl.searchParams.get('locale') || 'en';
        const user = await getSessionUser().catch(() => null);

        // Non-logged-in: return popular museums
        if (!user) {
            return getPopularMuseums(locale);
        }

        // Check cache
        const cached = cache.get(user.id);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            return NextResponse.json(cached.data);
        }

        // 1. Analyze user preferences
        const [saves, plans, artworkViews] = await Promise.all([
            prisma.save.findMany({
                where: { userId: user.id },
                select: { museum: { select: { id: true, country: true, city: true, type: true, name: true } } },
                take: 50,
                orderBy: { createdAt: 'desc' }
            }),
            prisma.plan.findMany({
                where: { userId: user.id },
                select: { stops: { select: { museum: { select: { id: true, country: true, city: true, type: true } } } } },
                take: 20,
                orderBy: { createdAt: 'desc' }
            }),
            prisma.artwork.findMany({
                where: { museum: { saves: { some: { userId: user.id } } } },
                select: { artist: true, artistKo: true, museum: { select: { type: true, country: true } } },
                take: 100,
            })
        ]);

        // 2. Extract preference patterns
        const countryFreq: Record<string, number> = {};
        const typeFreq: Record<string, number> = {};
        const cityFreq: Record<string, number> = {};
        const artistFreq: Record<string, number> = {};
        const savedMuseumIds = new Set<string>();

        for (const s of saves) {
            const m = s.museum;
            savedMuseumIds.add(m.id);
            countryFreq[m.country] = (countryFreq[m.country] || 0) + 1;
            typeFreq[m.type] = (typeFreq[m.type] || 0) + 1;
            if (m.city) cityFreq[m.city] = (cityFreq[m.city] || 0) + 1;
        }

        for (const p of plans) {
            for (const s of p.stops) {
                if (s.museum) {
                    countryFreq[s.museum.country] = (countryFreq[s.museum.country] || 0) + 0.5;
                    typeFreq[s.museum.type] = (typeFreq[s.museum.type] || 0) + 0.5;
                }
            }
        }

        for (const a of artworkViews) {
            const artist = a.artistKo || a.artist || '';
            if (artist) artistFreq[artist] = (artistFreq[artist] || 0) + 1;
        }

        // Sort by frequency
        const topCountries = Object.entries(countryFreq).sort((a, b) => b[1] - a[1]).slice(0, 3).map(e => e[0]);
        const topTypes = Object.entries(typeFreq).sort((a, b) => b[1] - a[1]).slice(0, 3).map(e => e[0]);
        const topArtists = Object.entries(artistFreq).sort((a, b) => b[1] - a[1]).slice(0, 5).map(e => e[0]);

        // If user has no saves, return popular
        if (saves.length === 0) {
            return getPopularMuseums(locale);
        }

        // 3. Find recommended museums (not saved yet)
        const recommended = await prisma.museum.findMany({
            where: {
                AND: [
                    privateMuseumWhere as any,
                    {
                        id: { notIn: Array.from(savedMuseumIds) },
                        OR: [
                            ...(topTypes.length ? [{ type: { in: topTypes } }] : []),
                            ...(topCountries.length ? [{ country: { in: topCountries } }] : []),
                        ],
                        artworks: { some: {} }, // Only museums with artworks
                    },
                ],
            },
            take: 15,
            orderBy: { popularityScore: 'desc' },
            select: {
                id: true, name: true, nameKo: true, nameEn: true, nameTranslations: true,
                description: true, descriptionKo: true, country: true, city: true,
                cityKo: true, cityTranslations: true, type: true, imageUrl: true, placePhotos: true, cachedPhotoUrls: true,
                latitude: true, longitude: true,
                artworks: { take: 1, select: { title: true, titleKo: true, artist: true, artistKo: true, image: true } }
            }
        });

        // 4. Generate AI reasons
        const reasons: Record<string, string> = {};
        const apiKey = GEMINI_PERSONALIZED_ALLOWED ? process.env.GEMINI_API_KEY : undefined;

        if (apiKey && recommended.length > 0) {
            try {
                const lang = LOCALE_LANG[locale] || 'English';
                const userProfile = `사용자 선호: 국가=${topCountries.join(',')}, 카테고리=${topTypes.join(',')}, 좋아하는 작가=${topArtists.slice(0, 3).join(',')}`;
                const museumList = recommended.slice(0, 8).map((r, i) =>
                    `${i + 1}. ${r.name} (${r.city}, ${r.country}, ${r.type})`
                ).join('\n');

                const prompt = `${userProfile}

Based on this user's preferences, write a SHORT personalized reason (under 20 words) for each museum recommendation, in ${lang}.
Museums:
${museumList}

Reply JSON only: {"1":"reason","2":"reason",...}
Be warm and conversational. Reference specific preferences when possible (e.g., "인상파를 좋아하시니 이곳을 추천합니다").`;

                const res = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: prompt }] }],
                            generationConfig: { temperature: 0.5, maxOutputTokens: 400 }
                        }),
                        signal: AbortSignal.timeout(8000),
                    }
                );

                if (res.ok) {
                    const resData = await res.json();
                    const raw = resData.candidates?.[0]?.content?.parts?.[0]?.text || '';
                    const usage = resData?.usageMetadata;
                    if (usage) {
                        try {
                            await (prisma as any).tokenUsage.create({
                                data: {
                                    feature: 'personalized_recommend',
                                    model: 'gemini-2.5-flash',
                                    promptTokens: usage.promptTokenCount || 0,
                                    completionTokens: usage.candidatesTokenCount || 0,
                                    totalTokens: usage.totalTokenCount || 0,
                                },
                            });
                        } catch { }
                    }
                    const match = raw.match(/\{[\s\S]*\}/);
                    if (match) {
                        const parsed = JSON.parse(match[0]);
                        recommended.forEach((r, i) => {
                            if (parsed[String(i + 1)]) reasons[r.id] = parsed[String(i + 1)];
                        });
                    }
                }
            } catch { /* AI reasons are optional */ }
        }

        // 5. Build response
        const fallbackReason = (r: any) => {
            const typeName: Record<string, string> = {
                'Contemporary Art': '현대미술관', 'Modern Art': '모던아트 미술관', 'Fine Arts': '미술관',
                'Art Gallery': '갤러리', 'General Museum': '박물관',
            };
            switch (locale) {
                case 'ko': return `${r.cityKo || r.city}의 ${typeName[r.type] || r.type}`;
                case 'ja': return `${r.city}の美術館`;
                default: return `${r.type} in ${r.city}`;
            }
        };

        const data = recommended.map(r => ({
            ...r,
            reason: reasons[r.id] || fallbackReason(r),
            featuredArtwork: r.artworks?.[0] || null,
        })).map(transformMuseumPhotos);

        const response = {
            recommendations: data.slice(0, 8),
            profile: {
                topCountries,
                topTypes,
                topArtists: topArtists.slice(0, 3),
                savedCount: saves.length,
            },
            ai: Object.keys(reasons).length > 0,
        };

        // Cache
        cache.set(user.id, { data: response, timestamp: Date.now() });

        return NextResponse.json(response);
    } catch (e: any) {
        console.error('Personalized error:', e);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}

async function getPopularMuseums(locale: string) {
    const popular = await prisma.museum.findMany({
        where: { AND: [privateMuseumWhere as any, { artworks: { some: {} } }] },
        take: 8,
        orderBy: { popularityScore: 'desc' },
        select: {
            id: true, name: true, nameKo: true, nameEn: true, nameTranslations: true,
            description: true, descriptionKo: true, country: true, city: true,
            cityKo: true, cityTranslations: true, type: true, imageUrl: true, placePhotos: true, cachedPhotoUrls: true,
            latitude: true, longitude: true,
            artworks: { take: 1, select: { title: true, titleKo: true, artist: true, artistKo: true, image: true } }
        }
    });

    const data = popular.map(r => ({
        ...r,
        reason: locale === 'ko' ? '인기 미술관' : locale === 'ja' ? '人気の美術館' : 'Popular museum',
        featuredArtwork: r.artworks?.[0] || null,
    })).map(transformMuseumPhotos);

    return NextResponse.json({
        recommendations: data,
        profile: null,
        ai: false,
    });
}
