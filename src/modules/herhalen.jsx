// ============================================================================
// SCHERMEN
// ============================================================================

// ============================================================================
// DE HERHAALSESSIE
// Vragen uit lessen die je eerder deed, dwars door alle onderwerpen heen.
// Dit is het onderdeel dat het verschil maakt tussen een quizapp en iets waar
// je collega's over een half jaar nog uit kunnen putten.
// ============================================================================

// ============================================================================
// HERHALEN — herontwerp §9, checklist §7
// ============================================================================
// `gedwongen`: de herhaling bij het openen van een lesboom. Geen sluitknoppen,
// Escape sluit niet, en na de laatste vraag volgt direct opKlaar.
// `opBekendAntwoord`: voor antwoorden die niet meetellen voor het schema.
// `opVragenOp`: de laatste vraag is beantwoord (het eindscherm komt, of bij
// gedwongen direct opKlaar).
function Herhaalsessie({ due, oefenVragen = [], kennis = {}, domeinen, opAntwoord, opBekendAntwoord, opKlaar, opNaarLes, opVragenOp, gedwongen = false }) {
  // De wachtrij wordt bij de start bevroren. Antwoorden veranderen de actuele
  // Leitner-status, maar mogen de lopende sessie niet onder de gebruiker vandaan
  // herschikken of inkorten.
  const [sessieVragen, setSessieVragen] = useState(() => (Array.isArray(due) ? [...due] : []));
  const [oefenModus, setOefenModus] = useState(false);
  const [index, setIndex] = useState(0);
  const [gekozen, setGekozen] = useState(null);
  const [juist, setJuist] = useState(false);
  const [score, setScore] = useState({ goed: 0, fout: 0 });

  // Oefenen staat los van het herhaalschema: er wordt niets in de Leitner-dozen
  // bijgewerkt, zodat een geplande herhaling op zijn eigen moment blijft komen.
  function startOefenen() {
    setSessieVragen(oefenVragen.map((v) => ({ ...v, doos: null })));
    setOefenModus(true);
    setIndex(0);
    setGekozen(null);
    setJuist(false);
    setScore({ goed: 0, fout: 0 });
  }

  useEffect(() => {
    if (gedwongen) return;
    function bijToets(e) {
      if (e.key === "Escape") opKlaar();
    }
    window.addEventListener("keydown", bijToets);
    return () => window.removeEventListener("keydown", bijToets);
  }, [opKlaar, gedwongen]);

  const huidig = sessieVragen[index];

  // Bij elke vraag gaat de focus naar de vraagtekst: een schermlezer leest hem
  // voor, en een extra Enter of dubbelklik kiest niet per ongeluk antwoord A.
  // Na een antwoord gaat de focus naar "Volgende vraag", anders valt hij op de
  // pagina (het gekozen antwoord wordt onbruikbaar).
  const vraagKopRef = useRef(null);
  const volgendeRef = useRef(null);
  useEffect(() => {
    if (vraagKopRef.current) vraagKopRef.current.focus({ preventScroll: true });
  }, [index, oefenModus]);
  useEffect(() => {
    if (gekozen !== null && volgendeRef.current) volgendeRef.current.focus({ preventScroll: true });
  }, [gekozen]);
  const vragenOp = !huidig && sessieVragen.length > 0;
  useEffect(() => {
    if (vragenOp && opVragenOp) opVragenOp();
  }, [vragenOp]);

  // De dozen met echte aantallen. Staat er nog niets in, dan staan er nullen —
  // geen verzonnen herhaalgeschiedenis (afvinklijst 8).
  const dozenUitKennis = DOZEN.map((d) => ({
    ...d,
    aantal: Object.values(kennis).filter((k) => k && k.doos === d.doos).length,
  }));

  if (!huidig) {
    const klaarMetSessie = sessieVragen.length > 0;
    return (
      <div style={KAART_STIJL}>
        <div style={{ flex: "none", display: "flex", alignItems: "flex-start", gap: 14 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: ST.zilver }}>Herhalen</div>
            <div style={{ fontSize: 23, fontWeight: 700, lineHeight: 1.15, marginTop: 2 }}>
              {klaarMetSessie ? (oefenModus ? "Oefenen afgerond" : "Herhaling afgerond") : "Nog niets ingepland"}
            </div>
            {klaarMetSessie && (
              <div style={{ fontSize: 13, color: UI.tekstSecundair, marginTop: 3 }}>
                {score.goed} goed, {score.fout} fout.
              </div>
            )}
          </div>
          <button type="button" className="lb-sluit kaart-sluit" aria-label="Herhalen sluiten" onClick={opKlaar}>✕</button>
        </div>

        <div className="app-columns" style={{ flex: "1 1 0%", minHeight: 0 }}>
          <div style={{ flex: "1 1 0%", minWidth: 0, background: UI.kaartZacht, border: `1px solid ${UI.randZacht}`, borderRadius: 18, padding: 20, boxSizing: "border-box", display: "flex", flexDirection: "column", justifyContent: "center", gap: 12 }}>
            {oefenVragen.length > 0 ? (
              <>
                <div style={{ fontSize: 15, fontWeight: 700 }}>Alvast oefenen</div>
                <div style={{ fontSize: 13, color: UI.tekstSecundair }}>
                  {oefenVragen.length} {oefenVragen.length === 1 ? "vraag" : "vragen"} uit de gepubliceerde lessen.
                </div>
                <button type="button" className="knop" style={{ alignSelf: "flex-start" }} onClick={startOefenen}>
                  Nu alvast oefenen
                </button>
              </>
            ) : (
              <div style={{ fontSize: 13, color: UI.tekstSecundair }}>Nog geen vragen om mee te oefenen.</div>
            )}
            <button type="button" className="knop2" style={{ alignSelf: "flex-start" }} onClick={opKlaar}>Terug naar overzicht</button>
          </div>

          <aside className="app-sidebar" style={{ background: UI.kaartZacht, border: `1px solid ${UI.randZacht}`, borderRadius: 18, padding: 16, boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 10, overflow: "hidden" }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: ST.zilver }}>Geheugensterkte</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7, overflow: "hidden auto" }}>
              {dozenUitKennis.map((d) => (
                <div key={d.doos} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 14, background: UI.kaart, border: `1px solid ${UI.randZacht}` }}>
                  <span style={{ width: 9, height: 9, borderRadius: 999, flex: "none", background: d.aantal > 0 ? ST.oranje : UI.randZacht }} />
                  <span style={{ fontSize: 12.5, fontWeight: 600, flex: "1 1 0%", minWidth: 0 }}>{d.naam}</span>
                  <span style={{ fontSize: 12, color: UI.tekstSecundair, flex: "none" }}>
                    {d.aantal} {d.aantal === 1 ? "vraag" : "vragen"}
                  </span>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    );
  }

  const domein = domeinen.find((d) => d.id === huidig.topic.domeinId) || { kleur: ST.zilver, naam: "" };
  const domeinNamen = [...new Set(
    sessieVragen.map((v) => (domeinen.find((d) => d.id === v.topic.domeinId) || {}).naam).filter(Boolean)
  )];
  const dozenTelling = DOZEN.map((d) => ({ ...d, aantal: sessieVragen.filter((v) => v.doos === d.doos).length }));

  function antwoord(isJuist) {
    setJuist(isJuist);
    setScore((s) => ({ goed: s.goed + (isJuist ? 1 : 0), fout: s.fout + (isJuist ? 0 : 1) }));
    // Een bekende vraag die nog niet aan de beurt was, telt niet mee.
    if (antwoordTeltMee(huidig, oefenModus)) opAntwoord(huidig.vraag.id, isJuist);
    else if (!oefenModus && opBekendAntwoord) opBekendAntwoord(huidig.vraag.id, isJuist);
  }

  function verder() {
    if (gedwongen && index + 1 >= sessieVragen.length) { opKlaar(); return; }
    setIndex(index + 1);
    setGekozen(null);
    setJuist(false);
  }

  return (
    <div data-feedback-herhaling="true" data-feedback-les-id={huidig.orb?.id}
      data-feedback-lesnaam={huidig.orb?.titel} data-feedback-vraag-id={huidig.vraag.id} style={KAART_STIJL}>
      <div style={{ flex: "none", display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "nowrap" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: ST.zilver }}>
            {oefenModus ? "Oefenen" : "Herhalen"}
          </div>
          <div style={{ fontSize: 23, fontWeight: 700, lineHeight: 1.15, marginTop: 2 }}>
            {oefenModus
              ? `${sessieVragen.length} ${sessieVragen.length === 1 ? "oefenvraag" : "oefenvragen"}`
              : gedwongen
                ? `${sessieVragen.length} ${sessieVragen.length === 1 ? "vraag" : "vragen"}`
                : `${sessieVragen.length} ${sessieVragen.length === 1 ? "vraag is" : "vragen zijn"} aan de beurt`}
          </div>
          <div style={{ fontSize: 13, color: UI.tekstSecundair, marginTop: 3 }}>
            {oefenModus ? "Oefenen telt niet mee voor je herhaalschema." : domeinNamen.length > 0 ? `Uit ${domeinNamen.join(", ")}.` : ""}
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12, flex: "none" }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: UI.tekstSecundair, whiteSpace: "nowrap" }}>
            vraag {index + 1} van {sessieVragen.length}
          </span>
          {!gedwongen && <button type="button" className="lb-sluit" aria-label="Herhaalsessie sluiten" onClick={opKlaar}>✕</button>}
        </div>
      </div>

      <div style={{ flex: "1 1 0%", minHeight: 0, display: "flex", gap: 16, alignItems: "stretch", flexWrap: "nowrap", overflow: "hidden" }}>
        <div style={{ flex: "1 1 0%", minWidth: 0, background: UI.kaartZacht, border: `1px solid ${UI.randZacht}`, borderRadius: 18, display: "flex", flexDirection: "column", overflow: "hidden", padding: "18px 20px", boxSizing: "border-box" }}>
          <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 8 }}>
            {sessieVragen.map((_, i) => (
              <span key={i} style={{ width: 9, height: 9, borderRadius: 999, flex: "none", background: i < index ? UI.succes : i === index ? "#F6A923" : UI.randZacht }} />
            ))}
          </div>
          <div style={{ flex: "1 1 0%", minHeight: 0, overflow: "hidden auto", marginTop: 16 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: ST.zilver }}>
              {domein.naam} · {huidig.topic.titel}
            </div>
            <div ref={vraagKopRef} tabIndex={-1} style={{ fontSize: 19, fontWeight: 700, marginTop: 7, maxWidth: "52ch", outline: "none" }}>{huidig.vraag.vraag}</div>
            <div style={{ marginTop: 14, maxWidth: "64ch" }}>
              <Vraag key={`${huidig.vraag.id}-${index}`} vraag={huidig.vraag} gekozen={gekozen} setGekozen={setGekozen} opAntwoord={antwoord} />
            </div>
            <div aria-live="polite">
              {gekozen !== null && (
                <div style={{ fontSize: 12.5, color: UI.tekstSecundair, marginTop: 12, maxWidth: "60ch", lineHeight: 1.5 }}>
                  <span style={{ fontWeight: 700, color: juist ? UI.succes : "#E32118" }}>
                    {!antwoordTeltMee(huidig, oefenModus)
                      ? (juist ? "Goed. " : "Niet juist. ")
                      : (juist ? "Goed — schuift een doos op. " : "Niet juist — terug naar doos 1. ")}
                  </span>
                  {huidig.vraag.uitleg}
                </div>
              )}
            </div>
            {gekozen !== null && (
              <div style={{ fontSize: 12.5, color: UI.tekstSecundair, maxWidth: "60ch", lineHeight: 1.5 }}>
                {!juist && opNaarLes && !gedwongen && (
                  <div style={{ marginTop: 6 }}>
                    <button
                      type="button"
                      onClick={() => opNaarLes(huidig.topic.id)}
                      style={{ fontSize: 12.5, color: UI.tekstSecundair, textDecoration: "underline", background: "none", border: 0, cursor: "pointer", padding: 0, fontFamily: "inherit" }}
                    >
                      Lees de les terug: {huidig.orb.titel}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 10, paddingTop: 14 }}>
            <button
              type="button"
              ref={volgendeRef}
              className="knop"
              onClick={gekozen !== null ? verder : undefined}
              disabled={gekozen === null}
              style={gekozen === null ? { opacity: 0.4, cursor: "default" } : undefined}
            >
              {index + 1 === sessieVragen.length ? "Afronden" : "Volgende vraag"}
            </button>
            {!gedwongen && <button type="button" className="knop2" onClick={opKlaar}>Later afmaken</button>}
          </div>
        </div>

        <div className="herhaal-zijbalk" style={{ flex: "0 0 288px", maxWidth: 288, display: "flex", flexDirection: "column", overflow: "hidden", padding: 16, boxSizing: "border-box", background: UI.kaartZacht, border: `1px solid ${UI.randZacht}`, borderRadius: 18 }}>
          <div style={{ flex: "none", fontSize: 10.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: ST.zilver }}>
            Geheugensterkte
          </div>
          <div style={{ fontSize: 13, color: UI.tekstSecundair, marginTop: 8, lineHeight: 1.5 }}>
            Goed antwoord schuift een vraag naar een ruimer interval. Fout antwoord zet hem terug naar dagelijks.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 14, flex: "1 1 0%", minHeight: 0, overflow: "hidden auto" }}>
            {dozenTelling.map((d) => (
              <div key={d.doos} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 14, background: "#FFFFFF", border: `1px solid ${UI.randZacht}` }}>
                <span style={{ width: 9, height: 9, borderRadius: 999, flex: "none", background: d.doos === huidig.doos ? "#F6A923" : UI.padNeutraal }} />
                <span style={{ fontSize: 12.5, fontWeight: 600, flex: "1 1 0%", minWidth: 0 }}>{d.naam}</span>
                <span style={{ fontSize: 12, color: UI.tekstSecundair, flex: "none" }}>{d.aantal}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}



