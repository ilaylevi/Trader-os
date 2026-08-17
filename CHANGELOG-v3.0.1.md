# Trader OS v3.0.1 — UI Bootstrap Fix

- Restored the missing `loadBase()` bootstrap function.
- Restored the missing `go()` tab-navigation function.
- Updated the Learning tab to the v3 `/api/decision-lab` endpoint and `renderDecisionLab()` renderer.
- Initial dashboard loading is now non-blocking: the sidebar remains usable while `/api/dashboard` loads.
- Added local skeleton/error/retry states for tab loading.
- Bumped the PWA cache so Chrome does not keep the broken v3.0.0 shell.
