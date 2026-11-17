// Zelfstandige feedbacklogica; geen Schouten-tokens, app-opslag of netwerk.
const FEEDBACK_FORMAAT = 1;
const FEEDBACK_TYPES = ['Opmerking', 'Aanpassing', 'Vraag'];
function feedbackWoordGeldig(woord) {
  return typeof woord === 'string' && /^[\p{L}\p{M}]+(?:[-’'][\p{L}\p{M}]+)*$/u.test(woord.trim()) && woord.trim().length <= 40;
}
function feedbackControleer(melding) {
  if (!FEEDBACK_TYPES.includes(melding.type)) throw Error('Kies een type feedback.');
  if (!feedbackWoordGeldig(melding.woord)) throw Error('Gebruik één herkenningswoord van maximaal 40 letters.');
  if (typeof melding.tekst !== 'string' || !melding.tekst.trim()) throw Error('Vul je feedbacktekst in.');
}
function feedbackId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}
// Eén sleutel per ID: gelijktijdige tabbladen overschrijven elkaars lijst niet.
// Dezelfde ID opnieuw opslaan is idempotent, ook na een onzekere adapterfout.
function maakFeedbackOpslag(haalOpslag, naamruimte) {
  function list() {
    const opslag = haalOpslag();
    const meldingen = [];
    for (let i = 0; i < opslag.length; i++) {
      const sleutel = opslag.key(i);
      if (!sleutel?.startsWith(naamruimte + ':')) continue;
      const melding = JSON.parse(opslag.getItem(sleutel));
      feedbackControleer(melding);
      if (typeof melding.id !== 'string' || sleutel !== naamruimte + ':' + melding.id || !Number.isFinite(Date.parse(melding.tijdstip)) || !melding.context) {
        throw Error('Een bewaarde feedbackmelding is niet leesbaar.');
      }
      meldingen.push(melding);
    }
    return meldingen.sort((a, b) => b.tijdstip.localeCompare(a.tijdstip) || b.id.localeCompare(a.id));
  }
  function save(melding) {
    feedbackControleer(melding);
    const opslag = haalOpslag();
    const sleutel = naamruimte + ':' + melding.id;
    const bestaand = opslag.getItem(sleutel);
    if (bestaand !== null) return JSON.parse(bestaand);
    opslag.setItem(sleutel, JSON.stringify(melding));
    return melding;
  }
  return { list, save };
}
function feedbackExport(meldingen, nu = new Date()) {
  return { formaatversie: FEEDBACK_FORMAAT, geexporteerdOp: nu.toISOString(), meldingen };
}
// Beschrijf alleen het soort onderdeel; nooit textContent, veldwaarden of resultaten.
function feedbackOnderdeel(element) {
  if (!element) return 'Algemeen';
  if (element.closest('input,textarea,select,[contenteditable="true"]')) return 'Invoer';
  if (element.closest('[data-feedback-antwoord] button')) return 'Antwoord';
  if (element.closest('button,[role="button"]')) return 'Knop';
  if (element.closest('a')) return 'Link';
  if (element.closest('h1,h2,h3,h4,h5,h6')) return 'Titel';
  if (element.closest('img,svg')) return 'Afbeelding';
  if (element.closest('p,article,[data-feedback-uitleg]')) return 'Uitleg';
  return 'Algemeen';
}
function feedbackRechthoek(x1, y1, x2, y2) {
  return { x: Math.min(x1, x2), y: Math.min(y1, y2), breedte: Math.abs(x2 - x1), hoogte: Math.abs(y2 - y1) };
}
function FeedbackModule({ opslag, getContext, potlood, privacytekst }) {
  const [meldingen, setMeldingen] = useState([]);
  const [leesFout, setLeesFout] = useState('');
  const [modus, setModus] = useState(null);
  const [concept, setConcept] = useState(null);
  const [detail, setDetail] = useState(null);
  const [fout, setFout] = useState('');
  const [bezig, setBezig] = useState(false);
  const [vak, setVak] = useState(null);
  const dialoogRef = useRef(null);
  const markeerRef = useRef(null);
  const startRef = useRef(null);
  const terugRef = useRef(null);
  const bezigRef = useRef(false);
  const bedieningRef = useRef({});
  const potloodRef = useRef(null);

  async function ververs() {
    try { setMeldingen(await opslag.list()); setLeesFout(''); }
    catch { setLeesFout('Feedback kon niet worden gelezen. Probeer opnieuw; bestaande meldingen worden niet gewist.'); }
  }
  useEffect(() => {
    ververs();
    window.addEventListener('storage', ververs);
    return () => window.removeEventListener('storage', ververs);
  }, [opslag]);
  function sluit() {
    setModus(null); setConcept(null); setDetail(null); setVak(null); setFout(''); startRef.current = null;
    requestAnimationFrame(() => (terugRef.current?.isConnected ? terugRef.current : potloodRef.current)?.focus());
  }
  // Deze luisteraar wordt vóór de leerschermen gemonteerd. Escape sluit alleen
  // feedback; de les of instellingen eronder blijven precies waar ze waren.
  bedieningRef.current = { modus, sluit, conceptId: concept?.id };
  useEffect(() => {
    function toets(e) {
      if (!bedieningRef.current.modus) return;
      e.stopImmediatePropagation();
      if (e.key === 'Escape') { e.preventDefault(); bedieningRef.current.sluit(); return; }
      if (e.key === 'Tab') {
        const root = dialoogRef.current?.open ? dialoogRef.current : markeerRef.current;
        const velden = Array.from(root?.querySelectorAll('button:not(:disabled),input,textarea,select,[tabindex="0"]') || []);
        const eerste = velden[0], laatste = velden[velden.length - 1];
        if (e.shiftKey && (document.activeElement === eerste || !root?.contains(document.activeElement))) { e.preventDefault(); laatste?.focus(); }
        else if (!e.shiftKey && (document.activeElement === laatste || !root?.contains(document.activeElement))) { e.preventDefault(); eerste?.focus(); }
      }
    }
    window.addEventListener('keydown', toets, true);
    return () => window.removeEventListener('keydown', toets, true);
  }, []);
  useEffect(() => {
    if (modus === 'formulier' || modus === 'detail') dialoogRef.current?.showModal();
    else if (modus === 'markeren') markeerRef.current?.querySelector('button')?.focus();
  }, [modus]);
  function begin(markeren) {
    terugRef.current = document.activeElement;
    setFout(''); setDetail(null); setVak(null);
    const nieuw = { id: feedbackId(), type: 'Opmerking', woord: 'Algemeen', tekst: '', context: getContext(), markering: null };
    setConcept(nieuw); setModus(markeren ? 'markeren' : 'formulier');
  }
  function zonderMarkering() { setVak(null); setModus('formulier'); }
  function onderPunt(x, y) {
    // Tijdelijk alleen de eigen selectielaag buiten de hit-test houden.
    const laag = markeerRef.current;
    laag.style.display = 'none';
    const element = document.elementFromPoint(x, y);
    laag.style.display = '';
    return element?.closest('[data-feedback-ui]') ? null : element;
  }
  function pointerStart(e) {
    if (e.button !== 0 || startRef.current) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    startRef.current = { x: e.clientX, y: e.clientY, id: e.pointerId, element: onderPunt(e.clientX, e.clientY) };
    setVak(feedbackRechthoek(e.clientX, e.clientY, e.clientX, e.clientY));
  }
  function pointerEinde(e) {
    const start = startRef.current;
    if (!start || start.id !== e.pointerId) return;
    startRef.current = null;
    const element = start.element;
    let rect = feedbackRechthoek(start.x, start.y, e.clientX, e.clientY);
    const getikt = rect.breedte < 8 && rect.hoogte < 8;
    if (getikt && !element) { setVak(null); return; }
    if (getikt) {
      const target = element.closest('button,a,input,textarea,select,h1,h2,h3,p') || element;
      const r = target.getBoundingClientRect();
      rect = feedbackRechthoek(Math.max(0, r.left), Math.max(0, r.top), Math.min(innerWidth, r.right), Math.min(innerHeight, r.bottom));
    }
    const woord = getikt ? feedbackOnderdeel(element) : 'Algemeen';
    const markering = { rechthoek: rect, schermformaat: { breedte: innerWidth, hoogte: innerHeight }, beschrijving: getikt ? woord : 'Geselecteerd schermgebied' };
    setVak(rect);
    setConcept(c => ({ ...c, woord, context: getContext(element), markering }));
    setModus('formulier');
  }
  async function bewaar(e) {
    e.preventDefault();
    if (bezigRef.current) return;
    let melding;
    try {
      feedbackControleer(concept);
      melding = { ...concept, woord: concept.woord.trim(), tekst: concept.tekst.trim(), tijdstip: concept.tijdstip || new Date().toISOString() };
    } catch (err) { setFout(err.message); return; }
    setConcept(melding); bezigRef.current = true; setBezig(true); setFout('');
    try {
      const bewaard = await opslag.save(melding);
      setMeldingen(oud => [bewaard, ...oud.filter(m => m.id !== bewaard.id)]);
      if (bedieningRef.current.conceptId === melding.id) sluit();
      await ververs();
    } catch {
      if (bedieningRef.current.conceptId === melding.id) setFout('Opslaan is niet gelukt. Je tekst blijft staan. Maak ruimte vrij of sta browseropslag toe en probeer opnieuw.');
    }
    finally { bezigRef.current = false; setBezig(false); }
  }
  async function download() {
    try {
      const alle = await opslag.list();
      const exportData = feedbackExport(alle);
      const url = URL.createObjectURL(new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json;charset=utf-8' }));
      const a = document.createElement('a'); a.href = url;
      a.download = `feedback-${exportData.geexporteerdOp.slice(0, 10)}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setLeesFout('');
    } catch { setLeesFout('Downloaden is niet gelukt. Je lokale feedback blijft bewaard. Probeer opnieuw.'); }
  }
  function toon(melding) { terugRef.current = document.activeElement; setDetail(melding); setModus('detail'); }
  const actieveMelding = detail || concept;
  return <>
    <aside className="feedback-dock" data-feedback-ui="true" aria-label="Feedback">
      <div className="feedback-acties">
        <button ref={potloodRef} type="button" className="feedback-primair" onClick={() => begin(true)}>{potlood} Markeren</button>
        <button type="button" onClick={() => begin(false)}>Over dit scherm</button>
        <button type="button" onClick={download}>Feedback downloaden</button>
      </div>
      <section className="feedback-log" aria-labelledby="feedback-log-titel">
        <h2 id="feedback-log-titel">Mijn feedback</h2>
        <div className="feedback-lijst" aria-live="polite">
          {!meldingen.length && <p>Nog geen feedback.</p>}
          {meldingen.map(m => <button key={m.id} type="button" onClick={() => toon(m)}>{m.woord} — lokaal bewaard</button>)}
        </div>
      </section>
      <div className="feedback-privacy"><p>{privacytekst}</p><p>Geef het gedownloade bestand zelf aan de beheerder. Downloaden verstuurt niets centraal.</p>
        {leesFout && <p role="alert">{leesFout} <button type="button" onClick={ververs}>Opnieuw laden</button></p>}
      </div>
    </aside>
    {modus === 'markeren' && <div ref={markeerRef} data-feedback-ui="true" className="feedback-markeer" role="dialog" aria-modal="true" aria-label="Onderdeel markeren">
      <div className="feedback-selectievlak" onPointerDown={pointerStart}
        onPointerMove={e => { const s = startRef.current; if (s?.id === e.pointerId) setVak(feedbackRechthoek(s.x, s.y, e.clientX, e.clientY)); }}
        onPointerUp={pointerEinde} onPointerCancel={() => { startRef.current = null; setVak(null); }} />
      <div className="feedback-markeerbalk"><p>Tik een onderdeel aan of sleep een rechthoek.</p><button type="button" onClick={zonderMarkering}>Zonder markering</button><button type="button" onClick={sluit}>Annuleren</button></div>
    </div>}
    {vak && <div aria-hidden="true" className="feedback-markering" style={{ left: vak.x, top: vak.y, width: vak.breedte, height: vak.hoogte }} />}
    {(modus === 'formulier' || modus === 'detail') && <dialog ref={dialoogRef} data-feedback-ui="true" className="feedback-dialoog" aria-labelledby="feedback-titel" onCancel={e => { e.preventDefault(); sluit(); }}>
      <h2 id="feedback-titel">{detail ? detail.woord : 'Feedback geven'}</h2>
      <p className="feedback-context">{actieveMelding.context.schermnaam}{actieveMelding.context.lesnaam ? ` · ${actieveMelding.context.lesnaam}` : ''}</p>
      {detail ? <>
        <dl><dt>Type</dt><dd>{detail.type}</dd><dt>Opgeslagen</dt><dd>{new Date(detail.tijdstip).toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam' })} (Amsterdam)</dd><dt>Status</dt><dd>Lokaal bewaard</dd></dl>
        <p className="feedback-tekst">{detail.tekst}</p>
        {detail.markering && <p>Markering: {detail.markering.beschrijving}</p>}
        <button type="button" onClick={sluit}>Sluiten</button>
      </> : <form onSubmit={bewaar} noValidate>
        <label htmlFor="feedback-type">Type</label><select id="feedback-type" value={concept.type} onChange={e => setConcept(c => ({ ...c, type: e.target.value }))}>{FEEDBACK_TYPES.map(t => <option key={t}>{t}</option>)}</select>
        <label htmlFor="feedback-woord">Herkenningswoord</label><input id="feedback-woord" maxLength={40} required value={concept.woord} aria-describedby="feedback-fout" onChange={e => setConcept(c => ({ ...c, woord: e.target.value }))} />
        <label htmlFor="feedback-tekst">Feedbacktekst</label><textarea id="feedback-tekst" rows={5} required value={concept.tekst} aria-describedby="feedback-fout" onChange={e => setConcept(c => ({ ...c, tekst: e.target.value }))} />
        <p id="feedback-fout" role="alert">{fout}</p>
        <div className="feedback-formacties"><button type="submit" className="feedback-primair" disabled={bezig}>{bezig ? 'Bewaren…' : 'Opslaan'}</button><button type="button" onClick={sluit}>Annuleren</button></div>
      </form>}
    </dialog>}
  </>;
}
