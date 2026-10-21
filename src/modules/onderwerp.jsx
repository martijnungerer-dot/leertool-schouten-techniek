// ============================================================================
// ONDERWERP — herontwerp §9, checklist §5
// ============================================================================
function TopicDetail({ topic, domein, alleTopics, voortgang, kennis, nu, opTerug, opOrbStarten, opHerhalen }) {
  const gedaan = voortgang[topic.id] || 0;
  const totaalOrbs = topic.orbs.length;
  const pct = totaalOrbs > 0 ? Math.round((gedaan / totaalOrbs) * 100) : 0;

  const domeinTopics = alleTopics.filter((t) => t.domeinId === domein.id);
  const maxTier = domeinTopics.length ? Math.max(...domeinTopics.map(topicTier)) : 1;
  const raat = bouwRaat(domeinTopics, alleTopics, voortgang, domein.kleur);
  const vorige = voorgangers(topic, domeinTopics);
  const volgende = domeinTopics.filter((t) => (t.prerequisites || []).includes(topic.id));
  const dueHier = vragenDieAanDeBeurtZijn([topic], kennis, nu);

  return (
    <div style={KAART_STIJL}>
      <div style={{ flex: "none", display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "nowrap" }}>
        <span style={{ width: 13, height: 13, borderRadius: 999, flex: "none", marginTop: 8, background: domein.kleur }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: ST.zilver }}>
            {domein.naam} · stap {topicTier(topic)} van {maxTier}
          </div>
          <div style={{ fontSize: 23, fontWeight: 700, lineHeight: 1.15, marginTop: 2 }}>{topic.titel}</div>
          <div style={{ fontSize: 13, color: UI.tekstSecundair, marginTop: 3 }}>
            {totaalOrbs} {totaalOrbs === 1 ? "les" : "lessen"}. {onderwerpSubregel(gedaan, totaalOrbs)}
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12, flex: "none" }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: UI.tekstSecundair, whiteSpace: "nowrap" }}>{pct}% afgerond</span>
          <button type="button" className="lb-sluit" aria-label="Terug naar de lesboom" onClick={opTerug}>✕</button>
        </div>
      </div>

      <div style={{ flex: "1 1 0%", minHeight: 0, display: "flex", gap: 16, alignItems: "stretch", flexWrap: "nowrap", overflow: "hidden" }}>
        <div style={{ flex: "1 1 0%", minWidth: 0, background: UI.kaartZacht, border: `1px solid ${UI.randZacht}`, borderRadius: 18, display: "flex", flexDirection: "column", overflow: "hidden", padding: 14, boxSizing: "border-box" }}>
          <div style={{ flex: "none", marginBottom: 10, fontSize: 10.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: ST.zilver }}>
            Lessen in dit onderwerp
          </div>
          <div style={{ flex: "1 1 0%", minHeight: 0, overflow: "hidden auto", display: "flex", flexDirection: "column", gap: 8 }}>
            {topic.orbs.map((orb, i) => {
              const status = orbStatus(orb, i, gedaan);
              return (
                <button
                  key={orb.id}
                  type="button"
                  className="lb-lesrij"
                  style={ORB_RIJ_STIJL(status)}
                  disabled={status === "leeg"}
                  onClick={() => status !== "leeg" && opOrbStarten(topic.id, i)}
                >
                  <OrbMerk status={status} />
                  <span style={{ minWidth: 0, flex: "1 1 0%" }}>
                    <span style={{ display: "block", fontSize: 14, fontWeight: 700 }}>{orb.titel}</span>
                    <span style={{ display: "block", fontSize: 12, color: UI.tekstSecundair, marginTop: 2 }}>{orbRegel(orb, status, kennis)}</span>
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 999, border: `1px solid ${UI.randZacht}`, background: "#FFFCF7", flex: "none" }}>
                    {ORB_PIL_LABEL[status]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ flex: "0 0 288px", maxWidth: 288, display: "flex", flexDirection: "column", overflow: "hidden", padding: 16, boxSizing: "border-box", background: UI.kaartZacht, border: `1px solid ${UI.randZacht}`, borderRadius: 18 }}>
          <div style={{ flex: "none", fontSize: 10.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: ST.zilver }}>
            Waar dit staat
          </div>
          <div style={{ fontSize: 13, color: UI.tekstSecundair, marginTop: 8, flex: "none" }}>
            {plaatsTekst(vorige, volgende)}
          </div>
          {domeinTopics.length > 0 && (
            <svg viewBox={raat.viewBox} role="img" aria-label="Positie in de lesboom" style={{ display: "block", width: "100%", height: "auto", marginTop: 14, flex: "none" }}>
              {raat.tegels.map((t) => (
                <path
                  key={t.topic.id}
                  d={RAAT_HEX_PAD}
                  transform={`translate(${t.x},${t.y})`}
                  fill={t.topic.id === topic.id ? domein.kleur : "#D8CDBF"}
                  fillOpacity={t.topic.id === topic.id ? 1 : 0.3}
                  stroke="#FFFFFF"
                  strokeWidth="2.4"
                />
              ))}
            </svg>
          )}
          <div style={{ marginTop: "auto", flex: "none", paddingTop: 14 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: ST.zilver }}>
              Herhalen
            </div>
            <div style={{ fontSize: 13, color: UI.tekstSecundair, marginTop: 6 }}>
              {dueHier.length === 0
                ? "Niets uit dit onderwerp is nu aan de beurt."
                : `${dueHier.length} ${dueHier.length === 1 ? "vraag" : "vragen"} uit dit onderwerp ${dueHier.length === 1 ? "is" : "zijn"} aan de beurt.`}
            </div>
            {dueHier.length > 0 && (
              <button type="button" className="knop2" style={{ marginTop: 10, width: "100%" }} onClick={() => opHerhalen(dueHier)}>
                {dueHier.length === 1 ? "Herhaal deze vraag" : `Herhaal deze ${dueHier.length}`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


