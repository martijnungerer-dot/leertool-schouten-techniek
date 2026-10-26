// ============================================================================
// OVERZICHT — de lesboomkaarten (herontwerp §8)
//
// Elke lesboom (domein) is een kaartje met zijn eigen raat in het klein. Klik
// legt de volledige raat van die lesboom over het rooster. Sorteren is een
// zuivere weergavekeuze (niet opgeslagen); "waar je mee bezig bent" is de
// volgorde die de aanroeper al meegeeft via bepaalGeordendeDomeinen.
//
// Welke lesboom open staat (`actiefDomein`) leeft in LeerplatformApp, niet
// hier: de chromerij erboven moet ‹ Lesbomen en de actieve pillnaam kunnen
// tonen zodra dat scherm boven élk leerscherm komt te staan (opdracht 4).
// ============================================================================
// Het sorteermenu uit de ontwerpschermen: een pil die een lijstje opent. Zowel
// het lesbomenoverzicht als de lesvoorbereiding gebruikt hem, zodat sorteren
// zich aan beide kanten hetzelfde gedraagt.
function SorteerMenu({ opties, waarde, opKies }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function bijToets(e) { if (e.key === "Escape") { e.stopPropagation(); setOpen(false); } }
    window.addEventListener("keydown", bijToets, true);
    return () => window.removeEventListener("keydown", bijToets, true);
  }, [open]);

  const huidig = opties.find((o) => o.id === waarde) || opties[0];
  return (
    <div style={{ position: "relative", flex: "none" }}>
      <button type="button" className="lb-chrome" aria-haspopup="true" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={UI.tekstSecundair} strokeWidth="2.75" strokeLinecap="round" aria-hidden="true">
          <path d="M4 7h13M4 12h9M4 17h5" />
        </svg>
        <span className="lb-chrome-bijschrift" style={{ color: UI.tekstSecundair, fontWeight: 600 }}>Sorteer op</span>
        <span>{huidig.label}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={ST.zilver} strokeWidth="3" strokeLinecap="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div role="menu" style={{ position: "absolute", top: 40, right: 0, zIndex: 60, minWidth: 216, padding: 6, background: "#FFFFFF", border: `1px solid ${UI.randZacht}`, borderRadius: 16, boxShadow: "0 8px 24px rgba(29,29,29,.12)" }}>
          {opties.map((o) => (
            <button key={o.id} type="button" role="menuitemradio" aria-checked={waarde === o.id} className="lb-sortopt"
              style={waarde === o.id ? { fontWeight: 700 } : undefined}
              onClick={() => { opKies(o.id); setOpen(false); }}>
              <span>{o.label}</span>
              <span style={{ color: ST.oranje, fontWeight: 700, visibility: waarde === o.id ? "visible" : "hidden" }}>✓</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Overzicht({ domeinen, topics, voortgang, kennis, due = [], pulsKennis = kennis, openingsdagen = [], vastgezet, eigenVolgorde, opVolgorde, opVastWisselen, actiefDomein, sterkteVoorheen = null, opSterkteGetoond, opDomeinOpen, opDomeinSluiten, opOrbStarten }) {
  const [sortering, setSortering] = useState("gebruik");

  const lesbomen = domeinen.map((d) => verrijkLesboom(d, topics, voortgang));
  const getoond = sorteerLesbomen(lesbomen, sortering, vastgezet);
  const actief = actiefDomein ? lesbomen.find((l) => l.domein.id === actiefDomein) : null;

  // Gaat een lesboom dicht, dan gaat de focus terug naar zijn kaart.
  const vorigActief = useRef(actiefDomein);
  useEffect(() => {
    const was = vorigActief.current;
    vorigActief.current = actiefDomein;
    if (was && !actiefDomein) {
      const kaart = document.querySelector(`.lb-kaart-hoofd[data-domein="${CSS.escape(was)}"]`);
      if (kaart) kaart.focus({ preventScroll: true });
    }
  }, [actiefDomein]);

  // Slepen schrijft je eigen volgorde. Dat kan alleen in de eigen volgorde:
  // bij sorteren op naam of voortgang zou je een volgorde vastleggen die je
  // niet ziet.
  const magSlepen = sortering === "gebruik";
  const { kaartProps, verschuif } = useSleepVolgorde(getoond, magSlepen, opVolgorde);

  return (
    <>
      <div
        style={{
          position: "absolute", inset: 0,
          background: UI.kaart, border: `1px solid ${UI.randZacht}`, borderRadius: 22,
          boxShadow: "0 1px 3px rgba(29,29,29,.06)",
          padding: "20px 22px 22px", boxSizing: "border-box",
          display: "flex", flexDirection: "column", gap: 14, overflow: "hidden",
        }}
      >
        <div style={{ flex: "none", display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, flexWrap: "nowrap" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 23, fontWeight: 700, lineHeight: 1.15, color: ST.donker }}>Jouw lesbomen</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flex: "none" }}>
            {lesbomen.length > 0 && (
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: ST.zilver, whiteSpace: "nowrap" }}>
                {lesbomen.length} {lesbomen.length === 1 ? "lesboom" : "lesbomen"}
              </div>
            )}
            {lesbomen.length > 1 && (
              <SorteerMenu
                opties={LESBOOM_SORTERINGEN.map((o) => (o.id === "gebruik" && eigenVolgorde ? { ...o, label: "Mijn volgorde" } : o))}
                waarde={sortering}
                opKies={setSortering}
              />
            )}
          </div>
        </div>

        <div style={{ flex: "1 1 0%", minHeight: 0, overflow: "hidden auto", margin: "0 -4px", padding: "0 4px" }}>
          {lesbomen.length === 0 && (
            <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
              <svg width="96" height="108" viewBox="-42 -46 84 92" aria-hidden="true" style={{ display: "block" }}>
                <path d={RAAT_HEX_PAD} fill="none" stroke={UI.padNeutraal} strokeWidth="3" strokeDasharray="7 6" />
              </svg>
              <span style={{ fontSize: 15, fontWeight: 700, color: UI.tekstSecundair }}>Nog geen lesbomen</span>
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(238px, 1fr))", gap: 12 }}>
            {getoond.map((lb, i) => {
              const vast = vastgezet.includes(lb.domein.id);
              const leeg = lb.totaal === 0;
              const dueHier = due.filter((d) => d.topic.domeinId === lb.domein.id);
              return (
                <div
                  key={lb.domein.id}
                  className="lb-kaartje"
                  data-vullend="ja"
                  data-leeg={leeg ? "ja" : "nee"}
                  {...kaartProps(lb.domein.id)}
                >
                  <button
                    type="button"
                    className="lb-kaart-hoofd"
                    data-domein={lb.domein.id}
                    aria-label={`${lb.domein.naam}, ${leeg ? "nog geen onderwerpen" : `${lb.klaar} van ${lb.totaal} onderwerpen afgerond`}${vast ? ", vastgezet" : ""}${dueHier.length > 0 ? `, ${dueHier.length} ${dueHier.length === 1 ? "vraag" : "vragen"} aan de beurt` : ""}`}
                    onClick={() => opDomeinOpen(lb.domein.id)}
                    onKeyDown={(e) => {
                      if (!e.ctrlKey || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
                      e.preventDefault();
                      verschuif(i, e.key === "ArrowLeft" ? -1 : 1);
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "nowrap", paddingRight: 26 }}>
                      <span style={{ width: 11, height: 11, borderRadius: 999, flex: "none", background: lb.domein.kleur, opacity: leeg ? 0.6 : 1 }} />
                      <span style={{ fontSize: 14.5, fontWeight: 700, lineHeight: 1.2, flex: "1 1 auto", overflowWrap: "break-word" }}>{lb.domein.naam}</span>
                      <HerhaalTeller aantal={dueHier.length} puls={moetPulseren(dueHier, pulsKennis, openingsdagen)} />
                    </div>
                    <div style={{ fontSize: 12, lineHeight: 1.5, color: UI.tekstSecundair }}>{lb.domein.omschrijving}</div>
                    {leeg ? (
                      <div style={{ height: 62, display: "flex", alignItems: "center", fontSize: 12, color: ST.zilver }}>
                        Nog geen onderwerpen
                      </div>
                    ) : (
                      <MiniRaat raat={lb.raat} />
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, fontSize: 11.5, fontWeight: 700, color: UI.tekstSecundair, flexWrap: "nowrap" }}>
                      <span style={{ whiteSpace: "nowrap" }}>{lb.klaar} van {lb.totaal} onderwerpen</span>
                      <span style={{ whiteSpace: "nowrap", color: leeg ? ST.zilver : "#1D1D1D" }}>{lb.pct}%</span>
                    </div>
                  </button>
                  <KaartSpeld naam={lb.domein.naam} vast={vast} opWisselen={() => opVastWisselen(lb.domein.id)} />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="lb-paneel" data-open={actief ? "ja" : "nee"} aria-hidden={!actief}>
        {actief && (
          <LesboomDetail
            key={actief.domein.id}
            domein={actief.domein}
            domeinTopics={actief.domeinTopics}
            raat={actief.raat}
            klaar={actief.klaar}
            totaal={actief.totaal}
            pct={actief.pct}
            voortgang={voortgang}
            kennis={kennis}
            sterkteVoorheen={sterkteVoorheen}
            opSterkteGetoond={opSterkteGetoond}
            opSluiten={opDomeinSluiten}
            opOrbStarten={opOrbStarten}
          />
        )}
      </div>
    </>
  );
}

// Gedeelde vormgeving voor de "kaart" van elk leerscherm (Onderwerp, Les,
// Herhalen): witte kaart die het beschikbare vlak vult, zelf overflow:hidden
// zodat alleen de eigen werkgebied/paneel-kolommen intern scrollen.
const KAART_STIJL = {
  position: "absolute", inset: 0, background: "#FFFFFF", border: `1px solid ${UI.randZacht}`, borderRadius: 22,
  boxShadow: "0 1px 3px rgba(29,29,29,.06)", padding: "20px 22px 22px", boxSizing: "border-box",
  display: "flex", flexDirection: "column", gap: 14, overflow: "hidden",
};

// Statusmerk + statuspil, gedeeld door de lessenlijst (Onderwerp) en de
// blokkenlijst (Les) — dezelfde vier tekens als spec §9: groen vinkje,
// oranje ring, witte ring, streepje.
function OrbMerk({ status }) {
  if (status === "af") {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: 999, flex: "none", background: "#E8F4EC", border: "1px solid #9CCBAD", color: "#2E7D4F", fontSize: 12, fontWeight: 700 }}>✓</span>
    );
  }
  if (status === "bezig") {
    return <span style={{ width: 22, height: 22, borderRadius: 999, flex: "none", background: "#FDEED3", border: "2px solid #F6A923", boxSizing: "border-box" }} />;
  }
  if (status === "leeg") {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: 999, flex: "none", background: "#FBF8F2", border: `1px solid ${UI.randZacht}`, color: ST.zilver, fontSize: 12, fontWeight: 700 }}>–</span>
    );
  }
  return <span style={{ width: 22, height: 22, borderRadius: 999, flex: "none", background: "#FFFFFF", border: `1px solid ${UI.randZacht}`, boxSizing: "border-box" }} />;
}

