#!/bin/sh
set -eu
SRC="${1:-.env}"
[ -f "$SRC" ] || { echo "Missing $SRC"; exit 1; }
TMP="${SRC}.zero-ai.tmp"
cp "$SRC" "${SRC}.pre-zero-ai.backup"
grep -Ev '^(OPENAI_|BACKGROUND_AI_|MACRO_CALENDAR_)' "$SRC" > "$TMP" || true
if ! grep -q '^NEWS_CACHE_MS=' "$TMP"; then printf '\n# Deterministic headline classifier cache\nNEWS_CACHE_MS=600000\n' >> "$TMP"; fi
mv "$TMP" "$SRC"
echo "Zero-AI env migration complete. Backup: ${SRC}.pre-zero-ai.backup"
echo "OpenAI variables were removed. Market-data, risk, automation, alert and broker settings were preserved."
