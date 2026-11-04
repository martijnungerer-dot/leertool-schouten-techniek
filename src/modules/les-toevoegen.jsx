// ============================================================================
// STAPPENRAAT — de zeven stappen als honingraat (ontwerp: Beheer honingraat)
//
// De stappen liggen in een zigzag naast elkaar en raken elkaar via een naad.
// Gedaan is groen, de stap waar je bent is wit met een oranje rand die rustig
// ademt, en wat nog komt is zand. Labels staan om en om boven en onder, zodat
// buren elkaar niet raken.
// ============================================================================
const STAPRAAT_HEX =
  "M 21.5 -6.06 Q 25 0 21.5 6.06 L 16 15.59 Q 12.5 21.65 4.8 21.65 L -4.8 21.65 Q -12.5 21.65 -16 15.59 L -21.5 6.06 Q -25 0 -21.5 -6.06 L -16 -15.59 Q -12.5 -21.65 -4.8 -21.65 L 4.8 -21.65 Q 12.5 -21.65 16 -15.59 Z";
const STAPRAAT_DX = 62;
const STAPRAAT_DY = 44;

function StappenRaat({ stappen, huidige, bereikbaar, opKies }) {
  const plek = (i) => ({ x: i * STAPRAAT_DX, y: (i % 2) * STAPRAAT_DY });
  const breedte = (stappen.length - 1) * STAPRAAT_DX + 68;

  return (
    <nav aria-label="Stappen" style={{ flex: "none", overflowX: "auto" }}>
      <svg
        viewBox={`-40 -46 ${breedte + 12} 136`}
        role="group"
        style={{ display: "block", width: "100%", height: "auto", maxWidth: breedte * 1.15, margin: "0 auto" }}
      >
        {stappen.slice(1).map((naam, i) => {
          const van = plek(i), naar = plek(i + 1);
          return (
            <line key={naam} x1={van.x} y1={van.y} x2={naar.x} y2={naar.y} strokeLinecap="round" strokeWidth="2.5"
              stroke={i + 1 <= huidige ? "#9CCBAD" : UI.randZacht} />
          );
        })}
        {stappen.map((naam, i) => {
          const { x, y } = plek(i);
          const gedaan = i < huidige, nu = i === huidige;
          const vrij = i <= bereikbaar;
          const woord = gedaan ? "gedaan" : nu ? "nu aan de beurt" : vrij ? "nog te doen" : "nog niet vrij";
          return (
            <g key={naam} transform={`translate(${x},${y})`}>
              <g
                className={nu ? "lb-adem" : undefined}
                style={{ cursor: vrij ? "pointer" : "default", opacity: vrij ? 1 : 0.55 }}
                tabIndex={vrij ? 0 : -1}
                role="button"
                aria-current={nu ? "step" : undefined}
                aria-label={`Stap ${i + 1} van ${stappen.length}: ${naam}, ${woord}`}
                onClick={() => vrij && opKies(i)}
                onKeyDown={(e) => { if (vrij && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); opKies(i); } }}
              >
                <path d={STAPRAAT_HEX}
                  fill={gedaan ? RAAT_STATUS.af.vulling : nu ? "#FFFFFF" : RAAT_STATUS.later.vulling}
                  stroke={gedaan ? "#9CCBAD" : nu ? ST.oranje : UI.randZacht}
                  strokeWidth={nu ? 2.5 : 2} />
                <text x="0" y="5" textAnchor="middle" fontSize="14" fontWeight="700"
                  fill={gedaan ? UI.succes : nu ? ST.donker : ST.zilver}>{i + 1}</text>
              </g>
              <text x="0" y={i % 2 ? 38 : -30} textAnchor="middle" fontSize="11.5" fontWeight={nu ? 700 : 600}
                fill={vrij ? ST.donker : ST.zilver} style={{ pointerEvents: "none" }}>{naam}</text>
            </g>
          );
        })}
      </svg>
    </nav>
  );
}

// ============================================================================
// LES TOEVOEGEN AAN EEN BESTAAND ONDERWERP
//
// De wizard hiernaast maakt altijd een nieuw onderwerp aan. Voor "er ontbreekt
// nog één les bij dit onderwerp" was dat te veel: dan moest je een onderwerp
// verzinnen dat je niet wilde. Deze vier stappen voegen alleen een les toe en
// laten de bestaande lesboom, volgorde en voortgang ongemoeid (afvinklijst 12).
// ============================================================================
const LES_STAPPEN = ["Plaats", "Lesinhoud", "Vraag", "Nakijken"];

// Lege antwoordvakken vallen weg; het juiste antwoord schuift mee, zodat het
// opgeslagen antwoord hetzelfde blijft als wat bij Nakijken als juist staat.
function zonderLegeOpties(opties, juisteIndex) {
  return {
    opties: opties.filter(Boolean),
    juisteIndex: opties.slice(0, juisteIndex).filter(Boolean).length,
  };
}

