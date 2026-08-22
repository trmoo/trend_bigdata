/**
 * 서버 로직 시험 — `npm test`
 * © 2026 티쳐무 · 모든 권리 보유 (학교 수업 목적으로만 이용)
 *
 * 가짜 시트 위에서 진짜 `src/Code.gs` 를 돌려 「학생이 낸 것이 교사 시트에 제대로 들어가는가」를 지킨다.
 */
import { createEnv, login, fullPayload, makeRunner } from './harness.mjs';

let total = 0, failed = 0;
function done(r) { total += r.total; failed += r.failed; }

/* =======================================================================
 *  1. 학번 · 이름 다루기
 * ==================================================================== */
{
  const t = makeRunner('학번과 이름');
  const { ctx } = createEnv();

  t.eq('학번 10307 → 1-3반', '1-3', ctx.klassOf_('10307'));
  t.eq('학번 20115 → 2-1반', '2-1', ctx.klassOf_('20115'));
  t.eq('학번 31028 → 3-10반', '3-10', ctx.klassOf_('31028'));
  t.eq('네 자리 학번은 반을 만들지 않는다', '', ctx.klassOf_('1234'));
  t.eq('숫자가 아니면 빈칸', '', ctx.klassOf_('가나다라마'));
  t.eq('빈 학번도 빈칸', '', ctx.klassOf_(''));

  t.eq('이름 가리기 — 홍길동', '홍○동', ctx.maskName_('홍길동'));
  t.eq('이름 가리기 — 두 글자', '김○', ctx.maskName_('김민'));
  t.eq('이름 가리기 — 네 글자', '남○○현', ctx.maskName_('남궁도현'));
  t.eq('이름 가리기 — 한 글자는 그대로', '김', ctx.maskName_('김'));

  t.eq('앞뒤 공백을 없앤다', '가나', ctx.clean_('  가나  ', 100));
  t.eq('너무 길면 자르고 표시를 붙인다', 'abcde …(생략)', ctx.clean_('abcdefghij', 5));
  t.eq('빈 값은 빈 글자', '', ctx.clean_(null, 10));

  done(t.report());
}

