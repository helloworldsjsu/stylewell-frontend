# Phase 4.1 Scraper Service Integration

Status: completed

## Delivered

- Restored scraping endpoint integration from frontend suggestions flow.
- Added timeout control for scraper requests.
- Added request throttling/rate-limit safeguard for rapid repeated calls.
- Added graceful fallback suggestions when scraper is unavailable, times out, rate-limits, or returns malformed payload.

## Implementation

Updated file:
- src/api/client.ts

Key behavior:
- In live API mode, suggestions request now calls backend `/suggestions` endpoint directly.
- Request is throttled using a minimum interval between calls.
- Request uses `AbortController` timeout based on env setting.
- On failure scenarios (`429`, `5xx`, timeout, network, malformed data), a fallback response is returned with:
  - `scrape_status: fallback`
  - `scrape_error` populated
  - user-facing `error` message in response envelope

## Environment keys

Added in `.env.example`:
- `VITE_SCRAPER_TIMEOUT_MS`
- `VITE_SCRAPER_MIN_INTERVAL_MS`

## Notes

- This phase ensures suggestions UX does not break when scraper backend is unstable.
- Backend endpoint integration remains active whenever live scraping succeeds.
