// ============================================================================
// BEHEER
// ============================================================================

// ============================================================================
// BESTAANDE LESSTOF BEHEREN
//
// Vóór publicatie kun je blokken uit een concept halen. Ná publicatie was daar
// nooit een weg terug voor — dit repareert dat gat. Je kunt losse blokken uit
// een al-gepubliceerde orb verwijderen, en elke orb helemaal weghalen: voortgang
// wordt per les-id bijgehouden, dus de andere lessen houden hun stand.
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

  // Een vraag met een ander juist antwoord is een andere vraag: hij krijgt een
  // nieuwe id (zie kennisNaVraagwijziging), zodat iedereen hem opnieuw leert in
  // plaats van de beheersing van de oude vraag te erven. Een tikfout herstellen
  // houdt de id; wie de inhoud wezenlijk verandert, kiest "Laat opnieuw leren".
  function nieuweVersie(v) {
    return { ...v, id: "vraag-" + crypto.randomUUID(), vorigeId: v.id };
  }

  function wijzigVraag(orbId, vraagIndex, veld, waarde) {
    bewaarOrbs(
      topic.orbs.map((o) =>
        o.id === orbId
          ? {
              ...o,
              vragen: (o.vragen || []).map((v, i) => {
                if (i !== vraagIndex || v[veld] === waarde) return v;
                const gewijzigd = { ...v, [veld]: waarde };
                return veld === "juisteIndex" ? nieuweVersie(gewijzigd) : gewijzigd;
              }),
            }
          : o
      )
    );
  }

  function laatOpnieuwLeren(orbId, vraagIndex) {
    bewaarOrbs(
      topic.orbs.map((o) =>
        o.id === orbId
          ? {
              ...o,
              vragen: (o.vragen || []).map((v, i) => (i === vraagIndex ? nieuweVersie(v) : v)),
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

  function verwijderOrb(orbId) {
    if (!window.confirm("Deze les helemaal verwijderen? Dit kan niet ongedaan worden gemaakt.")) return;
    bewaarOrbs(topic.orbs.filter((o) => o.id !== orbId));
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
        {topic.orbs.map((orb) => {
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

                      <label className="block text-sm">Titel leesblok {blokIndex+1}<input aria-label={`Titel leesblok ${blokIndex+1}`} value={blok.titel||""} onChange={e=>wijzigBlok(orb.id,blokIndex,"titel",e.target.value)} className="w-full border rounded p-2"/></label>
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
                                  Het groene vinkje markeert het juiste antwoord. Kies je een
                                  ander juist antwoord, dan leert iedereen deze vraag opnieuw.
                                </p>
                                {heeftDubbeleOpties(vraag.opties || []) && (
                                  <p role="alert" className="text-xs text-red-700">
                                    Twee antwoorden zijn hetzelfde. Maak elk antwoord anders.
                                  </p>
                                )}
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
                            <div className="flex items-center justify-between gap-3 mt-2">
                              <p className="text-xs text-gray-400">
                                Een tikfout herstellen? Dan blijft ieders voortgang staan. Is
                                de vraag inhoudelijk anders geworden, laat hem dan opnieuw leren.
                              </p>
                              <button
                                onClick={() => laatOpnieuwLeren(orb.id, vraagIndex)}
                                className="text-xs text-gray-600 hover:text-gray-900 font-medium shrink-0"
                              >
                                Laat opnieuw leren
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="border-t border-gray-100 pt-3">
                    <button
                      onClick={() => verwijderOrb(orb.id)}
                      className="text-xs text-red-600 hover:text-red-800 font-medium"
                    >
                      Deze les helemaal verwijderen
                    </button>
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


