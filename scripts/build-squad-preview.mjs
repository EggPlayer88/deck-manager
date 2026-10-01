// 실행: node scripts/build-squad-preview.mjs
// 로컬 원본 사진과 in100 예시를 사용해 인터넷 없이 열리는 미리보기를 만든다.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { SQUAD_THEMES } from '../src/squad-share.js';
import { parsePhotoName, walkImages } from './photo-lib.mjs';

const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'artifacts/squad-templates');
fs.mkdirSync(out, { recursive: true });
const photoRoot = path.join(root, '선수사진');
const files = walkImages(fs, path, photoRoot).map(p => path.join(photoRoot, p));
const current = path.join(photoRoot, '_현재 웹앱 적용중');
if (fs.existsSync(current)) for (const f of fs.readdirSync(current)) if (/\.png$/i.test(f)) files.push(path.join(current, f));
const photos = new Map();
for (const file of files.sort()) {
  const p = parsePhotoName(path.basename(file)), key = `${p.name}|${p.team}`;
  if (!photos.has(key)) photos.set(key, file);
}
const encoded = new Map();
async function photo(p) {
  const file = photos.get(`${p.name}|${p.team}`) || photos.get(`${p.name}|`);
  if (!file) return '';
  if (!encoded.has(file)) {
    // 비동기 압축 전에 ID를 예약해야 동시에 불러오는 선수끼리 ID가 겹치지 않는다.
    const entry = { id: 'photo' + encoded.size, data: '' };
    encoded.set(file, entry);
    entry.ready = sharp(file).resize({ width: 340, height: 510, fit: 'inside', withoutEnlargement: true }).webp({quality:84,alphaQuality:95}).toBuffer().then(buffer => { entry.data = 'data:image/webp;base64,' + buffer.toString('base64'); });
  }
  const entry = encoded.get(file); await entry.ready; return entry.id;
}
const in100 = JSON.parse(fs.readFileSync(path.join(root, 'data/in100.json'), 'utf8'));
const samples = {};
for (const team of Object.keys(SQUAD_THEMES)) {
  const slots = in100['팀'][team]['유저'][0]['자리'];
  const players = await Promise.all(Object.entries(slots).filter(([, p]) => p && p['이름']).map(async ([slot, p]) => {
    const row = { slot, name: p['이름'], ct: p['종류'], team: p['팀'] };
    return { ...row, photoUrl: await photo(row) };
  }));
  samples[team] = { team, total: 9154.6, batYear: '2024', pitYear: '2023',
    sub: '템플릿 미리보기 · 점수·연도는 표시 예시',
    bats: players.filter(p => !/^(SP|RP|CP)/.test(p.slot)), pits: players.filter(p => /^(SP|RP|CP)/.test(p.slot)) };
}
const renderer = fs.readFileSync(path.join(root, 'src/squad-share.js'), 'utf8').replace(/^export /gm, '');
const html = `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>스쿼드 공유 · 10개 구단 스티커북</title>
<style>*{box-sizing:border-box}body{margin:0;background:#efeee8;color:#243b32;font-family:'Malgun Gothic',sans-serif}main{max-width:1240px;margin:auto;padding:36px 24px}h1{font-size:29px;margin:0 0 10px}p{line-height:1.7;color:#58665f}.layout{display:grid;grid-template-columns:330px minmax(0,1fr);gap:36px;align-items:start}.settings{background:#faf9f3;padding:24px;border-radius:12px}label{display:block;font-size:14px;margin:16px 0 6px}input,select,button{font:inherit;padding:11px;border:1px solid #bcc8bd;border-radius:6px;background:white;max-width:100%;width:100%;color:#243b32}button{background:#164e3e;color:white;border:0;cursor:pointer;margin-top:18px;font-weight:bold}input[type=checkbox]{width:auto}.years{display:grid;grid-template-columns:1fr 1fr;gap:12px}.preview{min-width:0}.preview canvas{width:100%;height:auto;display:block;box-shadow:0 9px 35px #243a3020}small{display:block;color:#647267;font-size:12px;line-height:1.8;margin-top:18px}#status{min-height:24px;font-size:13px;color:#60776b}.teams{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:16px;margin-top:40px}.teams a{color:inherit;text-decoration:none;font-weight:bold}.teams img{width:100%;display:block;margin-bottom:8px}.notes{margin:32px 0;border-top:1px solid #c6cec5;padding-top:16px}@media(max-width:760px){main{padding:22px 14px}.layout{grid-template-columns:1fr;gap:20px}.teams{grid-template-columns:repeat(2,minmax(0,1fr))}.settings{padding:18px}h1{font-size:24px}}</style>
<main><h1>스쿼드 공유 · 스티커북 컬렉션</h1><p>선택한 구단, 선수, 점수로 완성되는 10개 팀 템플릿.</p><div class="layout"><section class="settings" aria-label="미리보기 설정">
<label for="team">구단 테마</label><select id="team">${Object.entries(SQUAD_THEMES).map(([k,v]) => `<option value="${k}">${k} · ${v.english}</option>`).join('')}</select>
<label for="score">덱 점수</label><input id="score" type="number" step="0.1" value="9154.6"><div class="years"><div><label for="batYear">타자 연도</label><input id="batYear" value="2024" maxlength="16"></div><div><label for="pitYear">투수 연도</label><input id="pitYear" value="2023" maxlength="16"></div></div>
<label for="playerName">중견수 이름 · 변경 테스트</label><input id="playerName" value="" maxlength="30">
<label><input id="photos" type="checkbox" checked> 선수 사진 표시</label><button id="save" type="button">현재 스쿼드 PNG 저장</button><div id="status" role="status" aria-live="polite"></div>
<small>1080 × 1920 PNG<br>구단별 예시 로스터: 로컬 in100 자료.<br>점수와 연도는 표시 예시이며, 실제 공유 시 연구 결과가 들어갑니다. 사진이 없는 선수와 빈 자리는 포지션으로 표시합니다. NC 예시에는 원자료에 없는 투수 자리를 비워 두었습니다.</small></section><div class="preview" id="preview" aria-label="스쿼드 이미지 미리보기"></div></div>
<div class="notes"><strong>10개 구단 전체 보기</strong><p>이미지를 누르면 원본 PNG를 열 수 있습니다.</p></div><div class="teams">${Object.entries(SQUAD_THEMES).map(([k,v])=>`<a href="${v.id}.png"><img src="${v.id}.png" alt="${k} 스쿼드 템플릿" loading="lazy">${v.english}</a>`).join('')}</div></main>
<script type="module">${renderer}
const samples = ${JSON.stringify(samples).replace(/</g, '\\u003c')};
const assets = ${JSON.stringify(Object.fromEntries([...encoded.values()].map(p=>[p.id,p.data])))};
for(const d of Object.values(samples))for(const p of [...d.bats,...d.pits])p.photoUrl=assets[p.photoUrl] || '';
const byId = id => document.getElementById(id); let generation = 0;
function readData() { const d = structuredClone(samples[byId('team').value]); d.total=byId('score').value; d.batYear=byId('batYear').value; d.pitYear=byId('pitYear').value; const cf=d.bats.find(p=>p.slot==='CF'); if(cf) cf.name=byId('playerName').value; if(!byId('photos').checked) [...d.bats,...d.pits].forEach(p=>p.photoUrl=''); return d; }
function setName(){byId('playerName').value=samples[byId('team').value].bats.find(p=>p.slot==='CF')?.name || '';}
async function render(){const token=++generation;byId('status').textContent='이미지 만드는 중…';const d=await prepareSquadData(readData());if(token!==generation)return;const canvas=drawSquadCanvas(d);canvas.setAttribute('role','img');canvas.setAttribute('aria-label',d.team+' 스쿼드 공유 이미지');byId('preview').replaceChildren(canvas);byId('status').textContent='미리보기 준비 완료';}
byId('team').addEventListener('change',()=>{setName();render()});
for(const id of ['score','batYear','pitYear','playerName','photos'])byId(id).addEventListener('input',render);
byId('save').addEventListener('click',async()=>{byId('save').disabled=true;try{await downloadSquadImage(readData());byId('status').textContent='PNG 저장을 시작했습니다';}catch(e){byId('status').textContent=e.message;}finally{byId('save').disabled=false;}});
window.squadPreview={samples,drawSquadCanvas,prepareSquadData,downloadSquadImage,readData};setName();await render();window.squadReady=true;
</script></html>`;
fs.writeFileSync(path.join(out, 'index.html'), html);
fs.copyFileSync(path.join(root, 'src/squad-share.js'), path.join(out, 'squad-share.js'));
console.log(`Preview: ${out}; ${Object.keys(samples).length} teams; ${encoded.size} original portraits.`);
