# מעבר מ-Trader OS v2.3.x ל-v2.4

1. שמור את `.env` הישן.
2. עצור את הקונטיינר עם `docker compose down` — **לא** עם `-v`.
3. החלף את תיקיית הקוד ב-v2.4.
4. החזר את `.env`.
5. הוסף את משתני v2.4 המופיעים ב-`.env.example` תחת Scanner v2 / Live Prices.
6. בנה מחדש עם `docker compose build --no-cache`.
7. העלה עם `docker compose up -d`.
8. בדוק `curl http://localhost:8787/health`.
9. בצע `Cmd + Shift + R` פעם אחת כדי לעקוף cache ישן של ה-PWA.

## נתונים קיימים
SQLite/volume נשמרים. אין צורך למחוק Watchlist, Trades, Ledger או Journal.

## חשוב לגבי סגירה אוטומטית
כאשר Stop או TP2 נפגעים, v2.4 יכולה לסגור את **המעקב המקומי**. העסקה תופיע בהיסטוריה כ-`ממתין לאימות` עד שתזין את מחיר ה-Fill האמיתי מהברוקר. רק אז P&L/R הסופיים נחשבים מאומתים ללמידה.