/* =======================================================================
 *  2. 로그인 (학번 + 비밀번호)
 * ==================================================================== */
{
  const t = makeRunner('로그인');
  const { ctx, book } = createEnv();

  t.eq('처음 오는 학번은 계정이 없다', false, ctx.checkStudent('10307').exists);
  t.eq('1단계에서 반을 알려 준다', '1-3', ctx.checkStudent('10307').klass);
  t.throws('학번 없이 물으면 막는다', '학번', () => ctx.checkStudent(''));

  t.throws('처음인데 이름이 없으면 막는다', '이름', () => ctx.signIn('10307', '', 'pw1234', 'pw1234'));
  t.throws('비밀번호가 짧으면 막는다', '4자', () => ctx.signIn('10307', '홍길동', 'pw', 'pw'));
  t.throws('확인란이 다르면 막는다', '확인란', () => ctx.signIn('10307', '홍길동', 'pw1234', 'pw9999'));

  const first = login(ctx, '10307', '홍길동', 'pw1234');
  t.truthy('처음 로그인하면 접속 표를 받는다', first.token);
  t.eq('처음 로그인은 isNew', true, first.isNew);
  t.eq('이름을 그대로 돌려준다', '홍길동', first.name);
  t.eq('반도 함께 알려 준다', '1-3', first.klass);

  const acc = book.getSheetByName('계정(비밀번호)');
  t.truthy('계정 시트가 만들어졌다', acc);
  t.truthy('계정 시트는 숨겨 둔다', acc.hidden);
  t.eq('학번이 계정 시트에 적혔다', '10307', String(acc.getRange(2, 1).getValue()));
  t.falsy('비밀번호 원문은 어디에도 없다',
    JSON.stringify(Object.values(acc.cells)).indexOf('pw1234') >= 0);
  t.eq('비밀번호는 64자리 SHA-256 값으로만 남는다', 64, String(acc.getRange(2, 3).getValue()).length);

  t.eq('두 번째부터는 계정이 있다', true, ctx.checkStudent('10307').exists);
  t.eq('이름은 가려서 알려 준다', '홍○동', ctx.checkStudent('10307').maskedName);
  t.falsy('비밀번호를 새로 정할 필요는 없다', ctx.checkStudent('10307').needNewPassword);

  t.throws('비밀번호가 틀리면 막는다', '비밀번호가 다릅니다', () => ctx.signIn('10307', '', 'wrong9', 'wrong9'));
  const again = ctx.signIn('10307', '', 'pw1234', 'pw1234');
  t.eq('맞으면 들어간다', false, again.isNew);
  t.truthy('접속 표가 새로 발급된다', again.token && again.token !== first.token);

  /* 선생님이 초기화한 상태 */
  const row = ctx.findRowIn_(acc, 1, '10307');
  acc.getRange(row, 3).setValue('');
  t.eq('초기화하면 새 비밀번호를 정하라고 알려 준다', true, ctx.checkStudent('10307').needNewPassword);
  t.throws('초기화 뒤에도 확인란은 맞아야 한다', '확인란', () => ctx.signIn('10307', '홍길동', 'new1234', 'zzz'));
  const reset = ctx.signIn('10307', '홍길동', 'new1234', 'new1234');
  t.truthy('새 비밀번호로 들어간다', reset.token);
  t.throws('예전 비밀번호는 이제 막힌다', '비밀번호가 다릅니다', () => ctx.signIn('10307', '', 'pw1234', 'pw1234'));

  /* 접속 표 검사 */
  t.throws('남의 접속 표로는 저장할 수 없다', '로그인이 풀렸습니다',
    () => ctx.saveDraft('가짜표', '10307', fullPayload()));
  t.throws('접속한 적 없는 학번은 막는다', '로그인 정보를 찾지 못했습니다',
    () => ctx.saveDraft(reset.token, '99999', fullPayload()));

  /* 오래된 접속 표 */
  const old = new Date(Date.now() - 13 * 3600 * 1000);
  acc.getRange(ctx.findRowIn_(acc, 1, '10307'), 7).setValue(old);
  t.throws('12시간이 지난 접속 표는 다시 로그인하게 한다', '오래되었습니다',
    () => ctx.saveDraft(reset.token, '10307', fullPayload()));

  done(t.report());
}

/* =======================================================================
 *  3. 비밀번호 바꾸기
 * ==================================================================== */
{
  const t = makeRunner('비밀번호 바꾸기');
  const { ctx, book } = createEnv();
  const me = login(ctx, '10101', '김민준', 'pw1234');

  t.throws('짧은 비밀번호로는 못 바꾼다', '4자', () => ctx.changePassword(me.token, '10101', 'pw1234', 'ab'));
  t.throws('지금 비밀번호가 틀리면 못 바꾼다', '맞지 않습니다', () => ctx.changePassword(me.token, '10101', 'nope', 'new1234'));
  t.eq('맞으면 바꾼다', true, ctx.changePassword(me.token, '10101', 'pw1234', 'new1234').ok);
  t.throws('예전 비밀번호는 막힌다', '비밀번호가 다릅니다', () => ctx.signIn('10101', '', 'pw1234', 'pw1234'));
  t.truthy('새 비밀번호로 들어간다', ctx.signIn('10101', '', 'new1234', 'new1234').token);

  done(t.report());
}

