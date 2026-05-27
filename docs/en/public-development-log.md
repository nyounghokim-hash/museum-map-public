# Public Development Log

Last updated: 2026-05-27

This is a sanitized summary of useful development and production verification history from the private repository. It excludes credentials, private operational notes, raw logs, and one-off data scripts.

## 2026-05 Production Stabilization

- Fixed mobile map horizontal overflow by rendering the offscreen museum detail panel only while a museum is selected.
- Fixed first-visit splash and hydration instability by deferring splash rendering until after hydration and removing forced reloads on service worker controller changes.
- Fixed browser back behavior from artwork detail pages so returning to the map reopens the previous museum detail panel.
- Restored desktop map height behavior after a mobile fallback height overrode desktop layout.
- Changed trip list ordering so newly created plans appear first while preserving active-trip pinning.
- Restored desktop museum detail panel transparency, layout, motion, and hero image dissolve behavior.

## Security and Cost Hardening

- Restricted admin story rewrite and token-usage APIs to admin sessions.
- Closed non-admin access to blog draft listings and admin blog mutations.
- Added input limits and lightweight rate controls to public translation and recommendation endpoints.
- Protected translation cache deletion behind admin authorization while preserving cache-hit reads.
- Added token usage tracking and documentation for AI/API cost controls.

## Data Quality and Media Work

- Restored public museum visibility when records do not explicitly include visibility metadata.
- Standardized museum image fallback behavior across map search results, AI recommendation cards, story-related museum chips, and newly added museum dropdowns.
- Replaced Google Places original image URLs in representative `imageUrl` fields with Supabase-cached URLs where available.
- Added guards to avoid serving bare Google Places photo references or uncached Google photo origins.
- Added placeholder image coverage for public museums without usable source photos.
- Reclassified generic `Art Museum` categories into more specific categories.
