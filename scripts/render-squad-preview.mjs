// PLAYWRIGHT_MODULE로 별도 설치 경로를 지정할 수 있다. PNG와 브라우저 검증을 함께 만든다.
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { SQUAD_THEMES } from '../src/squad-share.js';
const packagePath = process.env.PLAYWRIGHT_MODULE || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const { chromium } = await import(pathToFileURL(packagePath).href);
const out = path.resolve(import.meta.dirname, '../artifacts/squad-templates');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: {width: 1240, height: 1000}, acceptDownloads: true });
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(path.join(out,'index.html')).href);
  await page.waitForFunction(()=>window.squadReady===true);
  const uniquePhotos=await page.evaluate(()=>new Set(Object.values(window.squadPreview.samples).flatMap(d=>[...d.bats,...d.pits]).map(p=>p.photoUrl).filter(Boolean)).size);
  assert.ok(uniquePhotos>50, '예시 사진 ID 충돌 또는 누락');
  const manifest=[];
  for (const [team,t] of Object.entries(SQUAD_THEMES)) {
    const result=await page.evaluate(async team=>{
      const api=window.squadPreview;
      const prepared=await api.prepareSquadData(api.samples[team]);
      const labels=[];const original=CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText=function(...args){labels.push(args[0]);return original.apply(this,args)};
      let cv;try{cv=api.drawSquadCanvas(prepared)}finally{CanvasRenderingContext2D.prototype.fillText=original}
      return {png:cv.toDataURL('image/png').split(',')[1],width:cv.width,height:cv.height,labels};
    },team);
    assert.equal(result.width,1080);assert.equal(result.height,1920);
    assert.equal(result.labels.filter(v=>/^(SP[1-5]|RP[1-6]|CP|CF|RF|LF|[123]B|SS|C|DH)$/.test(v)).length>=21,true);
    assert.ok(result.labels.includes('9,154.6'));
    await fs.writeFile(path.join(out,t.id+'.png'),Buffer.from(result.png,'base64'));
    manifest.push({team,file:t.id+'.png',size:[result.width,result.height]});
  }
  await page.reload();await page.waitForFunction(()=>window.squadReady);
  await page.selectOption('#team','삼성');await page.fill('#score','12345.6');await page.fill('#playerName','아주긴이름테스트선수');
  await page.uncheck('#photos');await page.waitForFunction(()=>document.querySelector('#status').textContent==='미리보기 준비 완료');
  const [download]=await Promise.all([page.waitForEvent('download'),page.click('#save')]);
  assert.match(download.suggestedFilename(),/^스쿼드_삼성_.*\.png$/);
  await download.saveAs(path.join(out,'qa-long-name.png'));
  await page.setViewportSize({width:375,height:850});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false);
  await page.screenshot({path:path.join(out,'qa-mobile.png'),fullPage:true});
  assert.deepEqual(errors,[]);
  const tiles=[];
  for(let i=0;i<manifest.length;i++)tiles.push({input:await sharp(path.join(out,manifest[i].file)).resize(320,569).toBuffer(),left:20+(i%5)*340,top:20+Math.floor(i/5)*589});
  await sharp({create:{width:1720,height:1198,channels:3,background:'#e6e5dd'}}).composite(tiles).png().toFile(path.join(out,'all-teams.png'));
  await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2));
  console.log('PASS: 10 PNG exports, all positions, live fields, failed/missing photo layout, long names, download, mobile 375px, no browser errors.');
} finally {await browser.close()}