/* =======================================================================
 *  4. 임시 저장 · 이어 쓰기
 * ==================================================================== */
{
  const t = makeRunner('임시 저장과 이어 쓰기');
  const { ctx, book } = createEnv();
  const me = login(ctx, '10307', '홍길동', 'pw1234');

  t.eq('처음에는 저장된 것이 없다', null, me.answers);

  const p = fullPayload({ topic: '기후 위기 관심도 변화' });
  const s = ctx.saveDraft(me.token, '10307', p);
  t.truthy('임시 저장하면 시각을 알려 준다', s.savedAt);

  const draft = book.getSheetByName('작성 중(임시 저장)');
  t.truthy('「작성 중」 시트가 만들어졌다', draft);
  t.eq('머리글 첫 칸은 「마지막 저장」', '마지막 저장', draft.getRange(1, 1).getValue());
  t.eq('학번은 둘째 열', '10307', String(draft.getRange(2, 2).getValue()));
  t.eq('이름은 계정에 적힌 것을 쓴다', '홍길동', draft.getRange(2, 3).getValue());
  t.eq('반이 자동으로 들어간다', '1-3', draft.getRange(2, 4).getValue());

  const back = ctx.resume(me.token, '10307');
  t.eq('다시 들어오면 주제가 살아 있다', '기후 위기 관심도 변화', back.answers.topic);
  t.eq('어디서 불러온 것인지 알려 준다', '작성 중이던 내용', back.from);
  t.eq('아직 제출한 것은 아니다', false, back.submitted);
  t.eq('Q2 도 그대로', p.q2, back.answers.q2);
  t.eq('기간도 그대로', '2022-01-01 ~ 현재', back.answers.period);

  ctx.saveDraft(me.token, '10307', fullPayload({ topic: '두 번째로 고친 주제' }));
  t.eq('여러 번 저장해도 줄이 늘지 않는다', 2, draft.getLastRow());
  t.eq('마지막 내용으로 덮어쓴다', '두 번째로 고친 주제', ctx.resume(me.token, '10307').answers.topic);

  /* 남이 보낸 학번·이름은 무시한다 */
  ctx.saveDraft(me.token, '10307', fullPayload({ studentId: '99999', name: '남의이름' }));
  t.eq('보내온 학번은 믿지 않는다', '10307', String(draft.getRange(2, 2).getValue()));
  t.eq('보내온 이름도 믿지 않는다', '홍길동', draft.getRange(2, 3).getValue());

  t.throws('내용이 없으면 막는다', '읽지 못했습니다', () => ctx.saveDraft(me.token, '10307', null));

  done(t.report());
}

