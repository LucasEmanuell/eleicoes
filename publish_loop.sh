#!/usr/bin/env bash
# Publica web/data assim que os dados mudam, com no mínimo PUBLICAR_A_CADA
# segundos (padrão 45) entre publicações. O coletor só regrava um arquivo quando
# o TSE muda, então sem número novo não há publicação. Cada push dispara o
# deploy do Pages pelo workflow pages.yml (~20 s).
set -u
cd "$(dirname "$0")"
INTERVALO="${PUBLICAR_A_CADA:-45}"
ultimo=0
while true; do
  git add web/data
  if ! git diff --cached --quiet -- web/data && [ $(( $(date +%s) - ultimo )) -ge "$INTERVALO" ]; then
    # pull antes do push: se alguém mexer no código durante a noite, o push não fica recusado pra sempre
    git commit -q -m "Atualiza dados do TSE $(date +%H:%M:%S)" -- web/data &&
      git pull -q --rebase --autostash origin main &&
      git push -q origin main && ultimo=$(date +%s) && echo "$(date +%H:%M:%S) publicado" &&
      # push feito pelo próprio Actions não dispara outro workflow; aí o deploy é pedido explicitamente
      if [ "${GITHUB_ACTIONS:-}" = "true" ]; then gh workflow run pages.yml --ref main; fi
  fi
  sleep 5
done
