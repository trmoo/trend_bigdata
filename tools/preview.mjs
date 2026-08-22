/**
 * 배포하지 않고 브라우저에서 확인하는 미리보기 파일을 만든다 — `npm run preview`
 *   실행하면 dist/preview.html 이 생긴다. 더블클릭하면 그대로 동작한다.
 * © 2026 티쳐무 · 모든 권리 보유 (학교 수업 목적으로만 이용)
 *
 * 진짜 `src/Code.gs` 를 그대로 싣고, 스프레드시트·드라이브만 메모리로 흉내 내어
 * `google.script.run` 을 이어 준다.
 * ⚠️ 미리보기 전용이다. 이 파일은 Apps Script 프로젝트에 넣지 않는다.
 *    (비밀번호 뭉개기도 여기서는 흉내다 — 화면 흐름을 보기 위한 것)
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'src');
const read = (f) => fs.readFileSync(path.join(SRC, f), 'utf8');
const tool = (f) => fs.readFileSync(path.join(ROOT, 'tools', f), 'utf8');

/* ── 가짜 Apps Script 를 창(window)에 풀어 놓는다 ── */
const FAKE = `
<script>
/* ===== 미리보기용 가짜 Apps Script (실제 앱에는 들어가지 않습니다) ===== */
${tool('fake-gas.js')}
var __gas = makeFakeGas({ bookName: '빅데이터 학습지 - 제출 자료(미리보기)' });
for (var __k in __gas) { window[__k] = __gas[__k]; }
</script>
`;

/* ── 미리보기 자료를 넣고 google.script.run 을 잇는다 ── */
const BRIDGE = `
<script>
(function () {
  /* 선 그래프처럼 보이는 그림을 하나 만들어 「이미 올려 둔 캡처」로 쓴다 */
  function fakeShot() {
    var c = document.createElement('canvas');
    c.width = 640; c.height = 300;
    var g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, 640, 300);
    g.strokeStyle = '#dde'; g.beginPath();
    for (var x = 40; x < 620; x += 58) { g.moveTo(x, 20); g.lineTo(x, 270); }
    g.stroke();
    [['#2b5bd7', 0], ['#c33232', 40], ['#1a8f52', 80]].forEach(function (s, k) {
      g.strokeStyle = s[0]; g.lineWidth = 3; g.beginPath();
      for (var i = 0; i <= 30; i++) {
        var vx = 40 + i * 19;
        var vy = 250 - (Math.sin(i / 4 + k) * 40 + i * (4 - k) + s[1]);
        if (i === 0) g.moveTo(vx, vy); else g.lineTo(vx, vy);
      }
      g.stroke();
    });
    g.fillStyle = '#333'; g.font = 'bold 16px sans-serif';
    g.fillText('미리보기용 예시 그래프 (검색어 관심도)', 40, 290);
    return c.toDataURL('image/png');
  }

  /* 10101 김민준 — 쓰던 내용 + 올려 둔 캡처 한 장 */
  var a = signIn('10101', '김민준', 'pw1234', 'pw1234');
  var shot = uploadImage(a.token, '10101', '미리보기-캡처.png', fakeShot());
  saveDraft(a.token, '10101', {
    tool: '구글 트렌드',
    topic: '생성형 인공지능 기술의 관심도 변화',
    kw1: 'AI', kw2: 'ChatGPT', kw3: '자율주행자동차', kw4: '',
    period: '2022-01-01 ~ 현재', region: '대한민국', device: '모바일',
    summary: '미리보기로 미리 채워 둔 내용이다. 세 키워드가 2022년 말부터 함께 올라갔다.',
    q1: '2023년 2월 무렵이 가장 높았다.', q2: '', q3: '',
    future: '',
    images: [{ fileId: shot.fileId, url: shot.url }]
  });

  /* 10102 이서연 — 선생님이 비밀번호를 초기화한 상태 */
  signIn('10102', '이서연', 'pw1234', 'pw1234');
  var acc = ensureAccountSheet_(getBook_());
  acc.getRange(findRowIn_(acc, 1, '10102'), 3).setValue('');

  /* google.script.run 흉내 — 손잡이를 달면 새 실행기를 돌려준다 (실제와 같은 방식) */
  function runner(ok, err) {
    return new Proxy({}, {
      get: function (t, name) {
        if (typeof name !== 'string') return undefined;
        if (name === 'withSuccessHandler') return function (f) { return runner(f, err); };
        if (name === 'withFailureHandler') return function (f) { return runner(ok, f); };
        return function () {
          var args = Array.prototype.slice.call(arguments);
          setTimeout(function () {
            try {
              var fn = window[name];
              if (typeof fn !== 'function') throw new Error('그런 서버 함수가 없습니다: ' + name);
              ok(fn.apply(null, args));
            } catch (e) { err(e); }
          }, 150);   /* 실제 서버처럼 살짝 늦게 */
        };
      }
    });
  }
  window.google = { script: { run: runner(function () { }, function (e) { console.error(e); }) } };

  /* 시트를 눈으로 확인할 수 있게 도우미를 하나 둔다 (콘솔에서 sheetDump() ) */
  window.sheetDump = function (name) {
    var sh = getBook_().getSheetByName(name || '제출 현황');
    if (!sh) { console.log('그런 시트가 없다'); return; }
    var rows = [];
    for (var r = 1; r <= sh.getLastRow(); r++) {
      var line = [];
      for (var c = 1; c <= sh.getLastColumn(); c++) line.push(sh.getRange(r, c).getValue());
      rows.push(line);
    }
    console.table(rows);
    return rows;
  };
  console.log('%c미리보기 준비 완료', 'font-weight:bold');
  console.log('학생 로그인 — 10101 (비번 pw1234, 쓰던 내용 있음) / 10102 (선생님이 초기화) / 10103 (처음)');
  console.log('시트 내용 보기 — sheetDump("제출 현황") · sheetDump("작성 중(임시 저장)")');
})();
</script>
`;

let html = read('index.html');

/* <?!= include('X'); ?> 를 실제 내용으로 바꾼다 */
html = html.replace(/<\?!=\s*include\('([^']+)'\);?\s*\?>/g, (m, name) => {
  if (name === 'js') return FAKE + '\n<script>\n' + read('Code.gs') + '\n</script>\n' + BRIDGE + '\n' + read('js.html');
  return read(name + '.html');
});

/* 실제 앱에서는 doGet() 이 붙여 주는 것 — 미리보기에서도 같게 맞춘다 */
html = html.replace('<base target="_top">',
  '<meta name="viewport" content="width=device-width, initial-scale=1">');
html = html.replace('<!DOCTYPE html>',
  '<!DOCTYPE html>\n<!-- ⚠️ 이 파일은 npm run preview 가 만든 미리보기다. Apps Script 에 넣지 말 것. -->');

fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
const out = path.join(ROOT, 'dist', 'preview.html');
fs.writeFileSync(out, html, 'utf8');

console.log('■ dist/preview.html (' + Math.round(Buffer.byteLength(html, 'utf8') / 1024) + 'KB)');
console.log('  브라우저로 그냥 열면 됩니다.');
console.log('  학생 로그인 — 10101 (비번 pw1234) / 10102 (초기화된 상태) / 10103 (처음 오는 학생)');