/* =======================================================================
 *  5. 제출 — 교사 시트에 한 줄로 들어가는가
 * ==================================================================== */
{
  const t = makeRunner('제출');
  const { ctx, book } = createEnv();
  const me = login(ctx, '10307', '홍길동', 'pw1234');
  const p = fullPayload({ studentId: '10307' });

  const r = ctx.submitForm(me.token, p);
  t.eq('제출하면 ok', true, r.ok);
  t.eq('첫 제출은 1번째', 1, r.count);
  t.eq('처음이라 updated 는 거짓', false, r.updated);
  t.truthy('확인 번호를 준다', /^\d{4}-\d{4}-\d+$/.test(r.code));

  const sheet = book.getSheetByName('제출 현황');
  t.truthy('「제출 현황」 시트가 만들어졌다', sheet);
  t.eq('학생 한 명이면 두 번째 줄까지', 2, sheet.getLastRow());

  const head = ctx.header_();
  const vals = sheet.getRange(2, 1, 1, head.length).getValues()[0];
  const at = (title) => vals[head.indexOf(title)];

  t.eq('머리글 개수 = 시각 + 항목 + 2', ctx.FIELDS.length + 3, head.length);
  t.eq('머리글에 겹치는 이름이 없다', head.length, new Set(head).size);
  /* vm 안에서 만든 Date 는 밖의 Date 와 다른 것이라 instanceof 로는 못 본다 */
  t.truthy('제출 시각이 날짜로 들어간다', vals[0] && typeof vals[0].getTime === 'function');
  t.eq('학번', '10307', String(at('학번')));
  t.eq('이름', '홍길동', at('이름'));
  t.eq('반', '1-3', at('반'));
  t.eq('분석 도구', '구글 트렌드', at('1. 분석 도구'));
  t.eq('분석 주제', p.topic, at('1. 분석 주제'));
  t.eq('키워드 1', 'AI', at('키워드 1'));
  t.eq('키워드 2', 'ChatGPT', at('키워드 2'));
  t.eq('키워드 4는 비워 둘 수 있다', '', at('키워드 4'));
  t.eq('검색 기간', '2022-01-01 ~ 현재', at('검색 기간'));
  t.eq('지역', '대한민국', at('지역'));
  t.eq('기기', '모바일', at('기기'));
  t.eq('시각화 결과 요약', p.summary, at('2. 시각화 결과 요약'));
  t.eq('Q1', p.q1, at('Q1. 최고점 시기'));
  t.eq('Q2', p.q2, at('Q2. 급증한 이유'));
  t.eq('Q3', p.q3, at('Q3. 차이점·상관관계'));
  t.eq('결론', p.future, at('4. 미래 예측(결론)'));
  t.eq('이미지가 없으면 0장', 0, at('이미지 수'));
  t.eq('이미지 주소도 빈칸', '', at('이미지 주소'));
  t.eq('제출 횟수', 1, vals[head.indexOf('제출 횟수')]);

  /* 총 글자 수 = count:true 항목의 글자 수 합 */
  const want = ['topic', 'kw1', 'kw2', 'kw3', 'kw4', 'summary', 'q1', 'q2', 'q3', 'future']
    .reduce((n, k) => n + String(p[k] || '').length, 0);
  t.eq('총 글자 수는 서술 항목만 더한다', want, vals[head.indexOf('총 글자 수')]);

  /* 백업 시트 */
  const log = book.getSheetByName('제출 기록(백업)');
  t.truthy('백업 시트가 만들어졌다', log);
  t.eq('백업에는 구분이 먼저 온다', '첫 제출', log.getRange(2, 1).getValue());

  /* 다시 제출 */
  const r2 = ctx.submitForm(me.token, fullPayload({ studentId: '10307', topic: '고친 주제' }));
  t.eq('다시 제출하면 2번째', 2, r2.count);
  t.eq('updated 가 참', true, r2.updated);
  t.eq('줄은 늘지 않는다', 2, sheet.getLastRow());
  t.eq('내용이 덮어써진다', '고친 주제', sheet.getRange(2, 1 + 1 + ctx.FIELDS.findIndex(f => f.key === 'topic')).getValue());
  t.eq('백업은 쌓인다', 3, log.getLastRow());
  t.eq('두 번째 백업은 수정 제출', '수정 제출', log.getRange(3, 1).getValue());

  /* 제출한 뒤 다시 들어오면 제출한 내용을 불러온다 */
  const back = ctx.resume(me.token, '10307');
  t.eq('제출한 내용을 불러온다', '제출한 내용', back.from);
  t.eq('제출했다는 표시', true, back.submitted);
  t.eq('불러온 주제', '고친 주제', back.answers.topic);

  /* 임시 저장이 제출보다 나중이면 그것을 불러온다 */
  ctx.saveDraft(me.token, '10307', fullPayload({ topic: '제출 뒤에 더 고친 것' }));
  const back2 = ctx.resume(me.token, '10307');
  t.eq('더 나중에 저장한 쪽을 불러온다', '작성 중이던 내용', back2.from);
  t.eq('내용도 나중 것', '제출 뒤에 더 고친 것', back2.answers.topic);
  t.eq('제출한 적이 있다는 표시는 남는다', true, back2.submitted);

  /* 남의 표로는 못 낸다 */
  t.throws('접속 표가 없으면 제출도 막는다', '로그인', () => ctx.submitForm('가짜', fullPayload({ studentId: '10307' })));
  t.throws('내용이 없으면 막는다', '읽지 못했습니다', () => ctx.submitForm(me.token, null));
  t.throws('학번이 없으면 막는다', '학번', () => ctx.submitForm(me.token, fullPayload({ studentId: '' })));

  done(t.report());
}

