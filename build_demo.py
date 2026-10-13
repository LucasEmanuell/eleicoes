"""Gera web/data-demo/ a partir de uma coleta real do fetch_live.py, pra
testar o site antes do dia da eleição (acessando com ?demo na URL).

Por padrão usa a coleta final do 1º turno de 2026 feita por Leonardo Rocha
(reference/professor-original/web/data/) — é a mesma saída que o
fetch_live.py gera no dia, então a demo testa o front-end com dado real e
no formato real.

O history.json não existia na coleta original. Com --historico-git, ele é
reconstruído a partir do histórico de commits de um repo que publicava o
states.json durante a apuração (o do professor fazia push a cada 10min na
noite de 4/10) — fica igual ao que o fetch_live.py teria gravado. Sem essa
opção, a curva é sintetizada a partir do resultado final.

    python3 build_demo.py                   # usa a coleta do professor
    python3 build_demo.py caminho/da/coleta # usa outra pasta com a mesma saída
    python3 build_demo.py --historico-git ~/brazil-votes-2026  # curva real

Pra curva real: git clone https://github.com/lsampaiorocha/brazil-votes-2026
"""

import argparse
import json
import logging
import subprocess
import sys
from pathlib import Path

from fetch_live import HISTORY_MAX_POINTS, history_point
from prepare import WEB, write_json

logger = logging.getLogger(__name__)

DEMO = WEB / "data-demo"
DEFAULT_SOURCE = WEB.parent / "reference" / "professor-original" / "web" / "data"
FILES = ("states.json", "abroad.json", "municipalities_2026.json")


def build_demo_history(national: dict) -> None:
    """Sintetiza uma curva plausível de 0% a 100% apurado pro gráfico de
    demonstração — não é um histórico real (não existia no coletor
    original), só interpola em direção ao resultado final."""
    votes_by_number = {c["number"]: c["votes"] for c in national["candidates"]}
    valid = national["valid"] or 1
    final = {
        number: 100 * votes_by_number.get(number, 0) / valid
        for number in ("13", "22")
    }
    points = []
    steps = 40
    for i in range(steps + 1):
        pct_apurado = round(100 * i / steps, 2)
        # Começa mais perto de 50/50 e converge pro resultado final — só pra
        # a curva de demonstração não ficar uma linha reta sem graça.
        progress = i / steps
        points.append(
            {
                "as_of": f"demo-{i:02d}",
                "pct_apurado": pct_apurado,
                "13": round(50 + (final["13"] - 50) * progress, 2),
                "22": round(50 + (final["22"] - 50) * progress, 2),
            }
        )
    write_json(DEMO / "history.json", {"pontos": points})


def history_from_git(repo: Path) -> None:
    """Reconstrói o history.json a partir de cada versão commitada de
    web/data/states.json no repo, da mais antiga pra mais recente."""
    def git(*args: str) -> str:
        return subprocess.run(
            ["git", "-C", str(repo), *args], check=True, capture_output=True, text=True
        ).stdout

    points: list[dict] = []
    for commit in git("log", "--reverse", "--format=%H", "--", "web/data/states.json").split():
        national = json.loads(git("show", f"{commit}:web/data/states.json"))["national"]
        if not national.get("as_of") or not national.get("valid"):
            continue  # snapshot de antes da apuração começar
        point = history_point(national)
        if points and points[-1]["as_of"] == point["as_of"]:
            points[-1] = point
        else:
            points.append(point)
    if not points:
        sys.exit(f"nenhum snapshot com apuração em {repo}")
    write_json(DEMO / "history.json", {"pontos": points[-HISTORY_MAX_POINTS:]})
    logger.info("history.json reconstruído: %d pontos, %s → %s",
                len(points), points[0]["as_of"], points[-1]["as_of"])


def main(source: Path, history_repo: Path | None) -> None:
    missing = [name for name in FILES if not (source / name).exists()]
    if missing:
        sys.exit(f"faltando em {source}: {', '.join(missing)}")
    for name in FILES:
        write_json(DEMO / name, json.loads((source / name).read_text()))
    if history_repo:
        history_from_git(history_repo)
        return
    states = json.loads((source / "states.json").read_text())
    build_demo_history(states["national"])
    logger.info("history.json sintetizado (%s)", states["national"]["as_of"])


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    DEMO.mkdir(parents=True, exist_ok=True)
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("fonte", nargs="?", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--historico-git", type=Path, metavar="REPO")
    args = parser.parse_args()
    main(args.fonte, args.historico_git)
