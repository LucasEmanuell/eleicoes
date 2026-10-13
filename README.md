# Apuração 2026 — 2º turno

Painel não-oficial da eleição presidencial de 2026, com dados do TSE.

Site: https://lucasemanuell.github.io/eleicoes/web/ (demonstração com os dados do 1º turno: [`?demo`](https://lucasemanuell.github.io/eleicoes/web/?demo))

## Abas

- **Brasil, ao vivo**: placar nacional com todos os candidatos, mapa por estado ou município (vantagem ou % apurado), curva da apuração e resultado por região.
- **Exterior**: resultado nas 186 cidades com votação fora do país.
- **Virada desde 2022**: variação da margem PL − PT por município e estado, e os municípios que trocaram de lado. O 2º turno é comparado com o 2º turno de 2022.

## Como funciona

```
fetch_live.py (TSE)  →  web/data/*.json  →  publish_loop.sh (git push)  →  GitHub Pages
```

`fetch_live.py` consulta nacional, estados e exterior a cada 2 minutos e os municípios a cada 10, a no máximo 40 req/s (o limite do TSE é 100). `publish_loop.sh` faz commit e push a cada 10 minutos quando os dados mudam. Não há servidor exposto.

O pipeline de coleta é adaptado de [lsampaiorocha/brazil-votes-2026](https://github.com/lsampaiorocha/brazil-votes-2026), de Leonardo Rocha (MIT). O front-end é novo.

## Rodando localmente

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

python3 prepare.py   # uma vez: mapas do IBGE, lookup de municípios, bases de 2022

# dados de demonstração (coleta do 1º turno; --historico-git reconstrói a curva real da noite)
git clone https://github.com/lsampaiorocha/brazil-votes-2026 ../brazil-votes-2026
python3 build_demo.py ../brazil-votes-2026/web/data --historico-git ../brazil-votes-2026

cd web && python3 -m http.server 8000   # http://localhost:8000/?demo
```

No dia da eleição:

```bash
python3 fetch_live.py          # coleta contínua (--once roda um ciclo só)
./publish_loop.sh              # publica
```

## Licença

MIT (ver `LICENSE`). Dados eleitorais: TSE.
