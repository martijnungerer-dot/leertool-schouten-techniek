// ============================================================================
// LEERPADVOLGORDE — persoonlijke voorkeur van de gebruiker
//
// Puur en defensief: beschadigde of ontbrekende voorkeuren vallen altijd
// terug op de originele domeinvolgorde. Handmatig gesorteerd wint van
// gebruikssortering; zonder enig gebruik blijft de originele volgorde staan.
// ============================================================================
function normaliseerVoorkeuren(v) {
  if (!v || typeof v !== "object") return { volgorde: [], gebruik: {}, handmatig: false, vastgezet: [] };
  return {
    volgorde: Array.isArray(v.volgorde) ? v.volgorde.filter((id) => typeof id === "string") : [],
    gebruik: v.gebruik && typeof v.gebruik === "object" ? v.gebruik : {},
    handmatig: v.handmatig === true,
    vastgezet: Array.isArray(v.vastgezet) ? v.vastgezet.filter((id) => typeof id === "string") : [],
  };
}

function bepaalGeordendeDomeinen(domeinen, voorkeuren) {
  try {
    const vk = normaliseerVoorkeuren(voorkeuren);

    if (vk.handmatig) {
      // ongeldige opgeslagen id's verwijderen, ontbrekende domeinen achteraan
      const geldig = vk.volgorde.filter((id) => domeinen.some((d) => d.id === id));
      const rest = domeinen.filter((d) => !geldig.includes(d.id));
      return [...geldig.map((id) => domeinen.find((d) => d.id === id)), ...rest];
    }

    const ooitGebruikt = domeinen.some((d) => {
      const g = vk.gebruik[d.id];
      return g && g.openingen > 0;
    });
    if (!ooitGebruikt) return domeinen; // niets gebruikt: originele volgorde

    const origineleIndex = new Map(domeinen.map((d, i) => [d.id, i]));
    return [...domeinen].sort((a, b) => {
      const ga = vk.gebruik[a.id] || { openingen: 0, laatstGebruikt: 0 };
      const gb = vk.gebruik[b.id] || { openingen: 0, laatstGebruikt: 0 };
      if ((gb.openingen || 0) !== (ga.openingen || 0)) return (gb.openingen || 0) - (ga.openingen || 0);
      if ((gb.laatstGebruikt || 0) !== (ga.laatstGebruikt || 0)) return (gb.laatstGebruikt || 0) - (ga.laatstGebruikt || 0);
      return origineleIndex.get(a.id) - origineleIndex.get(b.id); // stabiele tie-breaker
    });
  } catch {
    return domeinen; // beschadigde voorkeuren: nooit crashen
  }
}

