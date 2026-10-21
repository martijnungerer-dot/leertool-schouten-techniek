// ============================================================================
// CHROMERIJ (leerkant, overzichtsscherm) — herontwerp §6, §8
//
// Voorlopig alleen boven het lesboomkaarten-scherm; het optrekken tot een
// gedeelde balk boven élk leerscherm (met het instellingenpaneel) staat nog
// open. Zoeken dekt lesbomen, onderwerpen én lessen op
// naam, pad en soort, en springt altijd naar de lesboom van de treffer.
// ============================================================================
function ChromerijLeren({
  domeinen, topics, voortgang, aantalDue, modus = "leren", magBeheren = true,
  actiefDomeinNaam, opTerug, opHerhalen, opBeheren, opNaarLeren, opSpringNaarDomein, opInstellingen,
}) {
  const [zoekAan, setZoekAan] = useState(false);
  const [term, setTerm] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (!zoekAan) return;
    const id = setTimeout(() => inputRef.current && inputRef.current.focus(), 30);
    return () => clearTimeout(id);
  }, [zoekAan]);

  useEffect(() => {
    function bijToets(e) {
      if (e.key === "Escape" && zoekAan) { setZoekAan(false); setTerm(""); }
    }
    window.addEventListener("keydown", bijToets);
    return () => window.removeEventListener("keydown", bijToets);
  }, [zoekAan]);

  const getypt = term.trim().toLowerCase();
  const treffers = getypt
    ? bouwZoekindex(domeinen, topics, voortgang)
        .filter((r) => `${r.naam} ${r.pad} ${r.soort}`.toLowerCase().includes(getypt))
        .slice(0, 7)
    : [];

  function springNaar(domeinId) {
    opSpringNaarDomein(domeinId);
    setZoekAan(false);
    setTerm("");
  }

  return (
    <div className="app-header">
      {modus !== "beheren" && actiefDomeinNaam && <button className="lb-chrome" onClick={opTerug}>‹ Terug</button>}
      <img className="app-logo-vol" src={LOGO_PAD} alt="Schouten Techniek" style={{ height: 34, width: "auto", flex: "none" }} />
      <img className="app-logo-merk" src={BEELDMERK_PAD} alt="Schouten Techniek" style={{ height: 30, width: "auto", flex: "none" }} />
      <div className="app-nav">
        {modus === "beheren" ? (
          <>
            <button type="button" className="lb-chrome" onClick={opNaarLeren}>Leren</button>
            <button type="button" className="lb-chrome" data-actief="ja" onClick={opBeheren}>{BEHEER_NAAM}</button>
          </>
        ) : (
          <>
            <button type="button" className="lb-chrome" data-actief="ja" onClick={opNaarLeren}>
              {actiefDomeinNaam || "Leren"}
            </button>
            {magBeheren && <button type="button" className="lb-chrome" onClick={opBeheren}>{BEHEER_NAAM}</button>}
          </>
        )}
        <button type="button" className="lb-chrome" onClick={opHerhalen}>
          Herhalen
          {aantalDue > 0 && (
            <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 18, height: 18, padding: "0 5px", borderRadius: 999, background: "#F6A923", color: "#1D1D1D", fontSize: 10.5, fontWeight: 700 }}>
              {aantalDue}
            </span>
          )}
        </button>

        {!zoekAan ? (
          <button type="button" className="lb-chrome" aria-label="Zoeken" onClick={() => setZoekAan(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={UI.tekstSecundair} strokeWidth="2.75" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" /><path d="M16.5 16.5L21 21" />
            </svg>
            <span className="lb-chrome-bijschrift">Zoeken</span>
          </button>
        ) : (
          <div style={{ position: "relative", flex: "none" }}>
            <div className="lb-zoekveld">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={UI.tekstSecundair} strokeWidth="2.75" strokeLinecap="round" aria-hidden="true" style={{ flex: "none" }}>
                <circle cx="11" cy="11" r="7" /><path d="M16.5 16.5L21 21" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                onKeyDown={(e) => { if(e.key === "Enter" && treffers[0]) {e.preventDefault();springNaar(treffers[0].domeinId);} }}
                placeholder="Zoek een lesboom, onderwerp of les"
                aria-label="Zoeken"
                style={{ flex: "1 1 0%", minWidth: 0, border: 0, outline: 0, background: "transparent", fontFamily: "inherit", fontSize: 12.5, color: "#1D1D1D" }}
              />
              <button type="button" className="lb-sluit" aria-label="Zoeken sluiten" style={{ width: 22, height: 22, fontSize: 11 }} onClick={() => { setZoekAan(false); setTerm(""); }}>✕</button>
            </div>
            {getypt && (
              <div style={{ position: "absolute", top: 42, right: 0, zIndex: 60, width: 340, maxHeight: 330, overflowY: "auto", padding: 6, background: "#FFFFFF", border: `1px solid ${UI.randZacht}`, borderRadius: 16, boxShadow: "0 8px 24px rgba(29,29,29,.12)" }}>
                {treffers.length > 0 ? (
                  treffers.map((t, i) => (
                    <button key={i} type="button" className="lb-trefrij" onClick={() => springNaar(t.domeinId)}>
                      <TrefferTegelSvg status={t.status} />
                      <span style={{ flex: "1 1 0%", minWidth: 0, display: "flex", flexDirection: "column", gap: 2, textAlign: "left" }}>
                        <span style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.3 }}>{t.naam}</span>
                        <span style={{ fontSize: 11.5, color: UI.tekstSecundair, lineHeight: 1.3 }}>{t.pad}</span>
                      </span>
                      <span style={{ fontSize: 10.5, fontWeight: 700, flex: "none", padding: "3px 8px", borderRadius: 999, whiteSpace: "nowrap", background: ZOEK_SOORT_STIJL[t.soort].achtergrond, border: `1px solid ${ZOEK_SOORT_STIJL[t.soort].rand}`, color: UI.tekstSecundair }}>
                        {t.soort}
                      </span>
                    </button>
                  ))
                ) : (
                  <div style={{ padding: "14px 12px", fontSize: 12.5, color: UI.tekstSecundair, lineHeight: 1.5 }}>
                    Niets gevonden voor "{term.trim()}". Probeer een kortere zoekterm.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <button type="button" className="lb-chrome" aria-label="Instellingen" onClick={opInstellingen}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={UI.tekstSecundair} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3.2" />
            <path d="M19.4 13.6a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V19.6a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3.6a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9.6a1.65 1.65 0 0 0 1-1.51V3.6a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9.6a1.65 1.65 0 0 0 1.51 1H20.4a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
          </svg>
          <span className="lb-chrome-bijschrift">Instellingen</span>
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// AANMELDEN — herontwerp design/herontwerp/03, afvinklijst §2
//
// Geen echte authenticatie: de velden zijn bewust niet-werkend (net als in de
// vorige modal), maar de rolkeuze schakelt de app nu wél echt om, in plaats
// van alleen een infotekst te tonen.
// ============================================================================
function Aanmelden({ opKiesRol }) {

  return (
    <div style={{ minHeight: "100dvh", boxSizing: "border-box", display: "flex", flexDirection: "column", padding: "26px 26px 34px", backgroundColor: UI.achtergrond, fontFamily: 'Calibri, Carlito, Candara, "Segoe UI", system-ui, Arial, sans-serif' }}>
      <style>{APP_STIJL}</style>
      <img src={LOGO_PAD} alt="Schouten Techniek" style={{ height: 46, width: "auto", display: "block", alignSelf: "flex-start", flexShrink: 0 }} />
      <div style={{ flex: "1 1 auto", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ position: "relative", width: "100%", maxWidth: 540 }}>
            <div style={{ background: UI.kaart, border: `1px solid ${UI.randZacht}`, borderRadius: 22, boxShadow: "0 1px 3px rgba(29,29,29,.05)", padding: "36px 34px", display: "flex", flexDirection: "column", gap: 24 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: ST.zilver }}>Leerplatform</span>
                <h1 style={{ margin: 0, fontSize: 30, letterSpacing: "-.01em" }}>Welkom</h1>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 17 }}>
                <button type="button" className="knop" style={{ padding: "14px 18px", fontSize: "inherit" }} onClick={() => opKiesRol("lerende")}>Naar mijn lesbomen</button>
                <button type="button" className="knop2" style={{ padding: "14px 18px", fontSize: "inherit" }} onClick={() => opKiesRol("beheerder")}>Naar {BEHEER_NAAM.toLowerCase()}</button>
              </div>
            </div>
        </div>
      </div>
      <span style={{ fontSize: 11.5, color: ST.zilver }}>Schouten Techniek · Leerplatform</span>
    </div>
  );
}

// ============================================================================
// INSTELLINGENPANEEL — herontwerp §6 (uit de chromerij, opdracht 4)
//
// "Beweging beperken" en "voortgang terugzetten" zijn echt: de eerste zet de
// .lb-rustig-regels aan (dezelfde als prefers-reduced-motion, nu handmatig),
// de tweede wist voortgang en kennis. Notificaties/taal/contrast hebben geen
// backend om aan te haken — dezelfde "komt eraan"-aanpak als het
// aanmeldscherm, niet een verzonnen werking voorspiegelen.
// ============================================================================
function InstellingenRij({ label, toelichting, aan, opWissel, waarde }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <span style={{ fontSize: 13.5, fontWeight: 600 }}>{label}</span>
        {opWissel ? (
          <button type="button" className="lb-chrome" data-actief={aan ? "ja" : "nee"} aria-pressed={aan} onClick={opWissel}>
            {aan ? "Aan" : "Uit"}
          </button>
        ) : (
          <span className="lb-chrome" style={{ cursor: "default" }}>{waarde}</span>
        )}
      </div>
      {toelichting && <span style={{ fontSize: 11.5, color: UI.tekstSecundair, lineHeight: 1.4 }}>{toelichting}</span>}
    </div>
  );
}

function InstellingenPaneel({ open, magBeheren, rustig, opWisselRustig, contrast, opWisselContrast, notificaties, opWisselNotificaties, opSluiten, opVoortgangTerugzetten, opBackup, opImport }) {
  const [bevestigen, setBevestigen] = useState(false);

  useEffect(() => {
    if (!open) setBevestigen(false);
  }, [open]);

  useEffect(() => {
    function bijToets(e) {
      if (e.key === "Escape" && open) { e.preventDefault(); e.stopImmediatePropagation(); opSluiten(); }
    }
    window.addEventListener("keydown", bijToets, true);
    return () => window.removeEventListener("keydown", bijToets, true);
  }, [open, opSluiten]);

  return (
    <div className="instellingen-paneel" data-open={open ? "ja" : "nee"} aria-hidden={!open}>
      {open && (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flex: "none" }}>
            <span style={{ fontSize: 17, fontWeight: 700 }}>Instellingen</span>
            <button type="button" className="lb-sluit" aria-label="Instellingen sluiten" onClick={opSluiten}>✕</button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16, overflow: "auto", flex: "1 1 auto" }}>
            <InstellingenRij
              label="Beweging beperken"
              aan={rustig}
              opWissel={opWisselRustig}
            />
            <InstellingenRij
              label="Notificaties"
              aan={notificaties}
              opWissel={opWisselNotificaties}
            />
            <InstellingenRij label="Taal" waarde="Nederlands" />
            <InstellingenRij
              label="Contrast"
              aan={contrast}
              opWissel={opWisselContrast}
            />
            <InstellingenRij label="AI" waarde="Uitgeschakeld" />
            <InstellingenRij label="Rol" waarde={magBeheren ? "Beheerder" : "Lerende"} />
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              <strong style={{fontSize:13.5}}>Je gegevens</strong>
              <button className="knop2" onClick={opBackup}>Back-up downloaden</button>
              <label className="knop2" style={{cursor:"pointer"}}>Back-up terugzetten<input type="file" accept="application/json,.json" style={{position:"absolute",width:1,height:1,opacity:0}} onChange={opImport} /></label>
            </div>

            <div style={{ height: 1, background: "#EFE6DA" }} />

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>Voortgang terugzetten</span>
              <span style={{ fontSize: 11.5, color: UI.tekstSecundair, lineHeight: 1.4 }}>
                Zet al je afgeronde lessen en herhaalgeschiedenis terug naar nul. Dit kan niet ongedaan worden gemaakt.
              </span>
              {!bevestigen ? (
                <button type="button" className="knop2" style={{ alignSelf: "flex-start" }} onClick={() => setBevestigen(true)}>
                  Voortgang terugzetten
                </button>
              ) : (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="knop"
                    onClick={() => {
                      opVoortgangTerugzetten();
                      setBevestigen(false);
                    }}
                  >
                    Ja, zet terug
                  </button>
                  <button type="button" className="knop2" onClick={() => setBevestigen(false)}>Annuleren</button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

