# The Nines

The Nines is a small static site that compares Claude and OpenAI uptime across a curated 90-day snapshot.

It uses plain HTML, CSS, and JavaScript with no build step.

## How It Works

The app ships with a normalized 90-day snapshot encoded directly in source. Per-day status strings for each tracked service are turned into:

- aggregate health bars
- per-category comparison cards
- weighted daily winners
- streaks, ties, and comeback moments
- a momentum chart and summary narrative

This version uses a static in-repo dataset instead of a backend or scraper. API and chat products are weighted more heavily than coding products.

## Methodology

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

## Repo Structure

- `index.html`: page structure, metadata, and the methodology drawer
- `styles.css`: layout, theme, responsive styles, charts, cards, and motion
- `app.js`: data model, scoring logic, rendering, interactions, and narrative generation

## Running It Locally

```bash
cd thenines.online
python3 -m http.server 4173
```

Then open [http://localhost:4173](http://localhost:4173).

## Limitations

- The current site is a static snapshot, not a live ingestion pipeline.
- This is an independent interpretation of public status data, not an official service-quality benchmark.
- Daily rollups compress incidents into a simpler comparison model.
- Some source systems expose richer data than others, so the comparison necessarily involves normalization.

## License

MIT. See [`LICENSE`](./LICENSE).
