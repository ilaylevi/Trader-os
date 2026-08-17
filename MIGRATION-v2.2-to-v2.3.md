# מעבר מ-Trader OS v2.2 ל-v2.3

1. **אל תמחק את ה-volume.** אל תריץ `docker compose down -v`.
2. שמור את `.env` הישן.
3. עצור את v2.2 עם `docker compose down`.
4. החלף את תיקיית הקוד ב-v2.3 והחזר את `.env`.
5. מומלץ להוסיף/לעדכן את המשתנים החדשים מתוך `.env.example`.
6. הרץ `docker compose build --no-cache && docker compose up -d`.
7. בדוק `curl http://localhost:8787/health`.
8. בצע `Cmd+Shift+R` פעם אחת בגלל גרסת PWA/cache חדשה.

## State migration

ברירת המחדל של v2.3 היא `STORAGE_BACKEND=sqlite`. בפעם הראשונה שכל מסמך state נקרא, המערכת מייבאת אוטומטית את קובץ ה-JSON הקיים מה-volume אל SQLite. קבצי ה-JSON הישנים אינם נמחקים אוטומטית ומשמשים גם כנתיב fallback אם SQLite אינו זמין.

## Recommended new settings

```env
STORAGE_BACKEND=sqlite
SCAN_UNIVERSE_MAX=48
DYNAMIC_MOVERS_PER_SIDE=12
DYNAMIC_UNIVERSE_MAX=24
MARKET_MOVERS_CACHE_MS=600000
DEEP_ANALYSIS_MAX_SYMBOLS=3
OHLCV_INTRADAY_OUTPUTSIZE=800
OHLCV_DAILY_OUTPUTSIZE=120
OHLCV_CACHE_MS=300000
DAILY_OHLCV_CACHE_MS=21600000
MAX_SAME_SECTOR_TRADES=2
OFFICIAL_MACRO_CALENDAR_CACHE_MS=21600000
OFFICIAL_CALENDAR_TIMEOUT_MS=10000
```

`DEEP_ANALYSIS_MAX_SYMBOLS=3` is deliberately conservative for low-quota data accounts. Increase it only after confirming your data-plan limits.
