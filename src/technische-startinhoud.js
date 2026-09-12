// Overgenomen uit de aangeleverde ontwerpschermen. Geen fictieve leerresultaten.
const START_DOMEINEN = [
  {
    "id": "elektra",
    "naam": "Elektra",
    "kleur": "#F6A923",
    "omschrijving": "Van spanning en stroom tot veilig meten aan een installatie."
  },
  {
    "id": "hydrauliek",
    "naam": "Hydrauliek",
    "kleur": "#0098D4",
    "omschrijving": "Druk, debiet en het lezen van een hydraulisch schema."
  },
  {
    "id": "veiligheid",
    "naam": "Veiligheid op de werkvloer",
    "kleur": "#2E7D4F",
    "omschrijving": "LMRA, afzetten en vergrendelen, en wat je doet bij twijfel."
  },
  {
    "id": "meten",
    "naam": "Basis meten",
    "kleur": "#B1B2B4",
    "omschrijving": "Meetmiddelen, toleranties en netjes vastleggen wat je meet."
  },
  {
    "id": "pneumatiek",
    "naam": "Pneumatiek",
    "kleur": "#E32118",
    "omschrijving": "Perslucht, cilinders en het opsporen van lekverlies."
  },
  {
    "id": "besturing",
    "naam": "Besturingstechniek",
    "kleur": "#7A5CA8",
    "omschrijving": "Sensoren, PLC-logica en storingzoeken in een machine."
  },
  {
    "id": "mechanisch",
    "naam": "Mechanisch onderhoud",
    "kleur": "#B87B12",
    "omschrijving": "Lagers, aandrijvingen en uitlijnen zonder schade."
  },
  {
    "id": "lassen",
    "naam": "Verbindingstechniek",
    "kleur": "#4E7A8A",
    "omschrijving": "Lassen, klinken en bouten met de juiste voorspanning."
  },
  {
    "id": "tekening",
    "naam": "Technisch tekeninglezen",
    "kleur": "#8A6E4B",
    "omschrijving": "Aanzichten, maatvoering en symbolen in een werktekening."
  },
  {
    "id": "materialen",
    "naam": "Materiaalkennis",
    "kleur": "#5B8C5A",
    "omschrijving": "Staal, kunststof en waarom keuze van materiaal telt."
  },
  {
    "id": "kwaliteit",
    "naam": "Kwaliteit en registratie",
    "kleur": "#C46A8B",
    "omschrijving": "Werkbonnen, afwijkingen melden en aantoonbaar werken."
  },
  {
    "id": "duurzaam",
    "naam": "Energie en duurzaamheid",
    "kleur": "#3F7F6E",
    "omschrijving": "Verbruik terugdringen in bestaande installaties."
  }
];

