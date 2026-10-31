#!/usr/bin/env node
// Command-line access to the Challenge 2026 API, for you or any AI agent with a shell
// (Claude Code, Gemini CLI, Codex). Same rules as the sheet's AI_GUIDE tab: no deletes,
// archive instead, every write lands in ChangeLog.
//
// Connection: C26_URL and C26_TOKEN env vars, or .c26.json next to this repo's README:
//   { "url": "https://script.google.com/macros/s/.../exec", "token": "..." }
// .c26.json is git-ignored. C26_ACTOR names who is writing (default "claude").
//
// Usage:
//   node tools/c26.mjs today                         this week's tasks, due revision, today's log
//   node tools/c26.mjs due                           problems and cards due now
//   node tools/c26.mjs get <Tab> [field=value ...]   rows of a tab, optionally filtered
//   node tools/c26.mjs add <Tab> '<json>'            add a row (ids and review dates are set for you)
//   node tools/c26.mjs update <Tab> <id> '<json>'    change fields of one row (DailyLog uses the date as id)
//   node tools/c26.mjs archive <Tab> <id>            soft delete
//   node tools/c26.mjs review <Problems|Cards> <id> <again|hard|good|easy>
//   node tools/c26.mjs day '<json>'                  add or update a DailyLog row (needs "date")
//   node tools/c26.mjs lc                            live LeetCode stats
import { readFileSync, existsSync } from 'node:fs';

const cfgPath = new URL('../.c26.json', import.meta.url);
const file = existsSync(cfgPath) ? JSON.parse(readFileSync(cfgPath, 'utf8')) : {};
const URL_ = process.env.C26_URL || file.url;
const TOKEN = process.env.C26_TOKEN || file.token;
const ACTOR = process.env.C26_ACTOR || file.actor || 'claude';

async function api(fn, ...args) {
  if (!URL_ || !TOKEN) throw new Error('No connection: set C26_URL and C26_TOKEN, or create .c26.json');
  const res = await fetch(URL_, { method: 'POST', body: JSON.stringify({ token: TOKEN, actor: ACTOR, fn, args }) });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { throw new Error(`Apps Script answered HTTP ${res.status} without JSON. Is the deployment access "Anyone"?`); }
  if (!body.ok) throw new Error(body.error);
  return body.result;
}

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const live = (rows) => rows.filter((r) => r.status !== 'archived');
const parse = (s) => {
  try { return JSON.parse(s); } catch { throw new Error('Expected a JSON object, got: ' + s); }
};
const print = (x) => console.log(typeof x === 'string' ? x : JSON.stringify(x, null, 2));

function dueRows(tabs) {
  const t = today();
  const tag = (tab) => (r) => ({ tab, ...r });
  return live(tabs.Problems).map(tag('Problems')).concat(live(tabs.Cards).map(tag('Cards')))
    .filter((r) => !r.next_review || String(r.next_review) <= t)
    .sort((a, b) => String(a.next_review).localeCompare(String(b.next_review)));
}

const [cmd, ...rest] = process.argv.slice(2);
const commands = {
  async today() {
    const d = await api('getAll');
    const t = today();
    const plan = live(d.tabs.Plan);
    const week = plan.find((p) => p.start <= t && t <= p.end)?.week;
    print({
      today: t,
      week,
      tasks: plan.filter((p) => p.week === week).map((p) => `${p.id} [${p.status}] ${p.track}: ${p.task}`),
      due: dueRows(d.tabs).map((r) => `${r.tab} ${r.id}: ${r.title || r.question}`),
      log: d.tabs.DailyLog.find((x) => x.date === t) || null,
      goals: live(d.tabs.Goals).filter((g) => g.month === t.slice(0, 7)).map((g) => `${g.id} [${g.status}] ${g.area}: ${g.goal}`),
    });
  },
  async due() {
    print(dueRows((await api('getAll')).tabs));
  },
  async get(tab, ...filters) {
    const rows = (await api('getAll')).tabs[tab];
    if (!rows) throw new Error('Unknown tab: ' + tab);
    print(rows.filter((r) => filters.every((f) => { const [k, v] = f.split('='); return String(r[k]) === v; })));
  },
  async add(tab, json) { print(await api('addRow', tab, parse(json))); },
  async update(tab, id, json) { print(await api('updateRow', tab, id, parse(json))); },
  async archive(tab, id) { print(await api('updateRow', tab, id, { status: 'archived' })); },
  async review(tab, id, grade) { print(await api('review', tab, id, grade)); },
  async day(json) { print(await api('upsertDay', parse(json))); },
  async lc() { print(await api('getLeetCode')); },
};

if (!commands[cmd]) {
  console.log(readFileSync(new URL(import.meta.url), 'utf8').split('\n').filter((l) => l.startsWith('//')).map((l) => l.slice(3)).join('\n'));
  process.exit(cmd ? 1 : 0);
}
commands[cmd](...rest).catch((e) => { console.error('Error: ' + e.message); process.exit(1); });
