# Trader OS v3 — Security & Data Safety

- Runtime is Zero-AI: no OpenAI endpoint or model key is required.
- Market-data credentials remain server-side through environment variables and are not embedded in browser code.
- `APP_ACCESS_TOKEN` should be configured before exposing Trader OS through any tunnel or public network.
- Never commit `.env`.
- IBI orders remain staged/manual; Trader OS does not claim broker execution without verification.
- Local tracker hits (TP/stop) are not treated as broker fills until execution is confirmed.
- Official-source outages or stale data reduce confidence rather than silently falling back to fabricated information.
- SEC fair-access identification/rate limits must be respected through `SEC_USER_AGENT` and local caching.
