/*! 검색어 트렌드 분석하기 — 체험 페이지 만들기 (깃허브 Pages 에 올리는 공개 체험판)
 * © 2026 티쳐무 · 모든 권리 보유
 *
 *   node tools/site.mjs   →   dist/site/index.html (안내) · student.html
 *
 * 미리보기와 같은 방법으로 만든다 — 서버도 시트도 없이, 브라우저 안의 가짜 시트 위에서 진짜 Code.gs 가 돈다.
 * 체험하는 사람이 적은 글은 그 브라우저 안에만 있고 창을 닫으면 사라진다(어디에도 보내지 않는다).
 * 포털(comedu_portal)의 「테스트 페이지」 단추가 이 주소를 가리킨다.
 */

/* 시트 메뉴만 있는 앱(선생님 웹 화면이 없는 앱)에 붙이는 공통 안내 */
const SHEET_NOTE = (menuWhat) => '선생님 기능(' + menuWhat + ')은 <b>사본 시트의 메뉴</b>에 있어 체험판에는 없습니다. ' +
  '개발자 도구(F12) 콘솔에서 <code>sheetDump(\'제출 현황\')</code> 을 치면 학생 답이 시트에 어떻게 쌓이는지 볼 수 있습니다.';
const STUDENT_BAND = (acct) => '지어낸 반 친구들과 함께 미리 써 보는 화면입니다. 적은 내용은 이 브라우저 안의 가짜 시트에만 있어 ' +
  '어디에도 보내지 않으며, 새로 고치면 사라집니다. ' + acct + ' · <a href="./">체험 안내</a>';

const APP = {
  name: '검색어 트렌드 분석하기', emoji: '🔍', repo: 'trend_bigdata', color: '#1f6f5c', color2: '#2d8c74',
  desc: '빅데이터의 개념과 특징을 익히고 검색어 트렌드를 분석하는 활동지 — 학생 화면을 미리 써 보는 체험 페이지',
  intro: '『데이터 과학』 빅데이터 학습지를 옮긴 활동지입니다. <b>탭① 빅데이터의 개념과 특징</b>은 로그인 없이 바로 풀고 채점되며, ' +
    '<b>탭② 검색어 트렌드 분석하기</b>는 로그인해 1~4단계를 채우고 시각화 캡처 그림을 붙여 제출합니다.',
  build: [['node', 'tools/preview.mjs']],
  from: 'dist/preview.html',
  fake: ['makeFakeGas'],
  minKB: 100,
  pages: [{
    file: 'student.html',
    badge: true,
    band: '적은 내용은 이 브라우저 안의 가짜 시트에만 있고 새로 고치면 사라집니다 · 학생 10101 / pw1234',
    card: {
      title: '🧑‍🎓 학생 화면', go: '학생 화면 열기',
      who: '탭①에서 개념을 익히고, 탭②에서 검색어 트렌드를 분석해 제출합니다.',
      acct: '학번 <b class="big">10101</b> · 비밀번호 <b class="big">pw1234</b><br><span style="color:var(--sub)">쓰던 내용과 캡처 한 장이 있는 학생입니다.</span>',
      more: ['<code>10103</code> — 처음 오는 학생 (이름 · 비밀번호를 새로 정합니다)',
        '<code>10102</code> — 선생님이 비밀번호를 초기화한 학생 (이름 이서연)'],
      try: ['탭① — 단위 저울(B~EB), 초당 발생 슬라이더와 누적 카운터, 분류 카드 12장, 확인 문제 점수판',
        '탭② — 키워드 2~4개와 검색 조건을 정하고 Q1 · Q2 · Q3 · 미래 예측을 씁니다.',
        '캡처 그림 — 화면을 캡처(⊞Win+Shift+S)한 뒤 Ctrl+V 로 바로 붙여 넣을 수 있습니다.'],
    },
  }],
  notes: [SHEET_NOTE('현황 요약 · 안 낸 학생 · 고른 줄의 이미지 보기 · 제출 마감 · 비밀번호 초기화'),
    '진짜 구글 드라이브가 없어 붙인 그림은 이 브라우저 안에만 남습니다.'],
};


