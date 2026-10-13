"""Gera web/data-demo/ a partir de uma coleta real do fetch_live.py, pra
testar o site antes do dia da eleição (acessando com ?demo na URL).

Por padrão usa a coleta final do 1º turno de 2026 feita por Leonardo Rocha
(reference/professor-original/web/data/) — é a mesma saída que o
fetch_live.py gera no dia, então a demo testa o front-end com dado real e
no formato real. O history.json não existia na coleta original, então é
sintetizado a partir do resultado final.

    python3 build_demo.py                  # usa a coleta do professor
    python3 build_demo.py caminho/da/coleta # usa outra pasta com a mesma saída
"""

import json
import logging
import sys
from pathlib import Path

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


def main(source: Path) -> None:
    missing = [name for name in FILES if not (source / name).exists()]
    if missing:
        sys.exit(f"faltando em {source}: {', '.join(missing)}")
    for name in FILES:
        write_json(DEMO / name, json.loads((source / name).read_text()))
    states = json.loads((source / "states.json").read_text())
    build_demo_history(states["national"])
    logger.info("history.json sintetizado (%s)", states["national"]["as_of"])


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    DEMO.mkdir(parents=True, exist_ok=True)
    main(Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_SOURCE)
