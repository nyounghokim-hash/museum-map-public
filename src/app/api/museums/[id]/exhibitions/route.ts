import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

// DuckDuckGo HTML search (no API key needed)
async function searchDuckDuckGo(query: string): Promise<Array<{ title: string; description: string; link: string }>> {
    try {
        const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
            signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) return [];
        const html = await res.text();

        // Parse results from the HTML
        const results: Array<{ title: string; description: string; link: string }> = [];
        const resultBlocks = html.split('class="result__body"');

        for (let i = 1; i < Math.min(resultBlocks.length, 6); i++) {
            const block = resultBlocks[i];
            const titleMatch = block.match(/class="result__a"[^>]*>([^<]+)</);
            const linkMatch = block.match(/href="([^"]+)"/);
            const snippetMatch = block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);

            if (titleMatch && linkMatch) {
                let link = linkMatch[1];
                // DuckDuckGo wraps links in redirect
                if (link.includes('uddg=')) {
                    const decoded = decodeURIComponent(link.split('uddg=')[1]?.split('&')[0] || '');
                    if (decoded) link = decoded;
                }

                results.push({
                    title: titleMatch[1].trim().substring(0, 100),
                    description: (snippetMatch?.[1] || '').replace(/<[^>]*>/g, '').trim().substring(0, 500),
                    link: link.substring(0, 200),
                });
            }
        }
        return results;
    } catch {
        return [];
    }
}

// Wikidata SPARQL for exhibition events
async function searchWikidata(museumName: string): Promise<Array<{ title: string; description: string; link: string }>> {
    const query = `
    SELECT DISTINCT ?exhibLabel ?exhibDescription ?startDate ?endDate WHERE {
        ?museum rdfs:label "${museumName}"@en.
        ?exhib wdt:P276 ?museum.
        ?exhib wdt:P31/wdt:P279* wd:Q464980.
        OPTIONAL { ?exhib wdt:P580 ?startDate. }
        OPTIONAL { ?exhib wdt:P582 ?endDate. }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en,ko". }
    }
    ORDER BY DESC(?startDate)
    LIMIT 5`;

    try {
        const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}&format=json`;
        const res = await fetch(url, {
            headers: { 'User-Agent': 'MuseumMap/1.0' },
            signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) return [];
        const data = await res.json();
        return (data.results?.bindings || []).map((r: any) => {
            const start = r.startDate?.value ? new Date(r.startDate.value).toLocaleDateString() : '';
            const end = r.endDate?.value ? new Date(r.endDate.value).toLocaleDateString() : '';
            const dateStr = start ? `${start}${end ? ` – ${end}` : ''}` : '';
            return {
                title: r.exhibLabel?.value || '',
                description: `${r.exhibDescription?.value || ''}${dateStr ? ` (${dateStr})` : ''}`.substring(0, 500),
                link: '',
            };
        }).filter((e: any) => e.title && !e.title.startsWith('Q'));
    } catch {
        return [];
    }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { searchParams } = new URL(req.url);
        const name = searchParams.get('name');

        if (!name) {
            return NextResponse.json({ error: 'Museum name required' }, { status: 400 });
        }

        // Check cache in DB
        const museum = await prisma.museum.findUnique({
            where: { id },
            select: { lastExhibitionSync: true }
        });

        if (!museum) {
            return NextResponse.json({ error: 'Museum not found' }, { status: 404 });
        }

        const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
        const now = new Date();
        const isFresh = museum.lastExhibitionSync && (now.getTime() - museum.lastExhibitionSync.getTime() < SEVEN_DAYS);

        if (isFresh) {
            const cachedExhibitions = await prisma.exhibition.findMany({
                where: { museumId: id },
                orderBy: { createdAt: 'desc' }
            });
            return NextResponse.json({ data: cachedExhibitions });
        }

        // --- Fetch from DuckDuckGo + Wikidata ---
        const [ddgResults, wdResults] = await Promise.all([
            searchDuckDuckGo(`current exhibitions at ${name} 2025 2026`),
            searchWikidata(name),
        ]);

        // Merge results: Wikidata first (structured), then DuckDuckGo (web)
        const allResults = [
            ...wdResults.map(r => ({ ...r, source: 'WIKIDATA' })),
            ...ddgResults.map(r => ({ ...r, source: 'DDG' })),
        ];

        const exhibitions = allResults.slice(0, 5).map(item => ({
            title: item.title.substring(0, 100),
            description: item.description?.substring(0, 500) || null,
            link: item.link?.substring(0, 200) || null,
            imageUrl: null,
            source: item.source,
            museumId: id
        }));

        // Transaction to update DB
        await prisma.$transaction([
            prisma.exhibition.deleteMany({
                where: { museumId: id }
            }),
            prisma.exhibition.createMany({
                data: exhibitions
            }),
            prisma.museum.update({
                where: { id },
                data: { lastExhibitionSync: now }
            })
        ]);

        const newCached = await prisma.exhibition.findMany({
            where: { museumId: id },
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json({ data: newCached });

    } catch (error: any) {
        console.error('Exhibition Search Error:', error);
        return NextResponse.json({ error: 'Failed to fetch exhibitions' }, { status: 500 });
    }
}

