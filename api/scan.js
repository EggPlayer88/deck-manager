/**
 * /api/scan.js
 * - 스킬판독: gemini-2.5-flash-lite (단순 텍스트 OCR)
 * - 사진일괄: gemini-2.5-flash (카드 비전 판정, 고성능 필요)
 */

async function callGemini(apiKey, model, contents, maxTokens) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        generationConfig: {
          maxOutputTokens: maxTokens || 8192,
          temperature: 0,
          responseMimeType: 'application/json',
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

  const { base64, mediaType, prompt, userId, type } = req.body || {};
  const isSkill = type === 'skill';

  /* 타입별 설정 */
  const DAILY_LIMIT      = isSkill ? 10000 : 1000;
  const USER_DAILY_LIMIT = isSkill ? 50    : 10;
  const MODELS_TO_USE    = isSkill
    ? ['gemini-2.5-flash-lite']   /* 스킬판독: 텍스트 OCR */
    : ['gemini-2.5-flash'];       /* 사진일괄: 비전 판정 */
  const today = new Date().toISOString().slice(0, 10);

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

  if (!base64 || !prompt) {
    return res.status(400).json({ error: 'base64와 prompt가 필요합니다.' });
  }

  /* 스킬판독/사진일괄 모두 단일 턴 구조 (샘플 이미지 없음) */
  const contents = [
    {
      role: 'user',
      parts: [
        { text: prompt },
        { inlineData: { mimeType: mediaType || 'image/jpeg', data: base64 } },
      ]
    }
  ];

  /* ── 모델 순서대로 시도 ── */
  let lastError = '';
  for (const model of MODELS_TO_USE) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        /* 사진일괄: 9명+투수 JSON이 길어서 충분한 토큰 필요 */
        const maxTok = isSkill ? 4096 : 16384;
        const geminiRes = await callGemini(GEMINI_API_KEY, model, contents, maxTok);

        if (geminiRes.status === 503) {
          lastError = `${model} 503`;
          if (attempt === 0) { await new Promise(r => setTimeout(r, 2000)); continue; }
          break;
        }
        if (geminiRes.status === 429) { lastError = `${model} 429`; break; }
        if (geminiRes.status === 404) { lastError = `${model} 404`; break; }

        if (!geminiRes.ok) {
          const errText = await geminiRes.text();
          lastError = `${model} ${geminiRes.status}: ${errText.slice(0, 200)}`;
          break;
        }

        /* ── 성공 ── */
        const geminiData = await geminiRes.json();

        /* 응답 텍스트 추출 (thinking 모델 대응) */
        const parts = geminiData?.candidates?.[0]?.content?.parts || [];
        let text = '';
        for (const part of parts) {
          if (part.text && !part.thought) { text = part.text; break; }
        }
        if (!text) text = parts[parts.length - 1]?.text || '';

        /* 마크다운 코드블록 제거 */
        text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();

        /* JSON 배열/객체만 추출 */
        const arrStart = text.indexOf('[');
        const objStart = text.indexOf('{');
        const start = arrStart !== -1 && (objStart === -1 || arrStart < objStart) ? arrStart : objStart;
        const end = start === arrStart ? text.lastIndexOf(']') : text.lastIndexOf('}');
        if (start !== -1 && end !== -1 && end > start) {
          text = text.slice(start, end + 1);
        }

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

        console.log(`성공: ${model}`);
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
