---
name: leerplatform-omgeving
description: Werkomgeving van het Leerplatform Schouten Techniek in de cloud: checkout, bouwen en testen, browsercontroles met een tijdelijke server, en wat er niet nodig is. Gebruik bij het opzetten van de omgeving, vóór het draaien van build en tests, of bij een browsercontrole van Leerplatform.html.
---

# Leerplatform Schouten Techniek

Gebruik de bestaande checkout /workspace/leertool-schouten-techniek. Elke cloudtaak heeft al een geïsoleerde omgeving; maak geen Git-worktree tenzij de gebruiker dat expliciet vraagt.
Lees AGENTS.md, CONTRIBUTING.md en CLAUDE.md vóór werkzaamheden. Laat bij omgevingssetup de broncode, tests, afhankelijkheden en het bijgehouden Leerplatform.html ongewijzigd. Bewaar bestaande lokale wijzigingen.

Er is geen npm-installatie, backend, database, omgevingsvariabele of netwerkgeheim nodig. React, Tailwind en Babel staan in build/vendor. Node.js is beschikbaar; CI gebruikt Node 22, deze omgeving is getest met Node 24.19.0. Python 3, Playwright voor Python en /usr/bin/chromium zijn reeds beschikbaar voor browsercontroles.

Controleer vanuit /workspace/leertool-schouten-techniek:
node --version
node build/build.cjs && node build/test.cjs
De build moet slagen en het bestaande testprogramma moet negen controles uitvoeren. Bij omgevingssetup moet git diff --exit-code -- Leerplatform.html slagen wanneer het bestand vóór de build schoon was. Onderzoek een afwijking zonder bijgehouden bestanden te wijzigen. Controleer git status --short vóór en na setup.

Het eindproduct is zelfstandig; normaal is geen blijvende service nodig. Chromium blokkeert file:// in deze cloudomgeving. Voor interne browsercontroles is een tijdelijke HTTP-server op loopback wel bruikbaar:
python3 /workspace/.onboarding-leertool/browser-smoke.py
Dit reeds geteste helperbestand buiten de checkout start zelf een tijdelijke server, controleert de leerzijde, lesvoorbereiding, persistente browseropslag en JavaScript-fouten en sluit browser en server af. Het verandert geen repositorybestanden.

Alleen indien tijdens ontwikkeling een blijvende lokale server nodig is: start vanuit de checkout python3 -m http.server 8765 --bind 127.0.0.1 --directory /workspace/leertool-schouten-techniek. Controleer intern met een HTTP-request naar /Leerplatform.html (status 200) en een browsercontrole van de knoppen Naar mijn lesbomen en Naar lesvoorbereiding. Hergebruik een passende bestaande server; stop uitsluitend processen die je zelf hebt gestart. Geef geen localhost-previewlink aan de gebruiker. Processen blijven niet behouden tussen taken.

GitHub-leestoegang via de bestaande platformproxy is gecontroleerd met git ls-remote origin HEAD. Vraag geen GitHub-token omdat GH_TOKEN/GITHUB_TOKEN ontbreken. Er is momenteel geen AI-koppeling; voeg geen API-sleutels toe.
