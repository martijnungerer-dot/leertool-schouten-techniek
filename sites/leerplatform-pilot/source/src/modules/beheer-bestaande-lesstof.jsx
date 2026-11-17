// ============================================================================
// BEHEER
// ============================================================================

// ============================================================================
// BESTAANDE LESSTOF BEHEREN
//
// Vóór publicatie kun je blokken uit een concept halen. Ná publicatie was daar
// nooit een weg terug voor — dit repareert dat gat. Je kunt losse blokken uit
// een al-gepubliceerde orb verwijderen, en de allerlaatste orb van een
// onderwerp helemaal weghalen.
//
// Waarom alleen de LAATSTE orb verwijderbaar is: voortgang wordt bijgehouden
// als "aantal afgeronde orbs", geteld vanaf het begin. Haal je een orb uit het
// midden, dan schuift die telling op en klopt niemands voortgang meer. Vanaf
// het eind weghalen is altijd veilig.
// ============================================================================

function BestaandeOrbsBeheer({ topic, domeinen, topics, bronnen, opOpslaan }) {
  const [open, setOpen] = useState(null); // orbId dat uitgeklapt is
  const domein = domeinen.find((d) => d.id === topic.domeinId) || { kleur: "#888880" };

  function bewaarOrbs(nieuweOrbs) {
    const nieuweTopics = topics.map((t) =>
      t.id === topic.id ? { ...t, orbs: nieuweOrbs } : t
    );
    opOpslaan({ domeinen, topics: nieuweTopics, bronnen });
  }

  // Het leerpad zelf: titel en ondertitel zijn ook na publicatie aanpasbaar.
  function wijzigTopic(veld, waarde) {
    const nieuweTopics = topics.map((t) =>
      t.id === topic.id ? { ...t, [veld]: waarde } : t
    );
    opOpslaan({ domeinen, topics: nieuweTopics, bronnen });
  }

  function wijzigOrbTitel(orbId, titel) {
    bewaarOrbs(topic.orbs.map((o) => (o.id === orbId ? { ...o, titel } : o)));
  }

  function wijzigVraag(orbId, vraagIndex, veld, waarde) {
    bewaarOrbs(
      topic.orbs.map((o) =>
        o.id === orbId
          ? {
              ...o,
              vragen: (o.vragen || []).map((v, i) =>
                i === vraagIndex ? { ...v, [veld]: waarde } : v
              ),
            }
          : o
      )
    );
  }

  function wijzigOptie(orbId, vraagIndex, optieIndex, waarde) {
    bewaarOrbs(
      topic.orbs.map((o) =>
        o.id === orbId
          ? {
              ...o,
              vragen: (o.vragen || []).map((v, i) =>
                i === vraagIndex
                  ? { ...v, opties: (v.opties || []).map((op, oi) => (oi === optieIndex ? waarde : op)) }
                  : v
              ),
            }
          : o
      )
    );
  }

  // Vraag verwijderen is veilig: het Leitner-systeem loopt alleen over vragen
  // die nog bestaan, dus oude kennis-entries doen simpelweg niets meer.
  function verwijderVraag(orbId, vraagIndex) {
    bewaarOrbs(
      topic.orbs.map((o) =>
        o.id === orbId
          ? { ...o, vragen: (o.vragen || []).filter((_, i) => i !== vraagIndex) }
          : o
      )
    );
  }

  function verwijderBlok(orbId, blokIndex) {
    bewaarOrbs(
      topic.orbs.map((o) =>
        o.id === orbId
          ? { ...o, blokken: (o.blokken || []).filter((_, i) => i !== blokIndex) }
          : o
      )
    );
  }

  function wijzigBlok(orbId, blokIndex, veld, waarde) {
    bewaarOrbs(
      topic.orbs.map((o) =>
        o.id === orbId
          ? {
              ...o,
              blokken: (o.blokken || []).map((b, i) =>
                i === blokIndex ? { ...b, [veld]: waarde } : b
              ),
            }
          : o
      )
    );
  }

  function verwijderLaatsteOrb() {
    bewaarOrbs(topic.orbs.slice(0, -1));
    setOpen(null);
  }

  if (topic.orbs.length === 0) return null;

  return (
    <div className="bg-white border border-gray-300 rounded-lg p-5 mb-4">
      <label className="block text-sm font-semibold text-gray-900 mb-1">
        Bestaande lesstof in dit onderwerp
      </label>
      <p className="text-xs text-gray-400 mb-3">
        Wijzigingen worden direct lokaal opgeslagen. Lessen met het kenmerk
        lesopzet blijven concept; alleen de tekst aanpassen publiceert ze niet.
      </p>

      <div className="mb-4 space-y-2">
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">
            Titel van het leerpad
          </label>
          <input
            value={topic.titel}
            onChange={(e) => wijzigTopic("titel", e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:border-gray-900 outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">
            Ondertitel
          </label>
          <input
            value={topic.ondertitel || ""}
            onChange={(e) => wijzigTopic("ondertitel", e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:border-gray-900 outline-none"
          />
        </div>
      </div>

      <div className="space-y-2">
        {topic.orbs.map((orb, orbIndex) => {
          const isLaatste = orbIndex === topic.orbs.length - 1;
          const isOpen = open === orb.id;
          const orbBlokken = Array.isArray(orb.blokken) ? orb.blokken : [];
          const orbVragen = Array.isArray(orb.vragen) ? orb.vragen : [];

          return (
            <div key={orb.id} className="border border-gray-200 rounded-md">
              <button
                onClick={() => setOpen(isOpen ? null : orb.id)}
                className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left hover:bg-gray-50"
              >
                <span className="text-sm font-medium text-gray-800 truncate">
                  {orb.titel}
                </span>
                <span className="text-xs text-gray-400 shrink-0">
                  {orbBlokken.length} {orbBlokken.length === 1 ? "blok" : "blokken"} · {orbVragen.length} {orbVragen.length === 1 ? "vraag" : "vragen"}
                  {isOpen ? " · sluiten" : " · bewerken"}
                </span>
              </button>

              {isOpen && (
                <div className="px-3 pb-3 border-t border-gray-100 pt-3 space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      Titel van deze orb
                    </label>
                    <input
                      value={orb.titel}
                      onChange={(e) => wijzigOrbTitel(orb.id, e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-medium focus:border-gray-900 outline-none"
                    />
                  </div>

                  {orbBlokken.length === 0 && (
                    <p className="text-xs text-gray-400 italic">
                      Geen blokken meer over — deze orb toont niets bij het lezen.
                    </p>
                  )}

                  {orbBlokken.map((blok, blokIndex) => (
                    <div key={blokIndex}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold">
                          {blok.type}
                        </p>
                        <button
                          onClick={() => verwijderBlok(orb.id, blokIndex)}
                          className="text-xs text-gray-400 hover:text-red-600"
                        >
                          Blok weg
                        </button>
                      </div>

                      {blok.type === "tekst" && (
                        <textarea
                          value={blok.tekst}
                          onChange={(e) =>
                            wijzigBlok(orb.id, blokIndex, "tekst", e.target.value)
                          }
                          rows={3}
                          className="w-full text-sm text-gray-700 leading-relaxed p-2 rounded border border-gray-200 focus:border-gray-900 outline-none resize-none"
                        />
                      )}

                      {blok.type !== "tekst" && (
                        <Blok blok={blok} kleur={domein.kleur} />
                      )}
                    </div>
                  ))}

                  {orbVragen.length > 0 && (
                    <div className="border-t border-gray-100 pt-3">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                        Vragen
                      </p>
                      <div className="space-y-3">
                        {orbVragen.map((vraag, vraagIndex) => (
                          <div
                            key={vraag.id || vraagIndex}
                            className="border border-gray-200 rounded-md p-3"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold">
                                {vraag.type}
                              </p>
                              <button
                                onClick={() => verwijderVraag(orb.id, vraagIndex)}
                                className="text-xs text-gray-400 hover:text-red-600"
                              >
                                Vraag weg
                              </button>
                            </div>

                            <textarea
                              value={vraag.vraag}
                              onChange={(e) =>
                                wijzigVraag(orb.id, vraagIndex, "vraag", e.target.value)
                              }
                              rows={2}
                              className="w-full text-sm font-medium text-gray-900 p-2 rounded border border-gray-200 focus:border-gray-900 outline-none resize-none mb-2"
                            />

                            {vraag.type === "meerkeuze" && (
                              <div className="space-y-1.5 mb-2">
                                {(vraag.opties || []).map((optie, optieIndex) => (
                                  <div key={optieIndex} className="flex items-center gap-2">
                                    <button
                                      onClick={() =>
                                        wijzigVraag(orb.id, vraagIndex, "juisteIndex", optieIndex)
                                      }
                                      title="Markeer als juiste antwoord"
                                      className={`w-5 h-5 rounded-full border-2 shrink-0 text-[10px] font-bold ${
                                        vraag.juisteIndex === optieIndex
                                          ? "border-green-600 bg-green-600 text-white"
                                          : "border-gray-300 text-transparent hover:border-green-600"
                                      }`}
                                    >
                                      ✓
                                    </button>
                                    <input
                                      value={optie}
                                      onChange={(e) =>
                                        wijzigOptie(orb.id, vraagIndex, optieIndex, e.target.value)
                                      }
                                      className="flex-1 text-sm text-gray-700 px-2 py-1.5 rounded border border-gray-200 focus:border-gray-900 outline-none"
                                    />
                                  </div>
                                ))}
                                <p className="text-xs text-gray-400">
                                  Het groene vinkje markeert het juiste antwoord.
                                </p>
                              </div>
                            )}

                            {vraag.type !== "meerkeuze" && (
                              <p className="text-xs text-gray-400 mb-2 italic">
                                De onderdelen van een {vraag.type}-vraag zijn hier niet los te
                                bewerken — verwijder de vraag als hij niet klopt.
                              </p>
                            )}

                            <label className="block text-xs font-semibold text-gray-500 mb-1">
                              Uitleg na het antwoord
                            </label>
                            <textarea
                              value={vraag.uitleg || ""}
                              onChange={(e) =>
                                wijzigVraag(orb.id, vraagIndex, "uitleg", e.target.value)
                              }
                              rows={2}
                              className="w-full text-sm text-gray-600 p-2 rounded border border-gray-200 focus:border-gray-900 outline-none resize-none"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="border-t border-gray-100 pt-3">
                    {isLaatste ? (
                      <button
                        onClick={verwijderLaatsteOrb}
                        className="text-xs text-red-600 hover:text-red-800 font-medium"
                      >
                        Deze orb helemaal verwijderen (laatste in dit onderwerp)
                      </button>
                    ) : (
                      <p className="text-xs text-gray-400">
                        Deze orb kan niet los verwijderd worden — alleen de laatste orb
                        van een onderwerp, zodat ieders voortgang blijft kloppen.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}