function ORB_RIJ_STIJL(status) {
  const basis = { display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderRadius: 14, textAlign: "left", width: "100%", boxSizing: "border-box" };
  if (status === "af") return { ...basis, background: "#E8F4EC", border: "1px solid #9CCBAD" };
  if (status === "bezig") return { ...basis, background: "#FFFFFF", border: "2px solid #F6A923" };
  if (status === "leeg") return { ...basis, background: "#FBF8F2", border: `1px solid ${UI.randZacht}`, color: UI.tekstSecundair, cursor: "default" };
  return { ...basis, background: "#FFFFFF", border: `1px solid ${UI.randZacht}` };
}
const ORB_PIL_LABEL = { af: "af", bezig: "bezig", later: "nieuw", leeg: "leeg" };

// "bezig" is de eerste les die meetelt en nog niet af is: daar ga je verder.
function lesStatus(topic, orb, voortgang) {
  if (lesIsLeeg(orb)) return "leeg";
  if (lesIsAf(voortgang, topic.id, orb.id)) return "af";
  const volgende = telbareLessen(topic).find((o) => !lesIsAf(voortgang, topic.id, o.id));
  return volgende && volgende.id === orb.id ? "bezig" : "later";
}

function onderwerpSubregel(gedaan, totaal) {
  if (totaal === 0) return "Nog geen lessen.";
  if (gedaan === 0) return "Je bent nog niet begonnen.";
  if (gedaan >= totaal) return "Je rondde ze allemaal af.";
  return `Je rondde er ${gedaan} van de ${totaal} af.`;
}

function orbRegel(orb, status, kennis) {
  if (status === "leeg") return "Onvolledig — nog geen inhoud.";
  const orbBlokken = Array.isArray(orb.blokken) ? orb.blokken : [];
  const orbVragen = Array.isArray(orb.vragen) ? orb.vragen : [];
  const meta = `${orbBlokken.length} ${orbBlokken.length === 1 ? "blok" : "blokken"} · ${orbVragen.length} ${orbVragen.length === 1 ? "vraag" : "vragen"}`;
  if (status === "af") {
    const sterkte = geheugensterkte(orb, kennis);
    const woord = sterkte >= 4 ? "zit erin" : sterkte >= 2 ? "wordt sterker" : "zakt weg";
    return `Afgerond · ${woord}`;
  }
  return status === "bezig" ? `Nu aan de beurt · ${meta}` : `Nog niet gestart · ${meta}`;
}

function plaatsTekst(vorige, volgende) {
  const v = vorige[0], n = volgende[0];
  if (!v && !n) return "Startpunt van dit leerpad.";
  if (v && n) return `Na ${v.titel}. Hierna opent ${n.titel}.`;
  if (v) return `Na ${v.titel}.`;
  return `Hierna opent ${n.titel}.`;
}

