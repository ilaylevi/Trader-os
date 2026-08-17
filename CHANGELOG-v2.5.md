# Changelog — v2.5.0

## Scanner
- Added persistent full-US common-stock progressive sweep.
- Added real sweep coverage, sweep id, checked count, completed sweep count and rate-limit status.
- Added OTC/Pink and non-common-stock exclusion by default.
- Full-market candidates survive between sweeps.
- Added finalist rotation for deep analysis.
- Removed raw discovery leaders from recurring priority memory.
- Rejected / level-less opportunities no longer recycle into future scans.

## Trade quality
- Added hard Opportunity Quality Floor.
- Reworked Entry/Stop/TP generation into playbook-specific planning.
- Added structural Stop selection using swing/support/VWAP/SMA20 candidates.
- Added controlled ATR fallback only for strong setups.
- Added structural 1H/Daily target-room checks.
- Added user-facing explanations for Entry logic, Stop logic and target logic.

## Alerts
- Reworked alert messages into detailed Hebrew explanations.
- Alerts now include event context, relevant levels and the next action.
- Alerts tab renders full message content instead of only terse titles.

## UI
- Opportunities screen separates valid opportunities from rejected scans.
- Added full-market coverage progress and explicit temporary-ranking warning until 100% coverage.
- Dashboard coverage badge now uses the full-market sweep rather than the legacy rotating-batch counter.

## Reliability
- Removed duplicate full-market advancement from Automation because the dedicated sweep worker already owns it.
- Full-market rate-limit failures are retried instead of skipped.
- Updated ruleset to 2.5.0-full-market-quality.
