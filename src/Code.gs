/**
 * ============================================================================
 *  빅데이터 학습실 — 데이터 과학 학습지 웹앱 (Google Apps Script)
 *
 *  탭① 빅데이터의 개념과 특징(3V) — 브라우저에서 혼자 익히고 바로 채점된다.
 *  탭② 검색어 트렌드 분석 활동지 — 학생이 채워 [제출하기] 를 누르면
 *       이 스크립트가 붙어 있는 구글 스프레드시트에 한 줄씩 기록된다.
 *       「시각화 결과 요약」의 캡처 이미지는 드라이브 폴더에 저장하고
 *       시트에는 주소를 남긴다.
 *
 *  설치 방법은 README.md 를 참고할 것.
 *
 *  © 2026 티쳐무 · 모든 권리 보유 (학교 수업 목적으로만 이용)
 * ============================================================================
 */

/* ---------------------------------------------------------------------------
 *  ① 설정 — 필요하면 이 부분만 고치면 된다
 * ------------------------------------------------------------------------- */

/** 제출한 답안이 쌓이는 시트 (학생 1명 = 1줄) */
var SHEET_NAME = '제출 현황';

/** 모든 제출을 원본 그대로 남겨 두는 백업 시트 (덮어쓰기로 사라지는 내용 보관용) */
var LOG_SHEET_NAME = '제출 기록(백업)';

/** 아직 제출하지 않고 쓰는 중인 내용을 담아 두는 시트 (학생 1명 = 1줄) */
var DRAFT_SHEET_NAME = '작성 중(임시 저장)';

/** 학번·비밀번호를 담는 시트. 비밀번호는 원문이 아니라 암호화한 값만 넣는다 */
var ACCOUNT_SHEET_NAME = '계정(비밀번호)';

/** 한 번 로그인하면 이만큼 유지된다 (시간). 지나면 다시 로그인해야 한다 */
var LOGIN_HOURS = 12;

/** 비밀번호 최소 길이 */
var PW_MIN = 4;

/**
 * 스프레드시트에 붙여서 만든 스크립트라면 빈칸('') 그대로 둔다.
 * 독립 스크립트로 만들었다면 시트 주소의 /d/ 와 /edit 사이 문자열(시트 ID)을 넣는다.
 */
var SPREADSHEET_ID = '';

/** 한 항목에 저장할 최대 글자 수 (너무 긴 글이 시트를 망가뜨리지 않도록 자른다) */
var MAX_LEN = 3000;

/** 학생 한 명이 올릴 수 있는 이미지 수 */
var MAX_IMAGES = 3;

/** 이미지 한 장의 최대 크기 (바이트). 화면에서 줄여 보내므로 넉넉하다 */
var MAX_IMAGE_BYTES = 6 * 1024 * 1024;

/** 한 시간에 올릴 수 있는 이미지 수 (실수로, 또는 장난으로 몰아 올리는 것을 막는다) */
var UPLOAD_PER_HOUR = 12;

/** 올릴 수 있는 이미지 형식 */
var IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];


/* ---------------------------------------------------------------------------
 *  ② 항목 정보 — activity.html 의 FIELD_KEYS 순서와 반드시 같아야 한다
 *
 *  count:true 인 항목만 「총 글자 수」에 더한다 (교사가 성실도를 한눈에 보도록).
 *  fill:true  인 항목은 학생이 보낸 값을 쓰지 않고 서버가 채운다.
 * ------------------------------------------------------------------------- */

var FIELDS = [
  { key: 'studentId',    title: '학번',                  w: 90,  count: false, fill: true },
  { key: 'name',         title: '이름',                  w: 90,  count: false, fill: true },
  { key: 'klass',        title: '반',                    w: 60,  count: false, fill: true },
  { key: 'tool',         title: '1. 분석 도구',          w: 150, count: false },
  { key: 'topic',        title: '1. 분석 주제',          w: 250, count: true  },
  { key: 'kw1',          title: '키워드 1',              w: 120, count: true  },
  { key: 'kw2',          title: '키워드 2',              w: 120, count: true  },
  { key: 'kw3',          title: '키워드 3',              w: 120, count: true  },
  { key: 'kw4',          title: '키워드 4',              w: 120, count: true  },
  { key: 'period',       title: '검색 기간',             w: 170, count: false },
  { key: 'region',       title: '지역',                  w: 100, count: false },
  { key: 'device',       title: '기기',                  w: 90,  count: false },
  { key: 'summary',      title: '2. 시각화 결과 요약',   w: 320, count: true  },
  { key: 'imageCount',   title: '이미지 수',             w: 80,  count: false, fill: true },
  { key: 'imageUrls',    title: '이미지 주소',           w: 260, count: false, fill: true },
  { key: 'q1',           title: 'Q1. 최고점 시기',       w: 230, count: true  },
  { key: 'q2',           title: 'Q2. 급증한 이유',       w: 300, count: true  },
  { key: 'q3',           title: 'Q3. 차이점·상관관계',   w: 300, count: true  },
  { key: 'future',       title: '4. 미래 예측(결론)',    w: 320, count: true  },
  { key: 'conceptScore', title: '탭① 개념 점수',         w: 110, count: false },
  { key: 'conceptRate',  title: '탭① 정답률(%)',         w: 100, count: false }
];

/** 제출 시트 머리글 = 제출 시각 + 항목 + 제출 횟수 + 총 글자 수 */
function header_() {
  var h = ['제출 시각'];
  FIELDS.forEach(function (f) { h.push(f.title); });
  return h.concat(['제출 횟수', '총 글자 수']);
}

/** 임시 저장 시트 머리글 = 마지막 저장 + 항목 + 총 글자 수 */
function draftHeader_() {
  var h = ['마지막 저장'];
  FIELDS.forEach(function (f) { h.push(f.title); });
  return h.concat(['총 글자 수']);
}

var COL_ID    = 2;                     /* 학번이 있는 열 (A=1, B=2) — 세 시트 모두 같다 */
var COL_COUNT = 1 + FIELDS.length + 1; /* 제출 시트의 「제출 횟수」 열 */