const START_TOPICS = [
  {
    "id": "elektra-c1",
    "domeinId": "elektra",
    "prerequisites": [],
    "gridPos": {
      "tier": 1,
      "track": 1
    },
    "titel": "Basiselektra",
    "ondertitel": "Startpunt van dit leerpad.",
    "ontwerpopzet": true,
    "orbs": [
      {
        "id": "elektra-c1-les-1",
        "titel": "Spanning, stroom en weerstand",
        "blokken": [
          {
            "type": "tekst",
            "titel": "Drie grootheden, één verhaal",
            "tekst": "Spanning, stroom en weerstand horen bij elkaar. Spanning (volt, V) is het duwtje: het verschil dat elektronen in beweging brengt. Stroom (ampère, A) is wat er werkelijk gaat lopen. Weerstand (ohm, Ω) is wat die beweging tegenwerkt.\n\nDe vergelijking met water helpt: spanning is de druk in de leiding, stroom is hoeveel water er per seconde doorheen gaat, weerstand is een knijp in de slang. Meer druk bij dezelfde knijp geeft meer water. Dezelfde druk bij een sterkere knijp geeft minder water.\n\nDe vergelijking gaat niet overal op — water loopt uit een open leiding, stroom niet uit een open draad — maar voor het gevoel van samenhang klopt hij.",
            "onthoud": "Spanning duwt, stroom loopt, weerstand houdt tegen. Je ziet ze nooit los van elkaar."
          },
          {
            "type": "tekst",
            "titel": "Wat je op de werkvloer tegenkomt",
            "tekst": "230 V wisselspanning is de gewone netspanning in een stopcontact. 400 V tussen de fasen is wat een krachtstroomaansluiting levert, bijvoorbeeld naar een motor. 24 V is de veelgebruikte stuurspanning in een schakelkast: daarmee schakel je relais, sensoren en een PLC-ingang.\n\nDe stroom zegt iets anders: die hangt af van wat het apparaat vraagt. Een LED-lamp trekt tienden van ampères, een boormachine een paar ampère, een motor bij het aanlopen kortstondig een veelvoud van zijn nominale stroom. Op het typeplaatje van een machine staat wat hij normaal vraagt.\n\nWeerstand meet je zelden in het wilde weg. Je meet hem gericht: is deze wikkeling nog heel, is deze draad doorverbonden, is deze verwarmingselement niet stuk.",
            "onthoud": "230 V in het stopcontact, 400 V tussen de fasen, 24 V voor de sturing. De stroom volgt uit wat het apparaat vraagt."
          },
          {
            "type": "tekst",
            "titel": "De wet van Ohm zonder rekenwerk",
            "tekst": "De wet van Ohm zegt: spanning = stroom × weerstand, oftewel U = I × R. Je hoeft er niet mee te rekenen om er iets aan te hebben. Wat telt is de richting van het verband.\n\nBlijft de spanning gelijk en wordt de weerstand groter, dan gaat er minder stroom lopen. Blijft de weerstand gelijk en wordt de spanning hoger, dan gaat er meer stroom lopen. Twee van de drie kennen betekent dat je iets kunt zeggen over de derde.\n\nDaar heb je bij storingzoeken direct wat aan. Een apparaat dat niets doet terwijl de spanning er wel op staat, wijst op een te hoge weerstand ergens in de kring: een onderbreking, een slecht contact, een doorgebrande wikkeling.",
            "onthoud": "U = I × R. Zelfde spanning en meer weerstand betekent minder stroom."
          },
          {
            "type": "tekst",
            "titel": "Praktijkvoorbeeld: de klem die warm wordt",
            "tekst": "Een klem in een schakelkast die niet goed is aangedraaid, maakt maar over een klein oppervlak contact. Dat kleine oppervlak is extra weerstand op een plek waar die niet hoort. Alle stroom die naar de machine gaat, moet er toch doorheen.\n\nWeerstand waar stroom doorheen loopt, wordt warm. Bij een losse klem gaat die warmte zitten waar het contact slecht is. Je herkent het aan verkleuring van de klem of het draadeind, aan een geur van warm kunststof, en met een warmtebeeldcamera als een duidelijk warme plek in een verder koude rij klemmen.\n\nHet verraderlijke is dat de installatie het nog gewoon doet. De machine draait, niemand meldt een storing, en ondertussen wordt het contact elke dag iets slechter. Daarom staat het natrekken van klemmen in vrijwel elk onderhoudsschema.",
            "onthoud": "Slecht contact is extra weerstand, en weerstand met stroom erdoorheen wordt warm. Verkleuring bij een klem is een waarschuwing, geen schoonheidsfoutje."
          },
          {
            "type": "tekst",
            "titel": "Wat dit betekent als je gaat meten",
            "tekst": "Spanning meet je over iets heen: tussen twee punten, bijvoorbeeld tussen fase en nul. Stroom meet je door iets heen: met een stroomtang om één geleider, niet om de hele kabel, want dan heffen heen- en teruggaande stroom elkaar op en lees je nul af.\n\nWeerstand meet je alleen aan een installatie of onderdeel dat spanningsloos is en waar geen spanning meer op kan komen. De meter zet er zelf een kleine spanning op om te meten; staat er nog netspanning op, dan klopt je meting niet en beschadig je mogelijk je meter.\n\nHoe je een installatie veilig spanningsloos maakt en vaststelt dát hij spanningsloos is, staat in het onderwerp Veilig werken. Werken aan delen die onder spanning staan is voorbehouden aan wie daarvoor is opgeleid en aangewezen.",
            "onthoud": "Spanning meet je over iets, stroom door iets, en weerstand alleen als het spanningsloos is."
          }
        ],
        "begrippen": [
          {
            "term": "Volt (V)",
            "uitleg": "Eenheid van spanning: het verschil dat stroom in beweging brengt."
          },
          {
            "term": "Ampère (A)",
            "uitleg": "Eenheid van stroom: hoeveel er daadwerkelijk loopt."
          },
          {
            "term": "Ohm (Ω)",
            "uitleg": "Eenheid van weerstand: hoe sterk iets de stroom tegenwerkt."
          },
          {
            "term": "Wet van Ohm",
            "uitleg": "U = I × R. Het verband tussen de drie grootheden."
          }
        ],
        "vragen": [
          {
            "id": "elektra-c1-les-1-v1",
            "vraag": "De spanning blijft gelijk en de weerstand in de kring wordt groter. Wat gebeurt er met de stroom?",
            "opties": [
              "Die wordt kleiner",
              "Die wordt groter",
              "Die blijft gelijk",
              "Dat hangt af van de kabellengte"
            ],
            "juisteIndex": 0,
            "uitleg": "Bij U = I × R hoort bij dezelfde spanning en een hogere weerstand een lagere stroom."
          },
          {
            "id": "elektra-c1-les-1-v2",
            "vraag": "Een klem in een schakelkast is verkleurd en voelt warmer aan dan de klemmen ernaast. Wat is de meest waarschijnlijke oorzaak?",
            "opties": [
              "De kabel naar die klem is te dik gekozen",
              "Het contact is slecht, waardoor er extra weerstand op die plek zit",
              "De spanning op die klem is hoger dan op de andere",
              "De klem staat te dicht bij de kastverlichting"
            ],
            "juisteIndex": 1,
            "uitleg": "Een slecht aangedraaide of vervuilde klem maakt over een klein oppervlak contact. Die extra weerstand zet de doorlopende stroom om in warmte."
          },
          {
            "id": "elektra-c1-les-1-v3",
            "vraag": "In welke eenheid druk je stroom uit?",
            "opties": [
              "Volt",
              "Ohm",
              "Ampère",
              "Watt"
            ],
            "juisteIndex": 2,
            "uitleg": "Stroom meet je in ampère. Volt hoort bij spanning, ohm bij weerstand en watt bij vermogen."
          },
          {
            "id": "elektra-c1-les-1-v4",
            "vraag": "Waarom meet je weerstand nooit aan een deel waar nog spanning op staat?",
            "opties": [
              "Omdat de weerstand dan altijd nul is",
              "Omdat de meter zelf een kleine spanning gebruikt om te meten; met netspanning erop klopt de meting niet en kan de meter beschadigen",
              "Omdat weerstand alleen bij gelijkspanning bestaat",
              "Omdat je dan de stroomtang nodig hebt"
            ],
            "juisteIndex": 1,
            "uitleg": "De ohmmeter zet zelf een kleine meetspanning op het onderdeel. Externe spanning verstoort die meting en kan het meetinstrument beschadigen."
          }
        ],
        "duur": "9 min · tekst en vier vragen"
      },
      {
        "id": "elektra-c1-les-2",
        "titel": "Gelijkspanning en wisselspanning",
        "concept": true,
        "blokken": [
          {
            "type": "tekst",
            "tekst": "Waar je 230 volt tegenkomt en waar 24 volt."
          },
          {
            "type": "tekst",
            "tekst": "In deze les wordt uitgewerkt:\n\n• Het verschil tussen AC en DC\n• Welke spanningen in een machine voorkomen\n• Waarom de netspanning wisselt"
          }
        ],
        "vragen": [],
        "ontwerpDuur": "10 min · tekst"
      },
      {
        "id": "elektra-c1-les-3",
        "titel": "Serie en parallel",
        "concept": true,
        "blokken": [
          {
            "type": "tekst",
            "tekst": "Twee schakelingen die je overal terugziet."
          },
          {
            "type": "tekst",
            "tekst": "In deze les wordt uitgewerkt:\n\n• Wat er gebeurt als je er één weghaalt\n• Waar de spanning zich verdeelt\n• Hoe je het in een kast herkent"
          }
        ],
        "vragen": [],
        "ontwerpDuur": "6 min · quiz"
      }
    ]
  },
  {
    "id": "elektra-c2",
    "domeinId": "elektra",
    "prerequisites": [
      "elektra-c1"
    ],
    "gridPos": {
      "tier": 2,
      "track": 2
    },
    "titel": "Veilig werken",
    "ondertitel": "Na Basiselektra.",
    "ontwerpopzet": true,
    "orbs": [
      {
        "id": "elektra-c2-les-1",
        "titel": "Spanningsloos maken",
        "concept": true,
        "blokken": [
          {
            "type": "tekst",
            "tekst": "De vijf stappen, in de goede volgorde."
          },
          {
            "type": "tekst",
            "tekst": "In deze les wordt uitgewerkt:\n\n• De vijf veiligheidsregels op volgorde\n• Waarom controleren nooit overgeslagen wordt\n• Wat vergrendelen en markeren inhoudt"
          }
        ],
        "vragen": [],
        "ontwerpDuur": "7 min · video"
      },
      {
        "id": "elektra-c2-les-2",
        "titel": "Persoonlijke beschermingsmiddelen",
        "concept": true,
        "blokken": [
          {
            "type": "tekst",
            "tekst": "Wat je draagt en wanneer."
          },
          {
            "type": "tekst",
            "tekst": "In deze les wordt uitgewerkt:\n\n• Handschoenen, gelaatscherm en kleding\n• Wanneer welke klasse nodig is\n• Hoe je je middelen controleert"
          }
        ],
        "vragen": [],
        "ontwerpDuur": "9 min · tekst"
      }
    ]
  },
  {
    "id": "elektra-c3",
    "domeinId": "elektra",
    "prerequisites": [
      "elektra-c1"
    ],
    "gridPos": {
      "tier": 2,
      "track": 1
    },
    "titel": "Meten aan een installatie",
    "ondertitel": "Na Basiselektra. Dit is nu je aanbevolen stap.",
    "ontwerpopzet": true,
    "orbs": [
      {
        "id": "elektra-c3-les-1",
        "titel": "De tweepolige spanningstester",
        "concept": true,
        "blokken": [
          {
            "type": "tekst",
            "tekst": "Het meetmiddel waar elke controle mee begint."
          },
          {
            "type": "tekst",
            "tekst": "In deze les wordt uitgewerkt:\n\n• Waarom eerst op een bekende spanning testen\n• Hoe je de tester correct aanzet\n• Wat een uitslag wel en niet bewijst"
          }
        ],
        "vragen": [],
        "ontwerpDuur": "8 min · video"
      },
      {
        "id": "elektra-c3-les-2",
        "titel": "Meten met de multimeter",
        "concept": true,
        "blokken": [
          {
            "type": "tekst",
            "tekst": "Spanning, stroom en weerstand in de praktijk."
          },
          {
            "type": "tekst",
            "tekst": "In deze les wordt uitgewerkt:\n\n• De juiste stand en de juiste aansluiting\n• Waarom stroom meten anders gaat\n• Veelgemaakte fouten met de meetsnoeren"
          }
        ],
        "vragen": [],
        "ontwerpDuur": "7 min · tekst"
      },
      {
        "id": "elektra-c3-les-3",
        "titel": "Meetwaarden vastleggen",
        "concept": true,
        "blokken": [
          {
            "type": "tekst",
            "tekst": "Wat je noteert en waarom dat telt."
          },
          {
            "type": "tekst",
            "tekst": "In deze les wordt uitgewerkt:\n\n• Welke waarden in het rapport horen\n• Hoe je een afwijking beschrijft\n• Wat de volgende monteur nodig heeft"
          }
        ],
        "vragen": [],
        "ontwerpDuur": "11 min · video"
      }
    ]
  },
  {
    "id": "elektra-c4",
    "domeinId": "elektra",
    "prerequisites": [
      "elektra-c1"
    ],
    "gridPos": {
      "tier": 2,
      "track": 3
    },
    "titel": "Schema's lezen",
    "ondertitel": "Na Basiselektra.",
    "ontwerpopzet": true,
    "orbs": [
      {
        "id": "elektra-c4-les-1",
        "titel": "Symbolen herkennen",
        "concept": true,
        "blokken": [
          {
            "type": "tekst",
            "tekst": "De tekens die in elk schema terugkomen."
          },
          {
            "type": "tekst",
            "tekst": "In deze les wordt uitgewerkt:\n\n• Contacten, spoelen en beveiligingen\n• Het verschil tussen maak en verbreek\n• Hoe je een symbool opzoekt"
          }
        ],
        "vragen": [],
        "ontwerpDuur": "8 min · video"
      },
      {
        "id": "elektra-c4-les-2",
        "titel": "Een stroomkring volgen",
        "concept": true,
        "blokken": [
          {
            "type": "tekst",
            "tekst": "Van voeding naar verbruiker en terug."
          },
          {
            "type": "tekst",
            "tekst": "In deze les wordt uitgewerkt:\n\n• Waar je begint met lezen\n• Hoe verwijzingen tussen bladen werken\n• Een storing terugvinden in het schema"
          }
        ],
        "vragen": [],
        "ontwerpDuur": "6 min · quiz"
      }
    ]
  },
  {
    "id": "elektra-c5",
    "domeinId": "elektra",
    "prerequisites": [
      "elektra-c2"
    ],
    "gridPos": {
      "tier": 3,
      "track": 2
    },
    "titel": "Aarding en beveiliging",
    "ondertitel": "Na Basiselektra → Veilig werken.",
    "ontwerpopzet": true,
    "orbs": [
      {
        "id": "elektra-c5-les-1",
        "titel": "Waarom aarden",
        "concept": true,
        "blokken": [
          {
            "type": "tekst",
            "tekst": "Wat er gebeurt als er geen aarde is."
          },
          {
            "type": "tekst",
            "tekst": "In deze les wordt uitgewerkt:\n\n• De weg die foutstroom zoekt\n• Wat aanraakspanning is\n• Waarom een goede aarde levens redt"
          }
        ],
        "vragen": [],
        "ontwerpDuur": "8 min · video"
      },
      {
        "id": "elektra-c5-les-2",
        "titel": "Aardlekschakelaar en automaat",
        "concept": true,
        "blokken": [
          {
            "type": "tekst",
            "tekst": "Twee beveiligingen met twee taken."
          },
          {
            "type": "tekst",
            "tekst": "In deze les wordt uitgewerkt:\n\n• Waar elk van beide tegen beschermt\n• Wat 30 mA betekent\n• Waarom ze elkaar niet vervangen"
          }
        ],
        "vragen": [],
        "ontwerpDuur": "6 min · tekst"
      },
      {
        "id": "elektra-c5-les-3",
        "titel": "Beveiliging controleren",
        "concept": true,
        "blokken": [
          {
            "type": "tekst",
            "tekst": "De test die je periodiek doet."
          },
          {
            "type": "tekst",
            "tekst": "In deze les wordt uitgewerkt:\n\n• De testknop en wat die wel zegt\n• Hoe je de aardweerstand meet\n• Wanneer je iets afkeurt"
          }
        ],
        "vragen": [],
        "ontwerpDuur": "7 min · quiz"
      }
    ]
  },
  {
    "id": "elektra-c6",
    "domeinId": "elektra",
    "prerequisites": [
      "elektra-c3"
    ],
    "gridPos": {
      "tier": 3,
      "track": 1
    },
    "titel": "Storingzoeken",
    "ondertitel": "Na Basiselektra → Meten aan een installatie.",
    "ontwerpopzet": true,
    "orbs": [
      {
        "id": "elektra-c6-les-1",
        "titel": "Systematisch zoeken",
        "concept": true,
        "blokken": [
          {
            "type": "tekst",
            "tekst": "Een werkwijze in plaats van gokken."
          },
          {
            "type": "tekst",
            "tekst": "In deze les wordt uitgewerkt:\n\n• Halveren in plaats van alles nalopen\n• Wat je eerst uitsluit\n• Waarom je één ding tegelijk verandert"
          }
        ],
        "vragen": [],
        "ontwerpDuur": "6 min · video"
      },
      {
        "id": "elektra-c6-les-2",
        "titel": "De storing beschrijven",
        "concept": true,
        "blokken": [
          {
            "type": "tekst",
            "tekst": "Wat je aan de bediener vraagt."
          },
          {
            "type": "tekst",
            "tekst": "In deze les wordt uitgewerkt:\n\n• Vier vragen die je altijd stelt\n• Wanneer het begon en wat er veranderde\n• Waarom een storing soms wegblijft"
          }
        ],
        "vragen": [],
        "ontwerpDuur": "5 min · tekst"
      }
    ]
  },
  {
    "id": "elektra-c7",
    "domeinId": "elektra",
    "prerequisites": [
      "elektra-c4"
    ],
    "gridPos": {
      "tier": 3,
      "track": 3
    },
    "titel": "Componenten herkennen",
    "ondertitel": "Na Basiselektra → Schema's lezen.",
    "ontwerpopzet": true,
    "orbs": [
      {
        "id": "elektra-c7-les-1",
        "titel": "Relais en magneetschakelaar",
        "concept": true,
        "blokken": [
          {
            "type": "tekst",
            "tekst": "Wat ze doen en waarin ze verschillen."
          },
          {
            "type": "tekst",
            "tekst": "In deze les wordt uitgewerkt:\n\n• Sturen met een kleine spanning\n• Waarom een hulpcontact bestaat\n• Hoe je hoort dat hij schakelt"
          }
        ],
        "vragen": [],
        "ontwerpDuur": "7 min · video"
      },
      {
        "id": "elektra-c7-les-2",
        "titel": "Sensoren en eindschakelaars",
        "concept": true,
        "blokken": [
          {
            "type": "tekst",
            "tekst": "De ogen van een machine."
          },
          {
            "type": "tekst",
            "tekst": "In deze les wordt uitgewerkt:\n\n• Inductief, capacitief en optisch\n• Waarom een sensor vervuild raakt\n• Hoe je een sensor uitleest"
          }
        ],
        "vragen": [],
        "ontwerpDuur": "6 min · quiz"
      }
    ]
  },
  {
    "id": "elektra-c8",
    "domeinId": "elektra",
    "prerequisites": [
      "elektra-c6"
    ],
    "gridPos": {
      "tier": 4,
      "track": 1
    },
    "titel": "Motoren en aandrijving",
    "ondertitel": "Na Basiselektra → Meten aan een installatie → Storingzoeken.",
    "ontwerpopzet": true,
    "orbs": [
      {
        "id": "elektra-c8-les-1",
        "titel": "De draaistroommotor",
        "concept": true,
        "blokken": [
          {
            "type": "tekst",
            "tekst": "De motor die je het vaakst tegenkomt."
          },
          {
            "type": "tekst",
            "tekst": "In deze les wordt uitgewerkt:\n\n• Waarom drie fasen laten draaien\n• Ster en driehoek in gewone taal\n• Wat het typeplaatje vertelt"
          }
        ],
        "vragen": [],
        "ontwerpDuur": "7 min · video"
      },
      {
        "id": "elektra-c8-les-2",
        "titel": "Aanlopen en beveiligen",
        "concept": true,
        "blokken": [
          {
            "type": "tekst",
            "tekst": "De eerste seconden zijn de zwaarste."
          },
          {
            "type": "tekst",
            "tekst": "In deze les wordt uitgewerkt:\n\n• Waarom de aanloopstroom zo hoog is\n• Wat een thermische beveiliging doet\n• Wanneer een motor te vaak start"
          }
        ],
        "vragen": [],
        "ontwerpDuur": "6 min · tekst"
      },
      {
        "id": "elektra-c8-les-3",
        "titel": "De frequentieregelaar",
        "concept": true,
        "blokken": [
          {
            "type": "tekst",
            "tekst": "Toerental regelen zonder mechanica."
          },
          {
            "type": "tekst",
            "tekst": "In deze les wordt uitgewerkt:\n\n• Wat de regelaar met de frequentie doet\n• Waarom dat energie scheelt\n• Welke storingen hij zelf meldt"
          }
        ],
        "vragen": [],
        "ontwerpDuur": "9 min · quiz"
      }
    ]
  },
  {
    "id": "elektra-c9",
    "domeinId": "elektra",
    "prerequisites": [
      "elektra-c5"
    ],
    "gridPos": {
      "tier": 4,
      "track": 2
    },
    "titel": "Normen en NEN 3140",
    "ondertitel": "Na Basiselektra → Veilig werken → Aarding en beveiliging.",
    "ontwerpopzet": true,
    "orbs": []
  },
  {
    "id": "elektra-c10",
    "domeinId": "elektra",
    "prerequisites": [
      "elektra-c7"
    ],
    "gridPos": {
      "tier": 4,
      "track": 3
    },
    "titel": "Schakelkasten",
    "ondertitel": "Na Basiselektra → Schema's lezen → Componenten herkennen.",
    "ontwerpopzet": true,
    "orbs": [
      {
        "id": "elektra-c10-les-1",
        "titel": "Opbouw van een kast",
        "concept": true,
        "blokken": [
          {
            "type": "tekst",
            "tekst": "Waar alles zit en waarom daar."
          },
          {
            "type": "tekst",
            "tekst": "In deze les wordt uitgewerkt:\n\n• Voeding, sturing en vermogen gescheiden\n• Waarom bedrading gebundeld loopt\n• Hoe je een klemmenstrook leest"
          }
        ],
        "vragen": [],
        "ontwerpDuur": "7 min · video"
      },
      {
        "id": "elektra-c10-les-2",
        "titel": "Warmte en vervuiling",
        "concept": true,
        "blokken": [
          {
            "type": "tekst",
            "tekst": "De twee stille oorzaken van uitval."
          },
          {
            "type": "tekst",
            "tekst": "In deze les wordt uitgewerkt:\n\n• Wat warmte met een contact doet\n• Waarom filters vervangen worden\n• Wat je ziet bij een losse verbinding"
          }
        ],
        "vragen": [],
        "ontwerpDuur": "6 min · tekst"
      }
    ]
  },
  {
    "id": "elektra-c11",
    "domeinId": "elektra",
    "prerequisites": [
      "elektra-c8"
    ],
    "gridPos": {
      "tier": 5,
      "track": 1
    },
    "titel": "Storingen in bedrijf",
    "ondertitel": "Na Basiselektra → Meten aan een installatie → Storingzoeken → Motoren en aandrijving.",
    "ontwerpopzet": true,
    "orbs": [
      {
        "id": "elektra-c11-les-1",
        "titel": "Onder tijdsdruk werken",
        "concept": true,
        "blokken": [
          {
            "type": "tekst",
            "tekst": "De lijn staat stil en iedereen kijkt mee."
          },
          {
            "type": "tekst",
            "tekst": "In deze les wordt uitgewerkt:\n\n• Waarom je toch de vijf stappen doet\n• Wat je als eerste uitsluit\n• Hoe je terugkoppelt aan de productie"
          }
        ],
        "vragen": [],
        "ontwerpDuur": "9 min · video"
      },
      {
        "id": "elektra-c11-les-2",
        "titel": "Na de storing",
        "concept": true,
        "blokken": [
          {
            "type": "tekst",
            "tekst": "Vastleggen zodat het niet terugkomt."
          },
          {
            "type": "tekst",
            "tekst": "In deze les wordt uitgewerkt:\n\n• Wat er in de melding hoort\n• Waarom de oorzaak telt, niet de oplossing\n• Wanneer je onderhoud voorstelt"
          }
        ],
        "vragen": [],
        "ontwerpDuur": "7 min · tekst"
      }
    ]
  },
  {
    "id": "elektra-c12",
    "domeinId": "elektra",
    "prerequisites": [
      "elektra-c10"
    ],
    "gridPos": {
      "tier": 5,
      "track": 3
    },
    "titel": "Meet- en regeltechniek",
    "ondertitel": "Na Basiselektra → Schema's lezen → Componenten herkennen → Schakelkasten.",
    "ontwerpopzet": true,
    "orbs": []
  }
];
