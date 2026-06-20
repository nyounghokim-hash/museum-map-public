import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { transformMuseumPhotos } from '@/lib/photo-proxy';
import { aiLimiter, getClientIp } from '@/lib/rate-limit';
import { privateMuseumWhere } from '@/lib/museumVisibility';

// Keyword-to-filter mapping (no AI needed), ordered by specificity
const TYPE_KEYWORDS: Record<string, string[]> = {
    'Contemporary Art': ['현대미술관', '현대미술', 'contemporary art', 'contemporary', '현대 미술'],
    'Modern Art': ['모던아트', 'modern art', '근대미술', '모던 아트'],
    'Fine Arts': ['fine art', 'painting', '회화', '명화', 'masterpiece', '순수미술'],
    'Art Gallery': ['갤러리', 'gallery', '아트갤러리', '미술관'],
    'Science Museum': ['과학관', '과학', 'science', '아이', 'children', 'kids', 'family', '가족'],
    'Natural History': ['자연사', 'natural history', 'dinosaur', '공룡', '자연'],
    'History Museum': ['역사관', '역사', 'history', 'war', '전쟁'],
    'Architecture Museum': ['건축박물관', '건축', 'architecture museum', 'architecture', 'architectural'],
    'Design Museum': ['디자인', 'design', 'fashion', '패션'],
    'Photography Museum': ['사진', 'photo', 'photography', '포토'],
    'Archaeological Museum': ['고고학', 'archaeological', 'ancient', '고대', '유물', '유적'],
    'Maritime Museum': ['해양', '해사', '선박', '배', '항구', 'maritime', 'naval', 'ship', 'harbor', 'harbour'],
    'Unusual Museum': ['특이', '이색', '독특한', 'unusual', 'weird', 'odd', 'quirky'],
    'General Museum': ['박물관', 'museum', '국립박물관'],
    'Cultural Center': ['문화센터', '문화', 'cultural', 'culture'],
};

