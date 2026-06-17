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

        const translations: Record<string, string> = {};
        let partial = false;
        for (const c of cached) {
            translations[c.field] = c.translated;
        }

        const sourceGroups: Array<{ sourceLang: 'ko' | 'en'; fields: Record<string, string> }> = [];

        if (entityType === 'story') {
            const story = await (prisma as any).story.findUnique({
                where: { id: entityId },
                select: { title: true, content: true, titleEn: true, contentEn: true },
            });
            if (!story) return NextResponse.json({ translations: {} });
            const koFields: Record<string, string> = {};
            const enFields: Record<string, string> = {};
            if (story.title) koFields.title = story.title;
            else if (story.titleEn) enFields.title = story.titleEn;
            if (story.content) koFields.content = story.content.replace(/<[^>]*>/g, '');
            else if (story.contentEn) enFields.content = story.contentEn.replace(/<[^>]*>/g, '');
            if (Object.keys(koFields).length) sourceGroups.push({ sourceLang: 'ko', fields: koFields });
            if (Object.keys(enFields).length) sourceGroups.push({ sourceLang: 'en', fields: enFields });
        } else if (entityType === 'museum') {
            const museum = await (prisma as any).museum.findUnique({
                where: { id: entityId },
                select: { name: true, nameKo: true, description: true, descriptionKo: true, nameTranslations: true, summaryTranslations: true, cityTranslations: true },
            });
            if (!museum) return NextResponse.json({ translations: {} });
            const embeddedTranslations: Record<string, string> = {};
            if (museum.nameTranslations?.[locale]) embeddedTranslations.name = museum.nameTranslations[locale];
            if (museum.summaryTranslations?.[locale]) embeddedTranslations.description = museum.summaryTranslations[locale];
            if (museum.cityTranslations?.[locale]) embeddedTranslations.city = museum.cityTranslations[locale];
            if (Object.keys(embeddedTranslations).length > 0) {
                return NextResponse.json({ translations: { ...embeddedTranslations, ...translations }, cached: true, embedded: true });
            }
            return NextResponse.json({ translations, cached: cached.length > 0, partial: true });
        } else if (entityType === 'artwork') {
            const artwork = await (prisma as any).artwork.findUnique({
                where: { id: entityId },
                select: { title: true, titleKo: true, titleEn: true, artist: true, artistKo: true, artistEn: true, description: true, descriptionKo: true },
            });
            if (!artwork) return NextResponse.json({ translations: {} });
            const koFields: Record<string, string> = {};
            const enFields: Record<string, string> = {};
            if (artwork.titleKo) koFields.title = artwork.titleKo;
            else if (artwork.titleEn || artwork.title) enFields.title = artwork.titleEn || artwork.title;
            if (artwork.artistKo) koFields.artist = artwork.artistKo;
            else if (artwork.artistEn || artwork.artist) enFields.artist = artwork.artistEn || artwork.artist;
            if (artwork.descriptionKo) koFields.description = artwork.descriptionKo;
            else if (artwork.description) enFields.description = artwork.description;
            if (Object.keys(koFields).length) sourceGroups.push({ sourceLang: 'ko', fields: koFields });
            if (Object.keys(enFields).length) sourceGroups.push({ sourceLang: 'en', fields: enFields });
        }

        const missingGroups = sourceGroups
            .map(group => ({
                sourceLang: group.sourceLang,
                fields: Object.fromEntries(Object.entries(group.fields).filter(([field]) => !translations[field])) as Record<string, string>,
            }))
            .filter(group => Object.keys(group.fields).length > 0);

        if (sourceGroups.length === 0) {
            return NextResponse.json({ translations: {} });
        }

        if (missingGroups.length === 0) {
            return NextResponse.json({ translations, cached: true });
        }

        const ip = getClientIp(req);
        const { success } = aiLimiter.check(ip);
        if (!success) return NextResponse.json({ translations, cached: cached.length > 0, partial: true });

        for (const group of missingGroups) {
            const translated = await batchTranslateWithGemini(group.fields, group.sourceLang, locale);
            for (const [field, text] of Object.entries(translated)) {
                if (!text || text === group.fields[field]) {
                    partial = true;
                    continue;
                }
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
                    partial = true;
                    console.error('[TranslationCache] Save error:', e);
                }
            }
            for (const field of Object.keys(group.fields)) {
                if (!translations[field]) partial = true;
            }
        }

        return NextResponse.json({ translations, cached: cached.length > 0, completed: !partial, partial });
    } catch (error) {
        console.error('[Translations API] Error:', error);
        return NextResponse.json({ translations: {}, partial: true, error: true });
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
