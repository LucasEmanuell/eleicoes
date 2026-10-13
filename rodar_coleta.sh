#!/usr/bin/env bash
# Roda coletor + publicação por N horas (padrão 8) e encerra sozinho.
# Usado pelo cron da VPS, pelo GitHub Actions e localmente:
#   ./rodar_coleta.sh        # 8 horas
#   ./rodar_coleta.sh 0.2    # 12 minutos (teste)
set -u
cd "$(dirname "$0")"
HORAS="${1:-8}"
PY=python3
[ -x .venv/bin/python ] && PY=.venv/bin/python

git pull -q --rebase --autostash origin main || echo "aviso: git pull falhou, seguindo com o que tem"
echo "$(date '+%d/%m %H:%M:%S') coleta por ${HORAS}h"
timeout "${HORAS}h" "$PY" fetch_live.py &
COLETOR=$!
sleep 15  # dá tempo do 1º ciclo (estados + exterior) gravar antes da 1ª publicação
timeout "${HORAS}h" ./publish_loop.sh
wait "$COLETOR"
echo "$(date '+%d/%m %H:%M:%S') fim"