/* =======================================================================
 *  6. 개념 점수 (탭①)
 * ==================================================================== */
{
  const t = makeRunner('개념 점수');
  const { ctx, book } = createEnv();

  t.eq('32/37 → 글자와 정답률', { text: '32/37', rate: 86 }, ctx.scoreOf_(32, 37));
  t.eq('만점', { text: '37/37', rate: 100 }, ctx.scoreOf_(37, 37));
  t.eq('0점도 기록한다', { text: '0/37', rate: 0 }, ctx.scoreOf_(0, 37));
  t.eq('안 풀었으면 빈칸', { text: '', rate: '' }, ctx.scoreOf_(undefined, undefined));
  t.eq('전체가 0이면 빈칸', { text: '', rate: '' }, ctx.scoreOf_(3, 0));
  t.eq('숫자가 아니면 빈칸', { text: '', rate: '' }, ctx.scoreOf_('가', '나'));
  t.eq('만점을 넘겨 보내면 만점으로 깎는다', { text: '37/37', rate: 100 }, ctx.scoreOf_(99, 37));
  t.eq('음수는 빈칸', { text: '', rate: '' }, ctx.scoreOf_(-2, 37));

  const me = login(ctx, '10307', '홍길동', 'pw1234');
  ctx.submitForm(me.token, fullPayload({ studentId: '10307', conceptScore: 30, conceptTotal: 37 }));
  const head = ctx.header_();
  const vals = book.getSheetByName('제출 현황').getRange(2, 1, 1, head.length).getValues()[0];
  t.eq('시트에 점수가 들어간다', '30/37', vals[head.indexOf('탭① 개념 점수')]);
  t.eq('정답률도 들어간다', 81, vals[head.indexOf('탭① 정답률(%)')]);

  done(t.report());
}

/* =======================================================================
 *  7. 시각화 캡처 이미지
 * ==================================================================== */
{
  const t = makeRunner('시각화 캡처 이미지');
  const { ctx, book, files } = createEnv();
  const me = login(ctx, '10307', '홍길동', 'pw1234');
  const you = login(ctx, '10308', '이서연', 'pw1234');

  const PNG = 'data:image/png;base64,' + Buffer.from('가짜그림바이트').toString('base64');

  const up = ctx.uploadImage(me.token, '10307', 'trend.png', PNG);
  t.eq('그림을 올리면 ok', true, up.ok);
  t.truthy('파일 번호를 준다', up.fileId);
  t.eq('드라이브 보기 주소를 준다', 'https://drive.google.com/file/d/' + up.fileId + '/view', up.url);
  t.truthy('파일 이름에 학번이 들어간다', /^10307_/.test(up.name));
  t.truthy('드라이브에 실제로 만들어졌다', !!files[up.fileId]);
  t.truthy('올린 학번이 설명란에 남는다', /^owner=10307\|/.test(files[up.fileId].desc));

  t.throws('그림이 아니면 막는다', '읽지 못했습니다', () => ctx.uploadImage(me.token, '10307', 'a.txt', '그냥글자'));
  t.throws('허용하지 않는 형식은 막는다', 'PNG',
    () => ctx.uploadImage(me.token, '10307', 'a.svg', 'data:image/svg+xml;base64,' + Buffer.from('<svg/>').toString('base64')));
  t.throws('로그인 없이는 못 올린다', '로그인', () => ctx.uploadImage('가짜', '10307', 'a.png', PNG));

  /* 너무 큰 그림 */
  const bigOne = 'data:image/jpeg;base64,' + Buffer.alloc(7 * 1024 * 1024, 1).toString('base64');
  t.throws('6MB 를 넘으면 막는다', '너무 큽니다', () => ctx.uploadImage(me.token, '10307', 'big.jpg', bigOne));

  /* 내 그림 보기 */
  const got = ctx.getImages(me.token, '10307', [up.fileId]);
  t.eq('내 그림은 볼 수 있다', 1, got.images.length);
  t.truthy('base64 로 돌려준다', /^data:image\/png;base64,/.test(got.images[0].dataUrl));
  t.eq('남의 그림은 목록에서 빠진다', 0, ctx.getImages(you.token, '10308', [up.fileId]).images.length);
  t.eq('없는 파일 번호는 건너뛴다', 0, ctx.getImages(me.token, '10307', ['없는것']).images.length);

  /* 제출할 때 이미지가 시트에 적히는가 */
  const up2 = ctx.uploadImage(me.token, '10307', 'trend2.png', PNG);
  ctx.submitForm(me.token, fullPayload({
    studentId: '10307',
    images: [{ fileId: up.fileId, url: up.url }, { fileId: up2.fileId, url: up2.url }]
  }));
  const head = ctx.header_();
  const vals = book.getSheetByName('제출 현황').getRange(2, 1, 1, head.length).getValues()[0];
  t.eq('이미지 수가 숫자로 들어간다', 2, vals[head.indexOf('이미지 수')]);
  t.eq('주소가 줄바꿈으로 이어진다', up.url + '\n' + up2.url, vals[head.indexOf('이미지 주소')]);

  /* 시트에 적힌 주소를 화면이 쓸 꼴로 되돌릴 수 있는가 */
  const back = ctx.resume(me.token, '10307');
  t.eq('되돌린 그림이 두 장', 2, back.answers.images.length);
  t.eq('파일 번호도 살아 있다', up.fileId, back.answers.images[0].fileId);

  /* 상한 · 걸러내기 */
  t.eq('최대 3장까지만 기록한다', 3,
    ctx.imageList_([{ fileId: 'a12345678' }, { fileId: 'b12345678' }, { fileId: 'c12345678' }, { fileId: 'd12345678' }]).length);
  t.eq('드라이브 주소가 아니면 버린다', 0, ctx.imageList_(['http://남의사이트.example/a.png', '짧음', null]).length);
  t.eq('주소 문자열에서 파일 번호를 뽑는다', 'ABCdef12345',
    ctx.fileIdOf_('https://drive.google.com/file/d/ABCdef12345/view'));
  t.eq('글자로 온 JSON 도 읽는다', 1, ctx.imageList_('[{"fileId":"abcdefgh12"}]').length);
  t.eq('깨진 JSON 은 빈 목록', 0, ctx.imageList_('{이건 JSON 이 아니다').length);

  /* 지우기 */
  t.throws('남의 그림은 못 지운다', '본인이 올린', () => ctx.deleteImage(you.token, '10308', up.fileId));
  t.eq('내 그림은 지울 수 있다', true, ctx.deleteImage(me.token, '10307', up.fileId).ok);
  t.truthy('지운 그림은 휴지통으로', files[up.fileId].trashed);
  t.eq('지운 뒤에는 보이지 않는다', 0, ctx.getImages(me.token, '10307', [up.fileId]).images.length);

  /* 한 시간 상한 */
  t.throws('한 시간에 12장을 넘기면 막는다', '너무 많이', () => {
    for (let i = 0; i < 20; i++) ctx.uploadImage(me.token, '10307', 'x' + i + '.png', PNG);
  });

  done(t.report());
}

