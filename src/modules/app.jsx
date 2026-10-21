function LeerplatformApp() {
  const [modus, setModus] = useState("leren");
  const [domeinen, setDomeinen] = useState(START_DOMEINEN);
  const [bronnen, setBronnen] = useState(START_BRONNEN);
  const [topics, setTopics] = useState(START_TOPICS);
  const [geladen, setGeladen] = useState(false);

  const [actiefTopic, setActiefTopic] = useState(null);
  const [actieveOrb, setActieveOrb] = useState(null);
  const [voortgang, setVoortgang] = useState({});   // welke orbs zijn af
  const [kennis, setKennis] = useState({});         // Leitner-doos per vraag
  const [openingsdagen, setOpeningsdagen] = useState([]); // dagen waarop de app open was
  const [herhalen, setHerhalen] = useState(false);
  const [toonAanmelden, setToonAanmelden] = useState(MAG_VOORBEREIDEN);
  // Welke lesboom op het overzicht is opengelegd (het paneel over het
  // kaartenrooster); null = geen enkele.
  const [actiefDomein, setActiefDomein] = useState(null);
  // De gedwongen herhaling bij het openen van een lesboom: { domeinId, sessie }.
  const [lesboomHerhaling, setLesboomHerhaling] = useState(null);
  const [instellingenOpen, setInstellingenOpen] = useState(false);
  // "Beweging beperken" uit het instellingenpaneel — een gebruikersvoorkeur,
  // dus hoort bij hetzelfde opslagmoment als leerpadVoorkeuren.
  const [rustig, setRustig] = useState(false);
  const [contrast, setContrast] = useState(false);
  const [notificaties, setNotificaties] = useState(true);
  const [opslagFout, setOpslagFout] = useState("");
  const [importVoorstel, setImportVoorstel] = useState(null);
  // Persoonlijke volgorde van de leerpaden op het overzicht (zie §normaliseer).
  // Hoort bij voortgang/kennis: het is een gebruikersvoorkeur, geen content.
  const [leerpadVoorkeuren, setLeerpadVoorkeuren] = useState({
    volgorde: [],
    gebruik: {},
    handmatig: false,
    vastgezet: [],
  });
  // De Leitner-popup dringt zich op bij binnenkomst als er iets te herhalen is.
  // 'Straks' stelt hem uit, maar na het afronden van een les komt hij terug.
  const [herhaalPopupUitgesteld, setHerhaalPopupUitgesteld] = useState(false);
  // Testklok — alleen om het Leitner-systeem te kunnen verifiëren zonder
  // weken te wachten. Staat op 0 bij elke herstart, telt niet mee in wat er
  // ooit echt wordt uitgerold.
  const nu = Date.now();
  // Voortgang en kennis horen bij één opslagmoment. De wachtrij voorkomt dat
  // twee snelle state-updates hun opslagacties in een andere volgorde afronden.
  const voortgangOpslagRij = useRef(Promise.resolve());

  useEffect(() => {
    let leeft = true;
    Promise.all([laden(), laadVoortgang()]).then(([opgeslagen, vg]) => {
      if (leeft && opgeslagen) {
        if (opgeslagen.domeinen) setDomeinen(opgeslagen.domeinen);
        if (opgeslagen.topics) setTopics(opgeslagen.topics);
        if (opgeslagen.bronnen) setBronnen(opgeslagen.bronnen);
      }
      if (leeft && vg) {
        if (vg.voortgang) setVoortgang(vg.voortgang);
        if (vg.kennis) setKennis(vg.kennis);
        // oude opslag heeft dit veld nog niet: normaliseren vult veilige defaults in
        setLeerpadVoorkeuren(normaliseerVoorkeuren(vg.leerpadVoorkeuren));
        setRustig(vg.rustig === true);
        setContrast(vg.contrast === true);
        setNotificaties(vg.notificaties !== false);
      }
      if (leeft) {
        setOpeningsdagen(voegOpeningsdagToe(normaliseerOpeningsdagen(vg && vg.openingsdagen), Date.now()));
        setGeladen(true);
      }
    });
    return () => {
      leeft = false;
    };
  }, []);

  useEffect(() => {
    const meld = () => setOpslagFout("Bewaren in deze browser is mislukt. Download een back-up voordat je dit venster sluit.");
    window.addEventListener("leerplatform-opslagfout", meld);
    return () => window.removeEventListener("leerplatform-opslagfout", meld);
  }, []);

  useEffect(() => {
    if (!geladen) return;

    const momentopname = { voortgang, kennis, openingsdagen, leerpadVoorkeuren, rustig, contrast, notificaties };
    voortgangOpslagRij.current = voortgangOpslagRij.current.then(() =>
      bewaarVoortgang(momentopname)
    );
  }, [geladen, voortgang, kennis, openingsdagen, leerpadVoorkeuren, rustig, contrast, notificaties]);

  async function slaOp({ domeinen: d, topics: t, bronnen: b }) {
    const nieuweBronnen = b !== undefined ? b : bronnen;
    const gelukt = await bewaren({ domeinen: d, topics: t, bronnen: nieuweBronnen });
    if (!gelukt) { setOpslagFout("De wijziging is niet opgeslagen. Maak ruimte vrij in je browser en probeer opnieuw."); return false; }
    setDomeinen(d);
    setTopics(t);
    setBronnen(nieuweBronnen);
    return true;
  }

  function downloadBackup() {
    const inhoud = {versie:1, datum:new Date().toISOString(), content:{domeinen,topics,bronnen}, leren:{voortgang,kennis,leerpadVoorkeuren,rustig,contrast,notificaties}};
    const url=URL.createObjectURL(new Blob([JSON.stringify(inhoud,null,2)],{type:"application/json"}));
    const a=document.createElement("a"); a.href=url; a.download="leerplatform-backup.json"; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  async function leesBackup(e) {
    const file=e.target.files[0]; if(!file) return;
    try {
      const data=JSON.parse(await file.text());
      const c=data.content;
      if(!c || !Array.isArray(c.domeinen) || !Array.isArray(c.topics) || !c.bronnen || typeof c.bronnen!=="object") throw Error("Geen geldige leerplatform-back-up.");
      if(c.domeinen.some(d=>!d || typeof d.id!=="string" || typeof d.naam!=="string") || c.topics.some(t=>!t || typeof t.id!=="string" || typeof t.titel!=="string" || !Array.isArray(t.orbs))) throw Error("De inhoud van deze back-up is onvolledig.");
      setImportVoorstel(data);
    } catch(err) {setOpslagFout(err.message);}
    e.target.value="";
  }

  async function herstelBackup() {
    if(!importVoorstel) return;
    const data=importVoorstel;
    if(!await slaOp(data.content)) return;
    const vg=data.leren || {};
    setVoortgang(vg.voortgang || {}); setKennis(vg.kennis || {});
    setLeerpadVoorkeuren(normaliseerVoorkeuren(vg.leerpadVoorkeuren));
    setRustig(vg.rustig === true); setContrast(vg.contrast === true); setNotificaties(vg.notificaties === true);
    setActiefDomein(null); setActiefTopic(null); setActieveOrb(null); setHerhalen(false);
    setImportVoorstel(null);
  }

  // Je eigen volgorde van de lesbomen. Zodra je sleept, telt die volgorde en
  // niet meer de automatische "waar je mee bezig bent"-sortering.
  function bewaarVolgorde(ids) {
    setLeerpadVoorkeuren((v) => ({ ...normaliseerVoorkeuren(v), volgorde: ids, handmatig: true }));
  }

  // Vastzetten haalt een lesboom naar voren en houdt hem daar, ook als de
  // automatische volgorde iets anders zou willen.
  function wisselVastgezet(id) {
    setLeerpadVoorkeuren((v) => {
      const vk = normaliseerVoorkeuren(v);
      const vast = vk.vastgezet.includes(id)
        ? vk.vastgezet.filter((x) => x !== id)
        : [...vk.vastgezet, id];
      return { ...vk, vastgezet: vast };
    });
  }

  // "Voortgang terugzetten" uit het instellingenpaneel — echt en onomkeerbaar,
  // niet nog een "komt eraan"-schakelaar.
  function zetVoortgangTerug() {
    setVoortgang({});
    setKennis({});
  }

  function rondOrbAf(topicId, orbIndex) {
    const t = topics.find((x) => x.id === topicId);
    if(t?.orbs?.[orbIndex]?.concept) {setActieveOrb(null);return;}
    if (!t || !Array.isArray(t.orbs)) {
      setActieveOrb(null);
      return;
    }

    setVoortgang((v) => {
      const huidig = v[topicId] || 0;
      const nieuw =
        orbIndex === huidig && huidig < t.orbs.length
          ? { ...v, [topicId]: huidig + 1 }
          : v;
      return nieuw;
    });
    setActieveOrb(null);
    setHerhaalPopupUitgesteld(false); // de herhaal-popup mag weer verschijnen
  }

  // Elk antwoord verschuift de vraag in het Leitner-systeem.
  function noteerAntwoord(vraagId, juist) {
    setKennis((k) => verwerkAntwoord(k, vraagId, juist, nu));
  }

  // De centrale route waarlangs de leerkant een topic opent. Telt het gebruik
  // van het domein (voor 'meest gebruikte bovenaan') en opent daarna het topic.
  // Het starten van een orb binnen een al geopend topic telt NIET opnieuw.
  function openTopic(topicId) {
    const t = topics.find((x) => x.id === topicId);
    if (t) {
      setLeerpadVoorkeuren((v) => {
        const vk = normaliseerVoorkeuren(v);
        const g = vk.gebruik[t.domeinId] || { openingen: 0, laatstGebruikt: 0 };
        return {
          ...vk,
          gebruik: {
            ...vk.gebruik,
            [t.domeinId]: { openingen: (g.openingen || 0) + 1, laatstGebruikt: Date.now() },
          },
        };
      });
    }
    setActiefTopic(topicId);
  }

  // Een lesboom openen: is er iets aan de beurt, dan eerst de herhaling.
  function openLesboom(domeinId) {
    const sessie = herhaalsessieVoorLesboom(topics, kennis, Date.now(), domeinId);
    if (sessie.length > 0) { setLesboomHerhaling({ domeinId, sessie }); return; }
    setActiefDomein(domeinId);
  }

  const topic = actiefTopic ? topics.find((t) => t.id === actiefTopic) : null;
  const domein = topic ? domeinen.find((d) => d.id === topic.domeinId) : null;
  const inLes = topic && domein && actieveOrb !== null;

  const due = vragenDieAanDeBeurtZijn(topics, kennis, nu);

  // Alleen het overzicht krijgt de afgeleide volgorde; beheer, bronnen en
  // generatie blijven met de originele domeinen-array werken.
  const geordendeDomeinen = bepaalGeordendeDomeinen(domeinen, leerpadVoorkeuren);
  // Het recht om lessen voor te bereiden komt uit MAG_VOORBEREIDEN; de keuze op
  // het aanmeldscherm bepaalt alleen waar je begint. Geen beveiliging: echte
  // afscherming vraagt accounts en een server.
  const magBeheren = MAG_VOORBEREIDEN;

  // Aanmelden is een volledig scherm (herontwerp §Aanmelden), geen dialoog
  // over de rest van de app — vandaar de vroege return.
  if (toonAanmelden) {
    return (
      <Aanmelden
        opKiesRol={(gekozenRol) => {
          setModus(gekozenRol === "beheerder" ? "beheren" : "leren");
          setToonAanmelden(false);
        }}
      />
    );
  }

  return (
    <div
      className={`app-shell${rustig ? " lb-rustig" : ""}${contrast ? " app-high-contrast" : ""}`}
      style={{ backgroundColor: UI.achtergrond, fontFamily: 'Calibri, Carlito, Candara, "Segoe UI", system-ui, Arial, sans-serif' }}
    >
      <style>{APP_STIJL}</style>
      <div className="app-layout">
        <ChromerijLeren
          modus={modus}
          domeinen={geordendeDomeinen}
          topics={topics}
          voortgang={voortgang}
          aantalDue={due.length}
          actiefDomeinNaam={domein ? domein.naam : actiefDomein ? (domeinen.find((d) => d.id === actiefDomein) || {}).naam : null}
          opTerug={() => {
            if (herhalen) { setHerhalen(false); return; }
            if (inLes) { setActieveOrb(null); return; }
            if (actiefTopic) { setActiefTopic(null); return; }
            setActiefDomein(null);
          }}
          magBeheren={magBeheren}
          opHerhalen={() => { setModus("leren"); setHerhalen(true); }}
          opBeheren={() => { if (magBeheren) setModus("beheren"); }}
          opNaarLeren={() => {setModus("leren"); setHerhalen(false); setActiefTopic(null); setActieveOrb(null);}}
          opSpringNaarDomein={(id) => { setModus("leren"); setHerhalen(false); setActiefTopic(null); setActieveOrb(null); openLesboom(id); }}
          opInstellingen={() => setInstellingenOpen(true)}
        />

        {!geladen && <p className="text-sm text-gray-400">Laden…</p>}
        {opslagFout && <div role="alert" className="app-alert">{opslagFout} <button className="knop2" onClick={downloadBackup}>Back-up downloaden</button><button className="lb-sluit" aria-label="Melding sluiten" onClick={()=>setOpslagFout("")}>×</button></div>}

        {geladen && modus === "beheren" && magBeheren && (
          <BeheerLokaal
            domeinen={geordendeDomeinen}
            topics={topics}
            bronnen={bronnen}
            vastgezet={leerpadVoorkeuren.vastgezet || []}
            eigenVolgorde={leerpadVoorkeuren.handmatig === true}
            opVolgorde={bewaarVolgorde}
            opVastWisselen={wisselVastgezet}
            opOpslaan={slaOp}
            kennis={kennis}
          />
        )}

        {geladen && modus === "beheren" && !magBeheren && (
          <div className="app-content">
            <div style={KAART_STIJL}>
              <div style={{ margin: "auto", textAlign: "center", display: "flex", flexDirection: "column", gap: 10, alignItems: "center", maxWidth: 380 }}>
                <div style={{ fontSize: 19, fontWeight: 700 }}>{BEHEER_NAAM} is niet beschikbaar</div>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: UI.tekstSecundair }}>
                  Wil je lessen toevoegen? Neem contact op met de beheerder.
                </p>
                <button type="button" className="knop" onClick={() => setModus("leren")}>Terug naar leren</button>
              </div>
            </div>
          </div>
        )}

        {geladen && modus === "leren" && (
          <div className="app-content">
            {herhalen ? (
              <Herhaalsessie
                due={due}
                oefenVragen={oefenbareVragen(topics)}
                kennis={kennis}
                domeinen={domeinen}
                opAntwoord={noteerAntwoord}
                opKlaar={() => setHerhalen(false)}
                opNaarLes={(topicId) => {
                  setHerhalen(false);
                  openTopic(topicId);
                }}
              />
            ) : inLes ? (
              <LesLokaal
                key={`${topic.id}-${actieveOrb}`}
                topic={topic}
                domein={domein}
                orbIndex={actieveOrb}
                opAfronden={() => rondOrbAf(topic.id, actieveOrb)}
                opAfbreken={() => setActieveOrb(null)}
                opVraagBeantwoord={noteerAntwoord}
              />
            ) : topic && domein ? (
              <TopicDetail
                topic={topic}
                domein={domein}
                alleTopics={topics}
                voortgang={voortgang}
                kennis={kennis}
                nu={nu}
                opTerug={() => setActiefTopic(null)}
                opOrbStarten={(tid, oi) => {
                  setActiefTopic(tid);
                  setActieveOrb(oi);
                }}
                opHerhalen={() => setHerhalen(true)}
              />
            ) : (
              <Overzicht
                domeinen={geordendeDomeinen}
                topics={topics}
                voortgang={voortgang}
                kennis={kennis}
                vastgezet={leerpadVoorkeuren.vastgezet || []}
                eigenVolgorde={leerpadVoorkeuren.handmatig === true}
                opVolgorde={bewaarVolgorde}
                opVastWisselen={wisselVastgezet}
                actiefDomein={actiefDomein}
                opDomeinOpen={openLesboom}
                opDomeinSluiten={() => setActiefDomein(null)}
                opOrbStarten={(tid, oi) => {
                  setActiefTopic(tid);
                  setActieveOrb(oi);
                }}
              />
            )}
          </div>
        )}
      </div>

      {/* De Leitner-popup: dringt zich op bij binnenkomst als er iets te herhalen is */}
      {geladen &&
        modus === "leren" &&
        !inLes &&
        !herhalen &&
        !actiefTopic &&
        !herhaalPopupUitgesteld &&
        !lesboomHerhaling &&
        notificaties &&
        due.length > 0 && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-6 z-50">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
              <div className="flex justify-center mb-3">
                <Merkteken grootte={44} />
              </div>
              <h2 className="text-xl font-bold text-gray-900 text-center">
                {due.length === 1
                  ? "1 vraag is aan de beurt"
                  : `${due.length} vragen zijn aan de beurt`}
              </h2>
              <p className="text-sm text-gray-600 mt-2 text-center">
                Kennis zakt weg als je er niets mee doet. Vijf minuten herhalen op het
                juiste moment is hoe het blijft hangen.
              </p>

              <div className="mt-4 border border-gray-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  De vragen gaan over
                </p>
                <div className="space-y-1">
                  {[...new Map(due.map((d) => [d.topic.id, d])).values()].map((d) => (
                    <button
                      key={d.topic.id}
                      onClick={() => {
                        setHerhaalPopupUitgesteld(true);
                        openTopic(d.topic.id);
                      }}
                      className="w-full text-left text-sm text-gray-800 hover:text-black hover:bg-gray-50 rounded px-2 py-1 flex items-center justify-between"
                    >
                      <span>{d.topic.titel}</span>
                      <span className="text-xs text-gray-400 shrink-0">lees terug →</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => {
                    setHerhaalPopupUitgesteld(true);
                    setHerhalen(true);
                  }}
                  className="flex-1 text-sm font-semibold px-4 py-2.5 rounded-md text-white hover:opacity-90"
                  style={{ backgroundColor: "#F6A923" }}
                >
                  Nu herhalen
                </button>
                <button
                  onClick={() => setHerhaalPopupUitgesteld(true)}
                  className="text-sm font-semibold px-4 py-2.5 rounded-md border border-gray-300 text-gray-600 hover:border-gray-900"
                >
                  Straks
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-2 text-center">
                Straks = na je volgende les komt dit terug.
              </p>
            </div>
          </div>
        )}

      {lesboomHerhaling && (
        <LesboomHerhaalPopup
          key={lesboomHerhaling.domeinId}
          domein={domeinen.find((d) => d.id === lesboomHerhaling.domeinId) || { naam: "" }}
          sessie={lesboomHerhaling.sessie}
          kennis={kennis}
          domeinen={domeinen}
          opAntwoord={noteerAntwoord}
          opKlaar={() => { setActiefDomein(lesboomHerhaling.domeinId); setLesboomHerhaling(null); }}
        />
      )}

      {(
        <InstellingenPaneel
          open={instellingenOpen}
          magBeheren={magBeheren}
          rustig={rustig}
          opWisselRustig={() => setRustig((v) => !v)}
          contrast={contrast} opWisselContrast={()=>setContrast(v=>!v)}
          notificaties={notificaties} opWisselNotificaties={()=>setNotificaties(v=>!v)}
          opBackup={downloadBackup} opImport={leesBackup}
          opSluiten={() => setInstellingenOpen(false)}
          opVoortgangTerugzetten={zetVoortgangTerug}
        />
      )}
      {importVoorstel && <div role="dialog" aria-modal="true" aria-label="Back-up terugzetten" style={{position:"fixed",inset:0,zIndex:90,display:"grid",placeItems:"center",background:"rgba(29,29,29,.3)",padding:20}}><div style={{background:UI.kaart,borderRadius:22,padding:24,maxWidth:430}}><h2 style={{fontSize:17,fontWeight:700}}>Back-up terugzetten?</h2><p style={{fontSize:13.5,margin:"12px 0"}}>Dit vervangt de inhoud en voortgang in deze browser door {importVoorstel.content.domeinen.length} lesbomen en {importVoorstel.content.topics.length} onderwerpen. Download eerst je huidige back-up als je die wilt bewaren.</p><div className="app-actions"><button className="knop" onClick={herstelBackup}>Terugzetten</button><button className="knop2" onClick={()=>setImportVoorstel(null)}>Annuleren</button></div></div></div>}
    </div>
  );
}

export default function Leerplatform() {
  return (
    <Vangnet>
      <LeerplatformApp />
    </Vangnet>
  );
}

