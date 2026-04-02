/**
 * /api/scan.js — Vercel 서버리스 함수
 * Gemini 1.5 Flash (무료 티어: 하루 1,500회 / 분당 15회)
 *
 * Vercel 환경변수 설정 필요:
 *   GEMINI_API_KEY=AIza...
 *
 * 요청: POST { base64: string, mediaType: string, prompt: string }
 * 응답: { result: string } | { error: string }
 */

export default async function handler(req, res) {
  /* CORS */
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY 환경변수가 설정되지 않았습니다.' });
  }

  const { base64, mediaType, prompt } = req.body || {};
  if (!base64 || !prompt) {
    return res.status(400).json({ error: '요청 형식 오류: base64, prompt 필요' });
  }

  /* Gemini 1.5 Flash — 무료 티어 사용 */
  const GEMINI_MODEL = 'gemini-2.0-flash';
  const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const body = {
    contents: [
      {
        parts: [
          {
            inline_data: {
              mime_type: mediaType || 'image/jpeg',
              data: base64,
            },
          },
          {
            text: prompt,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,      /* 낮을수록 일관된 출력 */
      maxOutputTokens: 2048,
      responseMimeType: 'text/plain',
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    ],
  };

  try {
    const geminiRes = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!geminiRes.ok) {
      const errData = await geminiRes.json().catch(() => ({}));

      /* 무료 티어 한도 초과 */
      if (geminiRes.status === 429) {
        return res.status(429).json({
          error: '오늘 무료 사용 한도(1,500회)를 초과했습니다. 내일 다시 시도해주세요.',
        });
      }

      return res.status(geminiRes.status).json({
        error: errData?.error?.message || `Gemini API 오류 (${geminiRes.status})`,
      });
    }

    const data = await geminiRes.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      return res.status(500).json({ error: 'Gemini 응답이 비어있습니다.' });
    }

    /* JSON 마크다운 펜스 제거 (```json ... ``` 형태로 올 수 있음) */
    const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

    return res.status(200).json({ result: cleaned });

  } catch (err) {
    console.error('Gemini API 오류:', err);
    return res.status(500).json({ error: err.message || '서버 오류' });
  }
}
