#!/usr/bin/env node
/* 선수사진/ 폴더의 사진을 Supabase Storage 에 올리고 매니페스트를 갱신한다.

   사용법:
     npm run photos              선수사진/ 전체 동기화 (바뀐 것만 올림)
     npm run photos -- --dry     올리지 않고 무엇을 할지만 출력
     npm run photos -- --force   캐시 무시하고 전부 다시 올림
     npm run photos -- --manifest-only   업로드 없이 매니페스트만 다시 만듦
                                         (웹 UI 로 올린 뒤 목록을 맞출 때)

   선수사진/ 아래는 폴더를 얼마든지 만들어 넣어도 된다. 하위 폴더를 전부 훑는다.
     선수사진/
       20260914 작업분/
         이승엽1.jpg
         김도영.jpg
       기아 추가분/
         나성범.jpg
   폴더 이름은 정리용일 뿐 매칭에 쓰이지 않는다. 매칭에 쓰이는 건 파일명뿐이다.

   파일명 규칙: 선수이름[숫자].확장자
     이승엽.jpg / 이승엽1.jpg / 이승엽2.jpg  → 모두 "이승엽" 의 사진
     끝의 숫자는 같은 선수의 여러 장을 구분하는 용도다. */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';
import {
  PHOTO_BUCKET, MANIFEST_FILE, encodeName,
  listAllFiles, buildManifest, walkImages, TEAMS,
} from './photo-lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PHOTO_DIR = path.join(ROOT, '선수사진');
const CACHE_FILE = path.join(PHOTO_DIR, '.sync-cache.json');


/* 카드 사진 규격 — 긴 변 기준 600×900 안에 들어가도록 축소만 한다. 자르지 않는다.

   선수 사진은 배경을 딴(누끼) 투명 PNG 이고 대부분 이미 2:3 으로 맞춰져 있다.
   구도는 작업자가 정한 것이므로 스크립트가 다시 자르면 팔다리가 잘려 나간다.
   카드 쪽 CSS 가 objectFit:cover 로 알아서 채우고, 어디를 보여줄지는 위치값이 정한다.

   WebP 로 내보내는 이유: JPEG 는 알파 채널이 없어서 투명 배경이 검게 칠해진다.
   카드의 그라데이션 배경이 비쳐 보이는 게 이 사진들의 스타일이라 알파를 지켜야 한다.
   PNG 도 알파를 지키지만 같은 화질에서 WebP 의 5배쯤 무겁다. */
const OUT_W = 600;
const OUT_H = 900;
const QUALITY = 85;

const args = process.argv.slice(2);
const FORCE = args.includes('--force');
const DRY = args.includes('--dry');
const MANIFEST_ONLY = args.includes('--manifest-only');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function die(msg) { console.error('\n✖ ' + msg + '\n'); process.exit(1); }