const REGION_KEYWORDS: Record<string, string[]> = {
    'europe': ['유럽', 'europe', 'european'],
    'asia': ['아시아', 'asia', 'asian'],
    'america': ['미국', 'america', 'usa', 'us'],
    'japan': ['일본', 'japan', 'japanese', 'tokyo', '도쿄', '요코하마', 'yokohama', '오사카', 'osaka', '교토', 'kyoto', '나라', 'nara', '히로시마', 'hiroshima', '나가사키', 'nagasaki'],
    'korea': ['한국', 'korea', 'korean', 'seoul', '서울'],
    'france': ['프랑스', 'france', 'paris', '파리'],
    'italy': ['이탈리아', 'italy', 'rome', 'roma', '로마', '피렌체', 'florence'],
    'uk': ['영국', 'uk', 'london', 'england', 'british', '런던'],
    'germany': ['독일', 'germany', 'berlin', '베를린'],
    'spain': ['스페인', 'spain', 'madrid', 'barcelona', '마드리드', '바르셀로나'],
    'netherlands': ['네덜란드', 'netherlands', 'amsterdam', 'dutch', '암스테르담'],
    'finland': ['핀란드', 'finland', 'finnish', 'helsinki', '헬싱키'],
    'sweden': ['스웨덴', 'sweden', 'swedish', 'stockholm', '스톡홀름'],
    'norway': ['노르웨이', 'norway', 'norwegian', 'oslo', '오슬로'],
    'denmark': ['덴마크', 'denmark', 'danish', 'copenhagen', '코펜하겐'],
    'estonia': ['에스토니아', 'estonia', 'estonian', 'tallinn', '탈린'],
    'china': ['중국', 'china', 'chinese', 'beijing', 'shanghai', '베이징', '상하이'],
    'taiwan': ['대만', 'taiwan', 'taiwanese', 'taipei', '타이페이'],
    'mexico': ['멕시코', 'mexico', 'mexican', 'mexico city'],
    'brazil': ['브라질', 'brazil', 'brazilian', 'sao paulo'],
    'australia': ['호주', 'australia', 'australian', 'sydney', 'melbourne'],
    'canada': ['캐나다', 'canada', 'canadian', 'toronto', 'montreal'],
    'greece': ['그리스', 'greece', 'greek', 'athens', '아테네'],
    'turkey': ['터키', 'turkey', 'turkish', 'istanbul', '이스탄불', 'türkiye'],
    'qatar': ['카타르', 'qatar', 'doha', '도하'],
    'uae': ['아랍에미리트', 'uae', 'dubai', 'abu dhabi', '두바이', '아부다비'],
    'south_africa': ['남아프리카', 'south africa', 'cape town', '케이프타운'],
    'austria': ['오스트리아', 'austria', 'austrian', 'vienna', '비엔나', '빈'],
    'switzerland': ['스위스', 'switzerland', 'swiss', 'zurich', 'basel', '취리히', '바젤'],
    'belgium': ['벨기에', 'belgium', 'belgian', 'brussels', '브뤼셀'],
    'portugal': ['포르투갈', 'portugal', 'portuguese', 'lisbon', '리스본'],
    'russia': ['러시아', 'russia', 'russian', 'moscow', 'st petersburg', '모스크바', '상트페테르부르크'],
    'india': ['인도', 'india', 'indian', 'mumbai', 'delhi'],
    'singapore': ['싱가포르', 'singapore'],
    'thailand': ['태국', 'thailand', 'thai', 'bangkok', '방콕'],
    'vietnam': ['베트남', 'vietnam', 'vietnamese', 'hanoi', '하노이'],
    'chile': ['칠레', 'chile', 'chilean', 'santiago'],
    'argentina': ['아르헨티나', 'argentina', 'argentine', 'buenos aires'],
    'colombia': ['콜롬비아', 'colombia', 'colombian', 'bogota'],
    'peru': ['페루', 'peru', 'peruvian', 'lima'],
    'egypt': ['이집트', 'egypt', 'egyptian', 'cairo', '카이로'],
    'morocco': ['모로코', 'morocco', 'moroccan', 'marrakech'],
    'poland': ['폴란드', 'poland', 'polish', 'warsaw', '바르샤바'],
    'czech': ['체코', 'czech', 'prague', '프라하'],
    'hungary': ['헝가리', 'hungary', 'hungarian', 'budapest', '부다페스트'],
    'ireland': ['아일랜드', 'ireland', 'irish', 'dublin', '더블린'],
    'iceland': ['아이슬란드', 'iceland', 'icelandic', 'reykjavik'],
    'croatia': ['크로아티아', 'croatia', 'croatian', 'zagreb'],
    'romania': ['루마니아', 'romania', 'romanian', 'bucharest'],
    'latin_america': ['중남미', 'latin america', 'south america', '남미'],
    'middle_east': ['중동', 'middle east'],
    'southeast_asia': ['동남아', 'southeast asia'],
    'north_africa': ['북아프리카', 'north africa'],
    'scandinavia': ['스칸디나비아', 'scandinavia', 'scandinavian', '북유럽', 'nordic'],
    'central_america': ['중앙아메리카', 'central america'],
};

const REGION_COUNTRIES: Record<string, string[]> = {
    'europe': ['GB', 'FR', 'DE', 'IT', 'ES', 'NL', 'BE', 'AT', 'CH', 'SE', 'NO', 'DK', 'FI', 'PT', 'GR', 'PL', 'CZ', 'HU', 'RO', 'IE', 'HR', 'IS', 'EE', 'LT', 'LV'],
    'asia': ['JP', 'KR', 'CN', 'TW', 'TH', 'SG', 'MY', 'ID', 'PH', 'VN', 'IN', 'MM', 'KH', 'LA'],
    'america': ['US'],
    'japan': ['JP'], 'korea': ['KR'], 'france': ['FR'], 'italy': ['IT'],
    'uk': ['GB'], 'germany': ['DE'], 'spain': ['ES'], 'netherlands': ['NL'],
    'finland': ['FI'], 'sweden': ['SE'], 'norway': ['NO'], 'denmark': ['DK'],
    'estonia': ['EE'], 'china': ['CN'], 'taiwan': ['TW'],
    'mexico': ['MX'], 'brazil': ['BR'], 'australia': ['AU'], 'canada': ['CA'],
    'greece': ['GR'], 'turkey': ['TR'], 'qatar': ['QA'], 'uae': ['AE'],
    'south_africa': ['ZA'], 'austria': ['AT'], 'switzerland': ['CH'],
    'belgium': ['BE'], 'portugal': ['PT'], 'russia': ['RU'],
    'india': ['IN'], 'singapore': ['SG'], 'thailand': ['TH'], 'vietnam': ['VN'],
    'chile': ['CL'], 'argentina': ['AR'], 'colombia': ['CO'], 'peru': ['PE'],
    'egypt': ['EG'], 'morocco': ['MA'],
    'poland': ['PL'], 'czech': ['CZ'], 'hungary': ['HU'],
    'ireland': ['IE'], 'iceland': ['IS'], 'croatia': ['HR'], 'romania': ['RO'],
    'latin_america': ['MX', 'BR', 'AR', 'CL', 'CO', 'PE', 'UY', 'EC', 'VE', 'CR', 'PA', 'CU'],
    'middle_east': ['QA', 'AE', 'SA', 'IL', 'JO', 'LB', 'BH', 'OM', 'KW'],
    'southeast_asia': ['TH', 'SG', 'MY', 'ID', 'PH', 'VN', 'MM', 'KH', 'LA'],
    'north_africa': ['EG', 'MA', 'TN', 'DZ'],
    'scandinavia': ['SE', 'NO', 'DK', 'FI', 'IS', 'EE'],
    'central_america': ['CR', 'PA', 'GT', 'HN', 'SV', 'NI', 'BZ'],
};