/* ───────────────────────── 아래는 앱마다 똑같은 부분 ─────────────────────────
 * 체험 페이지 만드는 순서
 *   ① APP.build 의 명령을 차례로 돌린다 (미리보기 · 빌드)
 *   ② APP.from(미리보기 파일)을 읽어 「미리보기 모드」 띠를 「체험 페이지」 띠로 바꾸고 탭 제목 앞에 [체험] 을 붙인다
 *   ③ APP.pages 마다 dist/site/<file> 로 쓴다 (선생님 화면은 page 값을 박아 둔다)
 *   ④ 안내 첫 화면 dist/site/index.html 을 만든다
 *   ⑤ 점검 — 하나라도 어긋나면 멈춘다(배포하지 않는다)
 */
import { execFileSync, execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = join(ROOT, 'dist', 'site');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ① 미리보기 · 빌드 */
for (const [cmd, ...args] of APP.build) {
  /* 윈도우의 npm 은 .cmd 라 셸로만 부를 수 있다 — 명령이 이 파일에 박힌 글자뿐이라 한 줄로 이어 넘긴다 */
  if (process.platform === 'win32' && cmd === 'npm') execSync(['npm', ...args].join(' '), { cwd: ROOT, stdio: 'inherit' });
  else execFileSync(cmd, args, { cwd: ROOT, stdio: 'inherit' });
}

/* ② 미리보기 파일을 체험판으로 */
const BAND = '<b>체험 페이지</b> — ';
function toDemo(html, page) {
  const band = BAND + page.band;
  if (page.badge) {
    /* 1280×720 무대 앱 — 화면을 가리지 않게 왼쪽 아래 작은 딱지로 */
    html = html.replace('</body>', () => '<div style="position:fixed;left:8px;bottom:8px;z-index:2147483000;max-width:min(560px,70vw);' +
      'background:rgba(255,246,224,.94);border:2px solid #d9a12a;border-radius:10px;padding:4px 10px;' +
      'font:12px/1.5 sans-serif;color:#8a5a00;pointer-events:none">' + band + '</div>\n</body>');
  } else if (/<b>미리보기 모드<\/b>/.test(html)) {
    html = html.replace(/<b>미리보기 모드<\/b>[\s\S]*?<\/div>/, () => band + '</div>');
  } else {
    html = html.replace('</body>', () => '<div style="position:fixed;left:0;right:0;bottom:0;z-index:2147483000;' +
      'background:#fff6e0;border-top:2px solid #d9a12a;padding:5px 12px;font:13px/1.5 sans-serif;color:#8a5a00;' +
      'text-align:center;pointer-events:none">' + band + '</div>\n</body>');
  }
  if (/<title>/.test(html)) html = html.replace(/<title>/, () => '<title>[체험] ');
  else html = html.replace(/<head[^>]*>/i, (m) => m + '\n<title>[체험] ' + esc(APP.name) + '</title>');
  if (page.edit) html = page.edit(html);
  return html;
}

rmSync(SITE, { recursive: true, force: true });
mkdirSync(SITE, { recursive: true });
const src = APP.from ? readFileSync(join(ROOT, APP.from), 'utf8') : '';
const sizes = {};
for (const page of APP.pages) {
  const html = page.make ? page.make() : toDemo(src, page);
  writeFileSync(join(SITE, page.file), html, 'utf8');
  sizes[page.file] = Math.round(Buffer.byteLength(html, 'utf8') / 1024);
}

/* ④ 안내 첫 화면 */
const li = (arr) => arr.map((x) => '<li>' + x + '</li>').join('\n          ');
const cards = APP.pages.filter((p) => p.card).map((p) => `
      <section class="card">
        <h2>${p.card.title}</h2>
        <p class="who">${p.card.who}</p>
        <a class="go${p.card.teacher ? ' teacher' : ''}" href="${p.file}">${p.card.go} →</a>
        <div class="acct">${p.card.acct}</div>
        ${p.card.more ? '<h3>다른 계정</h3>\n        <ul>\n          ' + li(p.card.more) + '\n        </ul>' : ''}
        <h3>해 볼 것</h3>
        <ul>
          ${li(p.card.try)}
        </ul>
      </section>`).join('\n');
const guide = `<!doctype html>
<!--
  ${APP.name} — 체험 페이지 안내
  © 2026 티쳐무 · 모든 권리 보유 (오픈소스 라이선스 없음)
  깃허브 Pages 첫 화면. tools/site.mjs 가 만든다.
  체험 화면은 서버 없이 브라우저 안의 가짜 시트에서 진짜 서버 코드(Code.gs)를 돌린다.
-->
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(APP.name)} — 체험 페이지</title>
  <meta name="description" content="${esc(APP.desc)}">
  <style>
    :root{
      --bg:#f6f3ee; --card:#fff; --ink:#1d2430; --sub:#5b6474; --line:#e3ddd3;
      --brand:${APP.color || '#2c4a80'}; --brand2:${APP.color2 || '#3d63a8'}; --accent:#e8684a;
      --warn:#8a5a00; --warnbg:#fff5df; --infobg:#eaf0fa;
      --radius:18px; --shadow:0 2px 12px rgba(40,30,20,.08);
    }
    *{box-sizing:border-box}
    body{margin:0; background:var(--bg); color:var(--ink);
      font:18px/1.75 "Pretendard","Noto Sans KR","Malgun Gothic","맑은 고딕",-apple-system,sans-serif;
      -webkit-text-size-adjust:100%}
    a{color:var(--brand)}
    .wrap{max-width:1080px; margin:0 auto; padding:0 16px}
    header{background:linear-gradient(135deg,var(--brand),var(--brand2)); color:#fff; padding:40px 0 34px}
    header h1{margin:0; font-size:clamp(28px,4.6vw,42px); font-weight:900; letter-spacing:-.02em}
    header .tag{display:inline-block; background:rgba(255,255,255,.18); border-radius:999px; padding:2px 14px;
      font-size:15px; font-weight:700; margin-bottom:10px}
    header p{margin:12px 0 0; font-size:clamp(17px,2.2vw,20px); opacity:.95; max-width:820px}
    main{padding:28px 0 12px}
    .cards{display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr)); gap:20px}
    .card{background:var(--card); border:1px solid var(--line); border-radius:var(--radius); box-shadow:var(--shadow);
      padding:24px 24px 22px; display:flex; flex-direction:column}
    .card h2{margin:0 0 6px; font-size:26px; font-weight:900}
    .card .who{color:var(--sub); margin:0 0 14px}
    .go{display:block; text-align:center; text-decoration:none; font-weight:900; font-size:22px; color:#fff;
      background:var(--brand); border-radius:14px; padding:16px 18px; margin:4px 0 16px}
    .go:hover,.go:focus-visible{background:var(--brand2)}
    .go.teacher{background:var(--accent)}
    .go.teacher:hover,.go.teacher:focus-visible{background:#d4553a}
    .acct{background:var(--infobg); border-radius:12px; padding:12px 16px; margin:0 0 14px}
    .acct b.big{font-size:22px; letter-spacing:.02em}
    code{font:inherit; font-weight:800; background:#fff; border:1px solid var(--line); border-radius:7px; padding:0 7px}
    h3{margin:6px 0 4px; font-size:19px}
    ul{margin:4px 0 0; padding-left:1.25em}
    li{margin:3px 0}
    .note{background:var(--warnbg); border:1px solid #ecd39b; color:#5b3c00; border-radius:var(--radius);
      padding:20px 24px; margin:24px 0 0}
    .note h2{margin:0 0 6px; font-size:22px; color:var(--warn)}
    .use{background:var(--card); border:1px solid var(--line); border-radius:var(--radius); padding:20px 24px; margin:20px 0 0}
    .use h2{margin:0 0 6px; font-size:22px}
    footer{color:var(--sub); font-size:15px; text-align:center; padding:26px 16px 36px}
    @media (max-width:560px){ body{font-size:17px} .card{padding:20px 18px} .go{font-size:20px} }
  </style>
</head>
<body>
  <header>
    <div class="wrap">
      <span class="tag">체험 페이지</span>
      <h1>${APP.emoji} ${esc(APP.name)}</h1>
      <p>${APP.intro}</p>
    </div>
  </header>

  <main class="wrap">
    <div class="cards">${cards}
    </div>

    <section class="note">
      <h2>⚠ 알아 두세요</h2>
      <ul>
        <li>체험 화면은 <b>서버 없이 이 브라우저 안의 가짜 시트</b>에서 진짜 서버 코드를 돌립니다. 적은 내용은 어디에도 보내지 않으며,
          <b>새로 고치거나 창을 닫으면 처음 상태</b>로 돌아갑니다.</li>
        ${li(APP.notes)}
        <li>진짜 학생 이름 · 학번은 넣지 마세요. 화면에 나오는 학생은 모두 지어낸 사람입니다.</li>
      </ul>
    </section>

    <section class="use">
      <h2>🏫 우리 반에서 쓰려면</h2>
      <p style="margin:0">구글 스프레드시트에 붙여 쓰는 앱스 스크립트 웹앱이라, 학생의 기록은 선생님의 구글 드라이브에만 쌓입니다.
        <a href="https://trmoo.github.io/comedu_portal/">티쳐무의 정보 수업 도구함</a>에서 「교사용 사본 만들기」를 누르면
        배포까지 따라 하는 안내가 나옵니다. 코드는 <a href="https://github.com/trmoo/${APP.repo}">저장소</a>에 있습니다.</p>
    </section>
  </main>

  <footer>
    © 2026 티쳐무 · 모든 권리 보유 · 학교 수업 목적으로만 이용해 주세요 ·
    <a href="https://github.com/trmoo/${APP.repo}">저장소</a>
  </footer>
</body>
</html>
`;
writeFileSync(join(SITE, 'index.html'), guide, 'utf8');

/* ⑤ 점검 */
const bad = [];
const files = readdirSync(SITE);
for (const f of files) {
  const html = readFileSync(join(SITE, f), 'utf8');
  if (!html.includes('© 2026 티쳐무')) bad.push(f + ' 에 저작권 표시(© 2026 티쳐무)가 없습니다.');
  for (const m of html.matchAll(/href="([^"#:?]+\.html)(?:[?#][^"]*)?"/g)) {
    if (!files.includes(m[1])) bad.push(f + ' 의 링크 ' + m[1] + ' 가 가리키는 파일이 없습니다.');
  }
}
for (const page of APP.pages) {
  const html = readFileSync(join(SITE, page.file), 'utf8');
  if (!html.includes(BAND)) bad.push(page.file + ' 에 체험 페이지 안내 띠가 없습니다.');
  if (html.includes('<b>미리보기 모드</b>')) bad.push(page.file + ' 에 「미리보기 모드」 띠가 남았습니다.');
  if (!APP.fake.some((m) => html.includes(m))) bad.push(page.file + ' 에 가짜 서버가 없습니다 — 진짜 서버로 보내는 화면이 되면 안 됩니다.');
  if (sizes[page.file] < APP.minKB) bad.push(page.file + ' 가 너무 작습니다(' + sizes[page.file] + 'KB) — 빌드가 덜 된 것 같습니다.');
}
const idx = readFileSync(join(SITE, 'index.html'), 'utf8');
for (const page of APP.pages.filter((p) => p.card)) {
  if (!idx.includes('href="' + page.file + '"')) bad.push('index.html 에 ' + page.file + ' 링크가 없습니다.');
}
if (bad.length) {
  console.error('체험 페이지 점검 실패:\n  - ' + bad.join('\n  - '));
  process.exit(1);
}
console.log('체험 페이지를 만들었습니다 → dist/site/ (안내 · ' +
  Object.entries(sizes).map(([f, kb]) => f + ' ' + kb + 'KB').join(' · ') + ')');
