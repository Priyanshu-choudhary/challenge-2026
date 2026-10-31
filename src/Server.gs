/**
 * Challenge 2026 tracker: server side, bound to the tracker spreadsheet.
 * The page (hosted on GitHub Pages) calls doPost() with a secret token; AI assistants
 * edit the same tabs directly, following the AI_GUIDE tab.
 * Rows are found by id (never by position), deletes are soft (status "archived"),
 * and every write is recorded in ChangeLog.
 * @OnlyCurrentDoc
 */

const APP_URL_ = 'https://priyanshu-choudhary.github.io/challenge-2026/';
const KEYS_ = { Plan: 'id', Goals: 'id', Problems: 'id', Cards: 'id', Mocks: 'id', DailyLog: 'date', Config: 'key' };
const PREFIX_ = { Plan: 'T-', Goals: 'G-', Problems: 'P-', Cards: 'C-', Mocks: 'M-' };
const APP_TABS_ = ['Plan', 'Goals', 'Routine', 'Problems', 'Cards', 'DailyLog', 'Mocks', 'Config'];
const INTERVALS_ = [1, 3, 7, 14, 30, 60, 120];
let TZ_ = null;
let ACTOR_ = 'app'; // who ChangeLog credits; an API caller can name itself (e.g. "claude")

// ---------- connecting a device ----------

/**
 * The first function in the file, so it is what the editor's Run button runs by default.
 * It checks that the web app answers, then prints the connect link in the Execution log.
 */
function showConnectLink() {
  setup();
  const url = webAppUrl_();
  const check = probeWebApp_(url);
  console.log('Web app URL: ' + (url || '(none)'));
  if (check !== 'ok') {
    console.log('Problem: ' + check);
    console.log('Fix: in Apps Script open Deploy > Manage deployments, select the Web app deployment and copy its Web app URL ' +
      '(ends in /exec). In the sheet\'s Config tab put it in the row with key api_url (add that row if it is missing), ' +
      'make sure "Who has access" is Anyone, then press Run again.');
    return;
  }
  console.log('Connect link. Open it once on each device and keep it private:\n' +
    APP_URL_ + '#connect=' + Utilities.base64Encode(JSON.stringify({ u: url, t: apiToken_() })));
}

/** Replaces the token, which signs out every connected device. Safe to run from the editor. */
function newConnectToken() {
  PropertiesService.getScriptProperties().deleteProperty('API_TOKEN');
  apiToken_();
  const msg = 'New connect token created; every device is signed out. Run showConnectLink (or use Connect a device) to get the new link.';
  console.log(msg);
  SpreadsheetApp.getActive().toast(msg, 'Challenge 2026', 10);
}

// ScriptApp.getService().getUrl() can return the editor's test deployment, which answers 404
// at /exec, so a URL saved in Config (key api_url) wins.
function webAppUrl_() {
  const saved = configValue_('api_url');
  return saved || ScriptApp.getService().getUrl() || '';
}

function probeWebApp_(url) {
  if (!url) return 'the script has no web app deployment yet (Deploy > New deployment > Web app).';
  if (!/\/exec$/.test(url)) return 'the URL does not end in /exec.';
  let res;
  try {
    res = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
  } catch (e) {
    return 'the URL could not be fetched (' + e.message + ').';
  }
  const code = res.getResponseCode();
  const text = res.getContentText();
  if (code === 200 && text.indexOf('Challenge 2026 API is running') >= 0) return 'ok';
  if (code === 404) return 'nothing is deployed at this URL (HTTP 404). It is probably the editor\'s test URL, not your deployment\'s.';
  if (/accounts\.google\.com|ServiceLogin|Sign in/i.test(text)) return 'the deployment asks visitors to sign in, so its access is not set to Anyone.';
  return 'the deployment answered HTTP ' + code + ' without the expected text. Publish a new version of the latest code under Manage deployments.';
}

// ---------- web API ----------
// Deployed as a web app with access "Anyone", so every request must carry the token
// kept in Script Properties. No HtmlService page is served publicly, which keeps
// google.script.run out of reach of anyone who finds the URL.

function doGet() {
  return ContentService.createTextOutput('Challenge 2026 API is running. The app is at ' + APP_URL_);
}

