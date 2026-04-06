/**
 * /api/scan.js — Vercel 서버리스 함수
 * Claude Sonnet 4.6 비전 API + Few-shot 카드 종류 판별
 * 예시 이미지는 Supabase Storage URL로 참조
 *
 * Vercel 환경변수:
 *   ANTHROPIC_API_KEY=sk-ant-...
 *   VITE_SUPABASE_URL=https://xxxx.supabase.co
 *   VITE_SUPABASE_ANON_KEY=eyJ...
 *
 * 일일 한도: 500회
 */

const DAILY_LIMIT = 500;
const CLAUDE_MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 4096;

/* 예시 이미지를 Supabase Storage에서 base64로 가져오기 */
async function fetchImageAsBase64(url) {
  const res = await fetch(url);
  const arrayBuffer = await res.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return Buffer.from(binary, 'binary').toString('base64');
}

async function buildFewShotMessages(supabaseUrl) {
  const base = `${supabaseUrl}/storage/v1/object/public/card-examples`;
  const examples = [
    { file: 'impact.jpg',    desc: '위 카드는 임팩트 카드입니다. 핵심 특징: 이름 뒤에 연도 숫자가 없습니다(예: 박한이, 이용규처럼 이름만). 이름 위에 포지션/역할 텍스트(중견수, 안방마님 등)가 있습니다.' },
    { file: 'live.jpg',      desc: '위 카드는 라이브 카드입니다. 핵심 특징: 이름 뒤에 연도가 있고(예: 데이비슨B\'24), V1/V2/V3 뱃지가 표시됩니다. 배경색은 다양합니다.' },
    { file: 'allstar.jpg',   desc: '위 카드는 올스타 카드입니다. 핵심 특징: NANUM 또는 DREAM 로고가 카드에 표시됩니다. 이름 뒤에 연도가 있습니다(예: 폰세\'25). 배경색은 다양합니다.' },
    { file: 'golden.jpg',    desc: '위 카드는 골든글러브 카드입니다. 핵심 특징: 황금/황토색 배경, 이름 하단 황금 장식. 이름 뒤에 연도가 있습니다(예: 이승엽\'99).' },
    { file: 'signature.jpg', desc: '위 카드는 시그니처 카드입니다. 핵심 특징: 진분홍/마젠타 배경, 이름 위 왼쪽 빨간 필기체 Sig 글자. 이름 뒤에 연도가 있습니다(예: 로사리오\'17).' },
    { file: 'national.jpg',  desc: '위 카드는 국가대표 카드입니다. 핵심 특징: 파란/남색 배경. 이름 위 텍스트는 선수마다 다릅니다. 이름 뒤에 연도가 있습니다(예: 최형우\'17).' },
  ];

  const content = [];
  for (const ex of examples) {
    try {
      const b64 = await fetchImageAsBase64(`${base}/${ex.file}`);
      content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } });
      content.push({ type: 'text', text: ex.desc });
    } catch (e) {
      console.warn(`예시 이미지 로드 실패: ${ex.file}`, e.message);
    }
  }
  return content;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다.' });

  const { base64, mediaType, prompt } = req.body || {};
  if (!base64 || !prompt) return res.status(400).json({ error: '요청 형식 오류: base64, prompt 필요' });

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

  /* ── 일일 사용량 체크 ── */
  if (supabaseUrl && supabaseKey) {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const getRes = await fetch(`${supabaseUrl}/rest/v1/scan_usage?date=eq.${today}`, {
        headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` },
      });
      const rows = await getRes.json();
      const currentCount = rows && rows[0] ? rows[0].count : 0;
      if (currentCount >= DAILY_LIMIT) {
        return res.status(429).json({ error: `오늘 일일 한도(${DAILY_LIMIT}회)를 초과했습니다. 내일 다시 시도해주세요.` });
      }
      await fetch(`${supabaseUrl}/rest/v1/scan_usage`, {
        method: 'POST',
        headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates' },
        body: JSON.stringify({ date: today, count: currentCount + 1 }),
      });
    } catch (e) { console.warn('사용량 추적 오류:', e.message); }
  }

  /* ── Few-shot 예시 이미지 로드 ── */
  let fewShotContent = [];
  if (supabaseUrl) {
    try {
      fewShotContent = await buildFewShotMessages(supabaseUrl);
    } catch (e) {
      console.warn('Few-shot 이미지 로드 실패, 예시 없이 진행:', e.message);
    }
  }

  /* ── Claude Vision API 호출 ── */
  try {
    const content = [
      ...fewShotContent,
      { type: 'image', source: { type: 'base64', media_type: mediaType || 'image/jpeg', data: base64 } },
      {
        type: 'text',
        text: fewShotContent.length > 0
          ? '위 6장의 예시 카드를 참고해서 아래 라인업 화면을 분석해주세요.\n\n' + prompt
          : prompt,
      },
    ];

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: MAX_TOKENS, messages: [{ role: 'user', content }] }),
    });

    if (!claudeRes.ok) {
      const errData = await claudeRes.json().catch(() => ({}));
      if (claudeRes.status === 429) return res.status(429).json({ error: '요청이 너무 많습니다. 1~2분 후 다시 시도해주세요.' });
      return res.status(claudeRes.status).json({ error: errData?.error?.message || `Claude API 오류 (${claudeRes.status})` });
    }

    const data = await claudeRes.json();
    const text = data?.content?.[0]?.text;
    if (!text) return res.status(500).json({ error: 'Claude 응답이 비어있습니다.' });

    const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    return res.status(200).json({ result: cleaned });

  } catch (err) {
    console.error('Claude API 오류:', err);
    return res.status(500).json({ error: err.message || '서버 오류' });
  }
}