// Twee antwoorden die er hetzelfde uitzien, maken een vraag onbeantwoordbaar:
// de lerende kan niet zien welke van de twee "de juiste" is. Lege vakken tellen
// niet mee; die vallen bij publiceren weg.
function heeftDubbeleOpties(opties) {
  const gevuld = opties.map((o) => String(o || "").trim().toLowerCase()).filter(Boolean);
  return new Set(gevuld).size !== gevuld.length;
}

const MIN_VRAGEN = 1, STANDAARD_VRAGEN = 2, MAX_VRAGEN = 3;
function legeControlevraag() { return {vraag:'',opties:['','','',''],juisteIndex:0,uitleg:''}; }
function controleVragenGeldig(vragen) {
  return vragen.length>=MIN_VRAGEN && vragen.length<=MAX_VRAGEN && vragen.every(v=>v.vraag.trim().length>=8 && v.opties.filter(o=>o.trim()).length>=2 && !heeftDubbeleOpties(v.opties) && !!v.opties[v.juisteIndex]?.trim() && v.uitleg.trim().length>=5);
}
function publicatieVragen(vragen) {
  return vragen.map(v=>({...v,id:'vraag-'+crypto.randomUUID(),type:'meerkeuze',vraag:v.vraag.trim(),...zonderLegeOpties(v.opties.map(o=>o.trim()),Number(v.juisteIndex)),uitleg:v.uitleg.trim()}));
}
function ControlevragenEditor({vragen,opWijzig}) {
  const wijzig=(i,veld,waarde)=>opWijzig(vragen.map((v,j)=>i===j?{...v,[veld]:waarde}:v));
  return <div style={{display:'grid',gap:16}}>{vragen.map((v,i)=><fieldset key={i} style={{display:'grid',gap:8}}><legend>Vraag {i+1}</legend><label>Controlevraag<input aria-label={`Controlevraag ${i+1}`} value={v.vraag} onChange={e=>wijzig(i,'vraag',e.target.value)} style={BRON_VELD_STIJL}/></label>{v.opties.map((o,j)=><label key={j} style={{display:'flex',gap:8}}><input type="radio" name={`juist-${i}`} aria-label={`Vraag ${i+1}: antwoord ${VRAAG_LETTERS[j]} is juist`} checked={Number(v.juisteIndex)===j} onChange={()=>wijzig(i,'juisteIndex',j)}/><input aria-label={`Vraag ${i+1}: antwoord ${VRAAG_LETTERS[j]}`} value={o} onChange={e=>wijzig(i,'opties',v.opties.map((x,k)=>k===j?e.target.value:x))} style={BRON_VELD_STIJL}/></label>)}<label>Uitleg na goed en fout antwoord<textarea aria-label={`Uitleg vraag ${i+1}`} value={v.uitleg} onChange={e=>wijzig(i,'uitleg',e.target.value)} style={{...BRON_VELD_STIJL,height:'auto'}}/></label>{heeftDubbeleOpties(v.opties)&&<p role="alert">Maak elk antwoord anders.</p>}<button className="knop2" disabled={vragen.length<=MIN_VRAGEN} onClick={()=>opWijzig(vragen.filter((_,j)=>j!==i))}>Vraag verwijderen</button></fieldset>)}<button className="knop2" disabled={vragen.length>=MAX_VRAGEN} onClick={()=>opWijzig([...vragen,legeControlevraag()])}>Vraag toevoegen</button></div>;
}
function ControlevragenNakijken({vragen}) {
  return <div>{vragen.map((v,i)=><section key={i}><strong>{i+1}. {v.vraag}</strong><ul>{v.opties.map((o,j)=>o.trim()&&<li key={j}>{o}{Number(v.juisteIndex)===j?' · juist':''}</li>)}</ul><p>{v.uitleg}</p></section>)}</div>;
}