// Lokale lesvoorbereiding: dezelfde lesbomen als aan de leerkant, met echte opslag.
function BeheerLokaal({auteurs,domeinen, topics, bronnen, vastgezet, eigenVolgorde, opVolgorde, opVastWisselen, opOpslaan}) {
  const [auteursOpen,setAuteursOpen]=useState(false);
  const [tab, setTab] = useState('lesbomen');
  const [actiefId, setActiefId] = useState(null);
  const [topicId, setTopicId] = useState(null);
  const [wizard, setWizard] = useState(false);
  const [lesWizard, setLesWizard] = useState(false);
  const [sortering, setSortering] = useState('eigen');
  const actief = domeinen.find(d=>d.id===actiefId);
  const topic = topics.find(t=>t.id===topicId);
  const lijst = sorteerBeheerLesbomen(domeinen.map(d=>beheerLesboomInfo(d,topics)),sortering,vastgezet);
  const magSlepen = sortering === 'eigen';
  const {kaartProps, verschuif} = useSleepVolgorde(lijst, magSlepen, opVolgorde);
  useEffect(()=>{
    const escape=e=>{
      if(e.key!=='Escape' || e.defaultPrevented || auteursOpen) return;
      e.preventDefault();
      if(lesWizard) setLesWizard(false); else if(wizard) setWizard(false); else if(topicId) setTopicId(null); else setActiefId(null);
    };
    window.addEventListener('keydown',escape);
    return ()=>window.removeEventListener('keydown',escape);
  },[wizard,lesWizard,topicId,auteursOpen]);
  function wisselTab(naam) {setTab(naam);setActiefId(null);setTopicId(null);setWizard(false);setLesWizard(false);}
  return <section className="app-content beheer-lokaal">
    {auteursOpen&&<Auteurswerkruimte domeinen={domeinen} topics={topics} bronnen={bronnen} auteurs={auteurs} opOpslaan={opOpslaan} opSluiten={()=>setAuteursOpen(false)}/>}
    <div style={KAART_STIJL}>
      <header className="app-card-head" style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:14,flex:'none'}}>
        <div><h1 style={{fontSize:23,fontWeight:700,letterSpacing:'-.02em',margin:0}}>{BEHEER_NAAM}</h1><p style={{fontSize:12.5,color:UI.tekstSecundair,marginTop:3}}>{domeinen.length} lesbomen · {topics.length} onderwerpen</p></div>
        <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
          <button className="knop" onClick={()=>setAuteursOpen(true)}>Maak een lesboom uit bronnen</button>
          {tab==='lesbomen' && topics.length>0 && <button type="button" className="lb-chrome" onClick={()=>setLesWizard(true)}>+ Les toevoegen</button>}
          {tab==='lesbomen' && <SorteerMenu opties={BEHEER_SORTERINGEN.map(o=>o.id==='eigen'&&eigenVolgorde?{...o,label:'Mijn volgorde'}:o)} waarde={sortering} opKies={setSortering} />}
          <div role="tablist" aria-label={BEHEER_NAAM} style={{display:'flex',gap:4,padding:4,borderRadius:999,background:UI.kaartZacht,border:`1px solid ${UI.randZacht}`}}>
            {['lesbomen','bronnen'].map(t=><button key={t} role="tab" aria-selected={tab===t} className="lb-chrome" data-actief={tab===t?'ja':'nee'} onClick={()=>wisselTab(t)}>{t==='lesbomen'?'Lesbomen':'Bronnen'}</button>)}
          </div>
        </div>
      </header>
      <div style={{flex:'1 1 0%',minHeight:0,overflow:'auto'}}>
        {tab==='bronnen' ? <BronBeheer key={actiefId || 'alle'} domeinen={domeinen} topics={topics} bronnen={bronnen} opOpslaan={opOpslaan} startDomeinId={actiefId} /> :
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(min(238px,100%),1fr))',gap:12}}>
          {lijst.map((lb,i)=>{
            const vast = (vastgezet||[]).includes(lb.domein.id);
            return <div key={lb.domein.id} className="lb-kaartje" data-vullend="ja" {...kaartProps(lb.domein.id)}>
              <button type="button" className="lb-kaart-hoofd" aria-label={`${lb.domein.naam}, ${lb.totaal} onderwerpen${vast?', vastgezet':''}`}
                onClick={()=>setActiefId(lb.domein.id)}
                onKeyDown={e=>{
                  if(!e.ctrlKey||(e.key!=='ArrowLeft'&&e.key!=='ArrowRight')) return;
                  e.preventDefault();
                  verschuif(i, e.key==='ArrowLeft'?-1:1);
                }}>
                <div style={{display:'flex',alignItems:'center',gap:8,paddingRight:26}}><span style={{width:11,height:11,borderRadius:999,background:lb.domein.kleur,flex:'none'}}/><strong style={{fontSize:14.5,flex:'1 1 auto',overflowWrap:'break-word'}}>{lb.domein.naam}</strong><span style={BEHEER_PIL_STIJL(lb.pil)}>{BEHEER_PIL_LABEL[lb.pil]}</span></div>
                <p style={{fontSize:12,color:UI.tekstSecundair,minHeight:36,margin:0}}>{lb.domein.omschrijving}</p>
                <MiniRaat raat={lb.raat}/><span style={{fontSize:12,color:UI.tekstSecundair}}>{lb.totaal} onderwerpen · {lb.aantalLessen} lessen</span>
              </button>
              <KaartSpeld naam={lb.domein.naam} vast={vast} opWisselen={()=>opVastWisselen(lb.domein.id)} />
            </div>;
          })}
          <button className="lb-kaartje" style={{minHeight:190,borderStyle:'dashed',justifyContent:'center'}} onClick={()=>{setActiefId(null);setWizard(true);}}><span style={{fontSize:25,color:ST.oranje}}>+</span><strong>Maak een nieuwe lesboom</strong><span style={{fontSize:12,color:UI.tekstSecundair}}>Werk je bronmateriaal uit in zeven stappen.</span></button>
        </div>}
      </div>
    </div>
    {actief && tab==='lesbomen' && !wizard && <div className="lb-paneel" data-open="ja" style={{padding:22,gap:16}}>
      <header style={{display:'flex',gap:12,flex:'none',alignItems:'center'}}><div style={{flex:1}}><p style={{fontSize:11,color:UI.tekstSecundair}}>LESBOMEN › {actief.naam}</p><h2 style={{fontSize:23,fontWeight:700}}>{actief.naam}</h2><p style={{fontSize:13,color:UI.tekstSecundair}}>{actief.omschrijving}</p></div><button className="lb-sluit" aria-label="Lesboom sluiten" onClick={()=>{setActiefId(null);setTopicId(null);}}>×</button></header>
      <div className="app-columns">
        <div style={{flex:'1 1 0%',minWidth:0,overflow:'auto',background:UI.kaartZacht,border:`1px solid ${UI.randZacht}`,borderRadius:18,padding:18}}>
          {topic ? <><button className="knop2" onClick={()=>setTopicId(null)}>‹ Onderwerpen</button><h3 style={{fontSize:17,fontWeight:700,margin:'16px 0'}}>{topic.titel}</h3><BestaandeOrbsBeheer topic={topic} domeinen={domeinen} topics={topics} bronnen={bronnen} opOpslaan={opOpslaan}/></> :
          <><MiniRaat raat={beheerLesboomInfo(actief,topics).raat}/><div style={{display:'flex',flexDirection:'column',gap:8,marginTop:16}}>{topics.filter(t=>t.domeinId===actiefId).map(t=><button key={t.id} className="lb-lesrij" style={ORB_RIJ_STIJL(null)} onClick={()=>setTopicId(t.id)}><span style={{flex:1,textAlign:'left',fontWeight:700,fontSize:13.5}}>{t.titel}</span><span style={{fontSize:12}}>{t.orbs.length} lessen</span></button>)}</div></>}
        </div>
        <aside className="app-sidebar" style={{background:UI.kaartZacht,border:`1px solid ${UI.randZacht}`,borderRadius:18,padding:18,display:'flex',flexDirection:'column',gap:12,overflow:'auto'}}><h3 style={{fontSize:17,fontWeight:700}}>Deze lesboom beheren</h3><p style={{fontSize:13,color:UI.tekstSecundair}}>{(bronnen[actiefId]||[]).length} {(bronnen[actiefId]||[]).length===1?'bron':'bronnen'}</p><button className="knop" onClick={()=>setLesWizard(true)}>Les toevoegen</button><button className="knop2" onClick={()=>setWizard(true)}>Onderwerp toevoegen</button><button className="knop2" onClick={()=>{setTab('bronnen');setTopicId(null);}}>Bronnen bekijken</button></aside>
      </div>
    </div>}
    {wizard && <HandmatigeWizard domeinen={domeinen} topics={topics} bronnen={bronnen} domeinId={actiefId} opOpslaan={opOpslaan} opSluiten={()=>setWizard(false)}/>}
    {lesWizard && <LesToevoegen domeinen={domeinen} topics={topics} bronnen={bronnen} domeinId={actiefId||''} topicId={topicId||''} opOpslaan={opOpslaan} opSluiten={()=>setLesWizard(false)}/>}
  </section>;
}


