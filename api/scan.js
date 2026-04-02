/**
 * /api/scan.js — Vercel 서버리스 함수
 * Claude claude-sonnet-4-6 비전 API 사용
 *
 * Vercel 환경변수 설정 필요:
 *   ANTHROPIC_API_KEY=sk-ant-...
 *   VITE_SUPABASE_URL=https://xxxx.supabase.co
 *   VITE_SUPABASE_ANON_KEY=eyJ...
 *
 * 일일 한도: 500회 (Supabase scan_usage 테이블로 추적)
 *
 * 요청: POST { base64: string, mediaType: string, prompt: string }
 * 응답: { result: string } | { error: string }
 */

const DAILY_LIMIT = 500;
const CLAUDE_MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 4096;

export default async function handler(req, res) {
  /* CORS */
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다.' });
  }

  const { base64, mediaType, prompt } = req.body || {};
  if (!base64 || !prompt) {
    return res.status(400).json({ error: '요청 형식 오류: base64, prompt 필요' });
  }

  /* ── 일일 사용량 체크 (Supabase) ── */
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseKey) {
    try {
      const today = new Date().toISOString().slice(0, 10);

      const getRes = await fetch(`${supabaseUrl}/rest/v1/scan_usage?date=eq.${today}`, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const rows = await getRes.json();
      const currentCount = rows && rows[0] ? rows[0].count : 0;

      if (currentCount >= DAILY_LIMIT) {
        return res.status(429).json({
          error: `오늘 일일 한도(${DAILY_LIMIT}회)를 초과했습니다. 내일 다시 시도해주세요.`,
        });
      }

      await fetch(`${supabaseUrl}/rest/v1/scan_usage`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates',
        },
        body: JSON.stringify({ date: today, count: currentCount + 1 }),
      });
    } catch (e) {
      console.warn('사용량 추적 오류:', e.message);
    }
  }

  /* ── Claude Vision API 호출 ── */
  try {
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: MAX_TOKENS,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType || 'image/jpeg',
                  data: base64,
                },
              },
              {
                type: 'text',
                text: prompt,
              },
            ],
          },
        ],
      }),
    });

    if (!claudeRes.ok) {
      const errData = await claudeRes.json().catch(() => ({}));
      if (claudeRes.status === 429) {
        return res.status(429).json({
          error: '요청이 너무 많습니다. 1~2분 후 다시 시도해주세요.',
        });
      }
      return res.status(claudeRes.status).json({
        error: errData?.error?.message || `Claude API 오류 (${claudeRes.status})`,
      });
    }

    const data = await claudeRes.json();
    const text = data?.content?.[0]?.text;

    if (!text) {
      return res.status(500).json({ error: 'Claude 응답이 비어있습니다.' });
    }

    const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

    return res.status(200).json({ result: cleaned });

  } catch (err) {
    console.error('Claude API 오류:', err);
    return res.status(500).json({ error: err.message || '서버 오류' });
  }
}