function LesToevoegen({ domeinen, topics, bronnen, domeinId, topicId, opOpslaan, opSluiten }) {
  // Kom je binnen vanuit een geopende lesboom of een geopend onderwerp, dan
  // staat de plaats al vast en begin je meteen bij de lesinhoud.
  const [stap, setStap] = useState(domeinId && topicId ? 1 : 0);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState("");
  const [andereLesboom, setAndereLesboom] = useState(false);
  const [d, setD] = useState({
    domeinId: domeinId || "", topicId: topicId || "",
    lestitel: "", les: "", onthoud: "",
    vragen: Array.from({length:STANDAARD_VRAGEN},legeControlevraag),
  });
  const lesboomVast = !!domeinId && !andereLesboom;
  const wijzig = (veld, waarde) => setD((v) => ({ ...v, [veld]: waarde }));

  const gekozenTopics = topics.filter((t) => t.domeinId === d.domeinId);
  const topic = topics.find((t) => t.id === d.topicId);
  const blokken = d.les.trim() ? d.les.trim().split(/\n\s*\n/).map((t) => t.trim()).filter(Boolean) : [];


  const geldig = [
    !!d.domeinId && !!d.topicId,
    d.lestitel.trim().length >= 3 && d.les.trim().length >= 30,
    controleVragenGeldig(d.vragen),
    true,
  ];

  // Een onderwerp is af als elke les die meetelt af is. Een les erbij bij een
  // afgerond onderwerp zet dat onderwerp dus terug op bezig. Dat is juist, maar
  // de lesvoorbereider moet het van tevoren weten.
  const zetVoortgangTerug = !!topic && telbareLessen(topic).length > 0;

  async function publiceer() {
    if (bezig || !geldig.every(Boolean) || !topic) return;
    setBezig(true);
    setFout("");
    const uid = crypto.randomUUID();
    const nieuweOrb = {
      id: "les-" + uid,
      titel: d.lestitel.trim(),
      blokken: blokken.map((tekst, i) => ({
        type: "tekst",
        tekst,
        ...(i === blokken.length - 1 && d.onthoud.trim() ? { onthoud: d.onthoud.trim() } : {}),
      })),
      vragen: publicatieVragen(d.vragen),
      publicatieAudit: { bronStatus: "handmatig", redactieStatus: "handmatig", gecontroleerdOp: new Date().toISOString() },
    };
    const nieuweTopics = topics.map((t) => (t.id === topic.id ? { ...t, orbs: [...t.orbs, nieuweOrb] } : t));
    try {
      if (await opOpslaan({ domeinen, topics: nieuweTopics, bronnen }) === false) {
        throw Error("Opslaan is mislukt. Je invoer staat nog in dit venster.");
      }
      opSluiten();
    } catch (e) {
      setFout(e.message);
    } finally {
      setBezig(false);
    }
  }

  function veld(label, naam, multi = false, hint = "") {
    return (
      <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13.5, fontWeight: 600 }}>
        {label}
        {multi
          ? <textarea aria-label={label} rows={8} value={d[naam]} onChange={(e) => wijzig(naam, e.target.value)}
              style={{ fontFamily: "inherit", fontSize: 13.5, fontWeight: 400, lineHeight: 1.55, padding: "10px 14px", borderRadius: 14, border: `1px solid ${UI.randZacht}`, resize: "vertical" }} />
          : <input aria-label={label} value={d[naam]} onChange={(e) => wijzig(naam, e.target.value)}
              style={{ ...BRON_VELD_STIJL, fontFamily: "inherit", fontSize: 13.5, fontWeight: 400, padding: "0 14px" }} />}
        {hint && <span style={{ fontSize: 12, fontWeight: 400, color: UI.tekstSecundair }}>{hint}</span>}
      </label>
    );
  }

  return (
    <div className="lb-paneel" data-open="ja" style={{ padding: 22, gap: 16 }}>
      <header style={{ display: "flex", gap: 12, alignItems: "flex-start", flex: "none" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: ST.zilver, margin: 0 }}>
            Les toevoegen · stap {stap + 1} van {LES_STAPPEN.length}
          </p>
          <h2 style={{ fontSize: 19, fontWeight: 700, margin: "4px 0 0" }}>{LES_STAPPEN[stap]}</h2>
        </div>
        <button type="button" className="lb-sluit kaart-sluit" aria-label="Les toevoegen sluiten" onClick={opSluiten}>✕</button>
      </header>

      <StappenRaat
        stappen={LES_STAPPEN}
        huidige={stap}
        bereikbaar={LES_STAPPEN.reduce((tot, _, i) => (i === 0 || geldig.slice(0, i).every(Boolean) ? i : tot), 0)}
        opKies={setStap}
      />

      <div style={{ flex: "1 1 0%", minHeight: 0, overflow: "auto", padding: 20, borderRadius: 18, background: UI.kaartZacht, border: `1px solid ${UI.randZacht}`, display: "flex", flexDirection: "column", gap: 16 }}>
        {stap === 0 && (
          <>
            {lesboomVast ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>Lesboom</span>
                <span style={{ fontSize: 13.5 }}>{(domeinen.find((x) => x.id === d.domeinId) || {}).naam}</span>
                <button type="button" className="lb-chrome" onClick={() => setAndereLesboom(true)}>Andere lesboom</button>
              </div>
            ) : (
              <label style={{ fontSize: 13.5, fontWeight: 600, display: "flex", flexDirection: "column", gap: 6 }}>
                Lesboom
                <select aria-label="Lesboom" value={d.domeinId} onChange={(e) => { wijzig("domeinId", e.target.value); wijzig("topicId", ""); }}
                  style={{ ...BRON_VELD_STIJL, fontFamily: "inherit", fontSize: 13.5, fontWeight: 400, padding: "0 12px" }}>
                  <option value="">Kies een lesboom</option>
                  {domeinen.map((dom) => <option key={dom.id} value={dom.id}>{dom.naam}</option>)}
                </select>
              </label>
            )}
            <label style={{ fontSize: 13.5, fontWeight: 600, display: "flex", flexDirection: "column", gap: 6 }}>
              Onderwerp
              <select aria-label="Onderwerp" value={d.topicId} disabled={!d.domeinId} onChange={(e) => wijzig("topicId", e.target.value)}
                style={{ ...BRON_VELD_STIJL, fontFamily: "inherit", fontSize: 13.5, fontWeight: 400, padding: "0 12px" }}>
                <option value="">Kies een onderwerp</option>
                {gekozenTopics.map((t) => (
                  <option key={t.id} value={t.id}>{t.titel} ({t.orbs.length} {t.orbs.length === 1 ? "les" : "lessen"})</option>
                ))}
              </select>
            </label>
            {d.domeinId && gekozenTopics.length === 0 && (
              <p style={{ fontSize: 12.5, color: UI.tekstSecundair, margin: 0 }}>
                Deze lesboom heeft nog geen onderwerpen. Maak er eerst één met 'Onderwerp toevoegen'.
              </p>
            )}
            {topic && (
              <div style={{ background: UI.kaart, border: `1px solid ${UI.randZacht}`, borderRadius: 14, padding: "12px 14px" }}>
                <p style={{ margin: 0, fontSize: 12.5, color: UI.tekstSecundair }}>De nieuwe les komt achteraan in dit onderwerp:</p>
                <ol style={{ margin: "8px 0 0", paddingLeft: 20, fontSize: 13 }}>
                  {topic.orbs.map((o) => <li key={o.id} style={{ marginTop: 3 }}>{o.titel}{o.concept ? " (lesopzet)" : ""}</li>)}
                  <li style={{ marginTop: 3, fontWeight: 700, color: "#B87B12" }}>{d.lestitel.trim() || "je nieuwe les"}</li>
                </ol>
              </div>
            )}
          </>
        )}

        {stap === 1 && (
          <>
            {veld("Titel van de les", "lestitel")}
            {veld("Lesinhoud", "les", true, "Een lege regel begint een nieuw leesblok. Schrijf minstens dertig tekens.")}
            {veld("Onthoud dit (optioneel)", "onthoud", false, "Eén zin die de lerende moet onthouden. Komt onder het laatste leesblok.")}
          </>
        )}

        {stap === 2 && <ControlevragenEditor vragen={d.vragen} opWijzig={v=>wijzig("vragen",v)}/>}

        {stap === 3 && (
          <>
            <p style={{ margin: 0, fontSize: 12.5, color: UI.tekstSecundair }}>
              {(domeinen.find((x) => x.id === d.domeinId) || {}).naam} › {topic ? topic.titel : ""}
            </p>
            <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>{d.lestitel}</h3>
            {blokken.map((tekst, i) => <p key={i} style={{ fontSize: 13.5, whiteSpace: "pre-wrap", maxWidth: "64ch", margin: 0, lineHeight: 1.55 }}>{tekst}</p>)}
            {d.onthoud.trim() && <OnthoudKader tekst={d.onthoud.trim()} />}
            <ControlevragenNakijken vragen={d.vragen}/>
            {zetVoortgangTerug && (
              <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, background: "#FDEED3", border: `1px solid ${ST.oranje}`, borderRadius: 14, padding: "10px 14px" }}>
                Dit onderwerp was compleet en komt na publiceren weer op 'bezig' te staan.
              </p>
            )}
          </>
        )}

        {fout && <p role="alert" className="app-alert">{fout}</p>}
      </div>

      <footer className="app-actions">
        <button type="button" className="knop2" disabled={stap === 0 || bezig} onClick={() => setStap((v) => v - 1)}>Vorige</button>
        {stap < LES_STAPPEN.length - 1
          ? <button type="button" className="knop" disabled={!geldig[stap]} onClick={() => setStap((v) => v + 1)}>Volgende</button>
          : <button type="button" className="knop" disabled={bezig || !geldig.every(Boolean)} onClick={publiceer}>Les publiceren</button>}
        <button type="button" className="knop2" onClick={opSluiten}>Annuleren</button>
      </footer>
    </div>
  );
}

