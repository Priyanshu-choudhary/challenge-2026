# Prompts for AI assistants

Two ways an assistant reaches your tracker:

- **Coding agents with a shell** (Claude Code, Gemini CLI, Codex) in this folder: they use `node tools/c26.mjs` (see its header for commands). The connection lives in `.c26.json`, which git ignores.
- **Chat assistants** (claude.ai, Gemini, ChatGPT): give them access to the Google Sheet through their Drive or Sheets connector, and start the conversation with:

> Read my Google Sheet "Challenge 2026 Tracker", starting with the AI_GUIDE tab, and follow its rules.

Every prompt below works either way. Replace the brackets.

## Every day

- **Start the day:** "Read my Challenge 2026 tracker. What are my top 3 for today, given this week's plan, what's due for revision, and yesterday's log?"
- **Revision:** "Quiz me on everything due today, one question at a time. After each answer, tell me what I missed, grade me again / hard / good / easy, and record the review."
- **Log problems:** "Log these problems: [link], [hint / solution / solved alone], key idea: [one line]. [next problem...]"
- **Log the day:** "Log today: [hours]h, [N] DSA, LLD: [what], CS/HLD: [what], energy [1-5], tomorrow: [top 3]."
- **Stuck on a problem:** "I'm on [problem]. Give me one hint at a time, not the solution. When I solve it, log it with the key idea in my words."

## Planning

- **Re-plan after a slip:** "I lost [N] days. Re-plan this week: move what slipped, keep DSA and LLD daily, and show me the changes before you edit anything outside this week."
- **Fill a week:** "Look at my Problems tab. Which topics have the most 'hint' and 'solution' results? Add 2 tasks to next week's plan that target them."
- **Cards for a topic:** "Add 10 Cards on [topic], subject [DSA / Java / OS / ...], with answers I can say in 60 to 90 seconds, each with one example. Set them due on the day the plan reaches that topic."
- **Company prep:** "I have a [company] interview on [date]. Add a prep task for each day until then and 10 cards on what they usually ask."

## Weekly and monthly

- **Sunday review:** "Weekly review: tasks done vs planned, problems by topic, hours vs my 10h a day target, mocks and their mistakes. What should change next week? Ask before editing the plan."
- **Month end:** "Compare this month's goals with my numbers. Suggest which goals to mark done or missed, then do it after I agree."

## Mock interviews

- **DSA:** "Run a 45-minute DSA interview with one medium [topic] problem. Make me clarify, think aloud, code and dry-run. Then score me out of 10 and log it in Mocks with mistakes and fixes."
- **LLD:** "Interview me on designing [Parking Lot / Elevator / BookMyShow] in 45 minutes. Push on class design, patterns and concurrency. Log it in Mocks."
- **CS rapid-fire:** "Ask me 15 rapid-fire questions on [Java / OS / DBMS]. For each one I miss, add a card with the answer I should have given."
- **HR:** "Ask me 'Tell me about yourself' and three behavioural questions. Rewrite my answers in STAR form and save them as HR cards."