/* ---------------------------------------------------------------------------
 *  ③ 웹앱 — 학생이 주소로 들어오면 학습지 화면을 돌려준다
 * ------------------------------------------------------------------------- */

function doGet() {
  return HtmlService.createTemplateFromFile('index').evaluate()
    .setTitle('빅데이터 학습실 · 데이터 과학 학습지')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** index.html 이 조각 파일들을 불러 쓰기 위한 도우미 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/** 화면이 열릴 때 "지금 제출을 받는 중인지" 알려 준다 */
function getStatus() {
  return { accepting: isAccepting_(), maxImages: MAX_IMAGES };
}


/* ---------------------------------------------------------------------------
 *  ④ 본인 확인 (학번 + 비밀번호)
 *
 *  비밀번호는 원문을 어디에도 저장하지 않는다.
 *  「소금값 + 학번 + 비밀번호」를 SHA-256 으로 뭉갠 값만 시트에 남긴다.
 *  그래서 시트를 열어 봐도 학생 비밀번호를 알아낼 수 없다.
 *  (잊어버린 학생은 교사 메뉴의 「비밀번호 초기화」로 다시 정하게 한다.)
 * ------------------------------------------------------------------------- */

/** 1단계 — 학번만 받아 "처음인지 / 이미 있는지" 알려 준다 */
function checkStudent(studentId) {
  var id = clean_(studentId, 30);
  if (!id) throw new Error('학번을 적어 주세요.');

  var acc = ensureAccountSheet_(getBook_());
  var row = findRowIn_(acc, 1, id);
  if (row < 1) return { exists: false, klass: klassOf_(id) };

  var v = acc.getRange(row, 2, 1, 2).getValues()[0];
  return {
    exists: true,
    maskedName: maskName_(String(v[0] || '')),  /* 홍○동 처럼 가려서 본인 확인만 되게 */
    needNewPassword: !v[1],                    /* 선생님이 초기화했으면 새로 정하게 한다 */
    klass: klassOf_(id)
  };
}

/** 2단계 — 비밀번호를 확인하고, 저장해 둔 답안을 함께 돌려준다 */
function signIn(studentId, name, password, password2) {
  var id = clean_(studentId, 30);
  var nm = clean_(name, 30);
  var pw = String(password == null ? '' : password);

  if (!id) throw new Error('학번을 적어 주세요.');
  if (pw.length < PW_MIN) throw new Error('비밀번호는 ' + PW_MIN + '자 이상으로 정해 주세요.');

  var book = getBook_();
  var acc  = ensureAccountSheet_(book);
  var row  = findRowIn_(acc, 1, id);
  var salt = getSalt_();
  var isNew = false;

  if (row > 0) {
    var stored = String(acc.getRange(row, 3).getValue() || '');
    if (stored) {
      /* 이미 비밀번호가 있는 학생 — 맞는지 확인한다 */
      if (stored !== hash_(salt, id, pw)) {
        Utilities.sleep(700);   /* 마구 찍어 보는 것을 조금 늦춘다 */
        throw new Error('비밀번호가 다릅니다. 다시 확인해 주세요. (잊었다면 선생님께 초기화를 부탁하세요)');
      }
    } else {
      /* 선생님이 초기화한 상태 — 이번에 새로 정한다 */
      if (String(password2 == null ? '' : password2) !== pw) {
        throw new Error('새 비밀번호와 확인란이 서로 다릅니다.');
      }
      acc.getRange(row, 3).setValue(hash_(salt, id, pw));
      isNew = true;
    }
    nm = clean_(acc.getRange(row, 2).getDisplayValue(), 30) || nm;

  } else {
    /* 처음 오는 학생 — 계정을 만든다 */
    if (!nm) throw new Error('처음 접속이라 이름이 필요합니다.');
    if (String(password2 == null ? '' : password2) !== pw) {
      throw new Error('비밀번호와 확인란이 서로 다릅니다. 두 칸에 같게 적어 주세요.');
    }
    /* 새 줄을 만드는 동안에는 잠금을 건다 (두 학생이 동시에 가입해도 겹치지 않게) */
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(20000)) throw new Error('접속이 몰렸습니다. 잠시 뒤 다시 눌러 주세요.');
    try {
      row = findRowIn_(acc, 1, id);                 /* 기다리는 사이 생겼을 수도 있다 */
      if (row < 1) {
        row = acc.getLastRow() + 1;
        acc.getRange(row, 1, 1, 4).setValues([[id, nm, hash_(salt, id, pw), new Date()]]);
      }
    } finally { lock.releaseLock(); }
    isNew = true;
  }

  /* 접속 표를 새로 발급한다 (다른 사람이 학번만 알아도 남의 글을 못 고치게) */
  var token = Utilities.getUuid().replace(/-/g, '');
  acc.getRange(row, 5, 1, 3).setValues([[new Date(), token, new Date()]]);

  var saved = loadAnswers_(book, id);
  return {
    ok: true,
    studentId: id,
    name: nm,
    klass: klassOf_(id),
    token: token,
    isNew: isNew,
    answers: saved.answers,
    from: saved.from,          /* '작성 중이던 내용' | '제출한 내용' | '' */
    savedAt: saved.savedAt,
    submitted: saved.submitted,
    accepting: isAccepting_()
  };
}

/**
 * 새로고침했을 때 — 비밀번호를 다시 묻지 않고 접속 표로만 이어 간다.
 * 표가 만료됐으면 오류를 내보내 학생 화면이 로그인으로 돌아가게 한다.
 */
function resume(token, studentId) {
  var id   = clean_(studentId, 30);
  var book = getBook_();
  var acc  = ensureAccountSheet_(book);
  var row  = checkToken_(acc, id, token);

  var saved = loadAnswers_(book, id);
  return {
    ok: true,
    studentId: id,
    name: clean_(acc.getRange(row, 2).getDisplayValue(), 30),
    klass: klassOf_(id),
    token: token,
    answers: saved.answers,
    from: saved.from,
    savedAt: saved.savedAt,
    submitted: saved.submitted,
    accepting: isAccepting_()
  };
}

