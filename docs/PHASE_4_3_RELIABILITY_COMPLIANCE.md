# Phase 4.3 Reliability + Compliance Guardrails

Status: completed

## 1) Monitoring/logging for scrape failures and parse errors

Implemented in frontend pipeline:
- `src/lib/scrapeMonitoring.ts`
- `src/api/client.ts`

Captured events:
- `scrape_timeout`
- `scrape_rate_limited`
- `scrape_request_failed`
- `scrape_parse_error`
- `scrape_malformed_payload`
- `scrape_low_results`
- `scrape_fallback_provider_used`

Storage:
- Recent events are persisted in browser local storage under `wa_scrape_monitor_logs`.
- Console logs are emitted with severity (`info`, `warn`, `error`).

Config:
- `VITE_ENABLE_SCRAPE_MONITORING`

## 2) Fallback provider strategy for low-result scenarios

Implemented in suggestions flow:
- If ranked live results are below threshold, system augments with provider fallback links.
- Provider fallback search URLs currently include:
  - Google Shopping
  - Myntra
  - AJIO

Config:
- `VITE_SCRAPER_MIN_RESULTS`

Behavior:
- Keeps target category and gender routing.
- Preserves normalized schema expected by UI cards.
- Emits `scrape_low_results` and `scrape_fallback_provider_used` monitoring events.

## 3) Legal/terms review checklist for target sources

Use this checklist before enabling or expanding scraping for any source.

### Source policy checks
- Confirm Terms of Service explicitly allow automated access for intended use.
- Verify robots.txt rules for relevant paths.
- Confirm whether caching, republishing, or storing product images is allowed.
- Check if deep-linking to product pages is allowed.
- Check if brand/store name usage requires attribution language.

### Data handling checks
- Store only minimum required product metadata.
- Avoid collecting personal/sensitive user data from source pages.
- Respect copyright and trademark usage restrictions for images/text.
- Define retention/deletion policy for scraped metadata and logs.

### Operational checks
- Enforce request throttling and retry caps.
- Implement circuit-breaker/fallback behavior for repeated failures.
- Monitor HTTP status patterns (429/403/5xx) and pause offending source if needed.
- Keep a provider allowlist and disable providers with legal risk.

### Governance checks
- Record legal review date and reviewer for each provider.
- Re-review provider terms periodically.
- Document takedown/escalation contact flow.
- Ensure user-facing disclosures are accurate for affiliate/external links.
