# מעבר מ-v2.1 ל-v2.2

אין משתני ENV חדשים ואין שינוי בפורמט ה-volume.

1. שמור את `.env` הקיים.
2. אל תריץ `docker compose down -v`.
3. החלף את קבצי האפליקציה ב-v2.2.
4. הרץ `docker compose build --no-cache && docker compose up -d`.
5. בצע Hard Refresh בדפדפן (`Cmd + Shift + R`) בגלל שינוי Service Worker cache.
