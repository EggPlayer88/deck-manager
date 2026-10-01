import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SQUAD_THEMES, getSquadTheme, squadPlayerName, formatSquadScore, prepareSquadData } from '../src/squad-share.js';

test('모든 구단 테마와 외부 팀 이름 호환', () => {
  assert.deepEqual(Object.keys(SQUAD_THEMES).sort(), ['기아','삼성','LG','두산','KT','SSG','롯데','한화','NC','키움'].sort());
  assert.equal(getSquadTheme('KIA').id, 'kia');
  assert.equal(getSquadTheme('kt').id, 'kt');
  assert.equal(getSquadTheme('NC DINOS').id, 'nc');
  assert.equal(getSquadTheme('알 수 없는 팀').id, 'neutral');
});
test('수치의 의미를 바꾸지 않고 천 단위와 소수 한 자리 표시', () => {
  assert.equal(formatSquadScore(9154.6), '9,154.6');
  assert.equal(formatSquadScore('8,999.6'), '8,999.6');
  assert.equal(formatSquadScore(0), '0.0');
  for (const v of [undefined, null, '', NaN, Infinity, '미계산']) assert.equal(formatSquadScore(v), '—');
  assert.equal(squadPlayerName('로하스B'), '로하스');
  assert.equal(squadPlayerName('장현식'), '장현식');
});
test('타 팀 선수의 사진을 덱 팀으로 바꾸지 않고, 실패와 시간 초과에도 계속 출력', async () => {
  let calls = 0;
  class FakeImage {
    set src(v) {
      calls++;
      assert.equal(this.crossOrigin, 'anonymous');
      if(v==='timeout')return;
      queueMicrotask(()=> v==='fail' ? this.onerror?.() : this.onload?.());
    }
  }
  const original = { team: '기아', total: '9154.6', bats: [{slot:'RF', name:'로하스B',team:'KT'}, {slot:'DH',name:'이승엽',team:'삼성'}], pits: [{slot:'CP',name:'오승환',team:'삼성'},{slot:'RP1',name:'정해영',team:'기아'}] };
  const seen=[];
  const result = await prepareSquadData(original, p=>{seen.push(p.team);return p.name==='정해영'?'timeout':p.name==='이승엽'?'fail':'shared';},{ImageClass:FakeImage,timeoutMs:15});
  assert.deepEqual(seen,['KT','삼성','삼성','기아']);
  assert.ok(result.bats[0].img); assert.equal(result.pits[0].img,result.bats[0].img);
  assert.equal(result.bats[1].img,null);assert.equal(result.pits[1].img,null);
  assert.equal(calls,3);assert.equal(original.bats[0].img,undefined);assert.equal(result.total,'9154.6');
});
