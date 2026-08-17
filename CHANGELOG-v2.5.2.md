# Trader OS v2.5.2 — UX & Reliability

## UX audit
- Dashboard and Opportunities now use one Strategy Opportunity source of truth.
- “סריקה מהירה”, “סריקה מלאה” and “רענן תצוגה” are separate, explicit actions.
- Lightweight tab reads use local skeletons instead of a global blocking overlay.
- Native browser prompt/confirm flows in Trade Room were replaced with in-app Hebrew forms.
- Watchlist can be managed manually, including price triggers.
- Journal shows coach output and Shadow Trades in the page.
- Alerts support unread filters/read-all and richer Hebrew detail.
- IBI staging shows quantity, order type and limit/stop prices.
- Learning Lab explains real vs shadow sample weight and insufficient-data states.
- Rules tab shows the risk/quality settings actually active at runtime.

## Reliability
- Full-market progress distinguishes attempted coverage from successful quote coverage.
- Invalid prices do not count as successfully scanned symbols.
- Full-market manual start resumes an unfinished session; restart is explicit.
- Full-market autostart and continuous repeat are opt-in.
- Dashboard reconnects to an active full scan after refresh.
- Rejected raw scanner candidates no longer masquerade as strategy opportunities on Dashboard.
- Unknown sectors are shown as “לא סווג” rather than inventing sector alignment.