function doPost(e) {
  let out;
  try {
    const req = JSON.parse(e && e.postData ? e.postData.contents : '{}');
    const token = PropertiesService.getScriptProperties().getProperty('API_TOKEN');
    if (!token || req.token !== token) {
      throw new Error('Not connected: this device has no valid token. In the sheet use Challenge 2026 > Connect a device.');
    }
    ACTOR_ = /^[a-z][a-z0-9-]{0,19}$/.test(req.actor || '') ? req.actor : 'app';
    const api = { getAll: getAll, addRow: addRow, updateRow: updateRow, upsertDay: upsertDay, review: review, getLeetCode: getLeetCode };
    if (!Object.prototype.hasOwnProperty.call(api, req.fn)) throw new Error('Unknown function: ' + req.fn);
    out = { ok: true, result: api[req.fn].apply(null, Array.isArray(req.args) ? req.args : []) };
  } catch (err) {
    out = { ok: false, error: String(err && err.message ? err.message : err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

// ---------- sheet menu ----------

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Challenge 2026')
    .addItem('Open the app', 'openApp')
    .addItem('Connect a device', 'connectDevice')
    .addItem('New connect token (signs out every device)', 'newConnectToken')
    .addSeparator()
    .addItem('Repair missing tabs', 'setup')
    .addToUi();
}

function openApp() {
  const html = HtmlService.createHtmlOutput('<div style="font:14px Arial,sans-serif"><p><a href="' + APP_URL_ +
    '" target="_blank">Open Challenge 2026</a></p><p style="color:#666">First time on a device? Use Challenge 2026 &gt; Connect a device.</p></div>')
    .setWidth(360).setHeight(130);
  SpreadsheetApp.getUi().showModalDialog(html, 'Challenge 2026');
}

function connectDevice() {
  setup();
  const data = JSON.stringify({ app: APP_URL_, url: webAppUrl_(), token: apiToken_() });
  const html = HtmlService.createHtmlOutput(CONNECT_HTML_.replace('%DATA%', () => data.replace(/</g, '\\u003c')))
    .setWidth(480).setHeight(400);
  SpreadsheetApp.getUi().showModalDialog(html, 'Connect a device');
}

function apiToken_() {
  const props = PropertiesService.getScriptProperties();
  let token = props.getProperty('API_TOKEN');
  if (!token) {
    token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
    props.setProperty('API_TOKEN', token);
  }
  return token;
}

const CONNECT_HTML_ = '<div style="font:14px/1.45 Arial,sans-serif">' +
  '<p style="margin-top:0">Open the connect link once on each device (laptop, phone). It saves the connection in that browser only.</p>' +
  '<label>Web app URL, must end in <b>/exec</b><br><input id="u" style="width:100%;padding:6px;box-sizing:border-box"></label>' +
  '<p id="warn" style="color:#c2410c;margin:4px 0"></p>' +
  '<label>Connect link<br><textarea id="link" rows="5" style="width:100%;box-sizing:border-box" readonly onclick="this.select()"></textarea></label>' +
  '<p><a id="open" target="_blank">Open the app on this computer, connected</a></p>' +
  '<p style="color:#666;font-size:12px">Anyone with this link can edit your tracker, so don\'t post it publicly. Send it to your phone privately (for example, email it to yourself). To cut off every device, use Challenge 2026 &gt; New connect token.</p></div>' +
  '<script>var D = %DATA%; var u = document.getElementById("u");' +
  'function upd() { var v = u.value.trim(); var ok = /\\/exec$/.test(v);' +
  ' document.getElementById("warn").textContent = ok ? "" : "Use the /exec URL from Deploy > Manage deployments (a /dev URL will not work).";' +
  ' var link = D.app + "#connect=" + btoa(JSON.stringify({ u: v, t: D.token }));' +
  ' document.getElementById("link").value = link; document.getElementById("open").href = link; }' +
  'u.value = D.url; u.oninput = upd; upd();</script>';

// ---------- setup: creates missing tabs only, never touches existing ones ----------

function setup() {
  const ss = SpreadsheetApp.getActive();
  if (TAB_ORDER_.every(n => ss.getSheetByName(n))) return [];
  return withLock_(() => {
    if (!ss.getSheetByName('Config')) {
      ss.setSpreadsheetTimeZone('Asia/Kolkata');
      TZ_ = null;
    }
    const created = [];
    TAB_ORDER_.forEach((name, i) => {
      if (ss.getSheetByName(name)) return;
      const sh = ss.insertSheet(name, Math.min(i, ss.getSheets().length));
      buildTab_(sh, SCHEMA_[name], seedRows_(name));
      created.push(name);
    });
    const blank = ss.getSheetByName('Sheet1');
    if (blank && blank.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(blank);
    log_('app', 'setup', '', '', 'Created tabs: ' + created.join(', '));
    return created;
  });
}

function buildTab_(sh, def, rows) {
  const n = def.headers.length;
  const max = sh.getMaxRows();
  const col = h => def.headers.indexOf(h) + 1;
  // Formats first, so dates read as dates and ids or months stay text when values land.
  (def.dates || []).forEach(h => sh.getRange(2, col(h), max - 1, 1).setNumberFormat('yyyy-mm-dd'));
  (def.text || []).forEach(h => sh.getRange(1, col(h), max, 1).setNumberFormat('@'));
  sh.getRange(1, 1, 1, n).setValues([def.headers]).setFontWeight('bold').setBackground('#e8eaed');
  if (rows.length) sh.getRange(2, 1, rows.length, n).setValues(rows);
  sh.setFrozenRows(1);
  (def.widths || []).forEach((w, i) => sh.setColumnWidth(i + 1, w));
  (def.wrap || []).forEach(h => sh.getRange(1, col(h), max, 1).setWrap(true));
  sh.getRange(1, 1, max, n).setVerticalAlignment('top');
  Object.keys(def.lists || {}).forEach(h => {
    const rule = SpreadsheetApp.newDataValidation().requireValueInList(def.lists[h], true).setAllowInvalid(true).build();
    sh.getRange(2, col(h), max - 1, 1).setDataValidation(rule);
  });
  if (def.color) sh.setTabColor(def.color);
  sh.getRange(1, 1, 1, n).protect().setDescription('Column names: the app and AI assistants rely on them').setWarningOnly(true);
}

// ---------- reads ----------

function getAll() {
  setup();
  return withLock_(() => {
    const out = { today: today_(), intervals: INTERVALS_, lists: LISTS_, sheetUrl: SpreadsheetApp.getActive().getUrl(), tabs: {} };
    APP_TABS_.forEach(name => {
      const { sh, headers, values } = readTab_(name);
      const prefix = PREFIX_[name];
      const idCol = headers.indexOf('id');
      let next = prefix && idCol >= 0 ? maxId_(values, idCol) + 1 : 0;
      const rows = [];
      values.forEach((r, i) => {
        if (r.every(c => c === '' || c === null)) return;
        // A row added by hand or by an AI without an id gets one, so the app can address it.
        if (prefix && idCol >= 0 && String(r[idCol]).trim() === '') {
          r[idCol] = prefix + pad_(next++);
          sh.getRange(i + 2, idCol + 1).setValue(r[idCol]);
          log_('app', 'fill-id', name, r[idCol], 'Gave an id to a row added without one');
        }
        rows.push(toObj_(headers, r));
      });
      out.tabs[name] = rows;
    });
    return out;
  });
}

function getLeetCode() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('lc');
  if (hit) return JSON.parse(hit);
  const user = configValue_('leetcode');
  if (!user) return null;
  const query = 'query($u:String!){matchedUser(username:$u){submitStatsGlobal{acSubmissionNum{difficulty count}}}' +
    ' userContestRanking(username:$u){rating attendedContestsCount}}';
  try {
    const res = UrlFetchApp.fetch('https://leetcode.com/graphql', {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { Referer: 'https://leetcode.com' },
      payload: JSON.stringify({ query: query, variables: { u: user } }),
    });
    if (res.getResponseCode() !== 200) return null;
    const data = JSON.parse(res.getContentText()).data;
    if (!data || !data.matchedUser) return null;
    const counts = {};
    data.matchedUser.submitStatsGlobal.acSubmissionNum.forEach(x => { counts[x.difficulty.toLowerCase()] = x.count; });
    const ranking = data.userContestRanking;
    const out = {
      all: counts.all, easy: counts.easy, medium: counts.medium, hard: counts.hard,
      rating: ranking ? Math.round(ranking.rating) : null,
      contests: ranking ? ranking.attendedContestsCount : null,
      checked: today_(),
    };
    cache.put('lc', JSON.stringify(out), 3600);
    withLock_(() => {
      setConfig_('lc_solved_now', out.all);
      setConfig_('lc_rating_now', out.rating === null ? '' : out.rating);
      setConfig_('lc_checked_on', out.checked);
    });
    return out;
  } catch (e) {
    return null;
  }
}

// ---------- writes ----------

function addRow(tab, obj) {
  return withLock_(() => addRow_(tab, obj, ACTOR_));
}

function updateRow(tab, key, patch) {
  return withLock_(() => updateRow_(tab, key, patch, ACTOR_, patch && patch.status === 'archived' ? 'archive' : 'update'));
}

/** DailyLog has one row per date: update it if it exists, otherwise add it. */
function upsertDay(obj) {
  return withLock_(() => {
    const { headers, values } = readTab_('DailyLog');
    const k = headers.indexOf('date');
    if (values.some(r => norm_(r[k], 'date') === obj.date)) {
      const patch = Object.assign({}, obj);
      delete patch.date;
      return updateRow_('DailyLog', obj.date, patch, ACTOR_, 'update');
    }
    return addRow_('DailyLog', obj, ACTOR_);
  });
}

/** Spaced-repetition review of a problem or card. grade: again | hard | good | easy. */
function review(tab, id, grade) {
  if (tab !== 'Problems' && tab !== 'Cards') throw new Error('Only Problems and Cards can be reviewed');
  if (LISTS_.grade.indexOf(grade) < 0) throw new Error('Unknown grade: ' + grade);
  return withLock_(() => {
    const { headers, values } = readTab_(tab);
    const k = headers.indexOf('id');
    const row = values.find(r => String(norm_(r[k], 'id')) === String(id));
    if (!row) throw new Error(tab + ' has no row ' + id + '. Reload the app.');
    const rec = toObj_(headers, row);
    const next = schedule_(Number(rec.stage) || 0, grade);
    const top = INTERVALS_.length - 1;
    const patch = {
      stage: next.stage,
      next_review: addDays_(today_(), next.days),
      last_grade: grade,
      reviews: (Number(rec.reviews) || 0) + 1,
      status: next.stage >= top ? 'mastered' : 'active',
    };
    return updateRow_(tab, id, patch, ACTOR_, 'review');
  });
}

function schedule_(stage, grade) {
  const top = INTERVALS_.length - 1;
  stage = Math.max(0, Math.min(top, stage));
  if (grade === 'again') return { stage: 0, days: INTERVALS_[0] };
  if (grade === 'hard') return { stage: stage, days: Math.max(1, Math.round(INTERVALS_[stage] / 2)) };
  const s = Math.min(top, stage + (grade === 'easy' ? 2 : 1));
  return { stage: s, days: INTERVALS_[s] };
}

function addRow_(tab, obj, actor) {
  if (APP_TABS_.indexOf(tab) < 0) throw new Error('Rows cannot be added to ' + tab);
  const { sh, headers, values } = readTab_(tab);
  const rec = Object.assign({}, obj);
  const prefix = PREFIX_[tab];
  if (prefix) rec.id = prefix + pad_(maxId_(values, headers.indexOf('id')) + 1);
  if (tab === 'Problems' || tab === 'Cards') startReview_(tab, rec);
  sh.appendRow(headers.map(h => clean_(rec[h])));
  log_(actor, 'add', tab, rec[KEYS_[tab]] || '', label_(rec));
  return rec;
}

function updateRow_(tab, key, patch, actor, action) {
  const keyName = KEYS_[tab];
  if (!keyName) throw new Error('Rows in ' + tab + ' cannot be edited from the app');
  const { sh, headers, values } = readTab_(tab);
  const k = headers.indexOf(keyName);
  const i = values.findIndex(r => String(norm_(r[k], keyName)) === String(key));
  if (i < 0) throw new Error(tab + ' has no row ' + key + '. It may have been changed elsewhere; reload.');
  const changed = [];
  Object.keys(patch || {}).forEach(h => {
    const c = headers.indexOf(h);
    if (c < 0 || h === keyName) return;
    sh.getRange(i + 2, c + 1).setValue(clean_(patch[h]));
    changed.push(h);
  });
  const rec = Object.assign(toObj_(headers, values[i]), patch);
  log_(actor, action, tab, key, label_(rec) + ' [' + changed.join(', ') + ']');
  return rec;
}

function startReview_(tab, rec) {
  if (tab === 'Problems') {
    const base = rec.date || today_();
    rec.date = base;
    rec.stage = rec.result === 'solved' ? 1 : 0;
    rec.next_review = addDays_(base, INTERVALS_[rec.stage]);
  } else {
    rec.stage = 0;
    rec.next_review = rec.next_review || addDays_(today_(), 1);
    rec.source = rec.source || (ACTOR_ === 'app' ? 'me' : ACTOR_);
  }
  rec.reviews = 0;
  rec.last_grade = '';
  rec.status = 'active';
}

// ---------- helpers ----------

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function readTab_(name) {
  const sh = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sh) throw new Error('The ' + name + ' tab is missing. Use Challenge 2026 > Repair missing tabs in the sheet.');
  const values = sh.getDataRange().getValues();
  const headers = values.shift().map(h => String(h).trim());
  return { sh: sh, headers: headers, values: values };
}

function toObj_(headers, row) {
  const o = {};
  headers.forEach((h, j) => { if (h) o[h] = norm_(row[j], h); });
  return o;
}

// Sheets hands back Date objects for date cells; the app and the bridge want plain strings.
function norm_(v, header) {
  if (v instanceof Date) {
    const fmt = header === 'time' ? 'yyyy-MM-dd HH:mm' : header === 'month' ? 'yyyy-MM' : 'yyyy-MM-dd';
    return Utilities.formatDate(v, tz_(), fmt);
  }
  return typeof v === 'string' ? v.trim() : v;
}

// Text starting with "=" would become a formula; the apostrophe keeps it as text.
function clean_(v) {
  if (v === undefined || v === null) return '';
  if (typeof v === 'string' && v.charAt(0) === '=') return "'" + v;
  return v;
}

function label_(rec) {
  return String(rec.title || rec.task || rec.goal || rec.question || rec.summary || rec.type || '').slice(0, 80);
}

function maxId_(values, idCol) {
  let max = 0;
  if (idCol < 0) return max;
  values.forEach(r => {
    const m = String(r[idCol]).match(/(\d+)\s*$/);
    if (m) max = Math.max(max, Number(m[1]));
  });
  return max;
}

function configValue_(key) {
  const { headers, values } = readTab_('Config');
  const k = headers.indexOf('key');
  const v = headers.indexOf('value');
  const row = values.find(r => String(r[k]).trim() === key);
  return row ? String(row[v]).trim() : '';
}

function setConfig_(key, value) {
  const { sh, headers, values } = readTab_('Config');
  const k = headers.indexOf('key');
  const i = values.findIndex(r => String(r[k]).trim() === key);
  if (i < 0) sh.appendRow([key, String(value), '']);
  else sh.getRange(i + 2, headers.indexOf('value') + 1).setValue(String(value));
}

function log_(actor, action, tab, rowId, summary) {
  const sh = SpreadsheetApp.getActive().getSheetByName('ChangeLog');
  if (!sh) return;
  // Leading apostrophes keep the time and ids (some are dates) as text past the pre-formatted rows.
  const text = v => (v === '' || v == null ? '' : "'" + v);
  sh.appendRow([text(Utilities.formatDate(new Date(), tz_(), 'yyyy-MM-dd HH:mm')), actor, action, tab, text(rowId), String(summary || '').slice(0, 200)]);
}

function tz_() {
  if (!TZ_) TZ_ = SpreadsheetApp.getActive().getSpreadsheetTimeZone();
  return TZ_;
}

function today_() {
  return Utilities.formatDate(new Date(), tz_(), 'yyyy-MM-dd');
}

// Pure calendar arithmetic in UTC, so script and sheet time zones can't shift the date.
function addDays_(iso, n) {
  const p = String(iso).split('-').map(Number);
  return new Date(Date.UTC(p[0], p[1] - 1, p[2] + n)).toISOString().slice(0, 10);
}

function pad_(n) {
  return String(n).padStart(4, '0');
}
