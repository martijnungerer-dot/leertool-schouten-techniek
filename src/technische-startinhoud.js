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
        "concept": true,
        "blokken": [
          {
            "type": "tekst",
            "tekst": "De drie grootheden en hoe ze samenhangen."
          },
          {
            "type": "tekst",
            "tekst": "In deze les wordt uitgewerkt:\n\n• Wat spanning, stroom en weerstand zijn\n• De wet van Ohm zonder rekenwerk\n• Waarom je ze nooit los van elkaar ziet"
          }
        ],
        "vragen": [],
        "ontwerpDuur": "8 min · video"
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
