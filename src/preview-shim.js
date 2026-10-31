// Local preview only. Fakes the Apps Script services (SpreadsheetApp, Utilities, google.script.run, ...)
// so the real dist code and Index.html run in an ordinary browser against an in-memory spreadsheet.
// Not part of the deployment.
(function () {
  'use strict';
  var ISO = /^\d{4}-\d{2}-\d{2}$/;
  var tz = 'America/Los_Angeles'; // deliberately not IST: setup() must switch it

  function zoneMidnight(iso) {
    // Midnight of that calendar day in the sheet's zone (IST assumed once setup has run).
    var p = iso.split('-').map(Number);
    return new Date(Date.UTC(p[0], p[1] - 1, p[2]) - (tz === 'Asia/Kolkata' ? 330 : 0) * 60000);
  }

  function Range(sheet, r, c, nr, nc) { this.sheet = sheet; this.r = r; this.c = c; this.nr = nr; this.nc = nc; }
  Range.prototype.setValues = function (v) {
    if (v.length !== this.nr || v.some(function (row) { return row.length !== this.nc; }, this)) throw new Error('setValues: data does not match range size');
    for (var i = 0; i < this.nr; i++) for (var j = 0; j < this.nc; j++) this.sheet.put(this.r + i, this.c + j, v[i][j]);
    return this;
  };
  Range.prototype.setValue = function (v) { this.sheet.put(this.r, this.c, v); return this; };
  Range.prototype.getValues = function () {
    var out = [];
    for (var i = 0; i < this.nr; i++) { var row = []; for (var j = 0; j < this.nc; j++) row.push(this.sheet.get(this.r + i, this.c + j)); out.push(row); }
    return out;
  };
  Range.prototype.setNumberFormat = function (f) { for (var j = 0; j < this.nc; j++) this.sheet.formats[this.c + j] = f; return this; };
  ['setFontWeight', 'setBackground', 'setFontColor', 'setWrap', 'setVerticalAlignment'].forEach(function (m) {
    Range.prototype[m] = function () { return this; };
  });
  Range.prototype.setDataValidation = function (rule) { if (!rule || !rule.__rule) throw new Error('setDataValidation: not a built rule'); return this; };
  Range.prototype.protect = function () { var p = { setDescription: function () { return p; }, setWarningOnly: function () { return p; } }; return p; };

  function Sheet(name) { this.name = name; this.rows = []; this.formats = {}; this.maxRows = 1000; }
  Sheet.prototype.getName = function () { return this.name; };
  Sheet.prototype.put = function (r, c, v) {
    if (r > this.maxRows) throw new Error('Row ' + r + ' is beyond the grid');
    while (this.rows.length < r) this.rows.push([]);
    var f = this.formats[c];
    if (typeof v === 'string') {
      if (v.charAt(0) === "'") v = v.slice(1);
      else if (f !== '@' && ISO.test(v)) v = zoneMidnight(v);
      else if (f !== '@' && /^-?\d+(\.\d+)?$/.test(v)) v = Number(v);
    }
    this.rows[r - 1][c - 1] = v;
  };
  Sheet.prototype.get = function (r, c) { var row = this.rows[r - 1]; var v = row ? row[c - 1] : undefined; return v == null ? '' : v; };
  Sheet.prototype.getLastRow = function () {
    for (var i = this.rows.length; i > 0; i--) if (this.rows[i - 1].some(function (v) { return v !== '' && v != null; })) return i;
    return 0;
  };
  Sheet.prototype.getLastColumn = function () { return this.rows.reduce(function (m, r) { return Math.max(m, r.length); }, 0); };
  Sheet.prototype.getMaxRows = function () { return this.maxRows; };
  Sheet.prototype.getRange = function (r, c, nr, nc) {
    if (typeof r !== 'number') throw new Error('Preview shim only supports numeric getRange');
    return new Range(this, r, c, nr || 1, nc || 1);
  };
  Sheet.prototype.getDataRange = function () { return new Range(this, 1, 1, Math.max(1, this.getLastRow()), Math.max(1, this.getLastColumn())); };
  Sheet.prototype.appendRow = function (vals) {
    var r = this.getLastRow() + 1, self = this;
    if (r > this.maxRows) this.maxRows = r;
    vals.forEach(function (v, j) { self.put(r, j + 1, v); });
    return this;
  };
  ['setFrozenRows', 'setColumnWidth', 'setTabColor', 'setHiddenGridlines'].forEach(function (m) {
    Sheet.prototype[m] = function () { return this; };
  });

  var sheets = [new Sheet('Sheet1')];
  var ss = {
    getSheetByName: function (n) { return sheets.filter(function (s) { return s.name === n; })[0] || null; },
    getSheets: function () { return sheets.slice(); },
    insertSheet: function (name, idx) {
      if (this.getSheetByName(name)) throw new Error('A sheet named ' + name + ' already exists');
      if (idx > sheets.length) throw new Error('insertSheet index out of range');
      var s = new Sheet(name);
      sheets.splice(idx == null ? sheets.length : idx, 0, s);
      return s;
    },
    deleteSheet: function (s) { sheets.splice(sheets.indexOf(s), 1); },
    getSpreadsheetTimeZone: function () { return tz; },
    setSpreadsheetTimeZone: function (t) { tz = t; },
    getUrl: function () { return 'https://docs.google.com/spreadsheets/d/PREVIEW/edit'; },
  };

  window.SpreadsheetApp = {
    getActive: function () { return ss; },
    newDataValidation: function () {
      var b = { requireValueInList: function () { return b; }, requireNumberBetween: function () { return b; }, setAllowInvalid: function () { return b; }, build: function () { return { __rule: true }; } };
      return b;
    },
  };
  window.Utilities = {
    formatDate: function (d, zone, fmt) {
      var parts = {};
      new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
        .formatToParts(d).forEach(function (x) { parts[x.type] = x.value; });
      return fmt.replace('yyyy', parts.year).replace('MM', parts.month).replace('dd', parts.day).replace('HH', parts.hour).replace('mm', parts.minute);
    },
  };
  window.Utilities.base64Encode = function (s) { return btoa(s); };
  window.Utilities.getUuid = function () {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 3 | 8)).toString(16);
    });
  };
  window.ScriptApp = { getService: function () { return { getUrl: function () { return 'https://script.google.com/macros/s/PREVIEW/exec'; } }; } };
  window.LockService = { getScriptLock: function () { return { waitLock: function () {}, releaseLock: function () {} }; } };
  var cache = {};
  window.CacheService = { getScriptCache: function () { return { get: function (k) { return cache[k] || null; }, put: function (k, v) { cache[k] = v; } }; } };
  window.UrlFetchApp = {
    fetch: function () {
      var body = { data: { matchedUser: { submitStatsGlobal: { acSubmissionNum: [
        { difficulty: 'All', count: 312 }, { difficulty: 'Easy', count: 118 }, { difficulty: 'Medium', count: 165 }, { difficulty: 'Hard', count: 29 }] } },
        userContestRanking: { rating: 1511.4, attendedContestsCount: 23 } } };
      return { getResponseCode: function () { return 200; }, getContentText: function () { return JSON.stringify(body); } };
    },
  };

  var props = { API_TOKEN: 'preview-token' };
  window.PropertiesService = {
    getScriptProperties: function () {
      return {
        getProperty: function (k) { return props[k] || null; },
        setProperty: function (k, v) { props[k] = v; },
        deleteProperty: function (k) { delete props[k]; },
      };
    },
  };
  window.ContentService = {
    MimeType: { JSON: 'JSON', TEXT: 'TEXT' },
    createTextOutput: function (text) { var o = { getContent: function () { return text; }, setMimeType: function () { return o; } }; return o; },
  };

  // Fetch mode (preview/fetch.html) behaves like GitHub Pages: no google.script.run, and requests to
  // the fake /exec URL go through the real doPost(). Custom headers are refused because the real
  // Apps Script endpoint can't answer a CORS preflight.
  if (window.__PREVIEW_FETCH) {
    var realFetch = window.fetch;
    window.fetch = function (url, opts) {
      if (String(url).indexOf('https://script.google.com/macros/s/PREVIEW/exec') !== 0) return realFetch.apply(this, arguments);
      if (opts && opts.headers) return Promise.reject(new TypeError('Custom headers would trigger a CORS preflight'));
      return new Promise(function (resolve) {
        setTimeout(function () {
          var out = window.doPost({ postData: { contents: opts.body } });
          resolve({ ok: true, status: 200, text: function () { return Promise.resolve(out.getContent()); } });
        }, 200);
      });
    };
    window.__preview = { sheets: sheets, ss: ss, props: props };
    return;
  }

  // google.script.run: async, JSON round-trip, and it refuses Dates and private (_) functions like the real bridge.
  function runner(ok, fail) {
    return new Proxy({}, {
      get: function (_, name) {
        if (name === 'withSuccessHandler') return function (f) { return runner(f, fail); };
        if (name === 'withFailureHandler') return function (f) { return runner(ok, f); };
        return function () {
          var args = JSON.parse(JSON.stringify(Array.prototype.slice.call(arguments)));
          setTimeout(function () {
            try {
              if (/_$/.test(name) || typeof window[name] !== 'function') throw new Error('Script function not found: ' + name);
              var res = window[name].apply(null, args);
              var out = res === undefined ? null : JSON.parse(JSON.stringify(res, function (k, v) {
                if (this[k] instanceof Date) throw new Error('Server returned a Date in "' + k + '"; the real bridge would drop it');
                return v;
              }));
              if (ok) ok(out);
            } catch (e) {
              console.error(e);
              if (fail) fail(e);
            }
          }, 150);
        };
      },
    });
  }
  window.google = { script: { run: runner() } };
  window.__preview = { sheets: sheets, ss: ss };
})();
