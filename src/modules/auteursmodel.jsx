// Concepten blijven buiten topics: alleen expliciet publiceren raakt de leerkant.
function nieuwAuteursconcept() {
  return {id:crypto.randomUUID(), versie:1, naam:'', bronIds:[], lessen:[], taken:[]};
}
function nieuweConceptles() {
  return {id:'les-'+crypto.randomUUID(), topicId:'topic-'+crypto.randomUUID(), onderwerp:'', leerdoel:'', titel:'', blokken:[{type:'tekst',titel:'',tekst:''}], vragen:Array.from({length:2},legeControlevraag), geselecteerd:true, gecontroleerd:false, basis:null};
}
function controleerAuteurs(auteurs) {
  if (!Array.isArray(auteurs)) return 'De auteursconcepten zijn ongeldig.';
  const ids=new Set();
  for(const a of auteurs) {
    if(!a||typeof a.id!=='string'||ids.has(a.id)||typeof a.naam!=='string'||!Array.isArray(a.bronIds)||a.bronIds.some(id=>typeof id!=='string')||!Array.isArray(a.lessen)||!Array.isArray(a.taken)) return 'Een auteursconcept is onvolledig.';
    if(a.taken.some(t=>!t||typeof t.id!=="string"||typeof t.lesId!=="string"||!["wacht","bezig","klaar","fout","onderbroken"].includes(t.status)))return "Een uitwerktaak is ongeldig.";
    ids.add(a.id);
    for(const l of a.lessen) {
      if(!l||typeof l.id!=='string'||ids.has(l.id)||typeof l.topicId!=='string'||(l.basis!==null&&typeof l.basis!=='string')||!['onderwerp','leerdoel','titel'].every(k=>typeof l[k]==='string')||!Array.isArray(l.blokken)||l.blokken.some(b=>!b||typeof b.tekst!=='string'||typeof b.titel!=='string')||!Array.isArray(l.vragen)||l.vragen.some(v=>!v||typeof v.vraag!=='string'||typeof v.uitleg!=='string'||!Array.isArray(v.opties)||v.opties.some(o=>typeof o!=='string')||!Number.isInteger(v.juisteIndex))) return 'Een conceptles is onvolledig.';
      ids.add(l.id);
    }
  }
  return null;
}
// Zo verschijnt een conceptvraag na publiceren; de testweergave gebruikt dezelfde vorm.
function conceptVraagVoorLeerling(v) {
  return {...v,type:'meerkeuze',vraag:v.vraag.trim(),...zonderLegeOpties(v.opties.map(o=>o.trim()),Number(v.juisteIndex)),uitleg:v.uitleg.trim()};
}
// Wat publiceren overschrijft: de les én titel en leerdoel van het onderwerp.
// Veranderde een van die drie buiten het concept, dan is dat een conflict.
function publicatieBasis(onderwerp, les) {
  return les ? JSON.stringify({les, titel:onderwerp.titel, ondertitel:onderwerp.ondertitel??''}) : null;
}
function publiceerAuteursconcept(concept, inhoud) {
  const gekozen=concept.lessen.filter(l=>l.geselecteerd);
  if(!concept.naam.trim()||!gekozen.length) throw Error('Kies een lesboomnaam en minstens één les.');
  if(gekozen.some(l=>!l.gecontroleerd||!l.onderwerp.trim()||!l.leerdoel.trim()||!l.titel.trim()||!l.blokken.length||l.blokken.some(b=>!b.tekst.trim())||!controleVragenGeldig(l.vragen))) throw Error('Controleer leerdoel, inhoud en vragen van iedere geselecteerde les.');
  const domeinId=concept.domeinId||'domein-'+concept.id;
  const topics=[...inhoud.topics];
  const lessen=concept.lessen.map(l=>{
    if(!l.geselecteerd)return l;
    const ti=topics.findIndex(t=>t.id===l.topicId), bestaand=ti>=0?topics[ti]:null;
    const oudeLes=bestaand?.orbs.find(o=>o.id===l.id);
    if(publicatieBasis(bestaand,oudeLes)!==l.basis) throw Error('Een gepubliceerde les is intussen gewijzigd. Bewaar dit concept en controleer eerst de bestaande les.');
    const vragen=l.vragen.map((v,i)=>{
      const oud=oudeLes?.vragen[i];
      const nieuw=conceptVraagVoorLeerling(v);
      const gelijk=oud&&['vraag','opties','juisteIndex','uitleg'].every(k=>JSON.stringify(oud[k])===JSON.stringify(nieuw[k]));
      return {...nieuw,id:gelijk?oud.id:'vraag-'+crypto.randomUUID(),...(!gelijk&&oud?{vorigeId:oud.id}:{})};
    });
    const orb={id:l.id,titel:l.titel.trim(),blokken:publicatieBlokken(l.blokken),vragen,versie:(oudeLes?.versie||0)+1,bronVerwijzingen:concept.bronIds.map(bronId=>({bronId})),publicatieAudit:{redactieStatus:'handmatig',gecontroleerdOp:new Date().toISOString()}};
    if(bestaand)topics[ti]={...bestaand,titel:l.onderwerp.trim(),ondertitel:l.leerdoel.trim(),orbs:bestaand.orbs.map(o=>o.id===l.id?orb:o)};
    else topics.push({id:l.topicId,domeinId,titel:l.onderwerp.trim(),ondertitel:l.leerdoel.trim(),prerequisites:[],gridPos:{tier:1,track:topics.filter(t=>t.domeinId===domeinId).length+1},orbs:[orb]});
    return {...l,basis:publicatieBasis({titel:l.onderwerp.trim(),ondertitel:l.leerdoel.trim()},orb),vragen:JSON.parse(JSON.stringify(vragen)),gecontroleerd:false};
  });
  return {...inhoud,domeinen:inhoud.domeinen.some(d=>d.id===domeinId)?inhoud.domeinen:[...inhoud.domeinen,{id:domeinId,naam:concept.naam.trim(),kleur:ST.oranje}],topics,concept:{...concept,domeinId,lessen}};
}
// Servergrens: uitsluitend de geselecteerde broninhoud, geen leerlinggegevens.
function maakAuteursAanvraag(concept, bronnen, soort, lesIds=[]) {
  const geselecteerd=concept.bronIds.map(id=>Object.values(bronnen).flat().find(b=>b.id===id));
  if(!geselecteerd.length||geselecteerd.some(b=>!b?.tekst?.trim())) throw Error('Selecteer bronnen met leesbare tekst.');
  if(!['lesboom','lessen'].includes(soort))throw Error('Onbekende auteursopdracht.');
  return {versie:1,aanvraagId:crypto.randomUUID(),soort,bronnen:geselecteerd.map(b=>({id:b.id,naam:b.naam,tekst:b.tekst})),lessen:concept.lessen.filter(l=>lesIds.includes(l.id)).map(l=>({id:l.id,onderwerp:l.onderwerp,leerdoel:l.leerdoel})),vraagprotocol:{min:1,standaard:2,max:3}};
}
function maakAuteursTaken(lesIds) {
  return [...new Set(lesIds)].map(lesId=>({id:crypto.randomUUID(),lesId,status:'wacht',pogingen:0}));
}
function hervatAuteursTaken(taken) {
  return taken.map(t=>t.status==='bezig'?{...t,status:'onderbroken'}:t);
}

// Zoeken binnen eigen bronnen: alle zoekwoorden moeten voorkomen; titel weegt zwaarder.
function zoekEigenBronnen(bronnen, zoek) {
  const normaal=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('nl-NL');
  const woorden=[...new Set(normaal(zoek).trim().split(/\s+/).filter(Boolean))];
  return bronnen.map((bron,index)=>{
    const titel=normaal(bron.naam), tekst=normaal(bron.tekst), geheel=titel+' '+tekst;
    if(!woorden.every(w=>geheel.includes(w)))return null;
    const score=woorden.reduce((som,w)=>som+(titel.includes(w)?3:1),0);
    const eerste=woorden.length?woorden.map(w=>tekst.indexOf(w)).filter(i=>i>=0).sort((a,b)=>a-b)[0]:0;
    const begin=Math.max(0,(eerste||0)-50);
    const fragment=bron.tekst?`${begin?'…':''}${bron.tekst.slice(begin,begin+180)}${bron.tekst.length>begin+180?'…':''}`:'Nog geen leesbare broninhoud';
    return {bron,score,index,fragment};
  }).filter(Boolean).sort((a,b)=>b.score-a.score||a.index-b.index);
}