const WIZARD_STAPPEN=['Onderwerp','Leerdoel','Bronnen','Structuur','Lesinhoud','Vragen','Publiceren'];
function HandmatigeWizard({domeinen,topics,bronnen,domeinId,opOpslaan,opSluiten}) {
  const [stap,setStap]=useState(0);
  const [fout,setFout]=useState('');
  const [bezig,setBezig]=useState(false);
  const [d,setD]=useState({domeinId:domeinId||'',naam:'',omschrijving:'',titel:'',leerdoel:'',bronIds:[],voorganger:'',lestitel:'',les:'',vragen:Array.from({length:STANDAARD_VRAGEN},legeControlevraag)});
  const wijzig=(veld,waarde)=>setD(v=>({...v,[veld]:waarde}));
  const huidigeBronnen=bronnen[d.domeinId]||[];
  const geldig=[!!(d.domeinId||d.naam.trim().length>=2)&&d.titel.trim().length>=3,d.leerdoel.trim().length>=10,d.bronIds.length>0 || huidigeBronnen.length===0,true,d.lestitel.trim().length>=3&&d.les.trim().length>=30,controleVragenGeldig(d.vragen)];
  async function publiceer() {
    if(bezig || !geldig.every(Boolean)) return;
    setBezig(true);setFout('');
    const uid=crypto.randomUUID(); const domId=d.domeinId||'domein-'+uid;
    const plaats=berekenPlaatsing(topics,domId,d.voorganger||null);
    const nieuw={id:'topic-'+uid,domeinId:domId,...plaats,titel:d.titel.trim(),ondertitel:d.leerdoel.trim(),orbs:[{id:'les-'+uid,titel:d.lestitel.trim(),blokken:d.les.trim().split(/\n\s*\n/).map(tekst=>({type:'tekst',tekst:tekst.trim()})),vragen:publicatieVragen(d.vragen),bronVerwijzingen:d.bronIds.map(bronId=>({bronId})),publicatieAudit:{bronStatus:'handmatig',redactieStatus:'handmatig',gecontroleerdOp:new Date().toISOString()}}]};
    const ds=d.domeinId?domeinen:[...domeinen,{id:domId,naam:d.naam.trim(),omschrijving:d.omschrijving.trim(),kleur:ST.oranje}];
    try {if(await opOpslaan({domeinen:ds,topics:[...topics,nieuw],bronnen})===false) throw Error('Opslaan is mislukt. Je invoer staat nog in dit venster.');opSluiten();}catch(e){setFout(e.message);}finally{setBezig(false);}
  }
  function veld(label,naam,multi=false) {return <label style={{display:'flex',flexDirection:'column',gap:6,fontSize:13.5,fontWeight:600}}>{label}{multi?<textarea aria-label={label} value={d[naam]} onChange={e=>wijzig(naam,e.target.value)} rows={naam==='les'?9:3} style={{...BRON_VELD_STIJL,height:'auto',borderRadius:14,padding:14,lineHeight:1.55}}/>:<input aria-label={label} value={d[naam]} onChange={e=>wijzig(naam,e.target.value)} style={BRON_VELD_STIJL}/>}</label>}
  return <div className="lb-paneel" data-open="ja" style={{padding:22,gap:16}}>
    <header style={{display:'flex',gap:12,alignItems:'center',flex:'none'}}><div style={{flex:1}}><p style={{fontSize:11,color:UI.tekstSecundair}}>HANDMATIG OPBOUWEN · STAP {stap+1} VAN 7</p><h2 style={{fontSize:23,fontWeight:700}}>{d.titel||'Nieuwe lesboom'}</h2></div><button className="lb-sluit" aria-label="Wizard sluiten" disabled={bezig} onClick={opSluiten}>×</button></header>
    <StappenRaat stappen={WIZARD_STAPPEN} huidige={stap} bereikbaar={WIZARD_STAPPEN.reduce((tot,_,i)=>(i===0||geldig.slice(0,i).every(Boolean)?i:tot),0)} opKies={setStap} />
    <div className="app-columns">
      <div style={{flex:'1 1 0%',minWidth:0,overflow:'auto',padding:20,borderRadius:18,background:UI.kaartZacht,border:`1px solid ${UI.randZacht}`,display:'flex',flexDirection:'column',gap:16}}>
        {stap===0&&<><label style={{fontSize:13.5}}>Lesboom<select aria-label="Lesboom" value={d.domeinId} onChange={e=>{wijzig('domeinId',e.target.value);wijzig('voorganger','');wijzig('bronIds',[]);}} style={BRON_VELD_STIJL}><option value="">Nieuwe lesboom</option>{domeinen.map(dom=><option key={dom.id} value={dom.id}>{dom.naam}</option>)}</select></label>{!d.domeinId&&<>{veld('Naam van de lesboom','naam')}{veld('Omschrijving','omschrijving')}</>}{veld('Naam van het onderwerp','titel')}</>}
        {stap===1&&<>{veld('Wat kan de lerende na deze les?','leerdoel',true)}<p style={{fontSize:12,color:UI.tekstSecundair}}>Formuleer een concreet leerdoel in minstens tien tekens.</p></>}
        {stap===2&&<><h3 style={{fontSize:17,fontWeight:700}}>Bronnen bij deze les</h3>{huidigeBronnen.length?huidigeBronnen.map(b=><label key={b.id} style={ORB_RIJ_STIJL(null)}><input type="checkbox" checked={d.bronIds.includes(b.id)} onChange={e=>wijzig('bronIds',e.target.checked?[...d.bronIds,b.id]:d.bronIds.filter(id=>id!==b.id))}/><span style={{fontSize:13.5}}>{b.naam}</span></label>):<p style={{fontSize:13,color:UI.tekstSecundair}}>Er zijn nog geen bronnen gekoppeld. Je kunt deze les handmatig invoeren; je blijft zelf verantwoordelijk voor de inhoudelijke controle. Bronnen voeg je toe via het tabblad Bronnen.</p>}</>}
        {stap===3&&<><h3 style={{fontSize:17,fontWeight:700}}>Plaats in de lesboom</h3><label style={{fontSize:13.5}}>Welk onderwerp komt eerst?<select aria-label="Voorgaand onderwerp" style={BRON_VELD_STIJL} value={d.voorganger} onChange={e=>wijzig('voorganger',e.target.value)}><option value="">Geen — dit is een startonderwerp</option>{topics.filter(t=>t.domeinId===d.domeinId).map(t=><option key={t.id} value={t.id}>{t.titel}</option>)}</select></label><p style={{fontSize:13,color:UI.tekstSecundair}}>Deze invoer maakt één onderwerp met één les. Via de lesboom kun je later meer onderwerpen toevoegen en de les bewerken.</p></>}
        {stap===4&&<>{veld('Titel van de les','lestitel')}{veld('Lesinhoud','les',true)}<p style={{fontSize:12,color:UI.tekstSecundair}}>Een lege regel begint een nieuw leesblok. Schrijf minstens dertig tekens.</p></>}
        {stap===5&&<ControlevragenEditor vragen={d.vragen} opWijzig={v=>wijzig('vragen',v)}/>}
        {stap===6&&<><h3 style={{fontSize:17,fontWeight:700}}>Nakijken en publiceren</h3><strong>{d.lestitel}</strong><p style={{fontSize:13.5,whiteSpace:'pre-wrap',maxWidth:'64ch'}}>{d.les}</p><ControlevragenNakijken vragen={d.vragen}/><p style={{fontSize:12}}>Met publiceren bevestig je dat je de les en de antwoorden zelf hebt gecontroleerd.</p></>}
        {fout&&<p role="alert" className="app-alert">{fout}</p>}
      </div>
      <aside className="app-sidebar" style={{padding:18,background:UI.kaartZacht,border:`1px solid ${UI.randZacht}`,borderRadius:18,overflow:'auto'}}><h3 style={{fontSize:17,fontWeight:700}}>{WIZARD_STAPPEN[stap]}</h3><p style={{fontSize:12,color:UI.tekstSecundair,marginTop:12}}>Sluit deze wizard pas wanneer je klaar bent; nog niet gepubliceerde invoer wordt niet bewaard.</p></aside>
    </div>
    <footer className="app-actions"><button className="knop2" disabled={stap===0||bezig} onClick={()=>setStap(s=>s-1)}>Vorige</button>{stap<6?<button className="knop" disabled={!geldig[stap]} onClick={()=>setStap(s=>s+1)}>Volgende</button>:<button className="knop" disabled={bezig||!geldig.every(Boolean)} onClick={publiceer}>{bezig?'Opslaan…':'Publiceer les'}</button>}</footer>
  </div>;
}

