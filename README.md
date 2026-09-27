# SeniorLink

**We turn a neighbourhood into a support network.**

A senior says what they need in their own words → AI understands it → SeniorLink finds a trusted, verified neighbour nearby → the volunteer helps → family sees it was done.

Built for HackAtlantic · Fredericton, New Brunswick. Installable mobile web app (PWA).

## Run it

```bash
npm install
cp .env.local.example .env.local   # add Snowflake Cortex credentials (or a Claude API key)
npm run build && npm start         # http://localhost:3000   (or `npm run dev` while coding)
```

No key? Everything still works: an offline parser and rule-based fallbacks handle the demo, so it survives bad Wi-Fi.

**On an iPhone:** installing and notifications need HTTPS. Run a temporary tunnel (`cloudflared tunnel --url http://localhost:3000`), open the `https://…trycloudflare.com` link in Safari → Share → Add to Home Screen.

Press **Reset demo** on the welcome screen before each run. Data lives in memory on the server.

## Features

**Seniors** — Home · Medicines · Health · Safety
- Ask by voice or text (English & French); AI turns it into a request, reads it back, offers to combine errands.
- Rides: pick-up, destination, appointment time, round trip; live "waiting for a driver" → driver ETA → arrival time.
- Groceries: shopping list with quantities, store, substitutions, payment/budget; live "3 of 5 items found" and receipt total.
- Pharmacy: prescription / over-the-counter list, Rx numbers, one-tap add from their medicine list, pick-up permission.
- Medicines: daily schedule, Taken/Skip, spoken + push reminders, pill pictures (photo or drawn), refill → volunteer pickup.
- Health assistant: general info that knows their medicines, flags interactions, OTC-only suggestions, 911 / Tele-Care 811.
- Scam Watch: "Is this a scam?" checker, reports, community alerts.
- Profile photo, verified-only matching, approve/revoke family access, remove profile.

**Volunteers** — Help nearby · Hours & credit · Safety
- Matched requests, map, accept → progress steps; ride controls with directions; shopping/pharmacy checklists.
- Only offered what they can take (verified-only seniors, rides need a car).
- Hours log confirmed by seniors, milestones, send hours to UNB / STU / NBCC / Duke of Ed (simulated), AI impact statement, printable report.

**Family** — AI weekly summary, live ride ETA and shopping progress, medicine adherence (counts only), scam talking points, inactivity check-in. Never sees medicine names or messages.

**Also** — Join (senior / volunteer with ID check / family with approval), Donate (demo mode), Manage profiles.

## AI (Snowflake Cortex)

All AI runs through one function (`askAI` in `src/lib/ai.ts`). It uses **Snowflake Cortex** (REST Chat Completions with JSON-schema structured outputs, `src/lib/snowflake.ts`) when `SNOWFLAKE_ACCOUNT` + `SNOWFLAKE_PAT` are set; otherwise the direct Claude API; otherwise offline fallbacks. Model: `SNOWFLAKE_MODEL` (default `claude-sonnet-4-5`). The Snowflake user's role needs `SNOWFLAKE.CORTEX_USER` (or `CORTEX_REST_API_USER`).

| Feature | What it does |
|---|---|
| Request understanding | Speech → structured request, shopping/pharmacy lists, ride details. EN/FR. |
| Match explainer | Why this volunteer was chosen. |
| Family summary | Plain-language weekly update (privacy-safe titles). |
| Health assistant | Guarded general health info with medication-interaction checks. |
| Scam analysis & alerts | Classifies reports, removes reporter details, writes campaign alerts. |
| Impact statement | Volunteer reflection for co-curricular records. |

Emergencies ("chest pain") are detected locally before any AI call. Scam phone numbers / websites come from deterministic extraction, never from the model.

## How scam campaigns are detected

Reports are linked when they share a phone number, website or email; or impersonate the same organization with the same scam type; or use similar wording — within 30 days. Each connected group is a campaign (union–find). 3+ reports (or 2 with money lost) → community alert + push notification. See `src/lib/scams.ts`.

## Structure

```
src/lib/         store (all rules), seed data, AI, matching, scams, ETA, medicines, places, funds
src/app/         pages: / · /join · /senior · /volunteer · /volunteer/report · /family · /donate
src/app/api/     state, parse, requests, meds, health-chat, scams, members, photos, credit, donate…
src/components/  UI kit, map, tabs, Medicines, HealthChat, ScamWatch, TaskDetails, VolunteerHours…
public/          service worker, app icons        assets/  original logo
```

## Prototype limits

In-memory data (resets on restart) · no real authentication · simulated ID checks, school connections, payments and driver GPS · reminders/alerts fire while the app is open or backgrounded (closed-app push needs a push server).
