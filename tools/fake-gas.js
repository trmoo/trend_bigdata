/**
 * 가짜 Apps Script 환경 — `src/Code.gs` 를 PC 에서 그대로 돌리기 위한 것.
 * © 2026 티쳐무 · 모든 권리 보유 (학교 수업 목적으로만 이용)
 *
 * ⚠️ 이 파일은 Apps Script 프로젝트에 넣지 않는다. 시험(test)과 미리보기(preview) 전용이다.
 * ⚠️ 브라우저와 node 두 곳에서 함께 쓰므로 **ES5 문법만** 쓴다 (import·let·화살표 금지).
 *
 * 쓰는 법:  var gas = makeFakeGas({ sha256: 함수 });   // 서비스들이 담긴 객체를 돌려준다
 */
function makeFakeGas(opts) {
  opts = opts || {};
  var seq = 0;
  /* 진짜 드라이브·시트 번호는 30자쯤 되는 긴 글자다. Code.gs 가 그 형식을 검사하므로 길이를 맞춘다 */
  function nextId(p) {
    seq++;
    return (p || 'id') + '_' + seq + '_aBcDeFgHiJkLmNoPqRsTuVwXyZ';
  }

  /* ------------------------------------------------------------------ 시트 */

  function Range(sheet, row, col, nr, nc) {
    this.sheet = sheet; this.row = row; this.col = col;
    this.nr = nr === undefined ? 1 : nr;
    this.nc = nc === undefined ? 1 : nc;
  }
  Range.prototype.getValues = function () {
    var out = [];
    for (var r = 0; r < this.nr; r++) {
      var line = [];
      for (var c = 0; c < this.nc; c++) line.push(this.sheet._get(this.row + r, this.col + c));
      out.push(line);
    }
    return out;
  };
  Range.prototype.getValue = function () { return this.getValues()[0][0]; };
  Range.prototype.getDisplayValues = function () {
    return this.getValues().map(function (line) {
      return line.map(function (v) {
        if (v === null || v === undefined) return '';
        if (v instanceof Date) return v.toISOString();
        return String(v);
      });
    });
  };
  Range.prototype.getDisplayValue = function () { return this.getDisplayValues()[0][0]; };
  Range.prototype.setValues = function (vals) {
    if (!vals || vals.length !== this.nr) {
      throw new Error('setValues 행 수 불일치: ' + (vals ? vals.length : 'null') + ' vs ' + this.nr);
    }
    for (var r = 0; r < this.nr; r++) {
      if (vals[r].length !== this.nc) {
        throw new Error('setValues 열 수 불일치: ' + vals[r].length + ' vs ' + this.nc);
      }
      for (var c = 0; c < this.nc; c++) this.sheet._set(this.row + r, this.col + c, vals[r][c]);
    }
    return this;
  };
  Range.prototype.setValue = function (v) {
    for (var r = 0; r < this.nr; r++) for (var c = 0; c < this.nc; c++) this.sheet._set(this.row + r, this.col + c, v);
    return this;
  };
  Range.prototype.clearContent = function () { return this.setValue(''); };
  Range.prototype.getRow = function () { return this.row; };
  Range.prototype.getColumn = function () { return this.col; };
  /* 꾸미기 함수들은 기록만 해 둔다 (시험에서 「불렀는지」만 보면 된다) */
  ['setNumberFormat', 'setFontWeight', 'setBackground', 'setVerticalAlignment', 'setWrapStrategy',
   'setFontSize', 'setHorizontalAlignment', 'setBorder'].forEach(function (m) {
    Range.prototype[m] = function (v) {
      this.sheet.styled[m] = (this.sheet.styled[m] || 0) + 1;
      if (m === 'setNumberFormat') {
        for (var r = 0; r < this.nr; r++) for (var c = 0; c < this.nc; c++) {
          this.sheet.formats[(this.row + r) + ',' + (this.col + c)] = v;
        }
      }
      return this;
    };
  });

  function Sheet(name, parent) {
    this.name = name; this.parent = parent;
    this.cells = {}; this.formats = {}; this.styled = {};
    this.widths = {}; this.heights = {};
    this.frozen = 0; this.hidden = false;
    this.activeRow = 2;
  }
  Sheet.prototype._get = function (r, c) {
    var v = this.cells[r + ',' + c];
    return v === undefined ? '' : v;
  };
  Sheet.prototype._set = function (r, c, v) { this.cells[r + ',' + c] = v; };
  Sheet.prototype.getName = function () { return this.name; };
  Sheet.prototype.getParent = function () { return this.parent; };
  Sheet.prototype.getMaxRows = function () { return 1000; };
  Sheet.prototype.getMaxColumns = function () { return 40; };
  Sheet.prototype.getLastRow = function () {
    var last = 0;
    for (var k in this.cells) {
      if (!Object.prototype.hasOwnProperty.call(this.cells, k)) continue;
      var v = this.cells[k];
      if (v === '' || v === null || v === undefined) continue;
      var r = Number(k.split(',')[0]);
      if (r > last) last = r;
    }
    return last;
  };
  Sheet.prototype.getLastColumn = function () {
    var last = 0;
    for (var k in this.cells) {
      if (!Object.prototype.hasOwnProperty.call(this.cells, k)) continue;
      if (this.cells[k] === '') continue;
      var c = Number(k.split(',')[1]);
      if (c > last) last = c;
    }
    return last;
  };
  Sheet.prototype.getRange = function (row, col, nr, nc) { return new Range(this, row, col, nr, nc); };
  Sheet.prototype.appendRow = function (arr) {
    var r = this.getLastRow() + 1;
    for (var i = 0; i < arr.length; i++) this._set(r, i + 1, arr[i]);
    return this;
  };
  Sheet.prototype.setFrozenRows = function (n) { this.frozen = n; return this; };
  Sheet.prototype.setColumnWidth = function (c, w) { this.widths[c] = w; return this; };
  Sheet.prototype.setRowHeight = function (r, h) { this.heights[r] = h; return this; };
  Sheet.prototype.hideSheet = function () { this.hidden = true; return this; };
  Sheet.prototype.showSheet = function () { this.hidden = false; return this; };
  Sheet.prototype.getActiveRange = function () { return new Range(this, this.activeRow, 1, 1, 1); };
  Sheet.prototype.deleteRow = function (n) {
    var next = {};
    for (var k in this.cells) {
      if (!Object.prototype.hasOwnProperty.call(this.cells, k)) continue;
      var p = k.split(','), r = Number(p[0]), c = Number(p[1]);
      if (r === n) continue;
      next[(r > n ? r - 1 : r) + ',' + c] = this.cells[k];
    }
    this.cells = next;
    return this;
  };

  function Book(name, id) {
    this.name = name; this.id = id; this.sheets = []; this.tz = 'Asia/Seoul';
    this.active = null;
  }
  Book.prototype.getId = function () { return this.id; };
  Book.prototype.getName = function () { return this.name; };
  Book.prototype.getUrl = function () { return 'https://docs.google.com/spreadsheets/d/' + this.id + '/edit'; };
  Book.prototype.getSpreadsheetTimeZone = function () { return this.tz; };
  Book.prototype.getSheetByName = function (n) {
    for (var i = 0; i < this.sheets.length; i++) if (this.sheets[i].name === n) return this.sheets[i];
    return null;
  };
  Book.prototype.getSheets = function () { return this.sheets.slice(); };
  Book.prototype.insertSheet = function (n, pos) {
    var s = new Sheet(n, this);
    if (typeof pos === 'number') this.sheets.splice(pos, 0, s); else this.sheets.push(s);
    if (!this.active) this.active = s;
    return s;
  };
  Book.prototype.getActiveSheet = function () { return this.active || this.sheets[0] || this.insertSheet('시트1'); };
  Book.prototype.setActiveSheet = function (s) { this.active = s; return s; };

  var book = new Book(opts.bookName || '빅데이터 학습지 - 제출 자료', nextId('ss'));
  var books = {};
  books[book.getId()] = book;

  /* ------------------------------------------------------------------ 드라이브 */

  function DriveFile(name, type, bytes, folder) {
    this.id = nextId('file'); this.name = name; this.type = type; this.bytes = bytes || [];
    this.desc = ''; this.trashed = false; this.folder = folder || null;
  }
  DriveFile.prototype.getId = function () { return this.id; };
  DriveFile.prototype.getName = function () { return this.name; };
  DriveFile.prototype.setDescription = function (d) { this.desc = String(d); return this; };
  DriveFile.prototype.getDescription = function () { return this.desc; };
  DriveFile.prototype.setTrashed = function (t) { this.trashed = !!t; return this; };
  DriveFile.prototype.isTrashed = function () { return this.trashed; };
  DriveFile.prototype.getUrl = function () { return 'https://drive.google.com/file/d/' + this.id + '/view'; };
  DriveFile.prototype.getSize = function () { return this.bytes.length; };
  DriveFile.prototype.getBlob = function () {
    var self = this;
    return {
      getBytes: function () { return self.bytes; },
      getContentType: function () { return self.type; },
      getName: function () { return self.name; }
    };
  };
  DriveFile.prototype.getParents = function () {
    var list = this.folder ? [this.folder] : [];
    var i = 0;
    return { hasNext: function () { return i < list.length; }, next: function () { return list[i++]; } };
  };

  var files = {};      /* id → DriveFile */
  var folders = {};    /* id → Folder */

  function Folder(name) { this.id = nextId('folder'); this.name = name; this.kids = []; folders[this.id] = this; }
  Folder.prototype.getId = function () { return this.id; };
  Folder.prototype.getName = function () { return this.name; };
  Folder.prototype.getUrl = function () { return 'https://drive.google.com/drive/folders/' + this.id; };
  Folder.prototype.createFile = function (blob) {
    var f = new DriveFile(blob.getName(), blob.getContentType(), blob.getBytes(), this);
    files[f.id] = f;
    this.kids.push(f);
    return f;
  };
  Folder.prototype.createFolder = function (name) { return new Folder(name); };
  Folder.prototype.getFiles = function () {
    var list = this.kids.slice(), i = 0;
    return { hasNext: function () { return i < list.length; }, next: function () { return list[i++]; } };
  };

  var rootFolder = new Folder('내 드라이브');
  /* 스프레드시트도 드라이브에서 찾을 수 있어야 한다 (getFolder_ 가 부모 폴더를 본다) */
  var bookFile = new DriveFile(book.getName(), 'application/vnd.google-apps.spreadsheet', [], rootFolder);
  bookFile.id = book.getId();
  files[bookFile.id] = bookFile;

  var DriveApp = {
    createFolder: function (name) { return new Folder(name); },
    getFolderById: function (id) {
      if (!folders[id]) throw new Error('없는 폴더: ' + id);
      return folders[id];
    },
    getFileById: function (id) {
      if (!files[id] || files[id].trashed) throw new Error('없는 파일: ' + id);
      return files[id];
    },
    getRootFolder: function () { return rootFolder; }
  };

  /* ------------------------------------------------------------------ 그 밖의 서비스 */

  var props = {};
  var cache = {};
  var logs = [];
  var uiCalls = [];      /* alert · prompt · 모달을 기록해 둔다 */
  var uiAnswers = [];    /* prompt 에 미리 넣어 둘 답 */

  var PropertiesService = {
    getScriptProperties: function () {
      return {
        getProperty: function (k) { return Object.prototype.hasOwnProperty.call(props, k) ? props[k] : null; },
        setProperty: function (k, v) { props[k] = String(v); return this; },
        deleteProperty: function (k) { delete props[k]; return this; },
        getProperties: function () { return props; }
      };
    },
    getUserProperties: function () { return this.getScriptProperties(); }
  };

  var CacheService = {
    getScriptCache: function () {
      return {
        get: function (k) { return Object.prototype.hasOwnProperty.call(cache, k) ? cache[k] : null; },
        put: function (k, v) { cache[k] = String(v); },
        remove: function (k) { delete cache[k]; }
      };
    }
  };

  /** 날짜 꾸미기 — Code.gs 가 쓰는 무늬(yyyy MM dd HH mm ss)만 다룬다 */
  function formatDate(d, tz, fmt) {
    var p2 = function (n) { return (n < 10 ? '0' : '') + n; };
    var map = {
      yyyy: String(d.getFullYear()), MM: p2(d.getMonth() + 1), dd: p2(d.getDate()),
      HH: p2(d.getHours()), mm: p2(d.getMinutes()), ss: p2(d.getSeconds())
    };
    return String(fmt).replace(/yyyy|MM|dd|HH|mm|ss/g, function (t) { return map[t]; });
  }

  var Utilities = {
    DigestAlgorithm: { SHA_256: 'SHA_256', MD5: 'MD5' },
    Charset: { UTF_8: 'UTF_8' },
    computeDigest: function (alg, s) {
      /* Apps Script 는 부호 있는 바이트(-128~127)를 준다 — 그 성질까지 흉내 낸다 */
      var bytes = opts.sha256 ? opts.sha256(String(s)) : weakHash(String(s));
      return bytes.map(function (b) { return b > 127 ? b - 256 : b; });
    },
    getUuid: function () { return 'uuid-' + nextId('u') + '-' + Math.floor(Math.random() * 1e9); },
    base64Encode: function (bytes) {
      if (opts.b64encode) return opts.b64encode(bytes);
      var s = '';
      for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i] & 0xFF);
      return btoa(s);
    },
    base64Decode: function (str) {
      if (opts.b64decode) return opts.b64decode(str);
      var raw = atob(String(str)), out = [];
      for (var i = 0; i < raw.length; i++) out.push(raw.charCodeAt(i));
      return out;
    },
    newBlob: function (bytes, type, name) {
      return {
        getBytes: function () { return bytes; },
        getContentType: function () { return type; },
        getName: function () { return name; }
      };
    },
    formatDate: formatDate,
    sleep: function () { /* 시험에서는 기다리지 않는다 */ }
  };

  /** opts.sha256 이 없을 때 쓰는 아주 단순한 뭉개기 (미리보기 전용) */
  function weakHash(s) {
    var h = 2166136261, out = [];
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 16777619) >>> 0; }
    for (var j = 0; j < 32; j++) { out.push((h >>> ((j % 4) * 8)) & 0xFF); h = (h * 31 + j + 7) >>> 0; }
    return out;
  }

  var LockService = {
    getScriptLock: function () {
      return { tryLock: function () { return true; }, waitLock: function () { }, releaseLock: function () { } };
    }
  };

  var Ui = {
    ButtonSet: { OK: 'OK', OK_CANCEL: 'OK_CANCEL', YES_NO: 'YES_NO' },
    Button: { OK: 'OK', CANCEL: 'CANCEL', YES: 'YES', NO: 'NO' },
    alert: function (msg) { uiCalls.push({ kind: 'alert', msg: String(msg) }); return 'OK'; },
    prompt: function (title, msg) {
      uiCalls.push({ kind: 'prompt', msg: String(title) + '\n' + String(msg || '') });
      var ans = uiAnswers.length ? uiAnswers.shift() : null;
      return {
        getSelectedButton: function () { return ans === null ? 'CANCEL' : 'OK'; },
        getResponseText: function () { return ans === null ? '' : String(ans); }
      };
    },
    showModalDialog: function (out, title) { uiCalls.push({ kind: 'modal', msg: String(title), html: out && out.html }); },
    showSidebar: function () { },
    createMenu: function (name) {
      var menu = { name: name, items: [] };
      var api = {
        addItem: function (t, fn) { menu.items.push({ title: t, fn: fn }); return api; },
        addSeparator: function () { menu.items.push({ sep: true }); return api; },
        addSubMenu: function () { return api; },
        addToUi: function () { uiCalls.push({ kind: 'menu', msg: name, items: menu.items }); }
      };
      return api;
    }
  };

  var SpreadsheetApp = {
    WrapStrategy: { WRAP: 'WRAP', CLIP: 'CLIP', OVERFLOW: 'OVERFLOW' },
    getActiveSpreadsheet: function () { return book; },
    getActive: function () { return book; },
    openById: function (id) {
      if (!books[id]) throw new Error('없는 스프레드시트: ' + id);
      return books[id];
    },
    create: function (name) { var b = new Book(name, nextId('ss')); books[b.getId()] = b; return b; },
    getActiveSheet: function () { return book.getActiveSheet(); },
    getUi: function () { return Ui; },
    flush: function () { }
  };

  var HtmlService = {
    XFrameOptionsMode: { ALLOWALL: 'ALLOWALL', DEFAULT: 'DEFAULT' },
    createHtmlOutput: function (html) {
      var o = {
        html: html,
        setWidth: function () { return o; }, setHeight: function () { return o; },
        setTitle: function () { return o; }, addMetaTag: function () { return o; },
        setXFrameOptionsMode: function () { return o; }, getContent: function () { return html; }
      };
      return o;
    },
    createHtmlOutputFromFile: function (f) { return HtmlService.createHtmlOutput('<!--' + f + '-->'); },
    createTemplateFromFile: function (f) {
      return { evaluate: function () { return HtmlService.createHtmlOutput('<!--' + f + '-->'); } };
    }
  };

  var ScriptApp = {
    getService: function () { return { getUrl: function () { return 'https://script.google.com/macros/s/FAKE/exec'; } }; }
  };

  var Logger = { log: function (m) { logs.push(String(m)); } };

  return {
    SpreadsheetApp: SpreadsheetApp,
    PropertiesService: PropertiesService,
    CacheService: CacheService,
    Utilities: Utilities,
    LockService: LockService,
    DriveApp: DriveApp,
    HtmlService: HtmlService,
    ScriptApp: ScriptApp,
    Logger: Logger,
    /* 시험에서 들여다볼 것들 */
    _book: book,
    _props: props,
    _cache: cache,
    _logs: logs,
    _files: files,
    _folders: folders,
    _ui: uiCalls,
    _uiAnswers: uiAnswers,
    _reset: function () {
      for (var k in props) if (Object.prototype.hasOwnProperty.call(props, k)) delete props[k];
      for (var c in cache) if (Object.prototype.hasOwnProperty.call(cache, c)) delete cache[c];
      book.sheets = [];
      uiCalls.length = 0;
    }
  };
}

/* node 에서 불러 쓸 때 */
if (typeof module !== 'undefined' && module.exports) module.exports = { makeFakeGas: makeFakeGas };
