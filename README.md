# Apuração 2026 — 2º turno

Painel não-oficial de acompanhamento do 2º turno da eleição presidencial de
2026 (25/out), consumindo o feed público de resultados do TSE. Não tem
nenhuma ligação com o TSE.

Site: _(publicar via GitHub Pages — ver "Como publicar" abaixo)_

## O que tem

- **Brasil, ao vivo**: mapa do Brasil por estado, placar nacional, barra até
  os 50%, apuração em andamento, curva "ao longo da apuração".
- **Exterior**: resultado nas 186 cidades onde brasileiros no exterior votam.
- **Virada desde 2022**: comparação do resultado por município com o 1º
  turno de 2022.

## De onde veio

O pipeline de coleta de dados (`fetch_live.py`, `prepare.py`,
`build_demo.py`, `publish_loop.sh`, `abroad_cities.csv`) é adaptado do
projeto original de **Leonardo Rocha**
([lsampaiorocha/brazil-votes-2026](https://github.com/lsampaiorocha/brazil-votes-2026),
licença MIT) — os comentários foram traduzidos e foi adicionado o
`history.json` (histórico pra desenhar a curva de apuração), mas a lógica de
coleta/rate-limit contra o TSE é a mesma. O front-end (`web/index.html`) foi
reescrito do zero, com um visual próprio.

## Como funciona

```
fetch_live.py (consulta o TSE)  →  web/data/*.json  →  publish_loop.sh (git push)  →  GitHub Pages
```

Sem servidor exposto: o único programa que fala com a internet "pra fora" é
o coletor, puxando dados — ele não escuta conexão nenhuma vindo de fora.
Quem serve o site pro público é a CDN do GitHub Pages, de graça.

- `fetch_live.py` consulta nacional/estados/exterior a cada 2 minutos, e os
  5.571 municípios a cada 10 minutos, respeitando o limite de 100 req/s do
  TSE (fica em 40 req/s).
- `publish_loop.sh` roda a cada 10 minutos: se os dados mudaram, commita e
  dá `git push` — isso é o "deploy".

## Rodando localmente

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# setup único (baixa mapas do IBGE, monta lookup, constrói base de 2022)
python3 prepare.py

# gera dados de demonstração com resultados reais de 2022 (não depende da eleição já ter acontecido)
python3 build_demo.py

# serve o site localmente
cd web && python3 -m http.server 8000
# abre http://localhost:8000/?demo
```

Pra rodar o coletor de verdade (só faz sentido com a apuração em andamento):

```bash
python3 fetch_live.py          # roda contínuo
python3 fetch_live.py --once   # um ciclo só, pra testar
```

## Como publicar

1. Criar um repositório no GitHub, dar `git push` deste código pra lá.
2. Habilitar GitHub Pages (Settings → Pages → Deploy from branch → `main`).
3. Rodar `prepare.py` uma vez (fora do dia da eleição já dá, os mapas e o
   lookup não mudam).
4. No dia, rodar `fetch_live.py` e `publish_loop.sh` juntos (podem rodar no
   seu próprio PC — não precisam de servidor público, só internet de saída).

## Licenças

- Código: MIT (ver `LICENSE`) — pipeline de dados adaptado do trabalho de
  Leonardo Rocha, front-end novo.
- Dados eleitorais: TSE (CC BY).
- Mapas: IBGE e Natural Earth (domínio público).
