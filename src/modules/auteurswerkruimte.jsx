function Auteurswerkruimte({domeinen,topics,bronnen,auteurs=[],opOpslaan,opSluiten}) {
  const [d,setD]=useState(nieuwAuteursconcept);
  const [stap,setStap]=useState(0), [zoek,setZoek]=useState(''), [naam,setNaam]=useState(''), [tekst,setTekst]=useState(''), [url,setUrl]=useState('');
  const [fout,setFout]=useState(''), [bezig,setBezig]=useState(false), [vuil,setVuil]=useState(false), [test,setTest]=useState(null), [ronde,setRonde]=useState(0);
  const slot=useRef(false), leesSlot=useRef(false), paneel=useRef(null);
  const wijzig=(veld,waarde)=>{setD(v=>({...v,[veld]:waarde}));setVuil(true);};
  const wijzigLes=(id,veld,waarde)=>wijzig('lessen',d.lessen.map(l=>l.id===id?{...l,[veld]:waarde,gecontroleerd:veld==='gecontroleerd'?waarde:false}:l));
  const inhoud={domeinen,topics,bronnen};
  const bibliotheek=[...new Map(Object.values(bronnen).flat().map(b=>[b.id,b])).values()];
  async function bewaar(concept=d,nieuw=inhoud) {
    if(slot.current)return false;
    slot.current=true;setBezig(true);setFout('');
    try {
      const lijst=auteurs.filter(a=>a.id!==concept.id).concat(concept);
      if(await opOpslaan({...nieuw,auteurs:lijst})===false)throw Error('Bewaren is mislukt. Je invoer blijft in dit venster.');
      setD(concept);setVuil(false);return true;
    } catch(e){setFout(e.message);return false;} finally{slot.current=false;setBezig(false);}
  }
  // Ingetypte of geplakte broninvoer staat nog niet in het concept: die telt ook als onbewaard.
  const onbewaard=vuil||!!(naam.trim()||tekst.trim()||url.trim());
  const magVerlaten=()=>!onbewaard||confirm('Niet opgeslagen wijzigingen verlaten?');
  function sluiten(){if(bezig)return;if(!magVerlaten())return;opSluiten();}
  useEffect(()=>{paneel.current?.focus();},[]);
  useEffect(()=>{
    const vak=paneel.current;
    const toetsen=e=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();if(test)setTest(null);else sluiten();}if(e.key==='Tab'){const els=[...vak.querySelectorAll('button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex="0"]')].filter(e=>e.getClientRects().length);const eerste=els[0],laatste=els[els.length-1];if(e.shiftKey&&(document.activeElement===eerste||document.activeElement===vak)){e.preventDefault();laatste?.focus();}else if(!e.shiftKey&&document.activeElement===laatste){e.preventDefault();eerste?.focus();}}};
    window.addEventListener('keydown',toetsen,true);return()=>window.removeEventListener('keydown',toetsen,true);
  },[onbewaard,bezig,test]);
  useEffect(()=>{const vertrek=e=>{if(onbewaard){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',vertrek);return()=>window.removeEventListener('beforeunload',vertrek);},[onbewaard]);
  async function voegBronnenToe(lijst) {
    const nieuw={...bronnen,bibliotheek:[...(bronnen.bibliotheek||[]),...lijst]};
    return bewaar({...d,bronIds:[...new Set([...d.bronIds,...lijst.map(b=>b.id)])]},{...inhoud,bronnen:nieuw});
  }
  async function bestanden(files) {
    if(bezig||leesSlot.current)return;leesSlot.current=true;setBezig(true);setFout('');
    try {
      const lijst=[];
      for(const f of files){
        if(f.size>2*1024*1024)throw Error(`${f.name}: maximaal 2 MB per bestand in deze browserversie. Grotere bestanden vereisen de serveropslag.`);
        const b={id:'bron-'+crypto.randomUUID(),naam:f.name,soort:'bestand',bestandsnaam:f.name,mime:f.type};
        if(/\.(txt|md|csv|json)$/i.test(f.name)) {b.tekst=await f.text();if(!b.tekst.trim())throw Error(`${f.name} bevat geen tekst.`);b.status='leesbaar';b.ingelezenOp=new Date().toISOString();}
        else {b.tekst='';b.status='wacht-op-extractie';b.bestand=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(Error('Bestand lezen mislukt.'));r.readAsDataURL(f);});}
        lijst.push(b);
      }
      if(lijst.length)await voegBronnenToe(lijst);
    }catch(e){setFout(e.message);}finally{leesSlot.current=false;setBezig(false);}
  }
  async function publiceer(){try{const nieuw=publiceerAuteursconcept(d,inhoud);if(!confirm('De geselecteerde gecontroleerde lessen publiceren? Gewijzigde vragen worden opnieuw geleerd.'))return;await bewaar(nieuw.concept,nieuw);}catch(e){setFout(e.message);}}
  const veld={...BRON_VELD_STIJL,width:'100%',boxSizing:'border-box'};
  const lesvelden=l=><><label>Onderwerp<input aria-label={`Onderwerp ${l.id}`} value={l.onderwerp} onChange={e=>wijzigLes(l.id,'onderwerp',e.target.value)} style={veld}/></label><label>Leerdoel<input aria-label={`Leerdoel ${l.id}`} value={l.leerdoel} onChange={e=>wijzigLes(l.id,'leerdoel',e.target.value)} style={veld}/></label><label>Lestitel<input aria-label={`Lestitel ${l.id}`} value={l.titel} onChange={e=>wijzigLes(l.id,'titel',e.target.value)} style={veld}/></label></>;
  return <div ref={paneel} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Auteurswerkruimte" style={{position:'fixed',inset:12,zIndex:90,background:UI.kaart,padding:20,borderRadius:18,display:'flex',flexDirection:'column',gap:12,overflow:'hidden'}}>
    <header className="app-actions"><h2 style={{flex:1,fontSize:20}}>Maak een nieuwe lesboom</h2><button className="knop2" disabled={bezig} onClick={sluiten}>Werkruimte sluiten</button></header>
    <div className="app-actions"><select aria-label="Opgeslagen concept" disabled={bezig} value={auteurs.some(a=>a.id===d.id)?d.id:''} onChange={e=>{if(!magVerlaten())return;setNaam('');setTekst('');setUrl('');setD(JSON.parse(JSON.stringify(auteurs.find(a=>a.id===e.target.value))));setVuil(false);}}><option value="" disabled>Nieuw concept</option>{auteurs.map(a=><option key={a.id} value={a.id}>{a.naam||'Naamloos concept'}</option>)}</select><button className="knop2" disabled={bezig} onClick={()=>{if(!magVerlaten())return;setNaam('');setTekst('');setUrl('');setD(nieuwAuteursconcept());setStap(0);setVuil(false);}}>Nieuw concept</button><button className="knop" disabled={bezig} onClick={()=>bewaar()}>Concept bewaren</button><span role="status">{bezig?'Bezig…':onbewaard?'Niet opgeslagen':auteurs.some(a=>a.id===d.id)?'Opgeslagen':'Nieuw concept'}</span></div>
    <StappenRaat stappen={['Bronnen','Lesboom','Uitwerken','Controleren']} huidige={stap} bereikbaar={3} opKies={setStap}/>
    {fout&&<p role="alert" className="app-alert">{fout}</p>}
    {/* Tijdens opslaan of inlezen staat alle invoer stil; anders zet het afronden een oudere momentopname terug. */}
    <fieldset disabled={bezig} style={{flex:1,minHeight:0,minWidth:0,overflow:'auto',display:'grid',gap:16,border:0,padding:0,margin:0}}>
      {stap===0&&<><BronZoeker bronnen={bibliotheek} zoek={zoek} opZoek={setZoek} selectie={d.bronIds} opSelectie={ids=>wijzig('bronIds',ids)}/><h3>Bronnen toevoegen</h3><div onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();bestanden([...e.dataTransfer.files]);}} style={{padding:16,border:`2px dashed ${UI.randZacht}`}}><label>Bestanden toevoegen of hierheen slepen<input type="file" multiple disabled={bezig} onChange={e=>{bestanden([...e.target.files]);e.target.value='';}}/></label></div><p>TXT, Markdown, CSV en JSON worden lokaal ingelezen. PDF, Office-bestanden en afbeeldingen worden bewaard en wachten op documentverwerking. Maximaal 2 MB per bestand.</p><label>Bronnaam<input aria-label="Bronnaam" value={naam} onChange={e=>setNaam(e.target.value)} style={veld}/></label><label>Tekst plakken<textarea aria-label="Tekst plakken" value={tekst} onChange={e=>setTekst(e.target.value)} rows={5} style={{...veld,height:'auto'}}/></label><button className="knop2" disabled={bezig||!naam.trim()||!tekst.trim()} onClick={async()=>{if(await voegBronnenToe([{id:'bron-'+crypto.randomUUID(),naam:naam.trim(),tekst:tekst.trim(),soort:'tekst',status:'leesbaar',ingelezenOp:new Date().toISOString()}])){setNaam('');setTekst('');}}}>Tekstbron bewaren</button><label>Link<input aria-label="Bronlink" type="url" value={url} onChange={e=>setUrl(e.target.value)} style={veld}/></label><button className="knop2" disabled={bezig||!url.trim()} onClick={async()=>{try{const u=new URL(url);if(!['https:','http:'].includes(u.protocol))throw Error();if(await voegBronnenToe([{id:'bron-'+crypto.randomUUID(),naam:naam.trim()||u.hostname,url:u.href,tekst:'',soort:'link',status:'wacht-op-ophalen'}])){setNaam('');setUrl('');}}catch{setFout('Gebruik een geldige http- of https-link.');}}}>Link bewaren</button></>}
      {stap===1&&<><label>Naam van de lesboom<input aria-label="Naam conceptlesboom" value={d.naam} onChange={e=>wijzig('naam',e.target.value)} style={veld}/></label><button className="knop" disabled>Lesboom voorstellen met AI</button><p role="status">De AI-voorziening is nog niet aangesloten. Je kunt de structuur zelf maken.</p><button className="knop2" onClick={()=>wijzig('lessen',[...d.lessen,nieuweConceptles()])}>Conceptles toevoegen</button>{d.lessen.map((l,i)=><fieldset key={l.id} style={{display:'grid',gap:8}}><legend>Les {i+1}</legend>{lesvelden(l)}<button className="knop2" disabled={i===0} onClick={()=>{const lijst=[...d.lessen];[lijst[i-1],lijst[i]]=[lijst[i],lijst[i-1]];wijzig('lessen',lijst);}}>Les {i+1} omhoog</button></fieldset>)}</>}
      {stap===2&&<><button className="knop" disabled>Geselecteerde lessen uitwerken met AI</button><p role="status">AI is niet aangesloten. Token- en kostenschatting zijn nog niet beschikbaar.</p><button className="knop2" disabled={bezig} onClick={async()=>{try{const ids=d.lessen.filter(l=>l.geselecteerd).map(l=>l.id);if(!ids.length)throw Error('Selecteer minstens één les.');maakAuteursAanvraag(d,bronnen,'lessen',ids);await bewaar({...d,taken:maakAuteursTaken(ids)});}catch(e){setFout(e.message);}}}>Uitwerkopdracht klaarzetten</button>{d.taken.map(t=><p key={t.id}>{d.lessen.find(l=>l.id===t.lesId)?.titel||'Les'} · {t.status==='wacht'?'Wacht op AI-verbinding':t.status}</p>)}{d.lessen.map((l,i)=><fieldset key={l.id} style={{display:'grid',gap:12}}><legend>Les {i+1}: {l.titel||'Naamloos'}</legend><label><input type="checkbox" checked={l.geselecteerd} onChange={e=>wijzigLes(l.id,'geselecteerd',e.target.checked)}/>Selecteren</label><LeesblokkenEditor blokken={l.blokken} opWijzig={v=>wijzigLes(l.id,'blokken',v)}/><ControlevragenEditor vragen={l.vragen} opWijzig={v=>wijzigLes(l.id,'vragen',v)}/></fieldset>)}</>}
      {stap===3&&<>{d.lessen.map((l,i)=><section key={l.id}><h3>{i+1}. {l.titel||'Naamloos'}</h3><p>{l.leerdoel}</p><p>{l.basis?'Bestaande publicatie blijft beschikbaar tot opnieuw publiceren.':'Nog niet gepubliceerd'}</p><label><input type="checkbox" checked={l.geselecteerd} onChange={e=>wijzigLes(l.id,'geselecteerd',e.target.checked)}/>Publiceren</label><button className="knop2" onClick={()=>{setTest(JSON.parse(JSON.stringify(l)));setRonde(r=>r+1);}}>Les testen: {l.titel||i+1}</button><details><summary>Inhoud en vragen bekijken</summary>{l.blokken.map((b,j)=><div key={j}><h4>{b.titel}</h4><p style={{whiteSpace:'pre-wrap'}}>{b.tekst}</p></div>)}<ControlevragenNakijken vragen={l.vragen}/></details><label><input type="checkbox" checked={l.gecontroleerd} onChange={e=>wijzigLes(l.id,'gecontroleerd',e.target.checked)}/>Leerdoel, bronnen, inhoud en antwoorden gecontroleerd</label></section>)}<button className="knop" disabled={bezig||!d.lessen.some(l=>l.geselecteerd)} onClick={publiceer}>Geselecteerde lessen publiceren</button></>}
    </fieldset>
    {test&&<div style={{position:'absolute',inset:0,zIndex:2,background:UI.kaart,display:'flex',flexDirection:'column',padding:16}}><div className="app-actions"><strong>Testmodus</strong><button className="knop2" onClick={()=>setRonde(r=>r+1)}>Test opnieuw</button><button className="knop2" onClick={()=>setTest(null)}>Terug naar concept</button></div><div style={{flex:1,minHeight:0,position:'relative'}}><LesLokaal key={ronde} topic={{titel:test.onderwerp,orbs:[{...test,vragen:test.vragen.map((v,i)=>({...conceptVraagVoorLeerling(v),id:'test-'+i}))}]}} domein={{naam:d.naam}} orbIndex={0} opAfronden={()=>setTest(null)} opAfbreken={()=>setTest(null)}/></div></div>}
  </div>;
}

