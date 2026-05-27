/**
 * Gemini Flash-based batch translation utility.
 * Translates multiple fields in a single API call to save tokens.
 * Falls back to Google Translate on failure.
 */

import { prisma } from '@/lib/prisma';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-2.5-flash';

/** Log token usage to DB (fire-and-forget) */
async function logTokenUsage(data: any, feature: string, locale?: string, entityType?: string) {
    try {
        const usage = data?.usageMetadata;
        if (!usage) return;
        await (prisma as any).tokenUsage.create({
            data: {
                feature,
                model: GEMINI_MODEL,
                promptTokens: usage.promptTokenCount || 0,
                completionTokens: usage.candidatesTokenCount || 0,
                totalTokens: usage.totalTokenCount || 0,
                locale: locale || null,
                entityType: entityType || null,
            },
        });
    } catch (e) {
        // Silently fail — don't break translation for logging
    }
}

const LANG_NAMES: Record<string, string> = {
    ko: 'Korean', en: 'English', ja: 'Japanese', de: 'German', fr: 'French',
    es: 'Spanish', pt: 'Portuguese', 'zh-CN': 'Simplified Chinese', 'zh-TW': 'Traditional Chinese',
    sv: 'Swedish', fi: 'Finnish', da: 'Danish', et: 'Estonian',
};

/**
 * Translate multiple text fields in a single Gemini API call.
 * Input: { fieldName: sourceText, ... }
 * Output: { fieldName: translatedText, ... }
 */
export async function batchTranslateWithGemini(
    fields: Record<string, string>,
    sourceLang: string,
    targetLang: string
): Promise<Record<string, string>> {
    if (!GEMINI_API_KEY) {
        console.warn('[GeminiTranslate] No API key, falling back');
        return fields;
    }

    const sourceLanguage = LANG_NAMES[sourceLang] || sourceLang;
    const targetLanguage = LANG_NAMES[targetLang] || targetLang;

    const entries = Object.entries(fields).filter(([, v]) => v && v.trim());
    if (entries.length === 0) return {};

    // Build prompt with proper noun localization rules
    const fieldsJson = JSON.stringify(Object.fromEntries(entries));
    const prompt = `Translate the following JSON values from ${sourceLanguage} to ${targetLanguage}.

CRITICAL RULES:
1. For proper nouns (museum names, artwork titles, artist names), use the OFFICIAL name commonly used in ${targetLanguage}-speaking countries, NOT a literal translation.
2. For example, "국립현대미술관 과천관" in Japanese should be "国立現代美術館 果川館", not a transliteration.
3. Famous artworks have known official titles in each language — use those (e.g., "별이 빛나는 밤" → "The Starry Night" in English, "星月夜" in Japanese).
4. For descriptions and general text, translate naturally and fluently.
5. Keep the JSON keys exactly the same. Return ONLY valid JSON, no markdown.

${fieldsJson}`;

    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.1,
                    maxOutputTokens: 8192,
                    responseMimeType: 'application/json',
                },
            }),
            signal: AbortSignal.timeout(30000),
        });

        if (!res.ok) {
            console.error(`[GeminiTranslate] HTTP ${res.status}`);
            return fallbackTranslate(fields, sourceLang, targetLang);
        }

        const data = await res.json();

        // Log token usage (fire-and-forget)
        logTokenUsage(data, 'translate', targetLang);

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) {
            return fallbackTranslate(fields, sourceLang, targetLang);
        }

        // Parse JSON response
        const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const translated = JSON.parse(cleaned);

        // Validate: ensure all keys are present
        const result: Record<string, string> = {};
        for (const [key, original] of entries) {
            result[key] = translated[key] || original;
        }
        return result;
    } catch (err) {
        console.error('[GeminiTranslate] Error:', err);
        return fallbackTranslate(fields, sourceLang, targetLang);
    }
}

/**
 * Translate a single text with Gemini.
 */
export async function translateWithGemini(
    text: string,
    sourceLang: string,
    targetLang: string
): Promise<string> {
    const result = await batchTranslateWithGemini({ text }, sourceLang, targetLang);
    return result.text || text;
}

/**
 * Fallback: Google Translate free API (for when Gemini fails)
 */
async function fallbackTranslate(
    fields: Record<string, string>,
    sourceLang: string,
    targetLang: string
): Promise<Record<string, string>> {
    const result: Record<string, string> = {};
    for (const [key, text] of Object.entries(fields)) {
        if (!text) { result[key] = text; continue; }
        try {
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text.slice(0, 5000))}`;
            const res = await fetch(url, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                signal: AbortSignal.timeout(8000),
            });
            const data = await res.json();
            if (data?.[0]) {
                result[key] = data[0].map((item: any) => item[0]).join('');
            } else {
                result[key] = text;
            }
        } catch {
            result[key] = text;
        }
    }
    return result;
}
