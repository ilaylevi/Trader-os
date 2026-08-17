# Trader OS v2.1 — Adaptive Expert

The v2.1 engine remains fully deterministic and uses no generative AI. Adaptation is evidence-bounded rather than self-modifying.

## Decision stack
Market regime → breadth → sector alignment → relative strength → multi-timeframe structure → abnormal volume/price → playbook → catalyst/event risk → data quality → portfolio risk → verdict.

## Adaptive learning
Completed Shadow Trades and closed trades are grouped by playbook. A playbook needs at least five completed samples before it can influence scoring. Positive evidence can add at most +0.35 setup-score points; negative evidence can subtract up to -0.75. This asymmetry keeps the system conservative and prevents a small winning streak from materially loosening entry gates.

## Relative strength
The engine compares each stock's session change with the average configured market benchmarks and its mapped sector ETF. It classifies the stock as LEADER, OUTPERFORM, NEUTRAL or LAGGARD.

## Abnormal activity
The engine records rolling relative volume, volume z-score, ATR-normalized price expansion, gap percentage and compression. Very strong volume can support a setup; >3 ATR extension is penalized as chase risk.

## UI principle
Every navigation item includes a plain-language description. Every tab begins with an explanation of what it does, when to use it and what to look for.
