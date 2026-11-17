# Bringing the FFSA Fleet app into the FFSA Hub with Claude Code

Do one step at a time. After each step, read what Claude Code says, try it, and only then go on. Each step works on its own branch and ends in a pull request, so nothing reaches the live Hub until Jack has reviewed and merged it.

## Step 0: put this folder in the Hub repo

1. Unzip `ffsa-vehicles-module.zip`. You get a folder called `vehicles-module`.
2. On GitHub, open the FFSA Hub repo. Click the branch menu, type `vehicles-module`, and choose **Create branch: vehicles-module**.
3. On that branch: **Add file → Upload files**, and drag the whole `vehicles-module` folder onto the page (Chrome or Edge keep the folders). Commit message: `Add FFSA Fleet app (vehicles-module)`. Choose **Commit directly to the vehicles-module branch**.
4. The repo is private, right? `vehicles-module/seed` holds FFSA's vehicle details. Don't upload it to a public repo.

## Step 1: look around and plan (changes nothing in the Hub)

Open Claude Code on the FFSA Hub repo, on the `vehicles-module` branch, and paste:

> The folder `vehicles-module/` is the FFSA Fleet app: the vehicle inspection app I use today, with a small Node server, FFSA's real data, a spec and tests. I want it to run inside the FFSA Hub and work exactly the same way. Read `vehicles-module/README.md`, `vehicles-module/CLAUDE.md` and `vehicles-module/docs/SPEC.md` first.
>
> 1. Run it as it is: in `vehicles-module`, run `npm run seed` and `npm test`, start it with `npm start`, and check it works (the page loads, `/api/db/fleet` returns 6 vehicles). No API key needed. If `vehicles-module/.gitignore` is missing, create it with `node_modules/`, `data/` and `.env`.
> 2. Explore the rest of this repo, the FFSA Hub: its framework, how it's run and deployed, its database, file storage, login and roles (is there a Vehicle Co-ordinator role?), any existing vehicles and vehicle bookings, how it sends Slack messages and email, scheduled jobs, any use of Claude or other AI, and where secrets are kept.
> 3. Write `vehicles-module/HUB-PLAN.md`: for each part of the `window.claude.use()` contract in `vehicles-module/CLAUDE.md` (db, assets, user, downloads, sample, dictation), say what in the Hub replaces it; what's missing; and a step-by-step plan to (a) open the app inside the Hub at `/vehicles`, behind Hub login, for the Vehicle Co-ordinator and admins only, (b) keep its data in the Hub's database and its photos and PDFs in the Hub's file storage, (c) import `vehicles-module/seed`, matching vehicles to existing Hub vehicles by registration. List anything you need from Jack (access, settings, decisions).
>
> Don't change any Hub code in this step. Commit `HUB-PLAN.md` to this branch, then explain the plan to me in plain language, in a few short paragraphs.

Send Jack the plan and agree on it before Step 2.

## Step 2: the same app, inside the Hub

> Follow `vehicles-module/HUB-PLAN.md` parts (a) and (b). Make the FFSA Fleet app open inside the Hub at `/vehicles`, only for signed-in users with the Vehicle Co-ordinator or admin role, with a "Vehicles" link in the Hub's navigation for them.
>
> Keep `vehicles-module/app/ffsa-fleet.html` as it is: give it the same `window.claude.use()` contract (db, assets, user, downloads) on the Hub's own backend, database, file storage and login, following the rules in `vehicles-module/CLAUDE.md` exactly (set replaces a document; update deep-merges into an existing one; where/orderBy/limit; every open page sees changes live; files by id). For now `sample` and `dictation` can return null, so Ask is hidden.
>
> Add a one-off import script for `vehicles-module/seed` (data and files, keeping the file ids) that matches vehicles by registration, and run it only against a local or test database, never production. Add tests for the data layer. Run the Hub's tests and `vehicles-module` tests. Check every screen of the app at 390 px wide (no sideways scrolling) and on desktop.
>
> Add a rule to the Hub's `CLAUDE.md` (create it if there isn't one): every change to the Vehicles module must update its Guide (`GUIDE_PAGES`, and a dated line in `GUIDE_CHANGES`). Then update the Guide's "Start here" page so it no longer says the app is private to its owner, and add a What's new line: the app is now part of the FFSA Hub.
>
> Commit to this branch, open a pull request into the main branch titled "Vehicles module: FFSA Fleet app in the Hub", and don't merge it. Tell me in plain language what changed and how Jack and I can try it.

## Step 3: check it works the same

> On the `vehicles-module` branch, using a copy of the seed data (not production), go through the acceptance tests in `vehicles-module/docs/SPEC.md` section 10 against the Hub version, at 390 px wide and on desktop. Also run a full weekly inspection on one vehicle from start to finish, with a photo, and check it shows on the vehicle page, Today and the Calendar. Fix anything that fails, push the fixes to the pull request, and give me a short pass/fail list.

Then Jack reviews and merges, and runs the import on the live Hub. From that day, use the Hub version. Re-export the data from the old app just before (ask Claude in Cowork for a fresh export) so nothing recorded in between is lost.

## Step 4: the 7am reminder from the Hub

> Using `vehicles-module/server/reminder.js` (the reminder rules, with tests in `vehicles-module/test/api.test.js`), add a Hub scheduled job that runs every day at 07:00 Africa/Johannesburg and sends the message to whoever holds the Vehicle Co-ordinator role, by the Hub's Slack app (shown as "FFSA Fleet") and by email, with a link to `/vehicles#today`. Nothing is sent when every section is empty. Add a way for admins to preview the message for any date without sending it. Don't send real messages from tests. Open a pull request and don't merge it.

When it's live, tell Claude in Cowork to switch off the old "FFSA vehicle inspection reminders" scheduled task.

## Step 5: Hub bookings

> Implement `vehicles-module/docs/SPEC.md` section 7: Hub vehicle bookings replace the app's `trips` (they postpone checks, trigger pre- and post-trip checks, show on the Calendar and are checked for clashes); booked workshop visits block the vehicle in the Hub's booking calendar; when a workshop visit is booked or moved, everyone with an overlapping booking is told and offered a similar free vehicle with one tap, or told to wait until it's back or make other plans, and bookings starting within 7 days after it get a heads-up; ask for the odometer reading and fuel when a vehicle is handed out and back, and save it as a km reading. Update the Guide and What's new. Open a pull request and don't merge it.

## Step 6: Ask (chat with the app)

> Switch on Ask in the Hub version. Implement `sample` the way `vehicles-module/public/claude-shim.js` and `vehicles-module/server/server.js` (`/api/claude`) do: the API key stays on the server, the tool loop runs in the page, the 14 tools in `chatTools()` are offered, and every change is confirmed by the user first. Limit how many questions each user can ask per minute. Implement `dictation` with the browser's speech recognition where it exists (see the shim). Test with `vehicles-module/test/mock-claude.js` instead of the real API. Open a pull request and don't merge it.

## Any later change

Start every request with: "This is a change to the Vehicles module. Follow `vehicles-module/CLAUDE.md` and update the Guide and What's new."
