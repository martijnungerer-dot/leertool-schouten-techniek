# Voor AI-werkers in deze repo

Lees eerst **`CONTRIBUTING.md`** — daar staan de werkafspraken die voor iedereen
gelden, mens en AI. Dit bestand is de korte versie.

## Het project

Een microlearning-platform voor Schouten Techniek: één zelfstandig HTML-bestand
dat je in de browser opent. React en Tailwind zitten erin; er is geen server en
geen npm.

| Pad | Wat het is |
| --- | --- |
| `src/leerplatform.jsx` | De broncode. Hier bewerk je. |
| `src/technische-startinhoud.js` | De lesbomen, onderwerpen en lesinhoud. |
| `build/build.cjs` | Bouwt het eindbestand. |
| `build/test.cjs` | De controles. |
| `Leerplatform.html` | Het eindproduct. **Gegenereerd — nooit met de hand bewerken.** |
| `LEESMIJ.md` | Wat erin zit, wat gecontroleerd is, en waar de grenzen liggen. |

## Altijd doen

```bash
node build/build.cjs && node build/test.cjs
```

Commit het opnieuw gebouwde `Leerplatform.html` mee. CI bouwt opnieuw en faalt
als het verschilt.

## Nooit doen

- `Leerplatform.html` met de hand bewerken.
- Een API-sleutel in de repo of in het eindbestand zetten.
- Lesinhoud over werken aan installaties publiceren (`concept: false`) zonder
  controle door iemand die NEN 3140-vakbekwaam is.
- Voortgang, scores of herhaalgeschiedenis verzinnen om een scherm te vullen.
- Uitlegteksten aan schermen toevoegen; de werking spreekt voor zich.

## Branch en PR

Branch: `codex/<korte-naam>` (Claude gebruikt `claude/<korte-naam>`).
Eén issue, één branch, één pull request. Claim de issue voor je begint.
