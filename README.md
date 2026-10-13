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

## Coleta no dia 25

`./rodar_coleta.sh [horas]` roda o coletor e a publicação por N horas (padrão 8) e encerra. Rode **em um lugar só por vez**:

1. **VPS (principal)**, via cron. Não usa login do GitHub, só uma *deploy key* com acesso a este repositório:

   ```bash
   sudo apt install -y git python3-venv
   ssh-keygen -t ed25519 -f ~/.ssh/eleicoes_deploy -N "" -C coleta-vps
   cat ~/.ssh/eleicoes_deploy.pub   # cole em GitHub → Settings → Deploy keys, marcando "Allow write access"

   cat >> ~/.ssh/config <<'EOF'
   Host github-eleicoes
     HostName github.com
     User git
     IdentityFile ~/.ssh/eleicoes_deploy
     IdentitiesOnly yes
   EOF

   git clone git@github-eleicoes:LucasEmanuell/eleicoes.git ~/eleicoes && cd ~/eleicoes
   git config user.name coleta-vps && git config user.email coleta-vps@users.noreply.github.com
   python3 -m venv .venv && .venv/bin/pip install requests
   ./rodar_coleta.sh 0.2   # teste de 12 minutos
   ```

   Agendamento (`crontab -e`). Confira o fuso com `timedatectl`: 16h30 de Brasília são 19h30 em UTC.

   ```
   30 19 25 10 * cd $HOME/eleicoes && ./rodar_coleta.sh 8 >> $HOME/coleta.log 2>&1
   ```

2. **GitHub Actions (reserva)**: Actions → Coleta do TSE → Run workflow. Dura no máximo 6 horas.
3. **Seu computador**: `./rodar_coleta.sh`.

## Licença

MIT (ver `LICENSE`). Dados eleitorais: TSE.
