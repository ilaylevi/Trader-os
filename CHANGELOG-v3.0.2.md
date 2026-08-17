# Trader OS v3.0.2 — Deep Coverage + Execution-State Fix

- Discovery coverage is labeled honestly as Quote/Snapshot coverage.
- Deep analyses accumulate in a fresh rolling pool instead of ranking only the current 3 symbols.
- Closed market blocks execution but no longer rejects setup quality.
- Cached deep candidates can be ARMED/WATCH but cannot become READY until refreshed.
- Hard risk gates remain unchanged.