/** 접속 표가 맞는지 확인한다. 맞으면 계정 시트의 줄 번호를 돌려준다 */
function checkToken_(acc, studentId, token) {
  var row = findRowIn_(acc, 1, studentId);
  if (row < 1) throw new Error('로그인 정보를 찾지 못했습니다. 새로고침한 뒤 다시 로그인해 주세요.');

  var v = acc.getRange(row, 6, 1, 2).getValues()[0];
  if (!token || String(v[0] || '') !== String(token)) {
    throw new Error('로그인이 풀렸습니다. 새로고침한 뒤 다시 로그인해 주세요.');
  }
  /* 발급 시각을 읽을 수 없으면 안전한 쪽(다시 로그인)으로 처리한다 */
  var made = toDate_(v[1]);
  if (!made || (new Date() - made) > LOGIN_HOURS * 3600 * 1000) {
    throw new Error('로그인한 지 오래되었습니다. 새로고침한 뒤 다시 로그인해 주세요.');
  }
  return row;
}

/** 학생이 스스로 비밀번호를 바꾼다 */
function changePassword(token, studentId, currentPw, newPw) {
  var id  = clean_(studentId, 30);
  var acc = ensureAccountSheet_(getBook_());
  var row = checkToken_(acc, id, token);

  var np = String(newPw == null ? '' : newPw);
  if (np.length < PW_MIN) throw new Error('새 비밀번호는 ' + PW_MIN + '자 이상으로 정해 주세요.');

  var salt   = getSalt_();
  var stored = String(acc.getRange(row, 3).getValue() || '');
  if (stored && stored !== hash_(salt, id, String(currentPw == null ? '' : currentPw))) {
    Utilities.sleep(700);
    throw new Error('지금 쓰는 비밀번호가 맞지 않습니다.');
  }
  acc.getRange(row, 3).setValue(hash_(salt, id, np));
  return { ok: true };
}

/** 이름을 가운데만 가린다 : 홍길동 → 홍○동 */
function maskName_(name) {
  if (name.length <= 1) return name;
  if (name.length === 2) return name.charAt(0) + '○';
  return name.charAt(0) + new Array(name.length - 1).join('○') + name.charAt(name.length - 1);
}

/** 비밀번호를 되돌릴 수 없게 뭉갠다 */
function hash_(salt, studentId, password) {
  var raw = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256, salt + '|' + studentId + '|' + password, Utilities.Charset.UTF_8);
  return raw.map(function (b) { return ('0' + (b & 0xFF).toString(16)).slice(-2); }).join('');
}

/** 이 스크립트만의 소금값. 처음 한 번 무작위로 만들어 두고 계속 쓴다 */
function getSalt_() {
  var p = PropertiesService.getScriptProperties();
  var s = p.getProperty('SALT');
  if (!s) { s = Utilities.getUuid() + Utilities.getUuid(); p.setProperty('SALT', s); }
  return s;
}

/**
 * 학번에서 「1-3」 같은 반 표시를 만든다 (5자리 = 학년1 + 반2 + 번호2).
 * 형식이 다르면 빈칸을 돌려준다 — 교사가 반별로 정렬할 때만 쓰는 보조 열이다.
 */
function klassOf_(studentId) {
  var s = String(studentId || '').trim();
  if (!/^\d{5}$/.test(s)) return '';
  return s.charAt(0) + '-' + String(Number(s.substr(1, 2)));
}


/* ---------------------------------------------------------------------------
 *  ⑤ 저장해 둔 답안 불러오기 / 임시 저장하기
 * ------------------------------------------------------------------------- */

/**
 * 「작성 중」 시트와 「제출 현황」 시트를 둘 다 보고, 더 나중 것을 돌려준다.
 * (학생이 학교에서 제출한 뒤 집에서 이어 쓰는 경우까지 맞게 처리하기 위해서다.)
 */
function loadAnswers_(book, studentId) {
  var best = { answers: null, from: '', savedAt: '', when: null, submitted: false };

  var pick = function (sheet, label, isSubmit) {
    if (!sheet) return;
    var row = findRowIn_(sheet, COL_ID, studentId);
    if (row < 1) return;
    if (isSubmit) best.submitted = true;

    var vals = sheet.getRange(row, 1, 1, 1 + FIELDS.length).getValues()[0];
    var when = toDate_(vals[0]);
    if (best.when && when && when <= best.when) return;
    if (best.when && !when) return;

    var answers = {};
    FIELDS.forEach(function (f, i) { answers[f.key] = String(vals[i + 1] == null ? '' : vals[i + 1]); });
    /* 이미지는 주소만 남아 있으니 화면이 쓸 수 있는 꼴로 되돌린다 */
    answers.images = urlsToImages_(answers.imageUrls);
    best.answers = answers;
    best.from = label;
    best.savedAt = fmt_(book, when);
    best.when = when;
  };

  pick(book.getSheetByName(SHEET_NAME), '제출한 내용', true);
  pick(book.getSheetByName(DRAFT_SHEET_NAME), '작성 중이던 내용', false);
  return best;
}

/** 학생 화면이 주기적으로 부른다 — 아직 제출하지 않은 내용을 서버에 담아 둔다 */
function saveDraft(token, studentId, payload) {
  var id = clean_(studentId, 30);
  if (!payload || typeof payload !== 'object') throw new Error('저장할 내용을 읽지 못했습니다.');

  var book = getBook_();
  var acc  = ensureAccountSheet_(book);
  var accRow = checkToken_(acc, id, token);
  var name = clean_(acc.getRange(accRow, 2).getDisplayValue(), 30);

  /* 임시 저장은 실패해도 학생이 계속 쓸 수 있어야 하므로 오래 기다리지 않는다 */
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('잠시 뒤 다시 저장해 주세요.');

  try {
    var sheet = ensureDraftSheet_(book);
    var now   = new Date();
    var line  = rowValues_(payload, id, name);

    var row = findRowIn_(sheet, COL_ID, id);
    if (row < 1) row = sheet.getLastRow() + 1;

    var all = [now].concat(line.values).concat([line.chars]);
    sheet.getRange(row, 1, 1, all.length).setValues([all]);

    return { ok: true, savedAt: fmt_(book, now) };
  } finally { lock.releaseLock(); }
}

