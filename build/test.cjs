const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { leesBron } = require('./bron.cjs');
const root = path.resolve(__dirname, '..');
const compiler = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname,'vendor/babel.js'),'utf8'),compiler);
const source = fs.readFileSync(path.join(root,'src/technische-startinhoud.js'),'utf8')+'\n'+
  leesBron().replace(/^import React[^\n]+\n/,'const {useState,useEffect,useRef}=React;\n').replace('export default function Leerplatform','function Leerplatform');
const expose = '\nglobalThis.testAPI={nieuwAuteursconcept,nieuweConceptles,controleerAuteurs,publiceerAuteursconcept,maakAuteursAanvraag,maakAuteursTaken,hervatAuteursTaken,publicatieBlokken,controleVragenGeldig,publicatieVragen,START_DOMEINEN,START_TOPICS,verwerkAntwoord,vragenDieAanDeBeurtZijn,vraagIsHeel,vragenAanDeBeurtInLesboom,herhaalsessieVoorLesboom,dagSleutel,normaliseerOpeningsdagen,openingsdagenBijLaden,antwoordTeltMee,zonderLegeOpties,heeftDubbeleOpties,meerkeuzeIsJuist,normaliseerVoortgang,rondLesAf,aantalAfgerond,lesStatus,topicRaatStatus,verwerkLesAntwoord,kennisVanBestaandeVragen,kennisNaVraagwijziging,controleerBackup,voortgangUitBackup,schrijfBackup,noodBackup,aantalGoed,noteerGoedBuitenSchema,kiesGewogen,voegOpeningsdagToe,dagenAanDeBeurt,moetPulseren,sterkteVanOnderwerp,berekenPlaatsing,isTopicUnlocked,beheerLesboomInfo,bewaren};';
const app = vm.createContext({crypto:require('node:crypto').webcrypto,React:{Component:class{}},window:{storage:{set:async()=>true}},console});
vm.runInContext(compiler.Babel.transform(source+expose,{presets:['react'],comments:false}).code,app);
const a=app.testAPI;
let total=0;
async function test(name,fn){await fn();total++;console.log('OK '+name);}
(async()=>{
 await test('Auteursconcepten publiceren geselecteerd, behouden oude versies en detecteren conflicten',()=>{
   const c=a.nieuwAuteursconcept(); c.naam='Proefboom';
   const l=a.nieuweConceptles(); Object.assign(l,{onderwerp:'Onderwerp',leerdoel:'Doel',titel:'Titel',blokken:[{type:'tekst',titel:'Kop',tekst:'Inhoud'}],vragen:[{vraag:'Welke optie klopt?',opties:['Een','Twee'],juisteIndex:0,uitleg:'De eerste klopt.'}],gecontroleerd:true});
   c.lessen=[l,{...a.nieuweConceptles(),geselecteerd:false}];
   const inhoud={domeinen:[],topics:[],bronnen:{}}; const voor=JSON.stringify(inhoud);
   const een=a.publiceerAuteursconcept(c,inhoud); assert.equal(een.topics.length,1); assert.equal(JSON.stringify(inhoud),voor); assert.equal(een.topics[0].orbs[0].versie,1);
   const oud=JSON.stringify(een.topics); const id=een.topics[0].orbs[0].vragen[0].id;
   const d=een.concept; d.lessen[0].titel='Nieuwe titel'; d.lessen[0].gecontroleerd=true;
   assert.equal(JSON.stringify(een.topics),oud);
   const twee=a.publiceerAuteursconcept(d,een); assert.equal(twee.topics[0].orbs[0].vragen[0].id,id); assert.equal(twee.topics[0].orbs[0].versie,2);
   assert.throws(()=>a.publiceerAuteursconcept(d,twee),/intussen gewijzigd/);
   const e=twee.concept; e.lessen[0].vragen[0].juisteIndex=1; e.lessen[0].gecontroleerd=true;
   const drie=a.publiceerAuteursconcept(e,twee); assert.notEqual(drie.topics[0].orbs[0].vragen[0].id,id); assert.equal(drie.topics[0].orbs[0].vragen[0].vorigeId,id);
 });
 await test('Auteursaanvraag beperkt gegevens en weigert onleesbare bronnen',()=>{
   const c={bronIds:['b'],lessen:[],kennis:{geheim:true},naam:'Intern'};
   assert.throws(()=>a.maakAuteursAanvraag(c,{bibliotheek:[{id:'b',naam:'Bron',tekst:''}]},'lesboom'),/leesbare/);
   const v=a.maakAuteursAanvraag(c,{bibliotheek:[{id:'b',naam:'Bron',tekst:'Leesbaar',bestand:'niet meesturen'}]},'lesboom');
   assert.equal(v.kennis,undefined); assert.equal(v.bronnen[0].bestand,undefined); assert.equal(v.vraagprotocol.standaard,2);
   const taken=a.maakAuteursTaken(['a','b','a']); assert.equal(taken.length,2); taken[0].status='bezig';taken[1].status='klaar';
   const hersteld=a.hervatAuteursTaken(taken);assert.equal(hersteld[0].status,'onderbroken');assert.equal(hersteld[1].status,'klaar');assert.equal(taken[0].status,'bezig');
 });
 await test('Back-up bewaakt conceptstructuur zonder oude back-ups te weigeren',()=>{
   assert.equal(a.controleerAuteurs([a.nieuwAuteursconcept()]),null);
   assert.ok(a.controleerAuteurs([{id:'kapot'}]));
 });
 await test('Publiceren bewaart bloktitels bij hun tekst en verandert invoer niet',()=>{
   const blokken=[{type:'tekst',titel:' Tweede ',tekst:' Tekst twee ',extra:'behouden'},{type:'tekst',tekst:' Tekst een '}];
   const voor=JSON.stringify(blokken);
   const uit=a.publicatieBlokken(blokken,' Kern ');
   assert.equal(uit[0].titel,'Tweede'); assert.equal(uit[0].tekst,'Tekst twee');
   assert.equal(uit[0].extra,'behouden'); assert.equal(uit[0].onthoud,undefined);
   assert.equal(uit[1].titel,''); assert.equal(uit[1].onthoud,'Kern');
   assert.equal(JSON.stringify(blokken),voor);
 });
 await test('Vraagprotocol weigert nul, vier, dubbele en onvolledige vragen',()=>{
   const v={vraag:'Welke optie klopt?',opties:['Eerste','Tweede','',''],juisteIndex:1,uitleg:'De tweede optie is juist.'};
   for(const n of [1,2,3]) assert.equal(a.controleVragenGeldig(Array.from({length:n},()=>v)),true);
   for(const n of [0,4]) assert.equal(a.controleVragenGeldig(Array.from({length:n},()=>v)),false);
   assert.equal(a.controleVragenGeldig([{...v,opties:['zelfde','zelfde']}]),false);
   assert.equal(a.controleVragenGeldig([{...v,uitleg:''}]),false);
 });
 await test('De app start zonder lesinhoud',()=>{
   assert.equal(a.START_DOMEINEN.length,0);
   assert.equal(a.START_TOPICS.length,0);
 });
 // Een onderwerp om de leerlogica mee te toetsen. Dit staat bewust hier en niet
 // in de startinhoud: de app levert geen inhoud meer mee, maar de regels die
 // over inhoud gaan moeten nog steeds kloppen.
 const proefVraag = {id:'v1',vraag:'Hoeveel dagen heeft een week?',opties:['Vijf','Zeven'],juisteIndex:1,uitleg:'Een week heeft zeven dagen.'};
 const proefTopics = [
   {id:'t1',domeinId:'d1',prerequisites:[],gridPos:{tier:1,track:1},titel:'Eerste onderwerp',orbs:[{id:'o1',titel:'Eerste les',blokken:[{type:'tekst',tekst:'Tekst.'}],vragen:[proefVraag]}]},
   {id:'t2',domeinId:'d1',prerequisites:['t1'],gridPos:{tier:2,track:1},titel:'Tweede onderwerp',orbs:[{id:'o2',titel:'Tweede les',blokken:[{type:'tekst',tekst:'Tekst.'}],vragen:[]}]},
 ];
 await test('Een onderwerp met een voorganger blijft dicht tot die af is',()=>{
   assert.equal(a.isTopicUnlocked(proefTopics[0],proefTopics,{}),true);
   assert.equal(a.isTopicUnlocked(proefTopics[1],proefTopics,{}),false);
   assert.equal(a.isTopicUnlocked(proefTopics[1],proefTopics,{t1:['o1']}),true);
 });
 await test('Een lesboom zonder onderwerpen is leeg, met onderwerpen zonder inhoud concept',()=>{
   assert.equal(a.beheerLesboomInfo({id:'d1',naam:'Leeg'},[]).pil,'leeg');
   assert.equal(a.beheerLesboomInfo({id:'d1',naam:'Proef'},proefTopics).pil,'gepubliceerd');
   const metOpzet = [{...proefTopics[0],orbs:[{...proefTopics[0].orbs[0],concept:true}]}];
   assert.equal(a.beheerLesboomInfo({id:'d1',naam:'Proef'},metOpzet).pil,'concept');
 });
 await test('Een nieuw onderwerp krijgt een plek achter zijn voorganger',()=>{
   const plek = a.berekenPlaatsing(proefTopics,'d1','t1');
   // Niet met deepEqual: waarden uit de vm hebben een eigen Array-prototype.
   assert.equal(plek.prerequisites.length,1);
   assert.equal(plek.prerequisites[0],'t1');
   assert.ok(plek.gridPos.tier>1);
 });
 await test('Herhaalintervallen en fout antwoord',()=>{
   let k=a.verwerkAntwoord({},'q',true,0);assert.equal(k.q.doos,1);assert.equal(k.q.volgende,86400000);
   k=a.verwerkAntwoord(k,'q',true,0);assert.equal(k.q.doos,2);assert.equal(k.q.volgende,259200000);
   k=a.verwerkAntwoord(k,'q',false,0);assert.equal(k.q.doos,1);assert.equal(k.q.fouten,1);
 });
 await test('Alleen beantwoorde vragen komen terug in het herhaalschema',()=>{
   const nu = Date.now();
   assert.equal(a.vragenDieAanDeBeurtZijn(proefTopics,{},nu).length,0);
   const kennis = a.verwerkAntwoord({},'v1',true,nu);
   assert.equal(a.vragenDieAanDeBeurtZijn(proefTopics,kennis,nu).length,0);
   assert.equal(a.vragenDieAanDeBeurtZijn(proefTopics,kennis,nu+86400001).length,1);
 });
 // Testdata voor de herhaalsessie per lesboom: staat alleen hier, nooit in src/.
 const nu = 1e12;
 const aanDeBeurt = doos => ({doos,volgende:nu-1,fouten:0});
 const nietAanDeBeurt = doos => ({doos,volgende:nu+1e6,fouten:0});
 const lesboomTopic = (domeinId,ids) => ({id:'top-'+domeinId,domeinId,prerequisites:[],gridPos:{tier:1,track:1},titel:domeinId,
   orbs:[{id:'orb-'+domeinId,titel:'Les',blokken:[],vragen:ids.map(id=>({id,vraag:id,opties:['a','b'],juisteIndex:0}))}]});
 const idsVan = sessie => Array.from({length:sessie.length},(_,i)=>sessie[i].vraag.id);
 // Strikt afwisselend, beginnend en eindigend met een bekende vraag.
 const wisseltAf = sessie => Array.from({length:sessie.length},(_,i)=>sessie[i].soort)
   .every((soort,i)=>soort===(i%2===0?'bekend':'werk')) && sessie[sessie.length-1].soort==='bekend';
 await test('Een herhaalsessie bevat alleen vragen uit de gevraagde lesboom, wisselt af en blijft onder de tien',()=>{
   const werkIds = Array.from({length:12},(_,i)=>'w'+i);
   const kennis = {};
   werkIds.forEach((id,i)=>{kennis[id]=aanDeBeurt(1+(i%3));});
   ['k0','k1','k2'].forEach(id=>{kennis[id]=aanDeBeurt(4);});
   ['r0','r1','r2','r3'].forEach(id=>{kennis[id]=nietAanDeBeurt(5);});
   kennis.x0=aanDeBeurt(1);
   const topics=[lesboomTopic('d2',['x0']),lesboomTopic('d1',[...werkIds,'k0','k1','k2','r0','r1','r2','r3'])];
   assert.equal(a.vragenAanDeBeurtInLesboom(topics,kennis,nu,'d1').length,15);
   const sessie = a.herhaalsessieVoorLesboom(topics,kennis,nu,'d1');
   assert.equal(sessie.length,9);
   assert.ok(!idsVan(sessie).includes('x0'));
   assert.ok(wisseltAf(sessie));
   // Bekende vragen die aan de beurt zijn, gaan voor bekende vragen die dat niet zijn.
   const bekendIds = idsVan(Array.from(sessie).filter(v=>v.soort==='bekend'));
   for (const id of ['k0','k1','k2']) assert.ok(bekendIds.includes(id), id+' hoort in de sessie');
   assert.equal(Array.from(sessie).filter(v=>!v.meetelt).length,2);
   // Het werk is het zwakst: de laagste dozen eerst, en nooit doos 4 of 5.
   assert.ok(Array.from(sessie).filter(v=>v.soort==='werk').every(v=>v.doos===1));
 });
 await test('Bij weinig werk komen er niet meer bekende vragen in dan de afwisseling nodig heeft',()=>{
   const kennis = {w0:aanDeBeurt(1)};
   ['r0','r1','r2','r3','r4'].forEach(id=>{kennis[id]=nietAanDeBeurt(5);});
   const sessie = a.herhaalsessieVoorLesboom([lesboomTopic('d1',['w0','r0','r1','r2','r3','r4'])],kennis,nu,'d1');
   assert.equal(sessie.length,3);
   assert.ok(wisseltAf(sessie));
   for (const v of Array.from(sessie)) assert.equal(v.meetelt, v.soort==='werk');
   // Eén bekende vraag: bekend, werk.
   const een = a.herhaalsessieVoorLesboom([lesboomTopic('d1',['w0','w1','r0'])],{w0:aanDeBeurt(1),w1:aanDeBeurt(2),r0:nietAanDeBeurt(4)},nu,'d1');
   assert.equal(een.length,2);
   assert.equal(een[0].soort,'bekend');
   assert.equal(een[1].soort,'werk');
 });
 await test('Bekende vragen uit doos 4-5 komen nooit als werk in de sessie',()=>{
   const ids = Array.from({length:7},(_,i)=>'b'+i);
   const kennis = {}; ids.forEach(id=>{kennis[id]=aanDeBeurt(4);});
   const sessie = a.herhaalsessieVoorLesboom([lesboomTopic('d1',ids)],kennis,nu,'d1');
   assert.equal(sessie.length,5);
   assert.ok(Array.from(sessie).every(v=>v.soort==='bekend' && v.meetelt));
 });
 await test('Zonder bekende vragen hoogstens vijf werkvragen, laagste doos eerst',()=>{
   const ids = Array.from({length:7},(_,i)=>'w'+i);
   const kennis = {}; ids.forEach((id,i)=>{kennis[id]=aanDeBeurt(3-(i%3));});
   const sessie = a.herhaalsessieVoorLesboom([lesboomTopic('d1',ids)],kennis,nu,'d1');
   assert.equal(sessie.length,5);
   assert.ok(Array.from(sessie).every(v=>v.soort==='werk'));
   for (let i=1;i<sessie.length;i++) assert.ok(sessie[i-1].doos<=sessie[i].doos);
 });
 await test('Vragen uit conceptlessen en kapotte vragen komen niet in de herhaling',()=>{
   const topic = {id:'tc',domeinId:'d1',orbs:[
     {id:'oc',titel:'Concept',concept:true,blokken:[],vragen:[{id:'c1',vraag:'c1',opties:['a','b'],juisteIndex:0}]},
     {id:'ok',titel:'Kapot',blokken:[],vragen:[{id:'k1',vraag:'k1',opties:[],juisteIndex:0},{id:'k2',vraag:'k2'}]},
     {id:'og',titel:'Goed',blokken:[],vragen:[{id:'g1',vraag:'g1',opties:['a','b'],juisteIndex:0},{id:'r1',vraag:'r1',opties:['a','b'],juisteIndex:0}]},
   ]};
   const kennis = {c1:aanDeBeurt(1),k1:aanDeBeurt(1),k2:aanDeBeurt(2),g1:aanDeBeurt(1),r1:nietAanDeBeurt(5)};
   kennis.c2 = aanDeBeurt(5);
   assert.equal(a.vragenDieAanDeBeurtZijn([topic],kennis,nu).length,1);
   const sessie = a.herhaalsessieVoorLesboom([topic],kennis,nu,'d1');
   assert.equal(idsVan(sessie).join(','),'r1,g1');
   // Kapotte vragen in rust (doos 4-5) evenmin.
   const rustKapot = {...kennis, k1:nietAanDeBeurt(5), r1:undefined};
   delete rustKapot.r1;
   assert.equal(idsVan(a.herhaalsessieVoorLesboom([topic],rustKapot,nu,'d1')).join(','),'g1');
 });
 await test('Per vraag telt de app hoe vaak hij goed is beantwoord; oude voortgang schat dat uit de doos',()=>{
   let k = a.verwerkAntwoord({},'q',true,nu);
   assert.equal(k.q.goed,1);
   k = a.verwerkAntwoord(k,'q',false,nu);
   assert.equal(k.q.goed,1);
   assert.equal(a.aantalGoed({doos:4,volgende:0,fouten:0}),4);
   assert.equal(a.aantalGoed({doos:4,volgende:0,fouten:0,goed:7}),7);
   assert.equal(a.aantalGoed(undefined),0);
   const oud = {doos:5,volgende:nu+1e6,fouten:1};
   const na = a.noteerGoedBuitenSchema({r:oud},'r',true);
   assert.equal(na.r.goed,6);
   assert.equal(na.r.doos,5);
   assert.equal(na.r.volgende,oud.volgende);
   const fout = {r:oud};
   assert.equal(a.noteerGoedBuitenSchema(fout,'r',false),fout);
   assert.equal(a.noteerGoedBuitenSchema(fout,'onbekend',true),fout);
 });
 await test('Bekende vragen in rust rouleren; vaker goed beantwoord betekent minder kans',()=>{
   // Kans evenredig met 1/(1+goed): goed 0 -> 1, goed 3 -> 0,25, dus 80% tegen 20%.
   const lijst = ['vaak-fout','vaak-goed'];
   const gewicht = id => id==='vaak-fout' ? 1 : 0.25;
   let vaakFout = 0;
   const N = 1000;
   for (let i=0;i<N;i++) if (a.kiesGewogen(lijst,1,gewicht,()=> (i+0.5)/N)[0]==='vaak-fout') vaakFout++;
   assert.equal(vaakFout,800);
   // In de sessie: alle rustende vragen komen eens langs als het lot anders valt.
   const kennis = {w0:aanDeBeurt(1)};
   ['r0','r1','r2','r3'].forEach(id=>{kennis[id]={...nietAanDeBeurt(5),goed:0};});
   const topics = [lesboomTopic('d1',['w0','r0','r1','r2','r3'])];
   const gezien = new Set();
   for (const lot of [0.05,0.3,0.55,0.8,0.95]) {
     for (const v of Array.from(a.herhaalsessieVoorLesboom(topics,kennis,nu,'d1',()=>lot))) if (v.soort==='bekend') gezien.add(v.vraag.id);
   }
   assert.equal(gezien.size,4);
   // Het gewicht in de sessie: een rustende vraag die 3 keer goed is, komt vier keer zo weinig.
   const k2 = {w0:aanDeBeurt(1),kd:aanDeBeurt(4),'r-fout':{...nietAanDeBeurt(5),goed:0},'r-goed':{...nietAanDeBeurt(5),goed:3}};
   const t2 = [lesboomTopic('d1',['w0','kd','r-fout','r-goed'])];
   let fout = 0;
   for (let i=0;i<N;i++) if (idsVan(a.herhaalsessieVoorLesboom(t2,k2,nu,'d1',()=>(i+0.5)/N)).includes('r-fout')) fout++;
   assert.equal(fout,800);
 });
 await test('Een antwoord op een bekende vraag die niet aan de beurt was, telt niet mee',()=>{
   assert.equal(a.antwoordTeltMee({meetelt:false},false),false);
   assert.equal(a.antwoordTeltMee({meetelt:true},false),true);
   assert.equal(a.antwoordTeltMee({},false),true);
   assert.equal(a.antwoordTeltMee({meetelt:true},true),false);
 });
 await test('Een herhaalsessie wordt korter bij te weinig vragen en is leeg als niets aan de beurt is',()=>{
   const alleenWerk = a.herhaalsessieVoorLesboom([lesboomTopic('d1',['w0','w1'])],{w0:aanDeBeurt(1),w1:aanDeBeurt(2)},nu,'d1');
   assert.equal(alleenWerk.length,2);
   assert.equal(alleenWerk[0].vraag.id,'w0'); // laagste doos eerst
   const leeg = a.herhaalsessieVoorLesboom([lesboomTopic('d1',['r0','w0'])],{r0:nietAanDeBeurt(5),w0:nietAanDeBeurt(1)},nu,'d1');
   assert.equal(leeg.length,0);
   assert.equal(a.herhaalsessieVoorLesboom([lesboomTopic('d1',['w0'])],{},nu,'d1').length,0);
 });
 await test('Opgeslagen voortgang zonder openingsdagen laadt met vandaag als eerste dag',()=>{
   const vandaag = new Date(2026,9,21,9,0).getTime();
   for (const vg of [null, undefined, {}, {voortgang:{},kennis:{}}, {openingsdagen:'kapot'}]) {
     const dagen = a.openingsdagenBijLaden(vg,vandaag);
     assert.equal(dagen.length,1);
     assert.equal(dagen[0],'2026-10-21');
   }
   const bestaand = a.openingsdagenBijLaden({openingsdagen:['2026-10-20',7]},vandaag);
   assert.equal(bestaand.length,2);
   assert.equal(bestaand[0],'2026-10-20');
 });
 await test('Twee keer openen op één dag is één openingsdag; oude opslag zonder openingsdagen laadt',()=>{
   const ochtend = new Date(2026,9,20,8,0).getTime();
   const avond = new Date(2026,9,20,22,0).getTime();
   let dagen = a.voegOpeningsdagToe(a.normaliseerOpeningsdagen(undefined),ochtend);
   const zelfde = a.voegOpeningsdagToe(dagen,avond);
   assert.equal(zelfde,dagen);
   assert.equal(dagen.length,1);
   assert.equal(dagen[0],'2026-10-20');
   assert.equal(a.normaliseerOpeningsdagen({}).length,0);
   assert.equal(a.normaliseerOpeningsdagen(['2026-10-20',3,'onzin']).length,1);
   for (let i=0;i<70;i++) dagen = a.voegOpeningsdagToe(dagen,new Date(2026,0,1+i,12).getTime());
   assert.equal(dagen.length,60);
   assert.equal(dagen[59],'2026-10-20');
 });
 await test('Een vraag telt de openingsdagen waarop hij al aan de beurt was',()=>{
   const staat = {doos:2,volgende:new Date(2026,9,10,15,0).getTime(),fouten:0};
   assert.equal(a.dagenAanDeBeurt(staat,[]),0);
   assert.equal(a.dagenAanDeBeurt(undefined,['2026-10-12']),0);
   assert.equal(a.dagenAanDeBeurt(staat,['2026-10-01','2026-10-09','2026-10-10','2026-10-14']),2);
 });
 await test('Pulseren bij tien vragen aan de beurt of een vraag die drie openingsdagen blijft liggen',()=>{
   const volgende = new Date(2026,9,10,9,0).getTime();
   const kennis = {};
   const due = Array.from({length:10},(_,i)=>{kennis['p'+i]={doos:1,volgende,fouten:0};return {vraag:{id:'p'+i},doos:1};});
   assert.equal(a.moetPulseren(due,kennis,[]),true);
   assert.equal(a.moetPulseren(due.slice(0,9),kennis,[]),false);
   const een = due.slice(0,1);
   assert.equal(a.moetPulseren(een,kennis,['2026-10-10','2026-10-11']),false);
   assert.equal(a.moetPulseren(een,kennis,['2026-10-10','2026-10-11','2026-10-15']),true);
   assert.equal(a.moetPulseren([],kennis,['2026-10-10','2026-10-11','2026-10-15']),false);
 });
 await test('Sterkte van een onderwerp is het gemiddelde van zijn lessen, en leeg zonder antwoorden',()=>{
   const vraag = id => ({id,vraag:id,opties:['a','b'],juisteIndex:0});
   const topic = {id:'s1',domeinId:'d1',orbs:[
     {id:'l1',titel:'Les 1',blokken:[],vragen:[vraag('s-a'),vraag('s-b')]},
     {id:'l2',titel:'Les 2',blokken:[],vragen:[vraag('s-c')]},
     {id:'l3',titel:'Zonder vragen',blokken:[],vragen:[]},
   ]};
   assert.equal(a.sterkteVanOnderwerp(topic,{}),null);
   // Les 1: (5+0)/2 = 2,5; les 2: 5; gemiddeld 3,75 van 5 = 0,75. Les 3 telt niet mee.
   const kennis = {'s-a':{doos:5,volgende:0,fouten:0},'s-c':{doos:5,volgende:0,fouten:0}};
   assert.equal(a.sterkteVanOnderwerp(topic,kennis),0.75);
 });
 await test('Les toevoegen bewaart het gekozen juiste antwoord, ook met lege antwoordvakken',()=>{
   const r = a.zonderLegeOpties(['','Zeven','Vijf','Acht'],1);
   assert.equal(r.opties.length,3);
   assert.equal(r.opties[r.juisteIndex],'Zeven');
   const achteraan = a.zonderLegeOpties(['x','','y','z'],3);
   assert.equal(achteraan.opties[achteraan.juisteIndex],'z');
   const vol = a.zonderLegeOpties(['a','b','c','d'],2);
   assert.equal(vol.opties[vol.juisteIndex],'c');
   assert.equal(a.vraagIsHeel({vraag:'Hoeveel?',...achteraan}),true);
 });
 // Een onderwerp met drie lessen voor de voortgang per les.
 const les = (id)=>({id,titel:id,blokken:[{type:'tekst',tekst:'Tekst.'}],vragen:[]});
 const drieLessen = {id:'a',domeinId:'d1',prerequisites:[],titel:'A',orbs:[les('l1'),les('l2'),les('l3')]};
 const naA = {id:'b',domeinId:'d1',prerequisites:['a'],titel:'B',orbs:[les('m1')]};
 await test('Een les buiten de volgorde afronden telt mee',()=>{
   let v = a.rondLesAf({},'a','l2');
   v = a.rondLesAf(v,'a','l1');
   assert.equal(a.aantalAfgerond(drieLessen,v),2);
   assert.equal(a.lesStatus(drieLessen,drieLessen.orbs[1],v),'af');
   assert.equal(a.lesStatus(drieLessen,drieLessen.orbs[2],v),'bezig');
   assert.equal(a.rondLesAf(v,'a','l1'),v,'twee keer afronden verandert niets');
 });
 await test('Een nieuwe les na het verwijderen van een afgeronde les staat niet op af',()=>{
   let v = {};
   ['l1','l2','l3'].forEach(id=>{v=a.rondLesAf(v,'a',id);});
   assert.equal(a.isTopicUnlocked(naA,[drieLessen,naA],v),true);
   const zonderL3 = {...drieLessen,orbs:drieLessen.orbs.slice(0,2)};
   v = a.normaliseerVoortgang(v,[zonderL3]);
   assert.equal(v.a.length,2);
   const metNieuwe = {...zonderL3,orbs:[...zonderL3.orbs,les('nieuw')]};
   assert.equal(a.aantalAfgerond(metNieuwe,v),2);
   assert.equal(a.lesStatus(metNieuwe,metNieuwe.orbs[2],v),'bezig');
   assert.equal(a.isTopicUnlocked(naA,[metNieuwe,naA],v),false,'het vervolg gaat weer dicht tot de nieuwe les af is');
 });
 await test('Een lege les of lesopzet houdt het onderwerp niet tegen',()=>{
   const metLege = {...drieLessen,orbs:[{id:'leeg',titel:'Leeg',blokken:[],vragen:[]},les('l2'),{...les('l3'),concept:true}]};
   const v = a.rondLesAf({},'a','l2');
   assert.equal(a.topicRaatStatus(metLege,v),'af');
   assert.equal(a.isTopicUnlocked(naA,[metLege,naA],v),true);
   assert.equal(a.lesStatus(metLege,metLege.orbs[0],v),'leeg');
 });
 await test('Oude voortgang ("de eerste n lessen") wordt omgezet naar lessen',()=>{
   const v = a.normaliseerVoortgang({a:2,weg:4},[drieLessen]);
   assert.equal(v.a.join(),'l1,l2');
   assert.equal(v.weg,4,'een onbekend onderwerp blijft ongemoeid');
   assert.equal(a.normaliseerVoortgang({a:9},[drieLessen]).a.length,3);
   const goed = {a:['l1']};
   assert.equal(a.normaliseerVoortgang(goed,[drieLessen]),goed,'wat klopt, blijft hetzelfde object');
   assert.equal(Object.keys(a.normaliseerVoortgang(null,[drieLessen])).length,0);
 });
 await test('Een les opnieuw doorlopen schuift een vraag niet op voordat hij aan de beurt is',()=>{
   let k = {};
   for (let keer=0; keer<5; keer++) k = a.verwerkLesAntwoord(k,'q',true,1000+keer);
   assert.equal(k.q.doos,1,'vijf keer achter elkaar blijft doos 1');
   assert.equal(k.q.goed,5);
   const fout = a.verwerkLesAntwoord(k,'q',false,2000);
   assert.equal(fout.q.doos,1);
   assert.equal(fout.q.fouten||0,0,'een fout buiten het schema telt niet');
   const later = a.verwerkLesAntwoord(k,'q',true,k.q.volgende);
   assert.equal(later.q.doos,2,'als hij aan de beurt is, telt het wel');
 });
 await test('Herhaalintervallen van alle dozen, met doos 5 als bovengrens',()=>{
   const dagen=[1,3,7,21,60];
   let k={};
   dagen.forEach((d,i)=>{k=a.verwerkAntwoord(k,'q',true,0);assert.equal(k.q.doos,i+1);assert.equal(k.q.volgende,d*86400000);});
   k=a.verwerkAntwoord(k,'q',true,0);
   assert.equal(k.q.doos,5);
   assert.equal(k.q.volgende,60*86400000);
 });
 await test('Twee gelijke antwoorden worden geweigerd en allebei goed gerekend',()=>{
   assert.equal(a.heeftDubbeleOpties(['Zeven','zeven ','Vijf']),true);
   assert.equal(a.heeftDubbeleOpties(['Zeven','','','Vijf']),false);
   const vraag = {vraag:'Hoeveel?',opties:['Zeven','Zeven','Vijf'],juisteIndex:0};
   assert.equal(a.meerkeuzeIsJuist(vraag,0),true);
   assert.equal(a.meerkeuzeIsJuist(vraag,1),true);
   assert.equal(a.meerkeuzeIsJuist(vraag,2),false);
   assert.equal(a.meerkeuzeIsJuist({vraag:'?',opties:['','','x'],juisteIndex:0},1),false,'twee lege vakken zijn geen goed antwoord');
 });
 await test('Een vraag die opnieuw geleerd moet worden, erft de oude beheersing niet en komt meteen terug',()=>{
   const nieuweVraag = {...proefVraag,id:'v1-nieuw',vorigeId:'v1'};
   const topics = [{...proefTopics[0],orbs:[{...proefTopics[0].orbs[0],vragen:[nieuweVraag]}]}];
   const k = {v1:{doos:5,volgende:9e15,fouten:0,goed:7}};
   const na = a.kennisNaVraagwijziging(k,topics,1000);
   assert.equal(na['v1-nieuw'].doos,1);
   assert.equal(na['v1-nieuw'].goed,0);
   assert.equal(a.vragenDieAanDeBeurtZijn(topics,na,1000).length,1,'de nieuwe vraag staat meteen in de herhaling');
   assert.equal(a.kennisNaVraagwijziging(na,topics,2000),na,'een tweede keer verandert niets');
   assert.equal(a.kennisNaVraagwijziging({},topics,1000)['v1-nieuw'],undefined,'wie de oude vraag niet kende, leert hem gewoon in de les');
 });
 await test('Verwijderde vragen tellen niet mee in het dozenoverzicht',()=>{
   const k = {v1:{doos:5,volgende:0},weg:{doos:5,volgende:0}};
   const nu = a.kennisVanBestaandeVragen(k,proefTopics);
   assert.equal(Object.keys(nu).join(),'v1');
 });
 // Back-ups: een geldige om mee te beginnen, en varianten die stuk zijn.
 const goedeBackup = () => ({versie:1,content:{domeinen:[{id:'d1',naam:'Lesboom'}],topics:[{...drieLessen,orbs:[{...les('l1'),vragen:[proefVraag]},les('l2')]}],bronnen:{d1:[{id:'b',naam:'Bron',tekst:'x'}]}},
   leren:{voortgang:{a:1},kennis:{v1:{doos:3,volgende:5},kapot:{doos:'x'}},openingsdagen:['2026-10-01','2026-10-02']}});
 await test('Een kapotte back-up wordt geweigerd voordat er iets verandert',()=>{
   assert.equal(a.controleerBackup(goedeBackup()),null);
   const stuk = [
     b=>{b.content.topics[0].orbs=[null];},
     b=>{b.content.topics[0].orbs[0].vragen=[null];},
     b=>{b.content.topics[0].orbs[0].vragen[0]={...proefVraag,id:undefined};},
     b=>{b.content.topics[0].orbs[0].vragen[0]={...proefVraag,opties:[{}, 'b']};},
     b=>{b.content.topics[0].orbs[0].blokken=[{type:'tekst',tekst:{}}];},
     b=>{b.content.topics[0].orbs[1].id='l1';},
     b=>{b.content.topics[0].orbs[1].vragen=[{...proefVraag}];},
     b=>{b.content.topics[0].orbs[0].begrippen=[{term:{},uitleg:'x'}];},
     b=>{b.content.topics[0].domeinId='bestaat-niet';},
     b=>{b.content.domeinen.push({id:'d1',naam:'Dubbel'});},
     b=>{b.content.bronnen={d1:'tekst'};},
     b=>{b.leren={kennis:[]};},
     b=>{delete b.content;},
   ];
   stuk.forEach((maakStuk,i)=>{const b=goedeBackup();maakStuk(b);assert.ok(a.controleerBackup(b),'variant '+i+' had geweigerd moeten worden');});
   assert.ok(a.controleerBackup(null));
 });
 await test('Een back-up neemt openingsdagen mee en zet oude voortgang om',()=>{
   const vg = a.voortgangUitBackup(goedeBackup(),new Date(2026,9,3,12).getTime());
   assert.equal(vg.openingsdagen.join(),'2026-10-01,2026-10-02,2026-10-03');
   assert.equal(vg.voortgang.a.join(),'l1');
   assert.equal(Object.keys(vg.kennis).join(),'v1','onbruikbare herhaalgegevens vallen weg');
   assert.equal(vg.notificaties,true);
 });
 // Een nagebootste browseropslag: `vol` laat het wegschrijven van één sleutel mislukken.
 function proefOpslag(begin={}) {
   const data = {...begin}; const vol = new Set();
   return {data, vol, storage:{
     get: async k => (k in data ? {value:data[k]} : null),
     set: async (k,v) => { if (vol.has(k)) throw Error('QuotaExceededError'); data[k]=v; return true; },
   }};
 }
 const INHOUD = 'leerplatform-techniek-content-v1', LEREN = 'leerplatform-techniek-voortgang-v1';
 await test('Back-up terugzetten: lukt de voortgang niet, dan blijft de oude lesinhoud staan',async()=>{
   const oud = JSON.stringify({domeinen:[],topics:[],bronnen:{}});
   const o = proefOpslag({[INHOUD]:oud,[LEREN]:'{"voortgang":{}}'});
   o.vol.add(LEREN);
   const eerder = app.window.storage; app.window.storage = o.storage;
   try {
     assert.equal(await a.schrijfBackup(goedeBackup(),0),'mislukt');
     assert.equal(o.data[INHOUD],oud,'de nieuwe lesinhoud is teruggedraaid');
     o.vol.clear();
     assert.equal(await a.schrijfBackup(goedeBackup(),0),'gelukt');
     assert.equal(JSON.parse(o.data[INHOUD]).topics[0].id,'a');
     assert.equal(JSON.parse(o.data[LEREN]).voortgang.a[0],'l1');
   } finally { app.window.storage = eerder; }
 });
 await test('De noodback-up bewaart ook opslag die niet meer te lezen is',async()=>{
   const o = proefOpslag({[INHOUD]:'{kapot',[LEREN]:'{"kennis":{}}'});
   const eerder = app.window.storage; app.window.storage = o.storage;
   try {
     const b = await a.noodBackup();
     assert.equal(b.content,null);
     assert.equal(b.ruw.content,'{kapot');
     assert.equal(typeof b.leren.kennis,'object');
   } finally { app.window.storage = eerder; }
 });
 await test('Een mislukte opslag wordt aan de app gemeld',async()=>{
   const meldingen = [];
   const venster = {dispatchEvent:e=>meldingen.push(e.type)};
   const browser = vm.createContext({window:venster,CustomEvent:class{constructor(type){this.type=type;}},
     localStorage:{getItem:()=>null,setItem:()=>{throw Error('QuotaExceededError');}}});
   vm.runInContext(fs.readFileSync(path.join(__dirname,'runtime.js'),'utf8'),browser);
   await assert.rejects(venster.storage.set('sleutel','waarde'));
   assert.equal(meldingen.length,1);
   assert.equal(meldingen[0],'leerplatform-opslagfout');
 });
 await test('Ongeldige vragen worden geweigerd',()=>{
   assert.equal(a.vraagIsHeel({vraag:'Welke?',opties:['a','b'],juisteIndex:9}),false);
   assert.equal(a.vraagIsHeel({vraag:'Welke?',opties:['a','b'],juisteIndex:1}),true);
   assert.equal(a.vraagIsHeel({vraag:'Volgorde?',type:'sorteren',items:['a','b'],juisteVolgorde:[0,0]}),false);
   assert.equal(a.vraagIsHeel({vraag:'Volgorde?',type:'sorteren',items:['a','b'],juisteVolgorde:[1,0]}),true);
   assert.equal(a.vraagIsHeel({vraag:'Koppel?',type:'matchen',paren:[{links:'a',rechts:'b'},{links:'c',rechts:'d'}]}),true);
 });
 await test('Opslagfouten worden niet als succes gemeld',async()=>{
   assert.equal(await a.bewaren({}),true);
   app.window.storage.set=async()=>{throw Error('QuotaExceededError');};
   assert.equal(await a.bewaren({}),false);
 });
 // Deze controle zoekt naar vaste kenmerken: de Babel-runtime, het adres van de
 // Anthropic-API en de oude voorbeeldlessen. Een AI-aanroep via een ander adres
 // of andere lesinhoud vangt hij niet.
 await test('Eindbestand zonder Babel-runtime, zonder de Anthropic-API en zonder de oude voorbeeldlessen',()=>{
   const html=fs.readFileSync(path.join(root,'Leerplatform.html'),'utf8');
   assert.ok(!html.includes('api.anthropic.com'));
   assert.ok(!html.includes('type="text/babel"'));
   assert.ok(!html.includes('naam:"Eten"'));
   assert.ok(html.includes('leerplatform-techniek-content-v1'));
   // De app wordt leeg geleverd: geen enkele les mag nog meegebakken zijn.
   for (const zin of ['Spanning, stroom en weerstand','Basiselektra','Hydrauliek','wet van Ohm']) {
     assert.ok(!html.includes(zin), 'lesinhoud zit nog in het eindbestand: '+zin);
   }
 });
 console.log(`${total} controles geslaagd.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