/* =======================================================================
 *  8. 마감 (제출 받기 끄기)
 * ==================================================================== */
{
  const t = makeRunner('마감');
  const { ctx, props } = createEnv();
  const me = login(ctx, '10307', '홍길동', 'pw1234');

  t.eq('처음에는 받는 중', true, ctx.getStatus().accepting);
  t.eq('올릴 수 있는 장수도 알려 준다', 3, ctx.getStatus().maxImages);

  ctx.turnOff();
  t.eq('끄면 받지 않는다', false, ctx.getStatus().accepting);
  t.throws('마감 뒤에는 제출이 막힌다', '받지 않는', () => ctx.submitForm(me.token, fullPayload({ studentId: '10307' })));
  t.noThrow('마감 뒤에도 임시 저장은 된다', () => ctx.saveDraft(me.token, '10307', fullPayload()));

  ctx.turnOn();
  t.eq('다시 켜면 받는다', true, ctx.getStatus().accepting);
  t.noThrow('제출도 다시 된다', () => ctx.submitForm(me.token, fullPayload({ studentId: '10307' })));

  done(t.report());
}

/* =======================================================================
 *  9. 교사 메뉴
 * ==================================================================== */
{
  const t = makeRunner('교사 메뉴');
  const { ctx, book, gas } = createEnv();

  /* 메뉴에 적어 둔 함수가 모두 실제로 있는가 — 없으면 눌렀을 때 오류만 뜬다 */
  ctx.onOpen();
  const menu = gas._ui.filter(u => u.kind === 'menu')[0];
  t.truthy('메뉴가 만들어졌다', menu);
  t.eq('메뉴 이름', '📊 빅데이터 학습지', menu.msg);
  const items = menu.items.filter(i => !i.sep);
  t.eq('메뉴 항목 수', 10, items.length);
  items.forEach(it => t.truthy('메뉴 「' + it.title + '」 의 함수가 있다', typeof ctx[it.fn] === 'function'));

  /* 시트 만들기 */
  ctx.setupSheet();
  t.truthy('제출 현황 시트', book.getSheetByName('제출 현황'));
  t.truthy('작성 중 시트', book.getSheetByName('작성 중(임시 저장)'));
  t.truthy('계정 시트', book.getSheetByName('계정(비밀번호)'));
  t.eq('제출 현황이 첫 시트', '제출 현황', book.getSheets()[0].getName());
  t.eq('머리글은 굵게 꾸민다', true, (book.getSheetByName('제출 현황').styled.setFontWeight || 0) > 0);
  t.eq('학번 열은 텍스트 서식', '@', book.getSheetByName('제출 현황').formats['2,2']);
  t.noThrow('두 번 불러도 괜찮다', () => ctx.setupSheet());

  /* 요약 · 미제출 */
  t.noThrow('제출이 없어도 요약이 뜬다', () => ctx.showSummary());
  const me = login(ctx, '10307', '홍길동', 'pw1234');
  const you = login(ctx, '10308', '이서연', 'pw1234');
  ctx.submitForm(me.token, fullPayload({ studentId: '10307', conceptScore: 30, conceptTotal: 37 }));
  ctx.saveDraft(you.token, '10308', fullPayload({ topic: '아직 쓰는 중' }));

  gas._ui.length = 0;
  ctx.showSummary();
  const sum = gas._ui[gas._ui.length - 1].msg;
  t.truthy('요약에 제출 인원이 나온다', /제출 인원 : 1명/.test(sum));
  t.truthy('요약에 도구 분포가 나온다', /구글 트렌드 : 1명/.test(sum));
  t.truthy('요약에 개념 정답률이 나온다', /81%/.test(sum));

  gas._ui.length = 0;
  ctx.showWriting();
  t.truthy('쓰는 중인 학생이 잡힌다', /10308 이서연/.test(gas._ui[gas._ui.length - 1].msg));
  t.falsy('제출한 학생은 목록에 없다', /10307/.test(gas._ui[gas._ui.length - 1].msg));

  /* 비밀번호 초기화 */
  gas._uiAnswers.push('10307');
  ctx.resetPassword();
  const acc = book.getSheetByName('계정(비밀번호)');
  t.eq('비밀번호가 비워졌다', '', acc.getRange(ctx.findRowIn_(acc, 1, '10307'), 3).getValue());
  t.eq('열려 있던 접속도 끊는다', '', acc.getRange(ctx.findRowIn_(acc, 1, '10307'), 6).getValue());
  t.eq('제출한 답안은 그대로 남는다', 2, book.getSheetByName('제출 현황').getLastRow());
  t.eq('학생은 새 비밀번호를 정하는 화면으로 간다', true, ctx.checkStudent('10307').needNewPassword);
  const re = ctx.signIn('10307', '홍길동', 'again123', 'again123');
  t.eq('쓰던 내용을 그대로 이어 쓴다', fullPayload().topic, re.answers.topic);

  gas._uiAnswers.push('88888');
  t.noThrow('없는 학번을 넣어도 죽지 않는다', () => ctx.resetPassword());

  /* 이미지 보기 */
  const PNG = 'data:image/png;base64,' + Buffer.from('그림').toString('base64');
  const img = ctx.uploadImage(re.token, '10307', 'a.png', PNG);
  ctx.submitForm(re.token, fullPayload({ studentId: '10307', images: [{ fileId: img.fileId, url: img.url }] }));

  const sheet = book.getSheetByName('제출 현황');
  book.setActiveSheet(sheet);
  sheet.activeRow = 2;
  gas._ui.length = 0;
  ctx.showRowImages();
  const modal = gas._ui[gas._ui.length - 1];
  t.eq('창으로 띄운다', 'modal', modal.kind);
  t.truthy('학생 이름이 창에 있다', /홍길동/.test(modal.html));
  t.truthy('그림이 base64 로 박혀 있다', /data:image\/png;base64,/.test(modal.html));
  t.truthy('요약도 함께 보여 준다', /시각화 결과 요약/.test(modal.html));

  sheet.activeRow = 1;
  gas._ui.length = 0;
  ctx.showRowImages();
  t.truthy('머리글 줄을 고르면 알려 준다', /학생이 적힌 줄/.test(gas._ui[0].msg));

  book.setActiveSheet(book.getSheetByName('계정(비밀번호)'));
  gas._ui.length = 0;
  ctx.showRowImages();
  t.truthy('엉뚱한 시트에서는 안내만 한다', /시트에서 학생 줄을 고른/.test(gas._ui[0].msg));

  t.noThrow('폴더 주소 보기', () => ctx.showFolder());
  t.noThrow('학생용 주소 보기', () => ctx.showUrl());
  t.noThrow('현재 상태 보기', () => ctx.showState());

  done(t.report());
}

