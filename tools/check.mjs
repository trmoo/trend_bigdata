/**
 * 파일 사이의 어긋남을 미리 잡는다 — `npm run check`
 * © 2026 티쳐무 · 모든 권리 보유 (학교 수업 목적으로만 이용)
 *
 * Apps Script 는 화면 스크립트에 오류가 있어도 **흰 화면**만 뜨고 아무 말도 하지 않는다.
 * 그래서 배포 전에 여기서 미리 대조한다.
 *   ① 문법          — Code.gs 와 각 HTML 안 <script> 가 파싱되는가
 *   ② 항목 이름      — Code.gs FIELDS ↔ activity.html data-key ↔ js.html TEXT_KEYS
 *   ③ 화면 아이디    — 스크립트가 부르는 $('...') 가 화면에 있는가
 *   ④ 서버 함수      — 화면이 call('...') 하는 함수가 Code.gs 에 있는가
 *   ⑤ include        — index.html 이 부르는 조각 파일이 있는가
 *   ⑥ CSS 클래스     — 화면이 쓰는 class 가 css.html 에 있는가 (경고)
 *   ⑦ 저작권 표시    — 넣기로 한 곳에 다 들어 있는가
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.join(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'src');
const read = (p) => fs.readFileSync(path.join(SRC, p), 'utf8');

const errors = [];
const warns = [];
const oks = [];
const bad = (m) => errors.push(m);
const warn = (m) => warns.push(m);
const ok = (m) => oks.push(m);

const VIEWS = ['index.html', 'concept.html', 'activity.html', 'js.html', 'css.html'];
const code = read('Code.gs');
const files = {};
VIEWS.forEach(f => { files[f] = read(f); });

/** <script> 안의 내용만 뽑는다 */
function scripts(html) {
  const out = [];
  const re = /<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html))) out.push(m[1]);
  return out;
}

/* ─────────────── ① 문법 ─────────────── */
try {
  new vm.Script(code, { filename: 'Code.gs' });
  ok('Code.gs 문법');
} catch (e) {
  bad(`Code.gs 문법 오류 — ${e.message}`);
}
VIEWS.forEach(f => {
  scripts(files[f]).forEach((s, i) => {
    try {
      new vm.Script(s, { filename: `${f}#script${i + 1}` });
      ok(`${f} 스크립트 문법`);
    } catch (e) {
      bad(`${f} 스크립트 문법 오류 — ${e.message}`);
    }
  });
});

/* ─────────────── ② 항목 이름 대조 ─────────────── */
function fieldsOfCode() {
  const block = /var FIELDS = \[([\s\S]*?)\n\];/.exec(code);
  if (!block) { bad('Code.gs 에서 FIELDS 를 찾지 못했다'); return []; }
  return [...block[1].matchAll(/key:\s*'([^']+)'/g)].map(m => m[1]);
}
function arrayInJs(name) {
  const m = new RegExp(`var ${name} = \\[([^\\]]*)\\]`).exec(files['js.html']);
  if (!m) { bad(`js.html 에서 ${name} 를 찾지 못했다`); return []; }
  return [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]);
}

const FIELD_KEYS = fieldsOfCode();
const TEXT_KEYS = arrayInJs('TEXT_KEYS');
const NEED = arrayInJs('NEED');
const dataKeys = [...files['activity.html'].matchAll(/data-key="([^"]+)"/g)].map(m => m[1]);

[...TEXT_KEYS, ...NEED].forEach(k => {
  if (k === 'period' || k === 'tool') return;   /* 화면에서 조립하는 항목 */
  if (!FIELD_KEYS.includes(k)) bad(`js.html 의 항목 「${k}」 가 Code.gs FIELDS 에 없다`);
});
if (!FIELD_KEYS.includes('period')) bad('Code.gs FIELDS 에 period 가 없다');
if (!FIELD_KEYS.includes('tool')) bad('Code.gs FIELDS 에 tool 이 없다');

