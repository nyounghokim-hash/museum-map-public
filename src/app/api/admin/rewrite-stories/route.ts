import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-utils';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ADMIN_STORY_REWRITE_ALLOWED =
  process.env.ALLOW_BILLABLE_API === '1' &&
  process.env.ALLOW_GEMINI_API === '1' &&
  process.env.BILLABLE_API_APPROVAL === 'gemini:admin-story-rewrite';

const BILLABLE_STORY_REWRITE_BLOCKED =
  'Gemini story rewriting is blocked by default. MM Story writing and rewriting must be done directly/local-first unless the user explicitly approves this exact paid run.';

async function callGemini(prompt: string): Promise<string> {
  if (!ADMIN_STORY_REWRITE_ALLOWED) {
    throw new Error(BILLABLE_STORY_REWRITE_BLOCKED);
  }
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is required after explicit paid-run approval.');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
  
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.85, topK: 40, topP: 0.92, maxOutputTokens: 8192 },
      }),
    });

    if (response.status === 429 || response.status === 503) {
      await new Promise(r => setTimeout(r, 15000 * (attempt + 1)));
      continue;
    }
    if (!response.ok) throw new Error(`Gemini ${response.status}`);

    const data = await response.json();
    let text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    if (text.startsWith('```')) text = text.replace(/^```\w*\n?/, '').replace(/\n?```$/, '').trim();
    return text;
  }
  throw new Error('Gemini API failed after retries');
}

function koPrompt(title: string, museums: { nameKo?: string; name: string; city?: string; country?: string }[]) {
  const list = museums.map(m => `- ${m.nameKo || m.name} (${m.city || ''}, ${m.country || ''})`).join('\n');

  return `당신은 박물관 공개 정보와 검증 가능한 맥락을 바탕으로 글을 쓰는 문화 여행 편집자입니다.

## 기본 정보
- 제목: ${title}
- 미술관:
${list}

## 필수 규칙

【문체】 반드시 존댓말(~습니다, ~입니다, ~했습니다, ~볼 수 있습니다). 반말(~다, ~이다) 절대 금지.
【분량】 3500~4500자 (HTML 태그 제외)
【구조】 각 미술관별 독립 섹션 + 마지막 '방문 팁' (확실한 범위의 교통/관람 동선 중심. 입장료·운영시간은 모르면 공식 사이트 확인으로 안내)
【서사】 각 섹션마다 다른 서사 방식 (건축체험/대표작품/방문감상/역사맥락/주변연계 중 택1, 반복금지)
【사실성】 직접 방문했다고 말하지 말 것. 확인되지 않은 작품, 요금, 운영시간, 맛집, 체험담을 만들지 말 것.
【금지 표현】 "예술의 의미", "마무리", "~하도록 하자", "~하도록 하세요", "~살펴보도록", "~둘러보도록", "~감상해 보도록", "~방문하도록", "~확인하도록", 모든 "~도록" 류 반복 어미, "~바랍니다", "도시의 역사와 문화를 대표하는", "정성스럽게 큐레이션된", "컬렉션을 충분히 감상하려면 최소 반나절"
【금지 기호】 마크다운(#, **, __)

## 출력: HTML만
<h2>섹션 제목</h2>
<p>본문(존댓말)...</p>
<h2>방문 팁</h2>
<p>정보...</p>
HTML과 텍스트만. 코드블록/설명 불가.`;
}

function enPrompt(title: string, museums: { nameKo?: string; name: string; city?: string; country?: string }[], koPeek: string) {
  const list = museums.map(m => `- ${m.name || m.nameKo} (${m.city || ''}, ${m.country || ''})`).join('\n');

  return `You are a museum editor writing from public, verifiable context.

## Info
- Title: ${title}
- Museums:
${list}

## Korean reference (don't translate): ${koPeek}

## Rules
- 3500-4500 chars (excl. HTML). One section per museum + Practical Tips at end.
- Each section uses DIFFERENT narrative angle (architecture/artwork/essay/history/neighborhood). Never repeat.
- Do not claim firsthand visits. Do not invent artworks, prices, opening hours, restaurants, or personal experience.
- FORBIDDEN: "Final Thoughts", "stands as one of the city's most significant", "Travel is not merely about moving", "premier museum committed to", markdown (#, **, __)
- Be specific and vivid.

## Output: HTML only
<h2>Section Title</h2><p>Body...</p><h2>Practical Tips</h2><p>Info...</p>
HTML and text ONLY.`;
}

