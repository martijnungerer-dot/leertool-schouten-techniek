// Lokale prototype-route: eigen tekst indelen, nooit AI-uitvoer nabootsen.
const PROGRAMMA_CONCEPT = 'leerplatform-persoonlijk-concept-v1';
function maakLokaleLesopzet(tekst) {
  const bron = tekst.trim();
  if (bron.length < 30 || bron.length > 40000) throw Error('Voeg 30 tot 40.000 tekens lesmateriaal toe.');
  const alineas = bron.split(/\n\s*\n/).filter(t => t.trim());
  const perLes = Math.max(1, Math.ceil(alineas.length / 8));
  const lessen = [];
  for (let i = 0; i < alineas.length; i += perLes) {
    const inhoud = alineas.slice(i, i + perLes).join('\n\n');
    const kop = inhoud.split('\n')[0].replace(/^#+\s*/, '').trim();
    lessen.push({ titel: kop.length <= 80 ? kop : `Les ${lessen.length + 1}`, tekst: inhoud });
  }
  return lessen;
}

function programmaNaarInhoud({ naam, doel, tekst, lessen }, inhoud, maakId = () => crypto.randomUUID()) {
  if (!naam.trim() || !doel.trim() || !lessen.length || lessen.length > 20 ||
      lessen.some(l => !l.titel.trim() || !l.tekst.trim())) throw Error('Geef je programma een naam, leerdoel en complete lessen.');
  const id = 'persoonlijk-' + maakId();
  const bronId = 'bron-' + maakId();
  const nu = new Date().toISOString();
  const topics = [];
  for (const les of lessen) {
    const topicId = 'topic-' + maakId();
    topics.push({ id: topicId, domeinId: id, titel: les.titel.trim(), ondertitel: doel.trim(),
      ...berekenPlaatsing(topics, id, topics.length ? topics[topics.length - 1].id : null),
      orbs: [{ id: 'les-' + maakId(), titel: les.titel.trim(),
        blokken: les.tekst.trim().split(/\n\s*\n/).map(tekst => ({ type: 'tekst', tekst })), vragen: les.vraag ? [{ id: 'vraag-' + maakId(), type: 'meerkeuze', ...les.vraag }] : [],
        bronVerwijzingen: [{ bronId }],
        publicatieAudit: { bronStatus: 'handmatig', redactieStatus: 'eigen-oefenmateriaal', herkomst: les.vraag ? 'ai-voorstel-nagekeken' : 'handmatig', gecontroleerdOp: nu } }],
    });
  }
  return { domeinen: [...inhoud.domeinen, { id, naam: naam.trim(), omschrijving: doel.trim(), kleur: ST.oranje, soort: 'persoonlijk' }],
    topics: [...inhoud.topics, ...topics],
    bronnen: { ...inhoud.bronnen, [id]: [{ id: bronId, naam: naam.trim() + ' — eigen materiaal', tekst, toegevoegdOp: nu }] } };
}

function PersoonlijkProgramma({ domeinen, topics, bronnen, opOpslaan, opSluiten }) {
  const [d, setD] = useState(() => {
    try {
      const v = JSON.parse(window.concept.get(PROGRAMMA_CONCEPT));
      if (v && ['naam', 'doel', 'tekst'].every(k => typeof v[k] === 'string') &&
          Array.isArray(v.lessen) && v.lessen.length <= 20 && v.lessen.every(l => l && typeof l.titel === 'string' && typeof l.tekst === 'string')) return v;
    } catch {}
    return { naam: '', doel: '', tekst: '', lessen: [] };
  });
  const [stap, setStap] = useState(0);
  const opgeslagen = useRef(false);
  const [aiBeschikbaar, setAiBeschikbaar] = useState(false);
  const [aiBezig, setAiBezig] = useState(false);
  const aiAanvraag = useRef(null);
  const [fout, setFout] = useState('');
  const [conceptFout, setConceptFout] = useState(false);
  const [gecontroleerd, setGecontroleerd] = useState(false);
  const [bezig, setBezig] = useState(false);
  const eerste = useRef(null);
  const paneel = useRef(null);
  const sluiten = useRef({ bezig, opSluiten });
  sluiten.current = { bezig: bezig || aiBezig, opSluiten: sluitConcept };
  useEffect(() => {
    const opener = document.activeElement;
    const layout = document.querySelector('.app-layout');
    if (layout) layout.inert = true;
    const toets = e => {
      if (e.key === 'Escape') { e.preventDefault(); if (!sluiten.current.bezig) sluiten.current.opSluiten(); }
      if (e.key !== 'Tab') return;
      const velden = [...paneel.current.querySelectorAll('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),[tabindex="0"]')];
      const eersteVeld = velden[0], laatsteVeld = velden[velden.length - 1];
      if (e.shiftKey && document.activeElement === eersteVeld) { e.preventDefault(); laatsteVeld?.focus(); }
      else if (!e.shiftKey && document.activeElement === laatsteVeld) { e.preventDefault(); eersteVeld?.focus(); }
    };
    const el = paneel.current;
    el.addEventListener('keydown', toets);
    return () => { el.removeEventListener('keydown', toets); if (layout) layout.inert = false; if (opener?.isConnected) opener.focus(); };
  }, []);
  useEffect(() => { eerste.current?.focus(); }, [stap]);
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!opgeslagen.current) window.concept.set(PROGRAMMA_CONCEPT, JSON.stringify(d)).then(() => setConceptFout(false)).catch(() => setConceptFout(true));
    }, 600);
    return () => clearTimeout(timer);
  }, [d]);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/leerplatform/status', {signal: controller.signal}).then(r => r.json()).then(s => { if (!controller.signal.aborted) setAiBeschikbaar(s.beschikbaar === true); }).catch(() => {});
    return () => { controller.abort(); aiAanvraag.current?.abort(); };
  }, []);
  async function sluitConcept() {
    try { await window.concept.set(PROGRAMMA_CONCEPT, JSON.stringify(d)); opSluiten(); }
    catch { setFout('Je concept is niet online bewaard. Houd dit venster open en kopieer je invoer.'); }
  }
  async function maakMetAI() {
    if (aiBezig || !aiBeschikbaar) return;
    if (!d.naam.trim() || !d.doel.trim() || d.tekst.trim().length < 30 || d.tekst.length > 12000) {setFout('Vul naam en leerdoel in en gebruik 30 tot 12.000 tekens bronmateriaal.'); return;}
    const controller = new AbortController(); aiAanvraag.current = controller;
    setAiBezig(true); setFout('');
    try {
      const response = await fetch('/api/leerplatform/ai/programma', {method:'POST',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(65000)]),headers:{'Content-Type':'application/json','X-Leerplatform':'1'},body:JSON.stringify({aanvraagId:crypto.randomUUID(),invoer:{naam:d.naam,doel:d.doel,tekst:d.tekst}})});
      const result = await response.json();
      if (!response.ok) throw Error(result.fout || 'Het maken van lessen is mislukt.');
      if (!controller.signal.aborted) { wijzig('lessen', result.lessen); setStap(2); }
    } catch(e) {if(!controller.signal.aborted) setFout(e.message || 'De aanvraag is gestopt.');}
    finally {if(aiAanvraag.current===controller){aiAanvraag.current=null;setAiBezig(false);}}
  }
  function wijzig(veld, waarde) { setD(v => ({ ...v, [veld]: waarde })); setGecontroleerd(false); }
  function wijzigLes(i, veld, waarde) { wijzig('lessen', d.lessen.map((l, j) => i === j ? { ...l, [veld]: waarde } : l)); }
  function verplaats(i, delta) { const lijst = [...d.lessen]; [lijst[i], lijst[i + delta]] = [lijst[i + delta], lijst[i]]; wijzig('lessen', lijst); }
  async function leesBestand(e) {
    const file = e.target.files?.[0]; e.target.value = ''; if (!file) return;
    setFout('');
    try {
      if (!/\.(txt|md)$/i.test(file.name) || file.size > 200000) throw Error('Kies een TXT- of Markdown-bestand van maximaal 200 kB.');
      const tekst = await file.text();
      if (tekst.length > 40000) throw Error('Gebruik maximaal 40.000 tekens; voeg een hoofdstuk tegelijk toe.');
      wijzig('tekst', tekst); wijzig('lessen', []);
    } catch (e) { setFout(e.message); }
  }
  function volgende() {
    setFout('');
    if (stap === 0 && (d.tekst.trim().length < 30 || d.tekst.length > 40000)) { setFout('Voeg 30 tot 40.000 tekens lesmateriaal toe.'); return; }
    if (stap === 1) {
      if (!d.naam.trim() || !d.doel.trim()) { setFout('Vul een naam en leerdoel in.'); return; }
      if (!d.lessen.length) wijzig('lessen', maakLokaleLesopzet(d.tekst));
    }
    setStap(stap + 1);
  }
  async function opslaan() {
    if (bezig || !gecontroleerd) return;
    setBezig(true); setFout('');
    try {
      const inhoud = programmaNaarInhoud(d, { domeinen, topics, bronnen });
      if (await opOpslaan(inhoud) === false) throw Error('Opslaan is mislukt. Je invoer blijft bewaard in dit venster.');
      opgeslagen.current = true;
      try { await window.concept.remove(PROGRAMMA_CONCEPT); } catch {}
      opSluiten();
    } catch (e) { setFout(e.message); setBezig(false); }
  }
  const veld = { ...BRON_VELD_STIJL, width: '100%', boxSizing: 'border-box' };
  return <div ref={paneel} className="lb-paneel" data-open="ja" role="dialog" aria-modal="true" aria-label="Eigen leerprogramma maken" style={{ position: 'fixed', inset: 12, zIndex: 100, padding: 22, gap: 16 }}>
    <header style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ flex: 1 }}><p style={{ color: UI.tekstSecundair, fontSize: 12 }}>BESLOTEN PILOT · MIJN PROGRAMMA</p><h2 style={{ fontSize: 23 }}>Mijn leerprogramma</h2><p style={{ fontSize: 13 }}>Stap {stap + 1} van 3 · {['Materiaal', 'Leerdoel', 'Lessen controleren'][stap]}</p></div>
      <button className="lb-sluit" aria-label="Leerprogramma sluiten" disabled={bezig || aiBezig} onClick={sluitConcept}>×</button>
    </header>
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {stap === 0 && <>
        <label style={{ display: 'grid', gap: 8 }}>Jouw lesmateriaal<textarea ref={eerste} aria-label="Jouw lesmateriaal" rows={12} maxLength={40000} value={d.tekst} onChange={e => { wijzig('tekst', e.target.value); wijzig('lessen', []); }} style={{ ...veld, height: 'auto', borderRadius: 14, padding: 14 }} /></label>
        <label>Of kies een tekstbestand<input type="file" accept=".txt,.md,text/plain,text/markdown" aria-label="Tekstbestand toevoegen" onChange={leesBestand} style={{ display: 'block', marginTop: 8 }} /></label>
        <p style={{ fontSize: 13, color: UI.tekstSecundair }}>Voeg tekst toe of kies een TXT-/Markdown-bestand. PDF’s en foto’s worden in deze pilot nog niet ingelezen.</p>
      </>}
      {stap === 1 && <>
        <label style={{ display: 'grid', gap: 8 }}>Naam van je programma<input ref={eerste} aria-label="Naam van je programma" disabled={aiBezig} maxLength={100} value={d.naam} onChange={e => wijzig('naam', e.target.value)} style={veld} /></label>
        <label style={{ display: 'grid', gap: 8 }}>Wat wil je kunnen?<textarea aria-label="Wat wil je kunnen?" disabled={aiBezig} rows={4} maxLength={1000} value={d.doel} onChange={e => wijzig('doel', e.target.value)} style={{ ...veld, height: 'auto', borderRadius: 14, padding: 14 }} /></label>
        <p style={{ fontSize: 13, color: UI.tekstSecundair }}>Je programma wordt bij je account bewaard. Alleen als je AI gebruikt, worden bronmateriaal en leerdoel naar OpenAI gestuurd.</p>
      </>}
      {stap === 2 && <>
        <h3 ref={eerste} tabIndex={-1} style={{ fontSize: 19 }}>{d.naam} · {d.lessen.length} lessen</h3>
        <p style={{ fontSize: 13 }}>{d.lessen.some(l=>l.vraag) ? 'AI-voorstel: controleer uitleg, broncitaten en antwoorden voordat je bewaart.' : 'Je eigen tekst, verdeeld in leeslessen. Er zijn nog geen oefenvragen toegevoegd.'}</p>
        {d.lessen.map((l, i) => <section key={i} style={{ border: `1px solid ${UI.randZacht}`, borderRadius: 16, padding: 16, display: 'grid', gap: 10 }}>
          <label>Les {i + 1}<input aria-label={`Titel les ${i + 1}`} value={l.titel} maxLength={100} onChange={e => wijzigLes(i, 'titel', e.target.value)} style={veld} /></label>
          <textarea aria-label={`Tekst les ${i + 1}`} rows={6} maxLength={40000} value={l.tekst} onChange={e => wijzigLes(i, 'tekst', e.target.value)} style={{ ...veld, height: 'auto', borderRadius: 14, padding: 14 }} />
          {l.bronCitaat && <blockquote style={{fontSize:13,borderLeft:`3px solid ${ST.oranje}`,paddingLeft:12}}>Bron: {l.bronCitaat}</blockquote>}
          {l.vraag && <div style={{display:'grid',gap:8}}><strong>{l.vraag.vraag}</strong>{l.vraag.opties.map((o,j)=><p key={j} style={{fontSize:13}}>{String.fromCharCode(65+j)}. {o}{j===l.vraag.juisteIndex?' — juiste antwoord':''}</p>)}<p style={{fontSize:13}}>{l.vraag.uitleg}</p></div>}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button className="knop2" disabled={i === 0} aria-label={`Les ${i + 1} omhoog`} onClick={() => verplaats(i, -1)}>Omhoog</button><button className="knop2" disabled={i === d.lessen.length - 1} aria-label={`Les ${i + 1} omlaag`} onClick={() => verplaats(i, 1)}>Omlaag</button><button className="knop2" disabled={d.lessen.length === 1} aria-label={`Les ${i + 1} verwijderen`} onClick={() => wijzig('lessen', d.lessen.filter((_, j) => j !== i))}>Verwijderen</button></div>
        </section>)}
        <button className="knop2" disabled={d.lessen.length >= 20} onClick={() => wijzig('lessen', [...d.lessen, { titel: '', tekst: '' }])}>Les toevoegen</button>
        <label style={{ display: 'flex', gap: 10 }}><input type="checkbox" checked={gecontroleerd} onChange={e => setGecontroleerd(e.target.checked)} />Ik heb de lessen nagekeken voor mijn eigen oefening.</label>
      </>}
      {fout && <p role="alert" style={{ color: ST.rood }}>{fout}</p>}
      {conceptFout && <p role="alert">Je concept kan niet worden bewaard. Houd dit venster open tot het opslaan is gelukt.</p>}
    </div>
    <footer style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
      {stap===1 && <><button className="knop" disabled={!aiBeschikbaar || aiBezig} onClick={maakMetAI}>{aiBezig?'Lessen worden gemaakt…':'Maak lessen met AI'}</button>{!aiBeschikbaar&&<span style={{fontSize:12}}>AI staat nog uit. Je kunt handmatig verder.</span>}{aiBezig&&<button className="knop2" onClick={()=>{aiAanvraag.current?.abort();setAiBezig(false);}}>Annuleren</button>}</>}
      <button className="knop2" disabled={stap === 0 || bezig || aiBezig} onClick={() => { setFout(''); setStap(stap - 1); }}>Vorige</button>
      {stap < 2 ? <button className="knop2" disabled={aiBezig} onClick={volgende}>{stap === 0 ? 'Naar leerdoel' : 'Handmatig indelen'}</button> : <button className="knop" disabled={!gecontroleerd || bezig} onClick={opslaan}>{bezig ? 'Opslaan…' : 'Bewaren en leren'}</button>}
    </footer>
  </div>;
}
