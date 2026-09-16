# Open decisions

Things deliberately deferred, recorded here so they resurface before launch
rather than living in a chat log.

## Revisit before publishing: movie trailers

**Status: parked, not investigated.**

The idea: clicking a title offers a trailer inline.

Before building this, get a real answer on the licensing. The short version
of what needs checking:

- **Embedding YouTube via its official iframe player** is the normal route,
  and is generally permitted under YouTube's Terms of Service — the video is
  served by YouTube, ads and analytics intact, and the rights holder can
  revoke it at any time by disabling embedding on that video.
- **What is not fine** is downloading, re-hosting, or proxying trailer files
  yourself, or stripping the player's branding and controls. That is where
  the copyright exposure actually lives.
- TMDB exposes trailer metadata (YouTube keys) via its videos endpoint,
  which makes the integration itself trivial; the question is purely legal,
  not technical.

None of the above is legal advice and none of it has been verified against
current terms — treat it as the starting point for that check, not the
conclusion.

**Decide before launch**, since embedding affects the privacy policy (third
party cookies) and possibly the CSP.

## Payments

The taste feature's paywall is built and gated on `User.isPro`, but no
payment provider is wired up. The unlock button is inert today.

## Real posters

Generated art covers titles with no `poster_path`, which is a permanent
fallback rather than a stopgap — TMDB does not have a poster for every
title. It only *looks* like a stopgap right now because no TMDB key exists,
so every title falls back. With a key, most titles show real posters.