// Lokaal beheer staat na de opschoning in leerplatform.jsx.

// Het "Onthoud dit"-kader uit de ontwerpschermen: de kern van een leesblok,
// apart gezet zodat je die later terugvindt zonder het blok te herlezen.
function OnthoudKader({ tekst }) {
  return (
    <div style={{ marginTop: 16, background: UI.achtergrond, border: `1px solid ${UI.randZacht}`, borderRadius: 14, padding: "13px 16px" }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: ST.zilver }}>
        Onthoud dit
      </div>
      <div style={{ fontSize: 13.5, marginTop: 6, maxWidth: "60ch", lineHeight: 1.55 }}>{tekst}</div>
    </div>
  );
}

// AI-hulp bij een stuk lestekst dat de lerende zelf heeft geselecteerd.
// De koppeling met een AI-dienst staat bewust uit: er wordt niets verstuurd en
// er worden geen antwoorden verzonnen. Het paneel laat wel precies zien welke
// tekst straks als context zou meegaan, en maakt duidelijk dat een antwoord de
// les nooit zelf verandert (afvinklijst 7).
function AiHulpPaneel({ citaat, opCitaatWeg, opSluiten }) {
  return (
    <div style={{ flex: "none", marginTop: 14, background: UI.kaart, border: `1px solid ${ST.oranje}`, borderRadius: 14, padding: "13px 15px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: ST.zilver }}>
          {citaat ? "AI-hulp bij je selectie" : "AI-hulp"}
        </div>
        <button type="button" className="lb-sluit" aria-label="AI-hulp sluiten" style={{ marginLeft: "auto", width: 24, height: 24, fontSize: 12 }} onClick={opSluiten}>✕</button>
      </div>

      {citaat && (
        <div style={{ display: "flex", gap: 9, marginTop: 9, padding: "9px 12px", background: UI.kaartZacht, border: `1px solid ${UI.randZacht}`, borderRadius: 12 }}>
          <span style={{ flex: "none", width: 3, borderRadius: 999, background: ST.oranje }} />
          <span style={{ flex: "1 1 0%", minWidth: 0, fontSize: 12.5, lineHeight: 1.45, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{citaat}</span>
          <button type="button" className="lb-sluit" aria-label="Selectie losmaken" style={{ width: 20, height: 20, fontSize: 10 }} onClick={opCitaatWeg}>✕</button>
        </div>
      )}

      <p role="status" style={{ margin: "10px 0 0", fontSize: 12.5, color: UI.tekstSecundair }}>
        AI-hulp is nog niet beschikbaar.
      </p>
    </div>
  );
}

function LesLokaal({topic,domein,orbIndex,opAfronden,opAfbreken,opVraagBeantwoord}) {
  const les=topic.orbs[orbIndex];
  const stappen=[...(les?.blokken||[]).map(blok=>({blok})),...(les?.vragen||[]).filter(vraagIsHeel).map(vraag=>({vraag}))];
  const [index,setIndex]=useState(0);
  const [bereikt,setBereikt]=useState(0);
  const [antwoorden,setAntwoorden]=useState({});
  const [gekozen,setGekozen]=useState(null);
  const [poging,setPoging]=useState(0);
  const geteld=useRef(new Set());
  const leesRef=useRef(null);
  const [selectie,setSelectie]=useState(null);   // {tekst,x,y} van de zwevende pil
  const [citaat,setCitaat]=useState(null);       // de tekst waar hulp bij gevraagd is
  const [aiOpen,setAiOpen]=useState(false);
  const stap=stappen[index];
  const correct=stap?.vraag ? antwoorden[stap.vraag.id] === true : true;
  // Ook een les zonder bruikbare stappen moet af te ronden zijn, anders komt het onderwerp niet verder.
  const laatst=index>=stappen.length-1;
  useEffect(()=>{
    const key=e=>{
      if(e.key!=='Escape'||e.defaultPrevented) return;
      e.preventDefault();
      if(selectie) {setSelectie(null);return;}
      if(aiOpen) {setAiOpen(false);setCitaat(null);return;}
      opAfbreken();
    };
    window.addEventListener('keydown',key);return ()=>window.removeEventListener('keydown',key);
  },[opAfbreken,selectie,aiOpen]);

  // Een selectie in de lestekst laat een pil verschijnen waarmee je om hulp
  // vraagt. Alleen selecties binnen het leesgebied tellen (afvinklijst 7).
  useEffect(()=>{
    function bijSelectie() {
      const gebied=leesRef.current;
      if(!gebied) return;
      const sel=window.getSelection();
      if(!sel||sel.isCollapsed||sel.rangeCount===0) {setSelectie(null);return;}
      const bereik=sel.getRangeAt(0);
      if(!gebied.contains(bereik.commonAncestorContainer)) {setSelectie(null);return;}
      const tekst=sel.toString().trim();
      if(tekst.length<3) {setSelectie(null);return;}
      const vak=bereik.getBoundingClientRect(), basis=gebied.getBoundingClientRect();
      setSelectie({
        tekst,
        x: vak.left-basis.left+vak.width/2+gebied.scrollLeft,
        y: vak.bottom-basis.top+8+gebied.scrollTop,
      });
    }
    document.addEventListener('selectionchange',bijSelectie);
    return ()=>document.removeEventListener('selectionchange',bijSelectie);
  },[]);
  function antwoord(goed){
    setAntwoorden(v=>({...v,[stap.vraag.id]:goed}));
    if(!geteld.current.has(stap.vraag.id)) {geteld.current.add(stap.vraag.id);opVraagBeantwoord?.(stap.vraag.id,goed);}
  }
  function ga(i){if(i<0||i>=stappen.length||i>bereikt+1||(i>bereikt&&!correct))return;setIndex(i);setBereikt(v=>Math.max(v,i));setGekozen(null);setPoging(0);setSelectie(null);if(leesRef.current)leesRef.current.scrollTop=0;}
  function verder(){if(!correct)return;if(laatst){if(les.concept)opAfbreken();else opAfronden();}else ga(index+1);}
  return <section style={KAART_STIJL}>
    <header className="app-card-head" style={{display:'flex',gap:12,alignItems:'flex-start',flex:'none'}}><div style={{flex:1,minWidth:0}}><p style={{fontSize:11,color:UI.tekstSecundair}}>{domein.naam} · {topic.titel} · les {orbIndex+1}</p><h1 style={{fontSize:23,fontWeight:700,letterSpacing:'-.02em'}}>{les?.titel||'Les ontbreekt'}</h1><p style={{fontSize:12.5,color:UI.tekstSecundair}}>{les?.concept?'Lesopzet uit het ontwerp · nog uit te werken':`${les?.blokken?.length||0} leesblokken · ${les?.vragen?.length||0} vragen`}</p></div><span style={{fontSize:12,whiteSpace:'nowrap'}}>blok {stap?index+1:0} van {stappen.length}</span><button className="lb-sluit" aria-label="Les sluiten" onClick={opAfbreken}>×</button></header>
    <div className="app-columns">
      <div style={{flex:'1 1 0%',minWidth:0,background:UI.kaartZacht,border:`1px solid ${UI.randZacht}`,borderRadius:18,padding:20,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        <div id="leesgebied" ref={leesRef} style={{flex:'1 1 0%',minHeight:0,overflow:'auto',position:'relative'}}>
          {!stap?<p>Deze les bevat nog geen inhoud.</p>:stap.blok?<div style={{maxWidth:'64ch'}}>
            {stap.blok.titel&&<h2 style={{fontSize:17,fontWeight:700,margin:'0 0 9px'}}>{stap.blok.titel}</h2>}
            <Blok blok={stap.blok} kleur={ST.oranje}/>
            {stap.blok.onthoud&&<OnthoudKader tekst={stap.blok.onthoud}/>}
            {les.begrippen?.length>0&&<div style={{marginTop:18,padding:14,border:`1px solid ${UI.randZacht}`,borderRadius:14}}><strong>Begrippen</strong>{les.begrippen.map((b,i)=><p key={i} style={{fontSize:13,marginTop:8}}><strong>{b.term}</strong> — {b.uitleg}</p>)}</div>}
          </div>:<div style={{maxWidth:'60ch'}}><h2 style={{fontSize:17,fontWeight:700,marginBottom:14}}>{stap.vraag.vraag}</h2>{correct&&gekozen===null?<p style={{color:UI.succes,fontSize:13.5}}>Deze vraag heb je goed beantwoord.</p>:<Vraag key={`${stap.vraag.id}-${poging}`} vraag={stap.vraag} gekozen={gekozen} setGekozen={setGekozen} opAntwoord={antwoord}/>}{gekozen!==null&&<div style={{fontSize:13.5,marginTop:12}}><strong style={{color:correct?UI.succes:ST.rood}}>{correct?'Goed. ':'Nog niet juist. '}</strong>{stap.vraag.uitleg}{!correct&&<button className="knop2" style={{marginTop:12,display:'block'}} onClick={()=>{setGekozen(null);setPoging(p=>p+1);}}>Probeer opnieuw</button>}</div>}</div>}
          {selectie&&(
            <button type="button" className="lb-selpil" style={{left:selectie.x,top:selectie.y}}
              onClick={()=>{setAiOpen(true);setCitaat(selectie.tekst);setSelectie(null);}}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={ST.oranje} strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
                <path d="M12 3v4M12 17v4M4.5 12h4M15.5 12h4M6.9 6.9l2.8 2.8M14.3 14.3l2.8 2.8M17.1 6.9l-2.8 2.8M9.7 14.3l-2.8 2.8"/>
              </svg>
              Vraag het de AI
            </button>
          )}
        </div>
        {aiOpen&&<AiHulpPaneel citaat={citaat} opCitaatWeg={()=>setCitaat(null)} opSluiten={()=>{setAiOpen(false);setCitaat(null);}}/>}
        <footer className="app-actions"><button className="knop2" disabled={index===0} onClick={()=>ga(index-1)}>Vorige</button>{(stap||stappen.length===0)&&<button className="knop" disabled={!correct} onClick={verder}>{laatst?(les.concept?'Terug naar onderwerp':'Les afronden'):'Volgende'}</button>}<button type="button" className="knop2" style={{marginLeft:'auto',display:'inline-flex',alignItems:'center',gap:7}} aria-expanded={aiOpen} onClick={()=>setAiOpen(v=>!v)}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={ST.oranje} strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M12 3v4M12 17v4M4.5 12h4M15.5 12h4M6.9 6.9l2.8 2.8M14.3 14.3l2.8 2.8M17.1 6.9l-2.8 2.8M9.7 14.3l-2.8 2.8"/></svg>Vraag het de AI</button></footer>
      </div>
      <aside className="app-sidebar" style={{padding:16,background:UI.kaartZacht,border:`1px solid ${UI.randZacht}`,borderRadius:18,display:'flex',flexDirection:'column',overflow:'hidden'}}><h2 style={{fontSize:17,fontWeight:700}}>In deze les</h2><div style={{flex:1,minHeight:0,overflow:'auto',display:'flex',flexDirection:'column',gap:7,marginTop:12}}>{stappen.map((s,i)=><button key={i} className="lb-lesrij" aria-current={i===index?'step':undefined} disabled={i>bereikt} onClick={()=>ga(i)} style={{...ORB_RIJ_STIJL(i===index?'bezig':i<index?'af':'later'),padding:'10px 12px',textAlign:'left'}}><OrbMerk status={i===index?'bezig':i<index?'af':'later'}/><span style={{fontSize:13,flex:1}}>{s.vraag?`Vraag ${stappen.slice(0,i+1).filter(x=>x.vraag).length}`:s.blok?.titel||`Leesblok ${i+1}`}</span></button>)}</div></aside>
    </div>
  </section>;
}
