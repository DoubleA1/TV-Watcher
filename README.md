# TV-Watcher

Follow a show or a film once. When the next season lands, when the sequel gets
announced, or when it finally turns up on a service you already pay for, you
get a text.

## Running it

```bash
npm install
npm run db:up        # starts local Postgres, prints the DATABASE_URL
npm run db:migrate   # applies migrations
npm run db:seed      # fills the catalogue and creates a demo account
npm run dev
```

Then open http://localhost:3000. In development the sign-in page has a button
that opens the seeded account (`demo@tvwatcher.local` / `watchthis123`).

**It runs with no API keys.** Without `TMDB_API_KEY` the catalogue comes from
fixtures in `src/lib/providers/fixtures/`, and the header says "sample data" so
nothing on screen pretends to be real. Add a key and the same code paths pull
live data instead.

## How it works

Netflix, Hulu, Disney+ and Prime Video do not publish usable catalogue APIs, so
every fact about what exists and where it streams comes from an aggregator —
TMDB (whose availability data is JustWatch's, and carries an attribution
requirement) plus TVmaze for precise episode timestamps. All of it sits behind
`CatalogSource` in `src/lib/providers/types.ts`, so swapping in Watchmode later
is a new implementation rather than a rewrite.

Two ideas carry the rest of the design:

**A `ReleaseEvent` is a fact about the world; a `Notification` is one delivery
of it.** One detection fans out to every follower without being re-derived, and
there is exactly one place to dedupe. `ReleaseEvent.dedupeKey` is uniquely
indexed so a flapping upstream API cannot text anyone twice; `Notification` is
unique on (user, event, channel) so the same event can go out by both email and
SMS but never twice by either.

**Following a title and wanting a specific alert about it are separate
decisions.** A `Follow` says "I care about this"; `AlertRule` rows say "and tell
me about these specific things". The five are:

| Event | Fires when |
|---|---|
| `SEASON_PREMIERE` | A new season drops |
| `NEW_EPISODE` | Each episode airs — **off by default** |
| `FRANCHISE_ENTRY` | A sequel appears in the franchise |
| `ARRIVES_ON_MY_SERVICE` | It lands on a service you subscribe to |
| `STREAMING_DEBUT` | It becomes streamable anywhere for the first time |

Ten texts for ten episodes of a weekly show is how you train someone to ignore
your texts, which is why `NEW_EPISODE` is opt-in.

`OfferType` separates `FLATRATE` from `RENT`/`BUY`, and follows default to
flatrate only — "on Prime Video" meaning "$19.99 to rent" is a different message
from "included with what you already pay for".

## The scheduled jobs

Both are plain authenticated endpoints, so they run under Vercel Cron, GitHub
Actions, or a system crontab. Nothing is host-specific.

```bash
curl -X POST localhost:3000/api/cron/sync     -H "Authorization: Bearer $CRON_SECRET"
curl -X POST localhost:3000/api/cron/dispatch -H "Authorization: Bearer $CRON_SECRET"
```

- **sync** — refreshes titles that are due, detects events, fans them out.
  Cadence per title adapts: a film still in theatres is not polled hourly for
  streaming data that cannot exist yet.
- **dispatch** — sends whatever is due. A premiere scheduled to the second is
  only as precise as the gap between runs.

## Notifications

SMS is written and dark. US texting needs A2P 10DLC registration (about $4 +
$15 + $2/month, roughly a week to approve), and until `TWILIO_*` is configured
the SMS channel suppresses rather than fails, so email carries the message.
`ConsentRecord` keeps a verbatim record of opt-in, which is what a carrier audit
asks for.

Quiet hours hold overnight alerts until morning — a midnight Pacific drop is 3am
on the east coast.

## Checks

```bash
npm run verify:detect    # detection is silent on backfill, fires on real changes
npm run verify:pipeline  # detection -> fan-out -> delivery, and quiet hours
npm run smoke            # schema constraints that are easy to get wrong
```

Both verify scripts mutate data; run them against a development database and
reseed afterwards.

## Design

`design/prototype.html` is the approved visual language, published as a
standalone clickable prototype. `src/app/globals.css` implements it — keep the
two in step.