/**
 * 학생이 보낸 값을 시트에 넣을 한 줄로 다듬는다.
 * - fill:true 항목(학번·이름·반·이미지)은 보내온 값을 믿지 않고 서버가 채운다
 * - count:true 항목의 글자 수를 합해 둔다
 */
function rowValues_(payload, studentId, name) {
  var v = {};
  FIELDS.forEach(function (f) { v[f.key] = clean_(payload[f.key], MAX_LEN); });

  var imgs = imageList_(payload.images);
  v.studentId  = studentId;
  v.name       = name;
  v.klass      = klassOf_(studentId);
  v.imageCount = imgs.length;                                        /* 숫자로 넣어 정렬·집계가 되게 */
  v.imageUrls  = imgs.map(function (i) { return i.url; }).join('\n');

  /* 개념 점수는 「32/36」 꼴 문자열과 정답률 숫자로 나누어 넣는다 */
  var sc = scoreOf_(payload.conceptScore, payload.conceptTotal);
  v.conceptScore = sc.text;
  v.conceptRate  = sc.rate;

  var chars = 0;
  FIELDS.forEach(function (f) { if (f.count) chars += String(v[f.key] || '').length; });

  return { values: FIELDS.map(function (f) { return v[f.key]; }), chars: chars, images: imgs };
}

/** 「맞은 개수 / 전체 개수」 를 시트에 넣을 꼴로 바꾼다. 안 풀었으면 빈칸 */
function scoreOf_(got, total) {
  var g = Number(got), t = Number(total);
  if (!isFinite(g) || !isFinite(t) || t <= 0 || g < 0) return { text: '', rate: '' };
  if (g > t) g = t;
  return { text: g + '/' + t, rate: Math.round(g / t * 100) };
}

/** 화면이 보낸 이미지 목록을 믿을 수 있는 꼴로 걸러 낸다 (드라이브 주소만 통과) */
function imageList_(images) {
  var arr = images;
  if (typeof arr === 'string') { try { arr = JSON.parse(arr); } catch (e) { arr = []; } }
  if (!arr || typeof arr.length !== 'number') return [];

  var out = [];
  for (var i = 0; i < arr.length && out.length < MAX_IMAGES; i++) {
    var fid = fileIdOf_(arr[i]);
    if (fid) out.push({ fileId: fid, url: driveUrl_(fid) });
  }
  return out;
}

/** {fileId} 또는 {url} 또는 주소 문자열에서 드라이브 파일 번호만 뽑는다 */
function fileIdOf_(item) {
  var s = '';
  if (item && typeof item === 'object') s = String(item.fileId || item.url || '');
  else s = String(item || '');
  var m = /\/d\/([A-Za-z0-9_-]{8,})/.exec(s);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]{8,}$/.test(s) ? s : '';
}

function driveUrl_(fileId) {
  return 'https://drive.google.com/file/d/' + fileId + '/view';
}

/** 시트에 적힌 주소 여러 줄을 화면이 쓸 수 있는 목록으로 되돌린다 */
function urlsToImages_(text) {
  var out = [];
  String(text || '').split(/[\s,]+/).forEach(function (u) {
    var fid = fileIdOf_(u);
    if (fid) out.push({ fileId: fid, url: driveUrl_(fid) });
  });
  return out;
}


/* ---------------------------------------------------------------------------
 *  ⑥ 시각화 캡처 이미지 — 드라이브에 저장하고 시트에는 주소만 남긴다
 * ------------------------------------------------------------------------- */

/**
 * 이미지 한 장을 올린다. dataUrl = "data:image/png;base64,...."
 * 파일은 교사(스크립트 소유자) 드라이브에 만들어지고, 설명란에 올린 학번을 적어 둔다.
 */
