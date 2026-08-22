/**
 * 시험 도구 — `src/Code.gs` 를 가짜 Apps Script 위에서 그대로 돌린다.
 * © 2026 티쳐무 · 모든 권리 보유 (학교 수업 목적으로만 이용)
 *
 * 시트를 실제로 만들지 않고 로직만 검증한다. 해시는 node 의 진짜 SHA-256 을 쓴다.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';

const ROOT = path.join(import.meta.dirname, '..');

/** 가짜 환경 + Code.gs 를 한 상자에 담아 돌려준다 */
export function createEnv() {
  const ctx = vm.createContext({ console, module: { exports: {} } });

  vm.runInContext(fs.readFileSync(path.join(ROOT, 'tools', 'fake-gas.js'), 'utf8'), ctx,
    { filename: 'fake-gas.js' });

  ctx.__opts = {
    sha256: (s) => Array.from(crypto.createHash('sha256').update(String(s), 'utf8').digest()),
    b64encode: (bytes) => Buffer.from(bytes).toString('base64'),
    b64decode: (s) => Array.from(Buffer.from(String(s), 'base64'))
  };

  /* 서비스들을 전역에 풀어 놓는다 (Apps Script 에서 그렇게 보이므로) */
  vm.runInContext(
    'var __gas = makeFakeGas(__opts);' +
    'for (var k in __gas) { globalThis[k] = __gas[k]; }',
    ctx, { filename: 'bootstrap.js' });

  vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', 'Code.gs'), 'utf8'), ctx,
    { filename: 'Code.gs' });

  const gas = vm.runInContext('__gas', ctx);
  return { ctx, gas, book: gas._book, props: gas._props, ui: gas._ui, files: gas._files };
}

/** 학생 한 명을 만들어 로그인까지 해 둔다 */
export function login(ctx, id, name, pw) {
  const r = ctx.signIn(id, name || '홍길동', pw || 'pw1234', pw || 'pw1234');
  return r;
}

/** 활동지 한 벌 (필요한 항목이 다 찬 것) */
export function fullPayload(extra) {
  return Object.assign({
    tool: '구글 트렌드',
    topic: '생성형 인공지능 기술의 관심도 변화',
    kw1: 'AI', kw2: 'ChatGPT', kw3: '자율주행자동차', kw4: '',
    period: '2022-01-01 ~ 현재',
    region: '대한민국',
    device: '모바일',
    summary: '세 키워드 모두 2022년 말부터 가파르게 올라갔다.',
    q1: '2023년 2월 무렵이 가장 높았다.',
    q2: 'ChatGPT 가 공개되면서 관심이 쏠렸기 때문이다.',
    q3: 'ChatGPT 가 오를 때 AI 도 함께 올랐다.',
    future: '앞으로 일자리와 학습 방법이 달라질 것이다.',
    images: []
  }, extra || {});
}

/* ---------------- 아주 작은 시험 도구 ---------------- */

export function makeRunner(label) {
  const results = [];
  const api = {
    eq(desc, expected, actual) {
      results.push({ desc, pass: JSON.stringify(expected) === JSON.stringify(actual), expected, actual });
      return api;
    },
    truthy(desc, value) {
      results.push({ desc, pass: !!value, expected: '참', actual: String(value) });
      return api;
    },
    falsy(desc, value) {
      results.push({ desc, pass: !value, expected: '거짓', actual: String(value) });
      return api;
    },
    /** 함수가 오류를 내야 하는 경우. 오류 메시지에 want 가 들어 있으면 통과 */
    throws(desc, want, fn) {
      let msg = '';
      try { fn(); } catch (e) { msg = String(e && e.message || e); }
      const pass = !!msg && (!want || msg.indexOf(want) >= 0);
      results.push({ desc, pass, expected: want ? '오류에 «' + want + '»' : '오류가 남', actual: msg || '오류가 나지 않았다' });
      return api;
    },
    /** 함수가 오류 없이 끝나야 하는 경우 */
    noThrow(desc, fn) {
      let msg = '';
      try { fn(); } catch (e) { msg = String(e && e.message || e); }
      results.push({ desc, pass: !msg, expected: '오류 없음', actual: msg || '오류 없음' });
      return api;
    },
    report() {
      const fails = results.filter(r => !r.pass);
      console.log(`\n[${label}] ${results.length - fails.length}/${results.length} 통과`);
      fails.forEach(f => console.log(`  ✗ ${f.desc}\n      기대: ${JSON.stringify(f.expected)}\n      실제: ${JSON.stringify(f.actual)}`));
      return { total: results.length, failed: fails.length };
    }
  };
  return api;
}
