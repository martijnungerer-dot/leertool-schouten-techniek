# Voor Codex

Lees eerst **`CONTRIBUTING.md`**. Daar staan alle werkafspraken; dit bestand
voegt alleen toe wat specifiek voor Codex is.

## Het project

Een microlearning-platform voor Schouten Techniek: één zelfstandig HTML-bestand
dat je in de browser opent. Bewerk `src/`, nooit `Leerplatform.html`. De opbouw
staat in `README.md`.

## Hoe je werk krijgt

- Een opdracht komt van Martijn in de app; de issue is de opdracht. Claude
  reviewt je werk en merget het na een geslaagde review.
- Werk op de branch die in de opdracht staat, anders `codex/<korte-naam>`.
- Open een pull request naar `main` met het sjabloon ingevuld en
  `Closes #<nummer>`. Merge nooit zelf.
- Een review vraagt Martijn je in de app of als `@codex review` op een pull
  request. Zet je bevindingen als review op die pull request.

Lees `.agents/skills/leerplatform-omgeving/SKILL.md` voordat je bouwt, test of
een browsercontrole draait.