function localSearch(query: string) {
    const q = query.toLowerCase();
    const types: string[] = [];
    const countries: string[] = [];

    // Match types — longest keyword first to avoid generic matches (e.g. "현대미술관" → Contemporary Art, not "미술관" → Art Gallery)
    const allKeywords: { type: string; kw: string }[] = [];
    for (const [type, keywords] of Object.entries(TYPE_KEYWORDS)) {
        for (const kw of keywords) {
            allKeywords.push({ type, kw });
        }
    }
    allKeywords.sort((a, b) => b.kw.length - a.kw.length);

    let remaining = q;
    for (const { type, kw } of allKeywords) {
        if (remaining.includes(kw)) {
            types.push(type);
            remaining = remaining.replace(kw, ' '); // Remove matched keyword to prevent sub-matches
        }
    }

    // Match regions/countries
    for (const [region, keywords] of Object.entries(REGION_KEYWORDS)) {
        if (keywords.some(kw => q.includes(kw))) {
            const codes = REGION_COUNTRIES[region];
            if (codes) countries.push(...codes);
        }
    }

    return { types: [...new Set(types)], countries: [...new Set(countries)], text: query };
}

// Famous museum name matching for direct search
const FAMOUS_MUSEUMS: Record<string, string[]> = {
    'louvre': ['루브르', 'louvre', '루브르 박물관'],
    'met': ['메트', 'met', 'metropolitan', '메트로폴리탄'],
    'moma': ['모마', 'moma', 'museum of modern art'],
    'uffizi': ['우피치', 'uffizi', '우피치 미술관'],
    'prado': ['프라도', 'prado', '프라도 미술관'],
    'tate': ['테이트', 'tate', 'tate modern', 'tate gallery'],
    'hermitage': ['에르미타주', 'hermitage', '에르미타쥬'],
    'vatican': ['바티칸', 'vatican', '바티칸 박물관'],
    'british museum': ['대영박물관', 'british museum', '대영 박물관'],
    'national gallery': ['내셔널갤러리', 'national gallery'],
    'guggenheim': ['구겐하임', 'guggenheim'],
    'rijksmuseum': ['국립미술관', 'rijksmuseum', '레이크스', '라익스'],
    'musee dorsay': ['오르세', "musee d'orsay", 'orsay', '오르세 미술관'],
    'centre pompidou': ['퐁피두', 'pompidou', 'centre pompidou', '퐁피두 센터'],
    'smithsonian': ['스미소니언', 'smithsonian', '스미소니안'],
    'kiasma': ['키아즈마', 'kiasma'],
    'moca': ['모카', 'moca', 'museum of contemporary art'],
    'palazzo': ['팔라초', 'palazzo'],
};

// Locale to language name mapping for 13 locales
const LOCALE_LANG: Record<string, string> = {
    ko: '한국어', en: 'English', ja: '日本語', 'zh-CN': '简体中文', 'zh-TW': '繁體中文',
    de: 'Deutsch', fr: 'Français', es: 'Español', pt: 'Português',
    da: 'Dansk', fi: 'Suomi', sv: 'Svenska', et: 'Eesti',
};

