# Leerplatform (Schouten Techniek)

Een AI-gestuurd microlearning-platform in één standalone HTML-bestand. Je opent
het gewoon in de browser — geen server of installatie nodig. De app genereert
leerpaden (domeinen → topics → lessen → vragen) met behulp van de Anthropic API.

## Bestanden

| Pad | Wat het is |
| --- | --- |
| `src/leerplatform.jsx` | **De broncode** — hier bewerk je alles (uiterlijk, gedrag, didactiek). Leesbaar React. |
| `build/shell-head.html` | De vaste "verpakking" bovenaan (React, Tailwind, Babel, laadscherm). Zelden aanpassen. |
| `build/shell-tail.html` | De vaste opstartcode onderaan. Zelden aanpassen. |
| `build/build.py` | Het bouwscript dat de broncode + verpakking samenvoegt tot het standalone bestand. |
| `Leerplatform_demo_standalone.html` | **Het eindproduct** — dit deel je / open je. Wordt gegenereerd, niet met de hand bewerkt. |

## Werkwijze

1. Bewerk de broncode in **`src/leerplatform.jsx`**.
2. Bouw het standalone bestand opnieuw:

   ```bash
   python3 build/build.py
   ```

3. Open `Leerplatform_demo_standalone.html` in je browser om te testen.
4. Commit zowel de broncode als het gegenereerde bestand.

> Bewerk `Leerplatform_demo_standalone.html` **nooit** met de hand — je
> wijziging gaat verloren bij de volgende build. De broncode is de baas.

## Techniek

- **React** (uit een ingesloten UMD-build) + **Tailwind** voor de opmaak.
- **Babel** vertaalt de JSX live in de browser (`<script type="text/babel">`).
- De app roept `https://api.anthropic.com/v1/messages` aan om leerinhoud te
  genereren. De API-sleutel wordt door de gebruiker ingevoerd en lokaal
  bewaard (`localStorage`) — er staat geen sleutel in de code.

## Huisstijl

De vormgeving volgt de huisstijl van Schouten Techniek. De domeinkleuren staan
bovenaan de broncode (`START_DOMEINEN`).
