#!/usr/bin/env sh
# Run CTG Tools locally (offline-capable). Then open http://localhost:8000
# and use the browser's "Install app" to get a desktop app.
cd "$(dirname "$0")" && PORT="${1:-8000}" && echo "CTG Tools on http://localhost:$PORT" && python3 -m http.server "$PORT" 2>/dev/null || python -m http.server "$PORT"
