# Migration v1 → v2 Zero-AI

1. Preserve `.env` and Docker volume.
2. Stop old container **without `-v`**.
3. Extract v2.
4. Copy old `.env` into v2.
5. Run `./migrate-zero-ai.sh`.
6. Build and start v2.
7. Hard-refresh/unregister the old PWA service worker if the browser shows stale UI.

Your trade/watchlist/journal data lives in the named Docker volume and is compatible with v2.