function uploadImage(token, studentId, filename, dataUrl) {
  var id  = clean_(studentId, 30);
  var acc = ensureAccountSheet_(getBook_());
  checkToken_(acc, id, token);

  var m = /^data:([^;]+);base64,([\s\S]*)$/.exec(String(dataUrl || ''));
  if (!m) throw new Error('이미지를 읽지 못했습니다. 다시 올려 주세요.');

  var type = String(m[1]).toLowerCase();
  if (IMAGE_TYPES.indexOf(type) < 0) {
    throw new Error('PNG · JPG · WEBP · GIF 그림만 올릴 수 있습니다.');
  }

  var bytes = Utilities.base64Decode(m[2]);
  if (bytes.length > MAX_IMAGE_BYTES) {
    throw new Error('그림이 너무 큽니다. ' + Math.round(MAX_IMAGE_BYTES / 1024 / 1024) + 'MB 아래로 줄여 주세요.');
  }
  countUpload_(id);   /* 한 시간에 몇 장까지만 */

  var stamp = Utilities.formatDate(new Date(), timeZone_(), 'MMdd-HHmmss');
  var safe  = (id + '_' + stamp + '_' + clean_(filename, 60)).replace(/[\\\/:*?"<>|]/g, '_');
  var file  = getFolder_().createFile(Utilities.newBlob(bytes, type, safe));
  file.setDescription('owner=' + id + '|빅데이터 학습지 시각화 캡처');

  return { ok: true, fileId: file.getId(), url: driveUrl_(file.getId()), name: safe, bytes: bytes.length };
}

/** 한 시간에 올릴 수 있는 장수를 넘지 않았는지 본다 */
function countUpload_(studentId) {
  var cache = CacheService.getScriptCache();
  var key   = 'up::' + studentId;
  var n     = Number(cache.get(key) || 0) + 1;
  if (n > UPLOAD_PER_HOUR) {
    throw new Error('그림을 너무 많이 올렸습니다. 잠시 뒤에 다시 시도해 주세요.');
  }
  cache.put(key, String(n), 3600);
}

/**
 * 올려 둔 이미지를 화면에서 다시 볼 수 있게 돌려준다.
 * 드라이브 파일은 비공개이므로, 앱을 거쳐 base64 로만 내보낸다.
 * 남의 학번으로 올린 파일은 돌려주지 않는다.
 */
function getImages(token, studentId, fileIds) {
  var id  = clean_(studentId, 30);
  var acc = ensureAccountSheet_(getBook_());
  checkToken_(acc, id, token);

  var out = [];
  (fileIds || []).forEach(function (raw) {
    var fid = fileIdOf_(raw);
    if (!fid) return;
    try {
      var file = DriveApp.getFileById(fid);
      if (!ownsImage_(file, id)) return;
      var blob = file.getBlob();
      out.push({
        fileId: fid,
        url: driveUrl_(fid),
        name: file.getName(),
        dataUrl: 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes())
      });
    } catch (e) { /* 지워진 파일은 건너뛴다 */ }
  });
  return { ok: true, images: out };
}

/** 학생이 올린 그림을 지운다(휴지통으로). 본인 것만 지울 수 있다 */
function deleteImage(token, studentId, fileId) {
  var id  = clean_(studentId, 30);
  var acc = ensureAccountSheet_(getBook_());
  checkToken_(acc, id, token);

  var fid = fileIdOf_(fileId);
  if (!fid) throw new Error('지울 그림을 찾지 못했습니다.');
  var file = DriveApp.getFileById(fid);
  if (!ownsImage_(file, id)) throw new Error('본인이 올린 그림만 지울 수 있습니다.');
  file.setTrashed(true);
  return { ok: true };
}

function ownsImage_(file, studentId) {
  return String(file.getDescription() || '').indexOf('owner=' + studentId + '|') === 0;
}

/** 이미지를 담을 폴더. 스프레드시트와 같은 자리에 만든다 */
function getFolder_() {
  var p  = PropertiesService.getScriptProperties();
  var id = p.getProperty('IMAGE_FOLDER_ID');
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (e) { /* 지워졌으면 새로 만든다 */ }
  }
  var book = getBook_();
  var name = book.getName() + ' - 제출 이미지';
  var folder = null;
  try {
    var parents = DriveApp.getFileById(book.getId()).getParents();
    folder = parents.hasNext() ? parents.next().createFolder(name) : DriveApp.createFolder(name);
  } catch (e) {
    folder = DriveApp.createFolder(name);
  }
  p.setProperty('IMAGE_FOLDER_ID', folder.getId());
  return folder;
}


/* ---------------------------------------------------------------------------
 *  ⑦ 제출 받기 — 화면의 [제출하기] 버튼이 이 함수를 부른다
 * ------------------------------------------------------------------------- */

function submitForm(token, payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('보낸 내용을 읽지 못했습니다. 새로고침한 뒤 다시 시도해 주세요.');
  }
  if (!isAccepting_()) {
    throw new Error('지금은 제출을 받지 않는 시간입니다. 선생님께 문의하세요.');
  }

  var studentId = clean_(payload.studentId, 30);
  if (!studentId) throw new Error('학번을 확인하지 못했습니다. 새로고침한 뒤 다시 로그인해 주세요.');

  /* 로그인한 본인이 맞는지 확인하고, 이름은 계정에 적힌 것을 쓴다 */
  var book = getBook_();
  var acc  = ensureAccountSheet_(book);
  var accRow = checkToken_(acc, studentId, token);
  var name   = clean_(acc.getRange(accRow, 2).getDisplayValue(), 30);
  if (!name) throw new Error('이름을 확인하지 못했습니다. 선생님께 문의하세요.');

  /* 여러 학생이 동시에 누를 때 줄이 겹쳐 쓰이지 않도록 잠금을 건다 */
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) {
    throw new Error('제출이 한꺼번에 몰렸습니다. 5초쯤 뒤에 다시 눌러 주세요.');
  }

  try {
    var sheet = ensureSheet_(book);
    var now   = new Date();
    var line  = rowValues_(payload, studentId, name);

    /* 같은 학번이 이미 있으면 그 줄을 최신 내용으로 덮어쓴다 */
    var row     = findRowIn_(sheet, COL_ID, studentId);
    var updated = row > 0;
    var count   = 1;

    if (updated) {
      var prev = sheet.getRange(row, COL_COUNT).getValue();
      count = (typeof prev === 'number' && prev > 0 ? prev : 1) + 1;
    } else {
      row = sheet.getLastRow() + 1;
    }

    var all = [now].concat(line.values).concat([count, line.chars]);
    sheet.getRange(row, 1, 1, all.length).setValues([all]);

    /* 덮어쓰기로 사라질 수 있으니 모든 제출을 백업 시트에도 남긴다 */
    appendLog_(book, all, updated ? '수정 제출' : '첫 제출');

    return {
      ok: true,
      time: Utilities.formatDate(now, timeZone_(), 'MM월 dd일 HH:mm'),
      code: Utilities.formatDate(now, timeZone_(), 'MMdd-HHmm') + '-' + row,
      row: row,
      count: count,
      updated: updated
    };

  } finally {
    lock.releaseLock();   /* 성공하든 실패하든 잠금은 반드시 푼다 */
  }
}


/* ---------------------------------------------------------------------------
 *  ⑧ 시트 다루기
 * ------------------------------------------------------------------------- */