// GET: 대상 스토리 수 확인
// POST: 재작성 실행 (?limit=N, ?offset=N)
export async function GET() {
  try {
    await requireAdmin();
    const stories = await (prisma as any).story.findMany({
      where: { status: 'PUBLISHED' },
      select: { id: true, title: true, titleKo: true, content: true, contentEn: true },
    });

    let needRewrite = 0;
    for (const s of stories) {
      const ko = (s.content || '').replace(/<[^>]+>/g, '');
      const en = (s.contentEn || '').replace(/<[^>]+>/g, '');
      if (ko.length < 3000 || en.length < 3000) { needRewrite++; continue; }
      
      const badKo = ['예술의 의미', '마무리', '하도록 하자', '하도록 하세요', '살펴보도록', '둘러보도록', '감상해 보도록', '방문하도록', '확인하도록', '바랍니다', '정성스럽게 큐레이션된', '도시의 역사와 문화를 대표하는'].some(p => ko.includes(p));
      const badEn = ['Final Thoughts', 'stands as one of', 'Travel is not merely'].some(p => en.includes(p));
      if (badKo || badEn) { needRewrite++; continue; }

      // 반말 체크
      const sentences = ko.split(/[.!?]\s/);
      let banmal = 0, jondae = 0;
      for (const sent of sentences) {
        if (/습니다|됩니다|합니다|있습니다|입니다/.test(sent)) jondae++;
        else if (/[다][\.\!\?]?$/.test(sent.trim())) banmal++;
      }
      if (banmal > jondae) needRewrite++;
    }

    return successResponse({ total: stories.length, needRewrite });
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED') return errorResponse('UNAUTHORIZED', 'Admin access required', 401);
    if (err.message === 'FORBIDDEN') return errorResponse('FORBIDDEN', 'Admin access required', 403);
    return errorResponse('INTERNAL_SERVER_ERROR', err.message, 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    if (!ADMIN_STORY_REWRITE_ALLOWED) {
      return errorResponse('BILLABLE_API_BLOCKED', BILLABLE_STORY_REWRITE_BLOCKED, 403);
    }

    const url = new URL(req.url);
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '5', 10) || 5, 1), 10);
    const offset = Math.max(parseInt(url.searchParams.get('offset') || '0', 10) || 0, 0);

    const stories = await (prisma as any).story.findMany({
      where: { status: 'PUBLISHED' },
      select: {
        id: true, title: true, titleKo: true, titleEn: true,
        content: true, contentEn: true, category: true,
        museums: { select: { museum: { select: { id: true, name: true, nameKo: true, city: true, country: true } } } }
      },
      orderBy: { createdAt: 'asc' },
      skip: offset,
      take: limit,
    });

    const results: { id: string; title: string; koLen: number; enLen: number; status: string }[] = [];

    for (const s of stories) {
      const museums = s.museums.map((m: any) => m.museum).filter(Boolean);
      if (museums.length === 0) {
        results.push({ id: s.id, title: s.titleKo || s.title, koLen: 0, enLen: 0, status: 'skipped-no-museum' });
        continue;
      }

      try {
        const newKo = await callGemini(koPrompt(s.titleKo || s.title, museums));
        const koLen = newKo.replace(/<[^>]+>/g, '').length;

        await new Promise(r => setTimeout(r, 2000));

        const peek = newKo.replace(/<[^>]+>/g, '').substring(0, 500) + '...';
        const newEn = await callGemini(enPrompt(s.titleEn || s.title, museums, peek));
        const enLen = newEn.replace(/<[^>]+>/g, '').length;

        await (prisma as any).story.update({
          where: { id: s.id },
          data: { content: newKo, contentEn: newEn },
        });

        // Clear translation cache
        try {
          await (prisma as any).translationCache.deleteMany({
            where: { entityType: 'story', entityId: s.id },
          });
        } catch { /* ignore */ }

        results.push({ id: s.id, title: s.titleKo || s.title, koLen, enLen, status: 'success' });
        await new Promise(r => setTimeout(r, 2500));
      } catch (err: any) {
        results.push({ id: s.id, title: s.titleKo || s.title, koLen: 0, enLen: 0, status: `error: ${err.message}` });
        await new Promise(r => setTimeout(r, 5000));
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const totalStories = await (prisma as any).story.count({ where: { status: 'PUBLISHED' } });

    return successResponse({
      processed: results.length,
      success: successCount,
      total: totalStories,
      nextOffset: offset + limit,
      hasMore: offset + limit < totalStories,
      results,
    });
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED') return errorResponse('UNAUTHORIZED', 'Admin access required', 401);
    if (err.message === 'FORBIDDEN') return errorResponse('FORBIDDEN', 'Admin access required', 403);
    return errorResponse('INTERNAL_SERVER_ERROR', err.message, 500);
  }
}