const RECOMMEND_SELECT = {
    id: true,
    name: true,
    nameKo: true,
    nameEn: true,
    nameTranslations: true,
    description: true,
    summary: true,
    summaryTranslations: true,
    country: true,
    city: true,
    cityKo: true,
    cityTranslations: true,
    type: true,
    imageUrl: true,
    placePhotos: true,
    cachedPhotoUrls: true,
    googleRating: true,
    googleRatingsTotal: true,
    popularityScore: true,
    latitude: true,
    longitude: true,
} as const;

function rankRecommendations(results: any[], query: string, filters: any) {
    const normalizedQuery = query.toLowerCase();
    const tokens = normalizedQuery
        .split(/[\s,./]+/)
        .map(token => token.trim())
        .filter(token => token.length >= 2);

    return [...results]
        .map((museum) => {
            const haystack = [
                museum.name,
                museum.nameKo,
                museum.nameEn,
                museum.city,
                museum.cityKo,
                museum.country,
                museum.type,
                museum.summary,
                museum.description,
            ].filter(Boolean).join(' ').toLowerCase();

            let score = Number(museum.popularityScore || 0);
            if (museum.googleRating) score += museum.googleRating * 12;
            if (museum.googleRatingsTotal) score += Math.min(30, Math.log10(museum.googleRatingsTotal + 1) * 8);
            if (museum.summary) score += 12;
            if (museum.imageUrl || (Array.isArray(museum.cachedPhotoUrls) && museum.cachedPhotoUrls.length > 0)) score += 10;
            if (filters?.types?.includes(museum.type)) score += 24;
            if (filters?.countries?.includes(museum.country)) score += 18;
            for (const city of filters?.cities || []) {
                const c = String(city).toLowerCase();
                if (museum.city?.toLowerCase().includes(c) || museum.cityKo?.toLowerCase().includes(c)) score += 28;
            }
            for (const token of tokens) {
                if (haystack.includes(token)) score += token.length >= 4 ? 10 : 5;
            }
            return { museum, score };
        })
        .sort((a, b) => b.score - a.score)
        .map(({ museum }) => museum);
}

