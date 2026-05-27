export async function translateText(text: string, targetLang: string = 'en'): Promise<string> {
    if (!text) return '';

    try {
        // Use Google Translate free API
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;

        const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });

        if (!res.ok) {
            console.error(`[Translate] API error: ${res.status}`);
            return text;
        }

        const data = await res.json();

        // Google Translate returns nested arrays: [[["translated","original",null,null,10]],null,"ko"]
        if (data && data[0]) {
            const translated = data[0].map((item: any) => item[0]).join('');
            if (translated) return translated;
        }

        return text;
    } catch (err) {
        console.error('Translation error:', err);
        return text;
    }
}