/* =======================================================================
 *  10. 학번 앞의 0 · 숫자로 적힌 학번
 * ==================================================================== */
{
  const t = makeRunner('학번 다루기');
  const { ctx, book } = createEnv();

  const me = login(ctx, '00123', '영영일이삼', 'pw1234');
  t.truthy('앞에 0 이 붙은 학번도 로그인된다', me.token);
  t.eq('학번이 그대로 남는다', '00123', String(book.getSheetByName('계정(비밀번호)').getRange(2, 1).getValue()));
  t.eq('다시 찾을 수 있다', true, ctx.checkStudent('00123').exists);
  t.noThrow('저장도 된다', () => ctx.saveDraft(me.token, '00123', fullPayload()));

  /* 선생님이 시트에 숫자로 적어 둔 학번도 찾아야 한다 */
  const acc = book.getSheetByName('계정(비밀번호)');
  acc.getRange(3, 1, 1, 3).setValues([[20315, '숫자학번', '']]);
  t.eq('숫자로 적힌 학번도 찾는다', 3, ctx.findRowIn_(acc, 1, '20315'));
  t.eq('앞뒤 공백이 있어도 찾는다', 3, ctx.findRowIn_(acc, 1, ' 20315 '));

  done(t.report());
}

/* =======================================================================
 *  11. 너무 긴 글 · 항목 규칙
 * ==================================================================== */
{
  const t = makeRunner('긴 글과 항목 규칙');
  const { ctx, book } = createEnv();
  const me = login(ctx, '10307', '홍길동', 'pw1234');

  const long = '가'.repeat(5000);
  ctx.submitForm(me.token, fullPayload({ studentId: '10307', summary: long }));
  const head = ctx.header_();
  const vals = book.getSheetByName('제출 현황').getRange(2, 1, 1, head.length).getValues()[0];
  const saved = String(vals[head.indexOf('2. 시각화 결과 요약')]);
  t.truthy('3000자에서 자른다', saved.length < 3100);
  t.truthy('잘랐다는 표시를 붙인다', /…\(생략\)$/.test(saved));

  /* 항목 정의가 스스로 어긋나지 않는가 */
  const keys = ctx.FIELDS.map(f => f.key);
  t.eq('항목 열쇠가 겹치지 않는다', keys.length, new Set(keys).size);
  t.eq('학번은 첫 항목', 'studentId', keys[0]);
  t.eq('이름은 둘째 항목', 'name', keys[1]);
  t.eq('학번 열은 2번', 2, ctx.COL_ID);
  t.eq('제출 횟수 열 번호', ctx.FIELDS.length + 2, ctx.COL_COUNT);
  t.eq('작성 중 머리글은 하나 적다', head.length - 1, ctx.draftHeader_().length);
  ['studentId', 'name', 'klass', 'imageCount', 'imageUrls'].forEach(k => {
    t.truthy('「' + k + '」 은 서버가 채우는 항목', ctx.FIELDS.filter(f => f.key === k)[0].fill === true);
  });
  ctx.FIELDS.forEach(f => {
    t.truthy('「' + f.title + '」 의 열 너비가 있다', typeof f.w === 'number' && f.w > 40);
  });

  done(t.report());
}

/* =======================================================================
 *  결과
 * ==================================================================== */
console.log(`\n${'='.repeat(52)}`);
console.log(`전체 ${total - failed}/${total} 통과${failed ? ` — ${failed}가지 실패` : ' 🎉'}`);
console.log('='.repeat(52));
process.exit(failed ? 1 : 0);