export async function POST(req: NextRequest) {
    try {
        // Rate limit: 10 AI searches per minute per IP
        const ip = getClientIp(req);
        const { success } = aiLimiter.check(ip);
        if (!success) {
            return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
        }

        const { query, locale } = await req.json();
        if (!query || query.trim().length < 2) {
            return NextResponse.json({ error: 'Query too short' }, { status: 400 });
        }
        if (query.length > 200) {
            return NextResponse.json({ error: 'Query too long' }, { status: 400 });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        let filters: any = null;
        let usedAI = false;

        // Try Gemini first for intent parsing
        if (apiKey) {
            try {
                const prompt = `You are a museum search intent parser. Parse the user's query and extract structured filters.
Reply with ONLY valid JSON: {"types":[],"countries":[],"cities":[],"text":""}

Rules:
- types: Match from this list ONLY: Contemporary Art, Modern Art, Fine Arts, Art Gallery, General Museum, Cultural Center, Design Museum, Architecture Museum, Photography Museum, Science Museum, Natural History, History Museum, Archaeological Museum, Maritime Museum, Unusual Museum
- countries: Use ISO 3166-1 alpha-2 codes (e.g. FI for Finland, JP for Japan, KR for South Korea, QA for Qatar)
- cities: Extract city names in BOTH English AND Korean if applicable (e.g. ["Yokohama", "요코하마"])
- text: Key search terms for text-based fallback (museum name, keywords, etc.)
- Be PRECISE with country codes. "핀란드" = FI, "한국" = KR, "일본" = JP, "독일" = DE, etc.
- If a city name is mentioned, ALWAYS include the corresponding country code

User query: "${query.substring(0, 100)}"`;

                const res = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: prompt }] }],
                            generationConfig: { temperature: 0, maxOutputTokens: 150 }
                        }),
                        signal: AbortSignal.timeout(8000),
                    }
                );

                if (res.ok) {
                    const resData = await res.json();
                    const raw = resData.candidates?.[0]?.content?.parts?.[0]?.text || '';
                    // Log token usage
                    const usage = resData?.usageMetadata;
                    if (usage) {
                        try {
                            await (prisma as any).tokenUsage.create({
                                data: {
                                    feature: 'recommend_parse',
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
                        filters = JSON.parse(match[0]);
                        usedAI = true;
                    }
                }
            } catch { /* fallback to local */ }
        }

        // Fallback: keyword matching
        if (!filters) {
            filters = localSearch(query);
        }

        // Build Prisma query
        const where: any = { AND: [] };

        // Type filter
        if (filters.types?.length) {
            where.AND.push({ type: { in: filters.types } });
        }

        // Country filter (most important for location-based queries)
        if (filters.countries?.length) {
            where.AND.push({ country: { in: filters.countries } });
        }

        // City filter — search in both city and cityKo fields
        if (filters.cities?.length) {
            where.AND.push({
                OR: filters.cities.flatMap((city: string) => [
                    { city: { contains: city, mode: 'insensitive' } },
                    { cityKo: { contains: city, mode: 'insensitive' } },
                    { name: { contains: city, mode: 'insensitive' } },
                    { nameKo: { contains: city, mode: 'insensitive' } },
                ])
            });
        }

        // Text search ONLY when no type/country/city filters matched
        if (!filters.types?.length && !filters.countries?.length && !filters.cities?.length) {
            if (filters.text) {
                where.AND.push({
                    OR: [
                        { name: { contains: filters.text, mode: 'insensitive' } },
                        { nameKo: { contains: filters.text, mode: 'insensitive' } },
                        { nameEn: { contains: filters.text, mode: 'insensitive' } },
                        { description: { contains: filters.text, mode: 'insensitive' } },
                        { city: { contains: filters.text, mode: 'insensitive' } },
                        { cityKo: { contains: filters.text, mode: 'insensitive' } },
                    ]
                });
            }
        }

        const results = await prisma.museum.findMany({
            where: { AND: [privateMuseumWhere, ...(where.AND || [])] },
            take: 24,
            orderBy: { popularityScore: 'desc' },
            select: RECOMMEND_SELECT,
        });
        const rankedResults = rankRecommendations(results, query, filters).slice(0, 10);

        // If no results with strict filters, try broader search
        if (rankedResults.length === 0 && (filters.countries?.length || filters.types?.length)) {
            // Try with only country filter
            const broadWhere: any = { AND: [privateMuseumWhere] };
            if (filters.countries?.length) {
                broadWhere.AND.push({ country: { in: filters.countries } });
            } else if (filters.types?.length) {
                broadWhere.AND.push({ type: { in: filters.types } });
            }

            const broadResults = await prisma.museum.findMany({
                where: broadWhere,
                take: 24,
                orderBy: { popularityScore: 'desc' },
                select: RECOMMEND_SELECT,
            });
            const rankedBroadResults = rankRecommendations(broadResults, query, filters).slice(0, 10);

            if (rankedBroadResults.length > 0) {
                return generateResponse(rankedBroadResults, query, locale, apiKey, usedAI, filters);
            }
        }

        return generateResponse(rankedResults, query, locale, apiKey, usedAI, filters);
    } catch (e: any) {
        console.error('Recommend error:', e);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}

async function generateResponse(results: any[], query: string, locale: string, apiKey: string | undefined, usedAI: boolean, filters: any) {
    // Generate recommendation reasons via Gemini
    let reasons: Record<string, string> = {};
    if (apiKey && results.length > 0) {
        try {
            const lang = LOCALE_LANG[locale] || 'English';
            const museumList = results.slice(0, 10).map((r: any, i: number) => {
                const rating = r.googleRating ? `, rating ${r.googleRating}` : '';
                const summary = r.summary ? ` — ${String(r.summary).slice(0, 90)}` : '';
                return `${i + 1}. ${r.name} (${r.city}, ${r.country}, ${r.type}${rating})${summary}`;
            }).join('\n');
            const reasonPrompt = `User searched: "${query.substring(0, 80)}"
Results:
${museumList}

For each museum, write ONE specific, useful reason (under 22 words) why it matches the search, in ${lang}.
Prefer concrete cues from city, museum type, summary, rating, or visit context. Avoid generic praise.
Reply JSON only: {"1":"reason","2":"reason",...}`;

            const reasonRes = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: reasonPrompt }] }],
                        generationConfig: { temperature: 0.3, maxOutputTokens: 300 }
                    }),
                    signal: AbortSignal.timeout(6000),
                }
            );
            if (reasonRes.ok) {
                const reasonData = await reasonRes.json();
                const reasonRaw = reasonData.candidates?.[0]?.content?.parts?.[0]?.text || '';
                const usage = reasonData?.usageMetadata;
                if (usage) {
                    try {
                        await (prisma as any).tokenUsage.create({
                            data: {
                                feature: 'recommend_reason',
                                model: 'gemini-2.5-flash',
                                promptTokens: usage.promptTokenCount || 0,
                                completionTokens: usage.candidatesTokenCount || 0,
                                totalTokens: usage.totalTokenCount || 0,
                            },
                        });
                    } catch { }
                }
                const reasonMatch = reasonRaw.match(/\{[\s\S]*\}/);
                if (reasonMatch) {
                    const parsed = JSON.parse(reasonMatch[0]);
                    results.forEach((r: any, i: number) => {
                        if (parsed[String(i + 1)]) reasons[r.id] = parsed[String(i + 1)];
                    });
                }
            }
        } catch { /* reasons are optional */ }
    }

    // Fallback: generate template-based reasons with full locale support
    const CATEGORY_KO: Record<string, string> = {
        'Contemporary Art': '현대미술', 'Modern Art': '모던아트', 'Fine Arts': '순수미술',
        'Art Gallery': '미술관', 'Science Museum': '과학관', 'Natural History': '자연사',
        'History Museum': '역사', 'Design Museum': '디자인', 'Architecture Museum': '건축', 'Photography Museum': '사진',
        'Archaeological Museum': '고고학', 'General Museum': '종합', 'Cultural Center': '문화센터',
        'Maritime Museum': '해양', 'Unusual Museum': '이색',
    };
    const CATEGORY_JA: Record<string, string> = {
        'Contemporary Art': '現代美術', 'Modern Art': 'モダンアート', 'Fine Arts': '美術',
        'Art Gallery': 'ギャラリー', 'Science Museum': '科学館', 'General Museum': '博物館',
        'Natural History': '自然史', 'History Museum': '歴史博物館', 'Design Museum': 'デザイン', 'Architecture Museum': '建築博物館',
        'Photography Museum': '写真', 'Archaeological Museum': '考古学',
        'Cultural Center': '文化センター', 'Maritime Museum': '海洋博物館', 'Unusual Museum': 'ユニーク博物館',
    };
    const translateType = (type: string, loc: string) => {
        if (loc === 'ko') return CATEGORY_KO[type] || type;
        if (loc === 'ja') return CATEGORY_JA[type] || type;
        return type;
    };
    const generateFallbackReason = (r: any) => {
        const countryName = (() => { try { return new Intl.DisplayNames([locale || 'en'], { type: 'region' }).of(r.country); } catch { return r.country; } })();
        const cityName = r.cityKo && locale === 'ko' ? r.cityKo : (r.cityTranslations?.[locale] || r.city || '');
        const typeName = translateType(r.type || '', locale);
        const loc = cityName ? `${cityName}, ${countryName}` : countryName;
        switch (locale) {
            case 'ko': return `${loc}의 ${typeName}`;
            case 'ja': return `${loc}の${typeName}`;
            case 'zh-CN': return `${loc}的${typeName}`;
            case 'zh-TW': return `${loc}的${typeName}`;
            case 'de': return `${typeName} in ${loc}`;
            case 'fr': return `${typeName} à ${loc}`;
            case 'es': return `${typeName} en ${loc}`;
            case 'pt': return `${typeName} em ${loc}`;
            case 'da': return `${typeName} i ${loc}`;
            case 'fi': return `${typeName}, ${loc}`;
            case 'sv': return `${typeName} i ${loc}`;
            case 'et': return `${typeName}, ${loc}`;
            default: return `${typeName} in ${loc}`;
        }
    };

    const dataWithReasons = results.map((r: any) => ({ ...transformMuseumPhotos(r), reason: reasons[r.id] || generateFallbackReason(r) }));

    // Log AI usage
    if (usedAI) {
        try {
            await prisma.auditLog.create({
                data: {
                    adminId: 'system',
                    action: `recommend:gemini:${results.length}results`,
                    target: query.substring(0, 100),
                }
            });
        } catch { /* AuditLog is optional */ }
    }

    return NextResponse.json({ data: dataWithReasons, filters, ai: usedAI });
}