dataKeys.forEach(k => {
  if (!TEXT_KEYS.includes(k)) bad(`activity.html 의 data-key="${k}" 가 js.html TEXT_KEYS 에 없다`);
});
TEXT_KEYS.forEach(k => {
  if (!dataKeys.includes(k)) warn(`js.html TEXT_KEYS 의 「${k}」 에 짝이 되는 data-key 가 화면에 없다`);
});
if (!errors.length) ok(`항목 이름 대조 (FIELDS ${FIELD_KEYS.length}개 · 글 항목 ${TEXT_KEYS.length}개 · 필수 ${NEED.length}개)`);

/* 필수 항목 이름표(NAME)가 빠짐없이 있는가 — 없으면 진행률 안내가 undefined 로 나온다 */
const nameMap = /var NAME = \{([\s\S]*?)\};/.exec(files['js.html']);
if (nameMap) {
  NEED.forEach(k => {
    if (!new RegExp(`(^|[\\s{,])${k}\\s*:`).test(nameMap[1])) bad(`진행률 이름표에 「${k}」 가 없다`);
  });
  ok('진행률 이름표');
} else {
  warn('js.html 의 진행률 이름표(NAME)를 찾지 못했다');
}

/* ─────────────── ③ 화면 아이디 ─────────────── */
const ids = new Set();
['index.html', 'concept.html', 'activity.html'].forEach(f => {
  [...files[f].matchAll(/\sid="([^"]+)"/g)].forEach(m => ids.add(m[1]));
});
const wanted = new Set();
VIEWS.forEach(f => {
  scripts(files[f]).forEach(s => {
    [...s.matchAll(/\$\('([A-Za-z][\w-]*)'\)/g)].forEach(m => wanted.add(m[1]));
    [...s.matchAll(/getElementById\('([A-Za-z][\w-]*)'\)/g)].forEach(m => wanted.add(m[1]));
  });
});
let idBad = 0;
wanted.forEach(id => {
  if (!ids.has(id)) { bad(`스크립트가 부르는 아이디 「${id}」 가 화면에 없다`); idBad++; }
});
if (!idBad) ok(`화면 아이디 ${wanted.size}개 모두 있다`);

/* 글 항목 · 글자 수 표시 짝 맞추기 */
TEXT_KEYS.forEach(k => {
  if (!ids.has('f_' + k)) bad(`글 항목 「${k}」 의 입력칸 id="f_${k}" 가 없다`);
});
const countList = /function countAll\(\)\s*\{\s*\[([^\]]*)\]/.exec(files['js.html']);
if (countList) {
  [...countList[1].matchAll(/'([^']+)'/g)].map(m => m[1]).forEach(k => {
    if (!ids.has('c_' + k)) bad(`글자 수를 세는 「${k}」 의 표시칸 id="c_${k}" 가 없다`);
  });
  ok('글자 수 표시칸');
}
[...files['activity.html'].matchAll(/\sid="c_([^"]+)"/g)].map(m => m[1]).forEach(k => {
  if (!ids.has('f_' + k)) bad(`글자 수 표시칸 c_${k} 에 짝이 되는 입력칸이 없다`);
});