// ============================================================================
// HERHALEN BIJ HET OPENEN VAN EEN LESBOOM (#19, #22)
// Een popup zonder kruisje of "Straks"; Escape sluit hem niet en Tab blijft
// binnen de popup. Na de laatste vraag opent de lesboom.
// ============================================================================
function LesboomHerhaalPopup({ domein, sessie, kennis, domeinen, opAntwoord, opBekendAntwoord, opKlaar }) {
  const vakRef = useRef(null);
  // De popup verschijnt onder de muis: de tweede klik van een dubbelklik op de
  // lesboomkaart mag geen antwoord kiezen. Klikken telt pas na een halve seconde.
  const [klikbaar, setKlikbaar] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setKlikbaar(true), 500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const vak = vakRef.current;
    const focusbaar = () => [...vak.querySelectorAll('button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')];
    // De sessie zet de focus zelf op de vraagtekst; alleen als dat niet lukte, het vak.
    if (!vak.contains(document.activeElement)) vak.focus();
    function bijToets(e) {
      if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); return; }
      if (e.key !== "Tab") return;
      const lijst = focusbaar();
      if (lijst.length === 0) { e.preventDefault(); return; }
      const eerste = lijst[0];
      const laatste = lijst[lijst.length - 1];
      if (!vak.contains(document.activeElement)) { e.preventDefault(); eerste.focus(); }
      else if (e.shiftKey && document.activeElement === eerste) { e.preventDefault(); laatste.focus(); }
      else if (!e.shiftKey && document.activeElement === laatste) { e.preventDefault(); eerste.focus(); }
    }
    window.addEventListener("keydown", bijToets, true);
    return () => window.removeEventListener("keydown", bijToets, true);
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 80, display: "grid", placeItems: "center", background: "rgba(29,29,29,.3)", padding: 16 }}>
      <div ref={vakRef} role="dialog" aria-modal="true" aria-label={`Herhalen: ${domein.naam}`} tabIndex={-1}
        style={{ position: "relative", width: "min(1100px, 100%)", height: "min(720px, 100%)", overflowY: "auto", borderRadius: 22, outline: "none" }}>
        {/* Bij sterk inzoomen is het vak lager dan de sessie nodig heeft: dan scrolt het, in plaats van de vraag weg te drukken. */}
        <div style={{ position: "relative", height: "100%", minHeight: 460, pointerEvents: klikbaar ? "auto" : "none" }}>
          <Herhaalsessie gedwongen due={sessie} kennis={kennis} domeinen={domeinen} opAntwoord={opAntwoord} opBekendAntwoord={opBekendAntwoord} opKlaar={opKlaar} />
        </div>
      </div>
    </div>
  );
}

