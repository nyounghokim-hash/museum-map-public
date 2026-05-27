import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { batchTranslateWithGemini } from '@/lib/gemini-translate';
import { requireAdmin } from '@/lib/auth';
import { aiLimiter, getClientIp } from '@/lib/rate-limit';

/**
 * GET /api/translations?entityType=story&entityId=xxx&locale=ja
 * Returns cached translations for the given entity + locale.
 * If not cached, translates on-the-fly with Gemini and stores in DB.
 */
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const entityType = searchParams.get('entityType'); // "story" | "museum" | "artwork"
        const entityId = searchParams.get('entityId');
        const locale = searchParams.get('locale');

        if (!entityType || !entityId || !locale) {
            return NextResponse.json({ error: 'Missing params' }, { status: 400 });
        }

        // ko uses DB fields directly, en uses nameEn/titleEn — no translation needed
        if (locale === 'ko' || locale === 'en') {
            return NextResponse.json({ translations: {} });
        }

        // Check DB cache
        const cached = await (prisma as any).translationCache.findMany({
            where: { entityType, entityId, locale },
        });

        if (cached.length > 0) {
            const translations: Record<string, string> = {};
            for (const c of cached) {
                translations[c.field] = c.translated;
            }
            return NextResponse.json({ translations, cached: true });
        }

        const ip = getClientIp(req);
        const { success } = aiLimiter.check(ip);
        if (!success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

        // No cache — fetch the source entity to translate
        let fields: Record<string, string> = {};
        let sourceLang = 'ko'; // Default: translate from Korean

        if (entityType === 'story') {
            const story = await (prisma as any).story.findUnique({
                where: { id: entityId },
                select: { title: true, content: true, titleEn: true, contentEn: true },
            });
            if (!story) return NextResponse.json({ translations: {} });
            // Use Korean source (title), fallback to English
            const sourceTitle = story.title || story.titleEn;
            const sourceContent = (story.content || story.contentEn || '').replace(/<[^>]*>/g, '');
            fields = { title: sourceTitle, content: sourceContent };
            sourceLang = 'ko';
        } else if (entityType === 'museum') {
            const museum = await (prisma as any).museum.findUnique({
                where: { id: entityId },
                select: { name: true, nameKo: true, description: true, descriptionKo: true },
            });
            if (!museum) return NextResponse.json({ translations: {} });
            // Use Korean version if available, otherwise English
            if (museum.nameKo) {
                fields.name = museum.nameKo;
                sourceLang = 'ko';
            } else if (museum.name) {
                fields.name = museum.name;
                sourceLang = 'en';
            }
            if (museum.descriptionKo) {
                fields.description = museum.descriptionKo;
            } else if (museum.description) {
                fields.description = museum.description;
                sourceLang = 'en';
            }
        } else if (entityType === 'artwork') {
            const artwork = await (prisma as any).artwork.findUnique({
                where: { id: entityId },
                select: { title: true, artist: true, description: true },
            });
            if (!artwork) return NextResponse.json({ translations: {} });
            if (artwork.title) fields.title = artwork.title;
            if (artwork.artist) fields.artist = artwork.artist;
            if (artwork.description) fields.description = artwork.description;
            sourceLang = 'ko';
        }

        if (Object.keys(fields).length === 0) {
            return NextResponse.json({ translations: {} });
        }

        // Translate with Gemini (batch: all fields in one call)
        const translated = await batchTranslateWithGemini(fields, sourceLang, locale);

        // Save to DB cache
        const translations: Record<string, string> = {};
        for (const [field, text] of Object.entries(translated)) {
            translations[field] = text;
            try {
                await (prisma as any).translationCache.upsert({
                    where: {
                        entityType_entityId_field_locale: {
                            entityType, entityId, field, locale,
                        },
                    },
                    update: { translated: text },
                    create: { entityType, entityId, field, locale, translated: text },
                });
            } catch (e) {
                console.error('[TranslationCache] Save error:', e);
            }
        }

        return NextResponse.json({ translations, cached: false });
    } catch (error) {
        console.error('[Translations API] Error:', error);
        return NextResponse.json({ translations: {} });
    }
}

/**
 * DELETE /api/translations?entityType=story&entityId=xxx
 * Invalidates all cached translations for the given entity.
 */
export async function DELETE(req: Request) {
    try {
        await requireAdmin();
        const { searchParams } = new URL(req.url);
        const entityType = searchParams.get('entityType');
        const entityId = searchParams.get('entityId');

        if (!entityType || !entityId) {
            return NextResponse.json({ error: 'Missing params' }, { status: 400 });
        }

        const deleted = await (prisma as any).translationCache.deleteMany({
            where: { entityType, entityId },
        });

        return NextResponse.json({ deleted: deleted.count });
    } catch (error) {
        if (error instanceof Error && error.message === 'UNAUTHORIZED') {
            return NextResponse.json({ error: 'Admin access required' }, { status: 401 });
        }
        if (error instanceof Error && error.message === 'FORBIDDEN') {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }
        console.error('[Translations API] Delete error:', error);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
