#!/bin/bash
# Script di avvio del server BRAVO Agents
# Uso: ./start.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Carica le variabili dal file .env
if [ -f "$SCRIPT_DIR/.env" ]; then
  export $(grep -v '^#' "$SCRIPT_DIR/.env" | grep -v '^$' | xargs)
  echo "✅ .env caricato"
else
  echo "❌ File .env non trovato in $SCRIPT_DIR"
  exit 1
fi

echo "🚀 Avvio server su http://localhost:${PORT:-8000}"
echo "📖 Documentazione: http://localhost:${PORT:-8000}/docs"
echo ""

"$SCRIPT_DIR/venv/bin/uvicorn" main:app --reload --port "${PORT:-8000}"
