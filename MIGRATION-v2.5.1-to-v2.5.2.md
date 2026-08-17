# Migration v2.5.1 → v2.5.2

No data-volume migration is required. Keep the existing Docker volume and `.env`.

Recommended settings:

```env
FULL_MARKET_AUTOSTART=false
FULL_MARKET_CONTINUOUS=false
```

Upgrade:

```bash
cp .env ../trader-os.env
docker compose down
cd ..
mv trader-os trader-os-v2.5.1-backup
unzip trader-os-docker-v2.5.2-ux-reliability.zip
cp trader-os.env trader-os/.env
cd trader-os
docker compose build --no-cache
docker compose up -d
curl http://localhost:8787/health
```

Do not use `docker compose down -v` during the upgrade.
