# The Nines

The Nines is a small, opinionated static site that compares Claude and OpenAI uptime across a curated 90-day snapshot and turns public status-page signals into a readable head-to-head narrative.

This repo is intentionally simple on the surface: one HTML file, one CSS file, one JavaScript file. That simplicity is the point. The project is meant to show product taste, editorial framing, and execution discipline without hiding behind a framework.

## What This Project Is

- A static, fast-loading uptime comparison between two AI platforms.
- A compact frontend built with plain HTML, CSS, and JavaScript.
- A product experiment in turning operational data into something interpretable and a little fun.

## Why It Exists

Status pages are technically useful but not especially readable. They answer "is the service up?" but not "who has been more reliable lately?" or "what story does the last quarter tell?"

The Nines takes the same raw public signals and reframes them as a scoreboard:

- API vs API
- Chat vs Chat
- Code tooling vs Code tooling
- Daily winners, ties, streaks, and momentum

The goal was not to build a perfect observability tool. The goal was to build a sharp, legible artifact that makes public uptime data feel comparative, editorial, and worth exploring.

## Why The Repo Looks Like This

This project could have been built with a framework. I chose not to.

For a site this size, plain files were the cleaner engineering decision:

- zero build step
- zero framework overhead
- easy deployment anywhere
- fully inspectable source
- fast load and low maintenance cost

That choice also makes the repo a better portfolio piece. Anyone can open it and understand the whole system quickly.

## How It Works

The app ships with a normalized 90-day snapshot encoded directly in source. Compact per-day status strings for each tracked service are turned into:

- aggregate health bars
- per-category comparison cards
- weighted daily winners
- streaks, ties, and comeback moments
- a momentum chart and summary narrative

That tradeoff is intentional. Instead of adding a backend or scrape pipeline, this version keeps the data model visible and auditable in one file. The value here is the framing, scoring, and interface logic.

The comparison is intentionally weighted:

- API and chat products count more heavily because they are the primary products people depend on
- coding products still matter, but they carry slightly less weight

That weighting is a product decision, not just a math decision. It reflects what "reliability" means for real users.

## Methodology At A Glance

- Claude source material: `status.claude.com`
- OpenAI source material: `status.openai.com`
- Window: 90 days
- Current implementation: a hand-curated snapshot normalized into in-source daily status strings
- Status classes: operational, degraded, partial outage, major outage, maintenance
- Daily scoring:
  - operational = 100%
  - degraded = 60%
  - partial outage = 30%
  - major outage = 0%
  - maintenance = 80%

The site also includes a methodology drawer in the UI so the scoring logic is visible to visitors, not hidden in the code.

## Repo Structure

- `index.html`:
  Page structure, metadata, and the methodology drawer.
- `styles.css`:
  Visual system, themes, responsive layout, charts, cards, and motion.
- `app.js`:
  Data model, scoring logic, rendering, interactions, and narrative generation.

## Running It Locally

Because this is a static site, you can serve it with any simple file server.

```bash
cd thenines.online
python3 -m http.server 4173
```

Then open [http://localhost:4173](http://localhost:4173).

## What I Wanted This Repo To Show

I care about more than "does it work."

I care about:

- choosing the smallest honest technical solution
- making data understandable, not just available
- building interfaces with a point of view
- leaving code readable enough for someone else to learn from
- documenting the reasoning, not only the result

This is a small project, but it carries the same habits I want in larger work: constraint-driven decisions, clear logic, and deliberate presentation.

## Limitations

- The current site is a static snapshot, not a live ingestion pipeline.
- This is an independent interpretation of public status data, not an official service-quality benchmark.
- Daily rollups compress incidents into a simpler comparison model.
- Some source systems expose richer data than others, so the comparison necessarily involves normalization.

## License

MIT. See [`LICENSE`](./LICENSE).