if (!SUPABASE_URL || !SERVICE_KEY) {
  die(`Supabase 접속 정보가 없습니다.
  프로젝트 루트의 .env 파일에 아래 두 줄을 채워 주세요:

    SUPABASE_URL=https://xxxxxxxx.supabase.co
    SUPABASE_SERVICE_ROLE_KEY=eyJ...

  Supabase 대시보드 → Project Settings → API 에서 가져올 수 있습니다.
  service_role 키는 모든 권한을 가지므로 .env 는 절대 커밋하지 마세요 (.gitignore 에 등록됨).`);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

/* ── 로컬 캐시: 원본 파일 해시를 기억해 안 바뀐 사진은 건너뛴다 ── */
function loadCache() {
  try { return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')); } catch { return {}; }
}
function saveCache(c) {
  if (DRY) return;
  fs.mkdirSync(PHOTO_DIR, { recursive: true });
  fs.writeFileSync(CACHE_FILE, JSON.stringify(c, null, 2));
}
function hashFile(p) {
  return crypto.createHash('sha1').update(fs.readFileSync(p)).digest('hex');
}

/* ── 사진 한 장 처리 ──
   자르지 않고 600×900 안에 들어가게 축소만 하고, 알파를 지킨 WebP 로 내보낸다.
   구도는 작업자가 정한 것이므로 건드리지 않는다 — 카드에 보이는 구간이 고정이라
   (2:3 기준 세로 6%~75%) 그 안에 들어오도록 만들어 오면 된다. */
async function processImage(filePath) {
  const { data, info } = await sharp(filePath)
    .rotate()                       /* EXIF 회전 반영 */
    .resize(OUT_W, OUT_H, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: QUALITY, alphaQuality: 100 })
    .toBuffer({ resolveWithObject: true });
  return { buffer: data, bytes: data.length, w: info.width, h: info.height };
}

async function main() {
  let uploaded = 0, skipped = 0, failed = 0;

  if (!MANIFEST_ONLY) {
    if (!fs.existsSync(PHOTO_DIR)) {
      fs.mkdirSync(PHOTO_DIR, { recursive: true });
      console.log('선수사진/ 폴더를 만들었습니다. 여기에 사진을 넣고 다시 실행하세요.');
    }
    const files = walkImages(fs, path, PHOTO_DIR).sort((a, b) => a.localeCompare(b, 'ko'));

    /* 서로 다른 폴더에 같은 파일명이 있으면 하나가 다른 하나를 덮어쓴다. 미리 알려 준다. */
    const byBase = {};
    for (const rel of files) {
      const b = path.basename(rel).replace(/\.[^.]+$/, '');
      (byBase[b] = byBase[b] || []).push(rel);
    }
    const dups = Object.keys(byBase).filter((b) => byBase[b].length > 1);
    if (dups.length) {
      console.log('\n⚠ 파일명이 겹칩니다 — 마지막 것만 남습니다:');
      dups.forEach((b) => console.log(`   ${b}: ${byBase[b].join(' , ')}`));
    }

    /* 팀 이름 오타 — '_' 뒤가 도감의 팀이 아니면 통째로 이름의 일부가 되어
       어떤 카드에도 안 붙는다. 막지는 않고 알려만 준다 (작업 중에 멈추면 답답하다) */
    const badTeam = [];
    for (const rel of files) {
      const base = path.basename(rel).replace(/\.[^.]+$/, '');
      const cut = base.lastIndexOf('_');
      if (cut <= 0) continue;
      const tail = base.slice(cut + 1).replace(/\d+$/, '');
      if (TEAMS.indexOf(tail) < 0) badTeam.push({ rel, tail });
    }
    if (badTeam.length) {
      console.log('\n⚠ 팀 이름을 못 알아봤습니다 — 이 사진들은 어떤 카드에도 안 붙습니다:');
      badTeam.forEach((b) => console.log(`   ${b.rel}   ('${b.tail}' 은 팀이 아님)`));
      console.log(`   쓸 수 있는 팀: ${TEAMS.join(' · ')}`);
      console.log('   (그래도 계속 올립니다)');
    }

    console.log(`\n선수사진/ 에서 ${files.length}장 발견\n`);

    const cache = loadCache();
    for (const rel of files) {
      const src = path.join(PHOTO_DIR, rel);
      const base = path.basename(rel).replace(/\.[^.]+$/, '');
      const storageName = encodeName(base) + '.webp';
      const hash = hashFile(src);

      if (!FORCE && cache[rel] && cache[rel].hash === hash) { skipped++; continue; }

      try {
        const { buffer, bytes, w, h } = await processImage(src);
        const srcKB = fs.statSync(src).size / 1024;
        const detail = `${w}x${h}  ${(srcKB / 1024).toFixed(1)}MB → ${(bytes / 1024).toFixed(0)}KB`;
        if (DRY) {
          console.log(`  [dry] ${rel}  ${detail}`);
        } else {
          const { error } = await supabase.storage.from(PHOTO_BUCKET)
            .upload(storageName, buffer, { upsert: true, contentType: 'image/webp', cacheControl: '31536000' });
          if (error) throw new Error(error.message);
          cache[rel] = { hash, storageName };
          console.log(`  ↑ ${rel}  ${detail}`);
        }
        uploaded++;
      } catch (e) {
        console.error(`  ✖ ${rel}: ${e.message}`);
        failed++;
      }
    }
    saveCache(cache);
  }

  /* ── 매니페스트 재생성 ──
     폴더에 없고 웹 UI 로만 올린 사진도 버킷 목록에서 함께 잡힌다. */
  const bucketFiles = await listAllFiles(supabase);
  const manifest = buildManifest(bucketFiles);
  const playerCount = Object.keys(manifest.photos).length;

  if (DRY) {
    console.log(`\n[dry] 매니페스트: 선수 ${playerCount}명 / 사진 ${bucketFiles.length}장`);
  } else {
    const body = Buffer.from(JSON.stringify(manifest), 'utf8');
    const { error } = await supabase.storage.from(PHOTO_BUCKET)
      .upload(MANIFEST_FILE, body, { upsert: true, contentType: 'application/json', cacheControl: '60' });
    if (error) die(`매니페스트 업로드 실패: ${error.message}`);
    console.log(`\n매니페스트 갱신: 선수 ${playerCount}명 / 사진 ${bucketFiles.length}장`);
  }

  console.log(`\n완료 — 업로드 ${uploaded} · 건너뜀 ${skipped}${failed ? ` · 실패 ${failed}` : ''}\n`);
  if (failed) process.exit(1);
}


main().catch(e => die(e.stack || e.message));