/** 기록할 스프레드시트를 가져온다 */
function getBook_() {
  var book = SPREADSHEET_ID
    ? SpreadsheetApp.openById(SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
  if (!book) {
    throw new Error('스프레드시트를 찾지 못했습니다. Code.gs 위쪽의 SPREADSHEET_ID 에 시트 ID를 넣어 주세요.');
  }
  return book;
}

function timeZone_() {
  try { return getBook_().getSpreadsheetTimeZone() || 'Asia/Seoul'; } catch (e) { return 'Asia/Seoul'; }
}

/**
 * 제출 시트를 가져온다. 없으면 만들고 머리글을 갖춘다.
 * 꾸미기는 처음 만들 때 한 번만 한다 — 제출할 때마다 하면 30명이 동시에 낼 때 느려진다.
 */
function ensureSheet_(book) {
  return ensureOne_(book, SHEET_NAME, header_(), 0);
}

/** 아직 제출하지 않은 「작성 중」 시트 */
function ensureDraftSheet_(book) {
  return ensureOne_(book, DRAFT_SHEET_NAME, draftHeader_(), 1);
}

/** 시트가 없으면 만들고, 머리글이 없거나 바뀌었을 때만 꾸민다 */
function ensureOne_(book, name, head, pos) {
  var sheet = book.getSheetByName(name);
  var isNew = false;
  if (!sheet) { sheet = book.insertSheet(name, pos); isNew = true; }
  if (isNew || sheet.getLastRow() === 0 || sheet.getRange(1, 1).getValue() !== head[0]) {
    formatSheet_(sheet, head);
  }
  return sheet;
}

/**
 * 머리글을 쓰고 열 너비·자료 형식을 정리한다.
 * 첫 열은 날짜, 둘째 열은 학번(텍스트), 그다음 열들은 학습지 항목 순서다.
 */
function formatSheet_(sheet, head) {
  var rows = sheet.getMaxRows() - 1;

  sheet.getRange(1, 1, 1, head.length)
       .setValues([head])
       .setFontWeight('bold')
       .setBackground('#dbe6f6')
       .setVerticalAlignment('middle')
       .setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);
  sheet.setFrozenRows(1);
  sheet.setRowHeight(1, 46);

  /* 열 너비와 자료 형식 */
  sheet.setColumnWidth(1, 130);
  sheet.getRange(2, 1, rows, 1).setNumberFormat('yyyy-mm-dd hh:mm');
  FIELDS.forEach(function (f, i) { sheet.setColumnWidth(i + 2, f.w); });
  sheet.getRange(2, COL_ID, rows, 1).setNumberFormat('@');   /* 학번 앞의 0이 사라지지 않게 */
  for (var c = FIELDS.length + 2; c <= head.length; c++) {   /* 뒤에 붙는 숫자 열들 */
    sheet.setColumnWidth(c, 95);
  }

  /* 긴 글이 아래로 늘어지지 않도록 잘라서 보여 준다 (칸을 누르면 전체 내용이 보인다) */
  sheet.getRange(2, 1, rows, head.length)
       .setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP)
       .setVerticalAlignment('top');
}

/** 학번·비밀번호 시트. 남에게 보이지 않게 숨겨 둔다 */
function ensureAccountSheet_(book) {
  var head = ['학번', '이름', '비밀번호(암호화)', '만든 때', '마지막 접속', '접속 표', '접속 표 만든 때'];
  var acc  = book.getSheetByName(ACCOUNT_SHEET_NAME);

  if (!acc) {
    acc = book.insertSheet(ACCOUNT_SHEET_NAME);
    acc.getRange(1, 1, 1, head.length).setValues([head])
       .setFontWeight('bold').setBackground('#f0e0e0');
    acc.setFrozenRows(1);
    acc.getRange(2, 1, acc.getMaxRows() - 1, 1).setNumberFormat('@');   /* 학번 */
    acc.setColumnWidth(3, 120);
    acc.getRange(2, 4, acc.getMaxRows() - 1, 2).setNumberFormat('yyyy-mm-dd hh:mm');
    acc.getRange(2, 7, acc.getMaxRows() - 1, 1).setNumberFormat('yyyy-mm-dd hh:mm');
    acc.hideSheet();
  }
  return acc;
}

/** 어떤 시트든, 지정한 열에서 값이 같은 줄 번호를 찾는다. 없으면 0 */
function findRowIn_(sheet, col, value) {
  var last = sheet.getLastRow();
  if (last < 2) return 0;
  var vals = sheet.getRange(2, col, last - 1, 1).getDisplayValues();
  var want = String(value).trim();
  for (var i = 0; i < vals.length; i++) {
    if (String(vals[i][0]).trim() === want) return i + 2;
  }
  return 0;
}

/** 날짜를 「07월 29일 18:20」 꼴로 바꾼다 */
function fmt_(book, d) {
  var t = toDate_(d);
  if (!t) return '';
  return Utilities.formatDate(t, book.getSpreadsheetTimeZone() || 'Asia/Seoul', 'MM월 dd일 HH:mm');
}

/** 시트에서 읽은 값을 날짜로 바꾼다. 날짜가 아니면 null */
function toDate_(v) {
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (!v) return null;
  var d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

/** 제출이 일어날 때마다 백업 시트에 한 줄씩 쌓는다 */
function appendLog_(book, line, kind) {
  var log = book.getSheetByName(LOG_SHEET_NAME);
  if (!log) {
    log = book.insertSheet(LOG_SHEET_NAME);
    var head = ['구분'].concat(header_());
    log.getRange(1, 1, 1, head.length).setValues([head])
       .setFontWeight('bold').setBackground('#e8e8e8');
    log.setFrozenRows(1);
    log.getRange(2, 2, log.getMaxRows() - 1, 1).setNumberFormat('yyyy-mm-dd hh:mm');
    log.getRange(2, 3, log.getMaxRows() - 1, 1).setNumberFormat('@');
  }
  log.appendRow([kind].concat(line));
}

/** 앞뒤 공백을 없애고 너무 긴 글은 자른다 */
function clean_(v, max) {
  var s = (v === null || v === undefined) ? '' : String(v);
  s = s.replace(/^\s+/, '').replace(/\s+$/, '');
  return s.length > max ? s.slice(0, max) + ' …(생략)' : s;
}


/* ---------------------------------------------------------------------------
 *  ⑨ 제출 받기 켜기 / 끄기
 * ------------------------------------------------------------------------- */

function isAccepting_() {
  return PropertiesService.getScriptProperties().getProperty('ACCEPTING') !== 'off';
}


/* ---------------------------------------------------------------------------
 *  ⑩ 교사용 메뉴 — 스프레드시트를 열면 위쪽에 「📊 빅데이터 학습지」 메뉴가 생긴다
 * ------------------------------------------------------------------------- */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('📊 빅데이터 학습지')
    .addItem('시트 만들기 / 머리글 정리', 'setupSheet')
    .addSeparator()
    .addItem('제출 받기 ▶ 켜기', 'turnOn')
    .addItem('제출 받기 ■ 끄기(마감)', 'turnOff')
    .addItem('현재 상태 보기', 'showState')
    .addSeparator()
    .addItem('제출 현황 요약', 'showSummary')
    .addItem('아직 제출 안 한 학생 보기', 'showWriting')
    .addItem('🖼 고른 줄의 이미지 보기', 'showRowImages')
    .addSeparator()
    .addItem('🔑 학생 비밀번호 초기화', 'resetPassword')
    .addItem('📂 이미지 폴더 주소 보기', 'showFolder')
    .addItem('학생용 주소 보기', 'showUrl')
    .addToUi();
}