// Teller van vragen die aan de beurt zijn, voor de Herhalen-knop en de
// lesboomkaarten. Rustig onder de drempel; oranje en pulserend erboven.
// Verandert het aantal, dan springt de teller even; zakt hij naar nul, dan
// staat die nul nog even zichtbaar voordat de teller verdwijnt. Het getal staat
// er alleen voor het oog; de knop of kaart eromheen zegt wat het betekent.
function HerhaalTeller({ aantal, puls }) {
  const vorige = useRef(aantal);
  const [sprong, setSprong] = useState(false);
  const [nulTonen, setNulTonen] = useState(false);
  useEffect(() => {
    const was = vorige.current;
    vorige.current = aantal;
    if (was === aantal) return;
    setSprong(true);
    if (aantal === 0) setNulTonen(true);
    const t1 = setTimeout(() => setSprong(false), 450);
    const t2 = aantal === 0 ? setTimeout(() => setNulTonen(false), 1800) : null;
    return () => { clearTimeout(t1); if (t2) clearTimeout(t2); };
  }, [aantal]);
  // Bij de render waarin het aantal net naar nul ging, is nulTonen nog niet gezet.
  const netNaarNul = aantal === 0 && vorige.current !== 0;
  if (aantal === 0 && !nulTonen && !netNaarNul) return null;
  return (
    <span key={aantal} className={`lb-teller${sprong ? " lb-teller-sprong" : ""}`} data-puls={puls && aantal > 0 ? "ja" : "nee"} aria-hidden="true">
      {aantal}
    </span>
  );
}
