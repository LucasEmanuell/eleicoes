#!/usr/bin/env bash
# Publica web/data a cada PUBLICAR_A_CADA segundos (padrão 120) quando os
# dados mudam. Cada push dispara o deploy do Pages pelo workflow pages.yml.
set -u
cd "$(dirname "$0")"
INTERVALO="${PUBLICAR_A_CADA:-120}"
while true; do
  git add web/data
  if ! git diff --cached --quiet -- web/data; then
    # pull antes do push: se alguém mexer no código durante a noite, o push não fica recusado pra sempre
    git commit -q -m "Atualiza dados do TSE $(date +%H:%M)" -- web/data &&
      git pull -q --rebase --autostash origin main &&
      git push -q origin main && echo "$(date +%H:%M:%S) publicado" &&
      # push feito pelo próprio Actions não dispara outro workflow; aí o deploy é pedido explicitamente
      if [ "${GITHUB_ACTIONS:-}" = "true" ]; then gh workflow run pages.yml --ref main; fi
  fi
  sleep "$INTERVALO"
done