function setupSheet() {
  var book = getBook_();
  ensureSheet_(book);
  ensureDraftSheet_(book);
  ensureAccountSheet_(book);
  SpreadsheetApp.getUi().alert(
    '준비를 마쳤습니다.\n\n' +
    '「' + SHEET_NAME + '」 — 제출한 답안 (학생 1명 = 1줄)\n' +
    '「' + DRAFT_SHEET_NAME + '」 — 아직 제출하지 않고 쓰는 중인 내용\n' +
    '「' + ACCOUNT_SHEET_NAME + '」 — 학번·비밀번호 (숨김 시트)\n\n' +
    '시각화 캡처 그림은 제출이 들어올 때 드라이브 폴더에 만들어집니다.');
}

/**
 * 고른 줄의 학생이 올린 시각화 캡처를 창으로 띄운다.
 * 드라이브 파일이 비공개여도 여기서는 그림이 그대로 보인다.
 */
function showRowImages() {
  var ui    = SpreadsheetApp.getUi();
  var sheet = SpreadsheetApp.getActiveSheet();
  var name  = sheet.getName();
  if (name !== SHEET_NAME && name !== DRAFT_SHEET_NAME) {
    ui.alert('「' + SHEET_NAME + '」 또는 「' + DRAFT_SHEET_NAME + '」 시트에서 학생 줄을 고른 뒤 눌러 주세요.');
    return;
  }
  var row = sheet.getActiveRange().getRow();
  if (row < 2) { ui.alert('머리글이 아니라 학생이 적힌 줄을 골라 주세요.'); return; }

  var vals = sheet.getRange(row, 1, 1, 1 + FIELDS.length).getValues()[0];
  var get  = function (key) {
    for (var i = 0; i < FIELDS.length; i++) if (FIELDS[i].key === key) return String(vals[i + 1] == null ? '' : vals[i + 1]);
    return '';
  };

  var imgs = urlsToImages_(get('imageUrls'));
  if (!imgs.length) { ui.alert(get('studentId') + ' ' + get('name') + ' — 올린 그림이 없습니다.'); return; }

  var esc = function (s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  };
  var html = '<div style="font-family:Malgun Gothic,sans-serif;font-size:15px;line-height:1.6">' +
    '<div style="font-size:19px;font-weight:700;margin-bottom:4px">' +
      esc(get('studentId')) + ' ' + esc(get('name')) + '</div>' +
    '<div style="color:#555;margin-bottom:10px">' +
      '주제: ' + esc(get('topic') || '-') + ' / 도구: ' + esc(get('tool') || '-') + '</div>' +
    '<div style="background:#f4f6fa;border-radius:8px;padding:10px;margin-bottom:14px;white-space:pre-wrap">' +
      '<b>시각화 결과 요약</b>\n' + esc(get('summary') || '(적지 않음)') + '</div>';

  imgs.forEach(function (im, i) {
    var block = '';
    try {
      var blob = DriveApp.getFileById(im.fileId).getBlob();
      block = '<img src="data:' + blob.getContentType() + ';base64,' +
              Utilities.base64Encode(blob.getBytes()) +
              '" style="max-width:100%;border:1px solid #ccd;border-radius:8px">';
    } catch (e) {
      block = '<div style="color:#b00">그림을 열지 못했습니다. (지워졌거나 권한이 없습니다)</div>';
    }
    html += '<div style="margin-bottom:16px"><div style="font-weight:700;margin-bottom:4px">' +
            '그림 ' + (i + 1) + ' <a href="' + im.url + '" target="_blank">드라이브에서 열기</a></div>' +
            block + '</div>';
  });
  html += '</div>';

  ui.showModalDialog(HtmlService.createHtmlOutput(html).setWidth(900).setHeight(680),
                     '제출한 시각화 캡처');
}

/**
 * 비밀번호를 잊은 학생을 위해 비밀번호만 지운다.
 * 답안은 그대로 두므로, 학생이 새 비밀번호를 정하면 쓰던 내용을 그대로 이어서 쓸 수 있다.
 */
function resetPassword() {
  var ui = SpreadsheetApp.getUi();
  var ask = ui.prompt('비밀번호 초기화',
    '비밀번호를 잊은 학생의 학번을 적어 주세요.\n' +
    '(비밀번호만 지웁니다. 쓰던 답안은 그대로 남습니다.)', ui.ButtonSet.OK_CANCEL);
  if (ask.getSelectedButton() !== ui.Button.OK) return;

  var id = String(ask.getResponseText()).trim();
  if (!id) return;

  var acc = ensureAccountSheet_(getBook_());
  var row = findRowIn_(acc, 1, id);
  if (row < 1) { ui.alert('학번 ' + id + ' 은(는) 아직 접속한 적이 없습니다.'); return; }

  var name = acc.getRange(row, 2).getDisplayValue();
  acc.getRange(row, 3).setValue('');                  /* 비밀번호 지우기 */
  acc.getRange(row, 6, 1, 2).setValues([['', '']]);   /* 열려 있던 접속도 끊는다 */
  ui.alert(id + ' ' + name + ' 학생의 비밀번호를 지웠습니다.\n\n' +
           '학생이 다시 접속하면 새 비밀번호를 정하는 화면이 나옵니다.\n' +
           '쓰던 답안은 그대로 남아 있습니다.');
}

