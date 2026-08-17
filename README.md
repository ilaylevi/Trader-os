# Trader OS v3 — Evidence-Driven Trading System

Trader OS is a local, Dockerized, Hebrew-first Day/Swing trading operating system. v3 remains **Zero-AI at runtime**: no OpenAI model, no token billing and no hidden LLM fallback.

The system combines market scanning, live prices, playbook-specific trade planning, official/free research sources, an evidence committee, calibrated historical evidence, portfolio risk, live thesis monitoring, trade management, journaling and deterministic learning.

## Quick start
```bash
docker compose build --no-cache
docker compose up -d
curl http://localhost:8787/health
```

Open: `http://localhost:8787`

Read:
- `FEATURES-v3.md`
- `ARCHITECTURE-v3.md`
- `UX-v3.md`
- `MIGRATION-v2.6-to-v3.md`

## Core principle
A strong chart is not enough. A trade must have trustworthy data, a coherent market/sector context, executable structure, risk capacity, no critical event contradiction, and enough independent evidence to justify the risk.
