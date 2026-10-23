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
  // false = geen sessie, true = alles wat aan de beurt is, een lijst = alleen die vragen.
  const [herhalen, setHerhalen] = useState(false);
  // De laatste vraag van die sessie is beantwoord (het eindscherm staat er).
  const [herhaalVragenOp, setHerhaalVragenOp] = useState(false);
  useEffect(() => { setHerhaalVragenOp(false); }, [herhalen]);
  // Laat de app elke minuut en bij terugkeer naar het tabblad opnieuw rekenen,
  // zodat tellers en openingsdagen meelopen terwijl de app open blijft staan.
  const [, setTik] = useState(0);
  useEffect(() => {
    const tik = () => setTik((x) => x + 1);
    const klok = setInterval(tik, 60 * 1000);
    const bijZicht = () => { if (document.visibilityState === "visible") tik(); };
    document.addEventListener("visibilitychange", bijZicht);
    return () => { clearInterval(klok); document.removeEventListener("visibilitychange", bijZicht); };
  }, []);
  const [toonAanmelden, setToonAanmelden] = useState(MAG_VOORBEREIDEN);
  // Welke lesboom op het overzicht is opengelegd (het paneel over het
  // kaartenrooster); null = geen enkele.
  const [actiefDomein, setActiefDomein] = useState(null);
  // De gedwongen herhaling bij het openen van een lesboom: { domeinId, sessie, sterkte }.
  const [lesboomHerhaling, setLesboomHerhaling] = useState(null);
  // Sterkte per onderwerp van vóór die herhaling, zodat de lesboom daarna van de
  // oude naar de nieuwe stand groeit.
  const [sterkteVoorheen, setSterkteVoorheen] = useState(null);
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
        setOpeningsdagen(openingsdagenBijLaden(vg, Date.now()));
        setGeladen(true);
      }
    });
    return () => {
      leeft = false;
    };
  }, []);

  // Blijft de app over middernacht open, dan telt de nieuwe dag ook. Was de dag
  // al geteld, dan geeft voegOpeningsdagToe dezelfde lijst terug: geen wijziging.
  useEffect(() => {
    if (geladen) setOpeningsdagen((d) => voegOpeningsdagToe(d, nu));
  });

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
    setVoortgang((v) => voortgangPassendBijInhoud(v, t));
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
  }

  // Elk antwoord verschuift de vraag in het Leitner-systeem, gerekend vanaf het
  // moment van antwoorden (niet vanaf de laatste keer dat het scherm tekende).
  function noteerAntwoord(vraagId, juist) {
    const moment = Date.now();
    setKennis((k) => verwerkAntwoord(k, vraagId, juist, moment));
  }

  // Een antwoord dat niet meetelt voor het schema: alleen "goed" telt op.
  function noteerBekendAntwoord(vraagId, juist) {
    setKennis((k) => noteerGoedBuitenSchema(k, vraagId, juist));
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
    setSterkteVoorheen(null);
    if (sessie.length > 0) {
      const sterkte = {};
      topics.filter((t) => t.domeinId === domeinId).forEach((t) => { sterkte[t.id] = sterkteVanOnderwerp(t, kennis); });
      setActiefDomein(null);
      setLesboomHerhaling({ domeinId, sessie, sterkte });
      return;
    }
    setActiefDomein(domeinId);
  }

  const topic = actiefTopic ? topics.find((t) => t.id === actiefTopic) : null;
  const domein = topic ? domeinen.find((d) => d.id === topic.domeinId) : null;
  const inLes = topic && domein && actieveOrb !== null;

  const due = vragenDieAanDeBeurtZijn(topics, kennis, nu);
  // Tijdens een herhaling blijven de tellers op de stand van het begin staan;
  // na de laatste vraag springen ze zichtbaar naar wat er over is.
  const sessieActief = (!!herhalen && !herhaalVragenOp) || !!lesboomHerhaling;
  const bevrorenRef = useRef(null);
  if (!sessieActief) bevrorenRef.current = null;
  else if (!bevrorenRef.current) bevrorenRef.current = { due, kennis };
  const teller = bevrorenRef.current || { due, kennis };

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
          aantalDue={teller.due.length}
          herhaalPuls={moetPulseren(teller.due, teller.kennis, openingsdagen)}
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
                key={Array.isArray(herhalen) ? "onderwerp" : "alles"}
                due={Array.isArray(herhalen) ? herhalen : due}
                oefenVragen={oefenbareVragen(topics)}
                kennis={kennis}
                domeinen={domeinen}
                opAntwoord={noteerAntwoord}
                opBekendAntwoord={noteerBekendAntwoord}
                opVragenOp={() => setHerhaalVragenOp(true)}
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
                opHerhalen={(vragen) => setHerhalen(vragen)}
              />
            ) : (
              <Overzicht
                domeinen={geordendeDomeinen}
                topics={topics}
                voortgang={voortgang}
                kennis={kennis}
                due={teller.due}
                pulsKennis={teller.kennis}
                openingsdagen={openingsdagen}
                vastgezet={leerpadVoorkeuren.vastgezet || []}
                eigenVolgorde={leerpadVoorkeuren.handmatig === true}
                opVolgorde={bewaarVolgorde}
                opVastWisselen={wisselVastgezet}
                actiefDomein={actiefDomein}
                sterkteVoorheen={sterkteVoorheen}
                opSterkteGetoond={() => setSterkteVoorheen(null)}
                opDomeinOpen={openLesboom}
                opDomeinSluiten={() => { setActiefDomein(null); setSterkteVoorheen(null); }}
                opOrbStarten={(tid, oi) => {
                  setActiefTopic(tid);
                  setActieveOrb(oi);
                }}
              />
            )}
          </div>
        )}
      </div>

      {lesboomHerhaling && (
        <LesboomHerhaalPopup
          key={lesboomHerhaling.domeinId}
          domein={domeinen.find((d) => d.id === lesboomHerhaling.domeinId) || { naam: "" }}
          sessie={lesboomHerhaling.sessie}
          kennis={kennis}
          domeinen={domeinen}
          opAntwoord={noteerAntwoord}
          opBekendAntwoord={noteerBekendAntwoord}
          opKlaar={() => {
            setSterkteVoorheen(lesboomHerhaling.sterkte);
            setActiefDomein(lesboomHerhaling.domeinId);
            setLesboomHerhaling(null);
          }}
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

