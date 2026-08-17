# Security v2

- No OpenAI API key is read or required.
- Remove old `OPENAI_API_KEY` values from `.env` and revoke exposed/unused keys at the provider.
- Keep `APP_ACCESS_TOKEN` enabled when exposing Trader OS through a tunnel.
- Market-data API keys remain server-side only.
- Real broker execution is disabled; staged orders are not execution.
- Persistent JSON writes use the application's atomic storage helper where supported.
