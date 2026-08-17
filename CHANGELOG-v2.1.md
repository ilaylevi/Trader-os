# Trader OS v2.1.0 — Adaptive Expert

## Intelligence
- Relative Strength versus broad-market benchmarks and mapped sector ETF.
- Richer regime scoring with explicit regime reasons.
- Abnormal volume using RVOL + rolling volume z-score.
- ATR-normalized price expansion and extension/chase penalty.
- Gap and range-compression context.
- New playbooks: Relative Strength Breakout, Trend Reclaim, Volatility Squeeze.
- Deterministic Catalyst Engine shared by opportunity ranking and entry checks.
- Bounded adaptive learning from completed Shadow Trades + closed trades.

## Safety
- Learning requires at least five completed samples per playbook.
- Positive playbook adjustment capped at +0.35 setup-score points.
- Negative adjustment can tighten scoring by up to -0.75.
- Learning never disables Data Quality, Event Risk, Stop, R:R or portfolio-risk gates.
- Critical negative headline classifications and event locks remain hard blockers.

## UI
- Richer visual hierarchy, hover states, conviction bars and signal badges.
- Every sidebar item includes a plain-language description.
- Every tab opens with a Tab Guide explaining what it does, when to use it and what to look for.
- New Learning Lab tab exposes samples, win rate, Avg R and score adjustment per playbook.
- Opportunity cards show Relative Strength, Catalyst Score and adaptive adjustment.
- Scanner cards show abnormal volume/price and learning badges.

## Cost
- No OpenAI/GPT/model API usage.
- Model cost remains $0.
