# Migration — Trader OS v3.0.0 → v3.0.1

v3.0.1 fixes a UI bootstrap regression in v3.0.0.

## Root cause
The standalone v3 UI referenced `go()` and `loadBase()` but the two functions were accidentally omitted during the v3 UI merge. As a result:
- the initial dashboard remained in a loading state;
- tab clicks threw `go is not defined`;
- the dashboard bootstrap threw `loadBase is not defined`.

## Fixes
- Restored and adapted `loadBase()` for v3.
- Restored and adapted `go()` for all 13 v3 tabs.
- Learning now loads `/api/decision-lab` and renders `renderDecisionLab()`.
- Initial dashboard load no longer blocks the whole app with the global loading overlay.
- Added local skeleton + retry states for tabs.
- Bumped PWA cache and MCP resource URI to prevent stale broken UI.

## Upgrade
Keep your `.env` and Docker volume. Do not use `docker compose down -v`.
