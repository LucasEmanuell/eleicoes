#!/usr/bin/env bash
# A cada 10 minutos: cada atualização faz toda página aberta baixar de novo
# uns 750KB, então publicar mais rápido custa dados de quem está vendo.
set -u
cd "$(dirname "$0")"
while true; do
  git add web/data
  if ! git diff --cached --quiet -- web/data; then
    git commit -q -m "Atualiza dados do TSE $(date +%H:%M)" -- web/data && git push -q origin main && echo "$(date +%H:%M:%S) publicado"
  fi
  sleep 600
done