function BronZoeker({bronnen,zoek,opZoek,selectie,opSelectie}) {
  const resultaten=zoekEigenBronnen(bronnen,zoek);
  return <section aria-label="Eigen bronnen zoeken" style={{display:'grid',gap:12}}>
    <label style={{fontWeight:700}}>Zoek in je eigen bronnen
      <input type="search" aria-label="Zoek in je eigen bronnen" placeholder="Zoek op titel of woorden uit de inhoud" value={zoek} onChange={e=>opZoek(e.target.value)} style={{...BRON_VELD_STIJL,width:'100%',boxSizing:'border-box',marginTop:8}}/>
    </label>
    <p role="status">{resultaten.length} {resultaten.length===1?'bron gevonden':'bronnen gevonden'} · {selectie.length} geselecteerd</p>
    {resultaten.length===0&&<p>{bronnen.length?'Geen bronnen gevonden. Probeer andere zoekwoorden.':'Je bibliotheek is nog leeg.'}</p>}
    <div style={{display:'grid',gap:12,maxHeight:320,overflow:'auto'}}>{resultaten.map(({bron:b,fragment})=><article key={b.id} style={{padding:14,border:`1px solid ${UI.randZacht}`,borderRadius:14}}>
      <label style={{display:'flex',gap:10,alignItems:'baseline',fontWeight:700}}><input type="checkbox" checked={selectie.includes(b.id)} onChange={e=>opSelectie(e.target.checked?[...selectie,b.id]:selectie.filter(id=>id!==b.id))}/>{b.naam}</label>
      <p style={{fontSize:13,marginTop:6,overflowWrap:'anywhere'}}>{fragment}</p>
      <p style={{fontSize:12,color:UI.tekstSecundair,marginTop:6}}>{b.tekst?'Leesbaar':b.status==='wacht-op-ophalen'?'Wacht op ophalen':'Wacht op documentverwerking'} · Ingelezen: {b.ingelezenOp?new Date(b.ingelezenOp).toLocaleString('nl-NL',{timeZone:'Europe/Amsterdam'}):'Nog niet opgehaald'}</p>
      <details><summary>Bron bekijken</summary><p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{b.tekst||'Er is nog geen leesbare inhoud.'}</p></details>
    </article>)}</div>
  </section>;
}
