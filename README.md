# Challenge 2026

A one-page daily tracker for placement prep: a checklist for Revision, DSA, LLD, Concurrency, Other and GATE, a study timer and a clock.

- **App:** https://priyanshu-choudhary.github.io/challenge-2026/
- **Data:** saved in your browser's local storage only. Nothing is sent to Google Drive, Sheets or any server.
- **The plan:** [PLAN.md](PLAN.md), 13 weeks to interview-ready

## Daily use

The page is one screen:

- **Clock and timer:** the current time, and a study timer that stays pinned to the top. Start it from a category (Revision, DSA, LLD, Concurrency, Other, GATE) or from the ▶ next to a checklist item. Pause, resume, then **Stop & log** saves the minutes to the time log. The timer keeps running across reloads, and every open tab of the page shows the same timer.
- **Today's checklist:** your daily to-dos grouped by category, with the time logged for each category. **Edit list** adds items (every day, or today only), renames them, or removes them. Removing a daily item keeps it on past days, so your history stays right.
- **Last 7 days:** items done and hours per day. Tap a day to see it, tick things you forgot, or add time.
- **Time log:** the sessions for the selected day, plus a box to add time if you forgot the timer.

### Your data

Everything is stored in this browser's local storage (keys `c26.data` and `c26.timer2`). It does not sync between devices or browsers, and clearing site data or using a private window loses it. **Backup** (bottom of the page) downloads a JSON file; **Restore** loads one, on this or any other device.

## Development

Edit `src/`, then run `node build.mjs`. It writes:

| Output | What it is |
|---|---|
| `dist/Code.gs` | The Apps Script file to paste (server code plus the plan seed) |
| `docs/index.html` | The page GitHub Pages serves (self-contained, no server) |
| `preview/index.html`, `preview/fetch.html` | Local test pages running the real server code against a fake in-memory sheet (ignored by git) |
| `PLAN.md` | A readable copy of the plan |

After changing the page, push to `main`; Pages redeploys `docs/`.

The Google Sheet backend (`src/Server.gs`, `src/Seed.gs`, `dist/Code.gs`, `tools/c26.mjs`) is no longer used by the page. It is kept for reference only.

Using this for your own plan: edit `src/Seed.gs` (plan, goals, routine, cards, settings) and `APP_URL_` in `src/Server.gs`.

| Source | What it is |
|---|---|
| `src/Server.gs` | Web API (`doPost` with token check), sheet menu, setup, reads, writes, reviews, LeetCode stats, ChangeLog |
| `src/Seed.gs` | Tab layouts, the starting daily checklist, the week-by-week plan, goals, routine, starter cards, settings, AI guide |
| `src/Index.html` | The single-page app |
| `src/preview-shim.js` | Fake Apps Script services for the local previews |
