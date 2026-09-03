#!/usr/bin/env python3
"""
Bouwt het standalone HTML-bestand uit de leesbare broncode.

  src/leerplatform.jsx  +  build/shell-head.html  +  build/shell-tail.html
        ->  Leerplatform_demo_standalone.html

Werkwijze:
  1. Bewerk de broncode in  src/leerplatform.jsx
  2. Draai:  python3 build/build.py
  3. Open/commit het gegenereerde Leerplatform_demo_standalone.html

De "verpakking" (React, Tailwind, Babel, laadscherm, opstartcode) zit in de
twee shell-*.html bestanden en wordt letterlijk overgenomen, zodat een build
nooit per ongeluk de omhulling verandert.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src" / "leerplatform.jsx"
HEAD = ROOT / "build" / "shell-head.html"
TAIL = ROOT / "build" / "shell-tail.html"
OUT = ROOT / "Leerplatform_demo_standalone.html"

# Kleine aanpassingen die de standalone-demo maken. Zet DEMO=False voor een
# schone build zonder voorbeeld-inhoud.
DEMO = True

DEMO_PATCHES = [
    (
        'const START_BRONNEN = {};',
        'const START_BRONNEN = (typeof window !== "undefined" && window.__DEMO_BRONNEN) || {};',
    ),
    (
        '  const [domeinId, setDomeinId] = useState(domeinen[0] ? domeinen[0].id : "");',
        '  // Demo: kies standaard het domein dat al een voorbeeldbron heeft, zodat de\n'
        '  // manager meteen op "Genereer leerpad" kan klikken.\n'
        '  const [domeinId, setDomeinId] = useState(() => {\n'
        '    const metBron = domeinen.find((d) => (bronnen[d.id] || []).length > 0);\n'
        '    return metBron ? metBron.id : domeinen[0] ? domeinen[0].id : "";\n'
        '  });',
    ),
]


def transform(jsx: str) -> str:
    lines = jsx.splitlines()
    # 1. Verwijder de React-import: in de standalone komt React uit de globale UMD-build.
    if lines and lines[0].startswith("import React"):
        lines = lines[1:]
    body = "\n".join(lines)
    # 2. Geen module-export in de browser; het component wordt straks gemount.
    body = body.replace(
        "export default function Leerplatform", "function Leerplatform"
    )
    # 3. Optionele demo-aanpassingen.
    if DEMO:
        for oud, nieuw in DEMO_PATCHES:
            if oud not in body:
                raise SystemExit(f"Demo-patch niet gevonden in broncode:\n{oud}")
            body = body.replace(oud, nieuw)
    return body


def main() -> None:
    head = HEAD.read_text()
    tail = TAIL.read_text()
    body = transform(SRC.read_text())
    # head eindigt met een newline; body sluit aan met zijn eigen lege beginregel.
    # De originele standalone heeft een lege regel tussen body en de opstart-staart.
    OUT.write_text(head + body + "\n\n" + tail)
    print(f"Geschreven: {OUT.relative_to(ROOT)}  ({OUT.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
