// Meegeleverde AI-leergang op verzoek van Martijn, 17 november 2026, issue #78.
// Beperkte uitzondering op CONTRIBUTING.md; zie docs/ai-leergang.md.
// Alleen lesinhoud, nooit leerlingvoortgang. Identiteiten na uitrol behouden.
const START_DOMEINEN = [
  {
    "id": "d-ai-slim-werken",
    "naam": "Slim werken met AI",
    "omschrijving": "21 korte lessen over slim werken met AI, met fictieve werksituaties en oefeningen. Gebruik bij het oefenen een toegestane AI-omgeving; de AI-knop in deze leertool is nog niet aangesloten.",
    "kleur": "#367999"
  }
];
const START_TOPICS = [
  {
    "id": "ai-basis",
    "domeinId": "d-ai-slim-werken",
    "titel": "ChatGPT in je dagelijkse werk",
    "ondertitel": "De basis: vragen, schrijven, leren en controleren.",
    "prerequisites": [],
    "gridPos": {
      "tier": 1,
      "track": 1
    },
    "orbs": [
      {
        "id": "ai-basis-01",
        "titel": "Stel een vraag met context",
        "blokken": [
          {
            "type": "tekst",
            "titel": "Herken je dit?",
            "tekst": "Je vraagt: Maak een planning. Het antwoord past niet bij jouw team."
          },
          {
            "type": "tekst",
            "titel": "Dit leer je",
            "tekst": "Je kunt een opdracht schrijven met doel, doelgroep, invoer en gewenste vorm. Een langere prompt is niet vanzelf beter: geef de informatie die het antwoord moet sturen."
          },
          {
            "type": "stappen",
            "titel": "Zo pak je het aan",
            "stappen": [
              {
                "label": "Maak het concreet",
                "beschrijving": "Voorbeeld: Maak een agenda voor een fictieve dagstart van 15 minuten met vijf monteurs. Verdeel de tijd over planning, materiaal en vragen. Geef een tabel; verzin geen projecten of afspraken."
              },
              {
                "label": "Probeer het zelf",
                "beschrijving": "Schrijf een opdracht voor een fictieve dagstart van 15 minuten met vijf collega’s."
              }
            ]
          },
          {
            "type": "tekst",
            "titel": "Jouw praktijkopdracht",
            "tekst": "Schrijf een opdracht voor een fictieve dagstart van 15 minuten met vijf collega’s. Vergelijk je resultaat met het leerdoel en verbeter één punt."
          }
        ],
        "vragen": [
          {
            "id": "ai-basis-01-v1",
            "vraag": "Wat verbetert een vage opdracht het meest?",
            "opties": [
              "Alleen meer woorden gebruiken",
              "Doel, doelgroep en voorwaarden geven",
              "Steeds dezelfde vraag herhalen"
            ],
            "juisteIndex": 1,
            "uitleg": "Een bruikbare opdracht noemt doel, doelgroep, beschikbare gegevens en gewenste vorm. Vertel wat je wilt bereiken, voor wie en onder welke voorwaarden.",
            "type": "meerkeuze"
          },
          {
            "id": "ai-basis-01-toepassing-01",
            "type": "meerkeuze",
            "vraag": "Je werkvoorbereider wil een overdracht voor de volgende ploeg. Welke opdracht helpt het meest?",
            "opties": [
              "Vat deze fictieve notities samen in vijf acties voor de volgende ploeg; markeer ontbrekende informatie.",
              "Maak van deze notities een uitgebreide tekst met alle mogelijke vervolgstappen.",
              "Maak eerst een algemene overdracht en voeg daarna zelf passende projectdetails toe."
            ],
            "juisteIndex": 0,
            "uitleg": "De eerste opdracht bepaalt invoer, doelgroep en vorm, en voorkomt dat onbekende projectdetails worden ingevuld."
          }
        ]
      },
      {
        "id": "ai-basis-02",
        "titel": "Van losse notities naar actiepunten",
        "blokken": [
          {
            "type": "tekst",
            "titel": "Herken je dit?",
            "tekst": "Na een overleg heb je steekwoorden maar nog geen duidelijk overzicht."
          },
          {
            "type": "tekst",
            "titel": "Dit leer je",
            "tekst": "Je kunt notities omzetten in besluiten, acties en open vragen. Maak onderscheid tussen wat iemand voorstelde en wat echt is afgesproken. Laat een onbekende eigenaar of datum expliciet open."
          },
          {
            "type": "stappen",
            "titel": "Zo pak je het aan",
            "stappen": [
              {
                "label": "Maak het concreet",
                "beschrijving": "Fictieve notitie: Materiaallijst controleren, eigenaar nog kiezen; team besluit vrijdag opnieuw te overleggen. De actie heeft nog geen eigenaar. Vrijdag is de datum van het overleg, niet automatisch de deadline voor de materiaallijst."
              },
              {
                "label": "Probeer het zelf",
                "beschrijving": "Gebruik fictieve overlegnotities en laat een actiepuntenlijst maken."
              }
            ]
          },
          {
            "type": "tekst",
            "titel": "Jouw praktijkopdracht",
            "tekst": "Gebruik fictieve overlegnotities en laat een actiepuntenlijst maken. Vergelijk je resultaat met het leerdoel en verbeter één punt."
          }
        ],
        "vragen": [
          {
            "id": "ai-basis-02-v1",
            "vraag": "Wat moet ChatGPT doen als de verantwoordelijke ontbreekt?",
            "opties": [
              "Markeren als onbekend",
              "Het hele actiepunt weglaten",
              "Zelf iemand aanwijzen"
            ],
            "juisteIndex": 0,
            "uitleg": "ChatGPT kan ordenen, maar mag ontbrekende besluiten of verantwoordelijken niet verzinnen. Vraag om besluiten, actiepunten, eigenaar en open vragen; laat onbekende gegevens open.",
            "type": "meerkeuze"
          },
          {
            "id": "ai-basis-02-toepassing-01",
            "type": "meerkeuze",
            "vraag": "In je notities staat: Factuur nakijken, eigenaar nog kiezen. AI maakt ervan: Administratie controleert de factuur morgen. Wat corrigeer je?",
            "opties": [
              "Alleen de naam van de afdeling, want de actie zelf klopt.",
              "Eigenaar en deadline terug naar onbekend; die afspraken staan niet in de notities.",
              "Het hele actiepunt verwijderen omdat er nog geen eigenaar is."
            ],
            "juisteIndex": 1,
            "uitleg": "De actie is bekend, maar eigenaar en deadline niet. Houd het actiepunt en laat die twee velden open tot iemand ze bevestigt."
          }
        ]
      },
      {
        "id": "ai-basis-03",
        "titel": "Vraag om uitleg op jouw niveau",
        "blokken": [
          {
            "type": "tekst",
            "titel": "Herken je dit?",
            "tekst": "Een nieuw technisch begrip is lastig uit te leggen."
          },
          {
            "type": "tekst",
            "titel": "Dit leer je",
            "tekst": "Je kunt aangeven welke voorkennis je hebt en een uitleg laten aansluiten op je werk. Vraag om een voorbeeld en leg het daarna in je eigen woorden uit. AI-uitleg vervangt geen goedgekeurde werkinstructie of vakbekwame beoordeling."
          },
          {
            "type": "stappen",
            "titel": "Zo pak je het aan",
            "stappen": [
              {
                "label": "Maak het concreet",
                "beschrijving": "Voorbeeld: Leg het verschil tussen een bestandsnaam en een bestandstype uit aan iemand die net met digitale werkbonnen begint. Geef één voorbeeld en stel me daarna een vraag om te controleren of ik het begrijp."
              },
              {
                "label": "Probeer het zelf",
                "beschrijving": "Kies een niet-veiligheidskritisch begrip en laat het op twee niveaus uitleggen."
              }
            ]
          },
          {
            "type": "tekst",
            "titel": "Jouw praktijkopdracht",
            "tekst": "Kies een niet-veiligheidskritisch begrip en laat het op twee niveaus uitleggen. Vergelijk je resultaat met het leerdoel en verbeter één punt."
          }
        ],
        "vragen": [
          {
            "id": "ai-basis-03-v1",
            "vraag": "Wat doe je als een uitleg te ingewikkeld blijft?",
            "opties": [
              "Vraag exact dezelfde uitleg opnieuw",
              "Accepteer dat je het niet snapt",
              "Vraag om een eenvoudiger voorbeeld"
            ],
            "juisteIndex": 2,
            "uitleg": "Je kunt AI laten uitleggen in gewone taal en steeds verder doorvragen. Vraag om een eenvoudige uitleg, een praktijkvoorbeeld en een controlevraag.",
            "type": "meerkeuze"
          },
          {
            "id": "ai-basis-03-toepassing-01",
            "type": "meerkeuze",
            "vraag": "Een nieuwe collega begrijpt het woord versiebeheer niet. Welke vervolgvraag helpt om het begrip te toetsen?",
            "opties": [
              "Geef de volledige technische definitie met alle vaktermen.",
              "Herhaal de uitleg met dezelfde woorden, maar in een kortere alinea.",
              "Leg het uit met twee versies van een werkbon en laat mij daarna het verschil uitleggen."
            ],
            "juisteIndex": 2,
            "uitleg": "Een herkenbaar voorbeeld maakt het begrip concreet. Zelf uitleggen laat zien of je het begrijpt; alleen korter herhalen hoeft dat niet te doen."
          }
        ]
      },
      {
        "id": "ai-basis-04",
        "titel": "Schrijf duidelijker en vriendelijker",
        "blokken": [
          {
            "type": "tekst",
            "titel": "Herken je dit?",
            "tekst": "Je conceptmail aan een leverancier is lang en onduidelijk."
          },
          {
            "type": "tekst",
            "titel": "Dit leer je",
            "tekst": "Je kunt een bericht laten herschrijven met een duidelijke toon en actie. Geef aan welke feiten vaststaan. Vergelijk de nieuwe tekst met je origineel voordat je hem gebruikt: een mooiere zin mag geen nieuwe afspraak worden."
          },
          {
            "type": "stappen",
            "titel": "Zo pak je het aan",
            "stappen": [
              {
                "label": "Maak het concreet",
                "beschrijving": "Origineel: Kunnen jullie vrijdag leveren? Gewenste herschrijving: Kun je bevestigen of levering vrijdag mogelijk is? Onjuist: Bedankt voor de bevestigde levering vrijdag. Die laatste zin maakt van een vraag een toezegging."
              },
              {
                "label": "Probeer het zelf",
                "beschrijving": "Laat een fictieve leveranciersmail herschrijven en controleer toezeggingen."
              }
            ]
          },
          {
            "type": "tekst",
            "titel": "Jouw praktijkopdracht",
            "tekst": "Laat een fictieve leveranciersmail herschrijven en controleer toezeggingen. Vergelijk je resultaat met het leerdoel en verbeter één punt."
          }
        ],
        "vragen": [
          {
            "id": "ai-basis-04-v1",
            "vraag": "Wat moet je controleren na herschrijven?",
            "opties": [
              "Alleen het aantal zinnen",
              "Feiten en toezeggingen",
              "Of AI ook een onderwerp heeft bedacht"
            ],
            "juisteIndex": 1,
            "uitleg": "AI is een redacteur; jij blijft verantwoordelijk voor feiten en toezeggingen. Vraag om helder taalgebruik, een passende toon en behoud van de feiten.",
            "type": "meerkeuze"
          },
          {
            "id": "ai-basis-04-toepassing-01",
            "type": "meerkeuze",
            "vraag": "Je vroeg een leverancier of vrijdag haalbaar is. De herschreven mail zegt: Zoals afgesproken leveren jullie vrijdag. Wat doe je?",
            "opties": [
              "Herstel de vraag om bevestiging; vrijdag is nog niet afgesproken.",
              "Behoud de zin, want een stellige formulering is duidelijker.",
              "Verander alleen vrijdag in een ruimere periode."
            ],
            "juisteIndex": 0,
            "uitleg": "De herschrijving verandert de betekenis. Zolang de leverancier niet heeft bevestigd, moet de tekst een vraag blijven."
          }
        ]
      },
      {
        "id": "ai-basis-05",
        "titel": "Controleer voordat je vertrouwt",
        "blokken": [
          {
            "type": "tekst",
            "titel": "Herken je dit?",
            "tekst": "Een AI-antwoord klinkt overtuigend en noemt zelfs cijfers."
          },
          {
            "type": "tekst",
            "titel": "Dit leer je",
            "tekst": "Je kunt een belangrijke AI-bewering controleren bij de oorspronkelijke bron. Vraag om de vindplaats, open die zelf en vergelijk versie, datum en toepassingsgebied. Ook een geloofwaardig klinkende bronvermelding kan onjuist zijn."
          },
          {
            "type": "stappen",
            "titel": "Zo pak je het aan",
            "stappen": [
              {
                "label": "Maak het concreet",
                "beschrijving": "Een antwoord noemt een garantieperiode van vijf jaar. Open de actuele voorwaarden van de leverancier en controleer product, aankoopdatum en uitzonderingen. Je kunt pas beslissen als de genoemde passage echt bij jouw situatie past."
              },
              {
                "label": "Probeer het zelf",
                "beschrijving": "Laat één feitelijke bewering onderzoeken en controleer de primaire bron."
              }
            ]
          },
          {
            "type": "tekst",
            "titel": "Jouw praktijkopdracht",
            "tekst": "Laat één feitelijke bewering onderzoeken en controleer de primaire bron. Vergelijk je resultaat met het leerdoel en verbeter één punt."
          }
        ],
        "vragen": [
          {
            "id": "ai-basis-05-v1",
            "vraag": "Wat is de beste reactie op een overtuigende maar ongecontroleerde claim?",
            "opties": [
              "De bron zelfstandig controleren",
              "De claim vaker laten herhalen",
              "De claim direct overnemen"
            ],
            "juisteIndex": 0,
            "uitleg": "Een vloeiend antwoord is geen bewijs dat de informatie klopt. Vraag naar onzekerheden en controleer belangrijke claims bij de oorspronkelijke bron.",
            "type": "meerkeuze"
          },
          {
            "id": "ai-basis-05-toepassing-01",
            "type": "meerkeuze",
            "vraag": "AI noemt een garantietermijn met een link naar een leverancier. Welke controle is nodig voordat je die termijn aan een klant doorgeeft?",
            "opties": [
              "Vragen of AI zeker weet dat de termijn klopt.",
              "De actuele voorwaarden openen en nagaan of product en voorwaarden overeenkomen.",
              "Controleren of een tweede AI hetzelfde aantal jaren noemt."
            ],
            "juisteIndex": 1,
            "uitleg": "Een link of een tweede gelijk antwoord is nog geen bewijs. De oorspronkelijke, toepasselijke voorwaarden zijn de bron voor de toezegging."
          }
        ]
      }
    ]
  },
  {
    "id": "ai-workflow",
    "domeinId": "d-ai-slim-werken",
    "titel": "Van losse vraag naar workflow",
    "ondertitel": "Projecten, context, documenten en herhaalbaar werk.",
    "prerequisites": [],
    "gridPos": {
      "tier": 2,
      "track": 1
    },
    "orbs": [
      {
        "id": "ai-workflow-01",
        "titel": "Maak een doorlopend project",
        "blokken": [
          {
            "type": "tekst",
            "titel": "Herken je dit?",
            "tekst": "Je gebruikt elke week dezelfde afspraken en achtergrondinformatie."
          },
          {
            "type": "tekst",
            "titel": "Dit leer je",
            "tekst": "Je kunt vaste instructies en relevante documenten bundelen voor terugkerend werk. Projectfuncties, geheugen en delen verschillen per omgeving en instelling. Controleer wat beschikbaar is, welke versie van een bestand wordt gebruikt en wie toegang heeft."
          },
          {
            "type": "stappen",
            "titel": "Zo pak je het aan",
            "stappen": [
              {
                "label": "Maak het concreet",
                "beschrijving": "Voor een fictief weekoverleg leg je vast: maak een agenda van maximaal vijf punten, gebruik alleen het actuele actieoverzicht en markeer onduidelijke besluiten. Bewaar de actuele afspraken herkenbaar; stapel geen verouderde versies op."
              },
              {
                "label": "Probeer het zelf",
                "beschrijving": "Ontwerp een project voor een fictief wekelijks werkoverleg."
              }
            ]
          },
          {
            "type": "tekst",
            "titel": "Jouw praktijkopdracht",
            "tekst": "Ontwerp een project voor een fictief wekelijks werkoverleg. Vergelijk je resultaat met het leerdoel en verbeter één punt."
          }
        ],
        "vragen": [
          {
            "id": "ai-workflow-01-v1",
            "vraag": "Wat hoort in een projectinstructie?",
            "opties": [
              "Alleen de naam van het project",
              "Alle oude chatberichten zonder selectie",
              "Doel, vaste werkwijze en grenzen"
            ],
            "juisteIndex": 2,
            "uitleg": "Een project kan relevante instructies en documenten bundelen; bekijk wat de gebruikte omgeving onthoudt. Leg doel, werkwijze, gewenste output en grenzen van het project vast.",
            "type": "meerkeuze"
          },
          {
            "id": "ai-workflow-01-toepassing-01",
            "type": "meerkeuze",
            "vraag": "Een project bevat een oude en een nieuwe procedure. AI gebruikt de oude. Welke ingreep pakt de oorzaak aan?",
            "opties": [
              "Voeg beide procedures nogmaals toe zodat ze meer opvallen.",
              "Vraag uitsluitend om kortere antwoorden binnen het project.",
              "Maak de actuele versie leidend en verwijder of markeer de verouderde bron binnen je bevoegdheid."
            ],
            "juisteIndex": 2,
            "uitleg": "De context moet duidelijk maken welke procedure geldig is. Meer kopieën of kortere antwoorden lossen een bronconflict niet op."
          }
        ]
      },
      {
        "id": "ai-workflow-02",
        "titel": "Token hygiene: behoud wat telt",
        "blokken": [
          {
            "type": "tekst",
            "titel": "Herken je dit?",
            "tekst": "Een lange chat raakt vol herhalingen en oude besluiten."
          },
          {
            "type": "tekst",
            "titel": "Dit leer je",
            "tekst": "Je kunt een lange chat overdragen zonder belangrijke context kwijt te raken. Tokens zijn stukjes tekst waarmee een model werkt. Bewaar doel, actuele besluiten, relevante bronverwijzingen, open vragen en volgende stap. Minder tokens garandeert geen extra gebruikstijd: limieten verschillen per product en model."
          },
          {
            "type": "stappen",
            "titel": "Zo pak je het aan",
            "stappen": [
              {
                "label": "Maak het concreet",
                "beschrijving": "Een planning veranderde van dinsdag naar donderdag. Een goede overdracht noemt donderdag als actueel besluit, de nog onbekende bezetting en de volgende controle. Neem de achterhaalde planning alleen mee als die nodig is om een keuze te begrijpen."
              },
              {
                "label": "Probeer het zelf",
                "beschrijving": "Maak een compacte overdracht van een lang, niet-vertrouwelijk gesprek."
              }
            ]
          },
          {
            "type": "tekst",
            "titel": "Jouw praktijkopdracht",
            "tekst": "Maak een compacte overdracht van een lang, niet-vertrouwelijk gesprek. Vergelijk je resultaat met het leerdoel en verbeter één punt."
          }
        ],
        "vragen": [
          {
            "id": "ai-workflow-02-v1",
            "vraag": "Wanneer helpt een nieuwe chat met overdracht?",
            "opties": [
              "Na precies tien berichten",
              "Als oude context het werk blijft verstoren",
              "Na iedere vraag, ongeacht de taak"
            ],
            "juisteIndex": 1,
            "uitleg": "Efficiënt contextbeheer gaat over relevantie, niet alleen over zo weinig mogelijk tokens. Minder tokens garandeert geen extra gebruiksuren. Vat doelen, actuele besluiten, relevante feiten, open vragen en volgende stap samen; begin zo nodig opnieuw.",
            "type": "meerkeuze"
          },
          {
            "id": "ai-workflow-02-toepassing-01",
            "type": "meerkeuze",
            "vraag": "Je begint een nieuwe chat over een gewijzigde planning. Welke overdracht is het bruikbaarst?",
            "opties": [
              "Het actuele doel, de geldende planning, relevante bronverwijzingen, open punten en de volgende stap.",
              "Alle oude berichten inclusief vervallen plannen, zonder aan te geven wat nog geldt.",
              "Alleen de laatste AI-uitkomst, ook als daarin nog onbevestigde aannames staan."
            ],
            "juisteIndex": 0,
            "uitleg": "Een overdracht bewaart relevante context én de status ervan. Zowel een ongesorteerd archief als een losse einduitkomst kan oude fouten meenemen."
          }
        ]
      },
      {
        "id": "ai-workflow-03",
        "titel": "Analyseer een bestand met broncontrole",
        "blokken": [
          {
            "type": "tekst",
            "titel": "Herken je dit?",
            "tekst": "Je hebt een spreadsheet met fictieve werkbonnen en wilt patronen ontdekken."
          },
          {
            "type": "tekst",
            "titel": "Dit leer je",
            "tekst": "Je kunt een bestandsanalyse controleren op gebruikte rijen, filters, eenheden en ontbrekende waarden. Een leeg urenveld is niet hetzelfde als nul uur. Controleer een aantal bronregels en reken een belangrijk totaal onafhankelijk na."
          },
          {
            "type": "stappen",
            "titel": "Zo pak je het aan",
            "stappen": [
              {
                "label": "Maak het concreet",
                "beschrijving": "In een fictief overzicht staan werkbonnen van 2 uur, 3 uur en een lege waarde. Bekend totaal: 5 uur. Het volledige totaal is nog onbekend. Laat AI de ontbrekende waarde apart melden, niet vervangen door nul."
              },
              {
                "label": "Probeer het zelf",
                "beschrijving": "Gebruik een oefenspreadsheet met fictieve meldingen."
              }
            ]
          },
          {
            "type": "tekst",
            "titel": "Jouw praktijkopdracht",
            "tekst": "Gebruik een oefenspreadsheet met fictieve meldingen. Vergelijk je resultaat met het leerdoel en verbeter één punt."
          }
        ],
        "vragen": [
          {
            "id": "ai-workflow-03-v1",
            "vraag": "Wat maakt een analyse controleerbaar?",
            "opties": [
              "Verwijzing naar onderliggende gegevens",
              "Een stellige conclusie zonder voorbeelden",
              "Veel grafieken zonder data"
            ],
            "juisteIndex": 0,
            "uitleg": "Een AI-conclusie is pas sterk als je kunt herleiden op welke gegevens die rust. Laat trends en ontbrekende waarden noemen en vraag telkens om onderbouwing.",
            "type": "meerkeuze"
          },
          {
            "id": "ai-workflow-03-toepassing-01",
            "type": "meerkeuze",
            "vraag": "In drie werkbonnen staan 2 uur, 3 uur en een leeg urenveld. Wat hoort in de analyse?",
            "opties": [
              "Het totaal is 5 uur voor alle drie de werkbonnen.",
              "Er is 5 uur geregistreerd; voor één werkbon ontbreken de uren.",
              "De lege werkbon krijgt het gemiddelde van de andere twee zonder vermelding."
            ],
            "juisteIndex": 1,
            "uitleg": "Vijf uur is het bekende subtotaal. De ontbrekende waarde mag niet stil als nul of als schatting worden meegerekend."
          }
        ]
      },
      {
        "id": "ai-workflow-04",
        "titel": "Laat taken als proces samenwerken",
        "blokken": [
          {
            "type": "tekst",
            "titel": "Herken je dit?",
            "tekst": "Je moet een overleg voorbereiden, verslaan en opvolgen."
          },
          {
            "type": "tekst",
            "titel": "Dit leer je",
            "tekst": "Je kunt een taak opdelen in stappen met een controleerbaar resultaat. Beschrijf per stap de invoer, uitvoer en controle. Laat pas de gecontroleerde uitkomst doorgaan naar de volgende stap; anders verspreidt een vroege fout zich."
          },
          {
            "type": "stappen",
            "titel": "Zo pak je het aan",
            "stappen": [
              {
                "label": "Maak het concreet",
                "beschrijving": "Fictief overlegproces: agenda maken → besproken besluiten vastleggen → besluiten bevestigen → actieoverzicht maken. Een voorgestelde datum wordt pas een deadline als het team die heeft afgesproken."
              },
              {
                "label": "Probeer het zelf",
                "beschrijving": "Ontwerp een fictief overlegproces van agenda tot actieoverzicht."
              }
            ]
          },
          {
            "type": "tekst",
            "titel": "Jouw praktijkopdracht",
            "tekst": "Ontwerp een fictief overlegproces van agenda tot actieoverzicht. Vergelijk je resultaat met het leerdoel en verbeter één punt."
          }
        ],
        "vragen": [
          {
            "id": "ai-workflow-04-v1",
            "vraag": "Wat is verstandig bij een meerstapsproces?",
            "opties": [
              "Pas op het eind besluiten wat je wilde",
              "Alles in één keer blind uitvoeren",
              "Per stap controleren voordat je verdergaat"
            ],
            "juisteIndex": 2,
            "uitleg": "Een workflow verbindt meerdere stappen en controleert de uitkomst van iedere stap. Maak eerst de stappen, voer ze één voor één uit en bepaal per stap wat klaar betekent.",
            "type": "meerkeuze"
          },
          {
            "id": "ai-workflow-04-toepassing-01",
            "type": "meerkeuze",
            "vraag": "AI heeft een verslag gemaakt en wil daaruit direct taken plannen. Enkele besluiten zijn nog onduidelijk. Wat is de volgende stap?",
            "opties": [
              "De taken alvast plannen en eventuele fouten later herstellen.",
              "De onduidelijke besluiten automatisch als akkoord behandelen.",
              "Eerst besluiten en eigenaars controleren, daarna alleen bevestigde acties doorzetten."
            ],
            "juisteIndex": 2,
            "uitleg": "De taakplanning hangt af van het verslag. Een controle tussen die stappen voorkomt dat onduidelijke voorstellen echte opdrachten worden."
          }
        ]
      },
      {
        "id": "ai-workflow-05",
        "titel": "Terugkerend werk en slimme controles",
        "blokken": [
          {
            "type": "tekst",
            "titel": "Herken je dit?",
            "tekst": "Iedere vrijdag verzamel je dezelfde openstaande punten."
          },
          {
            "type": "tekst",
            "titel": "Dit leer je",
            "tekst": "Je kunt een terugkerende taak beschrijven met bron, moment, resultaat en controleur. Beschikbare planningsfuncties en rechten verschillen per omgeving. Leg ook vast wat er moet gebeuren als gegevens ontbreken of een bron niet bereikbaar is."
          },
          {
            "type": "stappen",
            "titel": "Zo pak je het aan",
            "stappen": [
              {
                "label": "Maak het concreet",
                "beschrijving": "Voorbeeld: Maak vrijdag om 10.00 uur een conceptoverzicht uit het goedgekeurde actieblad. Toon de datum van de bron. Als ophalen mislukt, meld dat en stuur geen oud overzicht alsof het actueel is. De teamleider controleert vóór delen."
              },
              {
                "label": "Probeer het zelf",
                "beschrijving": "Ontwerp een wekelijkse rapportage met fictieve actiepunten."
              }
            ]
          },
          {
            "type": "tekst",
            "titel": "Jouw praktijkopdracht",
            "tekst": "Ontwerp een wekelijkse rapportage met fictieve actiepunten. Vergelijk je resultaat met het leerdoel en verbeter één punt."
          }
        ],
        "vragen": [
          {
            "id": "ai-workflow-05-v1",
            "vraag": "Wat moet geregeld zijn voor automatisering?",
            "opties": [
              "Alleen een mooi sjabloon",
              "Bronnen, rechten en controlepunten",
              "Een prompt die zo lang mogelijk is"
            ],
            "juisteIndex": 1,
            "uitleg": "Een terugkerende taak loont pas wanneer gegevens, toestemming en controle helder zijn. Specificeer welke bronnen gebruikt mogen worden, wat er wordt gerapporteerd en wie controleert.",
            "type": "meerkeuze"
          },
          {
            "id": "ai-workflow-05-toepassing-01",
            "type": "meerkeuze",
            "vraag": "De wekelijkse rapportagetaak kan de bron niet ophalen. Wat moet de afgesproken werkwijze opleveren?",
            "opties": [
              "Een melding dat ophalen mislukte, met de datum van eventuele oude gegevens en controle vóór gebruik.",
              "De laatste rapportage met de datum van vandaag als actuele rapportage.",
              "Een leeg overzicht met nul openstaande acties."
            ],
            "juisteIndex": 0,
            "uitleg": "Een mislukte ophaling betekent niet dat er geen acties zijn. De fout en de ouderdom van eventuele oude gegevens moeten herkenbaar blijven."
          }
        ]
      }
    ]
  },
  {
    "id": "ai-ervaring",
    "domeinId": "d-ai-slim-werken",
    "titel": "Wat ervaren AI-gebruikers anders doen",
    "ondertitel": "Herken vastlopers, kwaliteitsproblemen en het juiste schakelmoment.",
    "prerequisites": [],
    "gridPos": {
      "tier": 2,
      "track": 2
    },
    "orbs": [
      {
        "id": "ai-ervaring-01",
        "titel": "Stop met eindeloos corrigeren",
        "blokken": [
          {
            "type": "tekst",
            "titel": "Herken je dit?",
            "tekst": "Je hebt drie keer dezelfde fout in een planning gecorrigeerd."
          },
          {
            "type": "tekst",
            "titel": "Dit leer je",
            "tekst": "Je kunt herkennen wanneer verder corrigeren niet helpt. Stop dan en zet doel, huidige feiten en randvoorwaarden opnieuw op een rij. Verander de opdracht of aanpak gericht; spreek vooraf af hoe je dezelfde fout gaat opsporen."
          },
          {
            "type": "stappen",
            "titel": "Zo pak je het aan",
            "stappen": [
              {
                "label": "Maak het concreet",
                "beschrijving": "AI plant dezelfde collega steeds dubbel. Herstart met de beschikbare diensten en de eis: iedere collega maximaal één dienst per dag. Laat vóór oplevering een lijst van dubbele toewijzingen controleren."
              },
              {
                "label": "Probeer het zelf",
                "beschrijving": "Herschrijf een vastgelopen fictieve opdracht met drie acceptatiecriteria."
              }
            ]
          },
          {
            "type": "tekst",
            "titel": "Jouw praktijkopdracht",
            "tekst": "Herschrijf een vastgelopen fictieve opdracht met drie acceptatiecriteria. Vergelijk je resultaat met het leerdoel en verbeter één punt."
          }
        ],
        "vragen": [
          {
            "id": "ai-ervaring-01-v1",
            "vraag": "Welke stap is slim wanneer dezelfde fout terugkomt?",
            "opties": [
              "Herstart met een heldere opdracht en controles",
              "Negeer de fout",
              "Blijf identieke correcties sturen"
            ],
            "juisteIndex": 0,
            "uitleg": "Soms werkt opnieuw formuleren met duidelijke eisen beter dan doorgaan met correcties. Herformuleer het doel, geef randvoorwaarden en laat controles vooraf afspreken.",
            "type": "meerkeuze"
          },
          {
            "id": "ai-ervaring-01-toepassing-01",
            "type": "meerkeuze",
            "vraag": "Een rooster plant steeds dezelfde monteur op twee locaties tegelijk. Welke nieuwe opdracht helpt het meest?",
            "opties": [
              "Maak het rooster nogmaals, maar nu echt zonder fouten.",
              "Gebruik deze beschikbaarheid, plan niemand tegelijk op twee locaties en controleer per monteur op overlap.",
              "Behoud het rooster en haal alleen de waarschuwingen weg."
            ],
            "juisteIndex": 1,
            "uitleg": "De herstart bevat de benodigde gegevens, een concrete grens en een controle op de terugkerende fout. Alleen harder aandringen voegt geen toetsbare eis toe."
          }
        ]
      },
      {
        "id": "ai-ervaring-02",
        "titel": "Laat eerst een plan maken",
        "blokken": [
          {
            "type": "tekst",
            "titel": "Herken je dit?",
            "tekst": "Een opdracht bevat analyse, documenten en meerdere beslissingen."
          },
          {
            "type": "tekst",
            "titel": "Dit leer je",
            "tekst": "Je kunt bij een ingewikkelde opdracht eerst de aanpak beoordelen. Een bruikbaar plan noemt stappen, benodigde bronnen, aannames en beslismomenten. Keur alleen de bedoelde uitvoering goed; een analyseplan is geen toestemming voor versturen of publiceren."
          },
          {
            "type": "stappen",
            "titel": "Zo pak je het aan",
            "stappen": [
              {
                "label": "Maak het concreet",
                "beschrijving": "Voor een fictief verbeterproject: beschrijf het probleem, verzamel toegestane voorbeelden, vergelijk oplossingen, test klein en evalueer. Ontbreekt een besluit over de doelgroep, los dat op voordat een hulpmiddel wordt uitgerold."
              },
              {
                "label": "Probeer het zelf",
                "beschrijving": "Laat een verbeterproject opdelen in maximaal vijf stappen."
              }
            ]
          },
          {
            "type": "tekst",
            "titel": "Jouw praktijkopdracht",
            "tekst": "Laat een verbeterproject opdelen in maximaal vijf stappen. Vergelijk je resultaat met het leerdoel en verbeter één punt."
          }
        ],
        "vragen": [
          {
            "id": "ai-ervaring-02-v1",
            "vraag": "Waarom eerst een plan bij ingewikkeld werk?",
            "opties": [
              "AI kan daarna nooit meer fouten maken",
              "Het maakt controleren overbodig",
              "Je kunt aannames en ontbrekende stappen beoordelen"
            ],
            "juisteIndex": 2,
            "uitleg": "Bij complex werk helpt een zichtbaar plan om fouten vroeg te ontdekken. Laat een voorstel in stappen maken en geef pas daarna toestemming voor uitvoering.",
            "type": "meerkeuze"
          },
          {
            "id": "ai-ervaring-02-toepassing-01",
            "type": "meerkeuze",
            "vraag": "Een plan voor een nieuw teamoverzicht begint direct met bouwen. Doelgroep en gegevensbron zijn nog onbekend. Wat pas je aan?",
            "opties": [
              "Voeg een mooiere vormgeving toe als eerste stap.",
              "Laat bouwen doorgaan en beslis pas bij oplevering wie het gebruikt.",
              "Zet het bepalen van doelgroep, bron en gewenste uitkomst vóór de bouwstap."
            ],
            "juisteIndex": 2,
            "uitleg": "Die keuzes bepalen wat er gebouwd moet worden en welke gegevens passend zijn. Een plan maakt zulke ontbrekende voorwaarden zichtbaar vóór uitvoering."
          }
        ]
      },
      {
        "id": "ai-ervaring-03",
        "titel": "Bewaar een goede tussenversie",
        "blokken": [
          {
            "type": "tekst",
            "titel": "Herken je dit?",
            "tekst": "Een tekst of digitaal hulpmiddel werkt goed, maar je wilt nog iets veranderen."
          },
          {
            "type": "tekst",
            "titel": "Dit leer je",
            "tekst": "Je kunt een werkende versie bewaren voordat je verder wijzigt. Geef versies een herkenbare naam en noteer wat veranderde. Controleer dat de bewaarde versie echt terug te openen is. Versiebeheer bewaart wijzigingen; het test ze niet automatisch."
          },
          {
            "type": "stappen",
            "titel": "Zo pak je het aan",
            "stappen": [
              {
                "label": "Maak het concreet",
                "beschrijving": "Bewaar een goedgekeurde tekst als Overdracht-v1. Maak de kortere variant als v2 en vergelijk de afspraken. Is v2 slechter, dan kun je terug naar v1 zonder de oorspronkelijke tekst uit chatfragmenten te reconstrueren."
              },
              {
                "label": "Probeer het zelf",
                "beschrijving": "Maak een fictieve werkinstructie in versie 1 en een gewijzigde versie 2."
              }
            ]
          },
          {
            "type": "tekst",
            "titel": "Jouw praktijkopdracht",
            "tekst": "Maak een fictieve werkinstructie in versie 1 en een gewijzigde versie 2. Vergelijk je resultaat met het leerdoel en verbeter één punt."
          }
        ],
        "vragen": [
          {
            "id": "ai-ervaring-03-v1",
            "vraag": "Waarom een werkende versie bewaren?",
            "opties": [
              "Dan zijn tests niet meer nodig",
              "Je kunt een mislukte wijziging terugdraaien",
              "Dan kun je onbeperkt gegevens delen"
            ],
            "juisteIndex": 1,
            "uitleg": "Een bewaarde tussenversie maakt teruggaan mogelijk als de volgende wijziging mislukt. Bewaar bestanden met versienaam; gebruik voor code versiebeheer.",
            "type": "meerkeuze"
          },
          {
            "id": "ai-ervaring-03-toepassing-01",
            "type": "meerkeuze",
            "vraag": "Je wilt een werkende checklist aanpassen. Hoe zorg je dat je bij een slechte wijziging terug kunt?",
            "opties": [
              "Bewaar eerst de werkende versie en controleer dat je die kunt openen; maak daarna de wijziging apart.",
              "Overschrijf de werkende versie en vraag AI zo nodig om hem te reconstrueren.",
              "Bewaar alleen een afbeelding van het beginscherm."
            ],
            "juisteIndex": 0,
            "uitleg": "Je hebt een terug te zetten bestand of versie nodig. Een screenshot of een nieuwe reconstructie bewaart niet alle inhoud en werking."
          }
        ]
      },
      {
        "id": "ai-ervaring-04",
        "titel": "Spreek af wat goed betekent",
        "blokken": [
          {
            "type": "tekst",
            "titel": "Herken je dit?",
            "tekst": "Een planning ziet er netjes uit maar bevat dubbele diensten."
          },
          {
            "type": "tekst",
            "titel": "Dit leer je",
            "tekst": "Je kunt vooraf benoemen wat een resultaat goed maakt. Kies controleerbare criteria voor inhoud en gedrag, niet alleen voor uiterlijk. Gebruik een bekend voorbeeld waarmee je het verwachte resultaat kunt vergelijken."
          },
          {
            "type": "stappen",
            "titel": "Zo pak je het aan",
            "stappen": [
              {
                "label": "Maak het concreet",
                "beschrijving": "Voor een fictief rooster: geen dubbele toewijzingen, iedere dienst bezet en niemand buiten de opgegeven beschikbaarheid. Een rustig kleurenschema is prettig, maar bewijst geen van deze drie eigenschappen."
              },
              {
                "label": "Probeer het zelf",
                "beschrijving": "Maak drie controles voor een fictieve roosterplanning."
              }
            ]
          },
          {
            "type": "tekst",
            "titel": "Jouw praktijkopdracht",
            "tekst": "Maak drie controles voor een fictieve roosterplanning. Vergelijk je resultaat met het leerdoel en verbeter één punt."
          }
        ],
        "vragen": [
          {
            "id": "ai-ervaring-04-v1",
            "vraag": "Wat is een goed acceptatiecriterium?",
            "opties": [
              "Geen medewerker staat dubbel ingepland",
              "AI zegt dat het klaar is",
              "Het resultaat ziet professioneel uit"
            ],
            "juisteIndex": 0,
            "uitleg": "Een mooie presentatie is niet hetzelfde als een correct resultaat. Omschrijf meetbare acceptatiecriteria voordat AI begint.",
            "type": "meerkeuze"
          },
          {
            "id": "ai-ervaring-04-toepassing-01",
            "type": "meerkeuze",
            "vraag": "Welke afspraak maakt een materiaaloverzicht toetsbaar?",
            "opties": [
              "Het overzicht moet professioneel en compleet ogen.",
              "Iedere ingevoerde artikelregel komt precies één keer terug en het totaal klopt met een handmatig nagerekend voorbeeld.",
              "De maker noemt de versie definitief zodra de tabel netjes is opgemaakt."
            ],
            "juisteIndex": 1,
            "uitleg": "Je kunt aantallen en totalen daadwerkelijk controleren. Professioneel of definitief zijn zonder concrete criteria geen bewijs van volledigheid."
          }
        ]
      },
      {
        "id": "ai-ervaring-05",
        "titel": "Scheid feiten, aannames en voorstellen",
        "blokken": [
          {
            "type": "tekst",
            "titel": "Herken je dit?",
            "tekst": "AI combineert brongegevens met mogelijke verklaringen."
          },
          {
            "type": "tekst",
            "titel": "Dit leer je",
            "tekst": "Je kunt bronfeiten, aannames en voorstellen uit elkaar houden. Een bronfeit is wat aantoonbaar in de bron staat; de bron zelf kan nog controle nodig hebben. Een mogelijke verklaring is geen gemeten oorzaak en een advies is nog geen besluit."
          },
          {
            "type": "stappen",
            "titel": "Zo pak je het aan",
            "stappen": [
              {
                "label": "Maak het concreet",
                "beschrijving": "Fictief rapport: vijf meldingen op maandag is een bronfeit. Misschien was de bezetting laag is een aanname zonder roostergegevens. Vergelijk met het rooster is een voorstel voor onderzoek."
              },
              {
                "label": "Probeer het zelf",
                "beschrijving": "Laat een fictief storingsrapport zo uitsplitsen."
              }
            ]
          },
          {
            "type": "tekst",
            "titel": "Jouw praktijkopdracht",
            "tekst": "Laat een fictief storingsrapport zo uitsplitsen. Vergelijk je resultaat met het leerdoel en verbeter één punt."
          }
        ],
        "vragen": [
          {
            "id": "ai-ervaring-05-v1",
            "vraag": "Wat is een aanname?",
            "opties": [
              "Een gecontroleerde bronwaarde",
              "Een letterlijk geciteerd meetresultaat",
              "Een nog niet onderbouwde verklaring"
            ],
            "juisteIndex": 2,
            "uitleg": "Je moet kunnen zien wat bewezen is en wat AI erbij bedenkt. Vraag drie aparte onderdelen: bronfeiten, aannames en aanbevelingen.",
            "type": "meerkeuze"
          },
          {
            "id": "ai-ervaring-05-toepassing-01",
            "type": "meerkeuze",
            "vraag": "Een rapport vermeldt vijf meldingen. AI schrijft: Dat komt door onderbezetting; vergelijk het rooster. Hoe deel je dit in?",
            "opties": [
              "Alle drie de uitspraken zijn feiten omdat ze in één rapport staan.",
              "Vijf meldingen is een aanname; onderbezetting is automatisch een feit.",
              "Vijf meldingen is een bronfeit, onderbezetting een aanname en roostervergelijking een voorstel."
            ],
            "juisteIndex": 2,
            "uitleg": "De telling staat in de bron. De oorzaak is nog niet onderbouwd en de vergelijking is een mogelijke vervolgstap, geen uitgevoerd onderzoek."
          }
        ]
      },
      {
        "id": "ai-ervaring-06",
        "titel": "Weet wanneer je van aanpak wisselt",
        "blokken": [
          {
            "type": "tekst",
            "titel": "Herken je dit?",
            "tekst": "Je gebruikt veel tijd aan een eenvoudige klus of juist te weinig aan een complexe analyse."
          },
          {
            "type": "tekst",
            "titel": "Dit leer je",
            "tekst": "Je kunt een aanpak kiezen op basis van moeilijkheid, risico, beschikbare functies en kosten. Een eenvoudige tekstbewerking vraagt iets anders dan een afweging met tegenstrijdige gegevens. Een zwaarder model vervangt broncontrole of vakkennis niet."
          },
          {
            "type": "stappen",
            "titel": "Zo pak je het aan",
            "stappen": [
              {
                "label": "Maak het concreet",
                "beschrijving": "Voor een korte fictieve mail kan snelle redactie volstaan. Voor een projectafweging zet je eerst criteria en bronnen vast, laat je aannames benoemen en laat je de uitkomst door een deskundige beoordelen. Kies alleen beschikbare, toegestane hulpmiddelen."
              },
              {
                "label": "Probeer het zelf",
                "beschrijving": "Vergelijk een korte mailbewerking met een complexe afweging over een project."
              }
            ]
          },
          {
            "type": "tekst",
            "titel": "Jouw praktijkopdracht",
            "tekst": "Vergelijk een korte mailbewerking met een complexe afweging over een project. Vergelijk je resultaat met het leerdoel en verbeter één punt."
          }
        ],
        "vragen": [
          {
            "id": "ai-ervaring-06-v1",
            "vraag": "Wat bepaalt de passende AI-aanpak?",
            "opties": [
              "Altijd de zwaarste instelling kiezen",
              "Complexiteit, risico en vereiste controle",
              "Altijd de snelste instelling kiezen"
            ],
            "juisteIndex": 1,
            "uitleg": "Een passend model of hulpmiddel kiezen hangt af van moeilijkheid, risico en kosten. Gebruik snelle ondersteuning voor eenvoudige bewerkingen; kies diepere analyse voor moeilijke afwegingen.",
            "type": "meerkeuze"
          },
          {
            "id": "ai-ervaring-06-toepassing-01",
            "type": "meerkeuze",
            "vraag": "Je moet een korte mail inkorten én een projectafweging met tegenstrijdige gegevens maken. Wat past?",
            "opties": [
              "De mail gericht redigeren; voor de projectafweging bronnen, criteria en een uitgebreidere controle organiseren.",
              "Beide taken met de snelste instelling uitvoeren omdat snelheid altijd voorrang heeft.",
              "Voor beide taken het zwaarste model gebruiken en de uitkomsten zonder controle overnemen."
            ],
            "juisteIndex": 0,
            "uitleg": "Pas de inspanning aan de taak en het risico aan. De ingewikkelde afweging vraagt om onderbouwing en controle, ongeacht welk model je gebruikt."
          }
        ]
      },
      {
        "id": "ai-ervaring-07",
        "titel": "Denk eerst, voer daarna pas uit",
        "blokken": [
          {
            "type": "tekst",
            "titel": "Herken je dit?",
            "tekst": "AI stelt voor een bestand te wijzigen of een e-mail te verzenden."
          },
          {
            "type": "tekst",
            "titel": "Dit leer je",
            "tekst": "Je kunt onderscheid maken tussen een voorstel en een handeling met gevolgen. Controleer vóór verzenden, verwijderen of wijzigen de inhoud, ontvangers en reikwijdte. Geef expliciet toestemming voor de concrete handeling, binnen je eigen bevoegdheid."
          },
          {
            "type": "stappen",
            "titel": "Zo pak je het aan",
            "stappen": [
              {
                "label": "Maak het concreet",
                "beschrijving": "Een mailconcept laten schrijven is iets anders dan de mail laten verzenden. Bekijk eerst de definitieve tekst, bijlagen en ontvangers. Geef pas akkoord voor die versie; een gewijzigde ontvangerslijst vraagt opnieuw aandacht."
              },
              {
                "label": "Probeer het zelf",
                "beschrijving": "Beschrijf een fictieve actie en verdeel die in voorstel, controle en uitvoering."
              }
            ]
          },
          {
            "type": "tekst",
            "titel": "Jouw praktijkopdracht",
            "tekst": "Beschrijf een fictieve actie en verdeel die in voorstel, controle en uitvoering. Vergelijk je resultaat met het leerdoel en verbeter één punt."
          }
        ],
        "vragen": [
          {
            "id": "ai-ervaring-07-v1",
            "vraag": "Wat is verstandig bij een onomkeerbare actie?",
            "opties": [
              "Eerst gevolgen controleren en toestemming geven",
              "Geen log of back-up maken",
              "AI altijd autonoom laten handelen"
            ],
            "juisteIndex": 0,
            "uitleg": "Analyse en uitvoeren zijn verschillende bevoegdheden; gevoelige acties vragen controle. Vraag eerst een voorstel, controleer gevolgen en geef pas dan expliciet toestemming.",
            "type": "meerkeuze"
          },
          {
            "id": "ai-ervaring-07-toepassing-01",
            "type": "meerkeuze",
            "vraag": "Je hebt AI gevraagd een mailconcept te maken. AI biedt aan om het aan alle leveranciers te sturen. Wat doe je?",
            "opties": [
              "Verzenden toestaan omdat schrijven en versturen bij dezelfde opdracht horen.",
              "Eerst tekst, bijlagen en beoogde ontvangers controleren en alleen de bedoelde verzending autoriseren.",
              "Alleen de onderwerpregel controleren; de ontvangers zijn minder belangrijk."
            ],
            "juisteIndex": 1,
            "uitleg": "Een schrijfopdracht geeft nog geen verzendopdracht. De concrete inhoud en ontvangers bepalen de gevolgen van de handeling."
          }
        ]
      },
      {
        "id": "ai-ervaring-08",
        "titel": "Herken wanneer AI niet helpt",
        "blokken": [
          {
            "type": "tekst",
            "titel": "Herken je dit?",
            "tekst": "Je bent langer bezig met controleren dan met het oorspronkelijke werk."
          },
          {
            "type": "tekst",
            "titel": "Dit leer je",
            "tekst": "Je kunt beoordelen of AI bij een taak werkelijk helpt. Tel voorbereiding, controleren en herstellen mee, niet alleen de tijd waarin AI antwoordt. Kies direct werken als dat eenvoudiger of betrouwbaarder is, zeker bij kleine eenmalige taken."
          },
          {
            "type": "stappen",
            "titel": "Zo pak je het aan",
            "stappen": [
              {
                "label": "Maak het concreet",
                "beschrijving": "Een administratieve correctie kost handmatig vier minuten. Instructie, AI-uitvoering en controle kosten samen negen minuten. Voor deze eenmalige taak levert de AI-route geen tijdwinst op. Bij terugkerend werk kan de afweging anders worden."
              },
              {
                "label": "Probeer het zelf",
                "beschrijving": "Bedenk een taak die je niet zou automatiseren en leg uit waarom."
              }
            ]
          },
          {
            "type": "tekst",
            "titel": "Jouw praktijkopdracht",
            "tekst": "Bedenk een taak die je niet zou automatiseren en leg uit waarom. Vergelijk je resultaat met het leerdoel en verbeter één punt."
          }
        ],
        "vragen": [
          {
            "id": "ai-ervaring-08-v1",
            "vraag": "Wanneer kun je beter zelf werken?",
            "opties": [
              "Als je de taak al eens hebt uitgevoerd",
              "Als een taak korter dan een uur is",
              "Als AI meer werk of risico toevoegt dan wegneemt"
            ],
            "juisteIndex": 2,
            "uitleg": "AI is geen doel op zich. Soms is direct werken sneller en betrouwbaarder. Vergelijk tijdwinst met extra fouten, controle en overdracht.",
            "type": "meerkeuze"
          },
          {
            "id": "ai-ervaring-08-toepassing-01",
            "type": "meerkeuze",
            "vraag": "Een eenmalige correctie duurt handmatig vier minuten. Met AI duurt voorbereiden, uitvoeren en controleren negen minuten. Wat is hier logisch?",
            "opties": [
              "AI gebruiken omdat automatisch werk altijd doelmatiger is.",
              "De controle overslaan zodat de AI-route korter lijkt.",
              "De correctie handmatig uitvoeren en AI alleen kiezen als het aantoonbaar iets toevoegt."
            ],
            "juisteIndex": 2,
            "uitleg": "Het gaat om de totale inspanning en kwaliteit. Controle weglaten om tijdwinst te tonen maakt de vergelijking niet eerlijk."
          }
        ]
      }
    ]
  },
  {
    "id": "ai-bouwen",
    "domeinId": "d-ai-slim-werken",
    "titel": "Zelf digitale ondersteuning maken",
    "ondertitel": "Koppelingen, prototypes en veilig samenwerken aan code.",
    "prerequisites": [],
    "gridPos": {
      "tier": 3,
      "track": 1
    },
    "orbs": [
      {
        "id": "ai-bouwen-01",
        "titel": "Verbind AI met bestaande apps",
        "blokken": [
          {
            "type": "tekst",
            "titel": "Herken je dit?",
            "tekst": "Je agenda, documenten en e-mail staan in verschillende systemen."
          },
          {
            "type": "tekst",
            "titel": "Dit leer je",
            "tekst": "Je kunt bepalen welke toegang een koppeling nodig heeft. Een connector kan alleen de functies bieden die de omgeving en rechten toestaan. Controleer ook welke gegevens de AI-dienst ontvangt. Goedkeuring voor lezen is geen toestemming voor wijzigen."
          },
          {
            "type": "stappen",
            "titel": "Zo pak je het aan",
            "stappen": [
              {
                "label": "Maak het concreet",
                "beschrijving": "Voor een fictief overlegoverzicht kan toegang tot een beperkte agenda voldoende zijn. Toegang tot alle e-mail en schrijven in de agenda is daarvoor niet vanzelf nodig. Vraag bij twijfel de beheerder naar de toegestane koppeling en gegevens."
              },
              {
                "label": "Probeer het zelf",
                "beschrijving": "Teken een fictieve workflow met agenda en projectdocumenten."
              }
            ]
          },
          {
            "type": "tekst",
            "titel": "Jouw praktijkopdracht",
            "tekst": "Teken een fictieve workflow met agenda en projectdocumenten. Vergelijk je resultaat met het leerdoel en verbeter één punt."
          }
        ],
        "vragen": [
          {
            "id": "ai-bouwen-01-v1",
            "vraag": "Wat is de eerste stap bij een connector?",
            "opties": [
              "Alle toegangsrechten direct geven",
              "Controleren of de koppeling is toegestaan en welke rechten nodig zijn",
              "Wachtwoorden in een prompt plakken"
            ],
            "juisteIndex": 1,
            "uitleg": "Goedgekeurde koppelingen kunnen context ophalen; toegangsrechten blijven belangrijk. Begin met een beperkte leesopdracht en controleer welke gegevens gedeeld worden.",
            "type": "meerkeuze"
          },
          {
            "id": "ai-bouwen-01-toepassing-01",
            "type": "meerkeuze",
            "vraag": "Je wilt alleen vergadertijden uit een toegestane agenda samenvatten. Welke toegang past daarbij?",
            "opties": [
              "De benodigde leesrechten voor die agenda, binnen de goedgekeurde omgeving.",
              "Volledige lees- en schrijfrechten op agenda en e-mail voor het gemak.",
              "Het accountwachtwoord in de opdracht, zodat AI zelf toegang regelt."
            ],
            "juisteIndex": 0,
            "uitleg": "Beperk toegang tot wat de taak nodig heeft. Meer rechten zijn geen kwaliteitsverbetering en wachtwoorden horen nooit in een prompt."
          }
        ]
      },
      {
        "id": "ai-bouwen-02",
        "titel": "Maak een kleine tool zonder codekennis",
        "blokken": [
          {
            "type": "tekst",
            "titel": "Herken je dit?",
            "tekst": "Een papieren materiaalcontrole kost iedere dag tijd."
          },
          {
            "type": "tekst",
            "titel": "Dit leer je",
            "tekst": "Je kunt één werkprobleem vertalen naar een klein testbaar prototype. Beschrijf de gebruiker, invoer en gewenste uitkomst. Test normaal gebruik én een foutgeval met fictieve gegevens. Een prototype is nog geen goedgekeurd bedrijfsproces."
          },
          {
            "type": "stappen",
            "titel": "Zo pak je het aan",
            "stappen": [
              {
                "label": "Maak het concreet",
                "beschrijving": "Begin met een materiaalchecklist waarin een collega drie artikelen kan afvinken en ontbrekende artikelen terugziet. Test dat niets aangevinkt als drie ontbrekende artikelen verschijnt. Deel intern volgens de werkafspraken; openbare publicatie loopt via de beheerder."
              },
              {
                "label": "Probeer het zelf",
                "beschrijving": "Laat een prototype ontwerpen voor een fictieve materiaalchecklist."
              }
            ]
          },
          {
            "type": "tekst",
            "titel": "Jouw praktijkopdracht",
            "tekst": "Laat een prototype ontwerpen voor een fictieve materiaalchecklist. Vergelijk je resultaat met het leerdoel en verbeter één punt."
          }
        ],
        "vragen": [
          {
            "id": "ai-bouwen-02-v1",
            "vraag": "Wat is de beste eerste versie?",
            "opties": [
              "Een kleine toetsbare versie met kernfunctie",
              "Een prototype zonder test",
              "Meteen een compleet bedrijfsplatform"
            ],
            "juisteIndex": 0,
            "uitleg": "Met AI kun je een prototype laten maken en via kleine tests verbeteren. Begin met één scherm, enkele controlepunten en een eenvoudige test.",
            "type": "meerkeuze"
          },
          {
            "id": "ai-bouwen-02-toepassing-01",
            "type": "meerkeuze",
            "vraag": "Een prototype moet tonen welke materialen ontbreken. Welke eerste test controleert de kernfunctie?",
            "opties": [
              "Bekijken of het scherm dezelfde kleuren heeft als het ontwerp.",
              "Een bekende lijst invoeren, één artikel afvinken en controleren dat precies de overige artikelen als ontbrekend verschijnen.",
              "Zoveel mogelijk extra functies toevoegen voordat iemand de checklist gebruikt."
            ],
            "juisteIndex": 1,
            "uitleg": "Met bekende invoer en een verwachte uitkomst toets je wat de tool moet doen. Opmaak en extra functies bewijzen die werking niet."
          }
        ]
      },
      {
        "id": "ai-bouwen-03",
        "titel": "Van prototype naar GitHub-project",
        "blokken": [
          {
            "type": "tekst",
            "titel": "Herken je dit?",
            "tekst": "Je prototype werkt op je computer en anderen willen meehelpen."
          },
          {
            "type": "tekst",
            "titel": "Dit leer je",
            "tekst": "Je kunt een wijziging laten vastleggen en beoordelen voordat die wordt gedeeld. In GitHub beschrijft een issue het werk, houdt een branch de wijziging apart en maakt een pull request review mogelijk. Samenvoegen is niet automatisch publiceren; de release- en toegangsafspraken blijven gelden."
          },
          {
            "type": "stappen",
            "titel": "Zo pak je het aan",
            "stappen": [
              {
                "label": "Maak het concreet",
                "beschrijving": "Voor een fictieve gereedschapsregistratie leg je eerst de gewenste velden vast. Laat de wijziging op een branch bouwen, test toevoegen en terugvinden, en vraag een onafhankelijke review. Sla geen sleutels of echte persoonsgegevens op in de code."
              },
              {
                "label": "Probeer het zelf",
                "beschrijving": "Laat een bouwplan maken voor een fictieve gereedschapsregistratie."
              }
            ]
          },
          {
            "type": "tekst",
            "titel": "Jouw praktijkopdracht",
            "tekst": "Laat een bouwplan maken voor een fictieve gereedschapsregistratie. Vergelijk je resultaat met het leerdoel en verbeter één punt."
          }
        ],
        "vragen": [
          {
            "id": "ai-bouwen-03-v1",
            "vraag": "Wat hoort bij een veilige volgende stap?",
            "opties": [
              "Geheime sleutels in de code opslaan",
              "Direct alles op productie zetten",
              "Kleine wijzigingen, tests en review"
            ],
            "juisteIndex": 2,
            "uitleg": "Versiebeheer, testen en review maken ontwikkeling beheersbaar; code is niet automatisch veilig. Leg eisen vast, bewaar wijzigingen in een eigen branch en laat controleren voordat je publiceert.",
            "type": "meerkeuze"
          },
          {
            "id": "ai-bouwen-03-toepassing-01",
            "type": "meerkeuze",
            "vraag": "Een wijziging aan een gereedschapsregistratie werkt op jouw computer. Wat is een passende volgende stap?",
            "opties": [
              "Direct de hoofdversie overschrijven en later beschrijven wat veranderde.",
              "De werkende code publiceren zonder te controleren welke gegevens zichtbaar zijn.",
              "De wijziging met tests in een pull request laten reviewen en daarna de afgesproken release- en deelroute volgen."
            ],
            "juisteIndex": 2,
            "uitleg": "Een lokale proef is één controle. Review, tests en een bewuste release maken samenwerking mogelijk en houden delen en toegang afzonderlijk zichtbaar."
          }
        ]
      }
    ]
  }
];

// Voeg de vaste leerboom als één geheel toe. Bestaande IDs hebben altijd voorrang,
// ook bij een gedeeltelijke import of een zelf bewerkte versie. Geen reparaties,
// versie-upgrades of opslagwrites tijdens laden; een gewone bewaaractie/back-up
// neemt de zichtbare inhoud mee. Zie docs/ai-leergang.md voor verwijdergedrag.
function voegMeegeleverdeLeergangToe(inhoud) {
  if (controleerInhoud(inhoud)) return inhoud;
  const ids = data => [
    ...data.domeinen.map(d => d.id),
    ...data.topics.flatMap(t => [t.id, ...t.orbs.flatMap(o => [o.id, ...(o.vragen || []).map(v => v.id)])]),
  ];
  const bestaandeIds = new Set(ids(inhoud));
  const meegeleverd = {domeinen: START_DOMEINEN, topics: START_TOPICS};
  if (ids(meegeleverd).some(id => bestaandeIds.has(id))) return inhoud;
  const kopie = JSON.parse(JSON.stringify(meegeleverd));
  return {...inhoud, domeinen: [...inhoud.domeinen, ...kopie.domeinen], topics: [...inhoud.topics, ...kopie.topics]};
}
