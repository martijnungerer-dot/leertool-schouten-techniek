// ============================================================================
// TECH TREE — ontgrendel-logica
//
// Een topic is beschikbaar zodra al zijn prerequisites VOLLEDIG zijn afgerond.
// Volledig = elke les die meetelt (niet leeg, geen lesopzet) is afgerond. Een lege prerequisites-array betekent: dit is
// de stam, altijd toegankelijk.
//
// gridPos ({ tier, track }) is de wiskundige basis voor de latere RPG-boom:
// tier = verticale groei in het leertraject, track = de horizontale tak.
// ============================================================================

// Berekent waar een nieuw onderwerp in de boom komt, op basis van de gekozen
// voorganger. De maker denkt in leerlogica ("dit komt na eiwit"); het systeem
// leidt de coördinaten af. Geen voorganger = een nieuwe stam.
function berekenPlaatsing(topics, domeinId, voorgangerId) {
  // Welke tracks zijn al bezet op een bepaald tier in dit domein?
  function eersteVrijeTrack(tier) {
    const bezet = new Set(
      topics
        .filter((t) => t.domeinId === domeinId && (t.gridPos ? t.gridPos.tier : 1) === tier)
        .map((t) => (t.gridPos ? t.gridPos.track : 0))
    );
    let track = 1;
    while (bezet.has(track)) track++;
    return track;
  }

  if (!voorgangerId) {
    // nieuwe stam: tier 1, eerste vrije track
    return { prerequisites: [], gridPos: { tier: 1, track: eersteVrijeTrack(1) } };
  }

  const voorganger = topics.find((t) => t.id === voorgangerId);
  const vTier = voorganger && voorganger.gridPos ? voorganger.gridPos.tier : 1;
  const doelTier = vTier + 1;

  return {
    prerequisites: [voorgangerId],
    gridPos: { tier: doelTier, track: eersteVrijeTrack(doelTier) },
  };
}

function isTopicUnlocked(topic, topics, voortgang) {
  const eisen = topic.prerequisites || [];
  if (eisen.length === 0) return true; // stam

  return eisen.every((eisId) => {
    const vereist = topics.find((t) => t.id === eisId);
    if (!vereist) return false; // prerequisite bestaat niet (meer) -> niet ontgrendeld
    const totaal = telbareLessen(vereist).length;
    if (totaal === 0) return false; // een leeg topic kun je niet afronden
    return aantalAfgerond(vereist, voortgang) >= totaal;
  });
}

// ============================================================================
// BEGRIPPEN — de leerlijn
//
// Elke orb legt vast welke vakwoorden hij introduceert. Wat eerder in dit
// domein is uitgelegd, mag later als bekend worden verondersteld. Jargon dat
// nergens is geïntroduceerd, keurt de redacteur af.
// ============================================================================

function topicTier(topic) {
  return (topic.gridPos && topic.gridPos.tier) || 1;
}

// Alle onderwerpen die vóór dit onderwerp komen in de boom: de prerequisite-keten,
// helemaal terug tot de stam. Dit bepaalt welke begrippen de lezer al kent.
function voorgangers(topic, topics, gezien = new Set()) {
  const keten = [];
  (topic.prerequisites || []).forEach((eisId) => {
    if (gezien.has(eisId)) return;
    gezien.add(eisId);
    const vorige = topics.find((t) => t.id === eisId);
    if (vorige) {
      keten.push(vorige, ...voorgangers(vorige, topics, gezien));
    }
  });
  return keten;
}


