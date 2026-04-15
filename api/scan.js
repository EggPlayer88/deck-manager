/**
 * /api/scan.js — Vercel 서버리스 함수
 * Google Gemini API 사용
 * 모델: gemini-2.5-flash (폴백: gemini-2.0-flash)
 */

const MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
];

async function callGemini(apiKey, model, contents) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        generationConfig: {
          maxOutputTokens: 4096,
          temperature: 0.1,
          responseMimeType: 'text/plain',
        }
      })
    }
  );
  return res;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY 환경변수가 설정되지 않았습니다.' });
  }

  const DAILY_LIMIT = 500;
  const USER_DAILY_LIMIT = 10;
  const today = new Date().toISOString().slice(0, 10);
  const { base64, mediaType, prompt, userId } = req.body || {};

  /* ── 일일 한도 체크 ── */
  if (supabaseUrl && supabaseKey) {
    try {
      const globalRes = await fetch(
        `${supabaseUrl}/rest/v1/scan_usage?date=eq.${today}`,
        { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
      );
      const globalData = await globalRes.json();
      const globalCount = (Array.isArray(globalData) && globalData[0]) ? globalData[0].count : 0;
      if (globalCount >= DAILY_LIMIT) {
        return res.status(429).json({ error: `오늘 서비스 전체 한도(${DAILY_LIMIT}회)를 초과했습니다.` });
      }
      if (userId) {
        const userRes = await fetch(
          `${supabaseUrl}/rest/v1/scan_usage_user?date=eq.${today}&user_id=eq.${userId}`,
          { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
        );
        const userData = await userRes.json();
        const userCount = (Array.isArray(userData) && userData[0]) ? userData[0].count : 0;
        if (userCount >= USER_DAILY_LIMIT) {
          return res.status(429).json({ error: `오늘 사용 한도(${USER_DAILY_LIMIT}회)를 초과했습니다.` });
        }
      }
    } catch (e) {
      console.error('사용량 체크 오류:', e);
    }
  }

  /* ── Few-shot 예시 이미지 로드 ── */
  const EXAMPLES = [
    { file: 'impact.jpg',    label: '임팩트',    desc: '청록/민트 배경, 이름 위에 역할 텍스트(예: 중견수), 이름에 연도 숫자 없음' },
    { file: 'live.jpg',      label: '라이브',    desc: '이름 바로 위에 V1/V2/V3 뱃지와 연도 표시' },
    { file: 'allstar.jpg',   label: '올스타',    desc: 'ALL STAR 텍스트, NANUM 또는 DREAM 로고' },
    { file: 'golden.jpg',    label: '골든글러브', desc: '이름 하단 노란/황금색 장식, 황금 배경' },
    { file: 'signature.jpg', label: '시그니처',  desc: '이름 위 왼쪽에 빨간 필기체 Sign 텍스트, 분홍/마젠타 배경' },
    { file: 'national.jpg',  label: '국가대표',  desc: '파란/남색 배경, 우측 상단 팀 로고 근방 흰색' },
  ];

  let exampleParts = [];
  if (supabaseUrl) {
    try {
      const results = await Promise.all(EXAMPLES.map(async (ex) => {
        try {
          const controller = new AbortController();
          const tid = setTimeout(() => controller.abort(), 3000);
          const r = await fetch(
            `${supabaseUrl}/storage/v1/object/public/card-examples/${ex.file}`,
            { signal: controller.signal }
          );
          clearTimeout(tid);
          if (!r.ok) return null;
          const buf = await r.arrayBuffer();
          const b64 = Buffer.from(buf).toString('base64');
          const mime = ex.file.endsWith('.png') ? 'image/png' : 'image/jpeg';
          return { ex, b64, mime };
        } catch (e) { return null; }
      }));
      for (const r of results) {
        if (!r) continue;
        exampleParts.push({ text: `[예시] 아래 이미지는 "${r.ex.label}" 카드입니다. 특징: ${r.ex.desc}` });
        exampleParts.push({ inlineData: { mimeType: r.mime, data: r.b64 } });
      }
    } catch (e) {
      console.error('예시 이미지 로드 실패 (무시):', e);
    }
  }

  if (!base64 || !prompt) {
    return res.status(400).json({ error: 'base64와 prompt가 필요합니다.' });
  }

  const CARD_TYPE_GUIDE = `
카드 종류 판별 기준 (순서대로 확인):
1. 이름 바로 위에 V1/V2/V3 표시 → 라이브
2. ALL STAR 텍스트 (NANUM/DREAM 로고도 함께) → 올스타
   ※ 주의: 별점(★★★★★)은 ALL STAR가 아님. 반드시 영문 텍스트여야 함
3. 이름 위 왼쪽에 빨간 필기체 Sign 텍스트 → 시그니처
4. 우측 상단 팀 로고 근방 흰색 배경 → 국가대표
5. 이름 하단 노란/황금색 장식 → 골든글러브
6. 이름에 연도 숫자('18, '24 등)가 없음 → 임팩트
7. 위 모두 해당 없음 → 인식실패

반드시 JSON 배열만 출력하세요. 마크다운 코드블록(` + '```' + `) 없이 순수 JSON만 출력.
`;

  const contents = [
    {
      role: 'user',
      parts: [
        ...exampleParts,
        { text: CARD_TYPE_GUIDE },
        { text: prompt },
        { inlineData: { mimeType: mediaType || 'image/jpeg', data: base64 } },
      ]
    }
  ];

  /* ── 모델 순서대로 시도 ── */
  let lastError = '';
  for (const model of MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const geminiRes = await callGemini(GEMINI_API_KEY, model, contents);

        if (geminiRes.status === 503) {
          lastError = `${model} 503 (과부하)`;
          if (attempt === 0) { await new Promise(r => setTimeout(r, 1500)); continue; }
          break;
        }
        if (geminiRes.status === 429) { lastError = `${model} 429 (한도초과)`; break; }
        if (geminiRes.status === 404) { lastError = `${model} 404 (모델없음)`; break; }

        if (!geminiRes.ok) {
          const errText = await geminiRes.text();
          lastError = `${model} ${geminiRes.status}: ${errText.slice(0, 200)}`;
          break;
        }

        /* ── 성공 ── */
        const geminiData = await geminiRes.json();
        /* thinking 모델 대응: parts 중 text 타입만 추출 */
        const parts = geminiData?.candidates?.[0]?.content?.parts || [];
        let text = '';
        for (const part of parts) {
          if (part.text && !part.thought) { text = part.text; break; }
        }
        if (!text) text = parts[parts.length - 1]?.text || '';

        /* 마크다운 코드블록 제거 */
        text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();

        /* 사용량 업데이트 */
        if (supabaseUrl && supabaseKey) {
          try {
            await fetch(`${supabaseUrl}/rest/v1/scan_usage`, {
              method: 'POST',
              headers: {
                apikey: supabaseKey,
                Authorization: `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
                Prefer: 'resolution=merge-duplicates',
              },
              body: JSON.stringify({ date: today, count: 1 }),
            });
            if (userId) {
              const uRes = await fetch(
                `${supabaseUrl}/rest/v1/scan_usage_user?date=eq.${today}&user_id=eq.${userId}`,
                { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
              );
              const uData = await uRes.json();
              const prev = (Array.isArray(uData) && uData[0]) ? uData[0].count : 0;
              await fetch(`${supabaseUrl}/rest/v1/scan_usage_user`, {
                method: 'POST',
                headers: {
                  apikey: supabaseKey,
                  Authorization: `Bearer ${supabaseKey}`,
                  'Content-Type': 'application/json',
                  Prefer: 'resolution=merge-duplicates',
                },
                body: JSON.stringify({ user_id: userId, date: today, count: prev + 1 }),
              });
            }
          } catch (e) {
            console.error('사용량 업데이트 오류:', e);
          }
        }

        console.log(`성공: ${model} (attempt ${attempt + 1})`);
        return res.status(200).json({ text });

      } catch (err) {
        lastError = `${model} 예외: ${err.message}`;
        break;
      }
    }
  }

  return res.status(503).json({
    error: `모든 모델 응답 실패. 잠시 후 다시 시도해주세요. (${lastError})`
  });
}