/* ─────────────── ④ 서버 함수 ─────────────── */
const serverFns = new Set([...code.matchAll(/^function\s+([A-Za-z_$][\w$]*)/gm)].map(m => m[1]));
const called = new Set([...files['js.html'].matchAll(/call\('([A-Za-z_$][\w$]*)'/g)].map(m => m[1]));
let fnBad = 0;
called.forEach(fn => {
  if (!serverFns.has(fn)) { bad(`화면이 부르는 서버 함수 「${fn}」 가 Code.gs 에 없다`); fnBad++; }
  if (/_$/.test(fn)) { bad(`「${fn}」 는 밑줄로 끝나 화면에서 부를 수 없다 (Apps Script 규칙)`); fnBad++; }
});
if (!fnBad) ok(`서버 함수 ${called.size}개 모두 있다 (${[...called].join(', ')})`);

/* 메뉴에 적어 둔 함수 이름도 실제로 있는가 */
[...code.matchAll(/addItem\('[^']*',\s*'([^']+)'\)/g)].map(m => m[1]).forEach(fn => {
  if (!serverFns.has(fn)) bad(`교사 메뉴가 가리키는 함수 「${fn}」 가 없다`);
});
ok('교사 메뉴 함수');

/* ─────────────── ⑤ include ─────────────── */
[...files['index.html'].matchAll(/include\('([^']+)'\)/g)].map(m => m[1]).forEach(name => {
  if (!fs.existsSync(path.join(SRC, name + '.html'))) bad(`index.html 이 부르는 include('${name}') 파일이 없다`);
});
if (!/createTemplateFromFile\('index'\)/.test(code)) {
  bad('Code.gs 의 doGet 이 createTemplateFromFile 을 쓰지 않으면 include 가 펼쳐지지 않는다');
}
ok('include 대조');

/* ─────────────── ⑥ CSS 클래스 (경고) ─────────────── */
const cssClasses = new Set([...files['css.html'].matchAll(/\.([a-zA-Z][\w-]*)/g)].map(m => m[1]));
const used = new Set();
/* 마크업의 class= 만 본다. <script> 안은 문자열을 이어 붙이므로 따로 다룬다 */
const noScript = (html) => html.replace(/<script(?:\s[^>]*)?>[\s\S]*?<\/script>/g, '');
['index.html', 'concept.html', 'activity.html'].forEach(f => {
  [...noScript(files[f]).matchAll(/\sclass="([^"]+)"/g)].forEach(m => m[1].split(/\s+/).forEach(c => c && used.add(c)));
});
/* 스크립트가 붙이는 클래스도 모은다.
   문자열을 이어 붙여 만드는 경우(`'... class="bar' + (…)`)는 조각만 잡히므로 건너뛴다 */
const plain = (s) => /^[\w\s-]+$/.test(s);
VIEWS.forEach(f => {
  scripts(files[f]).forEach(s => {
    [...s.matchAll(/class(?:Name)?\s*=\s*'([^']+)'/g)].forEach(m => {
      if (plain(m[1])) m[1].split(/\s+/).forEach(c => c && used.add(c));
    });
    [...s.matchAll(/classList\.(?:add|remove|toggle)\('([^']+)'/g)].forEach(m => {
      if (plain(m[1])) used.add(m[1]);
    });
  });
});
const missing = [...used].filter(c => !cssClasses.has(c));
if (missing.length) warn(`css.html 에 없는 클래스: ${missing.join(', ')}`);
else ok(`CSS 클래스 ${used.size}개 모두 정의되어 있다`);

/* ─────────────── ⑦ 저작권 표시 ─────────────── */
const MUST = {
  'LICENSE': ROOT, 'README.md': ROOT, 'CLAUDE.md': ROOT,
  'src/Code.gs': ROOT, 'src/index.html': ROOT, 'src/css.html': ROOT,
  'src/concept.html': ROOT, 'src/activity.html': ROOT, 'src/js.html': ROOT
};
Object.keys(MUST).forEach(rel => {
  const p = path.join(MUST[rel], rel);
  // CLAUDE.md 는 깃허브에 올리지 않으므로 받은 저장소에는 없을 수 있다
  if (!fs.existsSync(p)) { if (rel !== 'CLAUDE.md') bad(`${rel} 파일이 없다`); return; }
  if (!fs.readFileSync(p, 'utf8').includes('티쳐무')) bad(`${rel} 에 저작권 표시(티쳐무)가 없다`);
});
/* 학생이 보는 화면 아래 푸터에도 있어야 한다 */
if (!/class="foot"[\s\S]{0,400}티쳐무/.test(files['index.html'])) {
  bad('index.html 화면 푸터에 저작권 표시가 없다');
}
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
if (pkg.license !== 'UNLICENSED') bad(`package.json 의 license 가 UNLICENSED 가 아니다 (지금: ${pkg.license})`);
ok('저작권 표시 (파일 9곳 · 화면 푸터 · package.json)');

/* ─────────────── 결과 ─────────────── */
console.log('');
oks.forEach(m => console.log(`  ✔ ${m}`));
warns.forEach(m => console.log(`  ⚠ ${m}`));
errors.forEach(m => console.log(`  ✗ ${m}`));
console.log('\n' + '='.repeat(52));
console.log(errors.length
  ? `점검 실패 — 고칠 것 ${errors.length}가지 (경고 ${warns.length})`
  : `점검 통과 — ${oks.length}가지 확인 (경고 ${warns.length})`);
console.log('='.repeat(52));
process.exit(errors.length ? 1 : 0);