/** 쓰는 중이지만 아직 제출하지 않은 학생을 보여 준다 */
function showWriting() {
  var book  = getBook_();
  var draft = ensureDraftSheet_(book);
  var done  = ensureSheet_(book);

  var submitted = {};
  if (done.getLastRow() > 1) {
    done.getRange(2, COL_ID, done.getLastRow() - 1, 1).getDisplayValues()
        .forEach(function (r) { submitted[String(r[0]).trim()] = true; });
  }

  var head = draftHeader_();
  var yet = [];
  if (draft.getLastRow() > 1) {
    draft.getRange(2, 1, draft.getLastRow() - 1, head.length).getValues()
      .forEach(function (r) {
        var id = String(r[COL_ID - 1]).trim();
        if (id && !submitted[id]) {
          yet.push('· ' + id + ' ' + r[2] + '  (' + (r[head.length - 1] || 0) + '자, ' + fmt_(book, r[0]) + ' 저장)');
        }
      });
  }

  SpreadsheetApp.getUi().alert(yet.length
    ? '쓰는 중이지만 아직 제출하지 않은 학생 ' + yet.length + '명\n\n' + yet.join('\n')
    : '쓰는 중인데 제출하지 않은 학생은 없습니다.');
}

function turnOn() {
  PropertiesService.getScriptProperties().setProperty('ACCEPTING', 'on');
  SpreadsheetApp.getUi().alert('이제 학생 제출을 받습니다.');
}

function turnOff() {
  PropertiesService.getScriptProperties().setProperty('ACCEPTING', 'off');
  SpreadsheetApp.getUi().alert('제출을 마감했습니다.\n학생 화면에는 안내 문구가 뜨고 제출 버튼이 막힙니다.');
}

function showState() {
  SpreadsheetApp.getUi().alert(isAccepting_()
    ? '지금은 제출을 받는 중입니다. ▶'
    : '지금은 제출이 마감된 상태입니다. ■');
}

/** 몇 명이 냈는지, 도구는 어떻게 갈렸는지, 개념 점수는 어떤지 한 번에 보여 준다 */
function showSummary() {
  var book  = getBook_();
  var sheet = ensureSheet_(book);
  var last  = sheet.getLastRow();
  if (last < 2) {
    SpreadsheetApp.getUi().alert('아직 제출한 학생이 없습니다.');
    return;
  }

  var head = header_();
  var rows = sheet.getRange(2, 1, last - 1, head.length).getValues();
  var col  = function (key) {
    for (var i = 0; i < FIELDS.length; i++) if (FIELDS[i].key === key) return i + 1;
    return -1;
  };
  var cTool = col('tool'), cImg = col('imageCount'), cRate = col('conceptRate');

  var tools = {};
  var sum = 0, redo = 0, withImg = 0, rateSum = 0, rateCnt = 0, lastTime = null;

  rows.forEach(function (r) {
    var t = String(r[cTool] || '').trim() || '(고르지 않음)';
    tools[t] = (tools[t] || 0) + 1;
    sum += Number(r[COL_COUNT]) || 0;                     /* 총 글자 수 */
    if ((Number(r[COL_COUNT - 1]) || 1) > 1) redo++;      /* 제출 횟수 */
    if ((Number(r[cImg]) || 0) > 0) withImg++;
    var rate = Number(r[cRate]);
    if (isFinite(rate) && String(r[cRate]) !== '') { rateSum += rate; rateCnt++; }
    if (r[0] instanceof Date && (!lastTime || r[0] > lastTime)) lastTime = r[0];
  });

  var text = '제출 인원 : ' + rows.length + '명\n' +
             '수정 제출 : ' + redo + '명\n' +
             '이미지 올린 학생 : ' + withImg + '명\n' +
             '평균 글자 수 : ' + Math.round(sum / rows.length) + '자\n' +
             '탭① 개념 평균 정답률 : ' + (rateCnt ? Math.round(rateSum / rateCnt) + '% (' + rateCnt + '명)' : '기록 없음') + '\n' +
             '마지막 제출 : ' + (lastTime ? Utilities.formatDate(lastTime, timeZone_(), 'MM월 dd일 HH:mm') : '-') +
             '\n\n[ 분석 도구 ]\n';
  Object.keys(tools).forEach(function (k) { text += '· ' + k + ' : ' + tools[k] + '명\n'; });

  SpreadsheetApp.getUi().alert(text);
}

/** 학생이 올린 그림이 어디에 쌓이는지 알려 준다 */
function showFolder() {
  var f = getFolder_();
  SpreadsheetApp.getUi().alert('학생이 올린 시각화 캡처는 이 폴더에 쌓입니다.\n\n' +
    f.getName() + '\n' + f.getUrl() + '\n\n' +
    '그림은 비공개입니다. 시트에서 줄을 고르고 메뉴 [🖼 고른 줄의 이미지 보기] 를 쓰면\n' +
    '드라이브를 열지 않고도 바로 볼 수 있습니다.');
}

/** 배포한 웹앱 주소를 보여 준다 (배포 전에는 알 수 없다) */
function showUrl() {
  var url = '';
  try { url = ScriptApp.getService().getUrl() || ''; } catch (e) {}
  SpreadsheetApp.getUi().alert(url
    ? '학생에게 알려 줄 주소입니다.\n\n' + url + '\n\n(메뉴 [배포 > 배포 관리] 에서도 확인할 수 있습니다.)'
    : '아직 배포하지 않았습니다.\n\n오른쪽 위 [배포 > 새 배포] 에서 유형을 「웹 앱」으로 골라 배포한 뒤 다시 확인해 주세요.');
}
