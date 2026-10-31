# Challenge 2026

A one-page tracker for a placement-season prep plan (DSA, LLD, CS fundamentals, HLD), backed by a Google Sheet that you, the app and any AI assistant can all read and edit.

- **App:** https://priyanshu-choudhary.github.io/challenge-2026/ (a static page; it shows a connect screen until you link it to your own sheet)
- **Data:** your own Google Sheet, with a small Apps Script API in front of it ([dist/Code.gs](dist/Code.gs))
- **The plan:** [PLAN.md](PLAN.md), 13 weeks to interview-ready, then interview season

## How it fits together

```
GitHub Pages (docs/index.html)  --POST, token-->  Apps Script web app (dist/Code.gs)  -->  Google Sheet tabs
AI assistants (Claude, Gemini, ...)  ------------------ edit the sheet directly, following its AI_GUIDE tab --^
```

No data or secrets live in this repository. The page stores the web app URL and a connect token in your browser only.

## Setup

1. Create a Google Sheet, open **Extensions > Apps Script**, replace `Code.gs` with [dist/Code.gs](dist/Code.gs), and save.
2. Pick **setup** in the function menu and press **Run**. Allow access; Google warns that the app isn't verified because it's your own script (**Advanced > Go to project > Allow**). The sheet gets its tabs, the plan and starter interview cards.
3. **Deploy > New deployment > Web app**. Execute as: **Me**. Who has access: **Anyone**. Deploy.
   Already deployed with "Only myself"? Use **Deploy > Manage deployments > Edit**, choose **New version**, set access to **Anyone**, and deploy. The URL stays the same.
4. Reload the sheet. In the new **Challenge 2026** menu choose **Connect a device**, check the URL ends in `/exec`, and open the connect link on each device you use (send it to your phone privately).

Why "Anyone" is safe here: the web app serves no page and no data without the connect token, which is a random 64-character value kept in the script's properties. **Challenge 2026 > New connect token** replaces it and signs out every device.

## Daily use

- **Today:** this week's tasks, how to shape the day, whether today is logged, this month's goals.
- **Revise:** problems and cards that are due. Recall, reveal, grade Again / Hard / Good / Easy; the next review lands 1, 3, 7, 14, 30, 60 or 120 days out.
- **Log:** a problem (paste a LeetCode link and the title fills in), a card, the day, or a mock interview.
- **Roadmap:** every week and month with progress; add or edit tasks and goals.
- **History:** problems with a weak-topic chart, cards, a 5-week hours heatmap, mocks.

Nothing is deleted from the app: **Archive** sets a row's status to `archived` and offers Undo.

## AI assistants

The sheet's **AI_GUIDE** tab tells any assistant the rules (append only, soft delete, allowed values, the review formula) and to log each change in **ChangeLog**. **File > Version history** undoes anything. Give the assistant access to the sheet (Claude's Google Sheets connector, Gemini in Sheets, or any tool with Drive or Sheets access) and start with:

> Read my Google Sheet "Challenge 2026 Tracker", starting with the AI_GUIDE tab, and follow its rules. Then tell me what to focus on today.

More prompts are at the bottom of the AI_GUIDE tab.

## Development

Edit `src/`, then run `node build.mjs`. It writes:

| Output | What it is |
|---|---|
| `dist/Code.gs` | The Apps Script file to paste (server code plus the plan seed) |
| `docs/index.html` | The page GitHub Pages serves |
| `preview/index.html`, `preview/fetch.html` | Local test pages running the real server code against a fake in-memory sheet (ignored by git) |
| `PLAN.md` | A readable copy of the plan |

After changing the server, paste the new `dist/Code.gs` and publish a new version under **Manage deployments**. After changing the page, push to `main`; Pages redeploys `docs/`.

Using this for your own plan: edit `src/Seed.gs` (plan, goals, routine, cards, settings) and `APP_URL_` in `src/Server.gs`.

| Source | What it is |
|---|---|
| `src/Server.gs` | Web API (`doPost` with token check), sheet menu, setup, reads, writes, reviews, LeetCode stats, ChangeLog |
| `src/Seed.gs` | Tab layouts, the week-by-week plan, goals, routine, starter cards, settings, AI guide |
| `src/Index.html` | The single-page app |
| `src/preview-shim.js` | Fake Apps Script services for the local previews |
